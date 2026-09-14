import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ConnectDocController } from '../src/client/connect-doc.ts'
import type { ToolHubConnectDocAnswerV1, ToolHubRemoteFace } from '../src/client/wire.ts'

const doc = (docDigest: string, faces: { id: string; publicName: string; kind: string; toolCount?: number }[] = [{ id: 'search', publicName: 'Search', kind: 'mcp', toolCount: 3 }]): ToolHubConnectDocAnswerV1 => ({ ok: true, docDigest, observedAt: 1_000, faces })

function face(over: Partial<Record<'connectDoc' | 'rediscover', (...args: never[]) => Promise<unknown>>> = {}): ToolHubRemoteFace {
  return {
    list: async () => { throw new Error('not under test') },
    setEnabled: async () => { throw new Error('not under test') },
    ...over,
  } as ToolHubRemoteFace
}

describe('connect doc controller degrade chain', () => {
  it('renders disabled with a reason when the projection is missing (old host)', async () => {
    const missing = new ConnectDocController(async () => undefined)
    await missing.read()
    expect(missing.getSnapshot()).toMatchObject({ status: 'disabled', reason: expect.stringContaining('unavailable') })
    const unexposed = new ConnectDocController(async () => face())
    await unexposed.read()
    expect(unexposed.getSnapshot()).toMatchObject({ status: 'disabled', reason: expect.stringContaining('not exposed') })
  })

  it('renders disabled with the owner reason on connect-doc-unavailable (G4 not landed)', async () => {
    const controller = new ConnectDocController(async () => face({ connectDoc: async () => ({ ok: false, code: 'connect-doc-unavailable', message: 'gateway_connect_doc.v1 is not projected by any approved binding' }) }))
    await controller.read()
    expect(controller.getSnapshot()).toMatchObject({ status: 'disabled', reason: expect.stringContaining('approved binding') })
  })

  it('renders error with a retry surface on transport failures and invalid wires', async () => {
    const transport = new ConnectDocController(async () => face({ connectDoc: async () => { throw new Error('private transport detail') } }))
    await transport.read()
    expect(transport.getSnapshot()).toMatchObject({ status: 'error' })
    expect(JSON.stringify(transport.getSnapshot())).not.toContain('private transport detail')
    const invalid = new ConnectDocController(async () => face({ connectDoc: async () => doc('NOT-SIXTEEN-HEX') }))
    await invalid.read()
    expect(invalid.getSnapshot()).toMatchObject({ status: 'error', message: expect.stringContaining('validation') })
  })

  it('serves validated docs and never renders stale data as fresh', async () => {
    let answer = doc('0123456789abcdef')
    const controller = new ConnectDocController(async () => face({ connectDoc: async () => answer }))
    await controller.read()
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', doc: { docDigest: '0123456789abcdef' } })
    answer = doc('fedcba9876543210')
    await controller.read()
    const stale = controller.getSnapshot()
    if (stale.status !== 'stale') throw new Error(`expected stale, got ${stale.status}`)
    expect(stale.doc.docDigest).toBe('0123456789abcdef') // rendered doc retained
    expect(stale.currentDigest).toBe('fedcba9876543210') // fresh digest surfaced for the banner
    await controller.read() // same digest again: banner persists until explicit re-discovery
    expect(controller.getSnapshot()).toMatchObject({ status: 'stale' })
  })
})

describe('exactly-once explicit re-discovery', () => {
  it('clears the banner only when the re-read digest matches the owner answer', async () => {
    let answer = doc('0123456789abcdef')
    const rediscoverCalls: number[] = []
    const controller = new ConnectDocController(async () => face({
      connectDoc: async () => answer,
      rediscover: async () => { rediscoverCalls.push(Date.now()); return { ok: true, generation: 2, docDigest: 'fedcba9876543210' } },
    }))
    await controller.read()
    answer = doc('fedcba9876543210')
    await controller.read()
    expect(controller.getSnapshot().status).toBe('stale')
    await controller.rediscover()
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', doc: { docDigest: 'fedcba9876543210' } })
    expect(rediscoverCalls).toHaveLength(1)
  })

  it('single-flights concurrent user actions', async () => {
    let answer = doc('0123456789abcdef')
    let calls = 0
    let release: (() => void) | undefined
    const controller = new ConnectDocController(async () => face({
      connectDoc: async () => answer,
      rediscover: async () => {
        calls += 1
        if (calls === 1) await new Promise<void>(resolvePromise => { release = resolvePromise })
        return { ok: true, generation: 2, docDigest: '0123456789abcdef' }
      },
    }))
    await controller.read()
    const first = controller.rediscover()
    expect(controller.rediscoveringSnapshot()).toBe(true)
    const second = controller.rediscover()
    // Let the first flight reach its blocking owner call before releasing it.
    for (let spin = 0; release === undefined && spin < 10_000; spin += 1) await Promise.resolve()
    release?.()
    await Promise.all([first, second])
    expect(calls).toBe(1)
    expect(controller.rediscoveringSnapshot()).toBe(false)
  })

  it('keeps state and surfaces the owner message on failure or missing probe', async () => {
    const answer = doc('0123456789abcdef')
    const controller = new ConnectDocController(async () => face({
      connectDoc: async () => answer,
      rediscover: async () => ({ ok: false, code: 'rediscover-unavailable', message: 'connect doc projection is not projected by any approved binding' }),
    }))
    await controller.read()
    await controller.rediscover()
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready' })
    expect(controller.noticeSnapshot()).toMatchObject({ kind: 'rediscover-failed' })
    const rejected = new ConnectDocController(async () => face({ connectDoc: async () => answer }))
    await rejected.read()
    await rejected.rediscover()
    expect(rejected.noticeSnapshot()).toMatchObject({ kind: 'rediscover-rejected' })
    expect(rejected.getSnapshot()).toMatchObject({ status: 'ready' })
  })
})

// Static guard: the browser side must never talk to the Gateway directly.
describe('no direct gateway surface in client sources', () => {
  const forbidden: readonly { readonly pattern: RegExp; readonly label: string }[] = [
    { pattern: /\bfetch\s*\(/, label: 'fetch(' },
    { pattern: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest' },
    { pattern: /\bnew\s+WebSocket\b/, label: 'WebSocket' },
    { pattern: /document\s*\.\s*cookie/, label: 'document.cookie' },
    { pattern: /https?:\/\/[^\s'"`]*gateway/i, label: 'gateway URL literal' },
  ]

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(entry => {
      const full = join(dir, entry)
      return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : []
    })
  }

  it('keeps every client module free of gateway credentials and fetch surfaces', () => {
    const root = resolve(import.meta.dirname, '../src/client')
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, 'utf8')
      for (const rule of forbidden) {
        expect(source, `${file} must not contain ${rule.label}`).not.toMatch(rule.pattern)
      }
    }
  })
})

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolHubSidecar } from '../src/service.ts'
import { ToolHubRemoteService, toolHubRemoteMarkers } from '../src/remote.ts'
import { mcpId, skillId } from '../src/ids.ts'
import { TOOL_HUB_REMOTE_SERVICE_KEY, TOOL_HUB_SPEC_VERSION } from '../src/constants.ts'
import type { ToolHubPrefsRowV1 } from '../src/domain.ts'
import type { ToolHubTablePort } from '../src/service.ts'

class MemoryTable implements ToolHubTablePort {
  readonly rows = new Map<string, ToolHubPrefsRowV1>()
  get(key: string) { return this.rows.get(key) }
  async put(key: string, row: ToolHubPrefsRowV1) { this.rows.set(key, row) }
}

function sidecar(table?: MemoryTable) {
  return new ToolHubSidecar({
    ...(table === undefined ? {} : { table }),
    catalog: {
      async collect() {
        return {
          skills: [{ name: 'writer', description: 'Write', invocation: { modelInvocable: true } }],
          skillsComplete: true,
          tools: [{ name: 'read_file' }, { name: 'mcp__github__create_issue' }],
        }
      },
    },
    newVersion: () => 'rv1',
  })
}

describe('ToolHubSidecar', () => {
  it('lists a bounded catalog and toggles with generation CAS', async () => {
    const core = sidecar(new MemoryTable())
    const listed = await core.list()
    expect(listed).toMatchObject({ ok: true, specVersion: TOOL_HUB_SPEC_VERSION })
    if (!listed.ok) return
    const disable = await core.setEnabled({ id: skillId('writer'), enabled: false, ifGeneration: listed.generation })
    expect(disable).toMatchObject({ ok: true, enabled: false })
    const stale = await core.setEnabled({ id: skillId('writer'), enabled: true, ifGeneration: listed.generation })
    expect(stale).toMatchObject({ ok: false, code: 'generation-conflict' })
    const after = await core.list()
    if (!after.ok) return
    expect(after.items.find(item => item.id === skillId('writer'))?.enabled).toBe(false)
    expect(core.isDisabled(skillId('writer'))).toBe(true)
    expect(core.isDisabled(mcpId('github'))).toBe(false)
  })

  it('rejects unknown and non-toggleable items without retry', async () => {
    const core = sidecar()
    const listed = await core.list()
    if (!listed.ok) return
    const unknown = await core.setEnabled({ id: skillId('missing'), enabled: false, ifGeneration: listed.generation })
    expect(unknown).toMatchObject({ ok: false, code: 'item-unknown' })
  })
})

describe('toolHub remote', () => {
  it('binds the toolHub namespace and marks list/setEnabled', async () => {
    const ctx = new Context()
    const remote = new ToolHubRemoteService(ctx, sidecar())
    expect((remote as unknown as { name: string }).name).toBe(TOOL_HUB_REMOTE_SERVICE_KEY)
    expect(toolHubRemoteMarkers(remote)).toEqual([
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'setEnabled', invocation: { kind: 'direct' } },
      { method: 'connectDoc', invocation: { kind: 'direct' } },
      { method: 'rediscover', invocation: { kind: 'direct' } },
    ])
    await ctx.fiber.dispose()
  })
})

describe('connect doc projection and re-discovery', () => {
  const doc = (over: Record<string, unknown> = {}) => ({ docDigest: '0123456789abcdef', observedAt: 1_000, faces: [{ id: 'search', publicName: 'Search', kind: 'mcp', toolCount: 3 }], ...over })

  function docSidecar(source?: { read(): Promise<unknown | undefined> }, collectCalls?: { count: number }) {
    return new ToolHubSidecar({
      catalog: {
        async collect() {
          if (collectCalls !== undefined) collectCalls.count += 1
          return { skills: [], skillsComplete: true, tools: [{ name: 'read_file' }] }
        },
      },
      ...(source === undefined ? {} : { connectDocSource: source }),
      newVersion: () => 'rv1',
    })
  }

  it('degrades to connect-doc-unavailable with a reason until G4 lands', async () => {
    const answer = await docSidecar().connectDocRead()
    expect(answer).toMatchObject({ ok: false, code: 'connect-doc-unavailable' })
    expect((answer as { message: string }).message.length).toBeGreaterThan(0)
    const transport = await docSidecar({ read: async () => { throw new Error('gateway unreachable') } }).connectDocRead()
    expect(transport).toMatchObject({ ok: false, code: 'connect-doc-unavailable' })
    expect(JSON.stringify(transport)).not.toContain('gateway unreachable')
    const invalid = await docSidecar({ read: async () => doc({ docDigest: 'NOT-A-DIGEST' }) }).connectDocRead()
    expect(invalid).toMatchObject({ ok: false, code: 'connect-doc-unavailable', message: expect.stringContaining('validation') })
  })

  it('projects only validated safe fields from an approved source', async () => {
    const answer = await docSidecar({ read: async () => doc() }).connectDocRead()
    expect(answer).toEqual({ ok: true, docDigest: '0123456789abcdef', observedAt: 1000, faces: [{ id: 'search', publicName: 'Search', kind: 'mcp', toolCount: 3 }] })
    const extra = await docSidecar({ read: async () => doc({ faces: [{ id: 'search', publicName: 'Search', kind: 'mcp', rawUrl: 'https://gateway.example' }] }) }).connectDocRead()
    // Unknown fields never cross the wire: only whitelisted face fields project.
    expect(extra).toMatchObject({ ok: true })
    expect(JSON.stringify(extra)).not.toContain('rawUrl')
    expect(JSON.stringify(extra)).not.toContain('gateway.example')
  })

  it('runs exactly one tools/list per explicit rediscover and bumps generation', async () => {
    const calls = { count: 0 }
    const core = docSidecar({ read: async () => doc({ docDigest: 'fedcba9876543210' }) }, calls)
    const before = await core.list()
    if (!before.ok) throw new Error('catalog unavailable')
    const answer = await core.rediscover()
    expect(answer).toEqual({ ok: true, generation: before.generation + 1, docDigest: 'fedcba9876543210' })
    expect(calls.count).toBe(2) // one from the assertion list(), exactly one from rediscover()
  })

  it('rejects concurrent rediscover with rediscover-in-progress and clears the guard after settle', async () => {
    const calls = { count: 0 }
    let releaseCollect: (() => void) | undefined
    const core = new ToolHubSidecar({
      catalog: {
        async collect() {
          calls.count += 1
          if (calls.count === 1) await new Promise<void>(resolve => { releaseCollect = resolve })
          return { skills: [], skillsComplete: true, tools: [] }
        },
      },
      connectDocSource: { read: async () => doc() },
      newVersion: () => 'rv1',
    })
    const first = core.rediscover()
    const second = await core.rediscover()
    expect(second).toMatchObject({ ok: false, code: 'rediscover-in-progress' })
    releaseCollect?.()
    expect(await first).toMatchObject({ ok: true })
    const third = await core.rediscover()
    expect(third).toMatchObject({ ok: true })
    expect(calls.count).toBe(2)
  })

  it('reports rediscover-unavailable when the catalog collect or doc read fails', async () => {
    const brokenCatalog = new ToolHubSidecar({
      catalog: { async collect() { throw new Error('private-loader-detail') } },
      connectDocSource: { read: async () => doc() },
      newVersion: () => 'rv1',
    })
    const failed = await brokenCatalog.rediscover()
    expect(failed).toMatchObject({ ok: false, code: 'rediscover-unavailable' })
    expect(JSON.stringify(failed)).not.toContain('private-loader-detail')
    const noDoc = await docSidecar(undefined, { count: 0 }).rediscover()
    expect(noDoc).toMatchObject({ ok: false, code: 'rediscover-unavailable' })
  })
})

it('serializes concurrent CAS writes and never leaks storage errors', async () => {
  const core = sidecar(new MemoryTable())
  const results = await Promise.all([
    core.setEnabled({ id: skillId('writer'), enabled: false, ifGeneration: 1 }),
    core.setEnabled({ id: skillId('writer'), enabled: true, ifGeneration: 1 }),
  ])
  expect(results[0]).toMatchObject({ ok: true })
  expect(results[1]).toMatchObject({ ok: false, code: 'generation-conflict' })
  class FailedTable extends MemoryTable { override async put(): Promise<void> { throw new Error('private-storage-detail') } }
  const failure = await sidecar(new FailedTable()).setEnabled({ id: skillId('writer'), enabled: false, ifGeneration: 1 })
  expect(failure).toMatchObject({ ok: false, code: 'storage-unavailable' })
  expect(JSON.stringify(failure)).not.toContain('private-storage-detail')
})

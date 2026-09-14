/**
 * Test-only support: NOT exported from the package index. Shared fixtures for
 * the 2.x unit tests — an in-memory fake stdio process (deterministic,
 * scriptable, no child process) and a real-process spawn of the synthetic
 * fixture server under tests/fixtures/registry-stdio-server.mjs.
 *
 * @module @yeisme/dsh-template-registry/test-support
 */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TemplateRegistryProcessFactory, TemplateRegistryStdioProcess } from './transport.js'

const fixtureServer = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'registry-stdio-server.mjs')

/** Spawn the synthetic fixture server with node (real process, frozen argv asserted by the fixture). */
export function fixtureSpawn(): TemplateRegistryProcessFactory {
  return ({ argv, cwd }) => {
    const child = spawn(process.execPath, [fixtureServer, ...argv], { stdio: ['pipe', 'pipe', 'pipe'], ...(cwd === undefined ? {} : { cwd }) })
    const lineListeners = new Set<(line: string) => void>()
    const exitListeners = new Set<(failure: unknown) => void>()
    let buffer = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk
      let index: number
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (line) for (const listener of [...lineListeners]) listener(line)
      }
    })
    const notifyExit = (failure: unknown) => { for (const listener of [...exitListeners]) listener(failure) }
    child.on('error', notifyExit)
    child.on('close', () => notifyExit(new Error('fixture closed')))
    return {
      write: frame => { child.stdin.write(frame + '\n') },
      onLine(listener) { lineListeners.add(listener); return () => { lineListeners.delete(listener) } },
      onExit(listener) { exitListeners.add(listener); return () => { exitListeners.delete(listener) } },
      kill: () => { child.kill() },
    }
  }
}

// ---------------------------------------------------------------------------
// In-memory fake process
// ---------------------------------------------------------------------------

/** What a scripted method does: answer, answer with a JSON-RPC error frame, or drop the process. */
export type ScriptedReply =
  | { readonly result: unknown }
  | { readonly errorFrame: { readonly code: number | string; readonly data?: { readonly code?: string } } }
  | { readonly drop: true }
  | { readonly silence: true }

export type MethodScript = (params: Record<string, unknown>) => ScriptedReply

export interface FakeProcessController {
  readonly factory: TemplateRegistryProcessFactory
  /** Number of processes the factory created. */
  spawns(): number
  /** Answer nothing and die (mid-flight disconnect on demand). */
  killAll(): void
  /** Replace the script (per-test behavior swaps). */
  setScript(script: Record<string, MethodScript>): void
}

const DEFAULT_INITIALIZE: MethodScript = () => ({
  result: {
    capabilities: { tools: {} },
    protocolVersion: '2025-06-18',
    serverInfo: { name: 'template-registry', version: 'template-registry.prompt-compiler.v0.2' },
  },
})

/**
 * In-memory fake stdio process. Frames are answered synchronously from the
 * script; `silence` never answers (drives timeout/abort paths); `drop`
 * notifies exit listeners without answering.
 */
export function createFakeProcessController(script: Record<string, MethodScript> = {}): FakeProcessController {
  let current: Record<string, MethodScript> = { initialize: DEFAULT_INITIALIZE, ...script }
  let count = 0
  const live = new Set<FakeProcess>()
  const emit = (process_: FakeProcess, line: string) => { for (const listener of [...process_.lineListeners]) listener(line) }
  class FakeProcess implements TemplateRegistryStdioProcess {
    readonly lineListeners = new Set<(line: string) => void>()
    readonly exitListeners = new Set<(failure: unknown) => void>()
    private dead = false
    write(frame: string): void {
      if (this.dead) return
      let parsed: { id?: unknown; method?: unknown; params?: unknown }
      try { parsed = JSON.parse(frame) as { id?: unknown; method?: unknown; params?: unknown } } catch { return }
      if (typeof parsed.method !== 'string') return
      const method = current[parsed.method] ?? current['*']
      if (method === undefined) {
        if (typeof parsed.id === 'number') emit(this, JSON.stringify({ jsonrpc: '2.0', id: parsed.id, error: { code: -32601, message: 'method not found' } }))
        return
      }
      const reply = method((parsed.params ?? {}) as Record<string, unknown>)
      if (reply === undefined) return
      if ('drop' in reply) { this.die(new Error('fake owner dropped')); return }
      if ('silence' in reply) return
      if (typeof parsed.id !== 'number') return
      if ('errorFrame' in reply) {
        emit(this, JSON.stringify({ jsonrpc: '2.0', id: parsed.id, error: { code: reply.errorFrame.code, ...(reply.errorFrame.data === undefined ? {} : { data: reply.errorFrame.data }) } }))
        return
      }
      emit(this, JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: reply.result }))
    }
    onLine(listener: (line: string) => void): () => void { this.lineListeners.add(listener); return () => { this.lineListeners.delete(listener) } }
    onExit(listener: (failure: unknown) => void): () => void { this.exitListeners.add(listener); return () => { this.exitListeners.delete(listener) } }
    kill(): void { this.die(new Error('fake owner killed')) }
    die(failure: unknown): void {
      // Idempotent: a real child_process kill() on an exited process is a
      // no-op, and teardown may kill from inside an exit listener.
      if (this.dead) return
      this.dead = true
      live.delete(this)
      for (const listener of [...this.exitListeners]) listener(failure)
    }
  }
  const controller: FakeProcessController = {
    factory: () => {
      count += 1
      const process_ = new FakeProcess()
      live.add(process_)
      return process_ as TemplateRegistryStdioProcess
    },
    spawns: () => count,
    killAll: () => { for (const process_ of [...live]) process_.die(new Error('fake owner dropped')) },
    setScript: next => { current = { initialize: DEFAULT_INITIALIZE, ...next } },
  }
  return controller
}

// ---------------------------------------------------------------------------
// Sample promptrepo catalog (promptrepo.catalog.v0.1 shape, synthetic)
// ---------------------------------------------------------------------------

export function sampleCatalog(digest = 'sha256:catalog-snapshot-1') {
  return {
    schema_version: 'promptrepo.catalog.v0.1',
    digest,
    repository: { id: 'official', name: 'Yeisme Official Prompt Solutions', default_locale: 'en', taxonomy_version: 'v1' },
    solutions: [
      {
        package_id: '3d', id: '3d-asset-review-beta', version: '1.0.0-beta.1', digest: 'sha256:solution-1',
        category: '3d', tags: ['category:3d', 'job:critic_review'], capabilities: ['model3d', 'review'],
        rights: 'internal', maturity: 'exploratory',
        locales: {
          en: { title: '3D asset review checklist', summary: 'Review a candidate 3D asset.', usage: 'English-compiled beta.' },
          'zh-CN': { title: '3D 资产评审', summary: '覆盖几何完整性的评审清单。', usage: '中文伴读说明。' },
        },
        templates: [
          { role: 'main', locale: 'en', digest: 'sha256:3435f85bd81ce350646f6888ecbd411203b8c5f4a6a317667f599f51f9310755' },
        ],
      },
      {
        package_id: 'agent', id: 'digital-human-persona-system', version: '1.0.0', digest: 'sha256:solution-2',
        category: 'agent', tags: ['category:agent'], capabilities: ['persona'],
        rights: 'external-attributed', maturity: 'first-support',
        locales: { en: { title: 'Digital-human persona system prompt', summary: 'Compile a persona system prompt.' } },
        templates: [
          { role: 'main', locale: 'en', digest: 'sha256:template-2' },
          { role: 'alt', locale: 'en', digest: 'sha256:template-2-alt' },
        ],
      },
    ],
  }
}

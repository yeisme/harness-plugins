import { randomUUID } from 'node:crypto'
import inspector from 'node:inspector'
import type { CpuProfileV1, DevtoolsCpuProfileAnswerV1 } from './types.ts'
import { DEVTOOLS_SPEC_VERSION } from './types.ts'
import { normalizeScriptUrl } from './redaction.ts'

export const DEFAULT_CPU_PROFILE_DURATION_MS = 10_000
export const MIN_CPU_PROFILE_DURATION_MS = 1_000
export const MAX_CPU_PROFILE_DURATION_MS = 30_000

export interface InspectorSessionFace {
  connect(): void
  disconnect(): void
  post(method: string, params: Record<string, unknown>, callback: (error: Error | null, result?: unknown) => void): void
}

function post(session: InspectorSessionFace, method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => session.post(method, params, (error, result) => error === null ? resolve(result) : reject(error)))
}

function normalizeProfile(value: unknown, workspaceRoot: string): CpuProfileV1 {
  const profile = (value as { profile?: CpuProfileV1 } | undefined)?.profile
  if (profile === undefined || !Array.isArray(profile.nodes)) throw new TypeError('inspector returned no CPU profile')
  return {
    ...profile,
    nodes: profile.nodes.map(node => ({
      ...node,
      callFrame: { ...node.callFrame, url: normalizeScriptUrl(node.callFrame.url, workspaceRoot) },
    })),
  }
}

export class CpuProfiler {
  private active = false
  private disposed = false
  private activeSession: InspectorSessionFace | undefined

  constructor(
    private readonly localAuthority: () => boolean,
    private readonly createSession: () => InspectorSessionFace = () => new inspector.Session(),
    private readonly wait: (durationMs: number) => Promise<void> = durationMs => new Promise(resolve => setTimeout(resolve, durationMs)),
    private readonly workspaceRoot = process.cwd(),
  ) {}

  available(): boolean {
    return !this.disposed && this.localAuthority()
  }

  async capture(durationMs = DEFAULT_CPU_PROFILE_DURATION_MS): Promise<DevtoolsCpuProfileAnswerV1> {
    if (this.disposed) return failure('capability_unavailable', 'CPU profiling is unavailable', false)
    if (!this.localAuthority()) return failure('not_local', 'CPU profiling requires a local loopback Web surface', false)
    if (!Number.isSafeInteger(durationMs) || durationMs < MIN_CPU_PROFILE_DURATION_MS || durationMs > MAX_CPU_PROFILE_DURATION_MS) {
      return failure('invalid_duration', 'durationMs must be between 1000 and 30000', false)
    }
    if (this.active) return failure('capture_busy', 'A CPU profile is already running', true)
    const session = this.createSession()
    this.active = true
    this.activeSession = session
    try {
      session.connect()
      await post(session, 'Profiler.enable')
      await post(session, 'Profiler.start')
      await this.wait(durationMs)
      const result = await post(session, 'Profiler.stop')
      return { ok: true, specVersion: DEVTOOLS_SPEC_VERSION, captureId: `cpu_${randomUUID()}`, durationMs, profile: normalizeProfile(result, this.workspaceRoot) }
    } catch {
      return failure('internal_error', 'CPU profile capture failed', true)
    } finally {
      this.active = false
      if (this.activeSession === session) this.activeSession = undefined
      try { session.disconnect() } catch { /* contained teardown */ }
    }
  }

  dispose(): void {
    this.disposed = true
    const session = this.activeSession
    this.activeSession = undefined
    if (session !== undefined) {
      session.post('Profiler.stop', {}, () => undefined)
      try { session.disconnect() } catch { /* contained teardown */ }
    }
  }
}

function failure(code: 'not_local' | 'capture_busy' | 'invalid_duration' | 'capability_unavailable' | 'internal_error', message: string, retryable: boolean): DevtoolsCpuProfileAnswerV1 {
  return { ok: false, specVersion: DEVTOOLS_SPEC_VERSION, error: { code, message, retryable } }
}

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { CpuProfiler, DevtoolsRemoteService, DevtoolsService, DevtoolsStore, devtoolsRemoteMarkers, type InspectorSessionFace } from '../src/index.ts'

class FakeInspector implements InspectorSessionFace {
  readonly calls: string[] = []
  connected = false
  connect(): void { this.connected = true }
  disconnect(): void { this.connected = false }
  post(method: string, _params: Record<string, unknown>, callback: (error: Error | null, result?: unknown) => void): void {
    this.calls.push(method)
    callback(null, method === 'Profiler.stop' ? { profile: { startTime: 0, endTime: 1, nodes: [{ id: 1, callFrame: { functionName: 'run', scriptId: '1', url: '/workspace/app/src/run.ts', lineNumber: 1, columnNumber: 1 } }] } } : {})
  }
}

describe('CPU profiler and Remote', () => {
  it('captures one normalized local profile and validates duration', async () => {
    const fake = new FakeInspector()
    const profiler = new CpuProfiler(() => true, () => fake, async () => undefined, '/workspace/app')
    expect(await profiler.capture(999)).toMatchObject({ ok: false, error: { code: 'invalid_duration' } })
    const captured = await profiler.capture(1000)
    expect(captured).toMatchObject({ ok: true, durationMs: 1000 })
    if (!captured.ok) throw new Error('unreachable')
    expect(captured.profile.nodes[0]?.callFrame.url).toBe('src/run.ts')
    expect(fake.calls).toEqual(['Profiler.enable', 'Profiler.start', 'Profiler.stop'])
  })

  it('refuses non-local capture and exposes the additive Remote methods', async () => {
    const ctx = new Context()
    const profiler = new CpuProfiler(() => false)
    const service = new DevtoolsService(new DevtoolsStore({ bootId: 'boot' }), profiler, { logger: true, sessionTimeline: true, hostMetrics: true, exactRpcCorrelation: false }, { write: () => undefined })
    const remote = new DevtoolsRemoteService(ctx, service)
    expect(devtoolsRemoteMarkers(remote)).toEqual([
      { method: 'snapshot', invocation: { kind: 'direct' } },
      { method: 'captureCpuProfile', invocation: { kind: 'direct' } },
    ])
    expect(await remote.captureCpuProfile({ durationMs: 1000 })).toMatchObject({ ok: false, error: { code: 'not_local' } })
    expect(await remote.snapshot({ limit: 501 })).toMatchObject({ ok: false, error: { code: 'invalid_request' } })
    await ctx.fiber.dispose()
  })
})

import { describe, expect, it } from 'vitest'
import { HostPerformanceSampler, SessionTraceCollector, DevtoolsStore, type HostMetricsSource } from '../src/index.ts'

describe('session trace derivation', () => {
  it('derives TTFT and tool spans without payloads', () => {
    let now = 1000
    const store = new DevtoolsStore({ now: () => now })
    const trace = new SessionTraceCollector(store, () => now)
    const session = { id: 'real-session-id' }
    trace.sessionCreated(session)
    trace.event(session, { type: 'turn/start', time: 1000, data: { turn: 1 } })
    trace.event(session, { type: 'step/start', time: 1100, data: { turn: 1, step: 1 } })
    trace.event(session, { type: 'assistant/chunk', time: 4301, data: { turn: 1, step: 1, chunk: { text: 'private prompt response' } } })
    trace.event(session, { type: 'assistant/message', time: 4500, data: { turn: 1, step: 1, message: 'private' } })
    trace.event(session, { type: 'tool/call', time: 5000, data: { callId: 'call-1', name: 'bash', arguments: 'private args' } })
    trace.event(session, { type: 'tool/result', time: 11_000, data: { message: { source: { callId: 'call-1' }, isError: false, content: 'private result' } } })
    trace.event(session, { type: 'turn/end', time: 12_000, data: { turn: 1 } })
    const spans = store.recordsOfType('span')
    expect(spans.map(span => [span.category, span.status, span.durationMs])).toEqual([
      ['ttft', 'ok', 3201], ['llm', 'ok', 3400], ['tool', 'ok', 6000], ['turn', 'ok', 11_000],
    ])
    expect(store.recordsOfType('finding').map(finding => finding.code)).toEqual(['session.ttft_slow', 'tool.duration_slow'])
    expect(JSON.stringify(store.snapshot({}, { logger: true, sessionTimeline: true, hostMetrics: true, cpuProfile: false, exactRpcCorrelation: false }))).not.toContain('private')
  })

  it('closes unfinished spans as partial', () => {
    let now = 100
    const store = new DevtoolsStore({ now: () => now })
    const trace = new SessionTraceCollector(store, () => now)
    const session = { id: 's' }
    trace.event(session, { type: 'turn/start', time: 10, data: { turn: 1 } })
    trace.event(session, { type: 'tool/call', time: 20, data: { callId: 'c', name: 'write' } })
    now = 50
    trace.sessionDisposed(session)
    expect(store.recordsOfType('span').map(span => span.status)).toEqual(['partial', 'partial'])
  })
})

describe('HostPerformanceSampler', () => {
  it('emits deterministic lag and memory findings', () => {
    let now = 0
    const metrics = [
      { cpuPercent: 1, rssBytes: 100, heapUsedBytes: 50, heapTotalBytes: 80, eventLoopUtilization: 0.1, eventLoopDelayP95Ms: 10 },
      { cpuPercent: 2, rssBytes: 200 * 1024 * 1024, heapUsedBytes: 60, heapTotalBytes: 90, eventLoopUtilization: 0.2, eventLoopDelayP95Ms: 150 },
    ]
    const source: HostMetricsSource = { sample: () => metrics.shift()!, dispose: () => undefined }
    const store = new DevtoolsStore({ now: () => now })
    const sampler = new HostPerformanceSampler(store, () => now, source)
    sampler.sample()
    now = 5 * 60_000
    sampler.sample()
    expect(store.recordsOfType('finding').map(finding => finding.code)).toEqual(['host.event_loop_lag', 'host.memory_growth'])
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserPerformanceCollector } from '../src/client/collector.ts'
import { containsForbiddenExportContent, createDevtoolsExport } from '../src/client/export.ts'
import type { DevtoolsControllerState } from '../src/client/controller.ts'

afterEach(() => { vi.unstubAllGlobals() })

describe('BrowserPerformanceCollector', () => {
  it('records safe same-origin API timing and excludes DevTools self-calls', () => {
    class Observer {
      static supportedEntryTypes = ['resource', 'longtask']
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('PerformanceObserver', Observer)
    const collector = new BrowserPerformanceCollector(() => new Observer() as never, 'https://harness.example')
    collector.ingest('api', { name: 'https://harness.example/api/session.list?token=private', startTime: 10, duration: 700, entryType: 'resource', toJSON: () => ({}) } as PerformanceEntry)
    collector.ingest('api', { name: 'https://harness.example/api/devtools.snapshot', startTime: 20, duration: 1, entryType: 'resource', toJSON: () => ({}) } as PerformanceEntry)
    collector.ingest('api', { name: 'https://other.example/api/session.list', startTime: 20, duration: 1, entryType: 'resource', toJSON: () => ({}) } as PerformanceEntry)
    expect(collector.snapshot()).toMatchObject([{ kind: 'api', name: '/api/session.list', durationMs: 700, findingCode: 'web.api_slow' }])
    expect(JSON.stringify(collector.snapshot())).not.toContain('token=')
  })
})

describe('DevTools export', () => {
  it('builds one safe application-authored document', () => {
    vi.stubGlobal('PerformanceObserver', class { static supportedEntryTypes: string[] = []; observe(): void {}; disconnect(): void {} })
    const collector = new BrowserPerformanceCollector()
    const state: DevtoolsControllerState = { status: 'ready', clockOffsetMs: 2, clockUncertaintyMs: 3, snapshot: { ok: true, specVersion: '1.0', bootId: 'boot', serverTime: 10, nextSeq: 1, truncated: false, capabilities: { logger: true, sessionTimeline: true, hostMetrics: true, cpuProfile: false, exactRpcCorrelation: false }, summary: { uptimeMs: 1, records: 1, logs: 0, spans: 0, samples: 0, findings: 0, errors: 0 }, records: [{ seq: 1, ts: 1, type: 'lifecycle', event: 'devtools.ready', severity: 'info', summary: 'ready' }] } }
    const exported = createDevtoolsExport(state, collector, new Date('2026-01-01T00:00:00Z'))
    expect(exported).toMatchObject({ schemaVersion: 'dsh.devtools.export.v1', clock: { offsetMs: 2, uncertaintyMs: 3, exactRpcCorrelation: false }, redaction: { enabled: true } })
    expect(containsForbiddenExportContent(exported)).toBe(false)
    expect(containsForbiddenExportContent({ Authorization: 'Bearer secret' })).toBe(true)
  })
})

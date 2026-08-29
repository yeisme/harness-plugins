import type { BrowserCapabilitiesV1, BrowserPerformanceKind, BrowserPerformanceRecordV1 } from '../wire.ts'

const CAPACITY = 1000
const API_SLOW_MS = 500
const LONG_TASK_MS = 50

interface PerformanceObserverLike { observe(options: PerformanceObserverInit): void; disconnect(): void }
type ObserverFactory = (callback: PerformanceObserverCallback) => PerformanceObserverLike

function supported(type: string): boolean {
  return typeof PerformanceObserver !== 'undefined' && (PerformanceObserver.supportedEntryTypes?.includes(type) ?? false)
}

export class BrowserPerformanceCollector {
  private records: BrowserPerformanceRecordV1[] = []
  private sequence = 0
  private observers: PerformanceObserverLike[] = []
  readonly capabilities: BrowserCapabilitiesV1

  constructor(private readonly factory: ObserverFactory = callback => new PerformanceObserver(callback), private readonly origin = globalThis.location?.origin ?? 'http://localhost') {
    this.capabilities = {
      navigation: supported('navigation'), paint: supported('paint'), lcp: supported('largest-contentful-paint'),
      layoutShift: supported('layout-shift'), longTask: supported('longtask'), resource: supported('resource'),
    }
  }

  start(): void {
    this.observe('navigation', 'navigation')
    this.observe('paint', 'paint')
    this.observe('largest-contentful-paint', 'lcp')
    this.observe('layout-shift', 'layout-shift')
    this.observe('longtask', 'long-task')
    this.observe('resource', 'api')
  }

  snapshot(): readonly BrowserPerformanceRecordV1[] { return this.records }

  dispose(): void { for (const observer of this.observers) observer.disconnect(); this.observers = [] }

  ingest(kind: BrowserPerformanceKind, entry: PerformanceEntry): void {
    if (kind === 'api') {
      let url: URL
      try { url = new URL(entry.name, this.origin) } catch { return }
      if (url.origin !== this.origin || !url.pathname.startsWith('/api') || url.pathname.includes('devtools.')) return
      this.append({ kind, ts: performance.timeOrigin + entry.startTime, name: url.pathname, durationMs: entry.duration, ...('transferSize' in entry && typeof entry.transferSize === 'number' ? { transferSize: entry.transferSize } : {}), ...(entry.duration > API_SLOW_MS ? { findingCode: 'web.api_slow' as const } : {}) })
      return
    }
    const value = 'value' in entry && typeof entry.value === 'number' ? entry.value : undefined
    this.append({ kind, ts: performance.timeOrigin + entry.startTime, name: entry.name || kind, durationMs: entry.duration, ...(value === undefined ? {} : { value }), ...(kind === 'long-task' && entry.duration > LONG_TASK_MS ? { findingCode: 'web.long_task' as const } : {}) })
  }

  private observe(entryType: string, kind: BrowserPerformanceKind): void {
    const capability = entryType === 'largest-contentful-paint' ? this.capabilities.lcp : entryType === 'layout-shift' ? this.capabilities.layoutShift : entryType === 'longtask' ? this.capabilities.longTask : this.capabilities[entryType as keyof BrowserCapabilitiesV1]
    if (!capability) return
    try {
      const observer = this.factory(list => { for (const entry of list.getEntries()) this.ingest(kind, entry) })
      observer.observe({ type: entryType, buffered: true })
      this.observers.push(observer)
    } catch { /* capability is best-effort */ }
  }

  private append(input: Omit<BrowserPerformanceRecordV1, 'seq' | 'type'>): void {
    const record: BrowserPerformanceRecordV1 = { ...input, seq: ++this.sequence, type: 'browser-performance' }
    this.records = [...this.records, record].slice(-CAPACITY)
  }
}

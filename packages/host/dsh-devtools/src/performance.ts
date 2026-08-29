import { monitorEventLoopDelay, performance, type EventLoopUtilization } from 'node:perf_hooks'
import type { DevtoolsHostMetricsV1, DevtoolsSampleRecordV1 } from './types.ts'
import type { DevtoolsStore } from './store.ts'

export const EVENT_LOOP_LAG_THRESHOLD_MS = 100
export const MEMORY_GROWTH_THRESHOLD_BYTES = 128 * 1024 * 1024
export const MEMORY_WINDOW_MS = 5 * 60_000

export interface HostMetricsSource {
  sample(elapsedMs: number): DevtoolsHostMetricsV1
  dispose(): void
}

class NativeHostMetricsSource implements HostMetricsSource {
  private readonly histogram = monitorEventLoopDelay({ resolution: 20 })
  private lastCpu = process.cpuUsage()
  private lastElu: EventLoopUtilization = performance.eventLoopUtilization()

  constructor() {
    this.histogram.enable()
  }

  sample(elapsedMs: number): DevtoolsHostMetricsV1 {
    const cpu = process.cpuUsage(this.lastCpu)
    const memory = process.memoryUsage()
    const elu = performance.eventLoopUtilization(this.lastElu)
    const metrics: DevtoolsHostMetricsV1 = {
      cpuPercent: Number((((cpu.user + cpu.system) / (elapsedMs * 1000)) * 100).toFixed(2)),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      eventLoopUtilization: Number(elu.utilization.toFixed(4)),
      eventLoopDelayP95Ms: Number((this.histogram.percentile(95) / 1e6).toFixed(2)),
    }
    this.lastCpu = process.cpuUsage()
    this.lastElu = performance.eventLoopUtilization()
    this.histogram.reset()
    return metrics
  }

  dispose(): void { this.histogram.disable() }
}

export class HostPerformanceSampler {
  private lastAt: number
  private previousLagging = false

  constructor(private readonly store: DevtoolsStore, private readonly now: () => number = Date.now, private readonly source: HostMetricsSource = new NativeHostMetricsSource()) {
    this.lastAt = now()
  }

  sample(): DevtoolsSampleRecordV1 {
    const ts = this.now()
    const elapsedMs = Math.max(1, ts - this.lastAt)
    const metrics = this.source.sample(elapsedMs)
    this.lastAt = ts
    const record = this.store.append({ type: 'sample', scope: 'host', ts, metrics }) as DevtoolsSampleRecordV1
    const lagging = metrics.eventLoopDelayP95Ms > EVENT_LOOP_LAG_THRESHOLD_MS
    if (lagging && !this.previousLagging) {
      this.store.appendFinding({ code: 'host.event_loop_lag', severity: 'warn', summary: `Event-loop p95 ${metrics.eventLoopDelayP95Ms}ms exceeds ${EVENT_LOOP_LAG_THRESHOLD_MS}ms`, evidenceSeqs: [record.seq], ts })
    }
    this.previousLagging = lagging
    this.checkMemoryGrowth(record)
    return record
  }

  private checkMemoryGrowth(record: DevtoolsSampleRecordV1): void {
    const baseline = this.store.recordsOfType('sample').find(sample => record.ts - sample.ts >= MEMORY_WINDOW_MS)
    if (baseline === undefined) return
    if (record.metrics.rssBytes - baseline.metrics.rssBytes < MEMORY_GROWTH_THRESHOLD_BYTES) return
    const recent = this.store.recordsOfType('finding').findLast(finding => finding.code === 'host.memory_growth')
    if (recent !== undefined && record.ts - recent.ts < MEMORY_WINDOW_MS) return
    this.store.appendFinding({ code: 'host.memory_growth', severity: 'warn', summary: 'RSS grew by at least 128 MiB over five minutes', evidenceSeqs: [baseline.seq, record.seq], ts: record.ts })
  }

  dispose(): void {
    this.source.dispose()
  }
}

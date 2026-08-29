import type { Message } from '@deepseek-ai/cordis'
import type { CpuProfiler } from './cpu-profile.ts'
import { logFingerprint, safeErrorCode, safeLogSummary, safeIdentifier } from './redaction.ts'
import type { DevtoolsStore } from './store.ts'
import type { DevtoolsCapabilitiesV1, DevtoolsCpuProfileAnswerV1, DevtoolsCpuProfileInputV1, DevtoolsRecordV1, DevtoolsSeverity, DevtoolsSnapshotAnswerV1, DevtoolsSnapshotInputV1 } from './types.ts'
import { DEVTOOLS_SPEC_VERSION } from './types.ts'

const LEVEL: Record<DevtoolsSeverity, number> = { error: 0, warn: 1, info: 2, debug: 3 }

export interface TerminalWriter { write(line: string): void }

export class DevtoolsService {
  constructor(
    readonly store: DevtoolsStore,
    readonly cpuProfiler: CpuProfiler,
    readonly capabilities: Omit<DevtoolsCapabilitiesV1, 'cpuProfile'>,
    private readonly terminal: TerminalWriter,
    private readonly level: DevtoolsSeverity = 'info',
  ) {}

  ingestLog(message: Message): void {
    const severity = message.type as DevtoolsSeverity
    const source = safeIdentifier(message.name, 'runtime')
    const first = message.args[0]
    const errorCode = safeErrorCode(first)
    const record = this.store.append({ type: 'log', ts: message.ts, severity, source, fingerprint: logFingerprint(source, severity, message.args), summary: safeLogSummary(source, severity), ...(errorCode === undefined ? {} : { errorCode }) })
    if (LEVEL[severity] <= LEVEL[this.level]) this.terminal.write(this.render(record))
  }

  snapshot(input: DevtoolsSnapshotInputV1): DevtoolsSnapshotAnswerV1 {
    try {
      return this.store.snapshot(input, { ...this.capabilities, cpuProfile: this.cpuProfiler.available() })
    } catch {
      return { ok: false, specVersion: DEVTOOLS_SPEC_VERSION, error: { code: 'invalid_request', message: 'Invalid DevTools snapshot request', retryable: false } }
    }
  }

  captureCpuProfile(input: DevtoolsCpuProfileInputV1): Promise<DevtoolsCpuProfileAnswerV1> {
    return this.cpuProfiler.capture(input.durationMs)
  }

  render(record: DevtoolsRecordV1): string {
    if (record.type === 'log') return `[dsh-devtools][${record.severity}] source=${record.source} fingerprint=${record.fingerprint}${record.errorCode === undefined ? '' : ` code=${record.errorCode}`}`
    if (record.type === 'finding') return `[dsh-devtools][${record.severity}] finding=${record.code} summary=${record.summary}`
    if (record.type === 'sample') {
      const metrics = record.metrics
      return `[dsh-devtools][perf] cpu=${metrics.cpuPercent.toFixed(1)}% rss_mb=${(metrics.rssBytes / 1048576).toFixed(1)} elu=${metrics.eventLoopUtilization.toFixed(3)} lag_p95_ms=${metrics.eventLoopDelayP95Ms.toFixed(1)}`
    }
    return `[dsh-devtools] event=${record.type} seq=${record.seq}`
  }
}

export const DEVTOOLS_SPEC_VERSION = '1.0' as const
export const DEVTOOLS_SERVICE_KEY = 'devtools' as const
export const DEFAULT_SNAPSHOT_LIMIT = 200
export const MAX_SNAPSHOT_LIMIT = 500

export type DevtoolsSeverity = 'error' | 'warn' | 'info' | 'debug'
export type DevtoolsSpanStatus = 'ok' | 'error' | 'partial'

interface RecordBase {
  readonly seq: number
  readonly ts: number
}

export interface DevtoolsLogRecordV1 extends RecordBase {
  readonly type: 'log'
  readonly severity: DevtoolsSeverity
  readonly source: string
  readonly fingerprint: string
  readonly summary: string
  readonly errorCode?: string
}

export interface DevtoolsSpanRecordV1 extends RecordBase {
  readonly type: 'span'
  readonly category: 'turn' | 'llm' | 'ttft' | 'tool'
  readonly name: string
  readonly status: DevtoolsSpanStatus
  readonly startTime: number
  readonly endTime: number
  readonly durationMs: number
  readonly sessionRef?: string
  readonly callRef?: string
}

export interface DevtoolsHostMetricsV1 {
  readonly cpuPercent: number
  readonly rssBytes: number
  readonly heapUsedBytes: number
  readonly heapTotalBytes: number
  readonly eventLoopUtilization: number
  readonly eventLoopDelayP95Ms: number
}

export interface DevtoolsSampleRecordV1 extends RecordBase {
  readonly type: 'sample'
  readonly scope: 'host'
  readonly metrics: DevtoolsHostMetricsV1
}

export interface DevtoolsFindingRecordV1 extends RecordBase {
  readonly type: 'finding'
  readonly code: 'tool.duration_slow' | 'session.ttft_slow' | 'host.event_loop_lag' | 'host.memory_growth' | 'runtime.error'
  readonly severity: 'warn' | 'error'
  readonly summary: string
  readonly evidenceSeqs: readonly number[]
}

export interface DevtoolsLifecycleRecordV1 extends RecordBase {
  readonly type: 'lifecycle'
  readonly event: 'devtools.ready' | 'session.created' | 'session.disposed' | 'llm.retry' | 'agent.error' | 'devtools.shutdown'
  readonly severity: 'info' | 'warn' | 'error'
  readonly summary: string
  readonly sessionRef?: string
}

export type DevtoolsRecordV1 =
  | DevtoolsLogRecordV1
  | DevtoolsSpanRecordV1
  | DevtoolsSampleRecordV1
  | DevtoolsFindingRecordV1
  | DevtoolsLifecycleRecordV1

export type DevtoolsRecordInputV1 =
  | Omit<DevtoolsLogRecordV1, 'seq'>
  | Omit<DevtoolsSpanRecordV1, 'seq'>
  | Omit<DevtoolsSampleRecordV1, 'seq'>
  | Omit<DevtoolsFindingRecordV1, 'seq'>
  | Omit<DevtoolsLifecycleRecordV1, 'seq'>

export interface DevtoolsCapabilitiesV1 {
  readonly logger: boolean
  readonly sessionTimeline: boolean
  readonly hostMetrics: boolean
  readonly cpuProfile: boolean
  readonly exactRpcCorrelation: boolean
}

export interface DevtoolsSummaryV1 {
  readonly uptimeMs: number
  readonly records: number
  readonly logs: number
  readonly spans: number
  readonly samples: number
  readonly findings: number
  readonly errors: number
  readonly latestMetrics?: DevtoolsHostMetricsV1
}

export interface DevtoolsSnapshotInputV1 {
  readonly afterSeq?: number
  readonly limit?: number
}

export interface DevtoolsSnapshotSuccessV1 {
  readonly ok: true
  readonly specVersion: typeof DEVTOOLS_SPEC_VERSION
  readonly bootId: string
  readonly serverTime: number
  readonly nextSeq: number
  readonly truncated: boolean
  readonly capabilities: DevtoolsCapabilitiesV1
  readonly summary: DevtoolsSummaryV1
  readonly records: readonly DevtoolsRecordV1[]
}

export type DevtoolsFailureCodeV1 =
  | 'invalid_request'
  | 'not_local'
  | 'capture_busy'
  | 'invalid_duration'
  | 'capability_unavailable'
  | 'internal_error'

export interface DevtoolsFailureV1 {
  readonly ok: false
  readonly specVersion: typeof DEVTOOLS_SPEC_VERSION
  readonly error: {
    readonly code: DevtoolsFailureCodeV1
    readonly message: string
    readonly retryable: boolean
  }
}

export interface DevtoolsCpuProfileInputV1 {
  readonly durationMs?: number
}

export interface CpuProfileCallFrameV1 {
  readonly functionName: string
  readonly scriptId: string
  readonly url: string
  readonly lineNumber: number
  readonly columnNumber: number
}

export interface CpuProfileNodeV1 {
  readonly id: number
  readonly callFrame: CpuProfileCallFrameV1
  readonly hitCount?: number
  readonly children?: readonly number[]
}

export interface CpuProfileV1 {
  readonly startTime: number
  readonly endTime: number
  readonly nodes: readonly CpuProfileNodeV1[]
  readonly samples?: readonly number[]
  readonly timeDeltas?: readonly number[]
}

export interface DevtoolsCpuProfileSuccessV1 {
  readonly ok: true
  readonly specVersion: typeof DEVTOOLS_SPEC_VERSION
  readonly captureId: string
  readonly durationMs: number
  readonly profile: CpuProfileV1
}

export type DevtoolsSnapshotAnswerV1 = DevtoolsSnapshotSuccessV1 | DevtoolsFailureV1
export type DevtoolsCpuProfileAnswerV1 = DevtoolsCpuProfileSuccessV1 | DevtoolsFailureV1

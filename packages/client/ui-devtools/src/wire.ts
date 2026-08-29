export const DEVTOOLS_SPEC_VERSION = '1.0' as const

export type DevtoolsSeverity = 'error' | 'warn' | 'info' | 'debug'
export interface DevtoolsHostMetricsV1 { readonly cpuPercent: number; readonly rssBytes: number; readonly heapUsedBytes: number; readonly heapTotalBytes: number; readonly eventLoopUtilization: number; readonly eventLoopDelayP95Ms: number }
interface Base { readonly seq: number; readonly ts: number }
export interface DevtoolsLogRecordV1 extends Base { readonly type: 'log'; readonly severity: DevtoolsSeverity; readonly source: string; readonly fingerprint: string; readonly summary: string; readonly errorCode?: string }
export interface DevtoolsSpanRecordV1 extends Base { readonly type: 'span'; readonly category: 'turn' | 'llm' | 'ttft' | 'tool'; readonly name: string; readonly status: 'ok' | 'error' | 'partial'; readonly startTime: number; readonly endTime: number; readonly durationMs: number; readonly sessionRef?: string; readonly callRef?: string }
export interface DevtoolsSampleRecordV1 extends Base { readonly type: 'sample'; readonly scope: 'host'; readonly metrics: DevtoolsHostMetricsV1 }
export interface DevtoolsFindingRecordV1 extends Base { readonly type: 'finding'; readonly code: string; readonly severity: 'warn' | 'error'; readonly summary: string; readonly evidenceSeqs: readonly number[] }
export interface DevtoolsLifecycleRecordV1 extends Base { readonly type: 'lifecycle'; readonly event: string; readonly severity: 'info' | 'warn' | 'error'; readonly summary: string; readonly sessionRef?: string }
export type DevtoolsRecordV1 = DevtoolsLogRecordV1 | DevtoolsSpanRecordV1 | DevtoolsSampleRecordV1 | DevtoolsFindingRecordV1 | DevtoolsLifecycleRecordV1
export interface DevtoolsCapabilitiesV1 { readonly logger: boolean; readonly sessionTimeline: boolean; readonly hostMetrics: boolean; readonly cpuProfile: boolean; readonly exactRpcCorrelation: boolean }
export interface DevtoolsSummaryV1 { readonly uptimeMs: number; readonly records: number; readonly logs: number; readonly spans: number; readonly samples: number; readonly findings: number; readonly errors: number; readonly latestMetrics?: DevtoolsHostMetricsV1 }
export interface DevtoolsSnapshotInputV1 { readonly afterSeq?: number; readonly limit?: number }
export interface DevtoolsSnapshotSuccessV1 { readonly ok: true; readonly specVersion: '1.0'; readonly bootId: string; readonly serverTime: number; readonly nextSeq: number; readonly truncated: boolean; readonly capabilities: DevtoolsCapabilitiesV1; readonly summary: DevtoolsSummaryV1; readonly records: readonly DevtoolsRecordV1[] }
export interface DevtoolsFailureV1 { readonly ok: false; readonly specVersion: '1.0'; readonly error: { readonly code: string; readonly message: string; readonly retryable: boolean } }
export interface DevtoolsCpuProfileInputV1 { readonly durationMs?: number }
export interface CpuProfileV1 { readonly startTime: number; readonly endTime: number; readonly nodes: readonly { readonly id: number; readonly callFrame: { readonly functionName: string; readonly scriptId: string; readonly url: string; readonly lineNumber: number; readonly columnNumber: number }; readonly hitCount?: number; readonly children?: readonly number[] }[]; readonly samples?: readonly number[]; readonly timeDeltas?: readonly number[] }
export interface DevtoolsCpuProfileSuccessV1 { readonly ok: true; readonly specVersion: '1.0'; readonly captureId: string; readonly durationMs: number; readonly profile: CpuProfileV1 }
export type DevtoolsSnapshotAnswerV1 = DevtoolsSnapshotSuccessV1 | DevtoolsFailureV1
export type DevtoolsCpuProfileAnswerV1 = DevtoolsCpuProfileSuccessV1 | DevtoolsFailureV1
export interface DevtoolsRemoteFace { snapshot(input?: DevtoolsSnapshotInputV1): Promise<DevtoolsSnapshotAnswerV1>; captureCpuProfile(input?: DevtoolsCpuProfileInputV1): Promise<DevtoolsCpuProfileAnswerV1> }

export type BrowserPerformanceKind = 'navigation' | 'paint' | 'lcp' | 'layout-shift' | 'long-task' | 'api'
export interface BrowserPerformanceRecordV1 { readonly seq: number; readonly type: 'browser-performance'; readonly kind: BrowserPerformanceKind; readonly ts: number; readonly name: string; readonly durationMs: number; readonly value?: number; readonly transferSize?: number; readonly findingCode?: 'web.long_task' | 'web.api_slow' }
export interface BrowserCapabilitiesV1 { readonly navigation: boolean; readonly paint: boolean; readonly lcp: boolean; readonly layoutShift: boolean; readonly longTask: boolean; readonly resource: boolean }

export interface DevtoolsExportV1 {
  readonly schemaVersion: 'dsh.devtools.export.v1'
  readonly generatedAt: string
  readonly host: DevtoolsSnapshotSuccessV1
  readonly browser: { readonly capabilities: BrowserCapabilitiesV1; readonly records: readonly BrowserPerformanceRecordV1[] }
  readonly clock: { readonly offsetMs: number; readonly uncertaintyMs: number; readonly exactRpcCorrelation: boolean }
  readonly cpuProfile?: DevtoolsCpuProfileSuccessV1
  readonly redaction: { readonly enabled: true; readonly policy: 'dsh-devtools-safe-v1' }
}

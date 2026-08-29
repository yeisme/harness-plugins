import { randomUUID } from 'node:crypto'
import type {
  DevtoolsCapabilitiesV1,
  DevtoolsFindingRecordV1,
  DevtoolsHostMetricsV1,
  DevtoolsRecordV1,
  DevtoolsRecordInputV1,
  DevtoolsSnapshotInputV1,
  DevtoolsSnapshotSuccessV1,
  DevtoolsSummaryV1,
} from './types.ts'
import { DEFAULT_SNAPSHOT_LIMIT, DEVTOOLS_SPEC_VERSION, MAX_SNAPSHOT_LIMIT } from './types.ts'

const CAPACITY: Record<DevtoolsRecordV1['type'], number> = {
  log: 2000,
  span: 1000,
  sample: 600,
  finding: 200,
  lifecycle: 200,
}

export interface DevtoolsStoreOptions {
  readonly now?: () => number
  readonly bootId?: string
  readonly startedAt?: number
}

export class DevtoolsStore {
  readonly bootId: string
  private readonly now: () => number
  private readonly startedAt: number
  private sequence = 0
  private droppedThroughSeq = 0
  private records: DevtoolsRecordV1[] = []
  private readonly listeners = new Set<(record: DevtoolsRecordV1) => void>()

  constructor(options: DevtoolsStoreOptions = {}) {
    this.now = options.now ?? Date.now
    this.startedAt = options.startedAt ?? this.now()
    this.bootId = options.bootId ?? randomUUID()
  }

  append<T extends DevtoolsRecordInputV1>(record: T): DevtoolsRecordV1 {
    const next = { ...record, seq: ++this.sequence } as unknown as DevtoolsRecordV1
    this.records.push(next)
    const family = this.records.filter(item => item.type === next.type)
    if (family.length > CAPACITY[next.type]) {
      const remove = family[0]
      if (remove !== undefined) {
        this.records = this.records.filter(item => item.seq !== remove.seq)
        this.droppedThroughSeq = Math.max(this.droppedThroughSeq, remove.seq)
      }
    }
    for (const listener of this.listeners) listener(next)
    return next
  }

  subscribe(listener: (record: DevtoolsRecordV1) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  latestMetrics(): DevtoolsHostMetricsV1 | undefined {
    return this.records.findLast((record): record is Extract<DevtoolsRecordV1, { type: 'sample' }> => record.type === 'sample')?.metrics
  }

  summary(): DevtoolsSummaryV1 {
    const count = (type: DevtoolsRecordV1['type']): number => this.records.filter(record => record.type === type).length
    const latestMetrics = this.latestMetrics()
    return {
      uptimeMs: Math.max(0, this.now() - this.startedAt),
      records: this.records.length,
      logs: count('log'),
      spans: count('span'),
      samples: count('sample'),
      findings: count('finding'),
      errors: this.records.filter(record => (
        (record.type === 'log' && record.severity === 'error')
        || (record.type === 'span' && record.status === 'error')
        || (record.type === 'finding' && record.severity === 'error')
        || (record.type === 'lifecycle' && record.severity === 'error')
      )).length,
      ...(latestMetrics === undefined ? {} : { latestMetrics }),
    }
  }

  snapshot(input: DevtoolsSnapshotInputV1, capabilities: DevtoolsCapabilitiesV1): DevtoolsSnapshotSuccessV1 {
    const afterSeq = input.afterSeq ?? 0
    const limit = input.limit ?? DEFAULT_SNAPSHOT_LIMIT
    if (!Number.isSafeInteger(afterSeq) || afterSeq < 0) throw new RangeError('afterSeq must be a non-negative safe integer')
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SNAPSHOT_LIMIT) throw new RangeError(`limit must be between 1 and ${MAX_SNAPSHOT_LIMIT}`)
    const available = this.records.filter(record => record.seq > afterSeq)
    const records = available.slice(0, limit)
    return {
      ok: true,
      specVersion: DEVTOOLS_SPEC_VERSION,
      bootId: this.bootId,
      serverTime: this.now(),
      nextSeq: records.at(-1)?.seq ?? afterSeq,
      truncated: afterSeq < this.droppedThroughSeq || available.length > limit,
      capabilities,
      summary: this.summary(),
      records,
    }
  }

  recordsOfType<T extends DevtoolsRecordV1['type']>(type: T): Array<Extract<DevtoolsRecordV1, { type: T }>> {
    return this.records.filter((record): record is Extract<DevtoolsRecordV1, { type: T }> => record.type === type)
  }

  appendFinding(input: Omit<DevtoolsFindingRecordV1, 'type' | 'seq' | 'ts'> & { readonly ts?: number }): DevtoolsFindingRecordV1 {
    return this.append({ type: 'finding', ts: input.ts ?? this.now(), code: input.code, severity: input.severity, summary: input.summary, evidenceSeqs: input.evidenceSeqs }) as DevtoolsFindingRecordV1
  }
}

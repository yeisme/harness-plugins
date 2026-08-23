/**
 * `domain.<owner>` owner source 的 Host bridge 核心。
 *
 * 设计不变量（与 openspec dsh-sonora-pane / dsh-pinax-pane / dsh-ordo-agent-team-pane 的
 * 事件恢复要求一致，fold 语义对齐 packages/host/pane-protocol/src/conformance.ts）：
 *
 * 1. 首次打开只读一次权威 snapshot；之后所有更新只来自 owner push event。
 *    bridge 内不存在 setInterval/setTimeout 轮询；transport 断线 → offline，
 *    transport 恢复推送能力 → 恰好再读一次 snapshot（push 驱动的重读，不是轮询）。
 * 2. 诚实降级：duplicate/旧 sequence 幂等吞掉（保持引用相等）；sequence gap、
 *    context（cursor 世代）切换、stream 切换 → reconcile_required 并保留最后一份
 *    安全投影；非法 payload → contract_mismatch；owner 读失败 → offline。
 *    绝不把空 snapshot 误报为 ready。
 * 3. bridge 不产生事实：items 全部来自 owner envelope 的 entities；allowedActions
 *    只来自 owner snapshot read 附带的 owner-authored 动作清单；bridge 从不
 *    发明动作、状态或时间戳。
 */

import {
  PANE_PROTOCOL_LIMITS,
  PaneEventEnvelopeSchema,
  type PaneActionReceiptV1,
  type PaneContextV1,
  type PaneEventEnvelopeV1,
  type PaneProjectionEntityV1,
  type PaneStatus,
} from '@yeisme/dsh-pane-protocol'
import type { DomainOwner } from './owners.js'
import { isDomainOwner, normalizeDomainSnapshot, type DomainActionV1, type DomainItemV1, type DomainSnapshotV1 } from './snapshot.js'

/** 权威读接口的结果：owner snapshot envelope + owner-authored 动作清单。 */
export interface DomainOwnerSnapshotRead {
  readonly snapshot: unknown
  readonly actions?: readonly DomainActionV1[]
}

/**
 * owner 与 Host bridge 之间唯一的 typed transport。
 * 实现方（真实 owner adapter 或仓库内 fixture）必须以 push 方式投递事件，
 * 不得用 timer 轮询伪造事件。
 */
export interface DomainOwnerEventTransport {
  /** 权威读接口：只在 bridge 打开与 transport 恢复时各调用一次。 */
  read(): DomainOwnerSnapshotRead
  /** owner push event 通道；返回取消订阅。 */
  subscribe(listener: (event: unknown) => void): () => void
  /** 通道断开通知；bridge 显示 offline，不自动重试。 */
  onUnavailable?(listener: () => void): () => void
  /** 通道恢复通知；bridge 重读一次 snapshot。 */
  onAvailable?(listener: () => void): () => void
}

/** 挂载到 Host context 的正式 owner source 服务面（客户端经 `ctx.get('domain.<owner>')` 消费）。 */
export interface DomainOwnerSourceService {
  readonly owner: DomainOwner
  getSnapshot(): DomainSnapshotV1
  subscribe(listener: (snapshot: DomainSnapshotV1) => void): () => void
  dispose(): void
}

/** bridge 内部的折叠状态；引用稳定，便于订阅者做相等性判断。 */
export interface DomainOwnerFoldState {
  readonly status: PaneStatus
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly stream?: string
  readonly context?: PaneContextV1
  readonly cursor?: string
  readonly sequence?: number
  readonly entities: Readonly<Record<string, PaneProjectionEntityV1>>
  readonly timeline: readonly unknown[]
  readonly receipts: readonly PaneActionReceiptV1[]
  readonly reconcileReason?: string
}

export function createDomainOwnerFoldState(): DomainOwnerFoldState {
  return {
    status: 'reconcile_required',
    freshness: 'unknown',
    entities: {},
    timeline: [],
    receipts: [],
    reconcileReason: 'snapshot_required',
  }
}

function contextIdentity(context: PaneContextV1): string {
  const { tenantRef, workspaceRef, sessionRef, principalRef, revision, membershipRevision, installationRef, pluginDigest, policyRevision, runtimeGeneration } = context
  return `${tenantRef ?? ''}\0${workspaceRef}\0${sessionRef ?? ''}\0${principalRef ?? ''}\0${revision}\0${membershipRevision ?? ''}\0${installationRef ?? ''}\0${pluginDigest ?? ''}\0${policyRevision ?? ''}\0${runtimeGeneration ?? ''}`
}

function reconcile(state: DomainOwnerFoldState, reason: string, status: PaneStatus = 'reconcile_required'): DomainOwnerFoldState {
  if (state.status === status && state.reconcileReason === reason) return state
  return { ...state, status, reconcileReason: reason, freshness: status === 'stale' ? 'stale' : state.freshness }
}

function receiptStatus(receipt: PaneActionReceiptV1): PaneStatus {
  // receipt 是唯一结论来源；unknown/reconcile_required 绝不折叠成成功态。
  switch (receipt.status) {
    case 'pending': return 'running'
    case 'accepted': return 'ready'
    case 'completed': return 'ready'
    case 'partial': return 'partial'
    case 'failed': return 'attention_required'
    case 'approval_required': return 'approval_required'
    case 'rejected': return 'attention_required'
    case 'unknown': return 'unknown'
    case 'reconcile_required': return 'reconcile_required'
  }
}

function withWatermark(state: DomainOwnerFoldState, event: PaneEventEnvelopeV1, patch: Partial<DomainOwnerFoldState>): DomainOwnerFoldState {
  return {
    ...state,
    ...patch,
    stream: event.stream,
    context: event.context,
    cursor: event.cursor,
    sequence: event.sequence,
    freshness: event.freshness,
    reconcileReason: patch.reconcileReason,
  }
}

/**
 * 折叠一条 owner event。事件先经 PaneEventEnvelopeSchema 校验（脱敏与大小预算内建），
 * 校验失败 → contract_mismatch。该函数是纯函数；重复/乱序输入保持引用稳定。
 */
export function foldDomainOwnerEvent(state: DomainOwnerFoldState, input: unknown): DomainOwnerFoldState {
  const parsed = PaneEventEnvelopeSchema.safeParse(input)
  if (!parsed.success) return reconcile(state, 'contract_mismatch', 'contract_mismatch')
  const event = parsed.data

  if (event.op === 'snapshot') {
    // 同一 stream 的旧 snapshot 是迟到副本，直接丢弃。
    if (state.stream === event.stream && state.sequence !== undefined && event.sequence < state.sequence) return state
    const entities = Object.fromEntries(event.payload.entities.map(entity => [entity.ref, entity]))
    return {
      status: event.status ?? (event.freshness === 'fresh' ? 'ready' : event.freshness === 'stale' ? 'stale' : 'unknown'),
      freshness: event.freshness,
      stream: event.stream,
      context: event.context,
      cursor: event.cursor,
      sequence: event.sequence,
      entities,
      timeline: event.payload.timeline ?? [],
      receipts: event.payload.receipts ?? [],
      reconcileReason: undefined,
    }
  }

  if (state.stream === undefined || state.sequence === undefined || state.context === undefined) {
    return reconcile(state, 'snapshot_required')
  }
  if (state.stream !== event.stream) return reconcile(state, 'stream_changed')
  if (contextIdentity(state.context) !== contextIdentity(event.context)) return reconcile(state, 'context_changed')
  if (event.sequence <= state.sequence) return state
  if (event.sequence !== state.sequence + 1) {
    return reconcile(state, `sequence_gap:${state.sequence + 1}:${event.sequence}`)
  }

  if (event.op === 'upsert') {
    const current = state.entities[event.entityRef]
    if (current !== undefined && event.entityVersion < current.version) return reconcile(state, 'entity_version_rollback')
    if (current !== undefined && event.entityVersion === current.version) {
      return withWatermark(state, event, { status: event.status ?? state.status })
    }
    return withWatermark(state, event, {
      entities: { ...state.entities, [event.entityRef]: { ref: event.entityRef, version: event.entityVersion, value: event.payload.value } },
      status: event.status ?? state.status,
    })
  }

  if (event.op === 'remove') {
    const current = state.entities[event.entityRef]
    if (current !== undefined && event.entityVersion < current.version) return reconcile(state, 'entity_version_rollback')
    const entities = { ...state.entities }
    delete entities[event.entityRef]
    return withWatermark(state, event, { entities, status: event.status ?? state.status })
  }

  if (event.op === 'append') {
    return withWatermark(state, event, {
      timeline: [...state.timeline, event.payload.value].slice(-PANE_PROTOCOL_LIMITS.timelineItems),
      status: event.status ?? state.status,
    })
  }

  if (event.op === 'invalidate') {
    return { ...withWatermark(state, event, { status: event.status ?? 'stale', reconcileReason: event.payload.reason }), freshness: 'stale' }
  }

  if (event.op === 'action_receipt') {
    const receipts = [...state.receipts, event.payload].slice(-PANE_PROTOCOL_LIMITS.receipts)
    return withWatermark(state, event, { receipts, status: event.status ?? receiptStatus(event.payload) })
  }

  // reset：清空本地投影并要求新的权威 snapshot。
  return {
    ...withWatermark(state, event, { entities: {}, timeline: [], receipts: [], status: 'reconcile_required' }),
    reconcileReason: event.payload.reason,
  }
}

function entityToItem(entity: PaneProjectionEntityV1): DomainItemV1 {
  const value = entity.value
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    // owner 提供的 typed deep-link（如 Ordo task → DSH session）原样透传；
    // 安全性由 normalizeDomainSnapshot 的 ref 脱敏再兜底。
    const link = record.link !== null && typeof record.link === 'object' && !Array.isArray(record.link)
      && (record.link as Record<string, unknown>).kind === 'subagent.session'
      && typeof (record.link as Record<string, unknown>).ref === 'string'
      ? { kind: 'subagent.session' as const, ref: (record.link as Record<string, unknown>).ref as string }
      : undefined
    return {
      ref: entity.ref,
      title: typeof record.title === 'string' && record.title.length > 0 ? record.title : entity.ref,
      version: String(entity.version),
      kind: typeof record.kind === 'string' ? record.kind : 'item',
      status: typeof record.status === 'string' ? record.status : 'unknown',
      ...(typeof record.summary === 'string' ? { summary: record.summary } : {}),
      ...(record.partial === true ? { partial: true } : {}),
      ...(link === undefined ? {} : { link }),
    }
  }
  return { ref: entity.ref, title: entity.ref, version: String(entity.version), kind: 'item', status: 'unknown' }
}

/** append 事件的有界 live 摘要；非 object/string 值不进入 UI。 */
function timelineSummaries(timeline: readonly unknown[]): { timeline: { summary: string }[] } | undefined {
  const summaries: { summary: string }[] = []
  for (const value of timeline) {
    if (typeof value === 'string') {
      summaries.push({ summary: value.slice(0, 200) })
      continue
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>
      if (typeof record.summary === 'string') summaries.push({ summary: record.summary.slice(0, 200) })
    }
  }
  return summaries.length === 0 ? undefined : { timeline: summaries.slice(-20) }
}

function offlineSnapshot(owner: DomainOwner, reason: string): DomainSnapshotV1 {
  return { owner, status: 'offline', freshness: 'unknown', items: [], allowedActions: [], reconcileReason: reason }
}

/**
 * 单一 owner 的 live projection bridge。open() 建立权威基线，此后只消费 push event。
 */
export class DomainOwnerSourceBridge implements DomainOwnerSourceService {
  readonly owner: DomainOwner

  private state: DomainOwnerFoldState = createDomainOwnerFoldState()
  private actions: readonly DomainActionV1[] = []
  private cached: DomainSnapshotV1 | undefined
  private readonly listeners = new Set<(snapshot: DomainSnapshotV1) => void>()
  private readonly disposers: Array<() => void> = []
  private disposed = false

  constructor(owner: DomainOwner, private readonly transport: DomainOwnerEventTransport) {
    if (!isDomainOwner(owner)) throw new TypeError(`unknown domain owner: ${String(owner)}`)
    this.owner = owner
  }

  /** 打开 owner source：一次性权威读 + push 订阅。 */
  open(): void {
    if (this.disposed) return
    this.reread()
    this.disposers.push(this.transport.subscribe(event => { this.apply(event) }))
    if (this.transport.onUnavailable !== undefined) {
      this.disposers.push(this.transport.onUnavailable(() => {
        // 断线只降级显示，不重试、不重读。
        this.publish(reconcile(this.state, 'transport_unavailable', 'offline'))
      }))
    }
    if (this.transport.onAvailable !== undefined) {
      this.disposers.push(this.transport.onAvailable(() => {
        // 通道恢复：恰好一次权威重读（push 驱动，不是 timer 轮询）。
        this.reread()
      }))
    }
  }

  /** 折叠一条 push event；只有状态引用变化时才通知订阅者。 */
  apply(event: unknown): void {
    if (this.disposed) return
    this.publish(foldDomainOwnerEvent(this.state, event))
  }

  /** 权威重读。除 open 与 transport 恢复外不得调用；读失败 → offline。 */
  reread(): void {
    if (this.disposed) return
    let read: DomainOwnerSnapshotRead
    try {
      read = this.transport.read()
    } catch {
      this.actions = []
      this.publish(reconcile(createDomainOwnerFoldState(), 'owner_unreachable', 'offline'))
      return
    }
    this.actions = read.actions ?? []
    this.cached = undefined
    // 权威读接口修复一切：读出的 snapshot 折叠到全新状态，不受旧 sequence 影响。
    // （push 通道里的迟到旧 snapshot 仍由 fold 的同 stream 判重丢弃。）
    this.publish(foldDomainOwnerEvent(createDomainOwnerFoldState(), read.snapshot))
  }

  getSnapshot(): DomainSnapshotV1 {
    if (this.cached !== undefined) return this.cached
    const state = this.state
    const snapshot: DomainSnapshotV1 = normalizeDomainSnapshot({
      owner: this.owner,
      status: state.status,
      freshness: state.freshness,
      items: Object.values(state.entities).slice(0, PANE_PROTOCOL_LIMITS.timelineItems).map(entityToItem),
      allowedActions: this.actions,
      ...(state.reconcileReason === undefined ? {} : { reconcileReason: state.reconcileReason }),
      ...(timelineSummaries(state.timeline) ?? {}),
    })
    this.cached = snapshot
    return snapshot
  }

  subscribe(listener: (snapshot: DomainSnapshotV1) => void): () => void {
    if (this.disposed) return () => {}
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const dispose of [...this.disposers].reverse()) dispose()
    this.disposers.length = 0
    this.listeners.clear()
  }

  private publish(next: DomainOwnerFoldState): void {
    if (next === this.state) return
    this.state = next
    this.cached = undefined
    const snapshot = this.getSnapshot()
    for (const listener of [...this.listeners]) listener(snapshot)
  }
}

type HostProvideContext = { provide(name: string, value?: unknown): () => void }

/**
 * 把 owner source 正式挂载为 Host context 上的 `domain.<owner>` 服务。
 * 返回 dispose；dispose 后服务从 context 移除，transport 订阅同步撤销。
 */
export function mountDomainOwnerSource(
  ctx: HostProvideContext,
  owner: DomainOwner,
  transport: DomainOwnerEventTransport,
): () => void {
  const bridge = new DomainOwnerSourceBridge(owner, transport)
  bridge.open()
  const unprovide = ctx.provide(`domain.${owner}`, bridge satisfies DomainOwnerSourceService)
  return () => {
    unprovide()
    bridge.dispose()
  }
}

export { offlineSnapshot }

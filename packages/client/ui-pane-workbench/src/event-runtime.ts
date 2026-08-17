import {
  PANE_PROJECTION_SCHEMA,
  PANE_PROTOCOL_LIMITS,
  PaneEventEnvelopeSchema,
  type PaneActionReceiptV1,
  type PaneEventEnvelopeV1,
  type PaneProjectionEntityV1,
  type PaneProjectionStateV1,
  type PaneStatus,
} from '@yeisme/dsh-pane-protocol'

export interface PaneProjectionLimits {
  readonly entities: number
  readonly timelineItems: number
  readonly receipts: number
}

const DEFAULT_LIMITS: PaneProjectionLimits = {
  entities: PANE_PROTOCOL_LIMITS.entities,
  timelineItems: PANE_PROTOCOL_LIMITS.timelineItems,
  receipts: PANE_PROTOCOL_LIMITS.receipts,
}

export function createPaneProjectionState(generation: number): PaneProjectionStateV1 {
  return {
    schema: PANE_PROJECTION_SCHEMA,
    generation,
    status: 'reconcile_required',
    freshness: 'unknown',
    entities: {},
    timeline: [],
    receipts: [],
    reconcileReason: 'snapshot_required',
  }
}

function contextIdentity(event: PaneEventEnvelopeV1): string {
  const { workspaceRef, sessionRef, principalRef, revision } = event.context
  return `${workspaceRef}\u0000${sessionRef ?? ''}\u0000${principalRef ?? ''}\u0000${revision}`
}

function stateContextIdentity(state: PaneProjectionStateV1): string | undefined {
  if (state.context === undefined) return undefined
  const { workspaceRef, sessionRef, principalRef, revision } = state.context
  return `${workspaceRef}\u0000${sessionRef ?? ''}\u0000${principalRef ?? ''}\u0000${revision}`
}

function reconcile(state: PaneProjectionStateV1, reason: string, status: PaneStatus = 'reconcile_required'): PaneProjectionStateV1 {
  if (state.status === status && state.reconcileReason === reason) return state
  return { ...state, status, reconcileReason: reason, freshness: status === 'stale' ? 'stale' : state.freshness }
}

function receiptStatus(receipt: PaneActionReceiptV1): PaneStatus {
  switch (receipt.status) {
    case 'accepted': return 'ready'
    case 'approval_required': return 'approval_required'
    case 'rejected': return 'attention_required'
    case 'unknown': return 'unknown'
  }
}

function boundedRecord(
  input: Readonly<Record<string, PaneProjectionEntityV1>>,
  max: number,
): Readonly<Record<string, PaneProjectionEntityV1>> {
  const entries = Object.entries(input)
  if (entries.length <= max) return input
  return Object.fromEntries(entries.slice(entries.length - max))
}

function withWatermark(
  state: PaneProjectionStateV1,
  event: PaneEventEnvelopeV1,
  patch: Partial<PaneProjectionStateV1>,
): PaneProjectionStateV1 {
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
 * Folds one validated owner event into a bounded client projection. The
 * reducer never retries owner actions and never invents missing events.
 */
export function applyPaneEvent(
  state: PaneProjectionStateV1,
  input: unknown,
  limits: PaneProjectionLimits = DEFAULT_LIMITS,
): PaneProjectionStateV1 {
  const parsed = PaneEventEnvelopeSchema.safeParse(input)
  if (!parsed.success) return reconcile(state, 'contract_mismatch', 'contract_mismatch')
  const event = parsed.data

  if (event.op === 'snapshot') {
    if (state.stream === event.stream && state.sequence !== undefined && event.sequence < state.sequence) return state
    const entities = boundedRecord(
      Object.fromEntries(event.payload.entities.map(entity => [entity.ref, entity])),
      limits.entities,
    )
    return {
      schema: PANE_PROJECTION_SCHEMA,
      generation: state.generation,
      status: event.status ?? (event.freshness === 'fresh' ? 'ready' : event.freshness === 'stale' ? 'stale' : 'unknown'),
      stream: event.stream,
      context: event.context,
      cursor: event.cursor,
      sequence: event.sequence,
      freshness: event.freshness,
      entities,
      timeline: (event.payload.timeline ?? []).slice(-limits.timelineItems),
      receipts: (event.payload.receipts ?? []).slice(-limits.receipts),
    }
  }

  if (state.stream === undefined || state.sequence === undefined || state.context === undefined) {
    return reconcile(state, 'snapshot_required')
  }
  if (state.stream !== event.stream) return reconcile(state, 'stream_changed')
  if (stateContextIdentity(state) !== contextIdentity(event)) return reconcile(state, 'context_changed')
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
    const entities = boundedRecord({
      ...state.entities,
      [event.entityRef]: { ref: event.entityRef, version: event.entityVersion, value: event.payload.value },
    }, limits.entities)
    return withWatermark(state, event, { entities, status: event.status ?? state.status })
  }

  if (event.op === 'remove') {
    const current = state.entities[event.entityRef]
    if (current !== undefined && event.entityVersion < current.version) return reconcile(state, 'entity_version_rollback')
    const entities = { ...state.entities }
    delete entities[event.entityRef]
    return withWatermark(state, event, { entities, status: event.status ?? state.status })
  }

  if (event.op === 'append') {
    const timeline = [...state.timeline, event.payload.value].slice(-limits.timelineItems)
    return withWatermark(state, event, { timeline, status: event.status ?? state.status })
  }

  if (event.op === 'invalidate') {
    return {
      ...withWatermark(state, event, { status: event.status ?? 'stale', reconcileReason: event.payload.reason }),
      freshness: 'stale',
    }
  }

  if (event.op === 'action_receipt') {
    const receipts = [...state.receipts, event.payload].slice(-limits.receipts)
    return withWatermark(state, event, { receipts, status: event.status ?? receiptStatus(event.payload) })
  }

  return {
    ...withWatermark(state, event, {
      entities: {},
      timeline: [],
      receipts: [],
      status: 'reconcile_required',
    }),
    reconcileReason: event.payload.reason,
  }
}

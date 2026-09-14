/**
 * `templateRegistryCompile` session projection unit (task 2.4).
 *
 * Channel: the dsh-context sessionProjections pattern
 * (packages/bundle/dsh-context/src/host/timeline.ts). The unit is registered
 * on `ctx.sessionProjections`; the framework drives the fold per committed
 * session/event, persists the state through the projection cache, and pushes
 * the finished wire view to the browser. The contract is mirrored
 * structurally here (zero new dependencies):
 *
 *   `{ key, stateSchema, init, apply, wire: { viewSchema, view }, stateVersion }`
 *
 * Purity rules mirrored from the framework contract:
 * - `apply(state, event)` returns the SAME reference when the event does not
 *   change the unit's state (`Object.is` gates the change feed);
 * - the state stays plain JSON (persisted-cache precondition: no
 *   undefined-valued properties, absent-until-known optional fields);
 * - the state is bounded (sessions ring, digest map cap, pending-call cap).
 *
 * NOT a second copy of state: the fold derives everything from the session's
 * committed tool traffic (`tool/call` name+arguments paired with
 * `tool/result` envelopes of template_registry_* tools). The registry
 * session itself stays in the owner's store; this projection only rebuilds
 * the pane's recovery contract and the export gate.
 *
 * Stale detection: every folded `inspect` records the latest known template
 * digest per exact ref; the export gate disables export when that digest no
 * longer matches the digest the session pinned (digest drift ⇒ re-pin via an
 * explicit reset; never a silent overwrite).
 *
 * @module @yeisme/dsh-template-registry/projection
 */

import { z } from 'zod'
import {
  TemplateExportReceiptSchema,
  TemplateSessionSchema,
  type TemplateExportReceipt,
  type TemplateSession,
} from './contracts.js'
import { foldRegistrySessionView, fromWireFieldKey } from './sessions.js'

export const TEMPLATE_COMPILE_PROJECTION_KEY = 'templateRegistryCompile'
export const TEMPLATE_COMPILE_PROJECTION_STATE_VERSION = 1

/** Bounded retention: newest compile sessions kept in the fold state. */
export const TEMPLATE_COMPILE_PROJECTION_SESSIONS_LIMIT = 8
export const TEMPLATE_COMPILE_PROJECTION_DIGESTS_LIMIT = 128
export const TEMPLATE_COMPILE_PROJECTION_PENDING_LIMIT = 32

/** Structural session-event envelope (widened like dsh-context's TimelineEvent). */
export interface TemplateCompileProjectionEvent {
  readonly type: string
  readonly seq: number
  readonly time: number
  readonly data?: Record<string, unknown>
}

/** One folded compile session (recovery contract + export facts). */
export interface TemplateCompileProjectionEntry {
  readonly session: TemplateSession
  readonly compileId?: string
  readonly exportReceipt?: TemplateExportReceipt
  /** Newest event seq folded into this entry (change feed cursor). */
  readonly lastSeq: number
}

export interface TemplateCompileProjectionState {
  /** Folded compile sessions, newest first (bounded ring). */
  readonly sessions: readonly TemplateCompileProjectionEntry[]
  /** Latest known template digest per exact ref (from folded inspect calls). */
  readonly templateDigests: Readonly<Record<string, string>>
  /** Armed tool calls by callId, bounded; consumed when their result folds. */
  readonly pendingCalls: Readonly<Record<string, { readonly tool: string; readonly arguments: Record<string, unknown>; readonly seq: number }>>
}

const SESSION_TOOLS = new Set([
  'template_registry_session_create',
  'template_registry_session_update',
  'template_registry_session_confirm',
  'template_registry_compile',
  'template_registry_export',
  'template_registry_inspect',
])

export function createTemplateCompileProjectionState(): TemplateCompileProjectionState {
  return { sessions: [], templateDigests: {}, pendingCalls: {} }
}

// ---------------------------------------------------------------------------
// Unknown-safe wire extractors (envelope text rides inside tool/result data)
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** Owner envelopes are JSON text with spec_version "1.0" (verified live). */
function isEnvelopeText(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { spec_version?: unknown }
    return typeof parsed === 'object' && parsed !== null && parsed.spec_version === '1.0'
  } catch {
    return false
  }
}

/**
 * Find the owner envelope JSON inside one tool/result event. The harness
 * nests it at `data.message.content[].content[].text` (model-visible tool
 * result message); a defensive bounded search also accepts direct text
 * blocks so envelope-shape drift fails closed (no envelope ⇒ no fold).
 */
function envelopeTextOf(event: TemplateCompileProjectionEvent): string | undefined {
  const data = event.data
  if (data === undefined) return undefined
  const candidates: unknown[] = [data.message, data]
  for (const candidate of candidates) {
    const record = asRecord(candidate)
    const content = record?.content
    if (!Array.isArray(content)) continue
    for (const block of content.slice(0, 8)) {
      const blockRecord = asRecord(block)
      if (blockRecord === undefined) continue
      if (typeof blockRecord.text === 'string' && isEnvelopeText(blockRecord.text)) return blockRecord.text
      const nested = Array.isArray(blockRecord.content) ? blockRecord.content : undefined
      if (nested === undefined) continue
      for (const leaf of nested.slice(0, 8)) {
        const leafRecord = asRecord(leaf)
        if (leafRecord !== undefined && typeof leafRecord.text === 'string' && isEnvelopeText(leafRecord.text)) return leafRecord.text
      }
    }
  }
  return undefined
}

/** Pairing key: the harness puts callId on the result message source or the first content block. */
function callIdOfResult(event: TemplateCompileProjectionEvent): string | undefined {
  const data = event.data
  if (data === undefined) return undefined
  const message = asRecord(data.message)
  const source = asRecord(message?.source)
  if (typeof source?.callId === 'string') return source.callId
  const content = message?.content
  if (Array.isArray(content)) {
    const first = asRecord(content[0])
    if (typeof first?.toolCallId === 'string') return first.toolCallId
  }
  if (typeof data.callId === 'string') return data.callId
  return undefined
}

// ---------------------------------------------------------------------------
// The fold
// ---------------------------------------------------------------------------

interface FoldedCall {
  readonly tool: string
  readonly arguments: Record<string, unknown>
  readonly envelope: Record<string, unknown>
  readonly data: unknown
  readonly seq: number
}

function trimDigests(digests: Record<string, string>): Record<string, string> {
  const keys = Object.keys(digests)
  if (keys.length <= TEMPLATE_COMPILE_PROJECTION_DIGESTS_LIMIT) return digests
  const trimmed: Record<string, string> = {}
  for (const key of keys.slice(keys.length - TEMPLATE_COMPILE_PROJECTION_DIGESTS_LIMIT)) {
    const value = digests[key]
    if (value !== undefined) trimmed[key] = value
  }
  return trimmed
}

function upsertSession(
  state: TemplateCompileProjectionState,
  updated: TemplateCompileProjectionEntry,
): TemplateCompileProjectionState {
  const retained = [updated, ...state.sessions.filter(entry => entry.session.id !== updated.session.id)]
  return { ...state, sessions: retained.slice(0, TEMPLATE_COMPILE_PROJECTION_SESSIONS_LIMIT) }
}

/**
 * Fold ONE paired template_registry tool call. Pure: builds new references
 * only when something actually changes; returns the incoming state otherwise.
 */
function foldCall(state: TemplateCompileProjectionState, call: FoldedCall): TemplateCompileProjectionState {
  const args = call.arguments
  const data = asRecord(call.data)

  // inspect only refreshes the latest-known digest for its exact ref — the
  // stale gate's comparison source.
  if (call.tool === 'template_registry_inspect') {
    const ref = typeof args.ref === 'string' ? args.ref : undefined
    const digest = typeof data?.digest === 'string' ? data.digest : undefined
    if (ref === undefined || digest === undefined || state.templateDigests[ref] === digest) return state
    return { ...state, templateDigests: trimDigests({ ...state.templateDigests, [ref]: digest }) }
  }

  // session_create addresses the session by its RESULT (the view id), not by
  // an argument session_id — fold it before the session_id-addressed tools.
  if (call.tool === 'template_registry_session_create') {
    // Recovery contract needs the exact ref AND a known digest (from a folded
    // inspect); without both the fold stays honest and skips the entry.
    const ref = typeof args.ref === 'string' ? args.ref : undefined
    const digest = ref === undefined ? undefined : state.templateDigests[ref]
    if (ref === undefined || digest === undefined) return state
    const session = foldRegistrySessionView(call.data, { ref, digest })
    if (session === undefined) return state
    return upsertSession(state, { session, lastSeq: call.seq })
  }

  // export addresses the compile (not the session): match the entry by its
  // folded compile id before the session_id-addressed tools below.
  if (call.tool === 'template_registry_export') {
    const compileId = typeof args.compile_id === 'string' ? args.compile_id : undefined
    const facts = asRecord(call.envelope.facts)
    const digest = typeof facts?.digest === 'string' ? facts.digest : undefined
    const output = typeof facts?.output === 'string' ? facts.output : undefined
    const entry = compileId === undefined ? undefined : state.sessions.find(candidate => candidate.compileId === compileId)
    if (compileId === undefined || entry === undefined || digest === undefined || output === undefined) return state
    const receipt: TemplateExportReceipt = {
      compileId, digest, outputRef: output.slice(0, 300), providerCalls: 0, exportedAt: new Date().toISOString(),
    }
    return upsertSession(state, {
      ...entry,
      session: { ...entry.session, status: 'exported', updatedAt: receipt.exportedAt },
      exportReceipt: receipt,
      lastSeq: call.seq,
    })
  }

  const sessionId = typeof args.session_id === 'string' ? args.session_id : undefined
  if (sessionId === undefined) return state
  const entry = state.sessions.find(candidate => candidate.session.id === sessionId)
  if (entry === undefined) return state

  if (call.tool === 'template_registry_session_update') {
    const fields = asRecord(args.fields) ?? {}
    const submitted: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(fields)) {
      const record = asRecord(value)
      // Wire keys are `<step-id>.<input-name>`; the folded (pane-facing)
      // session stays contract-name canonical.
      if (record !== undefined && 'value' in record) submitted[fromWireFieldKey(name, entry.session.stepIds)] = record.value
    }
    const session = foldRegistrySessionView(call.data, {
      ref: entry.session.ref, digest: entry.session.digest,
      fields: { ...entry.session.fields, ...submitted },
      ...(entry.session.contractDigest === undefined ? {} : { contractDigest: entry.session.contractDigest }),
      ...(entry.session.decisionRef === undefined ? {} : { decisionRef: entry.session.decisionRef }),
      stepIds: entry.session.stepIds,
    })
    if (session === undefined || session.revision === entry.session.revision && session.readiness === entry.session.readiness && session.status === entry.session.status) return state
    return upsertSession(state, { ...entry, session, lastSeq: call.seq })
  }

  if (call.tool === 'template_registry_session_confirm') {
    const decisionRef = typeof args.decision_ref === 'string' ? args.decision_ref : undefined
    const session = foldRegistrySessionView(call.data, {
      ref: entry.session.ref, digest: entry.session.digest, fields: entry.session.fields,
      contractDigest: entry.session.contractDigest,
      ...(decisionRef === undefined ? {} : { decisionRef }),
      stepIds: entry.session.stepIds,
    })
    if (session === undefined) return state
    return upsertSession(state, { ...entry, session, lastSeq: call.seq })
  }

  if (call.tool === 'template_registry_compile') {
    const facts = asRecord(call.envelope.facts)
    const compileId = typeof facts?.id === 'string' ? facts.id : undefined
    const providerCalls = facts?.provider_calls
    // provider_calls=0 is the change's core contract: a nonzero answer folds
    // nothing (the pane keeps the pre-compile state and the owner's error).
    if (compileId === undefined || providerCalls !== 0) return state
    const session = foldRegistrySessionView(call.data, {
      ref: entry.session.ref, digest: entry.session.digest, fields: entry.session.fields,
      ...(entry.session.contractDigest === undefined ? {} : { contractDigest: entry.session.contractDigest }),
      ...(entry.session.decisionRef === undefined ? {} : { decisionRef: entry.session.decisionRef }),
      stepIds: entry.session.stepIds,
      status: 'compiled',
    }) ?? { ...entry.session, status: 'compiled' as const, updatedAt: new Date().toISOString() }
    return upsertSession(state, { session, compileId, lastSeq: call.seq })
  }

  return state
}

/**
 * The projection transition. `tool/call` events arm bounded pending entries;
 * `tool/result` events pair by callId, parse the owner envelope, and fold.
 * Every other event returns the SAME state reference (Object.is gate).
 */
export function applyTemplateCompileProjection(state: TemplateCompileProjectionState, event: TemplateCompileProjectionEvent): TemplateCompileProjectionState {
  if (event.type === 'tool/call') {
    const data = event.data
    const name = typeof data?.name === 'string' ? data.name : undefined
    const callId = typeof data?.callId === 'string' ? data.callId : undefined
    if (name === undefined || callId === undefined || !SESSION_TOOLS.has(name)) return state
    const args = asRecord(data?.arguments) ?? {}
    const pending = { ...state.pendingCalls, [callId]: { tool: name, arguments: args, seq: event.seq } }
    const keys = Object.keys(pending)
    for (const key of keys.slice(0, Math.max(0, keys.length - TEMPLATE_COMPILE_PROJECTION_PENDING_LIMIT))) delete pending[key]
    return { ...state, pendingCalls: pending }
  }
  if (event.type !== 'tool/result') return state
  const callId = callIdOfResult(event)
  if (callId === undefined) return state
  const armed = state.pendingCalls[callId]
  if (armed === undefined) return state
  const text = envelopeTextOf(event)
  const { [callId]: _consumed, ...remaining } = state.pendingCalls
  void _consumed
  if (text === undefined) {
    // Unparseable result: consume the armed call, fold nothing (fail-closed).
    return { ...state, pendingCalls: remaining }
  }
  let parsed: { facts?: unknown; data?: unknown }
  try { parsed = JSON.parse(text) as { facts?: unknown; data?: unknown } } catch { return { ...state, pendingCalls: remaining } }
  const afterConsume = foldCall({ ...state, pendingCalls: remaining }, {
    tool: armed.tool, arguments: armed.arguments, envelope: parsed as Record<string, unknown>, data: parsed.data, seq: armed.seq,
  })
  return afterConsume
}

// ---------------------------------------------------------------------------
// Export gate (digest-stale detection)
// ---------------------------------------------------------------------------

export type TemplateCompileExportGateReason = 'unknown_session' | 'not_compiled' | 'already_exported' | 'digest_stale'

export type TemplateCompileExportGate =
  | { readonly allowed: true; readonly session: TemplateSession }
  | { readonly allowed: false; readonly reason: TemplateCompileExportGateReason; readonly detail: string }

/**
 * Export gate over the folded projection: export is allowed only for a
 * compiled session whose pinned template digest still matches the latest
 * digest the projection observed for its ref. A digest change disables
 * export until the owner re-pins (explicit reset), never silently.
 */
export function templateCompileExportGate(state: TemplateCompileProjectionState, registrySessionId: string): TemplateCompileExportGate {
  const entry = state.sessions.find(candidate => candidate.session.id === registrySessionId)
  if (entry === undefined) {
    return { allowed: false, reason: 'unknown_session', detail: 'no folded compile session for this id' }
  }
  if (entry.exportReceipt !== undefined) {
    return { allowed: false, reason: 'already_exported', detail: 'this package was already exported; start a new session for another export' }
  }
  if (entry.session.status !== 'compiled') {
    return { allowed: false, reason: 'not_compiled', detail: 'only a compiled session may export' }
  }
  const latest = state.templateDigests[entry.session.ref]
  if (latest !== undefined && latest !== entry.session.digest) {
    return { allowed: false, reason: 'digest_stale', detail: 'the template digest changed since the session pinned it' }
  }
  return { allowed: true, session: entry.session }
}

// ---------------------------------------------------------------------------
// Wire view + persisted state schemas
// ---------------------------------------------------------------------------

/** Bounded pane-facing view: recovery contracts plus export receipts. */
export const templateCompileWireSchema = z.object({
  ok: z.literal(true),
  sessions: z.array(z.object({
    session: TemplateSessionSchema,
    compileId: z.string().min(1).max(128).optional(),
    exportReceipt: TemplateExportReceiptSchema.optional(),
  })).max(TEMPLATE_COMPILE_PROJECTION_SESSIONS_LIMIT),
})

export type TemplateCompileWireView = z.infer<typeof templateCompileWireSchema>

/** Persisted fold-state schema (projection-cache rows re-seed through this). */
export const templateCompileStateSchema = z.object({
  sessions: z.array(z.object({
    session: TemplateSessionSchema,
    compileId: z.string().min(1).max(128).optional(),
    exportReceipt: TemplateExportReceiptSchema.optional(),
    lastSeq: z.number(),
  })).max(TEMPLATE_COMPILE_PROJECTION_SESSIONS_LIMIT),
  templateDigests: z.record(z.string().min(1).max(400), z.string().min(1).max(160)),
  pendingCalls: z.record(z.string().min(1).max(128), z.object({
    tool: z.string().min(1).max(96),
    arguments: z.record(z.string(), z.unknown()),
    seq: z.number(),
  })),
}) as unknown as z.ZodType<TemplateCompileProjectionState>

/**
 * The projection unit definition (structural mirror of the harness
 * ProjectionDefinition contract — see the module header). `stateVersion` is
 * 1; bump it whenever the persisted state shape or fold semantics change.
 */
export interface TemplateCompileProjectionDefinition {
  readonly key: typeof TEMPLATE_COMPILE_PROJECTION_KEY
  readonly stateSchema: z.ZodType<TemplateCompileProjectionState>
  readonly init: () => TemplateCompileProjectionState
  readonly apply: (state: TemplateCompileProjectionState, event: TemplateCompileProjectionEvent) => TemplateCompileProjectionState
  readonly wire: {
    readonly viewSchema: z.ZodType<TemplateCompileWireView>
    readonly view: (state: TemplateCompileProjectionState) => TemplateCompileWireView
  }
  readonly stateVersion: typeof TEMPLATE_COMPILE_PROJECTION_STATE_VERSION
}

export function createTemplateCompileProjectionDefinition(): TemplateCompileProjectionDefinition {
  return {
    key: TEMPLATE_COMPILE_PROJECTION_KEY,
    stateSchema: templateCompileStateSchema,
    init: createTemplateCompileProjectionState,
    apply: applyTemplateCompileProjection,
    wire: {
      viewSchema: templateCompileWireSchema,
      // pendingCalls and the digest map are host-side fold material; the
      // browser only receives the bounded recovery contracts and receipts.
      view: state => ({ ok: true, sessions: state.sessions.map(entry => ({
        session: entry.session,
        ...(entry.compileId === undefined ? {} : { compileId: entry.compileId }),
        ...(entry.exportReceipt === undefined ? {} : { exportReceipt: entry.exportReceipt }),
      })) }),
    },
    stateVersion: TEMPLATE_COMPILE_PROJECTION_STATE_VERSION,
  }
}

/** Structural registry face for `ctx.sessionProjections` (host wiring). */
export interface TemplateCompileProjectionRegistryFace {
  register(definition: TemplateCompileProjectionDefinition): unknown
}

/** Register the unit on the session-projections registry; returns the unregister handle when the registry provides one. */
export function registerTemplateCompileProjection(registry: TemplateCompileProjectionRegistryFace): unknown {
  return registry.register(createTemplateCompileProjectionDefinition())
}

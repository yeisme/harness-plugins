/**
 * Compile-session RPCs over the connected stdio MCP seam (task 2.3):
 * create → update (fill fields) → confirm → compile → export.
 *
 * Wire facts verified live against the real server (2026-09-14):
 * - `session_update.fields` values are objects `{value, kind, confirmed}`
 *   (plain strings are INPUT_INVALID);
 * - `session_confirm` REQUIRES a host-supplied `decision_ref` — the owner's
 *   explicit approval credential. This layer never invents one: callers must
 *   pass it through, and an empty decision ref is refused before the wire;
 * - every mutation carries `expected_revision` (owner-side CAS). On
 *   REVISION_CONFLICT the host re-READS the latest revision once (session_show)
 *   and surfaces it — it never overwrites, never retries the write;
 * - `compile` performs zero model calls; the owner reports
 *   `facts.provider_calls` and this layer fails closed unless it is exactly 0;
 * - `export` writes inside the owner's project; only the bounded receipt
 *   (compile id, digest, owner-relative output ref, providerCalls=0) returns.
 *
 * @module @yeisme/dsh-template-registry/sessions
 */

import {
  TemplateSessionSchema,
  canCompile,
  sessionStatusFromReadiness,
  type SessionIssue,
  type TemplateSession,
} from './contracts.js'
import { callTemplateRegistryTool, type TemplateRegistryCallFailure } from './rpc.js'
import type { TemplateRegistryMcpConnection } from './transport.js'

// ---------------------------------------------------------------------------
// Session view folding
// ---------------------------------------------------------------------------

/** Context the fold needs beyond the registry view (host-known facts). */
export interface RegistrySessionContext {
  readonly ref: string
  readonly digest: string
  /** Field values the host submitted (the registry never echoes them back). */
  readonly fields?: Readonly<Record<string, unknown>> | undefined
  readonly contractDigest?: string | undefined
  readonly decisionRef?: string | undefined
  /** Material status override after compile/export (the view tops out at ready). */
  readonly status?: TemplateSession['status'] | undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/**
 * Fold one registry session view (session_create/show/update/confirm data
 * block: id, revision, readiness, issues[], fields[{key,kind,confirmed}],
 * sources[], steps[], next_action) into the frozen TemplateSession
 * projection. Returns undefined on shape drift (fail-closed, never guessed).
 *
 * Status folding (state machine, frozen 1.2): registry readiness maps through
 * `sessionStatusFromReadiness`; `compiled`/`exported` arrive only via the
 * context override because the registry view vocabulary stops at
 * ready_to_compile. `confirmed` is true exactly when the owner reports
 * ready_to_compile (the post-confirm state) — never inferred locally.
 */
export function foldRegistrySessionView(view: unknown, context: RegistrySessionContext): TemplateSession | undefined {
  const root = asRecord(view)
  if (root === undefined) return undefined
  const id = typeof root.id === 'string' && root.id !== '' ? root.id : undefined
  const revision = typeof root.revision === 'number' && Number.isSafeInteger(root.revision) && root.revision >= 1 ? root.revision : undefined
  const readiness = root.readiness
  if (id === undefined || revision === undefined || typeof readiness !== 'string') return undefined
  const fieldsRaw = Array.isArray(root.fields) ? root.fields : []
  const confirmedKeys: string[] = []
  for (const entry of fieldsRaw) {
    const row = asRecord(entry)
    if (row === undefined || typeof row.key !== 'string') continue
    if (row.confirmed === true) confirmedKeys.push(row.key)
  }
  const readinessParsed = (['needs_input','needs_analysis','needs_confirmation','ready_to_compile','blocked'] as const).find(value => value === readiness)
  if (readinessParsed === undefined) return undefined
  const session = TemplateSessionSchema.safeParse({
    id, ref: context.ref, digest: context.digest,
    status: context.status ?? sessionStatusFromReadiness(readinessParsed),
    fields: { ...(context.fields ?? {}) },
    confirmed: readinessParsed === 'ready_to_compile',
    provider_calls: 0,
    updatedAt: new Date().toISOString(),
    revision,
    readiness: readinessParsed,
    ...(typeof root.next_action === 'string' ? { nextAction: root.next_action.slice(0, 48) } : {}),
    confirmedKeys: confirmedKeys.slice(0, 64),
    ...(context.contractDigest === undefined ? {} : { contractDigest: context.contractDigest }),
    ...(context.decisionRef === undefined ? {} : { decisionRef: context.decisionRef }),
  })
  return session.success ? session.data : undefined
}

/** Session issues from a raw view (for readable missing-field lists). */
export function sessionIssuesFromView(view: unknown): SessionIssue[] {
  const root = asRecord(view)
  const issues = root?.issues
  if (!Array.isArray(issues)) return []
  const folded: SessionIssue[] = []
  for (const entry of issues) {
    const row = asRecord(entry)
    if (row === undefined || typeof row.code !== 'string') continue
    folded.push({
      code: row.code.slice(0, 48),
      ...(typeof row.field === 'string' ? { field: row.field.slice(0, 128) } : {}),
      ...(typeof row.step === 'string' ? { step: row.step.slice(0, 64) } : {}),
    })
  }
  return folded.slice(0, 32)
}

/** Wire field names the owner still needs (INPUT_* issues carry them prefixed). */
export function requiredFieldNamesFromIssues(issues: readonly SessionIssue[]): string[] {
  const names = issues
    .filter(issue => issue.code === 'INPUT_REQUIRED' || issue.code === 'INPUT_CONFIRMATION_REQUIRED')
    .map(issue => issue.field)
    .filter((field): field is string => field !== undefined)
  return [...new Set(names)]
}

// ---------------------------------------------------------------------------
// Typed session call outcomes
// ---------------------------------------------------------------------------

/** Host-side refusal codes (checked BEFORE the wire; stable, never prose). */
export type TemplateSessionGuardCode =
  | 'invalid_input'
  | 'missing_fields'
  | 'not_confirmed'
  | 'not_compiled'
  | 'stale_digest'
  | 'provider_calls_nonzero'
  | 'degraded'

export type TemplateSessionFailure =
  | TemplateRegistryCallFailure
  | { readonly kind: 'revision_conflict'; readonly latest?: TemplateSession }
  | { readonly kind: 'guard'; readonly code: TemplateSessionGuardCode; readonly detail: string; readonly missing?: readonly string[] }

export type TemplateSessionOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: TemplateSessionFailure }

/** Values the host submits through `session_update` (schema-true wire shape). */
export type RegistrySessionFieldInput = { readonly value: unknown; readonly kind?: string }

export interface RegistrySessionCreateInput {
  readonly goal: string
  readonly ref?: string
  readonly role?: string
  readonly locale?: string
}

/**
 * `template_registry_session_create` — starts the owner-side compile session.
 * `goal` is required by the owner; empty goals are refused before the wire.
 */
export async function registrySessionCreate(
  connection: TemplateRegistryMcpConnection,
  input: RegistrySessionCreateInput,
  context: { ref: string; digest: string; contractDigest?: string },
): Promise<TemplateSessionOutcome<TemplateSession>> {
  if (input.goal.trim() === '') {
    return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'goal is required' } }
  }
  const args: Record<string, unknown> = { goal: input.goal }
  if (input.ref !== undefined) args.ref = input.ref
  if (input.role !== undefined) args.role = input.role
  if (input.locale !== undefined) args.locale = input.locale
  const outcome = await callTemplateRegistryTool(connection, 'template_registry_session_create', args)
  if (!outcome.ok) return outcome
  const session = foldRegistrySessionView(outcome.call.data, context)
  if (session === undefined) return { ok: false, failure: { kind: 'contract_mismatch' } }
  return { ok: true, value: session }
}

/**
 * `template_registry_session_update` — fills fields under owner-side CAS.
 * On REVISION_CONFLICT the latest view is re-READ once (never overwritten,
 * never retried) and returned alongside the conflict for the caller to
 * re-derive its edit.
 */
export async function registrySessionUpdate(
  connection: TemplateRegistryMcpConnection,
  input: { sessionId: string; expectedRevision: number; fields: Readonly<Record<string, RegistrySessionFieldInput>> },
  context: RegistrySessionContext,
): Promise<TemplateSessionOutcome<TemplateSession>> {
  if (Object.keys(input.fields).length === 0) {
    return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'no fields to update' } }
  }
  // Wire-true field shape: {value, kind, confirmed}. DSH form values are
  // user-supplied (`kind: 'user'`) and NOT yet confirmed — approval happens
  // only through session_confirm with the owner's decision ref.
  const fields: Record<string, { value: unknown; kind: string; confirmed: boolean }> = {}
  for (const [name, entry] of Object.entries(input.fields)) {
    fields[name] = { value: entry.value, kind: entry.kind ?? 'user', confirmed: false }
  }
  const outcome = await callTemplateRegistryTool(connection, 'template_registry_session_update', {
    session_id: input.sessionId, expected_revision: input.expectedRevision, fields,
  })
  if (!outcome.ok) {
    if (outcome.failure.kind === 'registry_error' && outcome.failure.code === 'REVISION_CONFLICT') {
      return { ok: false, failure: { kind: 'revision_conflict', ...(await latestSession(connection, input.sessionId, context)) } }
    }
    return outcome
  }
  const merged: RegistrySessionContext = { ...context, fields: { ...(context.fields ?? {}), ...Object.fromEntries(Object.entries(fields).map(([name, entry]) => [name, entry.value])) } }
  const session = foldRegistrySessionView(outcome.call.data, merged)
  if (session === undefined) return { ok: false, failure: { kind: 'contract_mismatch' } }
  return { ok: true, value: session }
}

/**
 * `template_registry_session_confirm` — the owner's explicit approval gate.
 * The decision ref is REQUIRED and must come from the caller (a host-side
 * confirmation credential); this layer never fabricates or defaults one.
 */
export async function registrySessionConfirm(
  connection: TemplateRegistryMcpConnection,
  input: { sessionId: string; expectedRevision: number; decisionRef: string; goal?: boolean; fields?: readonly string[] },
  context: RegistrySessionContext,
): Promise<TemplateSessionOutcome<TemplateSession>> {
  if (input.decisionRef.trim() === '') {
    return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'decision_ref is required (the host never self-approves)' } }
  }
  const args: Record<string, unknown> = {
    session_id: input.sessionId, expected_revision: input.expectedRevision, decision_ref: input.decisionRef,
  }
  if (input.goal !== undefined) args.goal = input.goal
  if (input.fields !== undefined) args.fields = [...input.fields]
  const outcome = await callTemplateRegistryTool(connection, 'template_registry_session_confirm', args)
  if (!outcome.ok) {
    if (outcome.failure.kind === 'registry_error' && outcome.failure.code === 'REVISION_CONFLICT') {
      return { ok: false, failure: { kind: 'revision_conflict', ...(await latestSession(connection, input.sessionId, context)) } }
    }
    return outcome
  }
  const session = foldRegistrySessionView(outcome.call.data, { ...context, decisionRef: input.decisionRef })
  if (session === undefined) return { ok: false, failure: { kind: 'contract_mismatch' } }
  return { ok: true, value: session }
}

/** Compile answer: the folded session plus the owner's compile digest/id. */
export interface RegistryCompileResult {
  readonly session: TemplateSession
  readonly compileId: string
  readonly digest: string
}

/**
 * `template_registry_compile` — zero model calls by contract. Host-side
 * guards run FIRST (frozen canCompile: confirmed + all required fields
 * non-empty in an armed status); after the wire the owner's
 * `provider_calls` fact must be exactly 0 or the package is discarded.
 */
export async function registryCompileSession(
  connection: TemplateRegistryMcpConnection,
  input: { sessionId: string; expectedRevision: number },
  guard: { session: TemplateSession; required: readonly string[] },
  context: RegistrySessionContext,
): Promise<TemplateSessionOutcome<RegistryCompileResult>> {
  // Armed-state gate (state machine): filling/confirming/ready + explicit
  // confirmation + every required field present and non-empty.
  if (!canCompile(guard.session, [...guard.required])) {
    if (!guard.session.confirmed) {
      return { ok: false, failure: { kind: 'guard', code: 'not_confirmed', detail: 'the session was never explicitly confirmed' } }
    }
    const missing = guard.required.filter(name => guard.session.fields[name] === undefined || guard.session.fields[name] === '')
    if (missing.length > 0) {
      return { ok: false, failure: { kind: 'guard', code: 'missing_fields', detail: 'required fields are missing or empty', missing } }
    }
    return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'session status is not compile-armed' } }
  }
  const outcome = await callTemplateRegistryTool(connection, 'template_registry_compile', {
    session_id: input.sessionId, expected_revision: input.expectedRevision,
  })
  if (!outcome.ok) return outcome
  const facts = outcome.call.envelope.facts
  const compileId = typeof facts.id === 'string' ? facts.id : undefined
  const digest = typeof facts.digest === 'string' ? facts.digest : undefined
  const providerCalls = facts.provider_calls
  // Fail closed: a nonzero provider_calls answer violates the change's core
  // contract (this pane compiles without model calls) and is never surfaced.
  if (compileId === undefined || digest === undefined || providerCalls !== 0) {
    return { ok: false, failure: { kind: 'guard', code: 'provider_calls_nonzero', detail: 'compile answer failed the provider_calls=0 contract' } }
  }
  const session = foldRegistrySessionView(outcome.call.data, { ...context, status: 'compiled' })
    ?? { ...guard.session, status: 'compiled' as const, revision: typeof facts.revision === 'number' ? facts.revision : guard.session.revision, updatedAt: new Date().toISOString() }
  return { ok: true, value: { session, compileId, digest } }
}

/** Bounded export receipt (the only export fact the browser ever sees). */
export interface RegistryExportReceipt {
  readonly compileId: string
  readonly digest: string
  /** Owner-relative display reference — never an absolute path. */
  readonly outputRef: string
  readonly providerCalls: 0
  readonly exportedAt: string
}

/**
 * `template_registry_export` — writes the prompt package inside the owner's
 * project. Gated on digest: when the caller supplies the template's CURRENT
 * digest and it no longer matches the session's pinned digest, export is
 * disabled (stale) and the owner is asked to re-pin (explicit reset).
 */
export async function registryExportCompile(
  connection: TemplateRegistryMcpConnection,
  input: { compileId: string; output: string },
  guard: { session: TemplateSession; currentDigest?: string },
): Promise<TemplateSessionOutcome<RegistryExportReceipt>> {
  if (input.compileId.trim() === '' || input.output.trim() === '') {
    return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'compile_id and output are required' } }
  }
  if (guard.currentDigest !== undefined && guard.currentDigest !== guard.session.digest) {
    return { ok: false, failure: { kind: 'guard', code: 'stale_digest', detail: 'the template digest changed since the session pinned it; re-pin before exporting' } }
  }
  if (guard.session.status !== 'compiled' && guard.session.status !== 'stale') {
    return { ok: false, failure: { kind: 'guard', code: 'not_compiled', detail: 'only a compiled session may export' } }
  }
  const outcome = await callTemplateRegistryTool(connection, 'template_registry_export', {
    compile_id: input.compileId, output: input.output,
  })
  if (!outcome.ok) return outcome
  const facts = outcome.call.envelope.facts
  const digest = typeof facts.digest === 'string' ? facts.digest : undefined
  // The owner echoes the compile digest and the owner-relative output; both
  // are bounded and checked before the receipt is built.
  const outputRef = typeof facts.output === 'string' ? facts.output.slice(0, 300) : undefined
  if (digest === undefined || outputRef === undefined) return { ok: false, failure: { kind: 'contract_mismatch' } }
  return {
    ok: true,
    value: { compileId: input.compileId, digest, outputRef, providerCalls: 0, exportedAt: new Date().toISOString() },
  }
}

/** `template_registry_session_show` (readonly) — recovery/re-read channel. */
export async function registrySessionShow(
  connection: TemplateRegistryMcpConnection,
  sessionId: string,
  context: RegistrySessionContext,
): Promise<TemplateSessionOutcome<TemplateSession>> {
  const outcome = await callTemplateRegistryTool(connection, 'template_registry_session_show', { session_id: sessionId })
  if (!outcome.ok) return outcome
  const session = foldRegistrySessionView(outcome.call.data, context)
  if (session === undefined) return { ok: false, failure: { kind: 'contract_mismatch' } }
  return { ok: true, value: session }
}

async function latestSession(connection: TemplateRegistryMcpConnection, sessionId: string, context: RegistrySessionContext): Promise<{ latest?: TemplateSession }> {
  // Re-READ only: CAS conflicts surface the newest revision without any
  // write. A failed re-read stays honest (no latest, conflict still reported).
  const shown = await registrySessionShow(connection, sessionId, context)
  return shown.ok ? { latest: shown.value } : {}
}

/** Convenience: is this failure a transport loss (drives degraded marking)? */
export function isTransportFailure(failure: TemplateSessionFailure): boolean {
  return (failure as { kind?: unknown }).kind === 'disconnected'
}

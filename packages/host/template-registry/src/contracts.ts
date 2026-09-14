/**
 * Frozen integration contract for the DSH template-registry plugin
 * (dsh-template-registry-integration-v1, tasks 1.2).
 *
 * Source of truth for every shape below is the real stdio MCP handshake
 * performed 2026-09-14 against the template-registry server
 * (`template-registry.prompt-compiler.v0.2`, protocol 2025-06-18); see
 * openspec/changes/dsh-template-registry-integration-v1/implementation-baseline.md.
 * The browser-facing values are safe projections (bounded, no credentials,
 * no absolute paths, no raw template bodies).
 *
 * Backward compatibility: every export committed by the scaffold
 * (TemplateStatus, TemplateSchema, TemplateSessionSchema, the adapter
 * interface, createTemplateSession, canCompile, markStale) keeps its name
 * and shape; later tasks only add fields (all defaulted/optional) and new
 * exports.
 *
 * @module @yeisme/dsh-template-registry/contracts
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Template catalog projection
// ---------------------------------------------------------------------------

export const TemplateStatus = z.enum(['ready','filling','confirming','compiled','exported','stale','degraded','disabled','unknown'])

/** Solution-level rights vocabulary observed in the live catalog (string field). */
export const RegistryRightsLevel = z.enum(['internal','free-evaluation','external-attributed','blocked','prohibited'])
/** Per-template contract permission vocabulary (compile.go policy). */
export const TemplatePermission = z.enum(['preview','export','execute_requires_review','deny','blocked'])
/** Catalog maturity vocabulary; `mature` is declared by the scaffold enum, not yet observed live. */
export const TemplateMaturity = z.enum(['exploratory','first-support','mature'])

export const TemplateSchema = z.object({
  ref: z.string().min(1), digest: z.string().min(1), title: z.string(), summary: z.string(),
  tags: z.array(z.string()).default([]), capabilities: z.array(z.string()).default([]),
  maturity: TemplateMaturity.default('exploratory'),
  rights: z.object({ preview: z.boolean(), export: z.boolean() }), source: z.enum(['local','remote','catalog']),
  // Frozen 1.2 additions (all optional/defaulted so committed rows keep parsing).
  rightsLevel: RegistryRightsLevel.optional(),
  permissions: z.array(TemplatePermission).max(8).default([]),
  compilerStatus: z.string().max(48).optional(),
  version: z.string().max(64).optional(),
})

/** Contract input definition (from `inspect` — drives the guided form). */
export const TemplateInputDefinitionSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.string().max(32).default('string'),
  required: z.boolean().default(false),
  min_length: z.number().int().nonnegative().optional(),
  max_length: z.number().int().positive().optional(),
  labels: z.record(z.string(), z.string().max(120)).default({}),
  descriptions: z.record(z.string(), z.string().max(600)).default({}),
})

/** Template contract (from `inspect`): the compile pane form source of truth. */
export const TemplateContractSchema = z.object({
  digest: z.string().min(1),
  inputs: z.array(TemplateInputDefinitionSchema).max(64).default([]),
  license: z.string().max(64).default('internal'),
  permissions: z.array(TemplatePermission).max(8).default([]),
})

export type Template = z.infer<typeof TemplateSchema>
export type TemplateStatus = z.infer<typeof TemplateStatus>
export type RegistryRightsLevel = z.infer<typeof RegistryRightsLevel>
export type TemplatePermission = z.infer<typeof TemplatePermission>
export type TemplateInputDefinition = z.infer<typeof TemplateInputDefinitionSchema>
export type TemplateContract = z.infer<typeof TemplateContractSchema>

// ---------------------------------------------------------------------------
// Compile session projection
// ---------------------------------------------------------------------------

/** Registry-side readiness vocabulary (state.go, verified live). */
export const RegistryReadiness = z.enum(['needs_input','needs_analysis','needs_confirmation','ready_to_compile','blocked'])
/** Session issue codes observed live; unknown codes stay fail-closed at host. */
export const SessionIssueSchema = z.object({
  code: z.string().max(48),
  field: z.string().max(128).optional(),
  step: z.string().max(64).optional(),
})

export const TemplateSessionSchema = z.object({
  id: z.string().min(1).max(64), ref: z.string().min(1), digest: z.string().min(1), status: TemplateStatus,
  fields: z.record(z.string(), z.unknown()).default({}), confirmed: z.boolean().default(false),
  provider_calls: z.literal(0).default(0), updatedAt: z.string(),
  // Frozen 1.2 additions: registry CAS revision, readiness fold, recovery contract.
  revision: z.number().int().positive().default(1),
  readiness: RegistryReadiness.optional(),
  nextAction: z.string().max(48).optional(),
  confirmedKeys: z.array(z.string().max(128)).max(64).default([]),
  contractDigest: z.string().min(1).optional(),
  decisionRef: z.string().min(1).max(128).optional(),
  // 4.1 addition (real-binary acceptance finding): the registry addresses
  // session fields on the wire as `<step-id>.<contract-input-name>` (compile.go
  // knownField). The pane stays contract-name canonical; the host owns the
  // prefix translation. These are the step ids learned from the session view.
  stepIds: z.array(z.string().min(1).max(64)).max(16).default([]),
})

export type TemplateSession = z.infer<typeof TemplateSessionSchema>
export type RegistryReadiness = z.infer<typeof RegistryReadiness>
export type SessionIssue = z.infer<typeof SessionIssueSchema>

/**
 * Fold registry readiness onto the DSH session status. `blocked` maps to
 * `disabled` (rights/seam denial shown with a reason, never a dead button);
 * analysis-pending sources stay `filling` alongside missing inputs.
 */
export function sessionStatusFromReadiness(readiness: RegistryReadiness): TemplateStatus {
  switch (readiness) {
    case 'needs_input': return 'filling'
    case 'needs_analysis': return 'filling'
    case 'needs_confirmation': return 'confirming'
    case 'ready_to_compile': return 'ready'
    case 'blocked': return 'disabled'
  }
}

// ---------------------------------------------------------------------------
// Compile session state machine (frozen)
// ---------------------------------------------------------------------------
//
// Material flow:  filling -> confirming -> ready -> compiled -> exported
// Overlay states: stale (digest drift), degraded (transport lost),
// disabled (rights/seam denial), unknown (projection cannot classify).
// Overlays never destroy progress: `degraded` re-derives the material state
// from registry readiness on transport_back; `stale`/`disabled` require an
// explicit reset (owner re-pin) before mutations unlock again.

export const TEMPLATE_SESSION_EVENTS = [
  'field_filled','field_confirmed','goal_confirmed','all_inputs_ready',
  'compiled','exported','digest_drift','transport_lost','transport_back',
  'rights_denied','reset',
] as const
export type TemplateSessionEvent = typeof TEMPLATE_SESSION_EVENTS[number]

type TransitionTable = Record<TemplateStatus, Partial<Record<TemplateSessionEvent, TemplateStatus>>>

export const TEMPLATE_SESSION_TRANSITIONS: TransitionTable = {
  filling: {
    field_filled: 'filling', field_confirmed: 'confirming', goal_confirmed: 'confirming',
    all_inputs_ready: 'ready', digest_drift: 'stale', transport_lost: 'degraded', rights_denied: 'disabled', reset: 'filling',
  },
  confirming: {
    field_filled: 'filling', goal_confirmed: 'confirming', all_inputs_ready: 'ready',
    compiled: 'compiled', digest_drift: 'stale', transport_lost: 'degraded', rights_denied: 'disabled', reset: 'filling',
  },
  ready: {
    field_filled: 'filling', compiled: 'compiled', digest_drift: 'stale',
    transport_lost: 'degraded', rights_denied: 'disabled', reset: 'filling',
  },
  compiled: {
    field_filled: 'filling', exported: 'exported', digest_drift: 'stale',
    transport_lost: 'degraded', rights_denied: 'disabled', reset: 'filling',
  },
  exported: {
    // Terminal for this package: a new export starts a new session.
    digest_drift: 'stale', transport_lost: 'degraded', reset: 'filling',
  },
  stale: { reset: 'filling', transport_lost: 'degraded' },
  degraded: {
    // Re-derived from registry readiness on reconnect; absent readiness -> unknown.
    transport_back: 'unknown', reset: 'filling',
  },
  disabled: { reset: 'filling', transport_lost: 'degraded' },
  unknown: { reset: 'filling', transport_lost: 'degraded', transport_back: 'unknown' },
}

/**
 * Apply one state-machine event to a session. `transport_back` re-folds the
 * material status from the session's registry readiness (falling back to
 * `unknown`); every other event is a pure table lookup — undefined keeps the
 * current status (illegal transitions never throw and never lose fields).
 */
export function advanceTemplateSession(session: TemplateSession, event: TemplateSessionEvent): TemplateSession {
  if (event === 'transport_back') {
    if (session.status !== 'degraded' && session.status !== 'unknown') return session
    const status = session.readiness === undefined ? 'unknown' : sessionStatusFromReadiness(session.readiness)
    return { ...session, status }
  }
  const next = TEMPLATE_SESSION_TRANSITIONS[session.status][event]
  return next === undefined ? session : { ...session, status: next }
}

export function createTemplateSession(ref: string, digest: string): TemplateSession {
  return { id: crypto.randomUUID(), ref, digest, status: 'filling', fields: {}, confirmed: false, provider_calls: 0, updatedAt: new Date().toISOString(), revision: 1, confirmedKeys: [], stepIds: [] }
}

/** Compile is armed only in filling/confirming/ready with explicit confirmation and all required fields present. */
export function canCompile(session: TemplateSession, required: string[]): boolean {
  return session.status === 'filling' || session.status === 'confirming' || session.status === 'ready'
    ? session.confirmed && required.every(k => session.fields[k] !== undefined && session.fields[k] !== '')
    : false
}

export function markStale(session: TemplateSession, currentDigest: string): TemplateSession {
  return currentDigest === session.digest ? session : { ...session, status: 'stale' }
}

/** Transport-loss overlay: keeps progress, only flips the status (idempotent). */
export function markDegraded(session: TemplateSession, connected: boolean): TemplateSession {
  if (connected) return session
  if (session.status === 'degraded') return session
  return { ...session, status: 'degraded' }
}

// ---------------------------------------------------------------------------
// MCP consumption contract (frozen from the real tools/list)
// ---------------------------------------------------------------------------

/**
 * Minimum tool set the pane requires from a connected template-registry MCP
 * server (2.1 capability probe target). `doctor` and repository management
 * are optional enhancements, not entry conditions.
 */
export const REQUIRED_TEMPLATE_REGISTRY_MCP_TOOLS = [
  'template_registry_list',
  'template_registry_search',
  'template_registry_inspect',
  'template_registry_session_create',
  'template_registry_session_show',
  'template_registry_session_update',
  'template_registry_session_confirm',
  'template_registry_compile',
  'template_registry_export',
] as const
export type RequiredTemplateRegistryMcpTool = typeof REQUIRED_TEMPLATE_REGISTRY_MCP_TOOLS[number]

/** Unified tool envelope every MCP tool returns (spec_version 1.0). */
export const RegistryEnvelopeSchema = z.object({
  spec_version: z.string().max(16),
  status: z.enum(['success','partial','failed']),
  summary: z.string().max(600),
  facts: z.record(z.string(), z.unknown()).default({}),
  error: z.object({ code: z.string().max(64), message: z.string().max(600), retryable: z.boolean() }).optional(),
  actions: z.array(z.object({ name: z.string().max(64), command: z.string().max(400) })).max(8).default([]),
})
export type RegistryEnvelope = z.infer<typeof RegistryEnvelopeSchema>

/** Only error code the registry marks retryable (verified live + source). */
export const REGISTRY_RETRYABLE_ERROR_CODES: ReadonlySet<string> = new Set(['SESSION_STORE_BUSY'])

// ---------------------------------------------------------------------------
// Storage domain (frozen keying; bound to ctx.storageDomain in 2.3)
// ---------------------------------------------------------------------------

export const TEMPLATE_REGISTRY_DOMAIN = 'yeisme_template_registry_v1'
export const TEMPLATE_REGISTRY_TABLE = 'compile_sessions' as const

/** Export receipt: bounded owner-authored facts only, never an absolute path. */
export const TemplateExportReceiptSchema = z.object({
  compileId: z.string().min(1).max(128),
  digest: z.string().min(1),
  outputRef: z.string().min(1).max(300),
  providerCalls: z.literal(0),
  exportedAt: z.string(),
})

/**
 * One row per (DSH conversation session, registry compile session). The row
 * carries the recovery contract: exact ref + digests + confirmed-keys digest,
 * so a reopened pane rebuilds the form without any local CLI.
 */
export const TemplateRegistryCompileRowSchema = z.object({
  specVersion: z.literal(1),
  dshSessionRef: z.string().min(1).max(128),
  session: TemplateSessionSchema,
  exportReceipt: TemplateExportReceiptSchema.optional(),
})

export type TemplateExportReceipt = z.infer<typeof TemplateExportReceiptSchema>
export type TemplateRegistryCompileRow = z.infer<typeof TemplateRegistryCompileRowSchema>

/**
 * Structural mirror of the storage-domain spec. Declared without importing
 * `@deepseek-ai/dsh-storage-domain` so the contract package stays dependency
 * free; 2.3 binds this value to the real `DomainSpec` (names already satisfy
 * the facility's lowercase/underscore unit-name rules — camelCase table names
 * are rejected by real DSH storage).
 */
export interface TemplateRegistryDomainSpecShape {
  readonly name: typeof TEMPLATE_REGISTRY_DOMAIN
  readonly version: 1
  readonly tables: {
    readonly [TEMPLATE_REGISTRY_TABLE]: { readonly valueSchema: z.ZodType<TemplateRegistryCompileRow> }
  }
}

export const templateRegistryDomainSpec: TemplateRegistryDomainSpecShape = Object.freeze({
  name: TEMPLATE_REGISTRY_DOMAIN,
  version: 1,
  tables: { [TEMPLATE_REGISTRY_TABLE]: { valueSchema: TemplateRegistryCompileRowSchema } },
})

/** Row key: DSH-session-scoped so conversations never see each other's compile sessions. */
export function templateRegistrySessionKey(dshSessionRef: string, registrySessionId: string): string {
  return `${dshSessionRef} ${registrySessionId}`
}

// ---------------------------------------------------------------------------
// Adapter seam (host implements over MCP in 2.x; tests fake it)
// ---------------------------------------------------------------------------

export interface TemplateRegistryAdapter {
  list(input?: { query?: string; tag?: string; capability?: string }): Promise<Template[]>
  inspect(ref: string): Promise<Template | undefined>
  preview(ref: string): Promise<{ ref: string; text: string } | undefined>
  compile(input: { ref: string; digest: string; fields: Record<string, unknown>; confirmed: boolean }): Promise<{ session: TemplateSession; promptPackage: string }>
}

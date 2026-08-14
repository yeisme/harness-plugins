import { z } from 'zod'
import type { OrdoAgentOpsExpectedContext, OrdoAgentOpsRef, OrdoAgentOpsSnapshot } from './types.ts'

const opaqueRef = z.string().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
const safeKey = z.string().min(1).max(96).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
const safeText = z.string().min(1).max(512).refine(isSafeText, 'safe projection text contains a forbidden value')
const count = z.number().int().nonnegative().max(1_000_000)

/** Runtime boundary for the server-injected Host context. */
export const ordoAgentOpsExpectedContextSchema = z.object({
  tenantRef: opaqueRef,
  workspaceRef: opaqueRef,
  principalRef: opaqueRef,
  contextRevision: count,
  installationRef: opaqueRef,
}).strict()

const contextSchema = ordoAgentOpsExpectedContextSchema

const runSchema = z.object({
  runRef: opaqueRef,
  state: safeKey,
  safeTitle: safeText,
  taskCount: count,
  completedTaskCount: count,
  attentionCount: count,
}).strict().superRefine((run, ctx) => {
  if (run.completedTaskCount > run.taskCount) {
    ctx.addIssue({ code: 'custom', path: ['completedTaskCount'], message: 'completedTaskCount exceeds taskCount' })
  }
})

const capacitySchema = z.object({
  policyCap: count,
  observedOrRetained: count,
  qualifiedRoutes: count,
  reservationState: z.enum(['not_supported', 'not_reserved', 'reserved', 'stale', 'revoked', 'unknown']),
}).strict()

/** Runtime boundary for the Host-to-browser Ordo projection. */
export const ordoAgentOpsSnapshotSchema = z.object({
  schemaVersion: z.literal('ordo.agent_ops.snapshot.v1alpha1'),
  snapshotRef: opaqueRef,
  snapshotVersion: count,
  generatedAt: z.string().min(1).max(64).refine(isIsoTimestamp, 'generatedAt must be an ISO timestamp'),
  state: z.enum(['ready', 'stale', 'offline', 'permission_denied', 'contract_mismatch', 'needs_contract']),
  freshness: z.enum(['fresh', 'stale', 'offline']),
  reasonCode: z.enum([
    'owner_snapshot',
    'owner_read_contract_unavailable',
    'owner_projection_unavailable',
    'context_stale',
    'permission_denied',
    'contract_mismatch',
  ]),
  source: z.enum(['owner', 'owner-gated']),
  safeMessage: safeText,
  context: contextSchema.optional(),
  run: runSchema.optional(),
  capacity: capacitySchema.optional(),
}).strict().superRefine((snapshot, ctx) => {
  const readable = snapshot.state === 'ready' || snapshot.state === 'stale'
  if (readable && snapshot.context === undefined) {
    ctx.addIssue({ code: 'custom', path: ['context'], message: 'ready and stale snapshots require context' })
  }
  if (!readable && (snapshot.run !== undefined || snapshot.capacity !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'non-readable snapshots must not carry run or capacity facts' })
  }
})

/**
 * Validate, detach, and freeze the context supplied by the server at Host construction.
 * @param input - untrusted Context key value.
 * @returns an immutable context copy, or `undefined` when the injection is invalid.
 */
export function validateOrdoAgentOpsExpectedContext(input: unknown): OrdoAgentOpsExpectedContext | undefined {
  const result = ordoAgentOpsExpectedContextSchema.safeParse(input)
  if (!result.success) return undefined
  return Object.freeze({
    tenantRef: result.data.tenantRef as OrdoAgentOpsRef,
    workspaceRef: result.data.workspaceRef as OrdoAgentOpsRef,
    principalRef: result.data.principalRef as OrdoAgentOpsRef,
    contextRevision: result.data.contextRevision,
    installationRef: result.data.installationRef as OrdoAgentOpsRef,
  })
}

/**
 * Validate and clone an owner-authored projection before it crosses the Host
 * Remote boundary. Invalid or sensitive projections are not downgraded into
 * partial data; callers must replace them with a contract-gated snapshot.
 * @param input - untrusted owner projection read inside the Host.
 * @returns the validated snapshot, or `undefined` when the input is invalid.
 */
export function validateOrdoAgentOpsSnapshot(input: unknown): OrdoAgentOpsSnapshot | undefined {
  const result = ordoAgentOpsSnapshotSchema.safeParse(input)
  return result.success ? result.data as OrdoAgentOpsSnapshot : undefined
}

function isIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && !/[\u0000-\u001f\u007f]/.test(value)
}

const unsafeSchemeOrCredential = /(?:https?:\/\/|wss?:\/\/|\bBearer\b|\b(?:token|secret|credential|password|api[_-]?key)\b)/i
const unsafePathOrProcess = /(?:^|[\s:=])(?:pid|process[_-]?id)(?:[\s:=]|$)|(?:^|[\s:=])(?:\/|[a-z]:[/\\])/i

function isSafeText(value: string): boolean {
  if (/[\u0000-\u001f\u007f]/.test(value)) return false
  return !unsafeSchemeOrCredential.test(value) && !unsafePathOrProcess.test(value)
}

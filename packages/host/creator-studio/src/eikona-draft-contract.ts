import { z } from 'zod'

const ref = z.string().min(1).max(512)
const digest = z.string().regex(/^[a-f0-9]{64}$/u)
const preparationRef = z.string().regex(/^egp_[a-f0-9]{64}$/u)
const approvalRef = z.string().regex(/^ega_[a-f0-9]{64}$/u)

/** Unfinished text is deliberately retained verbatim, including invalid input. */
export const eikonaDraftFieldsSchema = z.object({
  reference: z.string().max(480).optional(), mask: z.string().max(480).optional(), referenceMode: z.enum(['auto', 'edit', 'generate']).optional(),
  prompt: z.string().max(160), version: z.string().max(32),
  size: z.string().max(80), seed: z.string().max(32),
  variables: z.array(z.object({ name: z.string().max(160), value: z.string().max(4096) }).strict()).max(64),
}).strict().refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 320 * 1024, 'Draft exceeds storage limit')

/** A checkpoint is an observation to reconcile, never a permission to execute. */
const checkpoint = z.discriminatedUnion('status', [
  z.object({ status: z.literal('editing') }).strict(),
  z.object({ status: z.literal('approval_reconciled'), preparationRef, digest, approvalRef, revoked: z.literal(true), observedAt: z.string().datetime({ offset: true }), consumedOperation: z.string().regex(/^own_[a-f0-9]{24}$/u).optional() }).strict(),
  z.object({ status: z.literal('preparation_unconfirmed') }).strict(),
  z.object({ status: z.literal('prepared'), preparationRef, digest }).strict(),
  z.object({ status: z.literal('approval_unconfirmed'), preparationRef, digest }).strict(),
  z.object({ status: z.literal('approval_observed'), preparationRef, digest, approvalRef }).strict(),
  z.object({ status: z.literal('revocation_unconfirmed'), preparationRef, digest, approvalRef }).strict(),
])

export const eikonaDraftSchema = z.object({
  schemaVersion: z.literal('eikona.studio_draft.v1'),
  scope: z.object({ tenantRef: ref, workspaceRef: ref, projectRef: ref }).strict(),
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  revision: z.number().int().nonnegative().safe(),
  fields: eikonaDraftFieldsSchema,
  checkpoint,
}).strict()

export type EikonaDraft = z.infer<typeof eikonaDraftSchema>

const draftRequestId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u)
export const eikonaDraftQuerySchema = z.object({ scope: eikonaDraftSchema.shape.scope, id: eikonaDraftSchema.shape.id }).strict()
export const eikonaDraftSaveSchema = z.object({ requestId: draftRequestId, draft: eikonaDraftSchema }).strict()
export const eikonaDraftReconcileSchema = eikonaDraftQuerySchema.extend({ requestId: draftRequestId })
const draftFailure = z.object({ status: z.enum(['invalid', 'forbidden', 'error', 'unknown', 'conflict', 'missing', 'unavailable']) }).strict()
export const eikonaDraftReadResultSchema = z.union([draftFailure, z.object({ status: z.literal('ready'), draft: eikonaDraftSchema }).strict()])
export const eikonaDraftSaveResultSchema = z.union([draftFailure, z.object({ status: z.literal('saved'), requestId: draftRequestId, revision: z.number().int().positive().safe() }).strict()])
export type EikonaDraftQuery = z.infer<typeof eikonaDraftQuerySchema>
export type EikonaDraftSave = z.infer<typeof eikonaDraftSaveSchema>
export type EikonaDraftReconcile = z.infer<typeof eikonaDraftReconcileSchema>
export type EikonaDraftReadResult = z.infer<typeof eikonaDraftReadResultSchema>
export type EikonaDraftSaveResult = z.infer<typeof eikonaDraftSaveResultSchema>

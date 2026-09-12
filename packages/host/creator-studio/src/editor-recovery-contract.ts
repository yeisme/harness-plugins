import { ArtifactRefSchema } from '@yeisme/dsh-pane-protocol'
import { z } from 'zod'
const version = z.string().regex(/^(0|[1-9][0-9]{0,15}):(?:sha256:)?[a-f0-9]{64}$/u)
export const editorRecoveryQuerySchema = z.object({ artifact: ArtifactRefSchema.refine(value => value.owner === 'auctra' && value.kind === 'text').optional(), cursor: z.string().min(1).max(1024).optional(), limit: z.number().int().min(1).max(100).optional() }).strict()
export const editorRecoverySummarySchema = z.object({
 ref: z.string().regex(/^auctra:editor-recovery:[a-f0-9]{32}:erd-[a-f0-9]{32}$/u),
 unitRef: z.string().max(512).regex(/^(text|chapter|screenplay-draft):[A-Za-z0-9][A-Za-z0-9._-]*$/u),
 baseVersion: version, revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), contentDigest: z.string().regex(/^[a-f0-9]{64}$/u),
 byteLength: z.number().int().min(0).max(2*1024*1024), updatedAt: z.string().datetime({ offset: true }),
}).strict()
const failure = z.object({ status: z.enum(['needs_contract','permission_denied','unavailable','unconfirmed','invalid_input','conflict']) }).strict()
export const editorRecoveryPageSchema = z.union([failure,z.object({status:z.literal('ready'),value:z.object({drafts:z.array(editorRecoverySummarySchema).max(100),nextCursor:z.string().min(1).max(1024).optional()}).strict()}).strict()])
export const editorRecoveryReadSchema = z.union([failure,z.object({status:z.literal('ready'),value:z.object({draft:editorRecoverySummarySchema,content:z.string().max(2*1024*1024),currentSourceVersion:version,sourceChanged:z.boolean()}).strict()}).strict()])
export type EditorRecoveryPageV1 = z.infer<typeof editorRecoveryPageSchema>
export type EditorRecoveryReadV1 = z.infer<typeof editorRecoveryReadSchema>
export type EditorRecoverySummaryV1 = z.infer<typeof editorRecoverySummarySchema>
const recoveryText = z.string().max(2 * 1024 * 1024).refine(text => {
 const bytes = new TextEncoder().encode(text)
 return bytes.byteLength <= 2 * 1024 * 1024 && new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) === text
})
export const editorRecoverySaveQuerySchema = z.object({
 base: z.object({ artifact: ArtifactRefSchema.refine(value => value.owner === 'auctra' && value.kind === 'text'), contentRevision: version, content: recoveryText }).strict(),
 content: recoveryText, previous: editorRecoverySummarySchema.optional(),
}).strict()
export const editorRecoverySavedSchema = z.union([failure,z.object({status:z.literal('ready'),value:z.object({draft:editorRecoverySummarySchema,currentSourceVersion:version,sourceChanged:z.boolean()}).strict()}).strict()])
export type EditorRecoverySaveQueryV1 = z.infer<typeof editorRecoverySaveQuerySchema>
export type EditorRecoverySavedV1 = z.infer<typeof editorRecoverySavedSchema>

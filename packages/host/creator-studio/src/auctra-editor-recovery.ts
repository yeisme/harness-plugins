import { createHash } from 'node:crypto'
import { z } from 'zod'
import { auctraWorkingCopyOpenRefSchema } from './auctra-working-copy.ts'
import type { CreatorStudioContextV1 } from './types.ts'

export const AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST = 'ddfbdad2f8a6ab7e87ae0f08ef318052c5f2b467d4f4cc2bdf972f4d4d02aede'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const auctraRecoveryClientRef = (context: CreatorStudioContextV1) => `dsh:${hash(JSON.stringify([context.tenantRef, context.workspaceRef, context.projectRef, context.principalRef]))}`
const version = z.string().regex(/^(0|[1-9][0-9]{0,15}):(?:sha256:)?[a-f0-9]{64}$/u)
const summary = z.object({
  draft_ref: z.string().regex(/^erd-[a-f0-9]{32}$/u), project_ref: z.string().min(1).max(4096), client_ref: z.string().max(160),
  unit_ref: auctraWorkingCopyOpenRefSchema, base_version: version, revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  content_digest: z.string().regex(/^[a-f0-9]{64}$/u), content_length: z.number().int().min(0).max(2 * 1024 * 1024),
  created_at: z.string().datetime({ offset: true }), updated_at: z.string().datetime({ offset: true }),
}).strict()
const observed = summary.extend({ schema_version: z.literal('auctra.editor_recovery_draft.v1alpha1'), current_source_version: version, source_changed: z.boolean() }).strict()
const envelope = <T extends z.ZodType>(data: T) => z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'), data })
export interface AuctraRecoveryDraftSummary {
  readonly ref: string; readonly unitRef: string; readonly baseVersion: string; readonly revision: number
  readonly contentDigest: string; readonly byteLength: number; readonly updatedAt: string
}
export interface AuctraRecoveryDraftPage { readonly drafts: readonly AuctraRecoveryDraftSummary[]; readonly nextCursor?: string }
const safeSummary = (row: z.infer<typeof summary>): AuctraRecoveryDraftSummary => ({ ref: `auctra:editor-recovery:${hash(row.project_ref).slice(0, 32)}:${row.draft_ref}`,
  unitRef: row.unit_ref, baseVersion: row.base_version, revision: row.revision, contentDigest: row.content_digest, byteLength: row.content_length, updatedAt: row.updated_at })
export function normalizeAuctraRecoveryPage(body: unknown, scope: { ownerProjectRef: string; clientRef: string; unitRef?: string }): AuctraRecoveryDraftPage | undefined {
  const parsed = envelope(z.object({ schema_version: z.literal('auctra.editor_recovery_draft_page.v1alpha1'), drafts: z.array(summary).max(100), next_cursor: z.string().min(1).max(1024).optional() }).strict()).safeParse(body)
  if (!parsed.success) return undefined
  const page = parsed.data.data
  if (page.drafts.some(row => row.project_ref !== scope.ownerProjectRef || row.client_ref !== scope.clientRef || (scope.unitRef !== undefined && row.unit_ref !== scope.unitRef))
    || new Set(page.drafts.map(row => row.draft_ref)).size !== page.drafts.length) return undefined
  return { drafts: page.drafts.map(safeSummary), ...(page.next_cursor === undefined ? {} : { nextCursor: page.next_cursor }) }
}
export function normalizeAuctraRecoveryContent(body: unknown, scope: { ownerProjectRef: string; clientRef: string; claim: AuctraRecoveryDraftSummary }) {
  const parsed = envelope(z.object({ draft: observed, body: z.string().max(2 * 1024 * 1024) }).strict()).safeParse(body)
  if (!parsed.success) return undefined
  const { draft, body: content } = parsed.data.data
  const projected = safeSummary(draft)
  if (draft.project_ref !== scope.ownerProjectRef || draft.client_ref !== scope.clientRef || projected.ref !== scope.claim.ref
    || projected.unitRef !== scope.claim.unitRef || projected.baseVersion !== scope.claim.baseVersion || projected.revision !== scope.claim.revision
    || projected.contentDigest !== scope.claim.contentDigest || projected.byteLength !== scope.claim.byteLength
    || hash(content) !== draft.content_digest || new TextEncoder().encode(content).byteLength !== draft.content_length
    || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(new TextEncoder().encode(content)) !== content
    || draft.source_changed !== (draft.current_source_version !== draft.base_version)) return undefined
  return { draft: projected, content, currentSourceVersion: draft.current_source_version, sourceChanged: draft.source_changed }
}

export function normalizeAuctraRecoverySaved(body: unknown, scope: { ownerProjectRef: string; clientRef: string; unitRef: string; baseVersion: string; content: string; previous?: AuctraRecoveryDraftSummary }) {
  const parsed = envelope(z.object({ draft: observed }).strict()).safeParse(body)
  if (!parsed.success) return undefined
  const row = parsed.data.data.draft
  const safe = safeSummary(row)
  if (row.project_ref !== scope.ownerProjectRef || row.client_ref !== scope.clientRef || row.unit_ref !== scope.unitRef || row.base_version !== scope.baseVersion
    || row.content_digest !== hash(scope.content) || row.content_length !== new TextEncoder().encode(scope.content).byteLength
    || row.revision !== (scope.previous?.revision ?? 0) + 1 || (scope.previous !== undefined && safe.ref !== scope.previous.ref)
    || row.source_changed !== (row.current_source_version !== row.base_version)) return undefined
  return { draft: safe, currentSourceVersion: row.current_source_version, sourceChanged: row.source_changed }
}

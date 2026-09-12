import { z } from 'zod'
const text = z.string().max(512)
const ref = z.string().regex(/^eikona:\/\/[A-Za-z0-9._:/-]{1,480}$/u)
const asset = z.object({
  artifact_id: text.min(1), project_id: text.min(1), handle: text, uri: text,
  role: text.optional(), title: text.optional(), kind: text.optional(), created_at: text.optional(),
  run_id: text.optional(), run_uri: ref.optional(), review_uri: ref.optional(), artifact_uri: ref,
  mime_type: text.optional(), sha256: z.string().regex(/^(?:sha256:)?[a-f0-9]{64}$/u).transform(value => value.replace(/^sha256:/u, '')).optional(),
  width: z.number().int().positive().optional(), height: z.number().int().positive().optional(),
  resource_uris: z.array(ref).max(64).optional(),
}).strict()
const page = z.object({
  schema_version: z.literal('eikona.asset_graph.v1'), assets: z.array(asset).max(100), count: z.number().int().min(0).max(100),
  pagination: z.object({ limit: z.number().int().min(1).max(100), next_cursor: z.string().min(1).max(4096).optional() }).strict(),
}).strict()

/** Listing is metadata only; content access and adoption require separate owner operations. */
export function inspectEikonaAssetPage(input: unknown, expected: { ownerProjectRef: string; limit: number }) {
  const parsed = page.safeParse(input)
  if (!parsed.success) return { status: 'needs_contract' as const }
  const value = parsed.data
  if (!expected.ownerProjectRef || value.assets.some(item => item.project_id !== expected.ownerProjectRef)) return { status: 'permission_denied' as const }
  if (value.pagination.limit !== expected.limit || value.count !== value.assets.length || value.assets.length > expected.limit
    || new Set(value.assets.map(item => item.artifact_uri)).size !== value.assets.length) return { status: 'needs_contract' as const }
  return { status: 'ready' as const, items: value.assets.map(item => ({
    ref: item.artifact_uri, title: item.title || item.artifact_id,
    versionStatus: item.sha256 ? 'observed_digest' as const : 'unverified' as const,
    ...(item.sha256 ? { contentDigest: item.sha256 } : {}),
    ...(item.mime_type ? { mediaType: item.mime_type } : {}),
    ...(item.run_uri ? { sourceRunRef: item.run_uri } : {}),
  })), ...(value.pagination.next_cursor ? { nextCursor: value.pagination.next_cursor } : {}) }
}

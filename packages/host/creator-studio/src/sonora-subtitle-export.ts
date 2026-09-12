import { z } from 'zod'
import { createHash } from 'node:crypto'
import type { CreatorStudioContextV1 } from './types.ts'
import { sonoraTranscriptionCatalogSchema, type SonoraTranscriptionCatalog } from './sonora-transcription-catalog.ts'

const resourceRef = z.string().regex(/^sonora:\/\/subtitle-export\/[A-Za-z0-9][A-Za-z0-9._-]*$/u).max(512)
const trackRef = z.string().regex(/^sonora:\/\/subtitle-track\/[A-Za-z0-9][A-Za-z0-9._-]*$/u).max(512)
const digest = z.string().min(1).max(160).regex(/^[A-Za-z0-9:_-]+$/u)
const inputSchema = z.object({ track_ref: trackRef, track_digest: digest, review_digest: digest, format: z.enum(['srt', 'vtt']) }).strict()
const resourceSchema = z.object({
  schema: z.literal('sonora.subtitle_export.v1'), ref: resourceRef, track_ref: trackRef,
  track_digest: digest, review_digest: digest, format: z.enum(['srt', 'vtt']),
  media_type: z.enum(['application/x-subrip', 'text/vtt']), content_digest: z.string().regex(/^[a-f0-9]{64}$/u),
  size_bytes: z.number().int().positive().max(16 * 1024 * 1024), created_at: z.string().datetime({ offset: true }),
}).strict().refine(value => value.media_type === (value.format === 'vtt' ? 'text/vtt' : 'application/x-subrip'))

export type SonoraSubtitleExportInput = z.infer<typeof inputSchema>
export type SonoraSubtitleExportResource = z.infer<typeof resourceSchema>
type SonoraReadResult<T> =
  | { readonly status: 'ready'; readonly resource: T }
  | { readonly status: 'rejected' | 'unknown'; readonly reason: 'invalid_input' | 'unavailable' | 'permission_denied' | 'not_found' | 'conflict' | 'owner_rejected' | 'unconfirmed' }
export type SonoraSubtitleExportResult = SonoraReadResult<SonoraSubtitleExportResource>
const trackSchema = z.object({ ref: trackRef, track_digest: digest, review_digest: digest,
  readability_status: z.string().min(1).max(80), decision_code: z.string().min(1).max(80),
  cue_count: z.number().int().min(0).max(10_000), updated_at: z.string().datetime({ offset: true }),
})
export type SonoraSubtitleTrackPreview = z.infer<typeof trackSchema>

/** Host-only authorized connection. Never expose this object through Remote. */
export interface SonoraSubtitleConnection {
  readonly context: CreatorStudioContextV1
  readonly baseURL: string
  readonly headers: Readonly<Record<string, string>>
}

/** Consumes Sonora's public API; it owns no export ledger or retry policy. */
export class SonoraSubtitleExportClient {
  constructor(
    private readonly connection: (context: CreatorStudioContextV1) => Promise<SonoraSubtitleConnection | undefined>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async create(context: CreatorStudioContextV1, input: SonoraSubtitleExportInput, idempotencyKey: string): Promise<SonoraSubtitleExportResult> {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(idempotencyKey)) return { status: 'rejected', reason: 'invalid_input' }
    const result = await this.request(context, '/api/v1/subtitle-exports', { method: 'POST', body: JSON.stringify(parsed.data), key: idempotencyKey }, resourceSchema)
    if (result.status !== 'ready') return result
    const resource = result.resource
    return resource.track_ref === parsed.data.track_ref && resource.track_digest === parsed.data.track_digest && resource.review_digest === parsed.data.review_digest && resource.format === parsed.data.format
      ? result : { status: 'unknown', reason: 'unconfirmed' }
  }

  async read(context: CreatorStudioContextV1, ref: string): Promise<SonoraSubtitleExportResult> {
    if (!resourceRef.safeParse(ref).success) return { status: 'rejected', reason: 'invalid_input' }
    const result = await this.request(context, `/api/v1/subtitle-exports/${encodeURIComponent(ref.slice('sonora://subtitle-export/'.length))}`, { method: 'GET' }, resourceSchema)
    return result.status !== 'ready' || result.resource.ref === ref ? result : { status: 'unknown', reason: 'unconfirmed' }
  }

  /** Reconcile a lost creation response without replaying the POST. */
  async lookup(context: CreatorStudioContextV1, input: SonoraSubtitleExportInput, idempotencyKey: string): Promise<SonoraSubtitleExportResult> {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(idempotencyKey)) return { status: 'rejected', reason: 'invalid_input' }
    const result = await this.lookupOriginal(context, idempotencyKey)
    // Missing, stale or inaccessible receipts do not prove a prior POST failed.
    if (result.status !== 'ready') return { status: 'unknown', reason: result.reason }
    const resource = result.resource
    return resource.track_ref === parsed.data.track_ref && resource.track_digest === parsed.data.track_digest && resource.review_digest === parsed.data.review_digest && resource.format === parsed.data.format
      ? result : { status: 'unknown', reason: 'unconfirmed' }
  }

  async lookupOriginal(context: CreatorStudioContextV1, idempotencyKey: string): Promise<SonoraSubtitleExportResult> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(idempotencyKey)) return { status: 'unknown', reason: 'invalid_input' }
    const result = await this.request(context, '/api/v1/subtitle-exports/by-idempotency-key', { method: 'GET', key: idempotencyKey }, resourceSchema)
    return result.status === 'ready' ? result : { status: 'unknown', reason: result.reason }
  }

  async readTrack(context: CreatorStudioContextV1, ref: string): Promise<SonoraReadResult<SonoraSubtitleTrackPreview>> {
    if (!trackRef.safeParse(ref).success) return { status: 'rejected', reason: 'invalid_input' }
    // The existing owner endpoint includes cues. Strip them before projecting metadata.
    const result = await this.request(context, `/api/v1/subtitle-tracks/${encodeURIComponent(ref.slice('sonora://subtitle-track/'.length))}`, { method: 'GET' }, trackSchema, 16 * 1024 * 1024)
    return result.status !== 'ready' || result.resource.ref === ref ? result : { status: 'unknown', reason: 'unconfirmed' }
  }

  /** Capability evidence for the upstream transcription, never execution or pricing approval. */
  async readTranscriptionCatalog(context: CreatorStudioContextV1): Promise<SonoraReadResult<SonoraTranscriptionCatalog>> {
    return this.request(context, '/api/v1/transcription-providers', { method: 'GET' }, sonoraTranscriptionCatalogSchema, 256 * 1024)
  }

  /** Authorized fixed-version content; never include the returned text in projections. */
  async readContent(context: CreatorStudioContextV1, resource: SonoraSubtitleExportResource): Promise<string | undefined> {
    const parsed = resourceSchema.safeParse(resource)
    if (!parsed.success) return undefined
    const expected = parsed.data
    const result = await this.request(context, `/api/v1/subtitle-exports/${encodeURIComponent(expected.ref.slice('sonora://subtitle-export/'.length))}/content`,
      { method: 'GET', accept: expected.media_type }, z.string(), expected.size_bytes, bytes => {
        if (bytes.byteLength !== expected.size_bytes || createHash('sha256').update(bytes).digest('hex') !== expected.content_digest) throw new Error('subtitle_integrity_mismatch')
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      })
    return result.status === 'ready' ? result.resource : undefined
  }

  private async request<T>(context: CreatorStudioContextV1, path: string, input: { method: 'GET' | 'POST'; body?: string; key?: string; accept?: string }, schema: z.ZodType<T>, maxBytes = 16_384,
    decode: (bytes: Uint8Array) => unknown = bytes => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))): Promise<SonoraReadResult<T>> {
    // Freeze the scope before asynchronous credential resolution.
    const scope = { ...context }
    try {
      const binding = await this.connection(scope)
      if (binding === undefined) return { status: 'rejected', reason: 'unavailable' }
      const keys = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const
      if (keys.some(key => binding.context[key] !== scope[key]) || scope.projectRef === undefined) return { status: 'rejected', reason: 'permission_denied' }
      const url = new URL(binding.baseURL)
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['https:', 'http:'].includes(url.protocol)) return { status: 'rejected', reason: 'unavailable' }
      if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return { status: 'rejected', reason: 'unavailable' }
      const headers = new Headers(binding.headers)
      headers.set('Accept', input.accept ?? 'application/json')
      if (input.key !== undefined) headers.set('Idempotency-Key', input.key)
      if (input.body !== undefined) headers.set('Content-Type', 'application/json')
      const response = await this.fetcher(new URL(path, url), { method: input.method, headers, ...(input.body === undefined ? {} : { body: input.body }), redirect: 'error', signal: AbortSignal.timeout(15_000) })
      if (response.status !== (input.method === 'POST' ? 201 : 200)) {
        await response.body?.cancel()
        if (response.status === 401 || response.status === 403) return { status: 'rejected', reason: 'permission_denied' }
        if (response.status === 404) return { status: 'rejected', reason: 'not_found' }
        if (response.status === 409) return { status: 'rejected', reason: 'conflict' }
        if (response.status === 400 || response.status === 422) return { status: 'rejected', reason: 'owner_rejected' }
        return { status: 'unknown', reason: 'unconfirmed' }
      }
      if (input.accept !== undefined && response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== input.accept) {
        await response.body?.cancel()
        return { status: 'unknown', reason: 'unconfirmed' }
      }
      // Bound the response even when a server ignores Content-Length.
      const reader = response.body?.getReader()
      if (reader === undefined) return { status: 'unknown', reason: 'unconfirmed' }
      let size = 0
      const chunks: Uint8Array[] = []
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > maxBytes) { await reader.cancel(); return { status: 'unknown', reason: 'unconfirmed' } }
          chunks.push(value)
        }
      } finally { reader.releaseLock() }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      const parsed = schema.safeParse(decode(bytes))
      return parsed.success ? { status: 'ready', resource: parsed.data } : { status: 'unknown', reason: 'unconfirmed' }
    } catch {
      // A failed POST observation cannot prove the owner did not persist it.
      return { status: 'unknown', reason: 'unconfirmed' }
    }
  }
}

/**
 * Sonora 试听消费（dsh-sonora-audio-studio-v1 §2.4）：owner 授权 rendition
 * （`POST /api/v1/artifacts/{id}/access-grants` → `GET /api/v1/artifact-access/{grant}`）
 * 与 audio job/asset 只读。固定版本 = grant 绑定的 artifact digest 必须与
 * 请求的 artifact.version 一致，不一致即禁用播放（不回退、不取 raw URL）。
 * 不做本地转码；媒体字节只经既有媒体 renderer 的授权 URL 播放。
 * capability token / access_token 永不进入 snapshot、日志或 Remote 投影。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import type { CreatorStudioContextV1 } from './types.ts'

const identifier = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)
const digest = z.string().min(1).max(160).regex(/^[A-Za-z0-9:_-]+$/u)
const resourceRef = z.string().min(1).max(512).startsWith('sonora://')
const timestamp = z.string().datetime({ offset: true })

const assetRef = z.string().regex(/^sonora:\/\/audio-asset\/[A-Za-z0-9][A-Za-z0-9._-]*$/u).max(512)

/** owner AudioJobResponse 的安全子集（GET /api/v1/audio-jobs/{id}）。 */
export const sonoraAudioJobSchema = z.object({
  job_id: identifier,
  state: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled', 'pending_review', 'handoff_ready']),
  voice_plan_ref: resourceRef,
  provider_id: identifier,
  output_asset_refs: z.array(assetRef).max(64).optional(),
  review_packet_ref: resourceRef.optional(),
  updated_at: timestamp,
}).strict()
export type SonoraAudioJob = z.infer<typeof sonoraAudioJobSchema>

/** owner AssetResponse 的安全子集（GET /api/v1/assets/{id}）。 */
export const sonoraAudioAssetSchema = z.object({
  asset_ref: assetRef,
  role: z.string().min(1).max(64),
  media_format: z.string().min(1).max(64),
  digest,
  duration_ms: z.number().int().nonnegative().optional(),
  permission: z.string().min(1).max(64),
  review_status: z.string().min(1).max(64),
}).strict()
export type SonoraAudioAsset = z.infer<typeof sonoraAudioAssetSchema>

/** owner ArtifactAccessGrant 投影（POST access-grants 响应）。只保留授权播放所需字段。 */
export const sonoraArtifactAccessGrantSchema = z.object({
  grant_ref: resourceRef,
  artifact_ref: assetRef,
  artifact_digest: digest,
  content_policy: z.string().min(1).max(120),
  authorized_url: z.string().url().max(2048),
  issued_at: timestamp,
  expires_at: timestamp,
}).strict()
export type SonoraArtifactAccessGrant = z.infer<typeof sonoraArtifactAccessGrantSchema>

export type SonoraAuditionResult<T> =
  | { readonly status: 'ready'; readonly resource: T }
  | { readonly status: 'rejected' | 'unknown'; readonly reason: 'invalid_input' | 'unavailable' | 'permission_denied' | 'not_found' | 'conflict' | 'owner_rejected' | 'unconfirmed' }

/** Host-only authorized connection（与字幕导出客户端同一连接语义）。 */
export interface SonoraAuditionConnection {
  readonly baseURL: string
  readonly headers: Readonly<Record<string, string>>
  readonly context: CreatorStudioContextV1
}

const CONTEXT_KEYS = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const

/** owner 产物/job 读取与授权 rendition 签发；不缓存 token，不拥有下载状态。 */
export class SonoraAuditionClient {
  constructor(
    private readonly connection: (context: CreatorStudioContextV1) => Promise<SonoraAuditionConnection | undefined>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  /** 读取一个 audio job 的安全投影（输出 asset refs 是试听候选来源）。 */
  async readJob(context: CreatorStudioContextV1, jobId: string): Promise<SonoraAuditionResult<SonoraAudioJob>> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/u.test(jobId)) return { status: 'rejected', reason: 'invalid_input' }
    return this.request(context, `/api/v1/audio-jobs/${encodeURIComponent(jobId)}`, 'GET', sonoraAudioJobSchema)
  }

  /** 读取一个 audio asset 的安全投影（digest/时长/权限/审阅状态）。 */
  async readAsset(context: CreatorStudioContextV1, assetId: string): Promise<SonoraAuditionResult<SonoraAudioAsset>> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/u.test(assetId)) return { status: 'rejected', reason: 'invalid_input' }
    return this.request(context, `/api/v1/assets/${encodeURIComponent(assetId)}`, 'GET', sonoraAudioAssetSchema)
  }

  /**
   * 为固定版本 asset 签发 owner 授权 rendition。返回的 grant 只用于构造
   * 浏览器媒体访问 {url, expiresAt}；digest 与调用方持有的版本不一致时
   * 视为不可用（undefined），保持播放禁用而不是播放别的版本。
   */
  async issueGrant(context: CreatorStudioContextV1, artifactId: string): Promise<SonoraAuditionResult<SonoraArtifactAccessGrant>> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/u.test(artifactId)) return { status: 'rejected', reason: 'invalid_input' }
    return this.request(context, `/api/v1/artifacts/${encodeURIComponent(artifactId)}/access-grants`, 'POST', sonoraArtifactAccessGrantSchema, '{}')
  }

  private async request<T>(context: CreatorStudioContextV1, path: string, method: 'GET' | 'POST', schema: z.ZodType<T>, body?: string): Promise<SonoraAuditionResult<T>> {
    // Freeze the scope before asynchronous credential resolution.
    const scope = { ...context }
    try {
      const binding = await this.connection(scope)
      if (binding === undefined) return { status: 'rejected', reason: 'unavailable' }
      if (CONTEXT_KEYS.some(key => binding.context[key] !== scope[key]) || scope.projectRef === undefined) return { status: 'rejected', reason: 'permission_denied' }
      const url = new URL(binding.baseURL)
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['https:', 'http:'].includes(url.protocol)) return { status: 'rejected', reason: 'unavailable' }
      if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return { status: 'rejected', reason: 'unavailable' }
      const headers = new Headers(binding.headers)
      headers.set('Accept', 'application/json')
      if (body !== undefined) headers.set('Content-Type', 'application/json')
      const response = await this.fetcher(new URL(path, url), { method, headers, ...(body === undefined ? {} : { body }), redirect: 'error', signal: AbortSignal.timeout(15_000) })
      if (response.status !== (method === 'POST' ? 201 : 200)) {
        await response.body?.cancel().catch(() => {})
        if (response.status === 401 || response.status === 403) return { status: 'rejected', reason: 'permission_denied' }
        if (response.status === 404) return { status: 'rejected', reason: 'not_found' }
        if (response.status === 409) return { status: 'rejected', reason: 'conflict' }
        if (response.status === 400 || response.status === 422) return { status: 'rejected', reason: 'owner_rejected' }
        return { status: 'unknown', reason: 'unconfirmed' }
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength > 64 * 1024) return { status: 'unknown', reason: 'unconfirmed' }
      const parsed = schema.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
      return parsed.success ? { status: 'ready', resource: parsed.data } : { status: 'unknown', reason: 'unconfirmed' }
    } catch {
      return { status: 'unknown', reason: 'unconfirmed' }
    }
  }
}

/** owner media_format（如 wav/mp3）映射为浏览器 media type；未知格式保持原样由 renderer 判定。 */
export function sonoraAudioMediaType(format: string): string {
  const normalized = format.toLowerCase().split('.')[0] ?? format
  return normalized === 'wav' ? 'audio/wav'
    : normalized === 'mp3' ? 'audio/mpeg'
    : normalized === 'ogg' ? 'audio/ogg'
    : normalized === 'flac' ? 'audio/flac'
    : normalized === 'webm' ? 'audio/webm'
    : `audio/${normalized}`
}

export function validateSonoraAudioJob(value: unknown): SonoraAudioJob | undefined {
  const parsed = sonoraAudioJobSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export function validateSonoraAudioAsset(value: unknown): SonoraAudioAsset | undefined {
  const parsed = sonoraAudioAssetSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export function validateSonoraArtifactAccessGrant(value: unknown): SonoraArtifactAccessGrant | undefined {
  const parsed = sonoraArtifactAccessGrantSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

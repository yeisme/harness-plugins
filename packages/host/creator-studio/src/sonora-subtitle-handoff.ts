/**
 * Sonora 字幕交接消费（dsh-sonora-audio-studio-v1 §2.5）：owner
 * `POST /api/v1/subtitle-handoffs` / `GET /api/v1/subtitle-handoffs/{id}`。
 *
 * 交接三件事分别取得：owner receipt（handoff 持久资源）、版本
 * （track_digest，与本地读取的 track 校验）、目标 scope（consumer）。
 * handoff_ready=false 不是传输失败：保留 refs/blockers；production_acceptance
 * 固定 pending，不因导出/交接成功而改写。幂等：同 key 同请求重放返回原
 * handoff（replay=true），不同 digest 冲突。stale review 拒绝不静默接受。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import type { CreatorStudioContextV1 } from './types.ts'

const identifier = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)
const digest = z.string().min(1).max(160).regex(/^[A-Za-z0-9:_-]+$/u)
const resourceRef = z.string().min(1).max(512).startsWith('sonora://')
const trackRef = z.string().regex(/^sonora:\/\/subtitle-track\/[A-Za-z0-9][A-Za-z0-9._-]*$/u).max(512)
const handoffRef = z.string().regex(/^sonora:\/\/subtitle-handoff\/[A-Za-z0-9][A-Za-z0-9._-]*$/u).max(512)
const timestamp = z.string().datetime({ offset: true })
const codeList = z.array(z.string().min(1).max(200)).max(32)

export const sonoraSubtitleHandoffSchema = z.object({
  ref: handoffRef,
  track_ref: trackRef,
  source_transcription_ref: resourceRef,
  review_packet_ref: resourceRef,
  request_digest: digest,
  track_digest: digest,
  review_digest: digest,
  locale: identifier,
  cue_count: z.number().int().min(0).max(100_000),
  consumer: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/u),
  handoff_ready: z.boolean(),
  // owner 合同固定 pending：出现其它值即 fail-closed 拒绝整个投影。
  production_acceptance: z.literal('pending'),
  blockers: codeList.optional(),
  warnings: codeList.optional(),
  evidence_refs: z.array(resourceRef).max(64).optional(),
  replay: z.boolean().optional(),
  created_at: timestamp,
  updated_at: timestamp,
}).strict()
export type SonoraSubtitleHandoff = z.infer<typeof sonoraSubtitleHandoffSchema>

export interface SonoraSubtitleHandoffInput {
  readonly track_ref: string
  readonly consumer: string
}

export type SonoraSubtitleHandoffResult =
  | { readonly status: 'ready'; readonly resource: SonoraSubtitleHandoff }
  | { readonly status: 'rejected' | 'unknown'; readonly reason: 'invalid_input' | 'unavailable' | 'permission_denied' | 'not_found' | 'conflict' | 'owner_rejected' | 'unconfirmed' }

/** Host-only authorized connection（与字幕导出客户端同一连接语义）。 */
export interface SonoraSubtitleHandoffConnection {
  readonly baseURL: string
  readonly headers: Readonly<Record<string, string>>
  readonly context: CreatorStudioContextV1
}

const CONTEXT_KEYS = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const

export function validateSonoraSubtitleHandoff(value: unknown): SonoraSubtitleHandoff | undefined {
  const parsed = sonoraSubtitleHandoffSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

/** 消费 owner 交接合同；不拥有交接台账、不推断 handoff_ready/production acceptance。 */
export class SonoraSubtitleHandoffClient {
  constructor(
    private readonly connection: (context: CreatorStudioContextV1) => Promise<SonoraSubtitleHandoffConnection | undefined>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  /** 创建（或幂等重放）一个固定 track/consumer 的字幕交接。 */
  async create(context: CreatorStudioContextV1, input: SonoraSubtitleHandoffInput, idempotencyKey: string): Promise<SonoraSubtitleHandoffResult> {
    const parsedInput = z.object({ track_ref: trackRef, consumer: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/u) }).strict().safeParse(input)
    if (!parsedInput.success || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(idempotencyKey)) return { status: 'rejected', reason: 'invalid_input' }
    const result = await this.request(context, '/api/v1/subtitle-handoffs', 'POST', sonoraSubtitleHandoffSchema, JSON.stringify(parsedInput.data), idempotencyKey)
    if (result.status !== 'ready') return result
    const handoff = result.resource
    return handoff.track_ref === parsedInput.data.track_ref && handoff.consumer === parsedInput.data.consumer ? result : { status: 'unknown', reason: 'unconfirmed' }
  }

  /** 按 ref 读取原 handoff（receipt 对账观察，不产生副作用）。 */
  async read(context: CreatorStudioContextV1, ref: string): Promise<SonoraSubtitleHandoffResult> {
    if (!handoffRef.safeParse(ref).success) return { status: 'rejected', reason: 'invalid_input' }
    const result = await this.request(context, `/api/v1/subtitle-handoffs/${encodeURIComponent(ref.slice('sonora://subtitle-handoff/'.length))}`, 'GET', sonoraSubtitleHandoffSchema)
    return result.status === 'ready' && result.resource.ref !== ref ? { status: 'unknown', reason: 'unconfirmed' } : result
  }

  private async request<T>(context: CreatorStudioContextV1, path: string, method: 'GET' | 'POST', schema: z.ZodType<T>, body?: string, key?: string): Promise<{ status: 'ready'; resource: T } | { status: 'rejected' | 'unknown'; reason: 'invalid_input' | 'unavailable' | 'permission_denied' | 'not_found' | 'conflict' | 'owner_rejected' | 'unconfirmed' }> {
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
      if (key !== undefined) headers.set('Idempotency-Key', key)
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
      if (bytes.byteLength > 128 * 1024) return { status: 'unknown', reason: 'unconfirmed' }
      const parsed = schema.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
      return parsed.success ? { status: 'ready', resource: parsed.data } : { status: 'unknown', reason: 'unconfirmed' }
    } catch {
      // A failed POST observation cannot prove the owner did not persist it.
      return { status: 'unknown', reason: 'unconfirmed' }
    }
  }
}

/**
 * Sonora 声音工作列表 adapter（dsh-sonora-audio-studio-v1 §2.1）：消费 owner
 * `GET /api/v1/workspace-projections/table`（sonora.audio_workspace_projection.v1
 * 的 table 形态）。分页走 owner 签发的 page cursor；freshness/fallback 原样
 * 投影（fresh|stale|expired|denied / read_only|deep_link|refresh_required|
 * unavailable），缺列空值保持 null，不在客户端伪造行、合并过期 row 或编造
 * 分页。列宽/行数有界；未授权/未连接/超限一律诚实降级，不抛进会话。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import type { CreatorStudioContextV1 } from './types.ts'

const digest = z.string().min(1).max(160).regex(/^[A-Za-z0-9:_-]+$/u)
const pageCursor = z.string().min(1).max(200).regex(/^sonora\.audio_workspace\.table\.page\.[A-Za-z0-9._:-]{1,160}$/u)
const cellValue = z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])
const columnKey = z.string().min(1).max(120)

/** 表格 projection 的行：owner-authored cells + 行级 revision + 可选资源 ref。 */
const rowSchema = z.object({
  row_ref: z.string().min(1).max(512).startsWith('sonora://workspace-row/'),
  revision: digest,
  cells: z.record(z.string(), cellValue),
  resource_ref: z.string().min(1).max(512).optional(),
}).strict()

const envelopeSchema = z.object({
  schema: z.literal('sonora.audio_workspace_projection.v1'),
  projection_id: z.string().min(1).max(512).startsWith('sonora://workspace-projection/'),
  kind: z.literal('table'),
  source: z.object({ ref: z.string().min(1).max(512), type: z.string().min(1).max(120), revision: digest, digest: digest }).strict(),
  freshness: z.enum(['fresh', 'stale', 'expired', 'denied']),
  fallback: z.enum(['read_only', 'deep_link', 'refresh_required', 'unavailable']),
  columns: z.array(z.object({ key: columnKey, label: z.string().min(1).max(200) }).strict()).min(1).max(64),
  rows: z.array(rowSchema).max(500),
  next_cursor: pageCursor.optional(),
  generated_at: z.string().datetime({ offset: true }),
}).strict().superRefine((value, ctx) => {
  const keys = new Set(value.columns.map(column => column.key))
  if (keys.size !== value.columns.length) ctx.addIssue({ code: 'custom', message: 'duplicate column keys' })
  for (const row of value.rows) {
    for (const key of Object.keys(row.cells)) {
      if (!keys.has(key)) ctx.addIssue({ code: 'custom', message: `row cell references unknown column: ${key}` })
    }
  }
})

export type SonoraWorksTableRow = z.infer<typeof rowSchema>
export type SonoraWorksTable = z.infer<typeof envelopeSchema>

export type SonoraWorksTableResult =
  | { readonly status: 'ready'; readonly resource: SonoraWorksTable }
  | { readonly status: 'rejected' | 'unknown'; readonly reason: 'invalid_input' | 'unavailable' | 'permission_denied' | 'not_found' | 'owner_rejected' | 'unconfirmed' }

/** Host-only authorized connection（与字幕导出客户端同一连接语义）。 */
export interface SonoraWorksConnection {
  readonly baseURL: string
  readonly headers: Readonly<Record<string, string>>
  readonly context: CreatorStudioContextV1
}

const CONTEXT_KEYS = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const

export function validateSonoraWorksTable(value: unknown): SonoraWorksTable | undefined {
  const parsed = envelopeSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export class SonoraWorksTableClient {
  constructor(
    private readonly connection: (context: CreatorStudioContextV1) => Promise<SonoraWorksConnection | undefined>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  /** 读一页声音工作列表；cursor 缺省读第一页。project scope 由连接绑定校验。 */
  async read(context: CreatorStudioContextV1, cursor?: string): Promise<SonoraWorksTableResult> {
    if (cursor !== undefined && !pageCursor.safeParse(cursor).success) return { status: 'rejected', reason: 'invalid_input' }
    const scope = { ...context }
    let binding: SonoraWorksConnection | undefined
    try {
      binding = await this.connection(scope)
    } catch {
      return { status: 'rejected', reason: 'unavailable' }
    }
    if (binding === undefined) return { status: 'rejected', reason: 'unavailable' }
    if (CONTEXT_KEYS.some(key => binding.context[key] !== scope[key]) || scope.projectRef === undefined) return { status: 'rejected', reason: 'permission_denied' }
    const url = new URL(binding.baseURL)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['https:', 'http:'].includes(url.protocol)) return { status: 'rejected', reason: 'unavailable' }
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return { status: 'rejected', reason: 'unavailable' }
    const path = new URL('/api/v1/workspace-projections/table', url)
    if (cursor !== undefined) path.searchParams.set('page_cursor', cursor)
    const headers = new Headers(binding.headers)
    headers.set('Accept', 'application/json')
    let response: Response
    try {
      response = await this.fetcher(path, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(15_000) })
    } catch {
      return { status: 'unknown', reason: 'unconfirmed' }
    }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => {})
      if (response.status === 401 || response.status === 403) return { status: 'rejected', reason: 'permission_denied' }
      if (response.status === 404) return { status: 'rejected', reason: 'not_found' }
      if (response.status === 400 || response.status === 422) return { status: 'rejected', reason: 'owner_rejected' }
      return { status: 'unknown', reason: 'unconfirmed' }
    }
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await response.arrayBuffer())
    } catch {
      return { status: 'unknown', reason: 'unconfirmed' }
    }
    // 1 MiB 上限：分页表格投影超出即诚实拒绝，不膨胀内存。
    if (bytes.byteLength > 1024 * 1024) return { status: 'unknown', reason: 'unconfirmed' }
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch {
      return { status: 'unknown', reason: 'unconfirmed' }
    }
    const parsed = envelopeSchema.safeParse(parsedJson)
    return parsed.success ? { status: 'ready', resource: parsed.data } : { status: 'unknown', reason: 'unconfirmed' }
  }
}

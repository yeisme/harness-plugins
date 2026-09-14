/**
 * Sonora 声音工作列表 adapter（dsh-sonora-audio-studio-v1 §2.1）：消费 owner
 * `GET /api/v1/workspace-projections/table`（sonora.audio_workspace_projection.v1
 * 的 table 形态）。分页走 owner 签发的 data.page_cursor；freshness/fallback
 * 原样投影（fresh|stale|expired|denied / read_only|deep_link|refresh_required|
 * unavailable），缺失 cell 值保持缺省（owner 可对 unknown 值省略 value），
 * 不在客户端伪造行、合并过期 row 或编造分页。列/行有界（owner 单页 ≤100）；
 * 未授权/未连接/超限一律诚实降级，不抛进会话。
 *
 * 2026-09-14 wire 对齐：envelope 从早期自拟形状（schema/kind/扁平枚举/
 * columns[].key/cells record/next_cursor）改为 owner live wire
 * （spec_version/projection_kind/嵌套 freshness+fallback/data.columns[].column_id/
 * cells 数组/data.page_cursor），与 sdk/go/sonora/workspace_projections_gen.go
 * 及归档 OpenAPI 同形；此前差异只经合成 fixture 验证，未对真实服务生效。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import type { CreatorStudioContextV1 } from './types.ts'
import { sonoraWorkspaceEnvelopeSchema } from './sonora-workspace.ts'

const digest = z.string().min(1).max(160).regex(/^[A-Za-z0-9:_-]+$/u)
const identifier = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
// owner table 分页游标形如 page_<n>（services/workspace Table()）。
const pageCursor = z.string().min(1).max(200).regex(/^page_[0-9]{1,18}$/u)
const cellValue = z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])

/** 表格 projection 的行：owner-authored cells（数组形，含 per-cell state）+ 行级 revision。 */
const rowSchema = z.object({
  row_ref: z.string().min(1).max(512).startsWith('sonora://'),
  revision: digest,
  cells: z.array(z.object({ column_id: identifier, value: cellValue.optional(), state: z.string().min(1).max(64) }).strict()).max(64),
}).strict()

const envelopeSchema = sonoraWorkspaceEnvelopeSchema.extend({
  projection_kind: z.literal('table'),
  data: z.object({
    columns: z.array(z.object({ column_id: identifier, label: z.string().min(1).max(200), kind: z.string().min(1).max(64) }).strict()).min(1).max(64),
    rows: z.array(rowSchema).max(500),
    page_cursor: pageCursor.optional(),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  const keys = new Set(value.data.columns.map(column => column.column_id))
  if (keys.size !== value.data.columns.length) ctx.addIssue({ code: 'custom', message: 'duplicate column ids' })
  for (const row of value.data.rows) {
    for (const cell of row.cells) {
      if (!keys.has(cell.column_id)) ctx.addIssue({ code: 'custom', message: `row cell references unknown column: ${cell.column_id}` })
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

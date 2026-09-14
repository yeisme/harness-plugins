/**
 * Sonora workspace projection + server-authored action client
 * (dsh-sonora-audio-studio-v1 §2.3)：消费 owner live wire
 * `sonora.audio_workspace_projection.v1`（internal/workspace ProjectionEnvelope，
 * spec_version/projection_kind 嵌套 freshness/fallback）与
 * `POST /api/v1/workspace-actions` / `GET /api/v1/workspace-action-receipts/{id}`。
 *
 * wire 以 owner 合同为唯一真源（sdk/go/sonora/workspace_projections_gen.go 与
 * 归档 OpenAPI 同形）；本模块不发明第二 envelope。descriptor 只读投影：
 * permission/availability/blockers/confirmation 原样保留，缺失费用不合成零。
 * 取消语义以 owner receipt outcome 为准；lost response 的对账走同 key 幂等
 * 回放（owner 合同：same key+digest 返回原 receipt，不产生第二次副作用），
 * 仅由显式 reconcile 路径触发，不做自动重试。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import type { CreatorStudioContextV1 } from './types.ts'

const identifier = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
const digest = z.string().min(1).max(160).regex(/^[A-Za-z0-9:_-]+$/u)
const resourceRef = z.string().min(1).max(512).startsWith('sonora://')
const timestamp = z.string().datetime({ offset: true })

/** owner `WorkspaceActionDescriptor`（server-authored，含权限与确认语义）。 */
export const sonoraWorkspaceActionDescriptorSchema = z.object({
  action_id: identifier,
  action_type: identifier,
  target_ref: resourceRef,
  permission: z.object({
    snapshot_ref: resourceRef.optional(),
    required_scopes: z.array(identifier).max(16).optional(),
    state: z.string().min(1).max(64),
    expires_at: timestamp.optional(),
  }).strict(),
  expected_revision: digest,
  input_schema_ref: resourceRef,
  idempotency: z.object({ required: z.boolean(), key_scope: z.string().min(1).max(160) }).strict(),
  confirmation: z.object({ required: z.boolean(), reason_code: z.string().min(1).max(160).optional() }).strict(),
  availability: z.enum(['enabled', 'blocked', 'read_only']),
  blockers: z.array(z.string().min(1).max(200)).max(16).optional(),
}).strict()
export type SonoraWorkspaceActionDescriptor = z.infer<typeof sonoraWorkspaceActionDescriptorSchema>

/** 四类 projection 共享 envelope（live wire：嵌套 freshness/fallback + actions）。 */
export const sonoraWorkspaceEnvelopeSchema = z.object({
  spec_version: z.literal('sonora.audio_workspace_projection.v1'),
  projection_kind: z.enum(['waveform', 'chart', 'board', 'table']),
  projection_ref: resourceRef,
  source: z.object({ resource_ref: resourceRef, resource_type: z.string().min(1).max(120), revision: digest, digest: digest }).strict(),
  generated_at: timestamp,
  freshness: z.object({
    state: z.enum(['fresh', 'stale', 'expired', 'denied']),
    observed_at: timestamp,
    expires_at: timestamp,
    reason_code: z.string().min(1).max(160).optional(),
  }).strict(),
  actions: z.array(sonoraWorkspaceActionDescriptorSchema).max(64),
  fallback: z.object({
    mode: z.enum(['read_only', 'deep_link', 'refresh_required', 'unavailable']),
    reason_code: z.string().min(1).max(160),
    deep_link: z.string().max(512).optional(),
    safe_summary: z.string().max(2000).optional(),
  }).strict(),
}).strict()
export type SonoraWorkspaceEnvelope = z.infer<typeof sonoraWorkspaceEnvelopeSchema>

/** board data：lane/card 投影（含 blockers 与 action ids）。 */
export const sonoraWorkspaceBoardSchema = sonoraWorkspaceEnvelopeSchema.extend({
  projection_kind: z.literal('board'),
  data: z.object({
    lanes: z.array(z.object({
      lane_id: identifier,
      title: z.string().min(1).max(200),
      cards: z.array(z.object({
        card_ref: resourceRef,
        resource_ref: resourceRef,
        revision: digest,
        title: z.string().min(1).max(200),
        summary: z.string().max(2000).optional(),
        blockers: z.array(z.string().min(1).max(200)).max(16).optional(),
        action_ids: z.array(identifier).max(16).optional(),
      }).strict()).max(200),
    }).strict()).max(32),
  }).strict(),
}).strict()
export type SonoraWorkspaceBoard = z.infer<typeof sonoraWorkspaceBoardSchema>

/** owner `WorkspaceActionReceipt`。 */
export const sonoraWorkspaceActionReceiptSchema = z.object({
  spec_version: z.literal('sonora.audio_workspace_action_receipt.v1'),
  receipt_ref: resourceRef,
  action_id: identifier,
  action_type: identifier,
  target_ref: resourceRef,
  outcome: z.enum(['pending', 'accepted', 'rejected']),
  target_revision: digest.optional(),
  findings: z.array(z.string().min(1).max(200)).max(32).optional(),
  event_cursor: z.string().min(1).max(160).optional(),
  retry_classification: z.enum(['terminal', 'retryable']),
}).strict()
export type SonoraWorkspaceActionReceipt = z.infer<typeof sonoraWorkspaceActionReceiptSchema>

export interface SonoraWorkspaceActionInput {
  readonly action_id: string
  readonly target_ref: string
  readonly expected_revision: string
  readonly input?: Readonly<Record<string, unknown>>
}

export type SonoraWorkspaceResult<T> =
  | { readonly status: 'ready'; readonly resource: T }
  | { readonly status: 'rejected' | 'unknown'; readonly reason: 'invalid_input' | 'unavailable' | 'permission_denied' | 'not_found' | 'conflict' | 'owner_rejected' | 'unconfirmed' }

/** Host-only authorized connection（与字幕导出客户端同一连接语义）。 */
export interface SonoraWorkspaceConnection {
  readonly baseURL: string
  readonly headers: Readonly<Record<string, string>>
  readonly context: CreatorStudioContextV1
}

const CONTEXT_KEYS = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const

export function validateSonoraWorkspaceBoard(value: unknown): SonoraWorkspaceBoard | undefined {
  const parsed = sonoraWorkspaceBoardSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export function validateSonoraWorkspaceActionReceipt(value: unknown): SonoraWorkspaceActionReceipt | undefined {
  const parsed = sonoraWorkspaceActionReceiptSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

/** 消费 owner 投影/动作合同；不拥有动作台账或重试策略。 */
export class SonoraWorkspaceClient {
  constructor(
    private readonly connection: (context: CreatorStudioContextV1) => Promise<SonoraWorkspaceConnection | undefined>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  /** 读取一个 audio job 的 board 投影（server-authored action descriptors 来源）。 */
  async readBoard(context: CreatorStudioContextV1, jobId: string): Promise<SonoraWorkspaceResult<SonoraWorkspaceBoard>> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/u.test(jobId)) return { status: 'rejected', reason: 'invalid_input' }
    return this.request(context, `/api/v1/workspace-projections/board/${encodeURIComponent(jobId)}`, { method: 'GET' }, sonoraWorkspaceBoardSchema)
  }

  /** 提交 owner 已签发的 workspace action；confirmed 必须由 owner descriptor 要求。 */
  async submitAction(context: CreatorStudioContextV1, input: SonoraWorkspaceActionInput, idempotencyKey: string): Promise<SonoraWorkspaceResult<SonoraWorkspaceActionReceipt>> {
    const body = {
      action_id: input.action_id,
      target_ref: input.target_ref,
      expected_revision: input.expected_revision,
      idempotency_key: idempotencyKey,
      confirmed: true,
      ...(input.input === undefined ? {} : { input: input.input }),
    }
    const result = await this.request(context, '/api/v1/workspace-actions', { method: 'POST', body: JSON.stringify(body), key: idempotencyKey }, sonoraWorkspaceActionReceiptSchema)
    if (result.status !== 'ready') return result
    // 回执必须绑定请求的动作与目标，否则视为未确认而不是成功。
    const receipt = result.resource
    return receipt.action_id === input.action_id && receipt.target_ref === input.target_ref ? result : { status: 'unknown', reason: 'unconfirmed' }
  }

  /** 按 owner receipt ref 读取原回执（对账观察，不产生副作用）。 */
  async readReceipt(context: CreatorStudioContextV1, receiptId: string): Promise<SonoraWorkspaceResult<SonoraWorkspaceActionReceipt>> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/u.test(receiptId)) return { status: 'rejected', reason: 'invalid_input' }
    return this.request(context, `/api/v1/workspace-action-receipts/${encodeURIComponent(receiptId)}`, { method: 'GET' }, sonoraWorkspaceActionReceiptSchema)
  }

  private async request<T>(context: CreatorStudioContextV1, path: string, input: { method: 'GET' | 'POST'; body?: string; key?: string }, schema: z.ZodType<T>, maxBytes = 512 * 1024): Promise<SonoraWorkspaceResult<T>> {
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
      if (input.key !== undefined) headers.set('Idempotency-Key', input.key)
      if (input.body !== undefined) headers.set('Content-Type', 'application/json')
      const response = await this.fetcher(new URL(path, url), { method: input.method, headers, ...(input.body === undefined ? {} : { body: input.body }), redirect: 'error', signal: AbortSignal.timeout(15_000) })
      if (response.status !== (input.method === 'POST' ? 201 : 200)) {
        await response.body?.cancel().catch(() => {})
        if (response.status === 401 || response.status === 403) return { status: 'rejected', reason: 'permission_denied' }
        if (response.status === 404) return { status: 'rejected', reason: 'not_found' }
        if (response.status === 409) return { status: 'rejected', reason: 'conflict' }
        if (response.status === 400 || response.status === 422) return { status: 'rejected', reason: 'owner_rejected' }
        return { status: 'unknown', reason: 'unconfirmed' }
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      // Bound the response even when a server ignores Content-Length.
      if (bytes.byteLength > maxBytes) return { status: 'unknown', reason: 'unconfirmed' }
      const parsed = schema.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
      return parsed.success ? { status: 'ready', resource: parsed.data } : { status: 'unknown', reason: 'unconfirmed' }
    } catch {
      // A failed POST observation cannot prove the owner did not persist it.
      return { status: 'unknown', reason: 'unconfirmed' }
    }
  }
}

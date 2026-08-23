/**
 * Domain Pane 的 action gateway。
 *
 * 不变量（对应各 change 的 "Mutation SHALL 仅使用 owner-authored actions"）：
 * 1. 只接受 server-authored PaneActionDescriptorV1；请求字段全部取自 descriptor，
 *    客户端多给的值一律丢弃。
 * 2. 结论只来自 owner 的 PaneActionReceiptV1。unknown、malformed、超时、抛错、
 *    descriptor 过期全部折叠为 reconcile_required——绝不乐观成功、绝不自动重试。
 * 3. deadline 计时器只用于放弃等待（单次、一次性），不用于轮询或重发。
 * 4. 同一 idempotencyKey 的重复提交直接复用首次已定结论，owner channel 只见一次。
 */

import {
  PaneActionDescriptorSchema,
  PaneActionReceiptSchema,
  PaneActionRequestSchema,
  type PaneActionDescriptorV1,
  type PaneActionReceiptV1,
  type PaneActionRequestV1,
  type PaneContextV1,
} from '@yeisme/dsh-pane-protocol'

/** owner 负向标记：approval_required / not_available 都由 owner 显式给出。 */
export interface DomainActionNegative {
  readonly negative: 'approval_required' | 'not_available'
  readonly reason: string
}

function isNegative(value: unknown): value is DomainActionNegative {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (record.negative === 'approval_required' || record.negative === 'not_available') && typeof record.reason === 'string'
}

/** owner action 通道：preview 返回 descriptor JSON 或负向标记；submit 返回 receipt JSON。 */
export interface DomainActionOwnerChannel {
  preview(input: { readonly actionId: string; readonly targetRef?: string }): Promise<unknown>
  submit(request: PaneActionRequestV1): Promise<unknown>
}

export type DomainActionPreviewOutcome =
  | { readonly kind: 'descriptor'; readonly descriptor: PaneActionDescriptorV1 }
  | { readonly kind: 'approval_required'; readonly reason: string }
  | { readonly kind: 'not_available'; readonly reason: string }
  | { readonly kind: 'contract_mismatch' }
  | { readonly kind: 'reconcile_required'; readonly reason: string }

export type DomainActionSubmitOutcome =
  | { readonly kind: 'receipt'; readonly receipt: PaneActionReceiptV1 }
  | { readonly kind: 'reconcile_required'; readonly reason: string }

const TERMINAL_RECEIPTS = new Set(['accepted', 'completed', 'partial', 'failed', 'rejected', 'approval_required', 'pending'])

/** 单次放弃等待的守卫；resolve 后清理计时器，不产生任何后续动作。 */
function withDeadline<T>(operation: Promise<T>, deadlineMs: number | undefined): Promise<T> {
  if (deadlineMs === undefined) return operation
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DeadlineElapsed()), deadlineMs)
    operation.then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) },
    )
  })
}

class DeadlineElapsed extends Error {}

export interface DomainActionGatewayOptions {
  /** requirePreviewFields：缺任一 facet 时 fail visible（approval_required），不推断可执行。 */
  readonly requirePreviewFields?: readonly ('cost' | 'rights')[]
  /** 等待 owner 的上限；只放弃等待，不重试。 */
  readonly deadlineMs?: number
  readonly now?: () => number
}

export class DomainActionGateway {
  private readonly settled = new Map<string, DomainActionSubmitOutcome>()

  constructor(
    private readonly channel: DomainActionOwnerChannel,
    private readonly options: DomainActionGatewayOptions = {},
  ) {}

  async preview(input: { readonly actionId: string; readonly targetRef?: string }): Promise<DomainActionPreviewOutcome> {
    let raw: unknown
    try {
      raw = await withDeadline(this.channel.preview(input), this.options.deadlineMs)
    } catch (error) {
      return { kind: 'reconcile_required', reason: error instanceof DeadlineElapsed ? 'timeout' : 'owner_unreachable' }
    }
    if (isNegative(raw)) {
      return raw.negative === 'approval_required'
        ? { kind: 'approval_required', reason: raw.reason }
        : { kind: 'not_available', reason: raw.reason }
    }
    const parsed = PaneActionDescriptorSchema.safeParse(raw)
    if (!parsed.success) return { kind: 'contract_mismatch' }
    if (Date.parse(parsed.data.expiresAt) <= (this.options.now?.() ?? Date.now())) {
      return { kind: 'reconcile_required', reason: 'descriptor_expired' }
    }
    for (const field of this.options.requirePreviewFields ?? []) {
      if (field === 'cost' && parsed.data.preview.cost === undefined) {
        return { kind: 'approval_required', reason: 'cost_preview_missing' }
      }
      if (field === 'rights' && parsed.data.preview.rights === undefined) {
        return { kind: 'approval_required', reason: 'rights_preview_missing' }
      }
    }
    return { kind: 'descriptor', descriptor: parsed.data }
  }

  async submit(
    descriptor: PaneActionDescriptorV1,
    values: Readonly<Record<string, unknown>>,
    context: PaneContextV1,
    idempotencyKey?: string,
  ): Promise<DomainActionSubmitOutcome> {
    // descriptor 以 server-authored 版本为准：即便调用方传入被篡改的副本也按当前
    // 已验证字段重建请求。
    const reparsed = PaneActionDescriptorSchema.safeParse(descriptor)
    if (!reparsed.success) return { kind: 'reconcile_required', reason: 'contract_mismatch' }
    const safeDescriptor = reparsed.data
    if (Date.parse(safeDescriptor.expiresAt) <= (this.options.now?.() ?? Date.now())) {
      return { kind: 'reconcile_required', reason: 'descriptor_expired' }
    }
    const key = idempotencyKey ?? `idem:${safeDescriptor.descriptorRef}:${safeDescriptor.targetVersion}`
    const cached = this.settled.get(key)
    if (cached !== undefined) return cached

    // 只保留 descriptor 声明过的字段键。
    const declared = new Set(safeDescriptor.fields.map(field => field.key))
    const admitted: Record<string, unknown> = {}
    for (const [fieldKey, value] of Object.entries(values)) {
      if (declared.has(fieldKey)) admitted[fieldKey] = value
    }
    const request = PaneActionRequestSchema.parse({
      schema: 'pane.action-request.v1alpha1',
      descriptorRef: safeDescriptor.descriptorRef,
      owner: safeDescriptor.owner,
      actionId: safeDescriptor.actionId,
      expectedTargetRef: safeDescriptor.targetRef,
      expectedTargetVersion: safeDescriptor.targetVersion,
      context,
      idempotencyKey: key,
      values: admitted,
    })

    let raw: unknown
    try {
      raw = await withDeadline(this.channel.submit(request), this.options.deadlineMs)
    } catch (error) {
      return this.settle(key, { kind: 'reconcile_required', reason: error instanceof DeadlineElapsed ? 'timeout' : 'owner_unreachable' })
    }
    const receipt = PaneActionReceiptSchema.safeParse(raw)
    if (!receipt.success || !TERMINAL_RECEIPTS.has(receipt.data.status)) {
      // unknown / reconcile_required / 无法解析：一律进入 reconcile，不乐观成功。
      return this.settle(key, { kind: 'reconcile_required', reason: 'unknown_receipt' })
    }
    return this.settle(key, { kind: 'receipt', receipt: receipt.data })
  }

  /** 只缓存已定结论；reconcile 也缓存，避免同 key 重复打到 owner。 */
  private settle(key: string, outcome: DomainActionSubmitOutcome): DomainActionSubmitOutcome {
    this.settled.set(key, outcome)
    return outcome
  }
}

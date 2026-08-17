import { z } from 'zod'
import type {
  OrdoAgentOpsActionResult,
  OrdoAgentOpsActionReceipt,
  OrdoAgentOpsExpectedContext,
  OrdoAgentOpsRef,
  OrdoAgentOpsSnapshot,
} from './types.ts'

const opaqueRef = z.string().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
const safeKey = z.string().min(1).max(96).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
const safeText = z.string().min(1).max(512).refine(isSafeText, 'safe projection text contains a forbidden value')
const count = z.number().int().nonnegative().max(1_000_000)

/** Host 注入授权上下文的运行时边界。 */
export const ordoAgentOpsExpectedContextSchema = z.object({
  tenantRef: opaqueRef,
  workspaceRef: opaqueRef,
  principalRef: opaqueRef,
  contextRevision: count,
  installationRef: opaqueRef,
}).strict()

const runSchema = z.object({
  runRef: opaqueRef,
  state: safeKey,
  safeTitle: safeText,
  taskCount: count,
  completedTaskCount: count,
  attentionCount: count,
}).strict().superRefine((run, ctx) => {
  if (run.completedTaskCount > run.taskCount) {
    ctx.addIssue({ code: 'custom', path: ['completedTaskCount'], message: 'completedTaskCount exceeds taskCount' })
  }
})

const capacitySchema = z.object({
  policyCap: count,
  observedOrRetained: count,
  qualifiedRoutes: count,
  reservationState: z.enum(['not_supported', 'not_reserved', 'reserved', 'stale', 'revoked', 'unknown']),
}).strict()

const digest = z.string().regex(/^[a-f0-9]{64}$/u)

const actionDescriptorSchema = z.object({
  actionType: z.enum(['ordo.reconcile.request', 'ordo.approval.decide']),
  decisionRef: opaqueRef,
  targetRef: opaqueRef,
  targetVersion: count,
  ownerRef: opaqueRef,
  safeEffect: safeText,
  expiresAt: z.string().min(1).max(64).refine(isIsoTimestamp, 'expiresAt must be an ISO timestamp'),
  previewDigest: digest,
  contractDigest: digest,
}).strict()

const actionReceiptSchema = z.object({
  receiptRef: opaqueRef,
  state: z.enum(['accepted', 'reconcile_required', 'still_unknown']),
  safeSummary: safeText,
}).strict()

const actionRejectionSchema = z.object({
  kind: z.literal('rejected'),
  reason: z.enum(['stale', 'permission_denied', 'not_available', 'expired']),
  safeMessage: safeText,
}).strict()

const actionResultSchema = z.union([actionReceiptSchema, actionRejectionSchema])

/** Host 到浏览器的 Ordo 投影运行时边界。 */
export const ordoAgentOpsSnapshotSchema = z.object({
  schemaVersion: z.literal('ordo.agent_ops.snapshot.v1alpha1'),
  snapshotRef: opaqueRef,
  snapshotVersion: count,
  generatedAt: z.string().min(1).max(64).refine(isIsoTimestamp, 'generatedAt must be an ISO timestamp'),
  state: z.enum(['ready', 'stale', 'offline', 'permission_denied', 'contract_mismatch', 'needs_contract']),
  freshness: z.enum(['fresh', 'stale', 'offline']),
  reasonCode: z.enum([
    'owner_snapshot',
    'owner_read_contract_unavailable',
    'owner_projection_unavailable',
    'context_stale',
    'reconcile_required',
    'permission_denied',
    'contract_mismatch',
  ]),
  source: z.enum(['owner', 'owner-gated']),
  safeMessage: safeText,
  context: ordoAgentOpsExpectedContextSchema.optional(),
  run: runSchema.optional(),
  capacity: capacitySchema.optional(),
  actions: z.array(actionDescriptorSchema).max(32).optional(),
}).strict().superRefine((snapshot, ctx) => {
  const readable = snapshot.state === 'ready' || snapshot.state === 'stale'
  if (readable && snapshot.context === undefined) {
    ctx.addIssue({ code: 'custom', path: ['context'], message: 'ready and stale snapshots require context' })
  }
  if (!readable && (snapshot.run !== undefined || snapshot.capacity !== undefined || snapshot.actions !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'non-readable snapshots must not carry run, capacity, or action facts' })
  }
})

/**
 * 验证、脱离并冻结 Host 注入的上下文；无效值不会进入 Remote 生命周期。
 * @param input - 未信任的 Context 注入值。
 * @returns 不可变上下文副本；无效时为 undefined。
 */
export function validateOrdoAgentOpsExpectedContext(input: unknown): OrdoAgentOpsExpectedContext | undefined {
  const result = ordoAgentOpsExpectedContextSchema.safeParse(input)
  if (!result.success) return undefined
  return Object.freeze({
    tenantRef: result.data.tenantRef as OrdoAgentOpsRef,
    workspaceRef: result.data.workspaceRef as OrdoAgentOpsRef,
    principalRef: result.data.principalRef as OrdoAgentOpsRef,
    contextRevision: result.data.contextRevision,
    installationRef: result.data.installationRef as OrdoAgentOpsRef,
  })
}

/**
 * 在跨越 Remote 边界前校验 Owner 投影。无效投影不可被部分降级，以免混入未经授权事实。
 * @param input - Host 内读取的未信任 Owner 投影。
 * @returns 合同形状正确的投影；无效时为 undefined。
 */
export function validateOrdoAgentOpsSnapshot(input: unknown): OrdoAgentOpsSnapshot | undefined {
  const result = ordoAgentOpsSnapshotSchema.safeParse(input)
  return result.success ? result.data as unknown as OrdoAgentOpsSnapshot : undefined
}

/** Owner action 的返回值也必须在进入命令文本前经过 safe projection 校验。 */
export function validateOrdoAgentOpsActionReceipt(input: unknown): OrdoAgentOpsActionReceipt | undefined {
  const result = actionReceiptSchema.safeParse(input)
  return result.success ? result.data as OrdoAgentOpsActionReceipt : undefined
}

/** 只接受 owner 明确声明的 rejection；异常和坏 payload 由 bridge 转为 unknown。 */
export function validateOrdoAgentOpsActionResult(input: unknown): OrdoAgentOpsActionResult | undefined {
  const result = actionResultSchema.safeParse(input)
  return result.success ? result.data as unknown as OrdoAgentOpsActionResult : undefined
}

function isIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && !/[\u0000-\u001f\u007f]/.test(value)
}

const unsafeSchemeOrCredential = /(?:https?:\/\/|wss?:\/\/|\bBearer\b|\b(?:token|secret|credential|password|api[_-]?key)\b)/i
const unsafePathOrProcess = /(?:^|[\s:=])(?:pid|process[_-]?id)(?:[\s:=]|$)|(?:^|[\s:=])(?:\/|[a-z]:[/\\])/i

function isSafeText(value: string): boolean {
  if (/[\u0000-\u001f\u007f]/.test(value)) return false
  return !unsafeSchemeOrCredential.test(value) && !unsafePathOrProcess.test(value)
}

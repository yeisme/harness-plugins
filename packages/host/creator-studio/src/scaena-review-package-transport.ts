/**
 * Scaena review-package 固定版本消费与 transport 验证
 * （dsh-scaena-production-studio-v1 §2.6）。
 *
 * 固定版本：消费方持有 {owner=scaena, packageRef, packageVersion,
 * graphVersion} 三元组；每次重读都经 verifyScaenaPackagePin 校验，任一漂移
 * → unconfirmed（该包不作为有效版本打开，失败原因显式给出），绝不把新
 * 版本静默当作旧版本继续用。
 *
 * transport 验证沿用 owner 合同（docs/protocols/storyboard-review-package.md）：
 * - 观察面 `storyboard package watch` 只返回 refs-only 事件（`<seq> <kind>`），
 *   numeric cursor resume（cursor=N 只回 seq>N，next cursor=max seq）；
 *   载荷/非数字 cursor 一律拒绝，不猜测事件内容。
 * - mutation 全部 project scope + `--idempotency-key` + expected version，
 *   冲突不修改状态（由 §2.2 dispatch 路径的 CAS 复核与 stale 映射承担）。
 * - durable replay 逐动作语义（同 key 同请求返回原回执）由 §2.2 飞行表
 *   显式 reconcile 承担；本模块不重发任何 mutation。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import { scaenaCliEnvelopeSchema } from './scaena-production-contract.ts'
import type { ScaenaPackageProjection, ScaenaInvoke } from './scaena-package-contract.ts'

const packageRefText = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u)
const numericCursor = z.string().regex(/^\d{1,18}$/u)
/** refs-only 事件行：`<seq> <event_kind>`，禁止任何载荷。 */
const eventLine = z.string().regex(/^\d{1,18} [A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/u).max(80)

export const scaenaPackageEventsQuerySchema = z.object({
  packageRef: packageRefText,
  cursor: numericCursor.optional(),
}).strict()
export type ScaenaPackageEventsQuery = z.infer<typeof scaenaPackageEventsQuerySchema>

export type ScaenaPackageEventsResult =
  | { readonly status: 'ready'; readonly packageRef: string; readonly events: readonly { readonly seq: number; readonly kind: string }[]; readonly nextCursor?: string }
  | { readonly status: 'rejected' | 'unknown'; readonly reason: 'invalid_input' | 'unavailable' | 'owner_rejected' | 'contract_mismatch' | 'unconfirmed' }

/** 固定版本三元组：owner/ref/version 全部由消费方在选定时记录。 */
export interface ScaenaPackagePin {
  readonly packageRef: string
  readonly packageVersion: number
  readonly graphVersion: number
}

export type ScaenaPackagePinVerification =
  | { readonly status: 'verified'; readonly projection: ScaenaPackageProjection }
  | { readonly status: 'unconfirmed'; readonly reason: 'package_ref_drift' | 'package_version_drift' | 'graph_version_drift' | 'projection_unavailable'
      readonly observed?: { readonly packageRef: string; readonly packageVersion: number; readonly graphVersion: number } }

/**
 * 校验一次重读是否仍命中固定版本。漂移时返回观测值：调用方展示失败原因
 * 并停止把该投影当作 pinned 版本消费（不打开为有效、不回填）。
 */
export function verifyScaenaPackagePin(pin: ScaenaPackagePin, projection: ScaenaPackageProjection | undefined): ScaenaPackagePinVerification {
  if (projection === undefined) return { status: 'unconfirmed', reason: 'projection_unavailable' }
  const observed = { packageRef: projection.package_ref, packageVersion: projection.package_version, graphVersion: projection.graph_version }
  if (projection.package_ref !== pin.packageRef) return { status: 'unconfirmed', reason: 'package_ref_drift', observed }
  if (projection.package_version !== pin.packageVersion) return { status: 'unconfirmed', reason: 'package_version_drift', observed }
  if (projection.graph_version !== pin.graphVersion) return { status: 'unconfirmed', reason: 'graph_version_drift', observed }
  return { status: 'verified', projection }
}

/** 观察面客户端：`storyboard package watch --cursor N` 的 refs-only 消费。 */
export class ScaenaPackageEventsClient {
  constructor(
    private readonly invoke: ScaenaInvoke,
    private readonly cwd: string,
  ) {}

  async read(query: ScaenaPackageEventsQuery): Promise<ScaenaPackageEventsResult> {
    const parsed = scaenaPackageEventsQuerySchema.safeParse(query)
    if (!parsed.success) return { status: 'rejected', reason: 'invalid_input' }
    const args = ['storyboard', 'package', 'watch', parsed.data.packageRef, '--project', this.cwd, '--timeout', '1s', '--poll-interval', '1s',
      ...(parsed.data.cursor === undefined ? [] : ['--cursor', parsed.data.cursor])]
    let raw: unknown
    try { raw = await this.invoke(args, 30_000) } catch { return { status: 'unknown', reason: 'unavailable' } }
    const envelope = scaenaCliEnvelopeSchema.safeParse(raw)
    if (!envelope.success) return { status: 'unknown', reason: 'contract_mismatch' }
    if (envelope.data.error !== undefined) {
      return { status: envelope.data.error.code === 'INVALID_ARGUMENT' ? 'rejected' : 'unknown', reason: envelope.data.error.code === 'INVALID_ARGUMENT' ? 'owner_rejected' : 'unavailable' }
    }
    const facts = envelope.data.facts ?? {}
    if (facts.package_ref !== parsed.data.packageRef) return { status: 'unknown', reason: 'unconfirmed' }
    const lines = Array.isArray(facts.events) ? facts.events : undefined
    const cursor = typeof facts.cursor === 'string' ? facts.cursor : undefined
    if (lines === undefined || !Array.isArray(lines) || lines.length > 100 || cursor === undefined || !numericCursor.safeParse(cursor).success) {
      return { status: 'unknown', reason: 'contract_mismatch' }
    }
    const events: { seq: number; kind: string }[] = []
    for (const line of lines) {
      if (typeof line !== 'string' || !eventLine.safeParse(line).success) return { status: 'unknown', reason: 'contract_mismatch' }
      const [seq, kind] = line.split(' ') as [string, string]
      events.push({ seq: Number(seq), kind })
    }
    const after = parsed.data.cursor === undefined ? 0 : Number(parsed.data.cursor)
    // numeric cursor resume：回放不得包含 ≤ cursor 的事件（owner 合同语义）。
    if (events.some(event => event.seq <= after)) return { status: 'unknown', reason: 'unconfirmed' }
    const next = Number(cursor)
    if (events.some(event => event.seq > next)) return { status: 'unknown', reason: 'unconfirmed' }
    return { status: 'ready', packageRef: parsed.data.packageRef, events, ...(events.length > 0 ? { nextCursor: cursor } : {}) }
  }
}

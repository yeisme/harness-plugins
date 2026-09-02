/**
 * Owner mutation 的 typed outcome。
 *
 * rejected 必须由 adapter 用 owner 的 typed response 证明；timeout、abort、
 * disconnect 或任何未分类 throw 一律 unknown，绝不猜成 rejected。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite-core
 */

/**
 * 每次 owner 调用的结果值：
 * - accepted：owner 确认接受；
 * - rejected：owner 确定性拒绝（可安全地显式重试）；
 * - unknown：无法证明接受与否，可携带 `partial` 安全事实（如已知 child ID）。
 */
export type RewriteMutationOutcomeV2<T> =
  | { readonly kind: 'accepted'; readonly value: T }
  | { readonly kind: 'rejected'; readonly code: string; readonly summary?: string }
  | { readonly kind: 'unknown'; readonly code: string; readonly partial?: Partial<T>; readonly summary?: string }

/** safe summary 的上限与规范化规则：单行、去除控制字符、最多 256 字符。 */
const SAFE_SUMMARY_MAX_LENGTH = 256

function normalizeSafeSummary(summary: string | undefined): string | undefined {
  if (typeof summary !== 'string') return undefined
  // 折叠为单行并去掉控制字符，避免错误摘要携带换行注入或不可见 payload。
  const flattened = summary
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (flattened.length === 0) return undefined
  return flattened.length > SAFE_SUMMARY_MAX_LENGTH ? `${flattened.slice(0, SAFE_SUMMARY_MAX_LENGTH - 1)}…` : flattened
}

function withSummary(outcome: { summary?: string }, summary: string | undefined): void {
  const normalized = normalizeSafeSummary(summary)
  if (normalized !== undefined) outcome.summary = normalized
}

/** 构造 accepted outcome。 */
export function accepted<T>(value: T): RewriteMutationOutcomeV2<T> {
  return { kind: 'accepted', value }
}

/** 构造 rejected outcome；summary 规范化为单行 bounded safe text。 */
export function rejected<T = never>(code: string, summary?: string): RewriteMutationOutcomeV2<T> {
  const outcome: { kind: 'rejected'; code: string; summary?: string } = { kind: 'rejected', code }
  withSummary(outcome, summary)
  return outcome as RewriteMutationOutcomeV2<T>
}

/** 构造 unknown outcome；`partial` 只放可安全公开的事实（child ID 等）。 */
export function unknownOutcome<T>(code: string, partial?: Partial<T>, summary?: string): RewriteMutationOutcomeV2<T> {
  const outcome: { kind: 'unknown'; code: string; partial?: Partial<T>; summary?: string } = { kind: 'unknown', code }
  if (partial !== undefined) outcome.partial = partial
  withSummary(outcome, summary)
  return outcome as RewriteMutationOutcomeV2<T>
}

/** 单独导出规范化函数，供 adapter 复用同一 summary 规则。 */
export const normalizeRewriteSafeSummary = normalizeSafeSummary

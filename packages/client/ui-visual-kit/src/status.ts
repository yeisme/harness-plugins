/**
 * Owner status/freshness 词表 → tone 的唯一映射。
 * 词表外的 status 落 neutral 并保持文本表达，不抛错、不伪装 ready。
 */

export type StatusTone = 'positive' | 'info' | 'warn' | 'critical' | 'neutral'

const TONE_BY_STATUS: Readonly<Record<string, StatusTone>> = {
  ready: 'positive',
  completed: 'positive',
  done: 'positive',
  success: 'positive',
  running: 'info',
  active: 'info',
  queued: 'info',
  pending: 'warn',
  partial: 'warn',
  stale: 'warn',
  approval_required: 'warn',
  reconciling: 'warn',
  offline: 'critical',
  failed: 'critical',
  error: 'critical',
  contract_mismatch: 'critical',
  reconcile_required: 'critical',
  unknown: 'critical',
}

/** status/freshness → tone；未知词表返回 neutral。 */
export function statusTone(status: string | undefined | null): StatusTone {
  if (typeof status !== 'string' || status.length === 0) return 'neutral'
  return TONE_BY_STATUS[status.toLowerCase()] ?? 'neutral'
}

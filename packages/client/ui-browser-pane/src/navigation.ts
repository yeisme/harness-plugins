/**
 * Ephemeral navigation draft and host rejection handling (browser-pane 2.7).
 *
 * The user's full target exists ONLY inside the pending draft and the single
 * action request; it never enters projection, restore state, receipts, logs,
 * telemetry, evidence, or error summaries. Owner rejections surface a typed
 * reason; there is no local effect and no automatic retry.
 *
 * @module @yeisme/dsh-client-ui-browser-pane
 */
export const NAVIGATION_DRAFT_MAX = 2_048

export interface NavigationDraftStateV1 {
  /** Bounded raw draft; undefined = editor closed. */
  readonly text: string | undefined
}

export type NavigationRejectionReason =
  | 'invalid_scheme' | 'unsafe_host' | 'credential_embedded' | 'blocked_by_policy' | 'needs_confirm' | 'unknown'

/** Accepts the raw editor input; returns the sealed request draft or a typed rejection. */
export function sealNavigationDraft(raw: string): { readonly ok: true; readonly draft: string } | { readonly ok: false; readonly reason: NavigationRejectionReason } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, reason: 'invalid_scheme' }
  if (trimmed.length > NAVIGATION_DRAFT_MAX) return { ok: false, reason: 'invalid_scheme' }
  // credential shapes: userinfo@ prefix or inline token/password keys
  if (/(?:^|\/\/)[^/@\s]+:[^/@\s]+@/.test(trimmed)) return { ok: false, reason: 'credential_embedded' }
  if (/\s(?:user|pass|token|key)[:=]\S/i.test(trimmed)) return { ok: false, reason: 'credential_embedded' }
  // dangerous schemes reject before the bare-host gate
  if (/^(?:file|javascript|data|blob|about|chrome):/i.test(trimmed)) return { ok: false, reason: 'invalid_scheme' }
  // scheme gate: bare hosts and http/https targets only; everything else typed-rejects
  const bareHost = /^[\w-]+(?:\.[\w-]+)+(?:[/?#][^\s]*)?$/.test(trimmed)
  const httpsTarget = /^https?:\/\//i.test(trimmed)
  if (!bareHost && !httpsTarget) return { ok: false, reason: 'invalid_scheme' }
  return { ok: true, draft: trimmed }
}

/**
 * Maps an owner dispatch rejection to the honest, redacted UI copy. The full
 * target is intentionally unavailable here — only the typed reason remains.
 */
export function navigationRejectionCopy(reason: NavigationRejectionReason): string {
  switch (reason) {
    case 'invalid_scheme': return '目标格式不受支持。'
    case 'unsafe_host': return '目标主机被策略阻止。'
    case 'credential_embedded': return '目标包含凭据，已拒绝。'
    case 'blocked_by_policy': return '导航被当前策略阻止。'
    case 'needs_confirm': return '需要确认后重试。'
    case 'unknown': return '导航被拒绝。'
  }
}

/** Redaction guard: pending text must be cleared on every terminal outcome. */
export function clearNavigationDraft(state: NavigationDraftStateV1): NavigationDraftStateV1 {
  return state.text === undefined ? state : { text: undefined }
}

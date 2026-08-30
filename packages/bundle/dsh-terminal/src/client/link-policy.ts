/**
 * Terminal link policy (V3 6.7).
 *
 * Owner-authorized https links may open externally after an explicit user
 * action; everything else — file:, javascript:, custom schemes, bare hosts,
 * and unresolved paths — is denied. No URL is ever executed, fetched, or
 * auto-typed into the PTY (auto-Enter is structurally impossible: the
 * policy returns a decision and never writes input).
 *
 * @module @yeisme/dsh-terminal/client
 */

export type TerminalLinkDecision =
  | { readonly action: 'external'; readonly url: string }
  | { readonly action: 'deny'; readonly reason: 'scheme' | 'host' | 'relative' }

/** Deny-by-default terminal link classification. */
export function terminalLinkPolicy(input: string): TerminalLinkDecision {
  const trimmed = input.trim()
  if (trimmed === '') return { action: 'deny', reason: 'relative' }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { action: 'deny', reason: 'relative' }
  }
  if (parsed.protocol !== 'https:') return { action: 'deny', reason: 'scheme' }
  if (parsed.hostname === '' || parsed.username !== '' || parsed.password !== '') {
    return { action: 'deny', reason: 'host' }
  }
  return { action: 'external', url: parsed.toString() }
}

/** Open an approved external link; denials are silent and never execute. */
export function openTerminalLink(input: string, confirmFn: (message: string) => boolean = () => false): boolean {
  const decision = terminalLinkPolicy(input)
  if (decision.action !== 'external') return false
  if (!confirmFn(`打开外部链接？${decision.url}`)) return false
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(decision.url, '_blank', 'noopener,noreferrer')
    return true
  }
  return false
}

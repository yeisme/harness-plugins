/** Terminal capability probe. Missing interactive PTY is contract_mismatch, never a fake stream. */

export const TERMINAL_INTERACTIVE_CAPABILITY = 'TerminalInteractiveCapabilityV1'

export type TerminalProbeStatus = 'ready' | 'contract_mismatch' | 'offline' | 'permission_denied'

export interface TerminalCapabilitySource {
  readonly capabilities?: readonly string[]
  readonly sessions?: readonly { readonly id: string; readonly status?: string }[]
  readonly available?: boolean
}

export interface TerminalProbeProjection {
  readonly status: TerminalProbeStatus
  readonly missingCapability?: string
  readonly sessions: readonly { readonly id: string; readonly status: string }[]
  readonly inputEnabled: boolean
  readonly reason: string
}

export function probeTerminalCapability(source: TerminalCapabilitySource | undefined): TerminalProbeProjection {
  if (source === undefined || source.available === false) {
    return {
      status: 'offline',
      sessions: [],
      inputEnabled: false,
      reason: 'terminal owner is offline',
    }
  }
  const capabilities = source.capabilities ?? []
  if (!capabilities.includes(TERMINAL_INTERACTIVE_CAPABILITY)) {
    const sessions = (source.sessions ?? []).map(session => ({
      id: session.id,
      status: session.status ?? 'unknown',
    })).slice(0, 64)
    return {
      status: 'contract_mismatch',
      missingCapability: TERMINAL_INTERACTIVE_CAPABILITY,
      sessions,
      inputEnabled: false,
      reason: `missing ${TERMINAL_INTERACTIVE_CAPABILITY}`,
    }
  }
  return {
    status: 'ready',
    sessions: (source.sessions ?? []).map(session => ({
      id: session.id,
      status: session.status ?? 'unknown',
    })).slice(0, 64),
    inputEnabled: true,
    reason: 'interactive terminal available',
  }
}

export type GitRemoteActionV1 = 'fetch' | 'pull' | 'push'

export interface GitRemoteCapabilityGateV1 {
  readonly available: boolean
  readonly actions: readonly GitRemoteActionV1[]
  readonly reason?: string
}

export interface GitRemoteSummaryV1 {
  readonly remote: string
  readonly ref: string
  readonly ahead: number
  readonly behind: number
}

export interface GitRemotePreflightV1 {
  readonly action: GitRemoteActionV1
  readonly remote: string
  readonly ref: string
  readonly force: false
}

export function createGitRemoteGate(available: boolean, actions: readonly GitRemoteActionV1[] = [], reason?: string): GitRemoteCapabilityGateV1 {
  return { available, actions: available ? actions : [], reason }
}

export function gitRemoteActionVisible(gate: GitRemoteCapabilityGateV1, action: GitRemoteActionV1): boolean {
  return gate.available && gate.actions.includes(action)
}

export function gitRemoteReadOnlyReason(gate: GitRemoteCapabilityGateV1): string | undefined {
  if (gate.available) return undefined
  return gate.reason ?? 'GitRemoteActionsCapabilityV1 is unavailable'
}

export function createRemotePreflight(action: GitRemoteActionV1, summary: GitRemoteSummaryV1): GitRemotePreflightV1 | undefined {
  if (action !== 'fetch' && action !== 'pull' && action !== 'push') return undefined
  if (summary.remote.length === 0 || summary.ref.length === 0) return undefined
  return { action, remote: summary.remote, ref: summary.ref, force: false }
}

export function gitRemoteForcePushDefault(): false {
  return false
}

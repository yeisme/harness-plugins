export type GitBranchActionV1 = 'create' | 'switch' | 'delete'
export type GitWorktreeActionV1 = 'list' | 'create' | 'remove'

export interface GitBranchCapabilityGateV1 {
  readonly available: boolean
  readonly actions: readonly GitBranchActionV1[]
  readonly reason?: string
}

export interface GitWorktreeCapabilityGateV1 {
  readonly available: boolean
  readonly actions: readonly GitWorktreeActionV1[]
  readonly releasesOrdoLease: false
  readonly reason?: string
}

export interface OrdoLeaseBlockerV1 {
  readonly blocked: boolean
  readonly leaseRef?: string
  readonly deepLink?: string
  readonly reason?: string
}

export interface GitWorktreeRowV1 {
  readonly worktreeRef: string
  readonly label: string
  readonly lease?: OrdoLeaseBlockerV1
}

export function createGitBranchGate(available: boolean, actions: readonly GitBranchActionV1[] = [], reason?: string): GitBranchCapabilityGateV1 {
  return { available, actions: available ? actions : [], reason }
}

export function createGitWorktreeGate(available: boolean, actions: readonly GitWorktreeActionV1[] = [], reason?: string): GitWorktreeCapabilityGateV1 {
  return { available, actions: available ? actions : [], releasesOrdoLease: false, reason }
}

export function gitBranchActionVisible(gate: GitBranchCapabilityGateV1, action: GitBranchActionV1): boolean {
  return gate.available && gate.actions.includes(action)
}

export function gitWorktreeActionVisible(gate: GitWorktreeCapabilityGateV1, action: GitWorktreeActionV1): boolean {
  return gate.available && gate.actions.includes(action)
}

export function blockWorktreeRemove(row: GitWorktreeRowV1): OrdoLeaseBlockerV1 {
  if (row.lease?.blocked === true) {
    return {
      blocked: true,
      leaseRef: row.lease.leaseRef,
      deepLink: row.lease.deepLink,
      reason: row.lease.reason ?? 'Ordo writer lease is active',
    }
  }
  return { blocked: false }
}

export function gitPaneReleasesOrdoLease(): false {
  return false
}

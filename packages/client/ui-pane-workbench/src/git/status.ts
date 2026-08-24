export type GitChangeGroupIdV1 = 'merge' | 'staged' | 'changes' | 'untracked'
export type GitChangeStatusV1 = 'conflict' | 'staged' | 'modified' | 'deleted' | 'renamed' | 'untracked'
export type GitShellPhaseV1 = 'clean' | 'empty' | 'loading' | 'error' | 'partial' | 'stale' | 'offline' | 'ready'

export interface GitChangedFileV1 {
  readonly fileRef: string
  readonly name: string
  readonly status: GitChangeStatusV1
  readonly group: GitChangeGroupIdV1
  readonly revision?: string
}

export interface GitRepositoryOptionV1 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly label: string
}

export interface GitStatusShellV1 {
  readonly phase: GitShellPhaseV1
  readonly repositoryRef?: string
  readonly worktreeRef?: string
  readonly branch?: string
  readonly upstream?: string
  readonly ahead: number
  readonly behind: number
  readonly revision?: string
  readonly cursor?: string
  readonly recentCommit?: string
  readonly commitMessage: string
  readonly files: readonly GitChangedFileV1[]
  readonly recoveryAction?: 'refresh' | 'retry' | 'reconcile'
  readonly reason?: string
}

export const GIT_CHANGE_GROUP_ORDER: readonly GitChangeGroupIdV1[] = ['merge', 'staged', 'changes', 'untracked']

export function createGitStatusShell(partial: Partial<GitStatusShellV1> = {}): GitStatusShellV1 {
  return {
    phase: partial.phase ?? 'empty',
    repositoryRef: partial.repositoryRef,
    worktreeRef: partial.worktreeRef,
    branch: partial.branch,
    upstream: partial.upstream,
    ahead: partial.ahead ?? 0,
    behind: partial.behind ?? 0,
    revision: partial.revision,
    cursor: partial.cursor,
    recentCommit: partial.recentCommit,
    commitMessage: partial.commitMessage ?? '',
    files: partial.files ?? [],
    recoveryAction: partial.recoveryAction,
    reason: partial.reason,
  }
}

export function classifyGitShellPhase(input: {
  readonly loading?: boolean
  readonly offline?: boolean
  readonly error?: string
  readonly stale?: boolean
  readonly partial?: boolean
  readonly files: readonly GitChangedFileV1[]
}): GitShellPhaseV1 {
  if (input.offline === true) return 'offline'
  if (input.loading === true) return 'loading'
  if (input.error !== undefined) return 'error'
  if (input.stale === true) return 'stale'
  if (input.partial === true) return 'partial'
  if (input.files.length === 0) return 'clean'
  return 'ready'
}

export function groupGitChanges(files: readonly GitChangedFileV1[]): Readonly<Record<GitChangeGroupIdV1, readonly GitChangedFileV1[]>> {
  const groups: Record<GitChangeGroupIdV1, GitChangedFileV1[]> = {
    merge: [],
    staged: [],
    changes: [],
    untracked: [],
  }
  for (const file of files) groups[file.group].push(file)
  return groups
}

export function visibleGitChangeGroups(files: readonly GitChangedFileV1[]): readonly GitChangeGroupIdV1[] {
  const grouped = groupGitChanges(files)
  return GIT_CHANGE_GROUP_ORDER.filter(id => grouped[id].length > 0)
}

export function gitChangeStatusToken(status: GitChangeStatusV1): string {
  return status
}

export function applyGitCursorGap(shell: GitStatusShellV1, nextSequence: number, currentSequence: number): GitStatusShellV1 {
  if (currentSequence > 0 && nextSequence > currentSequence + 1) {
    return {
      ...shell,
      phase: 'stale',
      recoveryAction: 'reconcile',
      reason: 'git status cursor gap; snapshot required',
    }
  }
  return shell
}

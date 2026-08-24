import { createElement, useMemo, type KeyboardEvent, type ReactNode } from 'react'
import { t } from '../i18n/locale.js'
import type { PaneLocalViewProps } from '../view-registry.js'
import { windowVirtualRows } from '../virtual-window.js'
import {
  gitBranchActionVisible,
  type GitBranchCapabilityGateV1,
  type GitWorktreeCapabilityGateV1,
  type GitWorktreeRowV1,
  blockWorktreeRemove,
  gitWorktreeActionVisible,
} from './branch-worktree.js'
import { gitDiffLooksComplete, type GitDiffWindowStateV1 } from './diff.js'
import {
  createGitRemoteGate,
  gitRemoteActionVisible,
  gitRemoteReadOnlyReason,
  type GitRemoteCapabilityGateV1,
  type GitRemoteSummaryV1,
} from './remote.js'
import {
  classifyGitShellPhase,
  createGitStatusShell,
  gitChangeStatusToken,
  groupGitChanges,
  visibleGitChangeGroups,
  type GitChangedFileV1,
  type GitRepositoryOptionV1,
  type GitShellPhaseV1,
  type GitStatusShellV1,
} from './status.js'

export const DSH_SOURCE_CONTROL_VIEW_KIND = 'dsh.source-control' as const
export const DSH_SOURCE_CONTROL_RESOURCE_KEY = 'navigator:dsh.source-control' as const
export const DSH_GIT_DIFF_VIEW_KIND = 'git.diff' as const
export const GIT_CHANGES_ROW_HEIGHT = 28

export interface SourceControlActionsV1 {
  readonly onOpenDiff?: (file: GitChangedFileV1) => void
  readonly onOpenFile?: (file: GitChangedFileV1) => void
  readonly onStage?: (file: GitChangedFileV1) => void
  readonly onUnstage?: (file: GitChangedFileV1) => void
  readonly onDiscard?: (file: GitChangedFileV1) => void
  readonly onCommit?: (message: string) => void
  readonly onRefresh?: () => void
  readonly onSelectRepository?: (option: GitRepositoryOptionV1) => void
  readonly onBranchAction?: (action: 'create' | 'switch' | 'delete') => void
  readonly onWorktreeAction?: (action: 'create' | 'remove', row?: GitWorktreeRowV1) => void
  readonly onRemoteAction?: (action: 'fetch' | 'pull' | 'push') => void
}

export interface SourceControlShellProps {
  readonly shell: GitStatusShellV1
  readonly repositories?: readonly GitRepositoryOptionV1[]
  readonly worktrees?: readonly GitWorktreeRowV1[]
  readonly branchGate?: GitBranchCapabilityGateV1
  readonly worktreeGate?: GitWorktreeCapabilityGateV1
  readonly remoteGate?: GitRemoteCapabilityGateV1
  readonly remote?: GitRemoteSummaryV1
  readonly mutationDisabled?: boolean
  readonly mutationReason?: string
  readonly viewportHeight?: number
  readonly scrollTop?: number
  readonly actions?: SourceControlActionsV1
}

function recoveryLabel(phase: GitShellPhaseV1): string {
  if (phase === 'offline') return t('state.offline')
  if (phase === 'error') return t('state.error')
  if (phase === 'stale') return t('state.stale')
  if (phase === 'loading') return t('state.loading')
  if (phase === 'partial') return t('state.stale')
  if (phase === 'clean' || phase === 'empty') return t('git.clean')
  return t('git.changes')
}

export function GitChangesList(props: {
  readonly files: readonly GitChangedFileV1[]
  readonly viewportHeight?: number
  readonly scrollTop?: number
  readonly mutationDisabled?: boolean
  readonly actions?: SourceControlActionsV1
}): ReactNode {
  const windowed = windowVirtualRows(props.files, props.scrollTop ?? 0, props.viewportHeight ?? 420, GIT_CHANGES_ROW_HEIGHT)
  const onRowKey = (event: KeyboardEvent<HTMLDivElement>, file: GitChangedFileV1): void => {
    if (event.key === 'Enter') props.actions?.onOpenDiff?.(file)
    if (event.key === ' ') { event.preventDefault(); props.actions?.onOpenFile?.(file) }
    if (event.key === 'F10' && event.shiftKey) { event.preventDefault(); props.actions?.onOpenDiff?.(file) }
  }
  return createElement('div', {
    className: 'pwr-git-changes',
    role: 'listbox',
    'aria-label': t('git.changes'),
    style: { height: props.viewportHeight ?? 420, overflow: 'auto' },
  },
    createElement('div', { style: { height: windowed.height, position: 'relative' } },
      createElement('div', { style: { transform: `translateY(${windowed.offset}px)` } },
        ...windowed.items.map(file => createElement('div', {
          key: file.fileRef,
          role: 'option',
          tabIndex: 0,
          'data-git-file': file.fileRef,
          'data-git-status': file.status,
          className: 'pwr-git-row',
          style: { height: GIT_CHANGES_ROW_HEIGHT, minHeight: GIT_CHANGES_ROW_HEIGHT, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' },
          onClick: () => props.actions?.onOpenDiff?.(file),
          onKeyDown: event => onRowKey(event, file),
        },
          createElement('span', { className: 'pwr-git-status', 'data-status-token': gitChangeStatusToken(file.status) }, gitChangeStatusToken(file.status)),
          createElement('span', { className: 'pwr-git-name' }, file.name),
          createElement('button', { type: 'button', onClick: event => { event.stopPropagation(); props.actions?.onOpenDiff?.(file) } }, t('git.diff')),
          createElement('button', { type: 'button', onClick: event => { event.stopPropagation(); props.actions?.onOpenFile?.(file) } }, t('explorer.openFile')),
          props.mutationDisabled === true ? null : createElement('button', { type: 'button', onClick: event => { event.stopPropagation(); props.actions?.onStage?.(file) } }, t('git.stage')),
        )),
      ),
    ),
  )
}

export function GitDiffView(props: { readonly window: GitDiffWindowStateV1 }): ReactNode {
  const complete = gitDiffLooksComplete(props.window)
  return createElement('section', { className: 'pwr-git-diff', 'data-git-diff-complete': complete },
    createElement('header', null, `${props.window.loaded}/${props.window.total}`),
    props.window.binary
      ? createElement('p', { role: 'status' }, t('git.binaryFallback'))
      : createElement('ol', null, ...props.window.hunks.filter(hunk => hunk.loaded).map(hunk =>
        createElement('li', { key: hunk.hunkRef, 'data-hunk': hunk.hunkRef }, hunk.header))),
    complete ? null : createElement('p', { role: 'status', 'data-git-diff-unloaded': true }, t('git.diffUnloaded')),
  )
}

export function SourceControlShell(props: SourceControlShellProps): ReactNode {
  const grouped = useMemo(() => groupGitChanges(props.shell.files), [props.shell.files])
  const visible = visibleGitChangeGroups(props.shell.files)
  const remoteGate = props.remoteGate ?? createGitRemoteGate(false, [], t('git.remoteUnavailable'))
  const remoteReason = gitRemoteReadOnlyReason(remoteGate)
  return createElement('section', { className: 'pwr-source-control', 'data-git-phase': props.shell.phase },
    createElement('header', { className: 'pwr-source-control-header' },
      createElement('label', null, t('git.repository'),
        createElement('select', {
          'aria-label': t('git.repository'),
          value: props.shell.worktreeRef ?? '',
          onChange: event => {
            const option = (props.repositories ?? []).find(item => item.worktreeRef === event.currentTarget.value)
            if (option !== undefined) props.actions?.onSelectRepository?.(option)
          },
        }, ...(props.repositories ?? []).map(option => createElement('option', { key: option.worktreeRef, value: option.worktreeRef }, option.label))),
      ),
      createElement('p', { className: 'pwr-git-branch' }, `${t('git.branch')}: ${props.shell.branch ?? '—'} ${props.shell.upstream ?? ''} +${props.shell.ahead}/-${props.shell.behind}`),
    ),
    createElement('form', {
      className: 'pwr-git-composer',
      onSubmit: event => {
        event.preventDefault()
        if (props.mutationDisabled === true) return
        props.actions?.onCommit?.(props.shell.commitMessage)
      },
    },
      createElement('label', null, t('git.commitMessage'),
        createElement('textarea', { 'aria-label': t('git.commitMessage'), value: props.shell.commitMessage, readOnly: true }),
      ),
      createElement('button', { type: 'submit', disabled: props.mutationDisabled === true || props.shell.commitMessage.trim() === '' }, t('git.commit')),
    ),
    props.shell.phase === 'ready' ? null : createElement('div', { className: 'pwr-git-state', role: 'status', 'data-git-recovery': props.shell.recoveryAction ?? 'refresh' },
      recoveryLabel(props.shell.phase),
      createElement('button', { type: 'button', onClick: () => props.actions?.onRefresh?.() }, t('explorer.refresh')),
    ),
    ...visible.map(groupId => createElement('section', { key: groupId, className: 'pwr-git-group', 'data-git-group': groupId },
      createElement('h3', null, `${t(groupId === 'merge' ? 'git.merge' : groupId === 'staged' ? 'git.staged' : groupId === 'untracked' ? 'git.untracked' : 'git.changes')} (${grouped[groupId].length})`),
      createElement(GitChangesList, { files: grouped[groupId], viewportHeight: props.viewportHeight, scrollTop: props.scrollTop, mutationDisabled: props.mutationDisabled, actions: props.actions }),
    )),
    createElement('footer', { className: 'pwr-git-actions' },
      props.branchGate !== undefined && gitBranchActionVisible(props.branchGate, 'create')
        ? createElement('button', { type: 'button', onClick: () => props.actions?.onBranchAction?.('create') }, t('git.branchCreate'))
        : null,
      props.worktreeGate !== undefined && gitWorktreeActionVisible(props.worktreeGate, 'create')
        ? createElement('button', { type: 'button', onClick: () => props.actions?.onWorktreeAction?.('create') }, t('git.worktreeCreate'))
        : null,
      ...(props.worktrees ?? []).map(row => {
        const blocker = blockWorktreeRemove(row)
        const enabled = props.worktreeGate !== undefined && gitWorktreeActionVisible(props.worktreeGate, 'remove') && !blocker.blocked
        return createElement('button', {
          key: row.worktreeRef,
          type: 'button',
          disabled: !enabled,
          title: blocker.blocked ? blocker.reason : undefined,
          'data-ordo-deeplink': blocker.deepLink,
          onClick: () => { if (enabled) props.actions?.onWorktreeAction?.('remove', row) },
        }, row.label)
      }),
      remoteReason === undefined && gitRemoteActionVisible(remoteGate, 'fetch')
        ? createElement('button', { type: 'button', onClick: () => props.actions?.onRemoteAction?.('fetch') }, t('git.fetch'))
        : null,
      remoteReason === undefined && gitRemoteActionVisible(remoteGate, 'pull')
        ? createElement('button', { type: 'button', onClick: () => props.actions?.onRemoteAction?.('pull') }, t('git.pull'))
        : null,
      remoteReason === undefined && gitRemoteActionVisible(remoteGate, 'push')
        ? createElement('button', { type: 'button', onClick: () => props.actions?.onRemoteAction?.('push') }, t('git.push'))
        : createElement('p', { role: 'status', 'data-git-remote-readonly': true }, remoteReason ?? `${t('git.aheadBehind')}: +${props.remote?.ahead ?? props.shell.ahead}/-${props.remote?.behind ?? props.shell.behind}`),
    ),
  )
}

export function SourceControlView(_props: PaneLocalViewProps): ReactNode {
  const shell = createGitStatusShell({ phase: classifyGitShellPhase({ files: [] }) })
  return createElement(SourceControlShell, { shell })
}

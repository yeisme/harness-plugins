import { createElement, useMemo, useState, type KeyboardEvent, type ReactNode, type UIEvent } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
  type SurfacePhase,
} from '@yeisme/dsh-client-ui-surface'
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
  readonly onHistory?: () => void
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

function surfacePhase(phase: GitShellPhaseV1): SurfacePhase {
  if (phase === 'error') return 'error'
  if (phase === 'stale') return 'stale'
  if (phase === 'partial') return 'partial'
  if (phase === 'offline') return 'disabled'
  if (phase === 'loading') return 'loading'
  return 'success'
}

function actionButton(label: string, onClick: (() => void) | undefined, options: { readonly primary?: boolean; readonly disabled?: boolean; readonly title?: string } = {}): ReactNode {
  if (onClick === undefined) return null
  return createElement(Button, {
    type: 'button',
    size: 'sm',
    variant: options.primary === true ? 'primary' : 'toolbar',
    disabled: options.disabled,
    title: options.title,
    onClick,
  }, label)
}

export function GitChangesList(props: {
  readonly files: readonly GitChangedFileV1[]
  readonly viewportHeight?: number
  readonly scrollTop?: number
  readonly mutationDisabled?: boolean
  readonly actions?: SourceControlActionsV1
}): ReactNode {
  const [localScrollTop, setLocalScrollTop] = useState(props.scrollTop ?? 0)
  const scrollTop = props.scrollTop ?? localScrollTop
  const windowed = windowVirtualRows(props.files, scrollTop, props.viewportHeight ?? 420, GIT_CHANGES_ROW_HEIGHT)
  const onRowKey = (event: KeyboardEvent<HTMLElement>, file: GitChangedFileV1): void => {
    if (event.key === 'Enter') props.actions?.onOpenDiff?.(file)
    if (event.key === ' ') { event.preventDefault(); props.actions?.onOpenFile?.(file) }
    if (event.key === 'F10' && event.shiftKey) { event.preventDefault(); props.actions?.onOpenDiff?.(file) }
  }
  return createElement('div', {
    className: 'pwr-git-changes',
    role: 'listbox',
    'aria-label': t('git.changes'),
    'data-git-scroll-region': 'changes',
    onScroll: (event: UIEvent<HTMLDivElement>) => {
      if (props.scrollTop === undefined) setLocalScrollTop(event.currentTarget.scrollTop)
    },
    style: { height: props.viewportHeight ?? 420, overflow: 'auto', overscrollBehavior: 'contain' },
  },
    createElement('div', { style: { height: windowed.height, position: 'relative' } },
      createElement('div', { style: { transform: `translateY(${windowed.offset}px)` } },
        ...windowed.items.map(file => createElement('div', {
          key: file.fileRef,
          role: 'option',
          tabIndex: 0,
          'data-git-file': file.fileRef,
          'data-git-status': file.status,
          className: 'pwr-git-row ys-row',
          style: { height: GIT_CHANGES_ROW_HEIGHT, minHeight: GIT_CHANGES_ROW_HEIGHT, overflow: 'hidden' },
          onClick: () => props.actions?.onOpenDiff?.(file),
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => onRowKey(event, file),
        },
          createElement('span', { className: 'pwr-git-status vk-badge', 'data-status-token': gitChangeStatusToken(file.status) }, gitChangeStatusToken(file.status)),
          createElement('span', { className: 'pwr-git-name ys-row-main' }, createElement('strong', null, file.name)),
          createElement('span', { className: 'ys-row-actions' },
            props.actions?.onOpenDiff === undefined ? null : createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); props.actions?.onOpenDiff?.(file) } }, t('git.diff')),
            props.actions?.onOpenFile === undefined ? null : createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); props.actions?.onOpenFile?.(file) } }, t('explorer.openFile')),
            props.mutationDisabled === true || props.actions?.onStage === undefined ? null : createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); props.actions?.onStage?.(file) } }, t('git.stage')),
          ),
        )),
      ),
    ),
  )
}

export function GitDiffView(props: { readonly window: GitDiffWindowStateV1 }): ReactNode {
  const complete = gitDiffLooksComplete(props.window)
  return createElement(Surface, {
    kind: 'inspector',
    className: 'pwr-git-diff',
    'data-git-diff-complete': complete,
    style: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  },
    createElement(SurfaceContextBar, { context: `${props.window.loaded}/${props.window.total}` }),
    props.window.binary
      ? createElement('p', { role: 'status' }, t('git.binaryFallback'))
      : createElement('ol', {
        'data-git-scroll-region': 'diff',
        tabIndex: 0,
        style: { flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain' },
      }, ...props.window.hunks.filter(hunk => hunk.loaded).map(hunk =>
        createElement('li', { key: hunk.hunkRef, 'data-hunk': hunk.hunkRef }, hunk.header))),
    complete ? null : createElement('p', { role: 'status', 'data-git-diff-unloaded': true }, t('git.diffUnloaded')),
  )
}

export function SourceControlShell(props: SourceControlShellProps): ReactNode {
  const grouped = useMemo(() => groupGitChanges(props.shell.files), [props.shell.files])
  const visible = visibleGitChangeGroups(props.shell.files)
  const stagedCount = grouped.staged.length
  const remoteGate = props.remoteGate ?? createGitRemoteGate(false, [], t('git.remoteUnavailable'))
  const remoteReason = gitRemoteReadOnlyReason(remoteGate)
  const branch = `${t('git.branch')}: ${props.shell.branch ?? '—'} ${props.shell.upstream ?? ''} +${props.shell.ahead}/-${props.shell.behind}`
  const refresh = actionButton(t('explorer.refresh'), props.actions?.onRefresh)
  const repositorySelect = createElement('label', { className: 'ys-field pwr-repository-field' },
      createElement('span', null, t('git.repository')),
        createElement('select', {
          'aria-label': t('git.repository'),
          value: props.shell.worktreeRef ?? '',
          onChange: (event: { currentTarget: { value: string } }) => {
            const option = (props.repositories ?? []).find(item => item.worktreeRef === event.currentTarget.value)
            if (option !== undefined) props.actions?.onSelectRepository?.(option)
          },
        }, ...(props.repositories ?? []).map(option => createElement('option', { key: option.worktreeRef, value: option.worktreeRef }, option.label))),
  )
  const composer = stagedCount === 0 ? null : createElement('form', {
      className: 'pwr-git-composer vk-card',
      onSubmit: (event: { preventDefault(): void }) => {
        event.preventDefault()
        if (props.mutationDisabled === true) return
        props.actions?.onCommit?.(props.shell.commitMessage)
      },
    },
      createElement('label', { className: 'ys-field' }, createElement('span', null, t('git.commitMessage')),
        createElement('textarea', { 'aria-label': t('git.commitMessage'), value: props.shell.commitMessage, readOnly: true }),
      ),
      createElement(Button, { type: 'submit', size: 'sm', variant: 'primary', disabled: props.mutationDisabled === true || props.shell.commitMessage.trim() === '' }, t('git.commit')),
    )
  const state = props.shell.phase === 'ready' ? null : createElement(SurfaceState, {
    className: 'pwr-git-state',
    phase: surfacePhase(props.shell.phase),
    title: recoveryLabel(props.shell.phase),
    description: props.shell.phase === 'clean' || props.shell.phase === 'empty'
      ? props.shell.recentCommit ?? branch
      : props.shell.reason ?? props.mutationReason,
    'data-git-recovery': props.shell.recoveryAction ?? 'refresh',
  })
  const mutationNotice = props.mutationDisabled === true && props.mutationReason !== undefined
    ? createElement('div', { className: 'vk-alert', 'data-tone': 'warn', role: 'status' }, props.mutationReason)
    : null
  return createElement(Surface, { kind: 'navigator', className: 'pwr-source-control', 'data-git-phase': props.shell.phase },
    createElement(SurfaceContextBar, { context: branch, actions: createElement('div', { className: 'ys-row-actions' }, repositorySelect, refresh) }),
    createElement('div', { className: 'ys-body' },
      state,
      mutationNotice,
      composer,
      ...visible.map(groupId => createElement(SurfaceSection, { key: groupId, className: 'pwr-git-group', 'data-git-group': groupId, title: t(groupId === 'merge' ? 'git.merge' : groupId === 'staged' ? 'git.staged' : groupId === 'untracked' ? 'git.untracked' : 'git.changes'), meta: grouped[groupId].length },
      createElement(GitChangesList, { files: grouped[groupId], viewportHeight: props.viewportHeight, scrollTop: props.scrollTop, mutationDisabled: props.mutationDisabled, actions: props.actions }),
      )),
    ),
    createElement(SurfaceActionBar, { className: 'pwr-git-actions', sticky: true },
      actionButton('History', props.actions?.onHistory),
      props.branchGate !== undefined && gitBranchActionVisible(props.branchGate, 'create') && props.actions?.onBranchAction !== undefined
        ? actionButton(t('git.branchCreate'), () => props.actions?.onBranchAction?.('create'))
        : null,
      props.worktreeGate !== undefined && gitWorktreeActionVisible(props.worktreeGate, 'create') && props.actions?.onWorktreeAction !== undefined
        ? actionButton(t('git.worktreeCreate'), () => props.actions?.onWorktreeAction?.('create'))
        : null,
      ...(props.worktrees ?? []).map(row => {
        const blocker = blockWorktreeRemove(row)
        const enabled = props.worktreeGate !== undefined && gitWorktreeActionVisible(props.worktreeGate, 'remove') && !blocker.blocked
        return createElement('span', { key: row.worktreeRef, 'data-ordo-deeplink': blocker.deepLink },
          createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: !enabled, title: blocker.blocked ? blocker.reason : undefined, onClick: () => { if (enabled) props.actions?.onWorktreeAction?.('remove', row) } }, row.label),
        )
      }),
      remoteReason === undefined && gitRemoteActionVisible(remoteGate, 'fetch') && props.actions?.onRemoteAction !== undefined
        ? actionButton(t('git.fetch'), () => props.actions?.onRemoteAction?.('fetch'))
        : null,
      remoteReason === undefined && gitRemoteActionVisible(remoteGate, 'pull') && props.actions?.onRemoteAction !== undefined
        ? actionButton(t('git.pull'), () => props.actions?.onRemoteAction?.('pull'))
        : null,
      remoteReason === undefined && gitRemoteActionVisible(remoteGate, 'push') && props.actions?.onRemoteAction !== undefined
        ? actionButton(t('git.push'), () => props.actions?.onRemoteAction?.('push'))
        : createElement('p', { role: 'status', 'data-git-remote-readonly': true }, remoteReason ?? `${t('git.aheadBehind')}: +${props.remote?.ahead ?? props.shell.ahead}/-${props.remote?.behind ?? props.shell.behind}`),
    ),
  )
}

export function SourceControlView(_props: PaneLocalViewProps): ReactNode {
  const shell = createGitStatusShell({ phase: classifyGitShellPhase({ files: [] }) })
  return createElement(SourceControlShell, { shell })
}

// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { setActiveLocale } from '../src/i18n/locale.js'
import { PaneWorkbenchController } from '../src/controller.js'
import {
  applyGitCursorGap,
  blockWorktreeRemove,
  classifyGitShellPhase,
  createGitBranchGate,
  createGitDiffWindow,
  createGitMutationIntent,
  createGitRemoteGate,
  createGitStatusShell,
  createGitWorktreeGate,
  createRemotePreflight,
  DSH_SOURCE_CONTROL_VIEW_KIND,
  gitBranchActionVisible,
  gitChangeStatusToken,
  gitClientTimeoutAutoRetries,
  gitClientTimeoutMarksSuccess,
  gitDiffLooksComplete,
  gitDiffRevisionDrift,
  gitDiffTargetActionEnabled,
  gitDiffUnloadedRangeLooksComplete,
  gitPaneReleasesOrdoLease,
  gitRemoteActionVisible,
  gitRemoteForcePushDefault,
  gitRemoteReadOnlyReason,
  gitWorktreeActionVisible,
  groupGitChanges,
  moveGitDiffHunk,
  openSourceControlNavigator,
  reconcileClientGitReceipt,
  registerPaneWorkbenchCoreViews,
  validateClientGitMutationIntent,
  visibleGitChangeGroups,
  windowVirtualRows,
  type GitChangedFileV1,
} from '../src/index.js'
import { GitChangesList, GitDiffView, SourceControlShell } from '../src/git/source-control.js'
import { PaneViewRegistry } from '../src/view-registry.js'

afterEach(() => {
  setActiveLocale('en')
  cleanup()
})

function file(partial: Partial<GitChangedFileV1> & Pick<GitChangedFileV1, 'fileRef' | 'name' | 'status' | 'group'>): GitChangedFileV1 {
  return partial
}

describe('V4 Task 5.2 Source Control Shell', () => {
  it('registers the singleton provider and renders recovery UI for every non-ready phase', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registerPaneWorkbenchCoreViews(registry)
    const controller = new PaneWorkbenchController({ registry })
    openSourceControlNavigator(controller)
    expect(Object.values(controller.getSnapshot().views).filter(view => view.kind === DSH_SOURCE_CONTROL_VIEW_KIND)).toHaveLength(1)
    const phases = ['clean', 'empty', 'loading', 'error', 'partial', 'stale', 'offline'] as const
    for (const phase of phases) {
      const view = render(createElement(SourceControlShell, {
        shell: createGitStatusShell({ phase, recoveryAction: phase === 'stale' ? 'reconcile' : 'refresh', reason: phase }),
        actions: { onRefresh: () => undefined },
      }))
      expect(document.querySelector(`[data-git-phase="${phase}"]`)).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
      view.unmount()
    }
    expect(classifyGitShellPhase({ files: [] })).toBe('clean')
  })

  it('shows merge before staged/changes/untracked and hides empty groups', () => {
    const files = [
      file({ fileRef: 'file:a', name: 'a.ts', status: 'conflict', group: 'merge' }),
      file({ fileRef: 'file:b', name: 'b.ts', status: 'staged', group: 'staged' }),
      file({ fileRef: 'file:c', name: 'c.ts', status: 'untracked', group: 'untracked' }),
    ]
    render(createElement(SourceControlShell, { shell: createGitStatusShell({ phase: 'ready', files }) }))
    const groups = [...document.querySelectorAll('[data-git-group]')].map(node => node.getAttribute('data-git-group'))
    expect(groups).toEqual(['merge', 'staged', 'untracked'])
    expect(visibleGitChangeGroups(files)).toEqual(['merge', 'staged', 'untracked'])
  })

  it('uses shared navigator chrome, hides the composer when clean, and shows recent commit', () => {
    render(createElement(SourceControlShell, {
      shell: createGitStatusShell({ phase: 'clean', branch: 'main', recentCommit: 'abc123 fix pane chrome' }),
      repositories: [{ repositoryRef: 'repo:one', worktreeRef: 'wt:one', label: 'yeisme-agent' }],
      actions: { onRefresh: () => undefined, onHistory: () => undefined },
    }))
    expect(document.querySelector('[data-yeisme-surface][data-surface-kind="navigator"]')).toBeTruthy()
    expect(document.querySelector('.pwr-repository-field.ys-field')).toBeTruthy()
    expect(screen.getByText('abc123 fix pane chrome')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Commit message' })).toBeNull()
    expect(screen.getByRole('button', { name: 'History' })).toBeTruthy()
  })

  it('shows the composer only for staged changes and preserves safe groups while stale', () => {
    const staged = file({ fileRef: 'file:staged', name: 'staged.ts', status: 'staged', group: 'staged' })
    const { rerender } = render(createElement(SourceControlShell, {
      shell: createGitStatusShell({ phase: 'ready', commitMessage: 'fix', files: [staged] }),
      mutationDisabled: false,
      actions: { onCommit: () => undefined, onOpenDiff: () => undefined },
    }))
    expect(screen.getByRole('textbox', { name: 'Commit message' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Commit' })).toBeTruthy()
    rerender(createElement(SourceControlShell, {
      shell: createGitStatusShell({ phase: 'stale', reason: 'cursor gap', files: [staged] }),
      mutationDisabled: true,
      mutationReason: 'Reconcile required',
      actions: { onRefresh: () => undefined, onOpenDiff: () => undefined },
    }))
    expect(document.querySelector('[data-git-group="staged"]')).toBeTruthy()
    expect(screen.getByText('cursor gap')).toBeTruthy()
    expect(screen.getByText('Reconcile required')).toBeTruthy()
  })
})

describe('V4 Task 5.3 Changes List', () => {
  it('virtualizes 2000 rows and keeps Open Diff separate from Open File', () => {
    const files = Array.from({ length: 2_000 }, (_, index) => file({
      fileRef: `file:${index}`,
      name: `f${index}.ts`,
      status: index % 2 === 0 ? 'modified' : 'staged',
      group: 'changes',
    }))
    const opened: string[] = []
    const windowed = windowVirtualRows(files, 0, 280, 28)
    expect(windowed.items.length).toBeLessThan(40)
    expect(windowed.total).toBe(2_000)
    render(createElement(GitChangesList, {
      files,
      viewportHeight: 280,
      actions: {
        onOpenDiff: current => opened.push(`diff:${current.fileRef}`),
        onOpenFile: current => opened.push(`file:${current.fileRef}`),
      },
    }))
    const first = screen.getAllByRole('option')[0]!
    expect(first.querySelector('[data-status-token]')?.textContent).toBe(gitChangeStatusToken('modified'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Diff' })[0]!)
    fireEvent.click(screen.getAllByRole('button', { name: 'Open File' })[0]!)
    expect(opened).toEqual(['diff:file:0', 'file:file:0'])
    fireEvent.keyDown(first, { key: 'F10', shiftKey: true })
    expect(groupGitChanges(files).changes).toHaveLength(2_000)
  })

  it('owns its scroll position without scrolling the diff region', () => {
    const files = Array.from({ length: 100 }, (_, index) => file({
      fileRef: `file:${index}`,
      name: `f${index}.ts`,
      status: 'modified',
      group: 'changes',
    }))
    render(createElement('div', null,
      createElement(GitChangesList, { files, viewportHeight: 84 }),
      createElement(GitDiffView, { window: createGitDiffWindow({
        fileRef: 'file:0',
        loaded: 1,
        total: 1,
        baseRevision: 'a',
        targetRevision: 'b',
        currentRevision: 'b',
        hunks: [{ hunkRef: 'h1', kind: 'add', header: '@@ 1 @@', loaded: true }],
      }) }),
    ))
    const changes = document.querySelector<HTMLElement>('[data-git-scroll-region="changes"]')!
    const diff = document.querySelector<HTMLElement>('[data-git-scroll-region="diff"]')!
    fireEvent.scroll(changes, { target: { scrollTop: 560 } })
    expect(document.querySelector('[data-git-file="file:20"]')).toBeTruthy()
    expect(diff.scrollTop).toBe(0)
    expect(changes.style.overscrollBehavior).toBe('contain')
    expect(diff.style.overscrollBehavior).toBe('contain')
  })
})

describe('V4 Task 5.4 Diff View', () => {
  it('shows loaded/total, refuses to look complete, and fail-closes on revision drift', () => {
    const window = createGitDiffWindow({
      fileRef: 'file:a',
      loaded: 1,
      total: 4,
      baseRevision: 'a',
      targetRevision: 'b',
      currentRevision: 'c',
      nextCursor: 'n2',
      hunks: [
        { hunkRef: 'h1', kind: 'add', header: '@@ 1 @@', loaded: true },
        { hunkRef: 'h2', kind: 'add', header: '@@ 2 @@', loaded: false },
      ],
    })
    expect(gitDiffLooksComplete(window)).toBe(false)
    expect(gitDiffUnloadedRangeLooksComplete(window)).toBe(false)
    expect(gitDiffRevisionDrift(window, 'b')).toBe(true)
    expect(gitDiffTargetActionEnabled(window, 'h2')).toBe(false)
    expect(moveGitDiffHunk(window, 'next').currentIndex).toBe(0)
    render(createElement(GitDiffView, { window }))
    expect(screen.getByText('1/4')).toBeTruthy()
    expect(document.querySelector('[data-git-diff-unloaded]')).toBeTruthy()
    const binary = createGitDiffWindow({
      fileRef: 'file:bin',
      loaded: 0,
      total: 0,
      baseRevision: 'a',
      targetRevision: 'a',
      currentRevision: 'a',
      hunks: [],
      binary: true,
    })
    cleanup()
    render(createElement(GitDiffView, { window: binary }))
    expect(screen.getByText(/Binary file/)).toBeTruthy()
  })
})

describe('V4 Task 5.5 Git Mutation Gateway', () => {
  it('validates typed intents and treats timeout as reconcile, not success', () => {
    const intent = createGitMutationIntent('commit', {
      repositoryRef: 'repo:one',
      worktreeRef: 'wt:one',
      expectedRevision: 'rev1',
      previewDigest: 'digest1',
      idempotencyKey: 'idemp-1',
      message: 'fix',
    })
    expect(validateClientGitMutationIntent(intent)).toBe(true)
    expect(validateClientGitMutationIntent({ ...intent, repositoryRef: '/tmp/repo' })).toBe(false)
    const timedOut = reconcileClientGitReceipt(intent, undefined, { timedOut: true })
    expect(timedOut.status).toBe('timeout')
    expect(gitClientTimeoutMarksSuccess()).toBe(false)
    expect(gitClientTimeoutAutoRetries()).toBe(false)
    expect(reconcileClientGitReceipt(intent, {
      status: 'ok',
      actionId: 'commit',
      idempotencyKey: 'other',
    }).status).toBe('reconcile_required')
  })
})

describe('V4 Task 5.6 Branch/Worktree', () => {
  it('gates branch and worktree actions and never releases an Ordo lease', () => {
    const branch = createGitBranchGate(true, ['create', 'switch'])
    expect(gitBranchActionVisible(branch, 'create')).toBe(true)
    expect(gitBranchActionVisible(branch, 'delete')).toBe(false)
    const worktree = createGitWorktreeGate(true, ['list', 'create', 'remove'])
    expect(gitWorktreeActionVisible(worktree, 'remove')).toBe(true)
    expect(gitPaneReleasesOrdoLease()).toBe(false)
    expect(worktree.releasesOrdoLease).toBe(false)
    const blocker = blockWorktreeRemove({
      worktreeRef: 'wt:busy',
      label: 'busy',
      lease: { blocked: true, leaseRef: 'lease:1', deepLink: 'ordo://lease/1', reason: 'writer lease' },
    })
    expect(blocker.blocked).toBe(true)
    expect(blocker.deepLink).toBe('ordo://lease/1')
    render(createElement(SourceControlShell, {
      shell: createGitStatusShell({ phase: 'ready', branch: 'main' }),
      branchGate: branch,
      worktreeGate: worktree,
      worktrees: [{ worktreeRef: 'wt:busy', label: 'busy', lease: blocker }],
    }))
    expect(screen.getByRole('button', { name: 'busy' })).toHaveProperty('disabled', true)
  })
})

describe('V4 Task 5.7 Remote Git', () => {
  it('shows read-only ahead/behind when remote capability is missing and never defaults force push', () => {
    const missing = createGitRemoteGate(false, [], 'GitRemoteActionsCapabilityV1 is unavailable')
    expect(gitRemoteActionVisible(missing, 'push')).toBe(false)
    expect(gitRemoteReadOnlyReason(missing)).toMatch(/unavailable/)
    expect(gitRemoteForcePushDefault()).toBe(false)
    expect(createRemotePreflight('push', { remote: 'origin', ref: 'main', ahead: 1, behind: 0 })?.force).toBe(false)
    render(createElement(SourceControlShell, {
      shell: createGitStatusShell({ phase: 'ready', ahead: 2, behind: 1 }),
      remoteGate: missing,
      remote: { remote: 'origin', ref: 'main', ahead: 2, behind: 1 },
    }))
    expect(screen.queryByRole('button', { name: 'Push' })).toBeNull()
    expect(document.querySelector('[data-git-remote-readonly]')).toBeTruthy()
    expect(applyGitCursorGap(createGitStatusShell({ phase: 'ready' }), 8, 2).phase).toBe('stale')
  })
})

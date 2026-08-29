// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GitPane, resolveGitShortcutBindings } from '../src/client/git-pane.tsx'

afterEach(cleanup)

describe('GitPane', () => {
  it('renders porcelain status files', async () => {
    render(<GitPane host={{
      async status() {
        return {
          branch: 'main',
          files: [{ path: 'README.md', index: ' ', worktree: 'M' }],
        }
      },
    }} />)
    expect(await screen.findByText('main')).toBeTruthy()
    expect(screen.getByText('README.md')).toBeTruthy()
    expect(screen.getByRole('tab', { name: '更改' })).toBeTruthy()
    expect(screen.getByRole('tree', { name: '更改' })).toBeTruthy()
    expect(screen.getByTitle('修改').textContent).toBe('M')
    expect(screen.getByText(/GitTypedActionsCapabilityV1/)).toBeTruthy()
  })

  it('stages a changed file through typed actions', async () => {
    const staged: string[] = []
    render(<GitPane host={{
      capabilities: ['GitTypedActionsCapabilityV1'],
      async status() {
        return {
          branch: 'main',
          files: [{ path: 'README.md', index: ' ', worktree: 'M' }],
        }
      },
      async stage(path) {
        staged.push(path)
        return { status: 'ok', actionId: 'stage' }
      },
      async unstage() { return { status: 'ok', actionId: 'unstage' } },
      async commit() { return { status: 'ok', actionId: 'commit' } },
    }} />)
    expect(await screen.findByText('README.md')).toBeTruthy()
    fireEvent.click(screen.getByText('暂存'))
    await waitFor(() => { expect(staged).toEqual(['README.md']) })
  })

  it('groups porcelain XY states without losing a file that is staged and modified again', async () => {
    render(<GitPane host={{
      async status() {
        return {
          branch: 'feature/git-pane',
          files: [
            { path: 'src/both.ts', index: 'M', worktree: 'M' },
            { path: 'src/staged.ts', index: 'A', worktree: ' ' },
            { path: 'src/conflict.ts', index: 'U', worktree: 'U' },
            { path: 'notes.txt', index: '?', worktree: '?' },
          ],
        }
      },
    }} />)
    expect(await screen.findByText('feature/git-pane')).toBeTruthy()
    const groups = [...document.querySelectorAll('[data-git-group]')].map(node => node.getAttribute('data-git-group'))
    expect(groups).toEqual(['merge', 'staged', 'changes', 'untracked'])
    expect(screen.getAllByText('both.ts')).toHaveLength(2)
    expect(screen.getByTitle('冲突').textContent).toBe('!')
    expect(screen.getByTitle('未跟踪').textContent).toBe('A')
  })

  it('switches a large change group to a compact folder tree', async () => {
    render(<GitPane host={{
      async status() {
        return {
          branch: 'main',
          files: Array.from({ length: 6 }, (_, index) => ({
            path: `packages/client/ui/file-${index}.ts`,
            index: ' ',
            worktree: 'M',
          })),
        }
      },
    }} />)
    await screen.findByText('main')
    const tree = screen.getByRole('tree', { name: '更改' })
    expect(tree.getAttribute('data-tree-mode')).toBe('tree')
    const folder = within(tree).getByRole('button', { name: 'packages/client/ui' })
    expect(screen.queryByText('file-0.ts')).toBeNull()
    fireEvent.keyDown(folder, { key: 'ArrowRight' })
    expect(screen.getByText('file-0.ts')).toBeTruthy()
    fireEvent.keyDown(folder, { key: 'ArrowLeft' })
    expect(screen.queryByText('file-0.ts')).toBeNull()
  })

  it('renders semantic diff lines in the adaptive detail view', async () => {
    render(<GitPane host={{
      async status() {
        return { branch: 'main', files: [{ path: 'README.md', index: ' ', worktree: 'M' }] }
      },
      async diff(path) {
        return { path, patch: '@@ -1 +1 @@\n-old\n+new', truncated: false }
      },
    }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'README.md' }))
    expect((await screen.findByText('+new')).getAttribute('data-line')).toBe('add')
    expect(screen.getByText('-old').getAttribute('data-line')).toBe('delete')
    expect(screen.getByText('@@ -1 +1 @@').getAttribute('data-line')).toBe('hunk')
  })

  it('explains staged diff capability absence instead of showing the wrong worktree diff', async () => {
    render(<GitPane host={{
      capabilities: ['GitTypedActionsCapabilityV1'],
      async status() {
        return { branch: 'main', files: [{ path: 'staged.ts', index: 'M', worktree: ' ' }] }
      },
      async diff(path) { return { path, patch: 'wrong scope', truncated: false } },
      async stage() { return { status: 'ok', actionId: 'stage' } },
      async unstage() { return { status: 'ok', actionId: 'unstage' } },
      async commit() { return { status: 'ok', actionId: 'commit' } },
    }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'staged.ts' }))
    expect((await screen.findByRole('alert')).textContent).toContain('尚未提供已暂存差异')
  })

  it('commits only when a message and staged files are present', async () => {
    const messages: string[] = []
    render(<GitPane host={{
      capabilities: ['GitTypedActionsCapabilityV1'],
      async status() {
        return { branch: 'main', files: [{ path: 'staged.ts', index: 'M', worktree: ' ' }] }
      },
      async stage() { return { status: 'ok', actionId: 'stage' } },
      async unstage() { return { status: 'ok', actionId: 'unstage' } },
      async commit(message) {
        messages.push(message)
        return { status: 'ok', actionId: 'commit' }
      },
    }} />)
    const input = await screen.findByRole('textbox', { name: '提交说明' })
    const commit = screen.getByRole('button', { name: '提交 1' })
    expect((commit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'refine git pane' } })
    expect((commit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(commit)
    await waitFor(() => { expect(messages).toEqual(['refine git pane']) })
  })

  it('keeps future GitLens-style views navigable while capabilities are absent', async () => {
    render(<GitPane host={{ async status() { return { branch: 'main', files: [] } } }} />)
    fireEvent.click(await screen.findByRole('tab', { name: '历史' }))
    expect(screen.getByText('当前 Git host 尚未提供该视图的数据能力。入口保留，能力接入后会在这里显示真实 owner projection。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '返回更改' }))
    expect(screen.getByText('工作区干净')).toBeTruthy()
  })

  it('presents branch and worktree capabilities as one navigable resource workspace', async () => {
    const requestedWorktrees: string[] = []
    render(<GitPane repositories={[
      { repositoryRef: 'repo:one', worktreeRef: 'wt:main', label: 'main workspace' },
      { repositoryRef: 'repo:one', worktreeRef: 'wt:agent', label: 'agent review', agentWorktree: true },
    ]} host={{
      async status() { return { branch: 'fallback', files: [] } },
      statusWindow: { capability: 'GitStatusWindowCapabilityV1', async snapshot(request) {
        requestedWorktrees.push(request.worktreeRef)
        return {
          repositoryRef: request.repositoryRef, worktreeRef: request.worktreeRef,
          branch: request.worktreeRef === 'wt:agent' ? 'feature/agent-review' : 'main', revision: `rev:${request.worktreeRef}`, cursor: `cursor:${request.worktreeRef}`, sequence: requestedWorktrees.length, freshness: 'fresh',
          counts: { merge: 0, staged: 0, changes: 0, untracked: 0, lowSignal: 0 }, files: [], loaded: 0, total: 0,
        }
      } },
      branchActions: { capability: 'GitBranchActionsCapabilityV1', actions: ['list', 'create', 'switch'] },
      worktreeActions: { capability: 'GitWorktreeActionsCapabilityV2', actions: ['list', 'create', 'remove'], releasesOrdoLease: false },
    }} />)

    await screen.findByText('main')
    fireEvent.click(screen.getByRole('tab', { name: '分支' }))
    expect(screen.getByRole('heading', { name: '分支' })).toBeTruthy()
    expect(screen.getByText(/新建分支/)).toBeTruthy()
    expect(screen.getByText(/切换分支/)).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: '工作树' }))
    expect(screen.getByRole('heading', { name: '工作树' })).toBeTruthy()
    const agentWorktree = screen.getByRole('button', { name: /agent review/ })
    expect(agentWorktree.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(agentWorktree)
    await waitFor(() => { expect(requestedWorktrees.at(-1)).toBe('wt:agent') })
    expect(screen.getByText(/Git Pane 只切换工作树上下文/)).toBeTruthy()
  })

  it('renders owner-projected stash and tag resources from the Git view selector', async () => {
    render(<GitPane host={{
      async status() { return { branch: 'main', files: [] } },
      stashProjection: { capability: 'GitStashProjectionCapabilityV1', freshness: 'fresh', stashRefs: ['stash@{0}'] },
      stashActions: { capability: 'GitStashActionsCapabilityV1', actions: ['create', 'apply', 'pop', 'drop'] },
      tagProjection: { capability: 'GitTagProjectionCapabilityV1', freshness: 'fresh', tagRefs: ['v0.1.0-rc.1'] },
      tagActions: { capability: 'GitTagActionsCapabilityV1', actions: ['create', 'delete', 'push'], defaultKind: 'annotated', signing: 'repository_config' },
    }} />)
    await screen.findByText('main')
    const selector = screen.getByRole('combobox', { name: '更多 Git 视图' })
    fireEvent.change(selector, { target: { value: 'stashes' } })
    expect(screen.getByText('stash@{0}')).toBeTruthy()
    expect(screen.getByText(/弹出储藏/)).toBeTruthy()
    fireEvent.change(selector, { target: { value: 'tags' } })
    expect(screen.getByText('v0.1.0-rc.1')).toBeTruthy()
    expect(screen.getByText(/推送标签/)).toBeTruthy()
  })

  it('defaults to a risk-sorted review queue when Ordo evidence is available', async () => {
    const base = {
      repositoryRef: 'repo:one', worktreeRef: 'wt:one', revision: 'rev:one', branch: 'feature/review', leaseActive: true, paused: false,
      conflictCount: 0, reviewableHunkCount: 2, reviewedHunkCount: 1, verification: 'passed' as const, feedback: [], hunks: [], approvalPending: false,
      lastActivityAt: '2026-08-28T10:00:00.000Z', overrideEvidenceRefs: [],
    }
    render(<GitPane host={{ async status() { return { branch: 'main', files: [] } } }} review={{
      capability: 'GitReviewEvidenceCapabilityV1',
      async snapshot() {
        return {
          workspaceRef: 'workspace:current', cursor: 'cursor:one', sequence: 1, freshness: 'fresh', loaded: 2, total: 2,
          rows: [
            { ...base, queueRef: 'queue:approval', taskLabel: '待审批任务', risk: 'approval' as const },
            { ...base, queueRef: 'queue:conflict', taskLabel: '冲突任务', risk: 'conflict' as const, conflictCount: 1 },
          ],
        }
      },
    }} />)
    expect((await screen.findByRole('tab', { name: '审查队列' })).getAttribute('aria-selected')).toBe('true')
    const rows = document.querySelectorAll('.git-queue-row strong')
    expect(rows[0]?.textContent).toBe('冲突任务')
    expect(rows[1]?.textContent).toBe('待审批任务')
  })

  it('keeps owner-classified generated files in a collapsed low-signal group', async () => {
    render(<GitPane host={{ async status() { return { branch: 'main', files: [{ path: 'dist/generated.js', index: ' ', worktree: 'M', generated: true }] } } }} />)
    const heading = await screen.findByRole('button', { name: /生成 \/ 低信号/ })
    expect(heading.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('generated.js')).toBeNull()
    fireEvent.click(heading)
    expect(screen.getByText('generated.js')).toBeTruthy()
  })

  it('renders V2 secret-risk diff and dispatches revision-bound hunk review', async () => {
    const dispatched: string[] = []
    const review = {
      capability: 'GitReviewEvidenceCapabilityV1' as const,
      async snapshot() {
        return {
          workspaceRef: 'workspace:current', cursor: 'cursor:review', sequence: 1, freshness: 'fresh' as const, loaded: 1, total: 1,
          rows: [{
            queueRef: 'queue:one', repositoryRef: 'repo:one', worktreeRef: 'wt:one', revision: 'rev:one', agentRef: 'agent:one', branch: 'feature/review', leaseActive: true, paused: false,
            conflictCount: 0, reviewableHunkCount: 1, reviewedHunkCount: 0, verification: 'passed' as const, feedback: [], hunks: [], approvalPending: false,
            lastActivityAt: '2026-08-28T10:00:00.000Z', overrideEvidenceRefs: [], risk: 'none' as const,
          }],
        }
      },
      async dispatch(intent: { action: string }) { dispatched.push(intent.action); return { status: 'ok' as const, action: 'review.hunk' as const, idempotencyKey: 'idempotency:review' } },
    }
    render(<GitPane repositories={[{ repositoryRef: 'repo:one', worktreeRef: 'wt:one', label: 'feature/review', agentWorktree: true }]} review={review} host={{
      async status() { return { branch: 'fallback', files: [] } },
      statusWindow: { capability: 'GitStatusWindowCapabilityV1', async snapshot() { return {
        repositoryRef: 'repo:one', worktreeRef: 'wt:one', branch: 'feature/review', revision: 'rev:one', cursor: 'cursor:status', sequence: 1, freshness: 'fresh',
        counts: { merge: 0, staged: 0, changes: 1, untracked: 0, lowSignal: 0 }, files: [{ fileRef: 'file:one', pathLabel: 'src/secret.ts', status: 'modified', group: 'changes', generated: false, lowSignal: false, hunkCount: 1 }], loaded: 1, total: 1,
      } } },
      diffWindowV2: { capability: 'GitDiffWindowCapabilityV2', async window(request) { return {
        repositoryRef: request.repositoryRef, worktreeRef: request.worktreeRef, fileRef: request.fileRef, layout: request.layout,
        baseRevision: 'rev:base', targetRevision: 'rev:one', currentRevision: 'rev:one', cursor: 'cursor:diff', freshness: 'fresh',
        hunks: [{ hunkRef: 'hunk:one', header: '@@ -1 +1 @@', lines: ['-TOKEN=old', '+TOKEN=new'], loaded: true }], loaded: 1, total: 1,
        generated: false, binary: false, secretRisk: 'secret_suspected', allowedActions: ['review'],
      } } },
    }} />)
    fireEvent.click(await screen.findByRole('tab', { name: '更改' }))
    fireEvent.click(await screen.findByRole('button', { name: /secret\.ts/ }))
    expect(await screen.findByText(/疑似 credential/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '标记已审查' }))
    await waitFor(() => { expect(dispatched).toEqual(['review.hunk']) })
  })

  it('uses commit preflight and executes commit without auto-stage', async () => {
    const actions: string[] = []
    render(<GitPane repositories={[{ repositoryRef: 'repo:one', worktreeRef: 'wt:one', label: 'main' }]} host={{
      async status() { return { branch: 'fallback', files: [] } },
      statusWindow: { capability: 'GitStatusWindowCapabilityV1', async snapshot() { return {
        repositoryRef: 'repo:one', worktreeRef: 'wt:one', branch: 'main', revision: 'rev:one', cursor: 'cursor:one', sequence: 1, freshness: 'fresh',
        counts: { merge: 0, staged: 1, changes: 0, untracked: 0, lowSignal: 0 }, files: [{ fileRef: 'file:one', pathLabel: 'src/staged.ts', status: 'modified', group: 'staged', generated: false, lowSignal: false }], loaded: 1, total: 1,
      } } },
      mutationActionsV2: {
        capability: 'GitMutationActionsCapabilityV2', actions: ['commit.preflight', 'commit.execute'],
        async preflight(intent) { actions.push(intent.action); return { action: intent.action, repositoryRef: intent.repositoryRef, worktreeRef: intent.worktreeRef, revision: intent.expectedRevision, previewDigest: 'digest:one', targetCount: 1, branch: 'main', signing: 'enabled', hooks: 'required', verification: 'not_required', risks: [], allowed: true } },
        async execute(intent) { actions.push(intent.action); return { status: 'ok', action: intent.action, idempotencyKey: intent.idempotencyKey, revision: 'rev:two' } },
        async reconcile() { return undefined },
      },
    }} />)
    fireEvent.change(await screen.findByRole('textbox', { name: '提交说明' }), { target: { value: 'reviewed commit' } })
    fireEvent.click(screen.getByRole('button', { name: '提交 1' }))
    expect(await screen.findByRole('complementary', { name: 'Git 操作预检' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    await waitFor(() => { expect(actions).toEqual(['commit.preflight', 'commit.execute']) })
    expect(actions).not.toContain('stage.all')
  })

  it('fail-closes conflicting VS Code-style shortcut bindings', () => {
    const bindings = resolveGitShortcutBindings({ 'Mod+Shift+G': 'workbench.otherGit', F7: 'debug.step' })
    expect(bindings.find(item => item.commandId === 'git.open')).toMatchObject({ enabled: false, conflictWith: 'workbench.otherGit' })
    expect(bindings.find(item => item.commandId === 'git.diff.next')).toMatchObject({ enabled: false, conflictWith: 'debug.step' })
    expect(bindings.find(item => item.commandId === 'git.preflight.confirm')?.enabled).toBe(true)
  })

  it('keeps a 10,000-file repository bounded to the owner window', async () => {
    let requestedLimit = 0
    render(<GitPane repositories={[{ repositoryRef: 'repo:large', worktreeRef: 'wt:large', label: 'large' }]} host={{
      async status() { return { branch: 'fallback', files: [] } },
      statusWindow: { capability: 'GitStatusWindowCapabilityV1', async snapshot(request) { requestedLimit = request.limit; return {
        repositoryRef: 'repo:large', worktreeRef: 'wt:large', branch: 'main', revision: 'rev:large', cursor: 'cursor:large', sequence: 1, freshness: 'fresh',
        counts: { merge: 0, staged: 0, changes: 200, untracked: 0, lowSignal: 0 },
        files: Array.from({ length: 200 }, (_, index) => ({ fileRef: `file:${index}`, pathLabel: `src/file-${index}.ts`, status: 'modified' as const, group: 'changes' as const, generated: false, lowSignal: false })),
        loaded: 200, total: 10_000, nextCursor: 'cursor:next',
      } } },
    }} />)
    expect(await screen.findByText('200/10000')).toBeTruthy()
    expect(requestedLimit).toBe(200)
    expect(screen.queryByText('file-200.ts')).toBeNull()
    expect(screen.getByRole('button', { name: '下一页' })).toBeTruthy()
  })

  it('pins a safe two-commit Compare Session from the history inspector', async () => {
    const created: string[][] = []
    render(<GitPane repositories={[{ repositoryRef: 'repo:one', worktreeRef: 'wt:one', label: 'main' }]} host={{
      async status() { return { branch: 'main', files: [], repositoryRef: 'repo:one', worktreeRef: 'wt:one', revision: 'rev:history' } },
      historyWindow: { capability: 'GitHistoryWindowCapabilityV1', async window() { return {
        repositoryRef: 'repo:one', worktreeRef: 'wt:one', revision: 'rev:history', cursor: 'cursor:history', freshness: 'fresh', loaded: 2, total: 1_000_000,
        commits: [
          { commitRef: 'a'.repeat(40), parentRefs: ['b'.repeat(40)], graph: '●', message: 'latest', refs: ['HEAD'], author: 'dev', authoredAt: '2026-08-28T10:00:00Z', additions: 2, deletions: 1, changedFiles: 1 },
          { commitRef: 'b'.repeat(40), parentRefs: [], graph: '●', message: 'base', refs: [], author: 'dev', authoredAt: '2026-08-27T10:00:00Z', additions: 1, deletions: 0, changedFiles: 1 },
        ],
      } } },
      compareSession: { capability: 'GitCompareSessionCapabilityV1', async create(input) { created.push([input.baseRef, input.targetRef]); return { ...input, sessionRef: 'compare:one' } } },
    }} />)
    fireEvent.click(await screen.findByRole('tab', { name: '历史' }))
    fireEvent.click(await screen.findByRole('button', { name: /latest/ }))
    fireEvent.click(screen.getByRole('button', { name: /base/ }))
    fireEvent.click(screen.getByRole('button', { name: '固定比较' }))
    await waitFor(() => { expect(created).toEqual([['b'.repeat(40), 'a'.repeat(40)]]) })
    expect(screen.getByText(/Compare Session compare:one/)).toBeTruthy()
  })

  it('records Ordo override evidence before an Agent commit executes', async () => {
    const sequence: string[] = []
    render(<GitPane repositories={[{ repositoryRef: 'repo:one', worktreeRef: 'wt:one', label: 'agent', agentWorktree: true }]} review={{
      capability: 'GitReviewEvidenceCapabilityV1',
      async snapshot() { return { workspaceRef: 'workspace:current', cursor: 'cursor:review', sequence: 1, freshness: 'fresh', loaded: 1, total: 1, rows: [{
        queueRef: 'queue:one', repositoryRef: 'repo:one', worktreeRef: 'wt:one', revision: 'rev:one', agentRef: 'agent:one', branch: 'feature/agent', leaseActive: true, paused: false,
        conflictCount: 0, reviewableHunkCount: 1, reviewedHunkCount: 1, verification: 'failed', feedback: [], hunks: [], approvalPending: false,
        lastActivityAt: '2026-08-28T10:00:00Z', overrideEvidenceRefs: [], risk: 'verification_failed',
      }] } },
      async dispatch(intent) { sequence.push(intent.action); return { status: 'ok', action: intent.action, idempotencyKey: intent.idempotencyKey, evidenceRef: 'evidence:override' } },
    }} host={{
      async status() { return { branch: 'feature/agent', repositoryRef: 'repo:one', worktreeRef: 'wt:one', revision: 'rev:one', files: [{ path: 'src/staged.ts', fileRef: 'file:one', index: 'M', worktree: ' ' }] } },
      mutationActionsV2: {
        capability: 'GitMutationActionsCapabilityV2', actions: ['commit.preflight', 'commit.execute'],
        async preflight(intent) { return { action: intent.action, repositoryRef: intent.repositoryRef, worktreeRef: intent.worktreeRef, revision: intent.expectedRevision, previewDigest: 'digest:override', targetCount: 1, branch: 'feature/agent', signing: 'disabled', hooks: 'unknown', verification: 'failed', risks: ['override'], allowed: true } },
        async execute(intent) { sequence.push(intent.action); return { status: 'ok', action: intent.action, idempotencyKey: intent.idempotencyKey } },
        async reconcile() { return undefined },
      },
    }} />)
    fireEvent.click(await screen.findByRole('tab', { name: '更改' }))
    fireEvent.change(await screen.findByRole('textbox', { name: '提交说明' }), { target: { value: 'override verification' } })
    fireEvent.change(screen.getByRole('textbox', { name: '覆盖理由' }), { target: { value: 'verified manually with evidence' } })
    fireEvent.click(screen.getByRole('button', { name: '提交 1' }))
    fireEvent.click(await screen.findByRole('button', { name: '确认' }))
    await waitFor(() => { expect(sequence).toEqual(['commit.override', 'commit.execute']) })
  })
})

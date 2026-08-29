// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConversationManager } from '../src/client/conversation-manager.tsx'
import type {
  BatchPlanV1,
  BatchReceiptV1,
  SessionOrganizationRemoteFace,
  SessionOrganizationSnapshotV1,
} from '@yeisme/dsh-client-ui-session-tags/client'

afterEach(cleanup)

const sessions = [
  { sessionId: 's1', title: '历史搜索设计', workspaceRef: 'w1', workspaceName: 'Alpha', tags: ['history'], status: 'idle' as const, archived: false, updatedAt: '2026-08-28' },
  { sessionId: 's2', title: '修复登录错误', workspaceRef: 'w1', workspaceName: 'Alpha', tags: ['bug'], status: 'attention' as const, archived: false },
  { sessionId: 's3', title: '旧发布记录', workspaceRef: 'w2', workspaceName: 'Beta', tags: ['release'], status: 'completed' as const, archived: true },
]

function baseSnapshot(): SessionOrganizationSnapshotV1 {
  return {
    ok: true,
    specVersion: '1.0',
    functionTypes: [
      { id: 'planning', name: '规划', color: 'info', scope: { kind: 'global' }, order: 0, active: true, version: 'b1', updatedAt: 0 },
      { id: 'debugging', name: '调试', color: 'warning', scope: { kind: 'global' }, order: 1, active: true, version: 'b2', updatedAt: 0 },
    ],
    assignments: [
      { sessionId: 's1', workspaceRef: 'w1', functionTypeId: 'planning', functionSource: 'automatic', functionLocked: false, tagsLocked: false, classificationStatus: 'classified', confidence: 0.9, version: 'a1', updatedAt: 1 },
      { sessionId: 's2', workspaceRef: 'w1', functionTypeId: 'debugging', functionSource: 'automatic', functionLocked: false, tagsLocked: false, classificationStatus: 'needs_review', confidence: 0.7, version: 'a2', updatedAt: 1 },
    ],
    tagCatalog: [],
    rules: [],
    recentBatches: [],
  }
}

function fakeRemote() {
  let snapshot = baseSnapshot()
  const plan: BatchPlanV1 = {
    id: 'p1', decisionRef: 'd1', action: { type: 'set-function', functionTypeId: 'planning' },
    targets: [{ sessionId: 's1', workspaceRef: 'w1', assignmentVersion: 'a1', tagsVersion: null }],
    createdAt: 1, expiresAt: Date.now() + 10000,
  }
  const receipt: BatchReceiptV1 = {
    id: 'r1', planId: 'p1', action: plan.action, status: 'ok',
    items: [{ sessionId: 's1', status: 'ok' }], createdAt: 2, undoExpiresAt: Date.now() + 10000,
  }
  const remote: SessionOrganizationRemoteFace = {
    snapshot: vi.fn(async () => snapshot),
    setAssignment: vi.fn(async () => { throw new Error('unused') }),
    putFunctionType: vi.fn(async () => { throw new Error('unused') }),
    putTagCatalog: vi.fn(async () => { throw new Error('unused') }),
    putRule: vi.fn(async input => {
      snapshot = { ...snapshot, rules: [...snapshot.rules, { ...input.value, version: 'rule-v1', updatedAt: 2 }] }
      return { ok: true as const, value: snapshot.rules[0]! }
    }),
    classify: vi.fn(async () => { throw new Error('unused') }),
    planBatch: vi.fn(async input => ({ ok: true as const, plan: { ...plan, action: input.action, targets: input.targets.map(target => ({ ...target, assignmentVersion: null, tagsVersion: null })) } })),
    executeBatch: vi.fn(async () => {
      snapshot = { ...snapshot, recentBatches: [receipt] }
      return { ok: true as const, receipt }
    }),
    undoBatch: vi.fn(async () => ({ ok: true as const, receipt: { ...receipt, id: 'undo', undoExpiresAt: null } })),
    unlockAdmin: vi.fn(async () => ({ ok: true as const, token: 'admin', expiresAt: Date.now() + 10000 })),
  }
  return remote
}

describe('ConversationManager', () => {
  it('renders dense organization data and filters by function', async () => {
    render(<ConversationManager sessions={sessions} organization={fakeRemote()} />)
    expect(await screen.findByRole('heading', { name: '对话管理' })).toBeTruthy()
    expect(screen.getByText('历史搜索设计')).toBeTruthy()
    expect(screen.getByText('修复登录错误')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('功能'), { target: { value: 'debugging' } })
    expect(screen.queryByText('历史搜索设计')).toBeNull()
    expect(screen.getByText('修复登录错误')).toBeTruthy()
    expect(screen.getByText('待确认')).toBeTruthy()
  })

  it('selects all filtered rows, previews, and executes a receipt-gated batch', async () => {
    const remote = fakeRemote()
    render(<ConversationManager sessions={sessions} organization={remote} />)
    await screen.findByRole('heading', { name: '对话管理' })
    fireEvent.click(screen.getByLabelText('选择全部当前结果'))
    fireEvent.click(screen.getByRole('button', { name: '预览批次' }))
    expect(await screen.findByRole('dialog', { name: '确认批次' })).toBeTruthy()
    expect(screen.getByText(/将作用于 2 个会话/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '执行' }))
    await waitFor(() => expect(remote.executeBatch).toHaveBeenCalledWith({ planId: 'p1', decisionRef: 'd1' }))
    expect(await screen.findByText('批次完成：1/1')).toBeTruthy()
  })

  it('requires temporary admin before a purge preview', async () => {
    const remote = fakeRemote()
    render(<ConversationManager sessions={sessions} organization={remote} />)
    await screen.findByRole('heading', { name: '对话管理' })
    fireEvent.click(screen.getByLabelText('选择 历史搜索设计'))
    expect(screen.queryByRole('option', { name: '永久删除' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '临时解锁管理员' }))
    await waitFor(() => expect(remote.unlockAdmin).toHaveBeenCalled())
    expect(screen.getByRole('option', { name: '永久删除' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('批量动作'), { target: { value: 'purge' } })
    expect((screen.getByRole('button', { name: '预览批次' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('creates an ordered keyword rule from the current action', async () => {
    const remote = fakeRemote()
    render(<ConversationManager sessions={sessions} organization={remote} />)
    await screen.findByRole('heading', { name: '对话管理' })
    fireEvent.change(screen.getByLabelText('规则名称'), { target: { value: 'Bug 分类' } })
    fireEvent.change(screen.getByLabelText('规则关键词'), { target: { value: 'error' } })
    fireEvent.click(screen.getByRole('button', { name: '保存当前分类规则' }))
    await waitFor(() => expect(remote.putRule).toHaveBeenCalled())
    expect(await screen.findByText('Bug 分类')).toBeTruthy()
  })

  it('uses the owner history search result and forwards its anchor', async () => {
    const onOpen = vi.fn()
    render(<ConversationManager
      sessions={sessions}
      organization={fakeRemote()}
      searchHistory={async () => [{ sessionId: 's2', anchor: 'event:42' }]}
      onOpenSession={onOpen}
    />)
    await screen.findByRole('heading', { name: '对话管理' })
    fireEvent.change(screen.getByPlaceholderText('标题、标签或对话内容'), { target: { value: 'only in assistant reply' } })
    expect(await screen.findByText('修复登录错误')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '修复登录错误' }))
    expect(onOpen).toHaveBeenCalledWith('s2', 'event:42')
  })
})

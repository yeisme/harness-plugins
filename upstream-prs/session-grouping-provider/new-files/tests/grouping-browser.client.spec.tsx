// @vitest-environment jsdom
/**
 * WorkspaceBrowser integration with the v1alpha1 grouping seam: menu entries,
 * external group rendering, unknown-provider fallback, provider session
 * actions, manual order accounts, and stale persisted selections. The fake
 * provider comes from the public seam module only (community-sample shape).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  SessionId, SessionListState, SessionSummary, WorkspaceListState, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { WorkspaceBrowserProps } from '../src/client/contract/slots.ts'
import { fakeSessionGroupingProvider } from '../src/client/grouping.ts'
import type { SessionGroupingsStateV1Alpha1 } from '../src/client/grouping.ts'
import { createWorkspaceViewStore } from '../src/client/stores.ts'
import { WorkspaceBrowser } from '../src/client/WorkspaceBrowser.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t: WorkspaceBrowserProps['t'] = makeTranslate(zh, commonZh)

const sid = (id: string) => id as SessionId
const summary = (id: string, updatedAt: number, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id), displayTitle: id, running: false, blank: false, updatedAt, ...overrides,
})
const sessionState = (items: readonly SessionSummary[]): SessionListState => ({
  ids: items.map(item => item.id),
  byId: Object.fromEntries(items.map(item => [item.id, item])),
  current: undefined,
  phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
})
const workspaceView = (id: string, sessionIds: string[]): WorkspaceView => ({
  workspaceId: id as never, path: `/p/${id}`, title: id,
  sessionIds: sessionIds.map(sid), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})
const workspaceState = (items: readonly WorkspaceView[]): WorkspaceListState => ({
  items, archivedSessionIds: [], state: 'idle', phase: 'ready', error: null, baselinesReady: true,
  recentWorkspaceId: items[0]?.workspaceId,
})
function hook<T>(snapshot: T) {
  return function select<S>(selector: (state: T) => S): S { return selector(snapshot) }
}

function groupingsSource(state: SessionGroupingsStateV1Alpha1) {
  let current = state
  return {
    getSnapshot: () => current,
    subscribe: () => () => {},
    set(next: SessionGroupingsStateV1Alpha1): void { current = next },
  }
}

interface Mount {
  view: ReturnType<typeof render>
  props: WorkspaceBrowserProps
  store: ReturnType<ReturnType<typeof createWorkspaceViewStore>['create']>
  groupings: ReturnType<typeof groupingsSource>
}

function mount(
  overrides: Partial<WorkspaceBrowserProps> = {},
  groupBy?: 'workspace' | 'flat' | `provider:${string}`,
  initialProviders: readonly { provider: import('../src/client/grouping.ts').FakeSessionGroupingProviderV1Alpha1; label: string; seq: number }[] = [],
): Mount {
  const store = createWorkspaceViewStore().create()
  if (groupBy !== undefined && groupBy !== 'workspace') store.actions.setGroupBy(groupBy)
  const groupings = groupingsSource(Object.freeze({
    revision: initialProviders.length === 0 ? 0 : 1,
    providers: Object.freeze(initialProviders.map(entry => ({ ...entry, order: undefined }))),
  }))
  const props: WorkspaceBrowserProps = {
    wide: true,
    expandSidebar: vi.fn(),
    useSessions: hook(sessionState([])),
    useWorkspaces: hook(workspaceState([])),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    startSession: vi.fn(),
    open: vi.fn(),
    searchSessions: vi.fn(async () => ({ items: [], hasMore: false })),
    searchResultLimit: 20,
    renameSession: vi.fn(async () => {}),
    forkSession: vi.fn(),
    renameWorkspace: vi.fn(async () => {}),
    deleteWorkspace: vi.fn(async () => {}),
    archiveSession: vi.fn(async () => {}),
    insertWorkspaceBefore: vi.fn(async () => {}),
    insertSessionBefore: vi.fn(async () => {}),
    createWorkspace: vi.fn(async () => workspaceView('created', [])),
    useDirectoryFlow: bindSnapshotSelector({ getSnapshot: () => true, subscribe: () => () => {} }),
    useSessionGroupings: bindSnapshotSelector(groupings),
    useHostDescription: selector => selector(undefined),
    renderSlot: (() => null) as never,
    t,
    ...overrides,
  }
  const view = render(<WorkspaceBrowser {...props} />)
  return { view, props, store, groupings }
}

function registrationOf(provider: import('../src/client/grouping.ts').FakeSessionGroupingProviderV1Alpha1, label: string) {
  return { provider, label, seq: 0 }
}

describe('WorkspaceBrowser × sessionGroupings', () => {
  it('renders provider menu entries and selects one through the persisted store', async () => {
    const provider = fakeSessionGroupingProvider({ id: 'tags', label: '按标签' })
    const b = mount(undefined, undefined)
    b.groupings.set(Object.freeze({ revision: 1, providers: Object.freeze([{ provider, label: '按标签', seq: 0 }]) }))
    b.view.rerender(<WorkspaceBrowser {...b.props} />)
    fireEvent.click(screen.getByRole('button', { name: zh['viewOptions.label'] }))
    const item = await screen.findByText('按标签')
    fireEvent.click(item)
    expect(b.store.getSnapshot().groupBy).toBe('provider:tags')
    await cleanup()
  })

  it('renders external groups with native rows and hides Workspace-only header actions', async () => {
    const provider = fakeSessionGroupingProvider({
      id: 'tags',
      label: '按标签',
      groups: [
        { id: 'work', label: '工作', sessionIds: [sid('a'), sid('b')] },
        { id: 'research', label: '研究', sessionIds: [sid('a')] },
      ],
    })
    const b = mount({
      useSessions: hook(sessionState([summary('a', 10), summary('b', 20)])),
      useWorkspaces: hook(workspaceState([workspaceView('ws1', ['a'])])),
    }, 'provider:tags', [registrationOf(provider, '按标签')])
    b.store.actions.setGroupExpanded('provider:tags:work', true)
    b.store.actions.setGroupExpanded('provider:tags:research', true)
    // 多组重复：a 同时出现在两个组，两条都是同一 canonical SessionId。
    expect(await screen.findByText('工作')).toBeDefined()
    expect(screen.getByText('研究')).toBeDefined()
    const workRows = screen.getAllByText('a')
    expect(workRows.length).toBe(2)
    // 外部分组标题：无 Workspace 新建/重命名/删除/拖拽入口。
    expect(screen.queryByRole('button', { name: '在“工作”中新建会话' })).toBeNull()
    expect(screen.queryByRole('button', { name: '工作区“工作”的操作' })).toBeNull()
    // 原生会话行动作保留（重命名/分支/归档）；多组成员 a 的每个副本各有一份。
    expect(screen.getAllByRole('button', { name: '会话“a”的操作' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: '会话“b”的操作' })).toHaveLength(1)
    await cleanup()
  })

  it('falls back to the workspace view for an unknown or unloaded provider selection', async () => {
    mount({
      useSessions: hook(sessionState([summary('a', 10)])),
      useWorkspaces: hook(workspaceState([workspaceView('ws1', ['a'])])),
    }, 'provider:gone')
    // 旧持久化状态（provider 已卸载）：回退 workspace 分组，无空白侧栏。
    expect(await screen.findByText('ws1')).toBeDefined()
    expect(screen.queryByText('工作')).toBeNull()
    await cleanup()
  })

  it('dispatches provider session actions with the canonical row id', async () => {
    const opened: string[] = []
    const provider = fakeSessionGroupingProvider({
      id: 'tags', label: '按标签',
      groups: [{ id: 'g', label: '组', sessionIds: [sid('a')] }],
      onAction: sessionId => { opened.push(sessionId) },
    })
    const b = mount({
      useSessions: hook(sessionState([summary('a', 10)])),
    }, 'provider:tags', [registrationOf(provider, '按标签')])
    b.store.actions.setGroupExpanded('provider:tags:g', true)
    const actionLabel = typeof provider.sessionActions?.[0]?.label === 'function'
      ? provider.sessionActions[0].label()
      : provider.sessionActions?.[0]?.label
    const rowMenu = (await screen.findAllByRole('button', { name: '会话“a”的操作' }))[0]!
    fireEvent.click(rowMenu)
    const action = await screen.findByText(actionLabel as string)
    fireEvent.click(action)
    expect(opened).toEqual(['a'])
    await cleanup()
  })

  it('keeps manual order of an external group in its namespaced view account only', async () => {
    const provider = fakeSessionGroupingProvider({
      id: 'tags', label: '按标签',
      groups: [{ id: 'g', label: '组', sessionIds: [sid('a'), sid('b'), sid('c')] }],
    })
    const b = mount({
      useSessions: hook(sessionState([summary('a', 1), summary('b', 2), summary('c', 3)])),
      useWorkspaces: hook(workspaceState([workspaceView('ws1', ['a', 'b', 'c'])])),
    }, 'provider:tags', [registrationOf(provider, '按标签')])
    b.store.actions.setOrderBy('manual')
    b.store.actions.setGroupExpanded('provider:tags:g', true)
    // 预置 manual 顺序：c -> b -> a（写入命名空间账户，不动 Workspace 顺序）。
    b.store.actions.setSessionOrder('provider:tags:g', ['c', 'b', 'a'])
    await new Promise(resolve => setTimeout(resolve, 0))
    const keys = screen.getAllByText(/^[abc]$/).map(el => el.textContent)
    expect(keys).toEqual(['c', 'b', 'a'])
    // Workspace 的持久化重排 API 从未被外部分组调用。
    expect(b.props.insertSessionBefore).not.toHaveBeenCalled()
    await cleanup()
  })

  it('matches provider search terms in the native local search', async () => {
    const provider = fakeSessionGroupingProvider({
      id: 'tags', label: '按标签',
      groups: [{ id: 'g', label: '组', sessionIds: [sid('a')] }],
      searchTermsBySession: { a: ['invisible-tag'] },
    })
    const b = mount({
      useSessions: hook(sessionState([summary('a', 1), summary('b', 2)])),
      searchSessions: vi.fn(async () => ({ items: [], hasMore: false })),
    })
    b.groupings.set(Object.freeze({ revision: 1, providers: Object.freeze([{ provider, label: '按标签', seq: 0 }]) }))
    b.view.rerender(<WorkspaceBrowser {...b.props} />)
    const searchButton = screen.getByRole('button', { name: zh['search.sessions.aria'] })
    fireEvent.click(searchButton)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'invisible-tag' } })
    await vi.waitFor(() => {
      expect(screen.getByText('a')).toBeDefined()
      expect(screen.queryByText('b')).toBeNull()
    })
    await cleanup()
  })
})

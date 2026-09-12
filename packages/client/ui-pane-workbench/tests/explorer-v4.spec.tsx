// @vitest-environment jsdom
import { createElement, useState, StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setActiveLocale } from '../src/i18n/locale.js'
import { PaneWorkbenchController } from '../src/controller.js'
import {
  applyFileLifecycleToView,
  applyGitCompositionToTree,
  composeExplorerGitDecoration,
  createExplorerGitComposition,
  createExplorerOpenAdapter,
  createExplorerTreeState,
  ComposerReferenceController,
  ComposerReferenceDock,
  createFileOpenRequest,
  decideFileLifecycle,
  DSH_EXPLORER_VIEW_KIND,
  explorerOpenFromEntry,
  explorerRowHeight,
  explorerTreeBlockedByGit,
  fileLifecycleAutoOverwrite,
  fileLifecycleDropsBuffer,
  flattenExplorerTree,
  moveExplorerFocus,
  openExplorerNavigator,
  reduceExplorerTree,
  registerExplorerProvider,
  registerPaneWorkbenchCoreViews,
  windowVirtualRows,
  type ExplorerTreeNodeV1,
  type ExplorerTreeStateV1,
} from '../src/index.js'
import { ExplorerTree, ExplorerTreeView } from '../src/explorer/tree-ui.js'
import { createExplorerRuntimeSource } from '../src/explorer/runtime.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { explorerFileIconOf } from '../src/explorer/tree-ui.js'
import { isWorkbenchIconName } from '../src/icon.js'

afterEach(() => {
  setActiveLocale('en')
  cleanup()
})

function node(partial: Partial<ExplorerTreeNodeV1> & Pick<ExplorerTreeNodeV1, 'ref' | 'name'>): ExplorerTreeNodeV1 {
  return {
    kind: 'file',
    version: 'v1',
    hasChildren: false,
    capabilities: ['open'],
    freshness: 'fresh',
    ...partial,
  }
}

function hydrated(extra: readonly ExplorerTreeNodeV1[] = []) {
  return reduceExplorerTree(createExplorerTreeState(), {
    type: 'hydrate_roots',
    nodes: [
      node({ ref: 'dir:src', name: 'src', kind: 'directory', hasChildren: true }),
      node({ ref: 'file:readme', name: 'README.md' }),
      ...extra,
    ],
  })
}

describe('V4 Task 4.2 Explorer Provider', () => {
  it('registers one singleton explorer and opens preview/pin through the shared adapter', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registerPaneWorkbenchCoreViews(registry)
    expect(registry.get(DSH_EXPLORER_VIEW_KIND)?.descriptor.singleton).toBe(true)
    expect(registry.get(DSH_EXPLORER_VIEW_KIND)?.showInPicker).toBe(true)
    const controller = new PaneWorkbenchController({ registry })
    openExplorerNavigator(controller)
    explorerOpenFromEntry(controller, 'rail', node({ ref: 'file:a', name: 'a.ts' }), 'preview')
    explorerOpenFromEntry(controller, 'picker', node({ ref: 'file:b', name: 'b.ts' }), 'preview')
    explorerOpenFromEntry(controller, 'terminal', node({ ref: 'file:a', name: 'a.ts' }), 'pin')
    const snapshot = controller.getSnapshot()
    expect(Object.values(snapshot.views).filter(view => view.kind === DSH_EXPLORER_VIEW_KIND)).toHaveLength(1)
    expect(Object.values(snapshot.views).find(view => view.resourceKey === 'file:b')?.preview).toBe(true)
    expect(Object.values(snapshot.views).find(view => view.resourceKey === 'file:a')?.pinned).toBe(true)
    expect(snapshot.groups['group:right:navigator']?.tabs).toHaveLength(1)
  })

  it('does not create a second sidebar when rail, picker, and file-link share the adapter', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registerExplorerProvider(registry)
    const controller = new PaneWorkbenchController({ registry })
    const adapter = createExplorerOpenAdapter(controller)
    openExplorerNavigator(controller)
    adapter.openResource(node({ ref: 'file:one', name: 'one.ts' }), 'preview')
    explorerOpenFromEntry(controller, 'file-link', node({ ref: 'file:two', name: 'two.ts' }), 'preview')
    expect(Object.values(controller.getSnapshot().views).filter(view => view.kind === DSH_EXPLORER_VIEW_KIND)).toHaveLength(1)
    expect(Object.values(controller.getSnapshot().groups).filter(group => group.role === 'navigator')).toHaveLength(1)
  })
})

describe('V4 Task 4.3 Tree State', () => {
  it('keeps expanded, selection, focus and scroll anchor across async children', () => {
    let state = hydrated()
    state = reduceExplorerTree(state, { type: 'expand', ref: 'dir:src' })
    state = reduceExplorerTree(state, { type: 'select', ref: 'file:readme' })
    state = reduceExplorerTree(state, { type: 'set_scroll_anchor', anchor: { ref: 'file:readme', offset: 112 } })
    state = reduceExplorerTree(state, { type: 'children_loading', ref: 'dir:src' })
    state = reduceExplorerTree(state, {
      type: 'children_ready',
      ref: 'dir:src',
      nodes: [node({ ref: 'file:index', name: 'index.ts', parentRef: 'dir:src' })],
    })
    expect(state.expandedRefs).toEqual(['dir:src'])
    expect(state.selectedRef).toBe('file:readme')
    expect(state.scrollAnchor).toEqual({ ref: 'file:readme', offset: 112 })
    expect(state.children['dir:src']).toEqual(['file:index'])
  })

  it('folds watch gaps without resetting the user position and bounds a 10k tree window', () => {
    const many = Array.from({ length: 10_000 }, (_, index) => node({
      ref: `file:n${index}`,
      name: `n${index}.ts`,
    }))
    let state = reduceExplorerTree(createExplorerTreeState(), { type: 'hydrate_roots', nodes: many })
    state = reduceExplorerTree(state, { type: 'focus', ref: 'file:n500' })
    state = reduceExplorerTree(state, { type: 'set_scroll_anchor', anchor: { ref: 'file:n500', offset: 80 } })
    state = reduceExplorerTree(state, {
      type: 'watch',
      event: { cursor: 'c9', sequence: 9, op: 'changed', entryRef: 'file:n1' },
    })
    state = reduceExplorerTree(state, {
      type: 'watch',
      event: { cursor: 'c12', sequence: 12, op: 'changed', entryRef: 'file:n2' },
    })
    expect(state.freshness).toBe('reconcile_required')
    expect(state.focusedRef).toBe('file:n500')
    expect(state.scrollAnchor?.ref).toBe('file:n500')
    const rows = flattenExplorerTree(state)
    expect(rows).toHaveLength(10_000)
    const windowed = windowVirtualRows(rows, 500 * explorerRowHeight('fine'), 280, explorerRowHeight('fine'))
    expect(windowed.items.length).toBeLessThan(40)
    expect(windowed.total).toBe(10_000)
  })

  it('rejects unsafe absolute-path nodes without dropping safe roots', () => {
    const state = reduceExplorerTree(createExplorerTreeState(), {
      type: 'hydrate_roots',
      nodes: [
        node({ ref: 'dir:src', name: 'src', kind: 'directory', hasChildren: true }),
        node({ ref: '/etc/passwd', name: 'passwd' }),
      ],
    })
    expect(state.roots).toEqual(['dir:src'])
    expect(state.freshness).toBe('contract_mismatch')
  })

  it('keeps primary preview and checked resources independent', () => {
    let state = hydrated()
    state = reduceExplorerTree(state, { type: 'set_primary', ref: 'file:readme' })
    state = reduceExplorerTree(state, { type: 'toggle_checked', ref: 'dir:src' })
    expect(state.primaryRef).toBe('file:readme')
    expect(state.checkedRefs).toEqual(['dir:src'])
    state = reduceExplorerTree(state, { type: 'toggle_checked', ref: 'dir:src' })
    expect(state.primaryRef).toBe('file:readme')
    expect(state.checkedRefs).toEqual([])
  })
})

describe('Explorer directory reveal handoff', () => {
  it('acknowledges a rendered selected directory, preserves the original navigator and cancels on owner change', async () => {
    const source = createExplorerRuntimeSource()
    const bodyRead = vi.fn()
    const runtime = { roots: async () => [node({ ref: 'file:original', name: 'original.txt' })], listChildren: async () => [], openResource: bodyRead,
      revealResource: async () => ({ node: node({ ref: 'dir:target', name: 'target', kind: 'directory' }), breadcrumb: [{ ref: 'workspace:a', name: 'Project' }] }) }
    const unbind = source.bind(runtime)
    const owner = new AbortController(), pendingAction = new AbortController()
    const pending = source.reveal!.request({ runtime, ref: 'dir:target', version: 'v1', isActive: () => true }, owner.signal, pendingAction.signal)
    const view = render(createElement(StrictMode, null, createElement(ExplorerTreeView, { runtimeSource: source } as never)))
    await screen.findByRole('button', { name: 'Back to previous Explorer view' })
    await expect(pending).resolves.toBe(true)
    expect(view.container.querySelector('[data-explorer-ref="dir:target"]')?.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement?.getAttribute('role')).toBe('tree')
    expect(bodyRead).not.toHaveBeenCalled()
    act(() => pendingAction.abort())
    expect(source.reveal!.getSnapshot()).toBeDefined()
    act(() => owner.abort())
    await screen.findByText('original.txt')
    expect(source.reveal!.getSnapshot()).toBeUndefined()
    view.unmount(); unbind()
  })
  it('refuses a location change while the original Explorer has an unfinished mutation draft', async () => {
    const source = createExplorerRuntimeSource()
    const propose = vi.fn()
    const runtime = { roots: async () => [node({ ref: 'file:original', name: 'original.txt' })], getRootRef: () => 'root:a', listChildren: async () => [], openResource: async () => ({ ok: false }),
      mutation: { enabled: true, propose }, revealResource: async () => undefined }
    const unbind = source.bind(runtime)
    render(createElement(ExplorerTreeView, { runtimeSource: source } as never))
    await screen.findByText('original.txt')
    fireEvent.click(screen.getByRole('button', { name: '新建文件' }))
    const draft = screen.getByRole('textbox', { name: '资源名称' }) as HTMLInputElement
    fireEvent.change(draft, { target: { value: 'draft.txt' } })
    await expect(source.reveal!.request({ runtime, ref: 'dir:target', version: 'v1', isActive: () => true })).resolves.toBe(false)
    expect(draft.value).toBe('draft.txt')
    expect(propose).not.toHaveBeenCalled()
    unbind()
  })

  it('hides the previous owner tree while a replacement runtime is still loading', async () => {
    const source = createExplorerRuntimeSource()
    const base = { listChildren: async () => [], openResource: async () => ({ ok: false }) }
    source.bind({ ...base, roots: async () => [node({ ref: 'old:file', name: 'old-owner.txt' })] })
    render(createElement(ExplorerTreeView, { runtimeSource: source } as never))
    await screen.findByText('old-owner.txt')
    let finish!: (nodes: readonly ExplorerTreeNodeV1[]) => void
    act(() => { source.bind({ ...base, roots: () => new Promise(resolve => { finish = resolve }) }) })
    expect(screen.queryByText('old-owner.txt')).toBeNull()
    await act(async () => finish([node({ ref: 'new:file', name: 'new-owner.txt' })]))
    await screen.findByText('new-owner.txt')
  })

  it('does not inspect an unrelated root file before the user focuses Explorer', async () => {
    vi.useFakeTimers()
    try {
      const source = createExplorerRuntimeSource()
      const inspectMetadata = vi.fn(async (item: ExplorerTreeNodeV1) => ({ ref: item.ref, version: item.version, state: 'ready' as const, label: item.name }))
      source.bind({ roots: async () => [node({ ref: 'file:original', name: 'original.txt' })], listChildren: async () => [], openResource: async () => ({ ok: false }), inspectMetadata })
      render(createElement(ExplorerTreeView, { runtimeSource: source } as never))
      await act(async () => {})
      await act(async () => { vi.advanceTimersByTime(500) })
      expect(inspectMetadata).not.toHaveBeenCalled()
      act(() => screen.getByRole('tree').focus())
      await act(async () => { vi.advanceTimersByTime(500) })
      expect(inspectMetadata).toHaveBeenCalledOnce()
    } finally { vi.useRealTimers() }
  })

  it('does not move focus after the user leaves the target Pane during owner resolution', async () => {
    const source = createExplorerRuntimeSource()
    let active = true, finish!: (value: { node: ExplorerTreeNodeV1; breadcrumb: [] }) => void
    const runtime = { roots: async () => [], listChildren: async () => [], openResource: async () => ({ ok: false }),
      revealResource: () => new Promise<{ node: ExplorerTreeNodeV1; breadcrumb: [] }>(resolve => { finish = resolve }) }
    source.bind(runtime)
    const pending = source.reveal!.request({ runtime, ref: 'dir:target', version: 'v1', isActive: () => active })
    render(createElement('div', null, createElement('button', null, 'Outside'), createElement(ExplorerTreeView, { runtimeSource: source } as never)))
    act(() => { active = false; screen.getByRole('button', { name: 'Outside' }).focus() })
    await act(async () => finish({ node: node({ ref: 'dir:target', name: 'target', kind: 'directory' }), breadcrumb: [] }))
    await expect(pending).resolves.toBe(false)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Outside' }))
    expect(source.reveal!.getSnapshot()).toBeUndefined()
  })

  it('restores the original navigator scroll after returning from a located directory', async () => {
    const source = createExplorerRuntimeSource()
    const runtime = { roots: async () => Array.from({ length: 80 }, (_, index) => node({ ref: `file:row${index}`, name: `original-${index}.txt` })), listChildren: async () => [], openResource: async () => ({ ok: false }),
      revealResource: async () => ({ node: node({ ref: 'dir:target', name: 'target', kind: 'directory' }), breadcrumb: [] }) }
    source.bind(runtime)
    render(createElement(ExplorerTreeView, { runtimeSource: source } as never))
    await screen.findByText('original-0.txt')
    const tree = screen.getByRole('tree')
    act(() => { tree.scrollTop = 280; fireEvent.scroll(tree) })
    let pending!: Promise<boolean>
    act(() => { pending = source.reveal!.request({ runtime, ref: 'dir:target', version: 'v1', isActive: () => true }) })
    await screen.findByRole('button', { name: 'Back to previous Explorer view' })
    await expect(pending).resolves.toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Back to previous Explorer view' }))
    expect(screen.getByRole('tree').scrollTop).toBe(280)
  })

  it('times out without a mounted receiver and rejects a superseded request', async () => {
    vi.useFakeTimers()
    try {
      const source = createExplorerRuntimeSource()
      const runtime = { roots: async () => [], listChildren: async () => [], openResource: async () => ({ ok: false }), revealResource: async () => undefined }
      source.bind(runtime)
      const input = { runtime, ref: 'dir:target', version: 'v1', isActive: () => true }
      const first = source.reveal!.request(input)
      const old = source.reveal!.getSnapshot()!
      const second = source.reveal!.request(input)
      await expect(first).resolves.toBe(false)
      expect(source.reveal!.acknowledge(old, true)).toBe(false)
      act(() => vi.advanceTimersByTime(3000))
      await expect(second).resolves.toBe(false)
      expect(source.reveal!.getSnapshot()).toBeUndefined()
    } finally { vi.useRealTimers() }
  })
})

describe('V4 Task 4.4 Tree UI', () => {
  it('restores directory roots after clearing a remote search and reports search failures', async () => {
    const runtimeSource = createExplorerRuntimeSource()
    runtimeSource.bind({
      roots: async () => [node({ ref: 'dir:source', name: 'source', kind: 'directory', hasChildren: true })],
      listChildren: async () => [], openResource: async () => ({ ok: true }),
      search: async query => { if (query === 'broken') throw new Error('Search is unavailable'); return [node({ ref: 'file:match', name: 'match.txt' })] },
    })
    render(createElement(ExplorerTreeView, { runtimeSource } as never))
    await screen.findByText('source')
    const filter = screen.getByRole('textbox')
    fireEvent.change(filter, { target: { value: 'match' } })
    await screen.findByText('match.txt')
    fireEvent.change(filter, { target: { value: '' } })
    await screen.findByText('source')
    fireEvent.change(filter, { target: { value: 'broken' } })
    await screen.findByText('Search is unavailable')
  })
  it('loads a keyboard-expanded directory without overwriting a later file selection', async () => {
    let resolve!: (nodes: readonly ExplorerTreeNodeV1[]) => void
    const listChildren = vi.fn(() => new Promise<readonly ExplorerTreeNodeV1[]>(done => { resolve = done }))
    const runtime = { roots: async () => [], listChildren, openResource: async () => ({ ok: true }) }
    function Harness() {
      const [state, setState] = useState(reduceExplorerTree(hydrated(), { type: 'focus', ref: 'dir:src' }))
      return createElement(ExplorerTree, { state, onIntent: setState, runtime })
    }
    render(createElement(Harness))
    fireEvent.keyDown(screen.getByRole('tree'), { key: 'ArrowRight' })
    expect(listChildren).toHaveBeenCalledWith('dir:src')
    fireEvent.click(screen.getByText('README.md'))
    await act(async () => resolve([node({ ref: 'file:child', parentRef: 'dir:src', name: 'index.ts' })]))
    expect(screen.getByText('index.ts')).toBeTruthy()
    expect(screen.getByText('README.md').closest('[role=treeitem]')?.getAttribute('aria-selected')).toBe('true')
  })

  it.each([false, true])('updates virtual rows and reports file open errors (async=%s)', async (asyncOpen) => {
    const state = hydrated(Array.from({ length: 200 }, (_, i) => node({ ref: `file:n${i}`, name: `item-${i}.txt` })))
    render(createElement(ExplorerTree, { state, viewportHeight: 140, runtime: {
      roots: async () => [], listChildren: async () => [], openResource: () => { if (asyncOpen) return Promise.reject(new Error('File is no longer available')); throw new Error('File is no longer available') },
    } }))
    expect(screen.queryByText('item-100.txt')).toBeNull()
    fireEvent.scroll(screen.getByRole('tree'), { target: { scrollTop: 2800 } })
    expect(screen.getByText('item-100.txt')).toBeTruthy()
    fireEvent.click(screen.getByText('item-100.txt'))
    expect(await screen.findByText('File is no longer available')).toBeTruthy()
  })
  it('renders APG tree rows at 28px and opens preview on click without overflowing long names', () => {
    const opened: string[] = []
    let state = hydrated([node({ ref: 'file:long', name: `${'VeryLongFileName'.repeat(8)}.ts` })])
    const view = render(createElement(ExplorerTree, {
      state,
      pointer: 'fine',
      viewportHeight: 240,
      adapter: {
        openResource(current, mode) { opened.push(`${mode}:${current.ref}`) },
      },
      onIntent: next => { state = next },
    }))
    expect(screen.getByRole('tree')).toBeTruthy()
    const file = screen.getByText('README.md').closest('[role="treeitem"]')!
    expect(file.getAttribute('style')).toContain('height: 28px')
    fireEvent.click(file)
    expect(opened).toEqual(['preview:file:readme'])
    fireEvent.keyDown(screen.getByRole('tree'), { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByRole('tree'), { key: 'Enter' })
    const long = screen.getByText(/VeryLongFileName/).closest('[role="treeitem"]')!
    expect(long.getAttribute('style')).toContain('text-overflow: ellipsis')
    view.unmount()
    state = hydrated()
    render(createElement(ExplorerTree, { state, pointer: 'coarse', viewportHeight: 240 }))
    expect(screen.getByText('README.md').closest('[role="treeitem"]')?.getAttribute('style')).toContain('min-height: 44px')
  })

  it('expands a directory from the keyboard and keeps focus on the tree', () => {
    let state = reduceExplorerTree(hydrated(), { type: 'focus', ref: 'dir:src' })
    render(createElement(ExplorerTree, {
      state,
      onIntent: next => { state = next },
    }))
    fireEvent.keyDown(screen.getByRole('tree'), { key: 'ArrowRight' })
    expect(state.expandedRefs).toContain('dir:src')
  })

  it('offers an explicit owner-backed add-reference action without opening the file row', async () => {
    const addReference = vi.fn(async () => ({ ok: true as const }))
    const openResource = vi.fn(async () => ({ ok: true as const }))
    const state = hydrated()
    render(createElement(ExplorerTree, { state, runtime: {
      roots: async () => [], listChildren: async () => [], openResource, addReference,
    }, onIntent: () => {} }))
    fireEvent.click(screen.getByRole('button', { name: '添加 README.md 到当前对话引用' }))
    await vi.waitFor(() => { expect(addReference).toHaveBeenCalledWith(expect.objectContaining({ ref: 'file:readme' })) })
    expect(openResource).not.toHaveBeenCalled()
    expect(await screen.findByText('已添加引用：README.md')).toBeTruthy()
  })
})

describe('Explorer narrow content flow (3.4)', () => {
  it.each([false, true])('restores narrow navigator focus for sync/async file opens (async=%s)', async (asyncOpen) => {
    const opened: Array<{ readonly ref: string; readonly mode: 'preview' | 'pin' }> = []
    const runtime = {
      getRootRef: () => 'root',
      roots: async () => [node({ ref: 'readme.md', name: 'readme.md' })],
      listChildren: async () => [],
      search: async () => [],
      inspectMetadata: async (input: ExplorerTreeNodeV1) => ({ ref: input.ref, version: input.version, state: 'ready' as const, label: input.name }),
      openResource: (input: ExplorerTreeNodeV1, mode: 'preview' | 'pin') => { opened.push({ ref: input.ref, mode }); return asyncOpen ? Promise.resolve({ ok: true }) : { ok: true } },
    } as unknown as Parameters<typeof ExplorerTree>[0]['runtime']
    const initial = reduceExplorerTree(createExplorerTreeState(), { type: 'hydrate_roots', nodes: [node({ ref: 'readme.md', name: 'readme.md' })] })
    let state = initial
    const view = render(createElement(ExplorerTree, { state: initial, runtime, narrow: true, onIntent: () => {} }))
    const rerender = (next: Parameters<typeof ExplorerTree>[0]['state']): void => {
      state = next
      view.rerender(createElement(ExplorerTree, { state: next, runtime, narrow: true, onIntent: rerender }))
    }
    view.rerender(createElement(ExplorerTree, { state: initial, runtime, narrow: true, onIntent: rerender }))
    // 窄屏打开文件：进入内容页（树隐藏 + 返回栏出现）。
    fireEvent.click(document.querySelector('[data-explorer-ref="readme.md"]') as HTMLElement)
    await vi.waitFor(() => { expect(document.querySelector('[data-explorer-narrow-back]')).not.toBeNull() })
    expect(opened).toEqual([{ ref: 'readme.md', mode: 'preview' }])
    const tree = document.querySelector('.pwr-explorer-tree') as HTMLElement
    expect(tree.hidden).toBe(true)
    // 返回 Explorer：树恢复、焦点回到树容器、focusedRef 恢复来源行。
    fireEvent.click(screen.getByRole('button', { name: 'Back to Explorer' }) as HTMLButtonElement)
    await vi.waitFor(() => { expect(document.querySelector('[data-explorer-narrow-back]')).toBeNull() })
    expect(state.narrowReturnRef).toBeUndefined()
    expect(state.focusedRef).toBe('readme.md')
    expect((document.querySelector('.pwr-explorer-tree') as HTMLElement).hidden).toBe(false)
  })

  it('wide viewport keeps the locked navigator (no back flow, content opens adjacent)', async () => {
    const runtime = {
      getRootRef: () => 'root',
      roots: async () => [node({ ref: 'wide.md', name: 'wide.md' })],
      listChildren: async () => [],
      search: async () => [],
      openResource: async () => ({ ok: true }),
    } as unknown as Parameters<typeof ExplorerTree>[0]['runtime']
    const initial = reduceExplorerTree(createExplorerTreeState(), { type: 'hydrate_roots', nodes: [node({ ref: 'wide.md', name: 'wide.md' })] })
    render(createElement(ExplorerTree, { state: initial, runtime, onIntent: () => {} }))
    fireEvent.click(document.querySelector('[data-explorer-ref="wide.md"]') as HTMLElement)
    await vi.waitFor(() => { expect((document.querySelector('.pwr-explorer-tree') as HTMLElement).hidden).toBe(false) })
    expect(document.querySelector('[data-explorer-narrow-back]')).toBeNull()
  })
})

describe('V4 Task 4.5 File Lifecycle', () => {
  it('surfaces owner actions on dirty external change and never auto-overwrites', () => {
    const decision = decideFileLifecycle(
      { resourceKey: 'file:readme', openedVersion: 'v1', dirty: true },
      { resourceKey: 'file:readme', ownerVersion: 'v2' },
    )
    expect(decision.status).toBe('conflict')
    expect(decision.actions).toEqual(['compare', 'reload', 'save_as', 'keep_local'])
    expect(decision.autoOverwrite).toBe(false)
    expect(decision.dropBuffer).toBe(false)
    expect(fileLifecycleAutoOverwrite()).toBe(false)
    expect(fileLifecycleDropsBuffer()).toBe(false)
    const request = createFileOpenRequest('file:readme', 'README.md', 'preview', 'v1')
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registerPaneWorkbenchCoreViews(registry)
    const controller = new PaneWorkbenchController({ registry })
    controller.openView(request)
    controller.dispatch({ type: 'set_view_dirty', viewId: Object.values(controller.getSnapshot().views).find(view => view.resourceKey === 'file:readme')!.id, dirty: true })
    const view = Object.values(controller.getSnapshot().views).find(item => item.resourceKey === 'file:readme')!
    const next = applyFileLifecycleToView(view, decision)
    expect(next.status).toBe('conflict')
    expect(next.id).toBe(view.id)
    expect(next.dirty).toBe(true)
  })
})

describe('V4 Task 4.6 Explorer Git Composition', () => {
  it('maps decorations onto opaque refs and keeps the tree browsable when Git is offline', () => {
    const composition = createExplorerGitComposition([
      {
        fileRef: 'file:readme',
        repositoryRef: 'repo:one',
        worktreeRef: 'wt:one',
        revision: 'rev1',
        kind: 'modified',
        freshness: 'offline',
      },
    ], 'offline')
    expect(explorerTreeBlockedByGit(composition)).toBe(false)
    expect(composition.mutationDisabled).toBe(true)
    expect(composition.mutationReason).toMatch(/offline/i)
    const decorated = composeExplorerGitDecoration(node({ ref: 'file:readme', name: 'README.md' }), composition)
    expect(decorated.gitDecoration).toBe('modified')
    const tree = applyGitCompositionToTree(hydrated(), composition)
    expect(tree.nodes['file:readme']?.gitDecoration).toBe('modified')
    expect(tree.roots.length).toBeGreaterThan(0)
  })
})

describe('Explorer focus movement', () => {
  it('moves focus with Home and End without changing expansion', () => {
    const start = hydrated()
    const end = moveExplorerFocus(start, 'end')
    expect(end.focusedRef).toBe('file:readme')
    expect(end.expandedRefs).toEqual(start.expandedRefs)
  })
})

describe('ComposerReferenceCapabilityV1', () => {
  it('uses revision fencing, one active reference and an eight-pin limit', () => {
    const controller = new ComposerReferenceController()
    for (let index = 0; index < 9; index += 1) {
      const current = controller.snapshot()
      const reference = { id: `r${index}`, kind: 'file-preview' as const, owner: 'dsh.local', ref: `file:r${index}`, version: 'v1', label: `file-${index}`, scope: 'workspace', digest: `d${index}`, freshness: 'fresh' as const }
      expect(controller.dispatch({ type: 'replace_active', reference, expectedRevision: current.revision }).ok).toBe(true)
      const pinned = controller.dispatch({ type: 'pin', id: reference.id, expectedRevision: controller.snapshot().revision })
      expect(pinned.ok).toBe(index < 8)
    }
    expect(controller.snapshot().pinned).toHaveLength(8)
    expect(controller.dispatch({ type: 'clear', expectedRevision: 0 })).toMatchObject({ ok: false, reason: expect.stringContaining('stale') })
  })

  it('marks unsent references stale, redirects current refs and freezes sent snapshots', () => {
    const controller = new ComposerReferenceController()
    const reference = { id: 'r1', kind: 'file-preview' as const, owner: 'dsh.local', ref: 'file:old', version: 'v1', label: 'README.md', scope: 'workspace', digest: 'digest', freshness: 'fresh' as const }
    controller.dispatch({ type: 'replace_active', reference })
    controller.dispatch({ type: 'pin', id: 'r1' })
    controller.dispatch({ type: 'redirect', oldRef: 'file:old', newRef: 'file:new' })
    expect(controller.snapshot().active?.ref).toBe('file:new')
    controller.dispatch({ type: 'freeze_sent', ids: ['r1'] })
    controller.dispatch({ type: 'redirect', oldRef: 'file:new', newRef: 'file:newer' })
    expect(controller.snapshot().sent[0]).toMatchObject({ ref: 'file:new', freshness: 'frozen' })
    controller.dispatch({ type: 'mark_stale', ref: 'file:new', version: 'v2' })
    expect(controller.snapshot().active).toMatchObject({ freshness: 'stale', version: 'v1', currentVersion: 'v2' })
  })

  it('view-current refresh replaces the stale reference in place without touching frozen snapshots (4.5)', async () => {
    const controller = new ComposerReferenceController()
    const reference = { id: 'r1', kind: 'file-preview' as const, owner: 'dsh.local', ref: 'file:readme', version: 'v1', label: 'README.md', scope: 'workspace', digest: 'digest-1', freshness: 'fresh' as const }
    controller.dispatch({ type: 'replace_active', reference })
    controller.dispatch({ type: 'pin', id: 'r1' })
    controller.dispatch({ type: 'mark_stale', ref: 'file:readme', version: 'v2' })
    expect(controller.snapshot().active?.freshness).toBe('stale')

    // host 重解析成功：active 与 pinned 中同 id 项原位替换为当前版本。
    const refreshed = { ...reference, version: 'v2', digest: 'digest-2', freshness: 'fresh' as const }
    const result = controller.dispatch({ type: 'refresh', id: 'r1', reference: refreshed, expectedRevision: controller.snapshot().revision })
    expect(result.ok).toBe(true)
    expect(controller.snapshot().active).toMatchObject({ version: 'v2', digest: 'digest-2', freshness: 'fresh' })
    expect(controller.snapshot().pinned[0]).toMatchObject({ version: 'v2', freshness: 'fresh' })

    // 未知 id 拒绝；frozen sent 快照不被 refresh 改写。
    expect(controller.dispatch({ type: 'refresh', id: 'ghost', reference: refreshed })).toMatchObject({ ok: false, reason: 'reference is unavailable' })
    controller.dispatch({ type: 'freeze_sent', ids: ['r1'] })
    const sent = controller.snapshot().sent[0]
    controller.dispatch({ type: 'refresh', id: 'r1', reference: { ...refreshed, version: 'v3' } })
    expect(controller.snapshot().sent[0]).toBe(sent)

    // dock：stale chip 提供查看当前版本动作；host 面缺席时如实禁用。
    controller.dispatch({ type: 'mark_stale', ref: 'file:readme', version: 'v5' })
    const { unmount } = render(createElement(ComposerReferenceDock, { controller, onViewCurrent: async item => ({ ...item, version: 'v5', freshness: 'fresh' }) }))
    const action = document.querySelector('[data-reference-view-current="r1"] button') as HTMLButtonElement
    expect(action).not.toBeNull()
    expect(action.disabled).toBe(false)
    await fireEvent.click(action)
    expect(controller.snapshot().active).toMatchObject({ version: 'v5', freshness: 'fresh' })
    unmount()
    // 再次标旧（v6），host 面缺席时动作如实禁用。
    controller.dispatch({ type: 'mark_stale', ref: 'file:readme', version: 'v6' })
    render(createElement(ComposerReferenceDock, { controller }))
    const disabled = document.querySelector('[data-reference-view-current="r1"] button') as HTMLButtonElement
    expect(disabled.disabled).toBe(true)
  })
})

describe('explorer per-kind file icons (file-preview-dispatch)', () => {
  it('maps common media, document, archive and code extensions', () => {
    expect(explorerFileIconOf('bundle.zip')).toBe('archive')
    expect(explorerFileIconOf('capture.mkv')).toBe('video')
    expect(explorerFileIconOf('voice.flac')).toBe('audio')
    expect(explorerFileIconOf('manual.pdf')).toBe('pdf')
    expect(explorerFileIconOf('cover.png')).toBe('image')
    expect(explorerFileIconOf('main.ts')).toBe('code')
    expect(explorerFileIconOf('notes.md')).toBe('document')
    expect(explorerFileIconOf('data.csv')).toBe('document')
  })

  it('falls back to the generic file glyph for unknown or extensionless names', () => {
    expect(explorerFileIconOf('data.unknownext')).toBe('file')
    expect(explorerFileIconOf('Makefile')).toBe('file')
    expect(explorerFileIconOf('README')).toBe('file')
  })

  it('only registers presentation icons that exist in the icon set', () => {
    for (const name of ['image', 'audio', 'video', 'pdf', 'archive', 'code'] as const) {
      expect(isWorkbenchIconName(name)).toBe(true)
    }
  })
})

describe('explorer watch pill + explicit refresh (dsh-explorer-live-watch)', () => {
  function watchRuntime(overrides: Record<string, unknown> = {}) {
    return {
      roots: vi.fn(async () => [
        node({ ref: 'dir:src', name: 'src', kind: 'directory', hasChildren: true }),
        node({ ref: 'file:readme', name: 'README.md' }),
      ]),
      listChildren: vi.fn(async () => [node({ ref: 'file:index', name: 'index.ts', parentRef: 'dir:src' })]),
      openResource: vi.fn(async () => ({ ok: true })),
      ...overrides,
    } as never
  }

  it('shows the honest on-demand pill when the runtime has no watch source', () => {
    const { container } = render(createElement(ExplorerTree, { state: hydrated(), runtime: watchRuntime() }))
    const pill = container.querySelector('[data-file-watch]')
    expect(pill?.getAttribute('data-file-watch')).toBe('ondemand')
    expect(pill?.getAttribute('data-freshness')).toBe('fresh')
  })

  it('shows the live pill when the runtime advertises FileWatchCapabilityV1', () => {
    const runtime = watchRuntime({
      fileWatch: { capabilities: ['FileWatchCapabilityV1'], watch: () => ({ subscribe: () => () => {}, snapshotCursor: () => '0' }) },
    })
    const { container } = render(createElement(ExplorerTree, { state: hydrated(), runtime }))
    expect(container.querySelector('[data-file-watch]')?.getAttribute('data-file-watch')).toBe('live')
  })

  it('refresh re-reads roots and expanded dirs while preserving expansion', async () => {
    let generation = 1
    const runtime = watchRuntime({
      roots: vi.fn(async () => generation === 1
        ? [node({ ref: 'dir:src', name: 'src', kind: 'directory', hasChildren: true }), node({ ref: 'file:readme', name: 'README.md' })]
        : [node({ ref: 'dir:src', name: 'src', kind: 'directory', hasChildren: true }), node({ ref: 'file:readme', name: 'README.md' }), node({ ref: 'file:notes', name: 'notes.md' })]),
    })
    let state = hydrated()
    state = reduceExplorerTree(state, { type: 'expand', ref: 'dir:src' })
    state = reduceExplorerTree(state, { type: 'select', ref: 'file:readme' })
    const intents: ExplorerTreeStateV1[] = []
    function Harness(): ReactNode {
      const [current, setCurrent] = useState(state)
      return createElement(ExplorerTree, { state: current, runtime, onIntent: next => { intents.push(next); setCurrent(next) } })
    }
    render(createElement(Harness))
    generation = 2
    fireEvent.click(screen.getByRole('button', { name: '刷新目录树' }))
    await waitFor(() => expect(screen.getByText('notes.md')).toBeDefined())
    const last = intents.at(-1)!
    expect(last.expandedRefs).toContain('dir:src')
    expect(last.selectedRef).toBe('file:readme')
    expect(runtime.listChildren).toHaveBeenCalledWith('dir:src')
  })
})

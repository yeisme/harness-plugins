// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { setActiveLocale } from '../src/i18n/locale.js'
import { PaneWorkbenchController } from '../src/controller.js'
import {
  applyFileLifecycleToView,
  applyGitCompositionToTree,
  composeExplorerGitDecoration,
  createExplorerGitComposition,
  createExplorerOpenAdapter,
  createExplorerTreeState,
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
} from '../src/index.js'
import { ExplorerTree } from '../src/explorer/tree-ui.js'
import { PaneViewRegistry } from '../src/view-registry.js'

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
})

describe('V4 Task 4.4 Tree UI', () => {
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

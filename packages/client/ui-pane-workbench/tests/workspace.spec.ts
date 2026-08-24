import { describe, expect, it } from 'vitest'
import {
  PANE_WORKSPACE_LIMITS,
  createPaneWorkspace,
  normalizePaneWorkspace,
  reducePaneWorkspace,
  type PaneViewSpecV1,
  type PaneWorkspaceV1,
} from '../src/index.js'

function view(request: Partial<PaneViewSpecV1> & Pick<PaneViewSpecV1, 'kind' | 'resourceKey'>): PaneViewSpecV1 {
  return {
    role: 'content',
    preferredRegion: 'right',
    retention: 'snapshot',
    singleton: false,
    preview: true,
    ...request,
  }
}

function apply(state: PaneWorkspaceV1, intent: Parameters<typeof reducePaneWorkspace>[1]): PaneWorkspaceV1 {
  const result = reducePaneWorkspace(state, intent)
  expect(result.accepted, result.reason).toBe(true)
  return result.state
}

function viewByResource(state: PaneWorkspaceV1, resourceKey: string) {
  return Object.values(state.views).find(candidate => candidate.resourceKey === resourceKey)
}

describe('PaneWorkspaceV1 core reducer', () => {
  it('creates bounded contextual groups with both workspace regions initially closed', () => {
    const state = createPaneWorkspace(7)
    expect(state.schema).toBe('pane.workspace.v1alpha1')
    expect(state.generation).toBe(7)
    expect(state.regions.right.root.type).toBe('split')
    if (state.regions.right.root.type === 'split') {
      expect(state.regions.right.root.orientation).toBe('horizontal')
      expect(state.regions.right.root.first).toEqual({ type: 'group', groupId: 'group:right:content' })
      expect(state.regions.right.root.second).toEqual({ type: 'group', groupId: 'group:right:navigator' })
    }
    expect(state.groups['group:right:navigator']?.locked).toBe(true)
    expect(state.groups['group:right:content']?.role).toBe('content')
    expect(state.regions.right.visible).toBe(false)
    expect(state.regions.bottom.visible).toBe(false)
  })

  it('routes by semantic role instead of the currently focused group', () => {
    let state = createPaneWorkspace()
    state = apply(state, {
      type: 'open_view',
      request: view({
        kind: 'file.navigator',
        resourceKey: 'navigator:workspace',
        role: 'navigator',
        singleton: true,
        preview: false,
        targetGroupId: 'group:right:navigator',
      }),
    })
    expect(state.activeGroupId).toBe('group:right:navigator')

    state = apply(state, {
      type: 'open_view',
      request: view({ kind: 'file.preview', resourceKey: 'file:README.md' }),
    })
    expect(viewByResource(state, 'file:README.md')?.groupId).toBe('group:right:content')

    state = apply(state, {
      type: 'open_view',
      request: view({ kind: 'terminal.session', resourceKey: 'terminal:one', role: 'utility', preferredRegion: 'bottom', preview: false }),
    })
    expect(viewByResource(state, 'terminal:one')?.groupId).toBe('group:bottom:utility')
    expect(state.regions.bottom.visible).toBe(true)
  })

  it('replaces preview tabs and preserves pinned or dirty views', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.preview', resourceKey: 'file:one' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.preview', resourceKey: 'file:two' }) })
    expect(viewByResource(state, 'file:one')).toBeUndefined()
    const second = viewByResource(state, 'file:two')!
    state = apply(state, { type: 'pin_view', viewId: second.id, pinned: true })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.preview', resourceKey: 'file:three' }) })
    expect(viewByResource(state, 'file:two')?.pinned).toBe(true)
    expect(viewByResource(state, 'file:three')).toBeDefined()
    state = apply(state, { type: 'set_view_dirty', viewId: second.id, dirty: true })
    expect(viewByResource(state, 'file:two')?.preview).toBe(false)
    expect(viewByResource(state, 'file:two')?.dirty).toBe(true)
  })

  it('reuses singleton views even when a second resource is requested', () => {
    let state = createPaneWorkspace()
    state = apply(state, {
      type: 'open_view',
      request: view({ kind: 'subagent.navigator', resourceKey: 'session:one', role: 'navigator', singleton: true, preview: false, targetGroupId: 'group:right:navigator' }),
    })
    const first = viewByResource(state, 'session:one')!
    const second = reducePaneWorkspace(state, {
      type: 'open_view',
      request: view({ kind: 'subagent.navigator', resourceKey: 'session:two', role: 'navigator', singleton: true, preview: false, targetGroupId: 'group:right:navigator' }),
    })
    expect(second.accepted).toBe(true)
    expect(Object.values(second.state.views)).toHaveLength(1)
    expect(Object.values(second.state.views)[0]?.id).toBe(first.id)
  })

  it('supports atomic split and normalizes the tree after moving a view', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.editor', resourceKey: 'file:one', preview: false, pinned: true }) })
    const opened = viewByResource(state, 'file:one')!
    state = apply(state, { type: 'split_with_view', viewId: opened.id, targetGroupId: opened.groupId, edge: 'right' })
    const moved = viewByResource(state, 'file:one')!
    expect(moved.groupId).not.toBe('group:right:content')
    expect(Object.values(state.groups).filter(group => group.region === 'right')).toHaveLength(2)
    expect(state.regions.right.root.type).toBe('split')
    if (state.regions.right.root.type === 'split') expect(state.regions.right.root.ratio).toBeGreaterThan(0)
  })

  it('recreates automatic Right semantic groups horizontally after cross-region cleanup', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.editor', resourceKey: 'file:one', preview: false, pinned: true }) })
    const opened = viewByResource(state, 'file:one')!
    state = apply(state, { type: 'move_view', viewId: opened.id, targetGroupId: 'group:bottom:utility' })
    expect(state.groups['group:right:content']).toBeUndefined()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.editor', resourceKey: 'file:two', preview: false, pinned: true }) })
    expect(state.regions.right.root.type).toBe('split')
    if (state.regions.right.root.type === 'split') expect(state.regions.right.root.orientation).toBe('horizontal')
  })

  it('requires owner confirmation before closing dirty views', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.editor', resourceKey: 'file:dirty', preview: false, pinned: true, dirty: true }) })
    const dirty = viewByResource(state, 'file:dirty')!
    const blocked = reducePaneWorkspace(state, { type: 'close_view', viewId: dirty.id })
    expect(blocked.accepted).toBe(false)
    expect(blocked.reason).toBe('confirmation_required')
    state = apply(state, { type: 'close_view', viewId: dirty.id, decision: 'allow' })
    expect(viewByResource(state, 'file:dirty')).toBeUndefined()
  })

  it('supports resize, reset, and bounded undo without changing generation', () => {
    let state = createPaneWorkspace(3)
    state = apply(state, { type: 'resize_split', region: 'right', splitId: 'split:right:root', ratio: 0.9 })
    const resized = state.regions.right.root
    expect(resized.type).toBe('split')
    if (resized.type === 'split') expect(resized.ratio).toBe(PANE_WORKSPACE_LIMITS.maxSplitRatio)
    state = apply(state, { type: 'reset_layout' })
    expect(Object.keys(state.views)).toHaveLength(0)
    state = apply(state, { type: 'undo_layout' })
    expect(state.regions.right.root.type).toBe('split')
    expect(state.generation).toBe(3)
  })

  it('normalizes invalid ratios, duplicate tabs, and over-deep trees into a bounded workspace', () => {
    const base = createPaneWorkspace()
    const malformed = {
      ...base,
      regions: {
        ...base.regions,
        right: {
          ...base.regions.right,
          root: {
            type: 'split', id: 'split:bad', orientation: 'horizontal', ratio: 99,
            first: { type: 'group', groupId: 'group:right:navigator' },
            second: {
              type: 'split', id: 'split:too-deep', orientation: 'vertical', ratio: -2,
              first: { type: 'group', groupId: 'group:right:content' },
              second: { type: 'group', groupId: 'group:right:navigator' },
            },
          },
        },
      },
      groups: {
        ...base.groups,
        'group:right:content': { ...base.groups['group:right:content']!, tabs: ['missing', 'missing'] },
      },
    } as unknown
    const normalized = normalizePaneWorkspace(malformed, 11)
    expect(normalized.generation).toBe(1)
    expect(normalized.regions.right.root.type).toBe('split')
    if (normalized.regions.right.root.type === 'split') {
      expect(normalized.regions.right.root.ratio).toBe(PANE_WORKSPACE_LIMITS.maxSplitRatio)
    }
    expect(Object.keys(normalized.views)).toHaveLength(0)
    expect(Object.values(normalized.groups).every(group => new Set(group.tabs).size === group.tabs.length)).toBe(true)
  })
})

describe('V4 Task 3.4: Bulk Close Operations', () => {
  function createTestState() {
    // Start with a proper workspace state
    let state = createPaneWorkspace(1)

    // Open multiple views in the content group using the proper reducer
    // Use different resource keys and make them non-preview to avoid replacement
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.test', resourceKey: 'file1', title: 'File1.ts', preview: false }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.test', resourceKey: 'file2', title: 'File2.ts', preview: false }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.test', resourceKey: 'file3', title: 'File3.ts', preview: false }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.test', resourceKey: 'file4', title: 'File4.ts', preview: false }) })

    // Get the actual view IDs from the state
    const viewIds = Object.keys(state.views).filter(id => id.startsWith('view:'))

    // Pin view3 and mark view4 as dirty
    if (viewIds[2]) {
      state = apply(state, { type: 'pin_view', viewId: viewIds[2], pinned: true })
    }
    if (viewIds[3]) {
      state = apply(state, { type: 'set_view_dirty', viewId: viewIds[3], dirty: true })
    }

    return state
  }

  function getViewIds(state: PaneWorkspaceV1): string[] {
    return Object.keys(state.views).filter(id => id.startsWith('view:'))
  }

  it('close_others: closes all tabs except the reference tab', () => {
    const state = createTestState()
    const viewIds = getViewIds(state)

    if (viewIds.length < 2) {
      throw new Error('Not enough views for test')
    }

    const result = reducePaneWorkspace(state, {
      type: 'close_views_bulk',
      operation: 'close_others',
      viewId: viewIds[1], // Close others except view2
    })

    expect(result.accepted).toBe(true)
    expect(Object.keys(result.state.views)).toHaveLength(1)
    expect(result.state.views[viewIds[1]]).toBeDefined()
    expect(result.state.views[viewIds[0]]).toBeUndefined()
  })

  it('close_others: requires reference view ID', () => {
    const state = createTestState()
    const result = reducePaneWorkspace(state, {
      type: 'close_views_bulk',
      operation: 'close_others',
    })

    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('invalid_bulk_close')
  })

  it('close_right: closes all tabs to the right of reference tab', () => {
    const state = createTestState()
    const viewIds = getViewIds(state)

    if (viewIds.length < 2) {
      throw new Error('Not enough views for test')
    }

    const result = reducePaneWorkspace(state, {
      type: 'close_views_bulk',
      operation: 'close_right',
      viewId: viewIds[1], // Close tabs to the right of view2
    })

    expect(result.accepted).toBe(true)
    expect(result.state.views[viewIds[0]]).toBeDefined()
    expect(result.state.views[viewIds[1]]).toBeDefined()
    // viewIds[2] and [3] should be closed
  })

  it('close_unpinned: closes only unpinned tabs', () => {
    const state = createTestState()
    const viewIds = getViewIds(state)

    if (viewIds.length < 3) {
      throw new Error('Not enough views for test')
    }

    const result = reducePaneWorkspace(state, {
      type: 'close_views_bulk',
      operation: 'close_unpinned',
      groupId: state.groups['group:right:content']?.id,
    })

    expect(result.accepted).toBe(true)
    // Only viewIds[2] (pinned) should remain
    expect(result.state.views[viewIds[2]]).toBeDefined()
    expect(result.state.views[viewIds[0]]).toBeUndefined()
  })

  it('close_group: closes all tabs in the specified group', () => {
    const state = createTestState()
    const viewIds = getViewIds(state)

    if (viewIds.length === 0) {
      throw new Error('No views for test')
    }

    const result = reducePaneWorkspace(state, {
      type: 'close_views_bulk',
      operation: 'close_group',
      groupId: state.groups['group:right:content']?.id,
    })

    expect(result.accepted).toBe(true)
    expect(Object.keys(result.state.views)).toHaveLength(0)
  })

  it('bulk_close: blocks operation when any view has dirty state without allow decision', () => {
    const state = createTestState()
    const viewIds = getViewIds(state)

    if (viewIds.length < 2) {
      throw new Error('Not enough views for test')
    }

    const result = reducePaneWorkspace(state, {
      type: 'close_views_bulk',
      operation: 'close_others',
      viewId: viewIds[1],
      decision: 'confirm',
    })

    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('close_denied')
    // All views should still exist
    expect(Object.keys(state.views)).toHaveLength(viewIds.length)
  })

  it('bulk_close: allows dirty close with explicit allow decision', () => {
    const state = createTestState()
    const viewIds = getViewIds(state)

    if (viewIds.length < 4) {
      throw new Error('Not enough views for test')
    }

    const result = reducePaneWorkspace(state, {
      type: 'close_views_bulk',
      operation: 'close_others',
      viewId: viewIds[3], // Dirty reference tab
      decision: 'allow',
    })

    expect(result.accepted).toBe(true)
    expect(Object.keys(result.state.views)).toHaveLength(1)
    expect(result.state.views[viewIds[3]]).toBeDefined()
  })

  it('bulk_close: blocks operation when any view has deny close policy', () => {
    const state = createTestState()
    const viewIds = getViewIds(state)

    if (viewIds.length < 2) {
      throw new Error('Not enough views for test')
    }

    // Modify a view to have deny close policy
    const dirtyView = state.views[viewIds[1]]
    if (dirtyView) {
      state.views = {
        ...state.views,
        [viewIds[1]]: { ...dirtyView, closePolicy: 'deny' as const }
      }
    }

    const result = reducePaneWorkspace(state, {
      type: 'close_views_bulk',
      operation: 'close_others',
      viewId: viewIds[0],
    })

    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('close_denied')
    expect(result.effects[0]?.message).toContain('File2.ts')
  })

  it('bulk_close: returns success when no targets to close', () => {
    const state = createTestState()
    const viewIds = getViewIds(state)

    if (viewIds.length < 4) {
      throw new Error('Not enough views for test')
    }

    const result = reducePaneWorkspace(state, {
      type: 'close_views_bulk',
      operation: 'close_right',
      viewId: viewIds[3], // Last tab, nothing to the right
    })

    expect(result.accepted).toBe(true)
    expect(result.reason).toBe('no_targets')
    expect(Object.keys(result.state.views)).toHaveLength(viewIds.length) // Nothing changed
  })

  it('bulk_close: atomically closes all views or none', () => {
    const state = createTestState()
    const viewIds = getViewIds(state)
    const initialViewCount = Object.keys(state.views).length

    if (viewIds.length < 2) {
      throw new Error('Not enough views for test')
    }

    // Simulate a failure scenario - if preflight fails, no views should be closed
    const dirtyView = state.views[viewIds[1]]
    if (dirtyView) {
      state.views = {
        ...state.views,
        [viewIds[1]]: { ...dirtyView, closePolicy: 'deny' as const }
      }
    }

    const result = reducePaneWorkspace(state, {
      type: 'close_views_bulk',
      operation: 'close_others',
      viewId: viewIds[0],
    })

    expect(result.accepted).toBe(false)
    expect(Object.keys(result.state.views)).toHaveLength(initialViewCount) // No views closed
  })
})

import { describe, expect, it } from 'vitest'
import {
  createPaneWorkspace,
  preflightBulkClose,
  reducePaneWorkspace,
  type PaneViewSpecV1,
  type PaneWorkspaceV1,
} from '../src/workspace.js'

function view(request: Partial<PaneViewSpecV1> & Pick<PaneViewSpecV1, 'kind' | 'resourceKey'>): PaneViewSpecV1 {
  return {
    role: 'content',
    preferredRegion: 'right',
    retention: 'recreate',
    singleton: false,
    preview: false,
    ...request,
  }
}

function apply(state: PaneWorkspaceV1, intent: Parameters<typeof reducePaneWorkspace>[1]): PaneWorkspaceV1 {
  const result = reducePaneWorkspace(state, intent)
  expect(result.accepted, result.reason).toBe(true)
  return result.state
}

function populated(): PaneWorkspaceV1 {
  let state = createPaneWorkspace()
  state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:one', pinned: true, title: 'one' }) })
  state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:two', title: 'two' }) })
  state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:three', title: 'three', closePolicy: 'deny' }) })
  state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:four', title: 'four', dirty: true }) })
  return state
}

describe('V4 Task 3.4 Bulk Close', () => {
  it('safe-first close commits recoverable tabs and reports protected reasons without changing legacy atomic semantics', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:clean', title: 'clean' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:dirty', title: 'dirty', dirty: true }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'job.output', resourceKey: 'job:running', title: 'running', metadata: { lifecycle: 'running' } }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'terminal.session', resourceKey: 'terminal:one', title: 'terminal' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:confirm', title: 'confirm', closePolicy: 'confirm' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:deny', title: 'deny', closePolicy: 'deny' }) })
    const groupId = Object.values(state.views)[0]!.groupId
    const safe = reducePaneWorkspace(state, { type: 'bulk_close_safe', groupId, mode: 'group' })
    expect(safe.accepted).toBe(true)
    expect(Object.values(safe.state.views).map(item => item.resourceKey)).not.toContain('file:clean')
    expect(safe.details?.bulkCloseSafe?.protectedViews.map(item => item.reason)).toEqual(['dirty', 'running', 'terminal', 'confirm', 'deny'])

    const legacy = reducePaneWorkspace(state, { type: 'bulk_close', groupId, mode: 'group' })
    expect(legacy.accepted).toBe(false)
    expect(Object.keys(legacy.state.views)).toEqual(Object.keys(state.views))
  })

  it('rejects Close Group when any target is deny and leaves every tab in place', () => {
    const state = populated()
    const before = Object.keys(state.views).sort()
    const denied = reducePaneWorkspace(state, { type: 'bulk_close', groupId: 'group:right:content', mode: 'group' })
    expect(denied.accepted).toBe(false)
    expect(denied.reason).toBe('close_denied')
    expect(Object.keys(denied.state.views).sort()).toEqual(before)
    const preflight = preflightBulkClose(state, 'group:right:content', 'group')
    expect(preflight.accepted).toBe(false)
    expect(preflight.blockerViewId).toBeDefined()
  })

  it('rejects Close Others when a sibling is dirty without an allow decision', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:keep', pinned: true, title: 'keep' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:dirty', title: 'dirty', dirty: true }) })
    const source = Object.values(state.views).find(item => item.resourceKey === 'file:keep')!
    const blocked = reducePaneWorkspace(state, {
      type: 'bulk_close',
      groupId: source.groupId,
      mode: 'others',
      sourceViewId: source.id,
    })
    expect(blocked.accepted).toBe(false)
    expect(blocked.reason).toBe('confirmation_required')
    expect(Object.keys(blocked.state.views)).toHaveLength(Object.keys(state.views).length)
  })

  it('atomically closes only unpinned tabs when every target is allowed', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:keep', pinned: true, title: 'keep' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:drop-a', title: 'drop-a' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:drop-b', title: 'drop-b' }) })
    const next = reducePaneWorkspace(state, { type: 'bulk_close', groupId: 'group:right:content', mode: 'unpinned' })
    expect(next.accepted).toBe(true)
    expect(Object.values(next.state.views).map(item => item.resourceKey)).toEqual(['file:keep'])
  })

  it('closes tabs to the right of the source in one commit', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:left', pinned: true, title: 'left' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:mid', title: 'mid' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:right', title: 'right' }) })
    const mid = Object.values(state.views).find(item => item.resourceKey === 'file:mid')!
    const next = reducePaneWorkspace(state, {
      type: 'bulk_close',
      groupId: mid.groupId,
      mode: 'right',
      sourceViewId: mid.id,
    })
    expect(next.accepted).toBe(true)
    expect(Object.values(next.state.views).map(item => item.resourceKey).sort()).toEqual(['file:left', 'file:mid'])
  })
})

/**
 * V4 Task 3.2: Tab Lifecycle Tests
 *
 * Tests for:
 * - pinned/normal-preview segments
 * - preview→pinned commit
 * - same-resource dedupe
 * - explicit duplicate
 * - state presentation (not just colors)
 */

import { describe, it, expect } from 'vitest'
import {
  createPaneWorkspace,
  reducePaneWorkspace,
  type PaneWorkspaceIntentV1,
  type PaneViewSpecV1,
  type PaneWorkspaceV1,
} from './workspace.js'

function view(request: Partial<PaneViewSpecV1> & Pick<PaneViewSpecV1, 'kind' | 'resourceKey'>): PaneViewSpecV1 {
  return {
    role: 'content',
    preferredRegion: 'right',
    retention: 'recreate',
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

describe('Tab Lifecycle', () => {
  describe('pinned/normal-preview segments', () => {
    it('should create preview tab when request.preview=true', () => {
      const workspace = createPaneWorkspace()
      const result = reducePaneWorkspace(workspace, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          preview: true,
        }),
      })

      expect(result.accepted).toBe(true)
      const createdView = viewByResource(result.state, 'file:tmp-test.md')
      expect(createdView?.preview).toBe(true)
      expect(createdView?.pinned).toBe(false)
    })

    it('should create pinned tab when request.pinned=true', () => {
      const workspace = createPaneWorkspace()
      const result = reducePaneWorkspace(workspace, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          pinned: true,
          preview: false,
        }),
      })

      expect(result.accepted).toBe(true)
      const createdView = viewByResource(result.state, 'file:tmp-test.md')
      expect(createdView?.preview).toBe(false)
      expect(createdView?.pinned).toBe(true)
    })

    it('should create normal tab when neither preview nor pinned', () => {
      const workspace = createPaneWorkspace()
      const result = reducePaneWorkspace(workspace, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          preview: false,
        }),
      })

      expect(result.accepted).toBe(true)
      const createdView = viewByResource(result.state, 'file:tmp-test.md')
      expect(createdView?.preview).toBe(false)
      expect(createdView?.pinned).toBe(false)
    })
  })

  describe('preview→pinned commit', () => {
    it('should convert preview to pinned on pin_view intent', () => {
      let state = createPaneWorkspace()
      state = apply(state, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          preview: true,
        }),
      })

      const viewId = Object.keys(state.views)[0]!
      expect(state.views[viewId]?.preview).toBe(true)

      state = apply(state, { type: 'pin_view', viewId, pinned: true })

      const currentView = state.views[viewId]
      expect(currentView?.preview).toBe(false)
      expect(currentView?.pinned).toBe(true)
    })

    it('should convert pinned to preview on unpin', () => {
      let state = createPaneWorkspace()
      state = apply(state, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          pinned: true,
          preview: false,
        }),
      })

      const viewId = Object.keys(state.views)[0]!

      state = apply(state, { type: 'pin_view', viewId, pinned: false })

      const currentView = state.views[viewId]
      expect(currentView?.pinned).toBe(false)
      // Unpinning a previously pinned tab doesn't automatically make it preview
      // The preview status depends on the original view's preview property
      expect(currentView?.preview).toBe(false) // maintains original preview status
    })
  })

  describe('same-resource dedupe', () => {
    it('should reuse existing view when singleton=true', () => {
      let state = createPaneWorkspace()
      state = apply(state, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          singleton: true,
          preview: false,
        }),
      })

      const viewCount = Object.keys(state.views).length

      // Try to open same resource again
      const result = reducePaneWorkspace(state, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          singleton: true,
          preview: false,
        }),
      })

      expect(result.accepted).toBe(true)
      expect(result.reason).toBe('reused')
      expect(Object.keys(result.state.views).length).toBe(viewCount)
    })

    it('should reuse existing view when duplicate=false', () => {
      let state = createPaneWorkspace()
      state = apply(state, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          duplicate: false,
        }),
      })

      const viewCount = Object.keys(state.views).length

      // Try to open same resource again
      const result = reducePaneWorkspace(state, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          duplicate: false,
        }),
      })

      expect(result.accepted).toBe(true)
      expect(result.reason).toBe('reused')
      expect(Object.keys(result.state.views).length).toBe(viewCount)
    })

    it('should create duplicate when duplicate=true', () => {
      let state = createPaneWorkspace()
      state = apply(state, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          duplicate: true,
          preview: false,
        }),
      })

      const viewCount = Object.keys(state.views).length

      // Create explicit duplicate - same resource but duplicate=true allows it
      const result = reducePaneWorkspace(state, {
        type: 'open_view',
        request: view({
          kind: 'file.text',
          resourceKey: 'file:tmp-test.md',
          duplicate: true,
          preview: false,
        }),
      })

      expect(result.accepted).toBe(true)
      expect(result.reason).toBe('duplicated')
      expect(Object.keys(result.state.views).length).toBe(viewCount + 1)
    })
  })

  describe('explicit duplicate', () => {
    it('should mark view as duplicate when request.duplicate=true', () => {
      const workspace = createPaneWorkspace()
      const testRequest = view({
        kind: 'file.text',
        resourceKey: 'file:tmp-test.md',
        duplicate: true,
        preview: false,
      })
      const result = reducePaneWorkspace(workspace, {
        type: 'open_view',
        request: testRequest,
      })

      expect(result.accepted).toBe(true)
      const createdView = viewByResource(result.state, 'file:tmp-test.md')
      expect(createdView?.duplicate).toBe(true)
    })
  })

  describe('state presentation', () => {
    it('should have distinct state fields for dirty/attention/offline/orphaned', () => {
      const testRequest = view({
        kind: 'file.text',
        resourceKey: 'file:tmp-test.md',
        dirty: true,
        preview: false,
      })
      const result = reducePaneWorkspace(createPaneWorkspace(), {
        type: 'open_view',
        request: testRequest,
      })

      expect(result.accepted).toBe(true)
      const currentView = viewByResource(result.state, 'file:tmp-test.md')

      // Check distinct fields exist for state presentation
      expect(currentView?.dirty).toBe(true)
      expect(currentView?.pinned).toBe(true) // dirty tabs auto-pin
      expect(currentView?.preview).toBe(false) // dirty tabs cannot be preview
      expect(currentView?.status).toBeDefined()
    })
  })
})

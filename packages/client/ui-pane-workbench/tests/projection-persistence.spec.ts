import { describe, expect, it } from 'vitest'
import {
  createPaneWorkspace,
  projectPaneWorkspace,
  reducePaneWorkspace,
  restorePaneWorkspace,
  serializePaneWorkspace,
  type PaneWorkspaceV1,
} from '../src/index.js'

function openTerminal(state: PaneWorkspaceV1): PaneWorkspaceV1 {
  return reducePaneWorkspace(state, {
    type: 'open_view',
    request: {
      kind: 'terminal.session',
      resourceKey: 'terminal:one',
      role: 'utility',
      preferredRegion: 'bottom',
      retention: 'keep-alive',
      singleton: true,
      preview: false,
    },
  }).state
}

describe('PaneWorkspace projection and presentation persistence', () => {
  it('projects compact and sheet modes without changing canonical regions', () => {
    const state = openTerminal(createPaneWorkspace())
    const before = JSON.stringify({ right: state.regions.right, bottom: state.regions.bottom })
    const wide = projectPaneWorkspace(state, 1400)
    const compact = projectPaneWorkspace(state, 900)
    const sheet = projectPaneWorkspace(state, 430)
    expect(wide.mode).toBe('wide')
    expect(wide.visibleGroupIds).toContain('group:right:content')
    expect(wide.visibleGroupIds).toContain('group:bottom:utility')
    expect(compact.mode).toBe('compact')
    expect(compact.visibleGroupIds.every(id => id.startsWith('group:bottom') || id.startsWith('group:right'))).toBe(true)
    expect(sheet.mode).toBe('sheet')
    expect(sheet.visibleGroupIds).toHaveLength(1)
    expect(JSON.stringify({ right: state.regions.right, bottom: state.regions.bottom })).toBe(before)
  })

  it('serializes only safe presentation fields and restores through normalization', () => {
    let state = createPaneWorkspace(9)
    state = reducePaneWorkspace(state, {
      type: 'open_view',
      request: {
        kind: 'file.editor',
        resourceKey: 'file:README.md',
        role: 'content',
        preferredRegion: 'right',
        retention: 'snapshot',
        singleton: false,
        preview: false,
        pinned: true,
        metadata: { rawPrompt: 'must not persist' },
      },
    }).state
    const persisted = serializePaneWorkspace(state)
    expect(persisted.schema).toBe('pane.workspace.persisted.v1alpha1')
    expect(JSON.stringify(persisted)).not.toContain('rawPrompt')
    expect(JSON.stringify(persisted)).not.toContain('history')
    const restored = restorePaneWorkspace(persisted, 10)
    expect(restored.generation).toBe(10)
    expect(Object.values(restored.views).map(view => view.resourceKey)).toEqual(['file:README.md'])
    expect(Object.values(restored.views)[0]?.pinned).toBe(true)
  })

  it('falls back to the default preset for unknown persistence schema', () => {
    const restored = restorePaneWorkspace({ schema: 'pane.workspace.persisted.v0' }, 4)
    expect(restored.generation).toBe(4)
    expect(restored.regions.right.root.type).toBe('split')
    expect(Object.keys(restored.views)).toHaveLength(0)
  })
})

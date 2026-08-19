import { describe, expect, it } from 'vitest'
import {
  createPaneWorkspace,
  PANE_WORKSPACE_STORAGE_NAMESPACE,
  PaneWorkspacePersistenceAdapter,
  projectPaneWorkspace,
  reducePaneWorkspace,
  restorePaneWorkspace,
  serializePaneWorkspace,
  type PaneWorkspaceV1,
} from '../src/index.js'

function memoryStorage(): Map<string, string> & {
  getItem(key: string): string | undefined
  setItem(key: string, value: string): void
  removeItem(key: string): void
} {
  const values = new Map<string, string>()
  return Object.assign(values, {
    getItem: (key: string) => values.get(key),
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  })
}

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

  it('persists session and presets through a safe storage adapter and supports reset/delete', () => {
    const storage = memoryStorage()
    const adapter = new PaneWorkspacePersistenceAdapter(storage)
    let state = openTerminal(createPaneWorkspace(9))
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
        metadata: { rawPrompt: 'should never be serialized', nested: { providerPayload: 'redact' } },
      },
    }).state

    expect(adapter.saveSession(state)).toBe(true)
    const raw = storage.get(`${PANE_WORKSPACE_STORAGE_NAMESPACE}:session`)
    expect(raw).toBeDefined()
    expect(raw).not.toContain('rawPrompt')
    expect(raw).not.toContain('providerPayload')
    expect(raw).not.toContain('history')
    expect(adapter.loadSession(12).generation).toBe(12)
    expect(adapter.loadSession(12).regions.bottom.visible).toBe(true)

    expect(adapter.savePreset('desktop', state)).toBe(true)
    expect(adapter.loadPreset('desktop', 13).regions.bottom.visible).toBe(true)
    expect(adapter.savePreset('unsafe/name', state)).toBe(false)
    expect(adapter.deletePreset('desktop')).toBe(true)
    expect(Object.keys(adapter.loadPreset('desktop', 14).views)).toHaveLength(0)

    expect(adapter.deleteLocalLayout()).toBe(true)
    expect(adapter.loadSession(15).generation).toBe(15)
    expect(adapter.reset(16).generation).toBe(16)
  })

  it('recovers from malformed storage and storage exceptions without exposing raw errors', () => {
    const storage = memoryStorage()
    const adapter = new PaneWorkspacePersistenceAdapter(storage)
    storage.set(`${PANE_WORKSPACE_STORAGE_NAMESPACE}:session`, '{malformed')
    expect(adapter.load(21).views).toEqual({})
    storage.set(`${PANE_WORKSPACE_STORAGE_NAMESPACE}:session`, JSON.stringify({
      schema: 'pane.workspace.persisted.v1alpha1',
      groups: { broken: { tabs: null } },
    }))
    expect(adapter.load(21).generation).toBe(21)

    const broken = {
      getItem: () => { throw new Error('storage unavailable') },
      setItem: () => { throw new Error('storage unavailable') },
      removeItem: () => { throw new Error('storage unavailable') },
    }
    const fallback = new PaneWorkspacePersistenceAdapter(broken)
    expect(fallback.load(22).generation).toBe(22)
    expect(fallback.save(createPaneWorkspace())).toBe(false)
    expect(fallback.deleteLocalLayout()).toBe(false)
    expect(fallback.reset(23).generation).toBe(23)
  })
})

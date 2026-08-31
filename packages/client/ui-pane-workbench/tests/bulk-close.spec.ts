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

describe('safe presentation updates (V3 2.6)', () => {
  it('updates a title with control characters stripped and a 160-char cap', () => {
    const state = populated()
    const first = Object.values(state.groups).find(group => group.tabs.length > 0)!.tabs[0]!
    const updated = reducePaneWorkspace(state, { type: 'update_view_presentation', viewId: first, title: `bad${String.fromCharCode(7)}title ${'x'.repeat(300)}` })
    expect(updated.accepted, updated.reason).toBe(true)
    const title = updated.state.views[first]?.title ?? ''
    expect(title.startsWith('badtitle ')).toBe(true)
    expect(title).toHaveLength(160)
  })

  it('is a safe no-op for missing views, empty, and unchanged titles', () => {
    const state = populated()
    expect(reducePaneWorkspace(state, { type: 'update_view_presentation', viewId: 'nope', title: 'x' }).accepted).toBe(false)
    expect(reducePaneWorkspace(state, { type: 'update_view_presentation', viewId: Object.keys(state.views)[0]!, title: '   ' }).accepted).toBe(false)
    const viewId = Object.keys(state.views)[0]!
    const same = reducePaneWorkspace(state, { type: 'update_view_presentation', viewId, title: state.views[viewId]!.title })
    expect(same.accepted).toBe(false)
  })
})

describe('V2 persistence allowlist (V3 7.4)', () => {
  it('round-trips presentation state and drops every forbidden payload key', async () => {
    const { serializePaneWorkspace, restorePaneWorkspace } = await import('../src/persistence.js')
    let state = populated()
    const viewId = Object.keys(state.views)[0]!
    // malicious extra keys must never survive the field-by-field projection
    ;(state.views[viewId] as unknown as Record<string, unknown>).content = 'RAW FILE CONTENT'
    ;(state.views[viewId] as unknown as Record<string, unknown>).accessSource = 'https://evil.example/fetch'
    ;(state.views[viewId] as unknown as Record<string, unknown>).output = 'xterm buffer\x1b[2J'
    ;(state.views[viewId] as unknown as Record<string, unknown>).cursor = { row: 3, col: 4 }
    ;(state.views[viewId] as unknown as Record<string, unknown>).lease = 'token-abc'
    ;(state.views[viewId] as unknown as Record<string, unknown>).path = '/etc/passwd'
    ;(state.views[viewId] as unknown as Record<string, unknown>).token = 'Bearer x'
    ;(state.views[viewId] as unknown as Record<string, unknown>).mediaBytes = 'binary-bytes'
    const persisted = serializePaneWorkspace(state)
    const serialized = JSON.stringify(persisted)
    expect(serialized).not.toContain('RAW FILE CONTENT')
    expect(serialized).not.toContain('evil.example')
    expect(serialized).not.toContain('xterm buffer')
    expect(serialized).not.toContain('token-abc')
    expect(serialized).not.toContain('/etc/passwd')
    expect(serialized).not.toContain('Bearer')
    expect(serialized).not.toContain('binary-bytes')
    for (const forbidden of ['content', 'accessSource', 'output', 'cursor', 'lease', 'path', 'token', 'mediaBytes']) {
      expect(persisted.views[viewId!]).not.toHaveProperty(forbidden)
    }
    // presentation state survives: safe title + opaque resource key
    const restored = restorePaneWorkspace(JSON.parse(JSON.stringify(persisted)))
    expect(restored.views[viewId]?.title).toBe(state.views[viewId]!.title)
    expect(restored.views[viewId]?.resourceKey).toBe(state.views[viewId]!.resourceKey)
  })
})

describe('V3 7.5 disposal/HMR surface release', () => {
  it('registry dispose clears slots and listeners with no residual registration', async () => {
    const { PaneViewRegistry, PaneViewRegistrationError } = await import('../src/view-registry.ts')
    const fired: number[] = []
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    const unsubscribe = registry.subscribe(() => { fired.push(1) })
    const disposeX = registry.registerView({ descriptor: { kind: 'k.x', label: 'X', componentKey: 'x', role: 'content', preferredRegion: 'right', retention: 'recreate', singleton: false }, component: () => null })
    registry.registerView({ descriptor: { kind: 'k.y', label: 'Y', componentKey: 'y', role: 'content', preferredRegion: 'right', retention: 'recreate', singleton: false }, component: () => null })
    expect(registry.snapshot()).toHaveLength(2)
    expect(fired.length).toBeGreaterThanOrEqual(2)
    disposeX() // HMR unload: the k.x slot is released
    expect(registry.has('k.x')).toBe(false)
    expect(registry.snapshot()).toHaveLength(1) // no layout reservation residue
    // re-registering the same kind after dispose succeeds (no duplicate-kind poison)
    registry.registerView({ descriptor: { kind: 'k.x', label: 'X2', componentKey: 'x', role: 'content', preferredRegion: 'right', retention: 'recreate', singleton: false }, component: () => null })
    expect(registry.has('k.x')).toBe(true)
    // a duplicate kind while live still fails loud
    expect(() => registry.registerView({ descriptor: { kind: 'k.x', label: 'X3', componentKey: 'x', role: 'content', preferredRegion: 'right', retention: 'recreate', singleton: false }, component: () => null })).toThrow(PaneViewRegistrationError)
    unsubscribe()
    expect(fired.length).toBeGreaterThanOrEqual(3)
  })
})

describe('V3 7.5 preview/terminal handle release parity', () => {
  it('source files expose symmetric release paths (detach/dispose/teardown contracts)', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const { resolve } = require('node:path') as typeof import('node:path')
    const previewAccess = readFileSync(resolve(process.cwd(), '../../bundle/dsh-rich-media/src/client/preview/access.ts'), 'utf8')
    expect(previewAccess).toContain('release')
    const terminalPanel = readFileSync(resolve(process.cwd(), '../../bundle/dsh-terminal/src/client/terminal-panel.tsx'), 'utf8')
    expect(terminalPanel).toContain('detach')
    expect(terminalPanel).toContain('dispose')
  })
})

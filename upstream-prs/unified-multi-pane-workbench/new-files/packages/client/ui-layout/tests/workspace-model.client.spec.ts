import { describe, expect, it } from 'vitest'
import { dockGroup, closePane, emptyWorkspace, groupForPane, layoutBoxes, movePane, openPane, readWorkspace, serializeWorkspace, type PaneReference } from '../src/client/workspace-model.ts'
import { hitTestLayout, resizeSplit, WorkspaceLayoutController } from '../src/client/workspace-service.ts'

const chat = (id: string, pinned = false, project = 'A'): PaneReference => ({ id, kind: 'conversation', sessionId: id, workspaceId: project, title: id, pinned })
const viewport = { x: 0, y: 0, width: 1000, height: 700 }

describe('host-owned workspace layout', () => {
  it('replaces only preview views and moves an existing cross-project conversation exactly once', () => {
    let s = openPane(emptyWorkspace('A'), chat('one'))
    s = openPane(s, chat('two'))
    expect(Object.keys(s.panes)).toEqual(['two'])
    s.panes.two!.pinned = true
    s = openPane(s, chat('three', true, 'B'))
    const group = groupForPane(s, 'two')!.id
    s = movePane(s, 'three', { type: 'split', groupId: group, edge: 'right' })
    expect(Object.keys(s.groups)).toHaveLength(2)
    expect(s.panes.three!.workspaceId).toBe('B')
    expect(s.workspaceId).toBe('A')
    s = openPane(s, chat('three'))
    expect(Object.keys(s.panes)).toEqual(['two', 'three'])
    expect(s.focused).toBe(groupForPane(s, 'three')!.id)
  })
  it.each(['left', 'right', 'top', 'bottom'] as const)('splits %s, moves across groups, and collapses the empty branch', edge => {
    let s = openPane(openPane(emptyWorkspace('A'), chat('one', true)), chat('two', true))
    const group = s.focused!
    s = movePane(s, 'two', { type: 'split', groupId: group, edge })
    expect(s.root?.type).toBe('split')
    const boxes = layoutBoxes(s, viewport)
    expect(boxes[group]).toBeDefined()
    s = movePane(s, 'two', { type: 'tab', groupId: group, index: 0 })
    expect(s.groups[group]!.panes).toEqual(['two', 'one'])
    expect(s.root).toEqual({ type: 'group', id: group })
    expect(Object.keys(s.groups)).toHaveLength(1)
  })
  it('floats, clamps on a smaller viewport, redocks, and closes only the view', () => {
    let s = openPane(emptyWorkspace('A'), chat('one', true))
    s = movePane(s, 'one', { type: 'float', box: { x: 800, y: 500, width: 520, height: 400 } })
    expect(s.root).toBeNull()
    expect(s.floating).toHaveLength(1)
    const b = layoutBoxes(s, { ...viewport, width: 360, height: 560 })[s.focused!]!
    expect(b.x + b.width).toBeLessThanOrEqual(360)
    expect(b.y + b.height).toBeLessThanOrEqual(560)
    s = openPane(s, chat('two', true))
    s = closePane(s, 'one')
    expect(s.panes.two!.sessionId).toBe('two')
    s = closePane(s, 'two')
    expect(s.root).toBeNull()
    expect(s.floating).toEqual([])
    expect(s.groups).toEqual({})
  })
  it('reveals an existing pane when another group is maximized', () => {
    const owner = new WorkspaceLayoutController()
    owner.switchWorkspace('A'); owner.openPane(chat('one', true)); owner.openPane(chat('two', true))
    const first = owner.source.getSnapshot().layout.focused!
    owner.movePane('two', { type: 'split', groupId: first, edge: 'right' })
    owner.maximize(first)
    expect(owner.source.getSnapshot().layout.focused).toBe(first)
    owner.openPane(chat('two', true))
    const next = owner.source.getSnapshot().layout
    expect(next.maximized).toBeNull()
    expect(next.focused).toBe(groupForPane(next, 'two')!.id)
  })
  it('docks a floating group contiguously at the insertion point and retains its active tab', () => {
    let s = openPane(openPane(openPane(emptyWorkspace('A'), chat('one', true)), chat('two', true)), chat('three', true))
    const root = s.focused!
    s = movePane(s, 'one', { type: 'float', box: { x: 100, y: 100, width: 400, height: 300 } })
    const floating = s.floating[0]!.groupId
    s = movePane(s, 'two', { type: 'tab', groupId: floating })
    s = dockGroup(s, floating, { type: 'tab', groupId: root, index: 0 })
    expect(s.floating).toEqual([])
    expect(s.groups[root]!.panes).toEqual(['one', 'two', 'three'])
    expect(s.groups[root]!.active).toBe('two')
  })
  it('rejects invalid destinations atomically and does not use captured element identity', () => {
    let s = openPane(emptyWorkspace('A'), chat('one', true))
    const group = s.focused!
    expect(movePane(s, 'one', { type: 'split', groupId: 'missing', edge: 'right' })).toBe(s)
    expect(movePane(s, 'one', { type: 'split', groupId: group, edge: 'left' })).toBe(s)
    expect(hitTestLayout(s, viewport, -1, 50).reason).toBe('outside')
    expect(hitTestLayout(s, { ...viewport, width: 360 }, 355, 200).reason).toBe('space')
    s = openPane(s, chat('two', true))
    expect(hitTestLayout(s, viewport, 990, 200, 'one').destination).toEqual({ type: 'split', groupId: group, edge: 'right' })
    expect(hitTestLayout(s, viewport, 500, 350, 'one').destination?.type).toBe('float')
  })
  it('clamps separator travel to descendant minimum sizes', () => {
    let s = openPane(openPane(emptyWorkspace('A'), chat('one', true)), chat('two', true))
    s = movePane(s, 'two', { type: 'split', groupId: s.focused!, edge: 'right' })
    const split = s.root!
    s = resizeSplit(s, split.id, 1, viewport)
    expect(s.root?.type === 'split' && s.root.ratio).toBeCloseTo(280 / 996)
    expect(layoutBoxes(s, viewport)[groupForPane(s, 'one')!.id]!.width).toBe(280)
  })
  it('roundtrips a validated layout but rejects corrupt graphs and excludes extra draft fields', () => {
    const s = openPane(emptyWorkspace('A'), { ...chat('one'), draft: 'must not persist' } as PaneReference)
    const encoded = serializeWorkspace(s)
    expect(encoded).not.toContain('must not persist')
    expect(readWorkspace(encoded, 'A')?.panes.one!.sessionId).toBe('one')
    expect(readWorkspace(encoded, 'B')).toBeUndefined()
    s.groups[s.focused!]!.panes.push('one')
    expect(readWorkspace(serializeWorkspace(s), 'A')).toBeUndefined()
  })
  it('saves per-project layouts and named presets without invoking business operations on restore', () => {
    const memory = new Map<string, string>()
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value) } }
    const owner = new WorkspaceLayoutController(storage)
    owner.switchWorkspace('A'); owner.openPane(chat('one', true)); owner.savePreset('review')
    owner.switchWorkspace('B'); owner.openPane(chat('two', true))
    owner.switchWorkspace('A')
    expect(Object.keys(owner.source.getSnapshot().layout.panes)).toEqual(['one'])
    const restored = new WorkspaceLayoutController(storage)
    restored.switchWorkspace('A'); restored.reset(); restored.restorePreset('review')
    expect(Object.keys(restored.source.getSnapshot().layout.panes)).toEqual(['one'])
    expect(restored.source.getSnapshot().presets).toEqual(['review'])
  })
  it('keeps the live workspace when browser storage is denied', () => {
    const owner = new WorkspaceLayoutController({ getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } })
    owner.switchWorkspace('A'); owner.openPane(chat('one'))
    expect(owner.source.getSnapshot().layout.panes.one).toBeDefined()
    expect(owner.source.getSnapshot().error).toBe('storage')
  })
  it('rejects duplicate session bindings in storage and refuses a geometry write that retargets a session', () => {
    const owner = new WorkspaceLayoutController()
    owner.switchWorkspace('A'); owner.openPane(chat('one', true)); owner.openPane(chat('two', true))
    const original = owner.source.getSnapshot().layout
    const forged = structuredClone(original)
    forged.panes.two!.sessionId = 'one'
    expect(readWorkspace(serializeWorkspace(forged), 'A')).toBeUndefined()
    forged.panes.two!.sessionId = 'some-other-session'
    owner.commitGeometry(forged)
    expect(owner.source.getSnapshot().layout).toBe(original)
  })
  it('preserves close guards and only imports a legacy layout after an explicit choice', async () => {
    const owner = new WorkspaceLayoutController()
    owner.switchWorkspace('A')
    owner.registerView({ kind: 'editor', title: 'Editor', rendererKey: 'editor', beforeClose: () => false })
    owner.openPane({ id: 'editor', kind: 'editor', title: 'Editor', pinned: true })
    await owner.closePane('editor')
    expect(owner.source.getSnapshot().layout.panes.editor).toBeDefined()
    expect(owner.source.getSnapshot().error).toBe('protected')
    let loads = 0
    owner.registerLegacyLayout('old', 'Old unassigned layout', () => { loads++; return openPane(emptyWorkspace('unassigned'), chat('old-session', true)) })
    expect(loads).toBe(0)
    owner.reset()
    expect(owner.source.getSnapshot().layout.panes.editor).toBeDefined()
    owner.switchWorkspace('B')
    expect(owner.source.getSnapshot().layout.workspaceId).toBe('A')
    owner.importLegacyLayout('old')
    expect(owner.source.getSnapshot().layout.panes.editor).toBeDefined()
    // An explicit import cannot bypass the editor save guard.
    owner.registerLegacyLayout('same', 'Same editor', () => owner.source.getSnapshot().layout)
    owner.importLegacyLayout('same')
    expect(loads).toBe(1)
    expect(owner.source.getSnapshot().layout.workspaceId).toBe('A')
    expect(owner.source.getSnapshot().presets.some(name => name.startsWith('legacy-backup:'))).toBe(true)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { groupForPane, readWorkspace, serializeWorkspace, type PaneReference, type WorkspaceSnapshot } from '../src/client/workspace-model.ts'
import { WorkspaceLayoutController, type WorkspaceStorage } from '../src/client/workspace-service.ts'

function storage(): WorkspaceStorage {
  const values = new Map<string, string>()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
}
const chat = (id: string, project: string): PaneReference => ({ id, kind: 'conversation', title: id, sessionId: `session:${id}`, workspaceId: project, pinned: true })
const editor = (resourceKey = 'resource:current'): PaneReference => ({ id: 'editor', kind: 'editor', title: 'Editor', workspaceId: 'A', resourceKey, pinned: true })
function layout(owner: WorkspaceLayoutController): WorkspaceSnapshot { return owner.source.getSnapshot().layout }
function expectUniqueBindings(value: WorkspaceSnapshot, references: PaneReference[]): void {
  const ids = Object.values(value.groups).flatMap(group => group.panes)
  expect(ids.toSorted()).toEqual(references.map(pane => pane.id).toSorted())
  expect(new Set(ids).size).toBe(ids.length)
  expect(Object.keys(value.panes).toSorted()).toEqual(ids.toSorted())
  for (const reference of references) expect(value.panes[reference.id]).toEqual(reference)
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(accept => { resolve = accept })
  return { promise, resolve }
}

// The storage adapter holds only serialized owner output; editor contents remain outside this controller.
describe('named preset continuity through the real workspace controller', () => {
  it.each([2, 3])('restores %i mixed-project panes repeatedly and reconstructs project-scoped named presets', count => {
    const persistence = storage()
    const owner = new WorkspaceLayoutController(persistence)
    owner.switchWorkspace('A')
    const references = Array.from({ length: count }, (_, index) => chat(`pane:${index}`, index === 0 ? 'A' : 'B'))
    for (const reference of references) owner.openPane(reference)
    const firstGroup = groupForPane(layout(owner), references[0]!.id)!.id
    for (const reference of references.slice(1)) owner.movePane(reference.id, { type: 'split', groupId: firstGroup, edge: 'right' })
    const saved = layout(owner)
    expect(Object.keys(saved.groups)).toHaveLength(count)
    owner.savePreset('review')
    for (const reference of references.slice(1)) owner.movePane(reference.id, { type: 'tab', groupId: firstGroup })
    expect(Object.keys(layout(owner).groups)).toHaveLength(1)
    owner.restorePreset('review'); owner.restorePreset('review')
    expect(layout(owner)).toEqual(saved)
    expectUniqueBindings(layout(owner), references)
    expect(readWorkspace(serializeWorkspace(layout(owner)), 'A')).toEqual(saved)

    owner.switchWorkspace('B')
    const otherProject = chat('other-project-pane', 'B')
    owner.openPane(otherProject); owner.savePreset('review')
    const reconstructed = new WorkspaceLayoutController(persistence)
    expect(layout(reconstructed).workspaceId).toBe('B')
    reconstructed.restorePreset('review')
    expectUniqueBindings(layout(reconstructed), [otherProject])
    reconstructed.switchWorkspace('A'); reconstructed.restorePreset('review'); reconstructed.restorePreset('review')
    expect(layout(reconstructed)).toEqual(saved)
    expectUniqueBindings(layout(reconstructed), references)
    expect(reconstructed.source.getSnapshot().presets).toEqual(['review'])
  })

  it('preserves an existing guarded editor identity while restoring its saved geometry', () => {
    const owner = new WorkspaceLayoutController(storage())
    owner.switchWorkspace('A'); owner.openPane(chat('one', 'A')); owner.openPane(editor())
    const conversationGroup = groupForPane(layout(owner), 'one')!.id
    owner.movePane('editor', { type: 'split', groupId: conversationGroup, edge: 'bottom' })
    const saved = layout(owner)
    expect(Object.keys(saved.groups)).toHaveLength(2)
    expect(groupForPane(saved, 'editor')!.id).not.toBe(conversationGroup)
    owner.savePreset('editing')
    const guard = vi.fn(() => false)
    owner.registerView({ kind: 'editor', title: 'Editor', rendererKey: 'editor', beforeClose: guard })
    owner.movePane('editor', { type: 'tab', groupId: conversationGroup })
    expect(Object.keys(layout(owner).groups)).toHaveLength(1)
    expect(layout(owner).root).not.toEqual(saved.root)
    expect(groupForPane(layout(owner), 'editor')!.id).toBe(conversationGroup)
    owner.restorePreset('editing')
    expect(layout(owner)).toEqual(saved)
    expect(layout(owner).panes.editor).toEqual(editor())
    expect(guard).not.toHaveBeenCalled()
    expect(owner.source.getSnapshot().error).toBeNull()
  })

  it.each(['omit', 'retarget'] as const)('refuses a preset that would %s a protected editor', async mode => {
    const owner = new WorkspaceLayoutController(storage())
    owner.switchWorkspace('A'); owner.openPane(chat('one', 'A'))
    if (mode === 'retarget') owner.openPane(editor('resource:previous'))
    owner.savePreset('review')
    if (mode === 'retarget') await owner.closePane('editor')
    owner.openPane(editor())
    const before = layout(owner)
    const guard = vi.fn(() => false)
    owner.registerView({ kind: 'editor', title: 'Editor', rendererKey: 'editor', beforeClose: guard })
    owner.restorePreset('review')
    expect(guard).toHaveBeenCalledExactlyOnceWith('editor')
    expect(layout(owner)).toBe(before)
    expect(owner.source.getSnapshot().error).toBe('protected')
  })

  it.each(['false', 'throw', 'reject'] as const)('fails closed when the registered preset guard returns %s', async mode => {
    const owner = new WorkspaceLayoutController(storage())
    owner.switchWorkspace('A'); owner.savePreset('empty'); owner.openPane(editor())
    const before = layout(owner)
    owner.registerView({ kind: 'editor', title: 'Editor', rendererKey: 'editor', beforeClose: () => {
      if (mode === 'throw') throw new Error('Save refused')
      if (mode === 'reject') return Promise.reject(new Error('Save unavailable'))
      return Promise.resolve(false)
    } })
    owner.restorePreset('empty')
    await vi.waitFor(() => expect(owner.source.getSnapshot().error).toBe('protected'))
    expect(layout(owner)).toBe(before)
  })

  it('waits for every affected pane guard before applying an allowed preset', async () => {
    const owner = new WorkspaceLayoutController(storage())
    owner.switchWorkspace('A'); owner.savePreset('empty')
    owner.openPane(editor()); owner.openPane({ ...editor('resource:second'), id: 'second-editor' })
    const before = layout(owner)
    const first = deferred<boolean>(), second = deferred<boolean>()
    const guard = vi.fn((id: string) => id === 'editor' ? first.promise : second.promise)
    owner.registerView({ kind: 'editor', title: 'Editor', rendererKey: 'editor', beforeClose: guard })
    owner.restorePreset('empty')
    expect(guard.mock.calls.map(([id]) => id)).toEqual(['editor', 'second-editor'])
    first.resolve(true)
    await first.promise
    expect(layout(owner)).toBe(before)
    second.resolve(true)
    await vi.waitFor(() => expect(Object.keys(layout(owner).panes)).toHaveLength(0))
    expect(owner.source.getSnapshot().error).toBeNull()
  })

  it('does not overwrite a newer layout after a delayed preset guard approves', async () => {
    const owner = new WorkspaceLayoutController(storage())
    owner.switchWorkspace('A'); owner.savePreset('empty'); owner.openPane(editor())
    const approval = deferred<boolean>()
    owner.registerView({ kind: 'editor', title: 'Editor', rendererKey: 'editor', beforeClose: () => approval.promise })
    owner.restorePreset('empty')
    owner.openPane(chat('new-conversation', 'B'))
    const newer = layout(owner)
    approval.resolve(true)
    await approval.promise
    await new Promise<void>(resolve => queueMicrotask(resolve))
    expect(layout(owner)).toBe(newer)
    expectUniqueBindings(layout(owner), [editor(), chat('new-conversation', 'B')])
  })
})

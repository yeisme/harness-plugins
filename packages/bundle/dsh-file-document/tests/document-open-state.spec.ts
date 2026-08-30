import { describe, expect, it } from 'vitest'
import {
  EMPTY_DOCUMENT_OPEN_STATE,
  documentOpenReducer,
  isDocumentOpenKey,
} from '../src/client/document-open-state.ts'
import { fileTreePathOf } from '../src/file-tree.ts'

function stateOf(overrides: Partial<Parameters<typeof documentOpenReducer>[0]> = {}) {
  return { ...EMPTY_DOCUMENT_OPEN_STATE, ...overrides }
}

describe('documentOpenReducer preview/edit/pin (V3 4.2)', () => {
  it('single click previews transiently; re-click replaces onto the same dedupe key', () => {
    const first = documentOpenReducer(EMPTY_DOCUMENT_OPEN_STATE, { type: 'preview', entryId: 'a' })
    expect(first.request).toMatchObject({ resourceKey: 'document:a', mode: 'preview', retention: 'snapshot' })
    expect(first.state.previews.get('a')).toBe('document:a')
    const second = documentOpenReducer(first.state, { type: 'preview', entryId: 'a' })
    expect(second.request?.resourceKey).toBe('document:a')
    expect(second.state.previews.size).toBe(1)
  })

  it('double-click/Enter edits durably: preview is replaced by the pinned view on the same key', () => {
    const previewed = documentOpenReducer(EMPTY_DOCUMENT_OPEN_STATE, { type: 'preview', entryId: 'a' }).state
    const edited = documentOpenReducer(previewed, { type: 'edit', entryId: 'a' })
    expect(edited.request).toMatchObject({ resourceKey: 'document:a', mode: 'edit', retention: 'keep-alive' })
    expect(edited.state.pinned.has('a')).toBe(true)
    expect(edited.state.previews.has('a')).toBe(false)
  })

  it('preview on a pinned document reveals it without downgrading retention', () => {
    const pinned = documentOpenReducer(EMPTY_DOCUMENT_OPEN_STATE, { type: 'pin', entryId: 'a' }).state
    const revealed = documentOpenReducer(pinned, { type: 'preview', entryId: 'a' })
    expect(revealed.request).toMatchObject({ mode: 'preview', retention: 'keep-alive' })
    expect(revealed.state.pinned.has('a')).toBe(true)
  })

  it('dirty documents block silent replacement until cleared', () => {
    const dirty = documentOpenReducer(EMPTY_DOCUMENT_OPEN_STATE, { type: 'mark_dirty', entryId: 'a' }).state
    expect(documentOpenReducer(dirty, { type: 'preview', entryId: 'a' }).request).toMatchObject({ blocked: 'dirty' })
    expect(documentOpenReducer(dirty, { type: 'edit', entryId: 'a' }).request).toMatchObject({ blocked: 'dirty' })
    const cleared = documentOpenReducer(dirty, { type: 'clear_dirty', entryId: 'a' })
    expect(cleared.state.dirty.has('a')).toBe(false)
    expect(documentOpenReducer(cleared.state, { type: 'edit', entryId: 'a' }).request?.blocked).toBeUndefined()
  })

  it('explicit duplicate opens a second copy with a distinct suffix key', () => {
    const first = documentOpenReducer(EMPTY_DOCUMENT_OPEN_STATE, { type: 'duplicate', entryId: 'a' })
    const second = documentOpenReducer(first.state, { type: 'duplicate', entryId: 'a' })
    expect(first.request?.resourceKey).toBe('document:a:copy-1')
    expect(second.request?.resourceKey).toBe('document:a:copy-2')
  })

  it('session switch drops transient previews and non-pinned dirty state, keeps pinned documents', () => {
    let state = EMPTY_DOCUMENT_OPEN_STATE
    state = documentOpenReducer(state, { type: 'preview', entryId: 't' }).state
    state = documentOpenReducer(state, { type: 'edit', entryId: 'p' }).state
    state = documentOpenReducer(state, { type: 'mark_dirty', entryId: 't' }).state
    state = documentOpenReducer(state, { type: 'mark_dirty', entryId: 'p' }).state
    const switched = documentOpenReducer(state, { type: 'session_switch', session: 's2' })
    expect(switched.state.previews.size).toBe(0)
    expect(switched.state.pinned.has('p')).toBe(true)
    expect(switched.state.dirty.has('t')).toBe(false)
    expect(switched.state.dirty.has('p')).toBe(true)
    expect(switched.request).toBeUndefined()
    // same-session switch is a no-op
    const again = documentOpenReducer(switched.state, { type: 'session_switch', session: 's2' })
    expect(again.state).toBe(switched.state)
  })
})

describe('isDocumentOpenKey (V3 4.2 key safety)', () => {
  it('accepts opaque file-ish entries and rejects directories or path-shaped ids', () => {
    expect(isDocumentOpenKey({ id: 'doc-1', name: 'a.md', kind: 'file', capabilities: [] } as never)).toBe(true)
    expect(isDocumentOpenKey({ id: 'a/b', name: 'a.md', kind: 'file', capabilities: [] } as never)).toBe(false)
    expect(isDocumentOpenKey({ id: 'd1', name: 'dir', kind: 'directory', capabilities: [] } as never)).toBe(false)
  })
})

describe('fileTreePathOf breadcrumb chain (V3 4.3)', () => {
  it('walks ancestors root-first and tolerates cycles or missing parents', () => {
    const entries = [
      { id: 'root', name: 'root', kind: 'directory', capabilities: [] },
      { id: 'src', name: 'src', kind: 'directory', parentId: 'root', capabilities: [] },
      { id: 'main', name: 'main.ts', kind: 'text', parentId: 'src', capabilities: [] },
      { id: 'cycle-a', name: 'a', kind: 'directory', parentId: 'cycle-b', capabilities: [] },
      { id: 'cycle-b', name: 'b', kind: 'directory', parentId: 'cycle-a', capabilities: [] },
      { id: 'orphan', name: 'orphan', kind: 'file', parentId: 'gone', capabilities: [] },
    ] as never
    expect(fileTreePathOf(entries, 'main').map(entry => entry.id)).toEqual(['root', 'src', 'main'])
    expect(fileTreePathOf(entries, null)).toEqual([])
    expect(fileTreePathOf(entries, 'cycle-a').map(entry => entry.id)).toEqual(['cycle-b', 'cycle-a']) // bounded: cycle terminates, never loops
    expect(fileTreePathOf(entries, 'orphan').map(entry => entry.id)).toEqual(['orphan'])
  })
})

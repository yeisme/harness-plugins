/**
 * Pure document-open interaction state (V3 4.2).
 *
 * Single click previews (transient), double-click/Enter edits (durable
 * pinned), the same resource dedupes onto one view, and an explicit
 * duplicate opens a second copy with a distinct key. Dirty entries are
 * never silently replaced; a session switch drops transient previews but
 * keeps pinned documents. The pane workbench stays the view authority —
 * this reducer only derives the next open request.
 *
 * @module @yeisme/dsh-file-document/client
 */
import { isFileEntry, type FileEntryV1 } from '../types.ts'

export interface DocumentOpenStateV1 {
  readonly session: string
  /** Transient preview views by entry id (dropped on session switch). */
  readonly previews: ReadonlyMap<string, string>
  /** Entry ids opened durably (edit/pin); they survive session switches. */
  readonly pinned: ReadonlySet<string>
  /** Entry ids with unsaved edits — blocks silent replacement. */
  readonly dirty: ReadonlySet<string>
  /** Next duplicate suffix per entry id. */
  readonly duplicates: ReadonlyMap<string, number>
}

export type DocumentOpenAction =
  | { readonly type: 'preview'; readonly entryId: string }
  | { readonly type: 'edit'; readonly entryId: string }
  | { readonly type: 'pin'; readonly entryId: string }
  | { readonly type: 'duplicate'; readonly entryId: string }
  | { readonly type: 'mark_dirty'; readonly entryId: string }
  | { readonly type: 'clear_dirty'; readonly entryId: string }
  | { readonly type: 'session_switch'; readonly session: string }

export interface DocumentOpenRequest {
  /** Pane workbench resource key for this open. */
  readonly resourceKey: string
  readonly mode: 'preview' | 'edit' | 'duplicate'
  /** Durable opens request keep-alive retention. */
  readonly retention: 'snapshot' | 'keep-alive'
  /** Dirty replacement blocker: present when the action was swallowed. */
  readonly blocked?: 'dirty'
}

class FrozenMap<K, V> extends Map<K, V> {}
class FrozenSet<K> extends Set<K> {}

export const EMPTY_DOCUMENT_OPEN_STATE: DocumentOpenStateV1 = Object.freeze({
  session: '',
  previews: new FrozenMap<string, string>(),
  pinned: new FrozenSet<string>(),
  dirty: new FrozenSet<string>(),
  duplicates: new FrozenMap<string, number>(),
}) as DocumentOpenStateV1

function withMap<K, V>(source: ReadonlyMap<K, V>, key: K, value: V): ReadonlyMap<K, V> {
  return new Map(source).set(key, value)
}
function withoutMap<K, V>(source: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> {
  const next = new Map(source)
  next.delete(key)
  return next
}

export function documentOpenReducer(
  state: DocumentOpenStateV1,
  action: DocumentOpenAction,
): { readonly state: DocumentOpenStateV1; readonly request: DocumentOpenRequest | undefined } {
  switch (action.type) {
    case 'preview': {
      if (state.dirty.has(action.entryId)) {
        return { state, request: { resourceKey: `document:${action.entryId}`, mode: 'preview', retention: 'snapshot', blocked: 'dirty' } }
      }
      if (state.pinned.has(action.entryId)) {
        // Pinned documents are the durable surface — preview reveals, never downgrades.
        return { state, request: { resourceKey: `document:${action.entryId}`, mode: 'preview', retention: 'keep-alive' } }
      }
      return {
        state: { ...state, previews: withMap(state.previews, action.entryId, `document:${action.entryId}`) },
        request: { resourceKey: `document:${action.entryId}`, mode: 'preview', retention: 'snapshot' },
      }
    }
    case 'edit':
    case 'pin': {
      if (state.dirty.has(action.entryId) && action.type === 'edit') {
        return { state, request: { resourceKey: `document:${action.entryId}`, mode: 'edit', retention: 'keep-alive', blocked: 'dirty' } }
      }
      return {
        state: {
          ...state,
          previews: withoutMap(state.previews, action.entryId),
          pinned: new Set(state.pinned).add(action.entryId),
        },
        request: { resourceKey: `document:${action.entryId}`, mode: 'edit', retention: 'keep-alive' },
      }
    }
    case 'duplicate': {
      const next = (state.duplicates.get(action.entryId) ?? 0) + 1
      return {
        state: { ...state, duplicates: withMap(state.duplicates, action.entryId, next) },
        request: { resourceKey: `document:${action.entryId}:copy-${next}`, mode: 'duplicate', retention: 'snapshot' },
      }
    }
    case 'mark_dirty':
      return { state: { ...state, dirty: new Set(state.dirty).add(action.entryId) }, request: undefined }
    case 'clear_dirty': {
      const dirty = new Set(state.dirty)
      dirty.delete(action.entryId)
      return { state: { ...state, dirty }, request: undefined }
    }
    case 'session_switch': {
      if (action.session === state.session) return { state, request: undefined }
      const dirty = new Set<string>()
      for (const entryId of state.dirty) {
        if (state.pinned.has(entryId)) dirty.add(entryId)
      }
      return {
        state: { session: action.session, previews: new Map(), pinned: state.pinned, dirty, duplicates: new Map() },
        request: undefined,
      }
    }
  }
}

/** True when the entry id can key a view (reuse the pane-views opacity rule). */
export function isDocumentOpenKey(entry: FileEntryV1): boolean {
  return isFileEntry(entry) && entry.kind !== 'directory' && /^[A-Za-z0-9._:-]{1,128}$/.test(entry.id)
    && !entry.id.includes('..') && !entry.id.includes('/')
}

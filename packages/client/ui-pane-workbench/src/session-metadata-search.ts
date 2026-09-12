import { CURRENT_PROFILE_WORKSPACE_REF, getSessionListSearchSeam, projectSessionListSnapshot } from './conversation-search-host.js'
import type { PaneConversationSearchHostV1, PaneConversationSearchItemV1, PaneConversationSearchPageV1, PaneConversationSearchRequestV1 } from './management.js'
import { searchCenterControlKey, type SearchCenterControls } from './search-controls.js'

const cursors = new WeakMap<PaneConversationSearchHostV1, Map<string, { signature: string; offset: number }>>()
const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase()

/** Compact change stamp for read-only paging, never an authorization decision. */
function pagingStamp(value: string): string {
  let left = 2166136261
  let right = 5381
  for (let index = 0; index < value.length; index++) {
    left = Math.imul(left ^ value.charCodeAt(index), 16777619)
    right = Math.imul(right, 33) ^ value.charCodeAt(index)
  }
  return `${value.length}:${left >>> 0}:${right >>> 0}`
}

/** Filter and order the complete authorized snapshot before creating a page. */
export async function searchSessionMetadata(host: PaneConversationSearchHostV1, request: PaneConversationSearchRequestV1,
  controls: SearchCenterControls, locale: string, signal: AbortSignal): Promise<PaneConversationSearchPageV1> {
  if (signal.aborted) return { items: [], status: 'offline', reason: 'aborted' }
  if (request.workspaceRef !== CURRENT_PROFILE_WORKSPACE_REF) return { items: [], status: 'contract_mismatch', reason: 'project_scope_unsupported' }
  const seam = getSessionListSearchSeam(host)
  if (seam?.list === undefined) return { items: [], status: 'contract_mismatch', reason: 'metadata_search_unsupported' }
  const since = controls.updatedSince === undefined ? undefined : Date.parse(controls.updatedSince)
  if (since !== undefined && !Number.isFinite(since)) return { items: [], status: 'contract_mismatch', reason: 'invalid_time_filter' }
  if (controls.status !== undefined && controls.status !== 'running' && controls.status !== 'idle') return { items: [], status: 'contract_mismatch', reason: 'status_filter_unsupported' }
  let snapshot
  try { snapshot = seam.list.getSnapshot() } catch { return { items: [], status: 'offline', reason: 'sessions_list_failed' } }
  const needle = normalize(request.query)
  const matched = projectSessionListSnapshot(snapshot).filter(item => {
    if (controls.owner !== undefined && controls.owner !== 'dsh.session') return false
    if (request.sessionRef !== undefined && item.sessionRef !== request.sessionRef) return false
    if (!normalize(item.title).includes(needle) && !normalize(item.sessionRef).includes(needle)) return false
    if (since !== undefined && !(Date.parse(item.updatedAt ?? '') >= since)) return false
    if (controls.status !== undefined) {
      const running = snapshot.byId?.[item.sessionRef]?.running
      if (running !== (controls.status === 'running')) return false
    }
    return true
  })
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  const timestamp = (item: PaneConversationSearchItemV1) => item.updatedAt === undefined ? -Infinity : Date.parse(item.updatedAt)
  const quality = (item: PaneConversationSearchItemV1) => {
    const fields = [normalize(item.title), normalize(item.sessionRef)]
    return fields.includes(needle) ? 0 : fields.some(value => value.startsWith(needle)) ? 1 : 2
  }
  matched.sort((left, right) => {
    const primary = controls.sort === 'name' ? collator.compare(left.title, right.title)
      : controls.sort === 'updated' ? (timestamp(left) === timestamp(right) ? 0 : timestamp(left) > timestamp(right) ? -1 : 1)
        : quality(left) - quality(right)
    return primary || left.sessionRef.localeCompare(right.sessionRef)
  })
  const limit = Number.isFinite(request.limit) ? Math.max(1, Math.min(100, Math.trunc(request.limit))) : 20
  // Recheck the authorized snapshot and all conditions before using a cursor.
  // Retain only 32 compact positions, shared safely by independent query consumers.
  const signature = pagingStamp(JSON.stringify([request.workspaceRef, request.sessionRef ?? null, needle, searchCenterControlKey(controls), locale, limit, matched]))
  const state = cursors.get(host) ?? new Map<string, { signature: string; offset: number }>()
  cursors.set(host, state)
  const entry = request.cursor === undefined ? undefined : state.get(request.cursor)
  const offset = request.cursor === undefined ? 0 : entry?.signature === signature ? entry.offset : undefined
  if (offset === undefined) return { items: [], status: 'contract_mismatch', reason: 'cursor_stale' }
  const items = matched.slice(offset, offset + limit)
  let nextCursor: string | undefined
  if (offset + items.length < matched.length) {
    nextCursor = `metadata:${[...crypto.getRandomValues(new Uint32Array(4))].map(value => value.toString(16).padStart(8, '0')).join('')}`
    state.set(nextCursor, { signature, offset: offset + items.length })
    while (state.size > 32) state.delete(state.keys().next().value!)
  }
  if (signal.aborted) return { items: [], status: 'offline', reason: 'aborted' }
  return { items, status: 'ready', ...(nextCursor === undefined ? {} : { nextCursor }) }
}

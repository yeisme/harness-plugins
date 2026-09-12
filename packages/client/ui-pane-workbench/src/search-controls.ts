import type { WorkspaceSearchCandidateV1 } from './search-identity.js'

/** Internal presentation/query controls; not part of the persisted V1 filter schema. */
export interface SearchCenterControls {
  readonly sessionRef?: string
  readonly owner?: string
  readonly status?: string
  readonly updatedSince?: string
  readonly sort: 'relevance' | 'name' | 'updated'
}

export const DEFAULT_SEARCH_CENTER_CONTROLS: SearchCenterControls = Object.freeze({ sort: 'relevance' })

export function hasSearchCenterConstraints(controls: SearchCenterControls | undefined): boolean {
  return controls !== undefined && (controls.sessionRef !== undefined || controls.owner !== undefined || controls.status !== undefined || controls.updatedSince !== undefined || controls.sort !== 'relevance')
}

export function searchCenterControlKey(controls: SearchCenterControls | undefined): string {
  return JSON.stringify([controls?.sessionRef ?? null, controls?.owner ?? null, controls?.status ?? null, controls?.updatedSince ?? null, controls?.sort ?? 'relevance'])
}

export function matchesSearchCenterControls(item: WorkspaceSearchCandidateV1, controls: SearchCenterControls | undefined): boolean {
  if (controls === undefined) return true
  if (controls.sessionRef !== undefined && (item.openTarget.type !== 'session' || item.openTarget.sessionRef !== controls.sessionRef)) return false
  if (controls.owner !== undefined && item.ownerRef !== controls.owner) return false
  if (controls.status !== undefined && item.status !== controls.status) return false
  // Pane/command catalogs have no timestamp capability. Do not pretend to filter them.
  if (controls.updatedSince !== undefined || controls.sort === 'updated') {
    if (item.kind !== 'session') return false
    if (controls.updatedSince !== undefined) {
      const since = Date.parse(controls.updatedSince)
      const updated = Date.parse(item.updatedAt ?? '')
      if (!Number.isFinite(since) || !Number.isFinite(updated) || updated < since) return false
    }
  }
  return true
}

export function sortLocalSearchCandidates(items: readonly WorkspaceSearchCandidateV1[], controls: SearchCenterControls | undefined, locale = 'en'): readonly WorkspaceSearchCandidateV1[] {
  if (controls?.sort !== 'name') return items
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  return [...items].sort((left, right) => collator.compare(left.title, right.title) || left.stableKey.localeCompare(right.stableKey))
}

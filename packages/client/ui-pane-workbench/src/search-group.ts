import type { WorkspaceSearchCandidateV1, WorkspaceSearchGroupIdV1, WorkspaceSearchKindV1 } from './search-identity.js'
import { matchWorkspaceSearchCandidate, rankWorkspaceSearchCandidates } from './search-match.js'

export type WorkspaceSearchCategoryV1 = 'all' | WorkspaceSearchKindV1

export interface WorkspaceSearchFiltersV1 {
  readonly category: WorkspaceSearchCategoryV1
  readonly projectRef?: string
  readonly allAccessibleProjects: boolean
  readonly openedOnly: boolean
  readonly status?: string
  readonly pluginOwner?: string
  readonly timeRange?: 'any' | 'unsupported'
  readonly showCompatibility: boolean
}

export interface WorkspaceSearchGroupV1 {
  readonly id: WorkspaceSearchGroupIdV1
  readonly items: readonly WorkspaceSearchCandidateV1[]
  readonly previewLimit: number
  readonly loadedCount: number
  readonly totalCount?: number
  readonly collapsed: boolean
  readonly countLabelKind: 'exact' | 'found'
}

export interface WorkspaceSearchProjectionV1 {
  readonly query: string
  readonly filters: WorkspaceSearchFiltersV1
  readonly groups: readonly WorkspaceSearchGroupV1[]
  readonly visibleItems: readonly WorkspaceSearchCandidateV1[]
  readonly activeFilterLabels: readonly string[]
}

export const EMPTY_SEARCH_PREVIEW = Object.freeze({
  recent: 5,
  opened: 5,
  frequent: 8,
  keyword: 5,
} as const)

export const DEFAULT_WORKSPACE_SEARCH_FILTERS: WorkspaceSearchFiltersV1 = Object.freeze({
  category: 'all',
  allAccessibleProjects: false,
  openedOnly: false,
  showCompatibility: false,
})

function uniqueByStableKey(items: readonly WorkspaceSearchCandidateV1[]): readonly WorkspaceSearchCandidateV1[] {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.stableKey)) return false
    seen.add(item.stableKey)
    return true
  })
}

export function applicableWorkspaceSearchFilters(filters: WorkspaceSearchFiltersV1): WorkspaceSearchFiltersV1 {
  const next = { ...filters }
  if (filters.category !== 'session' && filters.timeRange !== undefined) next.timeRange = undefined
  if (filters.category !== 'command' && filters.pluginOwner !== undefined) next.pluginOwner = undefined
  if (filters.category === 'pane' && filters.timeRange !== undefined) next.timeRange = undefined
  return next
}

export function workspaceSearchFilterLabels(filters: WorkspaceSearchFiltersV1): readonly string[] {
  const labels: string[] = []
  if (filters.category !== 'all') labels.push(`category:${filters.category}`)
  if (filters.openedOnly) labels.push('opened')
  if (filters.projectRef !== undefined) labels.push(`project:${filters.projectRef}`)
  else if (filters.allAccessibleProjects) labels.push('projects:all-accessible')
  if (filters.status !== undefined) labels.push(`status:${filters.status}`)
  if (filters.pluginOwner !== undefined) labels.push(`plugin:${filters.pluginOwner}`)
  if (filters.timeRange === 'unsupported') labels.push('time:unavailable')
  if (filters.showCompatibility) labels.push('compatibility')
  return labels
}

export function candidatePassesWorkspaceSearchFilters(candidate: WorkspaceSearchCandidateV1, filters: WorkspaceSearchFiltersV1): boolean {
  const applied = applicableWorkspaceSearchFilters(filters)
  if (applied.category !== 'all' && candidate.kind !== applied.category) return false
  if (applied.openedOnly && !candidate.opened) return false
  if (applied.status !== undefined && candidate.status !== applied.status) return false
  if (applied.pluginOwner !== undefined && candidate.ownerRef !== applied.pluginOwner) return false
  if (applied.timeRange === 'unsupported') return candidate.kind !== 'session'
  if (!applied.allAccessibleProjects && applied.projectRef !== undefined) {
    if (candidate.kind === 'session' && candidate.projectRef !== undefined && candidate.projectRef !== applied.projectRef) return false
    if (candidate.kind === 'command' && candidate.projectRef !== undefined && candidate.projectRef !== applied.projectRef) return false
  }
  return true
}

function previewGroup(
  id: WorkspaceSearchGroupIdV1,
  items: readonly WorkspaceSearchCandidateV1[],
  limit: number,
  collapsed = false,
  totalCount?: number,
): WorkspaceSearchGroupV1 | undefined {
  const unique = uniqueByStableKey(items)
  if (unique.length === 0) return undefined
  return {
    id,
    items: unique.slice(0, limit),
    previewLimit: limit,
    loadedCount: unique.length,
    ...(totalCount === undefined ? {} : { totalCount }),
    collapsed,
    countLabelKind: totalCount === undefined ? 'found' : 'exact',
  }
}

export function projectWorkspaceSearch(input: {
  readonly query: string
  readonly candidates: readonly WorkspaceSearchCandidateV1[]
  readonly filters?: Partial<WorkspaceSearchFiltersV1>
  readonly sessionLoadedCount?: number
  readonly sessionTotalUnknown?: boolean
}): WorkspaceSearchProjectionV1 {
  const filters = applicableWorkspaceSearchFilters({ ...DEFAULT_WORKSPACE_SEARCH_FILTERS, ...input.filters })
  const query = input.query.trim()
  const ranked = rankWorkspaceSearchCandidates(input.candidates, query)
    .filter(candidate => candidatePassesWorkspaceSearchFilters(candidate, filters))
    .filter(candidate => {
      if (!candidate.compatibility) return true
      if (filters.showCompatibility || query.length === 0) return true
      const match = matchWorkspaceSearchCandidate(candidate, query)
      return match?.layer === 'exact'
    })
  const occupied = new Set<string>()
  const take = (items: readonly WorkspaceSearchCandidateV1[]): WorkspaceSearchCandidateV1[] => {
    const next: WorkspaceSearchCandidateV1[] = []
    for (const item of items) {
      if (occupied.has(item.stableKey)) continue
      occupied.add(item.stableKey)
      next.push(item)
    }
    return next
  }

  const groups: WorkspaceSearchGroupV1[] = []
  if (query.length === 0) {
    const recent = previewGroup('recent', take(ranked.filter(item => item.recent && !item.compatibility)), EMPTY_SEARCH_PREVIEW.recent)
    const opened = previewGroup('opened', take(ranked.filter(item => item.opened && !item.compatibility)), EMPTY_SEARCH_PREVIEW.opened)
    const frequent = previewGroup('frequent', take(ranked.filter(item => item.frequent && !item.compatibility)), EMPTY_SEARCH_PREVIEW.frequent)
    if (recent !== undefined) groups.push(recent)
    if (opened !== undefined) groups.push(opened)
    if (frequent !== undefined) groups.push(frequent)
    const compatibility = ranked.filter(item => item.compatibility)
    const compatibilityGroup = previewGroup('compatibility', compatibility, 5, true)
    if (compatibilityGroup !== undefined) groups.push(compatibilityGroup)
  } else {
    const sessionItems = ranked.filter(item => item.kind === 'session')
    const paneItems = ranked.filter(item => item.kind === 'pane')
    const commandItems = ranked.filter(item => item.kind === 'command' && !item.compatibility)
    const compatibilityItems = ranked.filter(item => item.compatibility)
    const sessionGroup = previewGroup(
      'session',
      sessionItems,
      EMPTY_SEARCH_PREVIEW.keyword,
      false,
      input.sessionTotalUnknown === true ? undefined : input.sessionLoadedCount === sessionItems.length ? sessionItems.length : undefined,
    )
    const paneGroup = previewGroup('pane', paneItems, EMPTY_SEARCH_PREVIEW.keyword, false, paneItems.length)
    const commandGroup = previewGroup('command', commandItems, EMPTY_SEARCH_PREVIEW.keyword, false, commandItems.length)
    const compatibilityGroup = previewGroup('compatibility', compatibilityItems, EMPTY_SEARCH_PREVIEW.keyword, true)
    if (sessionGroup !== undefined) {
      groups.push(input.sessionTotalUnknown === true || input.sessionLoadedCount !== undefined
        ? { ...sessionGroup, countLabelKind: 'found', loadedCount: input.sessionLoadedCount ?? sessionItems.length }
        : sessionGroup)
    }
    if (paneGroup !== undefined) groups.push(paneGroup)
    if (commandGroup !== undefined) groups.push(commandGroup)
    if (compatibilityGroup !== undefined) groups.push(compatibilityGroup)
  }

  return {
    query,
    filters,
    groups,
    visibleItems: groups.flatMap(group => group.collapsed ? [] : group.items),
    activeFilterLabels: workspaceSearchFilterLabels(filters),
  }
}

export function workspaceSearchCountLabel(group: WorkspaceSearchGroupV1, foundLabel: string, exactLabel: string): string {
  if (group.countLabelKind === 'exact' && group.totalCount !== undefined) return exactLabel.replace('{count}', String(group.totalCount))
  return foundLabel.replace('{count}', String(group.loadedCount))
}

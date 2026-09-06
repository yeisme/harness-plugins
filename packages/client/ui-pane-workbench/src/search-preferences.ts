import type { PaneWorkspaceStorageV1 } from './persistence.js'
import { DEFAULT_WORKSPACE_SEARCH_FILTERS, type WorkspaceSearchFiltersV1 } from './search-group.js'

export const WORKSPACE_SEARCH_PREFERENCE_SCHEMA = 'workspace.search.preferences.v1' as const
export const WORKSPACE_SEARCH_PREFERENCE_NAMESPACE = 'yeisme.dsh.workspace-search' as const
export const WORKSPACE_SEARCH_RECENT_LIMIT = 20
export const WORKSPACE_SEARCH_NAMED_FILTER_LIMIT = 10

export interface WorkspaceSearchRecentRefV1 {
  readonly stableKey: string
  readonly openedAt: string
}

export interface WorkspaceSearchNamedFilterV1 {
  readonly id: string
  readonly label: string
  readonly filters: WorkspaceSearchFiltersV1
}

export interface WorkspaceSearchPreferencesV1 {
  readonly schema: typeof WORKSPACE_SEARCH_PREFERENCE_SCHEMA
  readonly recent: readonly WorkspaceSearchRecentRefV1[]
  readonly namedFilters: readonly WorkspaceSearchNamedFilterV1[]
}

const EMPTY: WorkspaceSearchPreferencesV1 = Object.freeze({
  schema: WORKSPACE_SEARCH_PREFERENCE_SCHEMA,
  recent: [],
  namedFilters: [],
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseFilters(input: unknown): WorkspaceSearchFiltersV1 | undefined {
  if (!isRecord(input)) return undefined
  const category = input.category
  if (category !== 'all' && category !== 'session' && category !== 'pane' && category !== 'command') return undefined
  if (typeof input.allAccessibleProjects !== 'boolean' || typeof input.openedOnly !== 'boolean' || typeof input.showCompatibility !== 'boolean') return undefined
  if ('query' in input || 'text' in input || 'snippet' in input) return undefined
  return {
    category,
    allAccessibleProjects: input.allAccessibleProjects,
    openedOnly: input.openedOnly,
    showCompatibility: input.showCompatibility,
    ...(typeof input.projectRef === 'string' ? { projectRef: input.projectRef } : {}),
    ...(typeof input.status === 'string' ? { status: input.status } : {}),
    ...(typeof input.pluginOwner === 'string' ? { pluginOwner: input.pluginOwner } : {}),
  }
}

function parsePreferences(input: unknown): WorkspaceSearchPreferencesV1 {
  if (!isRecord(input) || input.schema !== WORKSPACE_SEARCH_PREFERENCE_SCHEMA) return EMPTY
  const recent = Array.isArray(input.recent)
    ? input.recent.flatMap(item => {
      if (!isRecord(item) || typeof item.stableKey !== 'string' || typeof item.openedAt !== 'string') return []
      if (item.stableKey.length === 0 || item.stableKey.length > 240) return []
      return [{ stableKey: item.stableKey, openedAt: item.openedAt }]
    }).slice(0, WORKSPACE_SEARCH_RECENT_LIMIT)
    : []
  const namedFilters = Array.isArray(input.namedFilters)
    ? input.namedFilters.flatMap(item => {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.label !== 'string') return []
      const filters = parseFilters(item.filters)
      if (filters === undefined || item.label.trim().length === 0) return []
      return [{ id: item.id, label: item.label.trim().slice(0, 40), filters }]
    }).slice(0, WORKSPACE_SEARCH_NAMED_FILTER_LIMIT)
    : []
  return { schema: WORKSPACE_SEARCH_PREFERENCE_SCHEMA, recent, namedFilters }
}

export class WorkspaceSearchPreferenceStore {
  constructor(
    private readonly storage?: PaneWorkspaceStorageV1,
    private readonly namespace = WORKSPACE_SEARCH_PREFERENCE_NAMESPACE,
  ) {}

  load(): WorkspaceSearchPreferencesV1 {
    if (this.storage === undefined) return EMPTY
    try {
      const raw = this.storage.getItem(`${this.namespace}:v1`)
      return typeof raw === 'string' ? parsePreferences(JSON.parse(raw) as unknown) : EMPTY
    } catch {
      return EMPTY
    }
  }

  recordOpen(stableKey: string, now = new Date().toISOString()): { readonly saved: boolean; readonly preferences: WorkspaceSearchPreferencesV1 } {
    const current = this.load()
    const next: WorkspaceSearchPreferencesV1 = {
      ...current,
      recent: [{ stableKey, openedAt: now }, ...current.recent.filter(item => item.stableKey !== stableKey)].slice(0, WORKSPACE_SEARCH_RECENT_LIMIT),
    }
    return { saved: this.write(next), preferences: next }
  }

  clearRecent(): { readonly saved: boolean; readonly preferences: WorkspaceSearchPreferencesV1 } {
    const next = { ...this.load(), recent: [] }
    return { saved: this.write(next), preferences: next }
  }

  saveNamedFilter(filter: WorkspaceSearchNamedFilterV1): { readonly saved: boolean; readonly preferences: WorkspaceSearchPreferencesV1 } {
    const current = this.load()
    const filters = parseFilters(filter.filters) ?? DEFAULT_WORKSPACE_SEARCH_FILTERS
    const named: WorkspaceSearchNamedFilterV1 = { ...filter, filters }
    const namedFilters = [named, ...current.namedFilters.filter(item => item.id !== named.id)].slice(0, WORKSPACE_SEARCH_NAMED_FILTER_LIMIT)
    const next = { ...current, namedFilters }
    return { saved: this.write(next), preferences: next }
  }

  restoreNamedFilter(id: string, accessibleProjects: ReadonlySet<string>): {
    readonly filters?: WorkspaceSearchFiltersV1
    readonly staleProject: boolean
  } {
    const named = this.load().namedFilters.find(item => item.id === id)
    if (named === undefined) return { staleProject: false }
    if (named.filters.projectRef !== undefined && !accessibleProjects.has(named.filters.projectRef)) {
      return { filters: named.filters, staleProject: true }
    }
    return { filters: named.filters, staleProject: false }
  }

  private write(value: WorkspaceSearchPreferencesV1): boolean {
    if (this.storage === undefined) return false
    try {
      this.storage.setItem(`${this.namespace}:v1`, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }
}

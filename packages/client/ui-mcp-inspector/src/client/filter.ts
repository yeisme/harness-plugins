/**
 * Local catalog search and family/enabled filters. Query never leaves the client.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client/filter
 */

import type { ToolHubFamily, ToolHubItemV1 } from './wire.ts'

export type FamilyFilter = 'all' | ToolHubFamily
export type EnabledFilter = 'all' | 'enabled' | 'disabled' | 'unavailable'
export type PurposeFilter = 'all' | string
export type SourceFilter = 'all' | string

export interface CatalogFilter {
  readonly query: string
  readonly family: FamilyFilter
  readonly enabled: EnabledFilter
  readonly purpose?: PurposeFilter | undefined
  readonly source?: SourceFilter | undefined
}

function haystack(item: ToolHubItemV1): string {
  return [item.name, item.label, item.description, item.source, item.server, item.family, item.purpose?.zh, item.purpose?.category, ...(item.purpose?.searchTerms ?? [])]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function itemMatchesFilter(item: ToolHubItemV1, filter: CatalogFilter): boolean {
  if (filter.family !== 'all' && item.family !== filter.family) return false
  if (filter.enabled === 'enabled' && item.availability !== 'available') return false
  if (filter.enabled === 'disabled' && item.availability !== 'disabled') return false
  if (filter.enabled === 'unavailable' && item.availability !== 'unavailable') return false
  if (filter.purpose !== undefined && filter.purpose !== 'all' && item.purpose?.category !== filter.purpose) return false
  if (filter.source !== undefined && filter.source !== 'all' && item.source !== filter.source) return false
  const query = normalizeQuery(filter.query)
  if (query.length === 0) return true
  return haystack(item).includes(query)
}

export function purposeCategories(items: readonly ToolHubItemV1[]): readonly string[] {
  return [...new Set(items.flatMap(item => item.purpose?.category === undefined ? [] : [item.purpose.category]))].sort()
}

export function catalogSources(items: readonly ToolHubItemV1[]): readonly string[] {
  return [...new Set(items.map(item => item.source))].sort()
}

export function filterCatalog(items: readonly ToolHubItemV1[], filter: CatalogFilter): readonly ToolHubItemV1[] {
  return items.filter(item => itemMatchesFilter(item, filter))
}

export function countByFamily(items: readonly ToolHubItemV1[]): Record<FamilyFilter, number> {
  const counts: Record<FamilyFilter, number> = { all: items.length, mcp: 0, skill: 0, native: 0 }
  for (const item of items) counts[item.family] += 1
  return counts
}

export function countByAvailability(items: readonly ToolHubItemV1[]): Record<EnabledFilter, number> {
  const counts: Record<EnabledFilter, number> = { all: items.length, enabled: 0, disabled: 0, unavailable: 0 }
  for (const item of items) {
    if (item.availability === 'available') counts.enabled += 1
    else if (item.availability === 'disabled') counts.disabled += 1
    else counts.unavailable += 1
  }
  return counts
}

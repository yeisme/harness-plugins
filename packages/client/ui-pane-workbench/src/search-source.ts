import type { SearchCenterResourceKind } from './search-catalog.js'
import { legacySearchResourceKind, searchCenterResourceKinds } from './search-catalog.js'
import type { WorkspaceSearchCandidateV1 } from './search-identity.js'

/** Internal adapter contract. No new kinds are passed to legacy V1 consumers. */
export type SearchCenterScope =
  | { readonly kind: 'profile' }
  | { readonly kind: 'workspace'; readonly ref: string }
  | { readonly kind: 'session'; readonly ref: string }

export interface SearchCenterSourceDescriptor {
  readonly id: string
  readonly owner: string
  readonly resourceKinds: readonly SearchCenterResourceKind[]
  readonly coverage: 'catalog' | 'metadata' | 'fulltext' | 'unknown'
  readonly scopes: readonly SearchCenterScope['kind'][]
  readonly filters: readonly string[]
  readonly sorts: readonly ('relevance' | 'name' | 'updated')[]
  readonly pagination: boolean
  readonly preview: boolean
  readonly open: boolean
}

export interface SearchCenterSourceRequest {
  readonly query: string
  readonly scope: SearchCenterScope
  readonly kinds: readonly SearchCenterResourceKind[]
  readonly filters: Readonly<Record<string, string>>
  readonly sort: 'relevance' | 'name' | 'updated'
  readonly cursor?: string
  readonly limit?: number
}

export type SearchCenterRequestSupport =
  | { readonly supported: true }
  | { readonly supported: false; readonly reason: 'scope_unsupported' | 'kind_unsupported' | 'filter_unsupported' | 'sort_unsupported' | 'pagination_unsupported' }

/** Check before invoking a source; never silently remove a requested constraint. */
export function searchCenterRequestSupport(source: SearchCenterSourceDescriptor, request: SearchCenterSourceRequest): SearchCenterRequestSupport {
  if (!source.scopes.includes(request.scope.kind)) return { supported: false, reason: 'scope_unsupported' }
  if (request.kinds.some(kind => !source.resourceKinds.includes(kind))) return { supported: false, reason: 'kind_unsupported' }
  if (Object.keys(request.filters).some(filter => !source.filters.includes(filter))) return { supported: false, reason: 'filter_unsupported' }
  if (!source.sorts.includes(request.sort)) return { supported: false, reason: 'sort_unsupported' }
  if (request.cursor !== undefined && !source.pagination) return { supported: false, reason: 'pagination_unsupported' }
  return { supported: true }
}

export interface SearchCenterResource {
  readonly owner: string
  readonly ref: string
  readonly revision?: string
  readonly kind: SearchCenterResourceKind
  readonly title: string
  readonly description?: string
  readonly projectRef?: string
  readonly sessionRef?: string
  readonly availability?: 'available' | 'disabled' | 'unavailable'
  /** Domain status is separate from the ability to open its read-only details. */
  readonly status?: string
  readonly sourceLabel?: string
}

export type SearchCenterResult =
  | { readonly adapter: 'legacy'; readonly stableKey: string; readonly kind: SearchCenterResourceKind; readonly candidate: WorkspaceSearchCandidateV1 }
  | { readonly adapter: 'source'; readonly stableKey: string; readonly sourceId: string; readonly kind: SearchCenterResourceKind; readonly resource: SearchCenterResource }

export function sourcePreviewResults(results: readonly SearchCenterResult[], limit: number): readonly SearchCenterResult[] {
  return searchCenterResourceKinds('all').flatMap(kind => results.filter(result => result.kind === kind).slice(0, limit))
}

export function legacySearchCenterResult(candidate: WorkspaceSearchCandidateV1): SearchCenterResult {
  return { adapter: 'legacy', stableKey: candidate.stableKey, kind: legacySearchResourceKind(candidate), candidate }
}

export function sourceSearchCenterResult(source: SearchCenterSourceDescriptor, resource: SearchCenterResource): SearchCenterResult {
  if (source.owner !== resource.owner || !source.resourceKinds.includes(resource.kind)) throw new Error('search_resource_owner_mismatch')
  if ([source.id, resource.owner, resource.ref].some(value => value.trim().length === 0)) throw new Error('search_resource_identity_missing')
  // A length-delimited tuple avoids collisions from delimiters embedded in refs.
  const identity = JSON.stringify([source.id, resource.owner, resource.ref, resource.revision ?? null])
  return { adapter: 'source', stableKey: `resource:${identity}`, sourceId: source.id, kind: resource.kind, resource }
}

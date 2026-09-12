import type { WorkbenchIconName } from './icon.js'
import type { WorkspaceSearchCandidateV1 } from './search-identity.js'

interface SearchFamily {
  readonly id: string
  readonly icon: WorkbenchIconName
  readonly resources: readonly string[]
}

/** Presentation taxonomy, independent of the published V1 result-kind union. */
export const SEARCH_CENTER_FAMILIES = [
  { id: 'history', icon: 'message', resources: ['session', 'message-hit', 'archived-session'] },
  { id: 'projects', icon: 'workspace', resources: ['project', 'workspace', 'canvas-node'] },
  { id: 'knowledge', icon: 'document', resources: ['file', 'folder', 'document', 'note', 'knowledge-entry'] },
  { id: 'artifacts', icon: 'media', resources: ['image', 'video', 'audio', 'subtitle', 'text-artifact', 'delivery-package'] },
  { id: 'prompts', icon: 'code', resources: ['prompt', 'template', 'reusable-reference'] },
  { id: 'tools', icon: 'terminal', resources: ['skill', 'mcp-tool', 'mcp-resource', 'native-tool', 'plugin', 'preset'] },
  { id: 'execution', icon: 'agents', resources: ['task', 'run', 'approval', 'verification', 'evidence'] },
  { id: 'navigation', icon: 'window', resources: ['pane', 'command', 'settings-entry', 'compatibility-entry'] },
] as const satisfies readonly SearchFamily[]

export type SearchCenterFamilyId = typeof SEARCH_CENTER_FAMILIES[number]['id']
export type SearchCenterResourceKind = typeof SEARCH_CENTER_FAMILIES[number]['resources'][number]
export type SearchCenterCategory = 'all' | SearchCenterFamilyId | SearchCenterResourceKind
export type SearchCenterQuickView = 'recent' | 'opened' | 'frequent'

export function searchCenterResourceKinds(category: SearchCenterCategory): readonly SearchCenterResourceKind[] {
  if (category === 'all') return SEARCH_CENTER_FAMILIES.flatMap(family => [...family.resources])
  const family = SEARCH_CENTER_FAMILIES.find(item => item.id === category)
  return family === undefined ? [category as SearchCenterResourceKind] : family.resources
}

export function legacySearchResourceKind(candidate: WorkspaceSearchCandidateV1): SearchCenterResourceKind {
  return candidate.compatibility ? 'compatibility-entry' : candidate.kind
}

export function searchCenterFamily(kind: SearchCenterResourceKind): SearchCenterFamilyId {
  return SEARCH_CENTER_FAMILIES.find(family => (family.resources as readonly string[]).includes(kind))!.id
}

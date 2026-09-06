import type { WorkspaceSearchCandidateV1, WorkspaceSearchMatchSpanV1, WorkspaceSearchMatchV1 } from './search-identity.js'

export type WorkspaceSearchMatchLayerV1 = WorkspaceSearchMatchV1['layer']

const LAYER_RANK: Record<WorkspaceSearchMatchLayerV1, number> = {
  exact: 0,
  prefix: 1,
  token: 2,
  fallback: 3,
}

export function normalizeSearchQuery(query: string): string {
  return query.normalize('NFKC').trim().toLocaleLowerCase()
}

function fieldValue(candidate: WorkspaceSearchCandidateV1, field: WorkspaceSearchMatchV1['field']): readonly string[] {
  if (field === 'title') return [candidate.title]
  if (field === 'id') return unique([candidate.openTarget.commandId, candidate.openTarget.viewKind, candidate.openTarget.sessionRef, candidate.commandId, ...candidate.mergedCommandIds])
  if (field === 'alias') return candidate.aliases
  if (field === 'keyword') return candidate.keywords
  return candidate.description === undefined ? [] : [candidate.description]
}

function unique(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))]
}

function locateSpans(haystack: string, needle: string): readonly WorkspaceSearchMatchSpanV1[] {
  if (needle.length === 0) return []
  const lower = haystack.toLocaleLowerCase()
  const spans: WorkspaceSearchMatchSpanV1[] = []
  let from = 0
  while (from <= lower.length) {
    const index = lower.indexOf(needle, from)
    if (index < 0) break
    spans.push({ start: index, end: index + needle.length })
    from = index + Math.max(1, needle.length)
    if (spans.length >= 8) break
  }
  return spans
}

function tokenMatch(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) return true
  return haystack.split(/[\s/._:-]+/).some(token => token.includes(needle))
}

function fallbackMatch(haystack: string, needle: string): boolean {
  if (needle.length < 4) return false
  if (haystack.includes(needle)) return false
  const hay = Array.from(haystack)
  const need = Array.from(needle)
  if (Math.abs(hay.length - need.length) > 2) return false
  let distance = 0
  let i = 0
  let j = 0
  while (i < hay.length && j < need.length) {
    if (hay[i] === need[j]) {
      i += 1
      j += 1
      continue
    }
    distance += 1
    if (distance > 1) return false
    if (hay.length > need.length) i += 1
    else if (need.length > hay.length) j += 1
    else {
      i += 1
      j += 1
    }
  }
  distance += (hay.length - i) + (need.length - j)
  return distance <= 1
}

function matchField(value: string, needle: string, field: WorkspaceSearchMatchV1['field']): WorkspaceSearchMatchV1 | undefined {
  const normalized = value.normalize('NFKC')
  const lower = normalized.toLocaleLowerCase()
  if (lower === needle) return { layer: 'exact', field, spans: locateSpans(normalized, needle) }
  if (lower.startsWith(needle)) return { layer: 'prefix', field, spans: locateSpans(normalized, needle) }
  if (tokenMatch(lower, needle)) return { layer: 'token', field, spans: locateSpans(normalized, needle) }
  if (fallbackMatch(lower, needle)) return { layer: 'fallback', field, spans: [] }
  return undefined
}

export function matchWorkspaceSearchCandidate(candidate: WorkspaceSearchCandidateV1, query: string): WorkspaceSearchMatchV1 | undefined {
  const needle = normalizeSearchQuery(query)
  if (needle.length === 0) return undefined
  const fields: readonly WorkspaceSearchMatchV1['field'][] = ['title', 'id', 'alias', 'keyword', 'description']
  let best: WorkspaceSearchMatchV1 | undefined
  for (const field of fields) {
    for (const value of fieldValue(candidate, field)) {
      const match = matchField(value, needle, field)
      if (match === undefined) continue
      if (best === undefined || LAYER_RANK[match.layer] < LAYER_RANK[best.layer] || (match.layer === best.layer && match.field === 'title' && best.field !== 'title')) {
        best = match
      }
    }
  }
  return best
}

export function rankWorkspaceSearchCandidates(
  candidates: readonly WorkspaceSearchCandidateV1[],
  query: string,
): readonly WorkspaceSearchCandidateV1[] {
  const needle = normalizeSearchQuery(query)
  const scored = candidates.map(candidate => {
    const match = needle.length === 0 ? undefined : matchWorkspaceSearchCandidate(candidate, query)
    const layer = match === undefined ? 4 : LAYER_RANK[match.layer]
    const openedBoost = needle.length === 0 || match !== undefined ? Number(candidate.opened) : 0
    const recentBoost = needle.length === 0 || match !== undefined ? Number(candidate.recent) : 0
    return { candidate, match, layer, openedBoost, recentBoost }
  }).filter(item => needle.length === 0 || item.match !== undefined)
  return scored.sort((left, right) => left.layer - right.layer
    || right.openedBoost - left.openedBoost
    || right.recentBoost - left.recentBoost
    || left.candidate.stableKey.localeCompare(right.candidate.stableKey)).map(item => item.candidate)
}

export function highlightWorkspaceSearchText(text: string, spans: readonly WorkspaceSearchMatchSpanV1[]): readonly { readonly text: string; readonly match: boolean }[] {
  if (spans.length === 0) return [{ text, match: false }]
  const parts: Array<{ readonly text: string; readonly match: boolean }> = []
  let cursor = 0
  const ordered = [...spans].sort((left, right) => left.start - right.start)
  for (const span of ordered) {
    const start = Math.max(0, Math.min(text.length, span.start))
    const end = Math.max(start, Math.min(text.length, span.end))
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false })
    if (end > start) parts.push({ text: text.slice(start, end), match: true })
    cursor = Math.max(cursor, end)
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts.filter(part => part.text.length > 0)
}

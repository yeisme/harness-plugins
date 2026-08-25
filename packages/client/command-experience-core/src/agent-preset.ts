/**
 * `/agent`, `/subagents`, and `/preset` resolution.
 *
 * Bare `/agent` is always a thread picker. The plugin never fills that
 * picker from a preset API. Ambiguous `/agent <token>` fails closed.
 */

export interface ThreadCandidate {
  readonly ref: string;
  readonly displayName: string;
  readonly parentRef: string | null;
  readonly children?: readonly ThreadCandidate[];
  readonly active?: boolean;
}

export interface PresetCandidate {
  readonly ref: string;
  readonly name: string;
}

export type AgentTokenResolution =
  | { readonly kind: 'thread'; readonly threadRef: string }
  | { readonly kind: 'legacy-preset'; readonly presetRef: string; readonly replacement: '/preset' }
  | { readonly kind: 'fail-closed'; readonly reason: string }

export interface StaleThreadSelection {
  readonly selectedRef: string;
  readonly nextSelectedRef: string | null;
  readonly refreshRequired: boolean;
}

function flattenThreads(nodes: readonly ThreadCandidate[]): ThreadCandidate[] {
  const out: ThreadCandidate[] = []
  const walk = (node: ThreadCandidate): void => {
    out.push(node)
    for (const child of node.children ?? []) walk(child)
  }
  for (const node of nodes) walk(node)
  return out
}

export function flattenThreadProjection(nodes: readonly ThreadCandidate[]): readonly ThreadCandidate[] {
  return flattenThreads(nodes)
}

export function selectThreadRef(
  nodes: readonly ThreadCandidate[],
  selectedRef: string,
): { readonly ok: true; readonly threadRef: string } | { readonly ok: false; readonly reason: string } {
  const found = flattenThreads(nodes).find((node) => node.ref === selectedRef)
  if (found === undefined) {
    return { ok: false, reason: 'Selected threadRef is stale' }
  }
  return { ok: true, threadRef: found.ref }
}

/**
 * When the selected thread disappears, keep the draft and do not pick a neighbor.
 */
export function retainStaleThreadSelection(
  nodes: readonly ThreadCandidate[],
  selectedRef: string,
): StaleThreadSelection {
  const found = flattenThreads(nodes).some((node) => node.ref === selectedRef)
  if (found) {
    return { selectedRef, nextSelectedRef: selectedRef, refreshRequired: false }
  }
  return { selectedRef, nextSelectedRef: null, refreshRequired: true }
}

function normalizeToken(token: string): string {
  return token.trim().replace(/^\//, '').toLowerCase()
}

export function resolveAgentToken(
  token: string | undefined,
  threads: readonly ThreadCandidate[],
  presets: readonly PresetCandidate[],
): AgentTokenResolution {
  if (token === undefined || token.trim().length === 0) {
    return { kind: 'fail-closed', reason: 'bare /agent is a thread picker; no token to resolve' }
  }

  const needle = normalizeToken(token)
  const flat = flattenThreads(threads)
  const threadHits = flat.filter((node) =>
    node.ref.toLowerCase() === needle || node.displayName.toLowerCase() === needle,
  )
  const presetHits = presets.filter((preset) =>
    preset.ref.toLowerCase() === needle || preset.name.toLowerCase() === needle,
  )

  const threadHit = threadHits[0]
  const presetHit = presetHits[0]
  if (threadHits.length === 1 && presetHits.length === 0 && threadHit !== undefined) {
    return { kind: 'thread', threadRef: threadHit.ref }
  }
  if (presetHits.length === 1 && threadHits.length === 0 && presetHit !== undefined) {
    return {
      kind: 'legacy-preset',
      presetRef: presetHit.ref,
      replacement: '/preset',
    }
  }
  if (threadHits.length > 0 && presetHits.length > 0) {
    return {
      kind: 'fail-closed',
      reason: 'Ambiguous /agent token; use /agent picker or /preset',
    }
  }
  return {
    kind: 'fail-closed',
    reason: 'Unknown /agent token; use /agent picker or /preset',
  }
}

export function isBareAgentCommand(canonicalName: string, argument: string | undefined): boolean {
  return canonicalName.replace(/^\//, '') === 'agent' && (argument === undefined || argument.trim().length === 0)
}

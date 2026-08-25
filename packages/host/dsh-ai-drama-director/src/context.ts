/**
 * Current context resolution, revision checks, and safe selectors.
 */

import {
  type DramaContextV1,
  isSafeDramaRef,
  validateDramaContext,
} from './contracts.js'

export type DramaSelectorKind = 'show' | 'episode' | 'scene' | 'shot' | 'review' | 'run' | 'artifact' | 'next-review'

export interface DramaSelectorResolution {
  readonly ok: boolean
  readonly kind?: DramaSelectorKind
  readonly ref?: string
  readonly reason?: string
  readonly ambiguous?: boolean
}

export interface DramaContextOwner {
  snapshot(): Promise<unknown>
}

const SELECTOR_KINDS: readonly DramaSelectorKind[] = [
  'show', 'episode', 'scene', 'shot', 'review', 'run', 'artifact', 'next-review',
]

export function parseDramaSelector(raw: string): DramaSelectorResolution {
  const token = raw.trim()
  if (token.length === 0) {
    return { ok: false, reason: 'selector is required' }
  }
  if (token.includes(' ') || token.includes('--') || token.startsWith('/')) {
    return { ok: false, reason: 'selector rejected argv or path' }
  }
  if (token === 'next-review') {
    return { ok: true, kind: 'next-review', ref: 'next-review' }
  }
  const [kind, ...rest] = token.split(':')
  const ref = rest.join(':')
  if (kind !== undefined && SELECTOR_KINDS.includes(kind as DramaSelectorKind) && isSafeDramaRef(token) && ref.length > 0) {
    return { ok: true, kind: kind as DramaSelectorKind, ref: token }
  }
  if (isSafeDramaRef(token)) {
    return { ok: false, reason: 'selector is ambiguous; use kind:ref', ambiguous: true }
  }
  return { ok: false, reason: 'selector is not a safe opaque ref' }
}

export function contextRevisionMatches(context: DramaContextV1, expected: string): boolean {
  return context.contextRevision === expected
}

export function shouldResyncContext(
  previous: DramaContextV1 | undefined,
  next: DramaContextV1,
): boolean {
  if (previous === undefined) return true
  return previous.contextRevision !== next.contextRevision
    || previous.episodeRef !== next.episodeRef
    || previous.showRef !== next.showRef
    || next.freshness === 'gap'
    || next.freshness === 'stale'
}

export async function resolveCurrentDramaContext(owner: DramaContextOwner | undefined): Promise<{
  readonly ok: boolean
  readonly context?: DramaContextV1
  readonly reason: string
}> {
  if (owner === undefined) {
    return { ok: false, reason: 'drama context owner is not mounted' }
  }
  let raw: unknown
  try {
    raw = await owner.snapshot()
  } catch {
    return { ok: false, reason: 'drama context owner failed to return a snapshot' }
  }
  if (!validateDramaContext(raw)) {
    return { ok: false, reason: 'drama context snapshot failed contract validation' }
  }
  return { ok: true, context: raw, reason: 'current context resolved' }
}

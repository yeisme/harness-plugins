/**
 * Typed preview intents (V3 3.5). Open/attach/compare/download/open-external
 * fail closed. HTML/SVG/PDF are never treated as executable surfaces.
 *
 * @module @yeisme/dsh-rich-media/preview
 */

import type { ParseResult, PreviewIntentKind, PreviewIntentV1, PreviewResourceV1 } from './types.ts'
import { PREVIEW_INTENT_KINDS, previewResourceKey } from './types.ts'

const ACTIVE_CONTENT_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/pdf',
  'application/xhtml',
])

const ACTIVE_CONTENT_FAMILIES = new Set(['pdf'])

export interface AuthorizedPreviewIntentV1 {
  kind: PreviewIntentKind
  resourceKeys: readonly string[]
  execution: 'none'
}

export function parsePreviewIntent(input: unknown): ParseResult<PreviewIntentV1> {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'intent must be an object' }
  const record = input as Record<string, unknown>
  if (typeof record.kind !== 'string' || !(PREVIEW_INTENT_KINDS as readonly string[]).includes(record.kind)) {
    return { ok: false, error: 'intent kind is not authorized' }
  }
  if (!Array.isArray(record.resourceKeys) || record.resourceKeys.length === 0 || record.resourceKeys.some(key => typeof key !== 'string' || key.length === 0)) {
    return { ok: false, error: 'intent resourceKeys must be a non-empty string array' }
  }
  if (record.kind === 'compare' && record.resourceKeys.length !== 2) {
    return { ok: false, error: 'compare requires exactly two resource keys' }
  }
  for (const forbidden of ['url', 'path', 'bytes', 'href', 'src', 'html', 'svg']) {
    if (forbidden in record) return { ok: false, error: `forbidden intent field: ${forbidden}` }
  }
  return { ok: true, value: { kind: record.kind as PreviewIntentKind, resourceKeys: [...record.resourceKeys as string[]] } }
}

function capabilityFor(kind: PreviewIntentKind): readonly string[] {
  if (kind === 'open-external') return ['open']
  if (kind === 'attach' || kind === 'compare') return ['preview', 'compare', kind]
  return [kind]
}

function isActiveContent(resource: PreviewResourceV1): boolean {
  const mediaType = resource.mediaType.toLowerCase()
  return ACTIVE_CONTENT_TYPES.has(mediaType) || ACTIVE_CONTENT_FAMILIES.has(resource.family)
}

/** Owner-authorized intent handoff. Never enables HTML/SVG/PDF execution. */
export function authorizePreviewIntent(
  intent: PreviewIntentV1,
  resources: readonly PreviewResourceV1[],
): ParseResult<AuthorizedPreviewIntentV1> {
  const parsed = parsePreviewIntent(intent)
  if (!parsed.ok) return parsed
  const byKey = new Map(resources.map(resource => [previewResourceKey(resource.ref), resource]))
  const resolved: PreviewResourceV1[] = []
  for (const key of parsed.value.resourceKeys) {
    const resource = byKey.get(key)
    if (resource === undefined) return { ok: false, error: `unknown resource: ${key}` }
    const needed = capabilityFor(parsed.value.kind)
    if (!needed.some(capability => resource.capabilities.includes(capability))) {
      return { ok: false, error: `owner denied ${parsed.value.kind}` }
    }
    if ((parsed.value.kind === 'open' || parsed.value.kind === 'open-external') && isActiveContent(resource)) {
      if (!resource.capabilities.includes('open') && !resource.capabilities.includes('download')) {
        return { ok: false, error: 'active content cannot execute; owner did not authorize a safe handoff' }
      }
    }
    resolved.push(resource)
  }
  return {
    ok: true,
    value: {
      kind: parsed.value.kind,
      resourceKeys: resolved.map(resource => previewResourceKey(resource.ref)),
      execution: 'none',
    },
  }
}

export function previewIntentAllowsActiveExecution(_intent: PreviewIntentV1): false {
  return false
}

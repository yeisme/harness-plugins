/**
 * Typed /drama handlers. Mutations revalidate a server-authored descriptor
 * and never auto-retry unknown.
 */

import {
  type DramaCommandRequestV1,
  type DramaCommandResultKind,
  type DramaContextV1,
  isSafeDramaRef,
  shouldRetryUnknownDramaResult,
  validateDramaCommandRequest,
} from './contracts.js'
import {
  contextRevisionMatches,
  parseDramaSelector,
  resolveCurrentDramaContext,
  type DramaContextOwner,
} from './context.js'

export interface DramaActionDescriptorV1 {
  readonly descriptorRef: string
  readonly command: DramaCommandRequestV1['command']
  readonly targetRef: string
  readonly contextRevision: string
  readonly expiresAt: number
  readonly idempotencyKey: string
}

export interface DramaCommandResultV1 {
  readonly kind: DramaCommandResultKind
  readonly reason: string
  readonly retried: false
}

export interface DramaCommandHostOptions {
  readonly owner?: DramaContextOwner
  readonly now?: () => number
  readonly readDescriptor?: (request: DramaCommandRequestV1) => Promise<DramaActionDescriptorV1 | undefined>
  readonly dispatch?: (descriptor: DramaActionDescriptorV1) => Promise<'submitted' | 'unknown' | 'reconcile_required'>
}

const MUTATIONS = new Set(['generate', 'review', 'repair', 'handoff'])

export function isDramaMutation(command: DramaCommandRequestV1['command']): boolean {
  return MUTATIONS.has(command)
}

export async function handleDramaCommand(
  raw: unknown,
  options: DramaCommandHostOptions = {},
): Promise<DramaCommandResultV1> {
  if (!validateDramaCommandRequest(raw)) {
    return { kind: 'needs_contract', reason: 'command request failed contract validation', retried: false }
  }
  const request = raw
  const selector = parseDramaSelector(request.selector)
  if (!selector.ok) {
    return {
      kind: selector.ambiguous === true ? 'needs_contract' : 'needs_contract',
      reason: selector.reason ?? 'unsafe selector',
      retried: false,
    }
  }

  const resolved = await resolveCurrentDramaContext(options.owner)
  if (!resolved.ok || resolved.context === undefined) {
    return { kind: 'needs_contract', reason: resolved.reason, retried: false }
  }
  const context: DramaContextV1 = resolved.context
  if (!contextRevisionMatches(context, request.contextRevision)) {
    return { kind: 'reconcile_required', reason: 'context revision drifted; resync before mutation', retried: false }
  }
  if (context.freshness === 'offline') {
    return { kind: 'needs_contract', reason: 'drama owner is offline', retried: false }
  }
  if (context.freshness === 'gap' || context.freshness === 'stale') {
    return { kind: 'reconcile_required', reason: `context freshness is ${context.freshness}`, retried: false }
  }

  if (request.command === 'drama' || request.command === 'open' || request.command === 'plan' || request.command === 'evidence' || request.command === 'new') {
    return { kind: 'opened', reason: `${request.command} opened from current context`, retried: false }
  }

  if (!isDramaMutation(request.command)) {
    return { kind: 'needs_contract', reason: `unsupported command ${request.command}`, retried: false }
  }

  const descriptor = await options.readDescriptor?.(request)
  if (descriptor === undefined) {
    return { kind: 'needs_contract', reason: 'server-authored descriptor is missing', retried: false }
  }
  const now = options.now?.() ?? Date.now()
  if (descriptor.expiresAt <= now) {
    return { kind: 'reconcile_required', reason: 'descriptor expired; request a fresh preview', retried: false }
  }
  if (descriptor.command !== request.command || descriptor.contextRevision !== request.contextRevision) {
    return { kind: 'reconcile_required', reason: 'descriptor no longer matches the request', retried: false }
  }
  if (!isSafeDramaRef(descriptor.descriptorRef) || !isSafeDramaRef(descriptor.targetRef) || !isSafeDramaRef(descriptor.idempotencyKey)) {
    return { kind: 'needs_contract', reason: 'descriptor refs failed the safety check', retried: false }
  }

  if (options.dispatch === undefined) {
    return { kind: 'unknown', reason: 'dispatch settlement could not be verified', retried: false }
  }
  const settlement = await options.dispatch(descriptor)
  if (settlement === 'unknown') {
    return {
      kind: 'unknown',
      reason: 'owner settlement is unknown; do not retry with a new idempotency key',
      retried: shouldRetryUnknownDramaResult(),
    }
  }
  if (settlement === 'reconcile_required') {
    return { kind: 'reconcile_required', reason: 'owner asked for reconcile', retried: false }
  }
  return { kind: 'submitted', reason: `${request.command} submitted once`, retried: false }
}

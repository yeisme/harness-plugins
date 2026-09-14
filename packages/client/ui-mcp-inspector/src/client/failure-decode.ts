/**
 * MCP failure decode: framework-free pure mapping from observable failure
 * signals to the frozen consumer-visible taxonomy owned by the root repo
 * (`aigora-mcp-gateway-sidecar-unified-key-v1` §6.2). This module never
 * guesses: unknown shapes decode to the explicit `undecoded` state.
 *
 * `permission_denied_or_unknown_action` is a single frozen merged state: the
 * existence oracle is a root-repo governance decision and this side must not
 * split it — decoded results for that code carry no field from which the
 * trigger condition could be reconstructed.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client/failure-decode
 */

/** Frozen consumer-visible taxonomy (root-repo contract; passthrough only). */
export const FAILURE_TAXONOMY_CODES = Object.freeze([
  'unauthenticated',
  'permission_denied_or_unknown_action',
  'approval_required',
  'budget_exceeded',
  'rate_limited',
  'upstream_unavailable',
  'protocol_error',
] as const)

export type FailureTaxonomyCode = (typeof FAILURE_TAXONOMY_CODES)[number] | 'undecoded'
export type DecodedTaxonomyCode = (typeof FAILURE_TAXONOMY_CODES)[number]

export type ToolHubAuthCause = 'unauthenticated' | 'permission_denied'

/** Signal source 1: ConversationSnapshot-derived call error (safe-gated). */
export interface ToolActivityFailureSignal {
  readonly kind: 'tool-activity'
  /** Already passed the `deriveToolActivity` safe gate `/^[A-Za-z0-9_.:-]{1,120}$/`. */
  readonly errorCode?: string
  /** Already passed the `deriveToolActivity` safe gate `/^[A-Za-z0-9_. -]{1,120}$/`. */
  readonly errorName?: string
  /** Optional owner-declared bounded retry hint; never fabricated here. */
  readonly retryAfterSeconds?: number
}

/** Signal source 2: `toolHub` client error (`normalizeToolHubClientError`). */
export interface ToolHubClientFailureSignal {
  readonly kind: 'tool-hub-client-error'
  readonly code: string
  readonly accessDenied?: boolean
  readonly authCause?: ToolHubAuthCause
}

/** Signal source 3: catalog-derived empty-tools signal (connected, 0 tools). */
export interface EmptyToolsFailureSignal {
  readonly kind: 'empty-tools'
  readonly serverId: string
}

export type ToolFailureSignal = ToolActivityFailureSignal | ToolHubClientFailureSignal | EmptyToolsFailureSignal

export interface DecodedFailure {
  readonly taxonomyCode: FailureTaxonomyCode
  /** Only `rate_limited`/`budget_exceeded` may carry it; never fabricated. */
  readonly retryAfterSeconds?: number
  /** Only the explicit `undecoded` state displays a bounded raw signal. */
  readonly rawSignal?: string
}

const SAFE_ERROR_CODE = /^[A-Za-z0-9_.:-]{1,120}$/
const SAFE_ERROR_NAME = /^[A-Za-z0-9_. -]{1,120}$/

function boundedText(value: unknown, gate: RegExp): string | undefined {
  return typeof value === 'string' && gate.test(value) ? value : undefined
}

function frozen(code: DecodedTaxonomyCode): DecodedFailure {
  return Object.freeze({ taxonomyCode: code })
}

/** One shared constant per taxonomy code; the merged state is never split. */
const PLAIN_DECODED: Readonly<Record<DecodedTaxonomyCode, DecodedFailure>> = Object.freeze({
  unauthenticated: frozen('unauthenticated'),
  permission_denied_or_unknown_action: frozen('permission_denied_or_unknown_action'),
  approval_required: frozen('approval_required'),
  budget_exceeded: frozen('budget_exceeded'),
  rate_limited: frozen('rate_limited'),
  upstream_unavailable: frozen('upstream_unavailable'),
  protocol_error: frozen('protocol_error'),
})

const UNDECODED: DecodedFailure = Object.freeze({ taxonomyCode: 'undecoded' })

function withRetry(code: DecodedTaxonomyCode, retryAfterSeconds: number | undefined): DecodedFailure {
  if ((code === 'rate_limited' || code === 'budget_exceeded') && retryAfterSeconds !== undefined) {
    return { taxonomyCode: code, retryAfterSeconds }
  }
  return PLAIN_DECODED[code]
}

function boundedRetryAfter(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined
  return value
}

/** Gateway taxonomy code literals pass through verbatim (never rewritten). */
function literalTaxonomyCode(text: string): DecodedTaxonomyCode | undefined {
  for (const code of FAILURE_TAXONOMY_CODES) {
    if (text.includes(code)) return code
  }
  return undefined
}

function decodeSignalText(text: string): FailureTaxonomyCode {
  const literal = literalTaxonomyCode(text)
  if (literal !== undefined) return literal
  if (/\b401\b|unauthorized|token[ _-]?invalid|authentication[ _-]?required/.test(text)) return 'unauthenticated'
  if (/\b403\b|forbidden|permission[ _-]?denied|unknown[ _-]?action/.test(text)) return 'permission_denied_or_unknown_action'
  if (/\b402\b|quota|budget[ _-]?exceeded/.test(text)) return 'budget_exceeded'
  if (/\b429\b|too[ _-]?many[ _-]?requests|rate[ _-]?limit/.test(text)) return 'rate_limited'
  if (/\b50[234]\b|upstream|backend[ _-]?failed|timeout|connection[ _-]?refused/.test(text)) return 'upstream_unavailable'
  const rpc = /-3\d{4}/.exec(text)
  if (rpc !== null) {
    const numeric = Number.parseInt(rpc[0], 10)
    if (numeric >= -32700 && numeric <= -32600) return 'protocol_error'
  }
  return 'undecoded'
}

/**
 * Decode one observable failure signal. Deterministic and fail-closed: any
 * unknown shape, out-of-gate text, or distinction-lost state maps to the
 * explicit `undecoded` state instead of a guessed taxonomy code.
 */
export function decodeToolFailure(signal: ToolFailureSignal): DecodedFailure {
  if (signal.kind === 'empty-tools') return PLAIN_DECODED.permission_denied_or_unknown_action
  if (signal.kind === 'tool-hub-client-error') {
    if (signal.authCause === 'unauthenticated') return PLAIN_DECODED.unauthenticated
    if (signal.authCause === 'permission_denied') return PLAIN_DECODED.permission_denied_or_unknown_action
    const raw = boundedText(signal.code, SAFE_ERROR_CODE)
    return raw === undefined ? UNDECODED : { taxonomyCode: 'undecoded', rawSignal: raw }
  }
  const errorCode = boundedText(signal.errorCode, SAFE_ERROR_CODE)
  const errorName = boundedText(signal.errorName, SAFE_ERROR_NAME)
  if (errorCode === undefined && errorName === undefined) return UNDECODED
  const raw = [errorCode, errorName].filter(part => part !== undefined).join(' ')
  const decoded = decodeSignalText(raw.toLowerCase())
  if (decoded === 'undecoded') return { taxonomyCode: 'undecoded', rawSignal: raw }
  return withRetry(decoded, boundedRetryAfter(signal.retryAfterSeconds))
}

export interface FailurePresentationVocabulary {
  readonly taxonomyCode: DecodedTaxonomyCode
  readonly titleKey: string
  readonly likelyCauseKeys: readonly string[]
  readonly nextActionKeys: readonly string[]
}

const vocabulary = (taxonomyCode: DecodedTaxonomyCode, causes: readonly number[], actions: readonly number[]): FailurePresentationVocabulary => ({
  taxonomyCode,
  titleKey: `failure.code.${taxonomyCode}.title`,
  likelyCauseKeys: causes.map(index => `failure.code.${taxonomyCode}.cause.${index}`),
  nextActionKeys: actions.map(index => `failure.code.${taxonomyCode}.action.${index}`),
})

/** Shared presentation vocabulary; the merged code is one frozen object. */
export const FAILURE_PRESENTATION: Readonly<Record<DecodedTaxonomyCode, FailurePresentationVocabulary>> = Object.freeze({
  unauthenticated: Object.freeze(vocabulary('unauthenticated', [1, 2], [1, 2])),
  permission_denied_or_unknown_action: Object.freeze(vocabulary('permission_denied_or_unknown_action', [1, 2, 3], [1, 2, 3])),
  approval_required: Object.freeze(vocabulary('approval_required', [1, 2], [1, 2])),
  budget_exceeded: Object.freeze(vocabulary('budget_exceeded', [1, 2], [1, 2])),
  rate_limited: Object.freeze(vocabulary('rate_limited', [1, 2], [1, 2])),
  upstream_unavailable: Object.freeze(vocabulary('upstream_unavailable', [1, 2], [1, 2])),
  protocol_error: Object.freeze(vocabulary('protocol_error', [1, 2], [1, 2])),
})

export interface FailurePresentation {
  readonly taxonomyCode: DecodedTaxonomyCode
  readonly title: string
  readonly likelyCauses: readonly string[]
  readonly nextActions: readonly string[]
}

/** Resolve the shared vocabulary through any plain translator (framework-free). */
export function resolveFailurePresentation(code: DecodedTaxonomyCode, translate: (key: string) => string): FailurePresentation {
  const vocabulary_ = FAILURE_PRESENTATION[code]
  return {
    taxonomyCode: code,
    title: translate(vocabulary_.titleKey),
    likelyCauses: vocabulary_.likelyCauseKeys.map(translate),
    nextActions: vocabulary_.nextActionKeys.map(translate),
  }
}

export type RetryAfterHint = { readonly kind: 'exact'; readonly seconds: number } | { readonly kind: 'qualitative' }

/**
 * Bounded `retry_after_seconds` rendering rule: `0–3600` keeps the exact
 * seconds, anything larger degrades to a qualitative hint. Never a countdown,
 * never auto-retry, never a fabricated value.
 */
export function retryAfterHint(seconds: number | undefined): RetryAfterHint | undefined {
  if (seconds === undefined) return undefined
  if (seconds >= 0 && seconds <= 3600) return { kind: 'exact', seconds: Math.floor(seconds) }
  return { kind: 'qualitative' }
}

/** Structural subset of the controller state so this stays framework-free. */
export interface CatalogFailureSignalSource {
  readonly status: string
  readonly catalog?: {
    readonly healthAvailable?: boolean
    readonly items?: readonly {
      readonly family?: string
      readonly name: string
      readonly server?: string
      readonly toolCount?: number
      readonly health?: { readonly state: string }
    }[]
  }
  readonly code?: string
  readonly accessDenied?: boolean
  readonly authCause?: ToolHubAuthCause
}

/**
 * Derive in-pane failure signals from the catalog controller state:
 * connected-but-empty MCP servers (health-gated) and transport-layer
 * `toolHub` client errors. Degrade-only `unavailable` states describe the
 * host surface itself, not an MCP call failure, so they emit no signal.
 */
export function deriveCatalogFailureSignals(state: CatalogFailureSignalSource): readonly ToolFailureSignal[] {
  const signals: ToolFailureSignal[] = []
  if (state.status === 'ready' && state.catalog?.healthAvailable === true) {
    for (const item of state.catalog.items ?? []) {
      if (item.family === 'mcp' && item.health?.state === 'connected' && item.toolCount === 0) {
        signals.push({ kind: 'empty-tools', serverId: item.server ?? item.name })
      }
    }
  }
  if (state.status === 'error') {
    signals.push({
      kind: 'tool-hub-client-error',
      code: state.code ?? 'unknown',
      ...(state.accessDenied === true ? { accessDenied: true } : {}),
      ...(state.authCause !== undefined ? { authCause: state.authCause } : {}),
    })
  }
  return signals
}

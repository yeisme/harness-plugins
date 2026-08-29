import {
  ArtifactIntentSchema,
  ArtifactRefSchema,
  PANE_INTENT_SCHEMA,
  PaneActionReceiptSchema,
  type ArtifactIntentV1,
  type ArtifactRefV1,
  type PaneActionReceiptV1,
  type PaneContextV1,
} from '@yeisme/dsh-pane-protocol'

export interface BuildArtifactIntentOptions {
  readonly intent: ArtifactIntentV1['intent']
  readonly source: ArtifactRefV1
  readonly targetOwner?: string
  readonly targetPaneKind?: string
  readonly context: PaneContextV1
  readonly idempotencyKey: string
}

/** Builds the same owner-neutral intent for pointer, keyboard, menu, or command entrypoints. */
export function buildArtifactIntent(options: BuildArtifactIntentOptions): ArtifactIntentV1 {
  return ArtifactIntentSchema.parse({ schema: PANE_INTENT_SCHEMA, ...options })
}

export function validateArtifactRef(input: unknown): ArtifactRefV1 {
  return ArtifactRefSchema.parse(input)
}

/** Finite ArtifactIntentV1 vocabulary from the pane-artifact-handoff contract. */
export const ARTIFACT_INTENT_VOCABULARY = Object.freeze(['open', 'compare', 'attach_context', 'transform', 'handoff', 'link'] as const)

export function isArtifactIntentKind(value: unknown): value is ArtifactIntentV1['intent'] {
  return typeof value === 'string' && (ARTIFACT_INTENT_VOCABULARY as readonly string[]).includes(value)
}

let gestureCounter = 0

/**
 * Opaque per-gesture token. One user gesture reuses its token across duplicate
 * deliveries (double drop, double click, retry) so the target can dedup by the
 * derived idempotency key; a new gesture always starts a new token.
 */
export function beginArtifactGesture(): string {
  gestureCounter = (gestureCounter + 1) % 1_000_000
  const random = Math.random().toString(36).slice(2, 8)
  return `g${Date.now().toString(36)}${gestureCounter.toString(36)}${random}`
}

const IDEMPOTENCY_KEY_LIMIT = 160

function djb2(value: string): string {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(36)
}

/** Stable idempotency key for one gesture: the same gesture + intent + target always derives the same bounded key. */
export function deriveArtifactIdempotencyKey(input: {
  readonly gesture: string
  readonly intent: ArtifactIntentV1['intent']
  readonly targetOwner?: string | undefined
}): string {
  const key = `ah1:${input.gesture}:${input.intent}:${input.targetOwner ?? 'self'}`
  if (key.length <= IDEMPOTENCY_KEY_LIMIT) return key
  return `${key.slice(0, IDEMPOTENCY_KEY_LIMIT - 9)}:${djb2(key)}`
}

export interface BuildArtifactGestureIntentOptions {
  readonly gesture: string
  readonly intent: ArtifactIntentV1['intent']
  readonly source: ArtifactRefV1
  readonly targetOwner?: string
  readonly targetPaneKind?: string
  readonly context: PaneContextV1
}

/** Menu, drag, keyboard, and palette entrypoints build the exact same intent shape for one gesture. */
export function buildArtifactGestureIntent(options: BuildArtifactGestureIntentOptions): ArtifactIntentV1 {
  const { gesture, ...rest } = options
  return buildArtifactIntent({
    ...rest,
    idempotencyKey: deriveArtifactIdempotencyKey({ gesture, intent: options.intent, targetOwner: options.targetOwner }),
  })
}

export const ARTIFACT_INTENT_DRAG_MIME = 'application/x-yeisme-pane-artifact-intent' as const
const DRAG_PAYLOAD_LIMIT = 64 * 1_024

/** Serializes a validated intent for DataTransfer. The payload carries refs and versions only, never view bodies. */
export function createArtifactDragPayload(intent: ArtifactIntentV1): string {
  return JSON.stringify(ArtifactIntentSchema.parse(intent))
}

export type ArtifactDragPayloadParse =
  | { ok: true; intent: ArtifactIntentV1 }
  | { ok: false; reason: 'payload_not_json' | 'payload_contract_mismatch' }

/**
 * Drop-side gate: rejects non-JSON payloads, unknown intents, and unsafe/stale
 * refs before any dispatch. A rejected payload never reaches the dispatcher,
 * so a bad drop produces no state change.
 */
export function parseArtifactDragPayload(raw: unknown): ArtifactDragPayloadParse {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > DRAG_PAYLOAD_LIMIT) {
    return { ok: false, reason: 'payload_not_json' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'payload_not_json' }
  }
  const result = ArtifactIntentSchema.safeParse(parsed)
  if (!result.success) return { ok: false, reason: 'payload_contract_mismatch' }
  return { ok: true, intent: result.data }
}

export const OFFICIAL_ARTIFACT_HANDOFF_SERVICE = 'artifactHandoff' as const
export const OFFICIAL_ARTIFACT_HANDOFF_CONTRACT = 'ArtifactHandoffV1' as const

export interface OfficialArtifactHandoffLike {
  readonly contract?: string
  dispatchArtifactIntent?(input: unknown): Promise<unknown>
}

export interface ArtifactProbeContextLike {
  get(name: string): unknown
}

export type ArtifactHandoffChannelV1 = 'official' | 'local-contract'

export interface ArtifactHandoffChannelProbeV1 {
  readonly channel: ArtifactHandoffChannelV1
  readonly reason: string
  readonly missing: readonly string[]
  readonly official?: OfficialArtifactHandoffLike
}

/**
 * Per-session probe for the official ArtifactRefV1/ArtifactIntentV1 seam. A
 * missing or partial seam falls back to the local pane-artifact-handoff
 * contract path; menu and drag entries stay usable on both channels.
 */
export function probeArtifactHandoffChannel(ctx: ArtifactProbeContextLike | undefined): ArtifactHandoffChannelProbeV1 {
  let service: unknown
  if (ctx !== undefined) {
    try {
      service = ctx.get(OFFICIAL_ARTIFACT_HANDOFF_SERVICE)
    } catch {
      service = undefined
    }
  }
  const missing: string[] = []
  const candidate = (service !== null && typeof service === 'object' ? service : undefined) as OfficialArtifactHandoffLike | undefined
  if (candidate === undefined) {
    missing.push(OFFICIAL_ARTIFACT_HANDOFF_SERVICE)
  } else {
    if (candidate.contract !== OFFICIAL_ARTIFACT_HANDOFF_CONTRACT) missing.push(`${OFFICIAL_ARTIFACT_HANDOFF_SERVICE}.contract`)
    if (typeof candidate.dispatchArtifactIntent !== 'function') missing.push(`${OFFICIAL_ARTIFACT_HANDOFF_SERVICE}.dispatchArtifactIntent`)
  }
  if (missing.length > 0) {
    return {
      channel: 'local-contract',
      missing,
      reason: `Official ArtifactRefV1/ArtifactIntentV1 seam is unavailable (missing: ${missing.join(', ')}). Using the local pane-artifact-handoff contract path.`,
    }
  }
  return {
    channel: 'official',
    missing,
    official: candidate,
    reason: 'Official ArtifactRefV1/ArtifactIntentV1 seam is available; artifact handoff dispatches through the official channel.',
  }
}

export const PANE_ARTIFACT_HANDOFF_EVIDENCE_SCHEMA = 'pane.artifact-handoff-evidence.v1' as const
export const PANE_ARTIFACT_HANDOFF_EVIDENCE_KINDS = [
  'channel_resolved',
  'intent_dispatched',
  'intent_duplicate',
  'intent_rejected',
] as const
export type ArtifactHandoffEvidenceKindV1 = (typeof PANE_ARTIFACT_HANDOFF_EVIDENCE_KINDS)[number]

export interface ArtifactHandoffEvidenceV1 {
  readonly schema: typeof PANE_ARTIFACT_HANDOFF_EVIDENCE_SCHEMA
  readonly kind: ArtifactHandoffEvidenceKindV1
  readonly channel: ArtifactHandoffChannelV1
  readonly reasonCategory?: string
}

const EVIDENCE_CATEGORY = /^[a-z][a-z0-9_]{0,63}$/
const EVIDENCE_UNSAFE = /(?:prompt|token|secret|password|authorization|cookie|https?:\/\/|file:\/\/|\/etc\/|-----BEGIN)/i

/** Redacted evidence: categories only — never free text, refs, URLs, paths, or payload content. */
export function recordArtifactHandoffEvidence(input: {
  readonly kind: ArtifactHandoffEvidenceKindV1
  readonly channel: ArtifactHandoffChannelV1
  readonly reasonCategory?: string
}): ArtifactHandoffEvidenceV1 | undefined {
  if (!PANE_ARTIFACT_HANDOFF_EVIDENCE_KINDS.includes(input.kind)) return undefined
  if (input.channel !== 'official' && input.channel !== 'local-contract') return undefined
  if (input.reasonCategory !== undefined && (!EVIDENCE_CATEGORY.test(input.reasonCategory) || EVIDENCE_UNSAFE.test(input.reasonCategory))) {
    return undefined
  }
  return {
    schema: PANE_ARTIFACT_HANDOFF_EVIDENCE_SCHEMA,
    kind: input.kind,
    channel: input.channel,
    ...(input.reasonCategory === undefined ? {} : { reasonCategory: input.reasonCategory }),
  }
}

export interface ArtifactHandoffDispatchOptions {
  readonly probe: ArtifactHandoffChannelProbeV1
  readonly local: { dispatch(input: unknown): Promise<PaneActionReceiptV1> }
  readonly onEvidence?: (record: ArtifactHandoffEvidenceV1) => void
}

function handoffReceiptRef(input: unknown): string {
  const parsed = ArtifactIntentSchema.safeParse(input)
  const suffix = (parsed.success ? parsed.data.idempotencyKey : 'unparsed').replace(/[^a-z0-9._:-]/gi, '-').slice(0, 96) || 'unknown'
  return `receipt:pane:${suffix}`
}

function emitHandoffEvidence(
  options: ArtifactHandoffDispatchOptions,
  kind: ArtifactHandoffEvidenceKindV1,
  channel: ArtifactHandoffChannelV1,
  reasonCategory?: string,
): void {
  if (options.onEvidence === undefined) return
  const record = recordArtifactHandoffEvidence({ kind, channel, ...(reasonCategory === undefined ? {} : { reasonCategory }) })
  if (record === undefined) return
  try {
    options.onEvidence(record)
  } catch {
    // evidence recording must not block dispatch
  }
}

/**
 * Routes one intent through the probed channel. Once the official channel is
 * chosen, a dispatch failure never falls back silently to the local path — the
 * intent may already be admitted upstream — it settles as an unknown receipt
 * without retry.
 */
export async function dispatchArtifactHandoff(input: unknown, options: ArtifactHandoffDispatchOptions): Promise<PaneActionReceiptV1> {
  const { probe } = options
  if (probe.channel === 'official' && typeof probe.official?.dispatchArtifactIntent === 'function') {
    try {
      const receipt = PaneActionReceiptSchema.parse(await probe.official.dispatchArtifactIntent(input))
      emitHandoffEvidence(options, 'intent_dispatched', 'official', receipt.status)
      return receipt
    } catch {
      const intent = ArtifactIntentSchema.safeParse(input)
      const receipt = PaneActionReceiptSchema.parse({
        status: 'unknown',
        receiptRef: handoffReceiptRef(input),
        ...(intent.success ? { owner: intent.data.targetOwner ?? intent.data.source.owner } : {}),
        summary: 'The official artifact handoff channel did not return a verifiable receipt.',
        reconcileReason: 'official_dispatch_unknown',
      })
      emitHandoffEvidence(options, 'intent_rejected', 'official', 'unknown')
      return receipt
    }
  }
  const receipt = await options.local.dispatch(input)
  const failed = receipt.status === 'failed' || receipt.status === 'rejected' || receipt.status === 'unknown' || receipt.status === 'reconcile_required'
  emitHandoffEvidence(options, failed ? 'intent_rejected' : 'intent_dispatched', 'local-contract', receipt.status)
  return receipt
}

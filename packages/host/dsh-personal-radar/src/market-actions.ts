/**
 * Typed market mutations with receipt reconcile.
 *
 * Read/receipt authority stays with the Radar owner. This module only builds
 * typed intents (deterministic idempotency key + payload digest + reader
 * revision), dedupes repeats before dispatch, converts unknown outcomes into
 * receipt lookups by the ORIGINAL key, and never replays, never escalates the
 * reader lane, and never invokes a collection/observation action.
 */

import { isRadarLane, isSafeRadarRef, type RadarLane } from './contracts.js'

export const MARKET_MUTATION_SCHEMA = 'dsh.radar.market-mutation.v1' as const
export const MARKET_RECEIPT_SCHEMA = 'dsh.radar.market-receipt.v1' as const

export const MARKET_MUTATION_KINDS = ['mark_read', 'undo_read', 'watch', 'unwatch', 'pause_watch', 'resume_watch'] as const
export type MarketMutationKind = (typeof MARKET_MUTATION_KINDS)[number]

/** Every market mutation in scope is a reader-lane action; nothing may escalate. */
const MARKET_MUTATION_LANES: Readonly<Record<MarketMutationKind, RadarLane>> = {
  mark_read: 'reader', undo_read: 'reader', watch: 'reader', unwatch: 'reader', pause_watch: 'reader', resume_watch: 'reader',
}

export interface MarketMutationSelection {
  readonly signalRef: string
  readonly revision: number
}

export interface MarketMutationIntentV1 {
  readonly schema: typeof MARKET_MUTATION_SCHEMA
  readonly kind: MarketMutationKind
  /** Selected signals and the exact revisions the user saw. */
  readonly selections: readonly MarketMutationSelection[]
  /** Reader revision the user was looking at when acting. */
  readonly readerRevision: number
  readonly policyRevision: string
  /** Deterministic: same kind + selections + reader revision => same key. */
  readonly idempotencyKey: string
  /** Lowercase SHA-256 of the canonical payload; the owner re-verifies it. */
  readonly payloadDigest: string
}

export type MarketReceiptOutcome = 'accepted' | 'unknown' | 'rejected' | 'conflict' | 'reconciled'

export interface MarketActionReceiptV1 {
  readonly schema: typeof MARKET_RECEIPT_SCHEMA
  readonly idempotencyKey: string
  readonly outcome: MarketReceiptOutcome
  readonly reason: string
  /** Reader revision after the owner applied the mutation, when known. */
  readonly readerRevision?: number
}

export type MarketDispatchResult =
  | { readonly dispatched: true; readonly receipt: MarketActionReceiptV1 }
  | { readonly dispatched: false; readonly receipt: MarketActionReceiptV1 }

/** Host-injected owner seam. Same shape as the read transport: never spawn, never fetch. */
export interface MarketMutationTransport {
  apply(input: { intent: MarketMutationIntentV1 }, options?: { signal?: AbortSignal }): Promise<{ status: 'accepted'; readerRevision?: number } | { status: 'rejected'; reason: string } | { status: 'conflict'; reason: string }>
  lookupReceipt(idempotencyKey: string, options?: { signal?: AbortSignal }): Promise<MarketActionReceiptV1 | null>
}

export interface MarketMutationLedgerEntryV1 {
  readonly idempotencyKey: string
  readonly kind: MarketMutationKind
  readonly state: 'pending' | 'settled'
  readonly receipt: MarketActionReceiptV1
}

export interface MarketMutationLedgerV1 {
  readonly entries: Readonly<Record<string, MarketMutationLedgerEntryV1>>
  readonly pendingUnknown: readonly string[]
}

function snapshot(entries: Map<string, MarketMutationLedgerEntryV1>): MarketMutationLedgerV1 {
  const record: Record<string, MarketMutationLedgerEntryV1> = {}
  const pending: string[] = []
  for (const [key, entry] of entries) {
    record[key] = entry
    if (entry.receipt.outcome === 'unknown') pending.push(key)
  }
  return { entries: record, pendingUnknown: pending }
}

function receipt(key: string, outcome: MarketReceiptOutcome, reason: string, readerRevision?: number): MarketActionReceiptV1 {
  const base = { schema: MARKET_RECEIPT_SCHEMA, idempotencyKey: key, outcome, reason }
  return readerRevision === undefined ? base : { ...base, readerRevision }
}

/** Canonical, order-independent payload string covered by the digest. */
function canonicalPayload(kind: MarketMutationKind, selections: readonly MarketMutationSelection[], readerRevision: number, policyRevision: string): string {
  return JSON.stringify({ kind, policyRevision, readerRevision, selections: selectionPairs(selections) })
}

export async function digestMarketMutationPayload(kind: MarketMutationKind, selections: readonly MarketMutationSelection[], readerRevision: number, policyRevision: string): Promise<string> {
  const data = new TextEncoder().encode(canonicalPayload(kind, selections, readerRevision, policyRevision))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return 'sha256:' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Order-independent, charset-safe pair encoding (signal refs are OPAQUE-safe). */
function selectionPairs(selections: readonly MarketMutationSelection[]): string[] {
  return [...selections].map(selection => `${selection.signalRef}:${selection.revision}`).sort()
}

/** 64-bit FNV-1a fold for batches whose exact pairs do not fit the 160-char key budget. */
function fnv64Hex(value: string): string {
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < value.length; index++) {
    hash ^= BigInt(value.charCodeAt(index) & 0xff)
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return hash.toString(16).padStart(16, '0')
}

export function marketMutationIdempotencyKey(kind: MarketMutationKind, selections: readonly MarketMutationSelection[], readerRevision: number): string {
  const pairs = selectionPairs(selections)
  const exact = `market:${kind}:${pairs.join('.')}:r${readerRevision}`
  const key = exact.length <= 160 ? exact : `market:${kind}:r${readerRevision}:${fnv64Hex(pairs.join('.'))}`
  if (!isSafeRadarRef(key)) throw new Error('market_mutation_key_invalid')
  return key
}

/** Build a complete intent with deterministic key and matching digest. */
export async function buildMarketMutationIntent(kind: MarketMutationKind, selections: readonly MarketMutationSelection[], readerRevision: number, policyRevision: string): Promise<MarketMutationIntentV1> {
  return {
    schema: MARKET_MUTATION_SCHEMA, kind,
    selections: selections.map(selection => ({ ...selection })),
    readerRevision, policyRevision,
    idempotencyKey: marketMutationIdempotencyKey(kind, selections, readerRevision),
    payloadDigest: await digestMarketMutationPayload(kind, selections, readerRevision, policyRevision),
  }
}

export function validateMarketMutationIntent(intent: MarketMutationIntentV1): MarketActionReceiptV1 | null {
  const fail = (reason: string) => receipt(intent?.idempotencyKey ?? 'market:invalid', 'rejected', reason)
  if (!intent || typeof intent !== 'object' || intent.schema !== MARKET_MUTATION_SCHEMA) return fail('market_mutation_schema_invalid')
  if (!MARKET_MUTATION_KINDS.includes(intent.kind)) return fail('unregistered_intent')
  if (intent.kind in MARKET_MUTATION_LANES === false) return fail('unregistered_intent')
  if (!Array.isArray(intent.selections) || intent.selections.length < 1 || intent.selections.length > 100) return fail('market_mutation_selections_invalid')
  for (const selection of intent.selections) {
    if (!isSafeRadarRef(selection.signalRef) || !Number.isSafeInteger(selection.revision) || selection.revision < 1) return fail('market_mutation_selections_invalid')
  }
  if (!Number.isSafeInteger(intent.readerRevision) || intent.readerRevision < 1) return fail('market_mutation_reader_revision_invalid')
  if (!isSafeRadarRef(intent.policyRevision)) return fail('market_mutation_policy_revision_invalid')
  if (intent.idempotencyKey !== marketMutationIdempotencyKey(intent.kind, intent.selections, intent.readerRevision)) return fail('market_mutation_key_mismatch')
  return null
}

export interface MarketActionStore {
  dispatch(intent: MarketMutationIntentV1, signal?: AbortSignal): Promise<MarketDispatchResult>
  reconcile(idempotencyKey: string, signal?: AbortSignal): Promise<MarketActionReceiptV1 | null>
  /** Reads notify the store so stale reader revisions are refused locally. */
  noteReaderRevision(revision: number): void
  entry(idempotencyKey: string): MarketMutationLedgerEntryV1 | null
  ledger(): MarketMutationLedgerV1
}

/**
 * Idempotent mutation store. The store is the single dedupe point: a second
 * dispatch with the same key never reaches the transport again, a stale
 * reader revision is refused before dispatch, and unknown outcomes reconcile
 * through `lookupReceipt` only — `shouldAutoReplayRadarIntent()` is false
 * forever, so nothing is ever re-sent.
 */
export function createMarketActionStore(transport: MarketMutationTransport, options: { lane?: RadarLane } = {}): MarketActionStore {
  if (!transport || typeof transport.apply !== 'function' || typeof transport.lookupReceipt !== 'function') throw new Error('market_mutation_transport_invalid')
  const lane: RadarLane = options.lane !== undefined ? (isRadarLane(options.lane) ? options.lane : 'reader') : 'reader'
  const entries = new Map<string, MarketMutationLedgerEntryV1>()
  let observedReaderRevision = 0

  const settle = (key: string, kind: MarketMutationKind, value: MarketActionReceiptV1) => {
    entries.set(key, { idempotencyKey: key, kind, state: 'settled', receipt: value })
    if (value.outcome === 'accepted' && value.readerRevision !== undefined) {
      observedReaderRevision = Math.max(observedReaderRevision, value.readerRevision)
    }
  }

  return {
    ledger: () => snapshot(entries),
    entry: key => entries.get(key) ?? null,
    noteReaderRevision(revision) {
      if (Number.isSafeInteger(revision) && revision > 0) observedReaderRevision = Math.max(observedReaderRevision, revision)
    },
    async dispatch(intent, signal) {
      const key = intent?.idempotencyKey
      const kind = intent?.kind
      if (typeof key !== 'string' || typeof kind !== 'string') return { dispatched: false, receipt: receipt('market:invalid', 'rejected', 'market_mutation_schema_invalid') }
      const existing = entries.get(key)
      if (existing !== undefined) {
        // Double click / repeat: return the authoritative state as-is. A
        // pending entry stays pending; nothing is dispatched a second time.
        return { dispatched: false, receipt: { ...existing.receipt } }
      }
      const invalid = validateMarketMutationIntent(intent)
      if (invalid !== null) return { dispatched: false, receipt: invalid }
      const requiredLane = MARKET_MUTATION_LANES[intent.kind]
      const rank = { reader: 0, curator: 1, operator: 2 } as const
      if (rank[lane] < rank[requiredLane]) {
        // Refuse locally: the store never promotes itself to a higher lane.
        const denied = receipt(key, 'rejected', 'lane_violation')
        entries.set(key, { idempotencyKey: key, kind: intent.kind, state: 'settled', receipt: denied })
        return { dispatched: false, receipt: denied }
      }
      const digest = await digestMarketMutationPayload(intent.kind, intent.selections, intent.readerRevision, intent.policyRevision)
      if (digest !== intent.payloadDigest) {
        const mismatch = receipt(key, 'rejected', 'market_mutation_digest_mismatch')
        entries.set(key, { idempotencyKey: key, kind: intent.kind, state: 'settled', receipt: mismatch })
        return { dispatched: false, receipt: mismatch }
      }
      if (intent.readerRevision < observedReaderRevision) {
        // The user acted on a stale snapshot: never write against history.
        const conflict = receipt(key, 'conflict', 'reader_revision_stale', observedReaderRevision)
        entries.set(key, { idempotencyKey: key, kind: intent.kind, state: 'settled', receipt: conflict })
        return { dispatched: false, receipt: conflict }
      }
      entries.set(key, { idempotencyKey: key, kind: intent.kind, state: 'pending', receipt: receipt(key, 'unknown', 'market_mutation_pending') })
      let outcome: MarketActionReceiptV1
      try {
        if (signal?.aborted) throw new Error('aborted')
        const applied = await transport.apply({ intent }, signal ? { signal } : undefined)
        if (applied.status === 'accepted') outcome = receipt(key, 'accepted', 'owner applied the mutation', applied.readerRevision ?? intent.readerRevision)
        else if (applied.status === 'conflict') outcome = receipt(key, 'conflict', applied.reason)
        else outcome = receipt(key, 'rejected', applied.reason)
      } catch {
        // Timeout, disconnect or abort: outcome unknown, reconcile by key.
        outcome = receipt(key, 'unknown', 'outcome_unknown')
      }
      settle(key, intent.kind, outcome)
      return { dispatched: true, receipt: { ...outcome } }
    },
    async reconcile(idempotencyKey, signal) {
      const entry = entries.get(idempotencyKey)
      if (entry === undefined || entry.receipt.outcome !== 'unknown') return null
      // Receipt lookup only: no observe/collect call, no re-dispatch. The
      // single replay policy gate shouldAutoReplayRadarIntent() is
      // permanently false, so nothing below can ever resubmit the intent.
      let resolved: MarketActionReceiptV1 | null = null
      try {
        resolved = await transport.lookupReceipt(idempotencyKey, signal ? { signal } : undefined)
      } catch {
        return null
      }
      if (resolved === null || resolved.idempotencyKey !== idempotencyKey) return null
      const reconciled: MarketActionReceiptV1 = { ...resolved, schema: MARKET_RECEIPT_SCHEMA, outcome: 'reconciled' }
      settle(idempotencyKey, entry.kind, reconciled)
      return { ...reconciled }
    },
  }
}

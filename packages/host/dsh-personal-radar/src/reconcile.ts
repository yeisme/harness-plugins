/**
 * Receipt reconcile for Radar mutations.
 *
 * Feedback intents are idempotent end-to-end: the deterministic
 * idempotency key dedupes repeats before dispatch. Timeout/disconnect/kill
 * outcomes are recorded as `unknown` and reconciled against the owner run
 * reference; nothing is replayed automatically.
 */

import {
  shouldAutoReplayRadarIntent,
  type RadarActionReceiptV1,
} from './contracts.js'

export type RadarReconcileLookup = (idempotencyKey: string) => Promise<RadarActionReceiptV1 | undefined>

export interface RadarReconcileLedgerEntryV1 {
  readonly idempotencyKey: string
  readonly receipt: RadarActionReceiptV1
  readonly reconciled: boolean
}

export interface RadarReconcileLedgerV1 {
  /** In-flight and settled entries keyed by idempotency key. */
  readonly entries: Readonly<Record<string, RadarReconcileLedgerEntryV1>>
  /** Unknown-outcome entries awaiting owner reconcile. */
  readonly pendingUnknown: readonly string[]
}

function snapshot(entries: Map<string, RadarReconcileLedgerEntryV1>): RadarReconcileLedgerV1 {
  const record: Record<string, RadarReconcileLedgerEntryV1> = {}
  const pending: string[] = []
  for (const [key, entry] of entries) {
    record[key] = entry
    if (entry.receipt.outcome === 'unknown' && !entry.reconciled) pending.push(key)
  }
  return { entries: record, pendingUnknown: pending }
}

/**
 * Record a dispatch result. A duplicate idempotency key returns the existing
 * entry without re-dispatching (`{ dispatched: false }`).
 */
export function recordRadarDispatch(
  ledger: RadarReconcileLedgerV1,
  receipt: RadarActionReceiptV1,
): { readonly ledger: RadarReconcileLedgerV1; readonly dispatched: boolean } {
  const entries = new Map(Object.entries(ledger.entries))
  const existing = entries.get(receipt.idempotencyKey)
  if (existing !== undefined) {
    return { ledger: snapshot(entries), dispatched: false }
  }
  entries.set(receipt.idempotencyKey, { idempotencyKey: receipt.idempotencyKey, receipt, reconciled: false })
  return { ledger: snapshot(entries), dispatched: true }
}

/**
 * Reconcile one unknown entry through the owner lookup. The reconciled
 * receipt replaces the unknown one; `shouldAutoReplayRadarIntent()` is the
 * single policy gate and is always false.
 */
export async function reconcileRadarUnknown(
  ledger: RadarReconcileLedgerV1,
  idempotencyKey: string,
  lookup: RadarReconcileLookup,
): Promise<RadarReconcileLedgerV1> {
  const current = ledger.entries[idempotencyKey]
  if (current === undefined || current.receipt.outcome !== 'unknown' || current.reconciled) {
    return ledger
  }
  const resolved = await lookup(idempotencyKey)
  const entries = new Map(Object.entries(ledger.entries))
  if (resolved === undefined) {
    // Owner has no receipt for the key: stay unknown, stay unreconciled.
    return ledger
  }
  entries.set(idempotencyKey, { idempotencyKey, receipt: { ...resolved, outcome: 'reconciled' }, reconciled: true })
  return snapshot(entries)
}

export function isRadarReconcilePending(ledger: RadarReconcileLedgerV1, idempotencyKey: string): boolean {
  const entry = ledger.entries[idempotencyKey]
  return entry !== undefined && entry.receipt.outcome === 'unknown' && !entry.reconciled
}

export { shouldAutoReplayRadarIntent }

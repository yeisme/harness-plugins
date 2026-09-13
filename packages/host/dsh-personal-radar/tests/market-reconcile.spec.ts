import { expect, test } from 'vitest'
import {
  buildMarketMutationIntent, createMarketActionStore, marketMutationIdempotencyKey, validateMarketMutationIntent,
  type MarketActionReceiptV1, type MarketMutationIntentV1, type MarketMutationTransport,
} from '../src/market-actions.js'

function recordingTransport(options: { apply?: MarketMutationTransport['apply'] } = {}): MarketMutationTransport & { applied: MarketMutationIntentV1[]; receipts: Map<string, MarketActionReceiptV1 | null>; lookups: string[] } {
  const state = { applied: [] as MarketMutationIntentV1[], receipts: new Map<string, MarketActionReceiptV1 | null>(), lookups: [] as string[] }
  return {
    ...state,
    async apply(input) {
      state.applied.push(input.intent)
      if (options.apply) return options.apply(input)
      return { status: 'accepted', readerRevision: input.intent.readerRevision + 1 }
    },
    async lookupReceipt(key) {
      state.lookups.push(key)
      return state.receipts.get(key) ?? null
    },
  }
}

const selection = [{ signalRef: 'signal-a', revision: 2 }, { signalRef: 'signal-b', revision: 1 }]

test('a double click reuses the same idempotency key and never dispatches twice', async () => {
  const transport = recordingTransport()
  const store = createMarketActionStore(transport)
  const intent = await buildMarketMutationIntent('mark_read', selection, 7, 'sha256:policy')
  const first = await store.dispatch(intent)
  const second = await store.dispatch({ ...intent })
  const third = await store.dispatch({ ...intent })
  expect(first.dispatched).toBe(true)
  expect(second.dispatched).toBe(false)
  expect(third.dispatched).toBe(false)
  expect(transport.applied).toHaveLength(1)
  expect(second.receipt.outcome).toBe('accepted')
  expect(store.ledger().pendingUnknown).toHaveLength(0)
})

test('the idempotency key is deterministic for the same kind, selections and reader revision', async () => {
  const key = marketMutationIdempotencyKey('mark_read', selection, 7)
  expect(key).toBe(marketMutationIdempotencyKey('mark_read', [...selection].reverse(), 7))
  expect(key).not.toBe(marketMutationIdempotencyKey('undo_read', selection, 7))
  expect(key).not.toBe(marketMutationIdempotencyKey('mark_read', selection, 8))
  const intent = await buildMarketMutationIntent('watch', [selection[0]!], 3, 'sha256:policy')
  expect(intent.payloadDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
  expect(await buildMarketMutationIntent('watch', [selection[0]!], 3, 'sha256:policy')).toEqual(intent)
  expect(validateMarketMutationIntent(intent)).toBeNull()
})

test('a tampered digest or mismatched key is rejected locally without any transport write', async () => {
  const transport = recordingTransport()
  const store = createMarketActionStore(transport)
  const intent = await buildMarketMutationIntent('mark_read', selection, 7, 'sha256:policy')
  const tampered: MarketMutationIntentV1 = { ...intent, payloadDigest: 'sha256:' + '0'.repeat(64) }
  const result = await store.dispatch(tampered)
  expect(result.receipt.outcome).toBe('rejected')
  expect(result.receipt.reason).toBe('market_mutation_digest_mismatch')
  const wrongKey: MarketMutationIntentV1 = { ...intent, idempotencyKey: 'market:mark_read:other' }
  expect((await store.dispatch(wrongKey)).receipt.reason).toBe('market_mutation_key_mismatch')
  expect(transport.applied).toHaveLength(0)
})

test('a stale reader revision is refused as a conflict before dispatch', async () => {
  const transport = recordingTransport()
  const store = createMarketActionStore(transport)
  store.noteReaderRevision(9)
  const intent = await buildMarketMutationIntent('mark_read', selection, 7, 'sha256:policy')
  const result = await store.dispatch(intent)
  expect(result.dispatched).toBe(false)
  expect(result.receipt.outcome).toBe('conflict')
  expect(result.receipt.reason).toBe('reader_revision_stale')
  expect(transport.applied).toHaveLength(0)
  // The owner-side conflict code maps to the same honest outcome.
  const ownerConflict = recordingTransport({ apply: async () => ({ status: 'conflict', reason: 'owner reader_revision_conflict' }) })
  const ownerStore = createMarketActionStore(ownerConflict)
  const fresh = await buildMarketMutationIntent('mark_read', selection, 9, 'sha256:policy')
  const ownerResult = await ownerStore.dispatch(fresh)
  expect(ownerResult.receipt.outcome).toBe('conflict')
  expect(ownerResult.receipt.reason).toBe('owner reader_revision_conflict')
})

test('unknown outcomes reconcile by the original key with receipt lookup only, never a re-write', async () => {
  const transport = recordingTransport({ apply: async () => { throw new Error('ECONNRESET') } })
  const store = createMarketActionStore(transport)
  const intent = await buildMarketMutationIntent('watch', [selection[0]!], 4, 'sha256:policy')
  const unknown = await store.dispatch(intent)
  expect(unknown.receipt.outcome).toBe('unknown')
  expect(store.ledger().pendingUnknown).toEqual([intent.idempotencyKey])
  // First lookup: the owner has no receipt yet; the entry stays unknown.
  expect(await store.reconcile(intent.idempotencyKey)).toBeNull()
  expect(transport.applied).toHaveLength(1)
  expect(transport.lookups).toEqual([intent.idempotencyKey])
  // Owner settles: reconcile resolves once, without a second dispatch.
  transport.receipts.set(intent.idempotencyKey, { schema: 'dsh.radar.market-receipt.v1', idempotencyKey: intent.idempotencyKey, outcome: 'accepted', reason: 'owner completed after reconnect', readerRevision: 5 })
  const reconciled = await store.reconcile(intent.idempotencyKey)
  expect(reconciled).toMatchObject({ outcome: 'reconciled', reason: 'owner completed after reconnect' })
  expect(transport.applied).toHaveLength(1)
  expect(store.ledger().pendingUnknown).toHaveLength(0)
  // Reconcile is one-shot: settled entries never look up again.
  await store.reconcile(intent.idempotencyKey)
  expect(transport.lookups).toHaveLength(2)
})

test('unregistered kinds are refused locally and never escalate the lane', async () => {
  const transport = recordingTransport()
  const store = createMarketActionStore(transport, { lane: 'reader' })
  const fake = { schema: 'dsh.radar.market-mutation.v1', kind: 'purge_watchlist', selections: selection, readerRevision: 1, policyRevision: 'sha256:policy', idempotencyKey: 'market:purge_watchlist:x', payloadDigest: 'sha256:' + '0'.repeat(64) }
  const result = await store.dispatch(fake as unknown as MarketMutationIntentV1)
  expect(result.receipt.outcome).toBe('rejected')
  expect(result.receipt.reason).toBe('unregistered_intent')
  expect(transport.applied).toHaveLength(0)
  // A curated operator intent offered to a reader-lane store is refused locally.
  const operatorIntent = { ...await buildMarketMutationIntent('unwatch', [selection[0]!], 2, 'sha256:policy'), kind: 'purge_watchlist' } as unknown as MarketMutationIntentV1
  expect((await store.dispatch(operatorIntent)).receipt.reason).toBe('unregistered_intent')
  expect(validateMarketMutationIntent({ ...(await buildMarketMutationIntent('watch', [selection[0]!], 2, 'sha256:policy')), selections: [{ signalRef: '../../etc/passwd', revision: 1 }] })).toMatchObject({ reason: 'market_mutation_selections_invalid' })
})

test('an accepted watch mutation advances the observed reader revision for later staleness checks', async () => {
  const transport = recordingTransport()
  const store = createMarketActionStore(transport)
  const watch = await buildMarketMutationIntent('watch', [selection[0]!], 4, 'sha256:policy')
  const applied = await store.dispatch(watch)
  expect(applied.receipt.outcome).toBe('accepted')
  expect(applied.receipt.readerRevision).toBe(5)
  // A replayed read at the older revision is now stale for mutations.
  const stale = await store.dispatch(await buildMarketMutationIntent('mark_read', selection, 4, 'sha256:policy'))
  expect(stale.receipt.outcome).toBe('conflict')
  const current = await store.dispatch(await buildMarketMutationIntent('mark_read', selection, 5, 'sha256:policy'))
  expect(current.receipt.outcome).toBe('accepted')
})

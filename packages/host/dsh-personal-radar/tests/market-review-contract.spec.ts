import { expect, test } from 'vitest'
import { projectMarketReview, projectMarketReviewIndex } from '../src/market-contracts.js'
import { readConnectedMarketReview, readConnectedMarketReviewIndex, type ConnectedMarketTransport } from '../src/market-adapter.js'
import { createMarketReviewController } from '../src/market-controller.js'

const policy = 'sha256:policy'
const signal = (ref: string, revision: number, overrides: Record<string, unknown> = {}) => ({
  spec: 'radar.market_signal.v1', signal_ref: ref, revision, claim_kind: 'rank_changed', assertion_level: 'observed',
  lifecycle: 'active', source_ref: 'hongguo', market: 'CN', title: '样本信号', topics: ['t'], observed_at: '2026-09-09T08:00:00Z',
  observation_refs: [], evidence_refs: ['evidence-' + ref], comparison: null, limitations: [], analysis_version: 'v1',
  mapping_version: 'v1', origin: 'fixture', ...overrides,
})
const entry = (original: ReturnType<typeof signal>, followup: ReturnType<typeof signal> | null, outcome: string) => ({
  original, followup, outcome, reason: 'Reason text.',
})
const reviewRow = (overrides: Record<string, unknown> = {}) => ({
  spec: 'radar.market_review.v1', review_ref: 'market-review-abc', digest: 'sha256:review', policy_revision: policy,
  window: { start: '2026-09-07T00:00:00Z', end: '2026-09-14T00:00:00Z' }, as_of: '2026-09-14T06:00:00Z',
  entries: [
    entry(signal('signal-a', 1), signal('signal-a', 2, { lifecycle: 'active' }), 'sustained'),
    entry(signal('signal-b', 1), null, 'inconclusive'),
  ],
  builder_version: 'market-review-builder.v1', limitations: ['No later evidence is inconclusive, never a failed prediction.'],
  filtered: false, ...overrides,
})

test('review projection keeps original and followup bound to one policy revision with four outcomes', () => {
  const row = reviewRow()
  const result = projectMarketReview(row, policy)
  expect(result.schema).toBe('dsh.radar.market-review.v1')
  expect(result.reviewRef).toBe('market-review-abc')
  expect(result.asOf).toBe('2026-09-14T06:00:00Z')
  expect(result.entries.map(entry => entry.outcome)).toEqual(['sustained', 'inconclusive'])
  expect(result.entries[0]!.followup?.signalRef).toBe('signal-a')
  expect(result.entries[1]!.followup).toBeNull()
  // The frozen limitations survive verbatim; the client never restyles them as errors.
  expect(result.limitations[0]).toContain('never a failed prediction')
})

test('review projection rejects mismatched policy fences, wrong specs and unsafe payloads', () => {
  expect(() => projectMarketReview(reviewRow(), 'sha256:other')).toThrow('market_contract_mismatch')
  expect(() => projectMarketReview(reviewRow({ policy_revision: 'sha256:other' }), policy)).toThrow('market_contract_mismatch')
  expect(() => projectMarketReview(reviewRow({ spec: 'radar.market_review.v2' }), policy)).toThrow('market_contract_mismatch')
  expect(() => projectMarketReview(reviewRow({ entries: [entry(signal('signal-a', 1), null, 'failed')] }), policy)).toThrow('market_contract_mismatch')
  expect(() => projectMarketReview(reviewRow({ entries: [entry(signal('signal-a', 1), null, 'retracted'), entry(signal('signal-a', 2), null, 'retracted')] }), policy)).toThrow('market_contract_mismatch')
  expect(() => projectMarketReview(reviewRow({ digest: 'https://private.example/digest' }), policy)).toThrow('market_unsafe_ref')
})

test('review index projection bounds the discovery list and keeps summaries content-free', () => {
  const row = { spec: 'radar.market_reviews.v1', reviews: [
    { review_ref: 'market-review-abc', digest: 'sha256:review', window: { start: '2026-09-07T00:00:00Z', end: '2026-09-14T00:00:00Z' }, as_of: '2026-09-14T06:00:00Z', entries: 12 },
  ], limitations: ['Latest 30 reviews; drill into radar://market/reviews/{ref}.'] }
  const result = projectMarketReviewIndex(row, policy)
  expect(result.reviews).toHaveLength(1)
  expect(result.reviews[0]!).toMatchObject({ reviewRef: 'market-review-abc', entries: 12 })
  expect(() => projectMarketReviewIndex({ ...row, reviews: [...row.reviews, { ...row.reviews[0], review_ref: 'market-review-abc' }] }, policy)).toThrow('market_contract_mismatch')
  expect(() => projectMarketReviewIndex({ spec: 'radar.market_review.v1', reviews: [], limitations: [] }, policy)).toThrow('market_contract_mismatch')
})

function reviewTransport(options: { missingCapability?: boolean; reviewRef?: string } = {}) {
  const calls: string[] = []
  const views = options.missingCapability ? ['market_brief', 'market_reader'] : ['market_brief', 'market_reader', 'market_reviews', 'market_review']
  const client: ConnectedMarketTransport = { async readResource({ uri }) {
    calls.push(uri)
    if (uri === 'radar://market/capabilities') return { contents: [{ uri, text: JSON.stringify({ spec: 'radar.market_capabilities.v1', views }) }] }
    if (uri === 'radar://market/reader') return { contents: [{ uri, text: JSON.stringify({ spec: 'radar.market_reader.v1', reader_ref: 'local', revision: 3, policy_revision: policy }) }] }
    if (uri === 'radar://market/reviews') return { contents: [{ uri, text: JSON.stringify({ spec: 'radar.market_reviews.v1', reviews: [
      { review_ref: 'market-review-abc', digest: 'sha256:review', window: { start: '2026-09-07T00:00:00Z', end: '2026-09-14T00:00:00Z' }, as_of: '2026-09-14T06:00:00Z', entries: 2 },
    ], limitations: [] }) }] }
    if (uri === 'radar://market/reviews/market-review-abc') {
      if (options.reviewRef === 'missing') throw { data: { code: 'review_not_found' } }
      return { contents: [{ uri, text: JSON.stringify(reviewRow(options.reviewRef !== undefined ? { review_ref: options.reviewRef } : {})) }] }
    }
    throw new Error('unexpected uri ' + uri)
  } }
  return { client, calls }
}

test('review adapter reads the bound ref through the policy fence and maps missing reviews honestly', async () => {
  const { client, calls } = reviewTransport()
  const index = await readConnectedMarketReviewIndex(client)
  expect(index.ok).toBe(true)
  if (index.ok) expect(index.index.reviews[0]!.reviewRef).toBe('market-review-abc')
  const review = await readConnectedMarketReview(client, 'market-review-abc')
  expect(review.ok).toBe(true)
  if (review.ok) expect(review.review.entries).toHaveLength(2)
  expect(calls).toContain('radar://market/reviews')
  expect(calls).toContain('radar://market/reviews/market-review-abc')
  const missing = await readConnectedMarketReview(reviewTransport({ reviewRef: 'missing' }).client, 'market-review-abc')
  expect(missing).toMatchObject({ ok: false, reason: 'reference_unavailable' })
  // A substituted review payload is a mismatch, never displayed content.
  const substituted = await readConnectedMarketReview(reviewTransport({ reviewRef: 'market-review-other' }).client, 'market-review-abc')
  expect(substituted).toMatchObject({ ok: false, reason: 'contract_mismatch' })
  const unavailable = await readConnectedMarketReviewIndex(reviewTransport({ missingCapability: true }).client)
  expect(unavailable).toMatchObject({ ok: false, reason: 'capability_unavailable' })
  await expect(readConnectedMarketReview(client, 'not a safe ref')).rejects.toThrow('market_selection_invalid')
})

test('review controller auto-binds the newest review, keeps selections across refresh and never binds foreign refs', async () => {
  const reads: Array<{ index: number; review: string | null }> = []
  let indexFails = false
  const controller = createMarketReviewController(
    async () => { reads.push({ index: reads.length, review: null }); if (indexFails) throw new Error('offline'); return {
      ok: true, index: { schema: 'dsh.radar.market-review-index.v1' as const, policyRevision: policy, reviews: [
        { reviewRef: 'market-review-new', digest: 'sha256:new', window: { start: '2026-09-07T00:00:00Z', end: '2026-09-14T00:00:00Z' }, asOf: '2026-09-14T06:00:00Z', entries: 1 },
        { reviewRef: 'market-review-old', digest: 'sha256:old', window: { start: '2026-08-31T00:00:00Z', end: '2026-09-07T00:00:00Z' }, asOf: '2026-09-07T06:00:00Z', entries: 4 },
      ], limitations: [] }, reader: { schema: 'dsh.radar.market-reader.v1' as const, readerRef: 'local' as const, revision: 3, policyRevision: policy } } },
    async (_context, reviewRef) => { reads.push({ index: -1, review: reviewRef }); return {
      ok: true, review: { schema: 'dsh.radar.market-review.v1' as const, reviewRef, digest: 'sha256:review', policyRevision: policy,
        window: { start: '2026-09-07T00:00:00Z', end: '2026-09-14T00:00:00Z' }, asOf: '2026-09-14T06:00:00Z',
        entries: [{ original: { schema: 'dsh.radar.market-signal.v1', signalRef: 'signal-a', revision: 1, policyRevision: policy, title: 't', market: 'CN',
          observedAt: '2026-09-09T08:00:00.000Z', claimKind: 'rank_changed', sourceRef: 'hongguo', origin: 'fixture', assertionLevel: 'observed',
          comparison: null, lifecycle: 'active', evidenceRefs: [], limitations: [] }, followup: null, outcome: 'inconclusive', reason: 'No later signal evidence.' }],
        builderVersion: 'market-review-builder.v1', filtered: false, limitations: [] },
      reader: { schema: 'dsh.radar.market-reader.v1', readerRef: 'local', revision: 3, policyRevision: policy } } })
  controller.setContext('session-a')
  await controller.refresh()
  // Newest owner-frozen review binds automatically without any selection.
  expect(controller.snapshot().selection).toBe('market-review-new')
  expect(controller.snapshot().review?.ok).toBe(true)
  await controller.select('market-review-old')
  expect(controller.snapshot().selection).toBe('market-review-old')
  await controller.refresh()
  // An explicit selection survives refresh; it is not silently replaced by the newest.
  expect(controller.snapshot().selection).toBe('market-review-old')
  // Policy invalidation clears the bound review; the next refresh rebinds honestly.
  controller.invalidatePolicy()
  expect(controller.snapshot().review).toBeNull()
  indexFails = true
  await controller.refresh()
  expect(controller.snapshot().index).toMatchObject({ ok: false, reason: 'offline' })
  controller.dispose()
})

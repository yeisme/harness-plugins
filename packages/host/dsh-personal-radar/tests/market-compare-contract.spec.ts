import { expect, test } from 'vitest'
import { projectMarketCompare } from '../src/market-contracts.js'

const side = (ref: string, market: string) => ({ signal_ref: ref, signal_revision: 1, subject_ref: 'work-' + ref,
  title: 'Same title candidate', market, lifecycle: 'active', identity: { mapping_status: 'candidate', canonical_work_ref: null },
  observations: [{ observation_ref: 'obs-' + ref, original_title: 'Same title candidate', market, observed_at: '2026-09-11T08:00:00Z',
    source_ref: ref, source_revision: 1, platform: ref, sampling_scope: 'public catalog', facts: [], evidence_refs: ['evidence-' + ref], origin: 'fixture' }] })
test('cross-market projection preserves side-by-side unknown geography and candidate identity', () => {
  const result = projectMarketCompare({ spec: 'radar.market_cross_market.v1', policy_revision: 'sha256:policy',
    sides: [side('hongguo', 'unknown'), side('reelshort', 'US')], identity_relation: 'not_established', presentation: 'side_by_side', shared_numeric_axis: false, causal_inference: false,
    limitations: ['Different source scopes; no combined score.'] })
  expect(result.sides.map(s => s.market)).toEqual(['unknown', 'US'])
  expect(result.identityRelation).toBe('not_established')
  expect(result.sharedNumericAxis).toBe(false)
})
test('cross-market projection rejects side count, unsafe metrics and inferred identity', () => {
  const base = { spec: 'radar.market_cross_market.v1', policy_revision: 'sha256:policy', sides: [side('a', 'unknown'), side('b', 'unknown')],
    identity_relation: 'not_established', presentation: 'side_by_side', shared_numeric_axis: false, causal_inference: false, limitations: [] }
  expect(() => projectMarketCompare({ ...base, sides: [side('a', 'unknown')] })).toThrow()
  expect(() => projectMarketCompare({ ...base, identity_relation: 'same' })).toThrow()
  expect(() => projectMarketCompare({ ...base, sides: [side('a', 'unknown'), { ...side('b', 'unknown'), observations: [{ ...side('b', 'unknown').observations[0], facts: [{ note: 'https://private' }] }] }] })).toThrow()
})

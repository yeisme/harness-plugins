import { expect, test } from 'vitest'
import { projectMarketReader, projectMarketSignal, projectMarketEvidence, projectMarketBrief, projectMarketCatchup } from '../src/market-contracts.js'
import { projectSelectedMarketSignal, projectSelectedMarketEvidence } from '../src/market-contracts.js'

const signal = () => ({ spec: 'radar.market_signal.v1', signal_ref: 'signal-1', revision: 1, title: 'A sample',
  source_ref: 'hongguo', origin: 'fixture', assertion_level: 'observed', comparison: null,
  market: 'unknown', observed_at: '2026-09-11T08:00:00.000Z', claim_kind: 'newly_observed', lifecycle: 'active',
  evidence_refs: ['evidence-1'], limitations: ['Catalog sample only.'] })

test('detail selection rejects a newer revision and evidence from another selection', () => {
  const selection = { signalRef: 'signal-1', revision: 1 }
  const selected = projectSelectedMarketSignal(signal(), selection, 'sha256:policy')
  expect(selected.revision).toBe(1)
  expect(() => projectSelectedMarketSignal({ ...signal(), revision: 2 }, selection, 'sha256:policy')).toThrow('selection_mismatch')
  expect(() => projectSelectedMarketSignal({ ...signal(), signal_ref: 'signal-2' }, selection, 'sha256:policy')).toThrow('selection_mismatch')
  const evidence = { evidence_ref: 'evidence-1', source_ref: 'other-source', observed_at: '2026-09-11T08:00:00Z', summary: 'Linked correction evidence', origin: 'manual', limitations: [] }
  expect(projectSelectedMarketEvidence(evidence, selected, 'evidence-1').sourceRef).toBe('other-source')
  expect(() => projectSelectedMarketEvidence(evidence, selected, 'evidence-2')).toThrow('not_attached')
  expect(() => projectSelectedMarketEvidence({ ...evidence, evidence_ref: 'evidence-2' }, selected, 'evidence-1')).toThrow('selection_mismatch')
})
test('market projection preserves owner revision and unknown geography while stripping unknown fields', () => {
  const result = projectMarketSignal({ ...signal(), raw_payload: 'private', url: 'https://example.invalid' }, 'sha256:abc')
  expect(result.market).toBe('unknown')
  expect(result.revision).toBe(1)
  expect(JSON.stringify(result)).not.toContain('private')
  expect(JSON.stringify(result)).not.toContain('https:')
  expect(projectMarketSignal({ ...signal(), title: 'cookie=private' }, 'sha256:abc').title).toBe('[redacted]')
})

const brief = () => ({ spec: 'radar.market_brief.v1', brief_ref: 'brief-1', digest: 'sha256:abc', policy_revision: 'sha256:def',
  generated_at: '2026-09-11T08:00:00.000Z', timezone: 'Asia/Shanghai',
  window: { start: '2026-09-10T00:00:00.000Z', end: '2026-09-11T00:00:00.000Z' },
  status: 'degraded', main: [], watching: [signal()], remaining: 0, filtered: false, correction_count: 0,
  limitations: ['Synthetic fixture'], coverage: { spec: 'radar.market_source_gaps.v1', sources: [
    { source_ref: 'hongguo', health: 'unavailable', qualified: false, reasons: ['identity_evidence_missing'] },
  ] } })
test('brief preserves owner ordering, bounds and coverage without deriving readiness', () => {
  const projected = projectMarketBrief(brief())
  expect(projected.watching[0].policyRevision).toBe('sha256:def')
  expect(projected.timezone).toBe('Asia/Shanghai')
  expect(projected.coverage[0].qualified).toBe(false)
  expect(() => projectMarketBrief({ ...brief(), watching: Array(3).fill(signal()) })).toThrow()
  expect(() => projectMarketBrief({ ...brief(), main: [signal()] })).toThrow()
  expect(() => projectMarketBrief({ ...brief(), remaining: -1 })).toThrow()
  expect(() => projectMarketBrief({ ...brief(), timezone: 'bad/zone' })).toThrow()
})
test('metric projection retains owner values and rejects nonfinite comparisons', () => {
  const comparison = { comparable: true, comparison_key: 'sha256:abc', before: 20, after: 5, change: -15,
    percent_change: -75, window: brief().window, limitations: ['Same sampled scope only'] }
  const projected = projectMarketSignal({ ...signal(), comparison }, 'sha256:def')
  expect(projected.comparison?.percentChange).toBe(-75)
  expect(projected.comparison?.before).toBe(20)
  expect(() => projectMarketSignal({ ...signal(), comparison: { ...comparison, after: Infinity } }, 'sha256:def')).toThrow()
})

test('catch-up retains an empty continuation page instead of inferring that everything is read', () => {
  const page = { spec: 'radar.market_catchup.v1', reader_revision: 4, policy_revision: 'sha256:policy',
    window: brief().window, signals: [], next_cursor: 'opaque_cursor-1', history_limited: true, limitations: ['Thirty-day window'] }
  expect(projectMarketCatchup(page)).toMatchObject({ signals: [], nextCursor: 'opaque_cursor-1', historyLimited: true, readerRevision: 4 })
  expect(projectMarketCatchup({ ...page, next_cursor: null }).nextCursor).toBeNull()
  expect(() => projectMarketCatchup({ ...page, next_cursor: 'https://example.invalid' })).toThrow()
  expect(() => projectMarketCatchup({ ...page, reader_revision: 0 })).toThrow()
})
test('catch-up rejects duplicates and overlarge pages without altering owner ordering', () => {
  const page = { spec: 'radar.market_catchup.v1', reader_revision: 1, policy_revision: 'sha256:policy',
    window: brief().window, signals: [signal(), { ...signal(), signal_ref: 'signal-2' }], next_cursor: null, history_limited: true, limitations: [] }
  expect(projectMarketCatchup(page).signals.map(s => s.signalRef)).toEqual(['signal-1', 'signal-2'])
  expect(() => projectMarketCatchup({ ...page, signals: [signal(), signal()] })).toThrow()
  expect(() => projectMarketCatchup({ ...page, signals: Array(101).fill(signal()) })).toThrow()
})
test('unknown versions, missing revisions, impossible times and unsafe refs fail closed', () => {
  for (const patch of [{ spec: 'radar.market_signal.v2' }, { revision: undefined }, { observed_at: '2026-02-30T00:00:00Z' },
    { signal_ref: '../private' }, { evidence_refs: Array(101).fill('evidence-1') }]) {
    expect(() => projectMarketSignal({ ...signal(), ...patch }, 'sha256:abc')).toThrow()
  }
})
test('reader and evidence projections require owner versions and bounded summaries', () => {
  expect(projectMarketReader({ spec: 'radar.market_reader.v1', reader_ref: 'local', revision: 2, policy_revision: 'sha256:abc' }).revision).toBe(2)
  const evidence = { evidence_ref: 'evidence-1', source_ref: 'hongguo', observed_at: '2026-09-11T08:00:00Z',
    summary: 'Sample only', origin: 'fixture', limitations: [] }
  expect(projectMarketEvidence(evidence).origin).toBe('fixture')
  expect(() => projectMarketEvidence({ ...evidence, summary: 'x'.repeat(501) })).toThrow()
})

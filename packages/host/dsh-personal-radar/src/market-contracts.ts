import { isSafeRadarRef } from './contracts.js'

export const MARKET_PROJECTION_SCHEMA = 'dsh.radar.market-signal.v1' as const
export interface MarketSignalProjection {
  schema: typeof MARKET_PROJECTION_SCHEMA
  signalRef: string
  revision: number
  policyRevision: string
  title: string
  market: string
  observedAt: string
  claimKind: string
  sourceRef: string
  origin: 'fixture' | 'manual' | 'live'
  assertionLevel: 'observed' | 'confirmed'
  comparison: MarketComparisonProjection | null
  lifecycle: 'active' | 'retracted' | 'inconclusive' | 'cooled'
  evidenceRefs: string[]
  limitations: string[]
}
export interface MarketComparisonProjection {
  comparisonKey: string
  before: number
  after: number
  change: number
  percentChange: number | null
  window: { start: string; end: string }
  limitations: string[]
}
export interface MarketBriefProjection {
  schema: 'dsh.radar.market-brief.v1'
  briefRef: string
  digest: string
  policyRevision: string
  generatedAt: string
  timezone: string
  window: { start: string; end: string }
  status: 'empty' | 'degraded'
  main: MarketSignalProjection[]
  watching: MarketSignalProjection[]
  remaining: number
  filtered: boolean
  correctionCount: number
  limitations: string[]
  coverage: { sourceRef: string; health: string; qualified: boolean; reasons: string[] }[]
}
export interface MarketReaderProjection {
  schema: 'dsh.radar.market-reader.v1'
  readerRef: 'local'
  revision: number
  policyRevision: string
}
export interface MarketCatchupProjection {
  schema: 'dsh.radar.market-catchup.v1'
  readerRevision: number
  policyRevision: string
  window: { start: string; end: string }
  signals: MarketSignalProjection[]
  nextCursor: string | null
  historyLimited: boolean
  limitations: string[]
}
export interface MarketCompareSideProjection {
  signalRef: string; signalRevision: number; subjectRef: string; title: string; market: string; lifecycle: MarketSignalProjection['lifecycle']
  identity: { status: 'verified_same_work' | 'candidate' | 'unmapped' | 'not_established'; canonicalRef: string | null }
  observations: { observationRef: string; title: string; market: string; observedAt: string; sourceRef: string; sourceRevision: number; platform: string; samplingScope: string; facts: unknown[]; evidenceRefs: string[]; origin: 'fixture' | 'manual' | 'live' }[]
}
export interface MarketCompareProjection {
  schema: 'dsh.radar.market-compare.v1'; policyRevision: string; sides: [MarketCompareSideProjection, MarketCompareSideProjection]
  identityRelation: 'verified_same_work' | 'not_established'; presentation: 'side_by_side'; sharedNumericAxis: false; causalInference: false; limitations: string[]
}
export interface MarketEvidenceProjection {
  evidenceRef: string
  sourceRef: string
  observedAt: string
  summary: string
  origin: 'fixture' | 'manual' | 'live'
  limitations: string[]
}

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('market_contract_mismatch')
  return input as Record<string, unknown>
}
function ref(input: unknown): string {
  if (typeof input !== 'string' || !isSafeRadarRef(input)) throw new Error('market_unsafe_ref')
  return input
}
function revision(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 1) throw new Error('market_contract_mismatch')
  return input
}
function instant(input: unknown): string {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input) ||
    !Number.isFinite(Date.parse(input)) || new Date(input).toISOString() !== input.replace(/(?<!\.\d{3})Z$/, '.000Z')) throw new Error('market_contract_mismatch')
  return input
}
function text(input: unknown): string {
  if (typeof input !== 'string' || input.length > 500) throw new Error('market_contract_mismatch')
  // Source text stays text; never pass credential-like content, URLs or paths
  // into the browser. Unknown owner fields are omitted, not recursively copied.
  if (/https?:\/\/|file:\/\/|(?:^|\s)\/[\w.-]+\/|[A-Za-z]:\\|(?:authorization|cookie|password|secret|token)\s*[:=]|-----BEGIN/i.test(input)) return '[redacted]'
  return input
}
function list<T>(input: unknown, max: number, map: (value: unknown) => T): T[] {
  if (!Array.isArray(input) || input.length > max) throw new Error('market_contract_mismatch')
  return input.map(map)
}
function number(input: unknown, count = false): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || (count && (!Number.isSafeInteger(input) || input < 0))) throw new Error('market_contract_mismatch')
  return input
}
function window(input: unknown) {
  const row = object(input)
  const start = instant(row.start), end = instant(row.end)
  if (Date.parse(start) >= Date.parse(end)) throw new Error('market_contract_mismatch')
  return { start, end }
}
function comparison(input: unknown): MarketComparisonProjection | null {
  if (input === null) return null
  const row = object(input)
  if (row.comparable !== true) throw new Error('market_contract_mismatch')
  return { comparisonKey: ref(row.comparison_key), before: number(row.before), after: number(row.after), change: number(row.change),
    percentChange: row.percent_change === null ? null : number(row.percent_change), window: window(row.window), limitations: list(row.limitations, 20, text) }
}
function marketCompareSide(input: unknown): MarketCompareSideProjection {
  const row = object(input)
  const identity = object(row.identity)
  if (!['verified_same_work', 'candidate', 'unmapped', 'not_established'].includes(String(identity.mapping_status)) ||
    (identity.canonical_work_ref !== null && typeof identity.canonical_work_ref !== 'string')) throw new Error('market_contract_mismatch')
  const observations = list(row.observations, 10, input => {
    const observation = object(input)
    if (!['fixture', 'manual', 'live'].includes(String(observation.origin)) || typeof observation.platform !== 'string' ||
      typeof observation.sampling_scope !== 'string') throw new Error('market_contract_mismatch')
    return { observationRef: ref(observation.observation_ref), title: text(observation.original_title), market: text(observation.market),
      observedAt: instant(observation.observed_at), sourceRef: ref(observation.source_ref), sourceRevision: revision(observation.source_revision),
      platform: text(observation.platform), samplingScope: text(observation.sampling_scope), facts: list(observation.facts, 20, value => {
        const serialized = JSON.stringify(value)
        if (serialized.length > 1000 || /https?:\/\/|authorization|cookie|password|secret|token/i.test(serialized)) throw new Error('market_contract_mismatch')
        return value
      }),
      evidenceRefs: list(observation.evidence_refs, 100, ref), origin: observation.origin as 'fixture' | 'manual' | 'live' }
  })
  return { signalRef: ref(row.signal_ref), signalRevision: revision(row.signal_revision), subjectRef: ref(row.subject_ref),
    title: text(row.title), market: text(row.market), lifecycle: row.lifecycle as MarketSignalProjection['lifecycle'],
    identity: { status: identity.mapping_status as MarketCompareSideProjection['identity']['status'], canonicalRef: identity.canonical_work_ref as string | null }, observations }
}
export function projectMarketCompare(input: unknown): MarketCompareProjection {
  const row = object(input)
  const policyRevision = ref(row.policy_revision)
  const sides = list(row.sides, 2, marketCompareSide)
  if (sides.length !== 2 || row.spec !== 'radar.market_cross_market.v1' || row.presentation !== 'side_by_side' || row.shared_numeric_axis !== false || row.causal_inference !== false ||
    !['verified_same_work', 'not_established'].includes(String(row.identity_relation))) throw new Error('market_contract_mismatch')
  return { schema: 'dsh.radar.market-compare.v1', policyRevision, sides: sides as [MarketCompareSideProjection, MarketCompareSideProjection],
    identityRelation: row.identity_relation as 'verified_same_work' | 'not_established', presentation: 'side_by_side', sharedNumericAxis: false, causalInference: false,
    limitations: list(row.limitations, 20, text) }
}
export function projectMarketReader(input: unknown): MarketReaderProjection {
  const row = object(input)
  if (row.spec !== 'radar.market_reader.v1' || row.reader_ref !== 'local') throw new Error('market_contract_mismatch')
  return { schema: 'dsh.radar.market-reader.v1', readerRef: 'local', revision: revision(row.revision), policyRevision: ref(row.policy_revision) }
}
export function projectMarketCatchup(input: unknown): MarketCatchupProjection {
  const row = object(input)
  if (row.spec !== 'radar.market_catchup.v1' || typeof row.history_limited !== 'boolean' ||
    (row.next_cursor !== null && (typeof row.next_cursor !== 'string' || row.next_cursor.length < 1 || row.next_cursor.length > 2048 ||
      !/^[A-Za-z0-9_-]+$/.test(row.next_cursor)))) throw new Error('market_contract_mismatch')
  const policyRevision = ref(row.policy_revision)
  const signals = list(row.signals, 100, signal => projectMarketSignal(signal, policyRevision))
  if (new Set(signals.map(signal => signal.signalRef)).size !== signals.length) throw new Error('market_contract_mismatch')
  return { schema: 'dsh.radar.market-catchup.v1', readerRevision: revision(row.reader_revision), policyRevision,
    window: window(row.window), signals, nextCursor: row.next_cursor as string | null,
    historyLimited: row.history_limited, limitations: list(row.limitations, 20, text) }
}
export function projectMarketSignal(input: unknown, policyRevision: string): MarketSignalProjection {
  const row = object(input)
  const claims = ['newly_observed', 'metric_changed', 'rank_changed', 'placement_changed', 'correction']
  const states = ['active', 'retracted', 'inconclusive', 'cooled']
  if (row.spec !== 'radar.market_signal.v1' || !claims.includes(String(row.claim_kind)) || !states.includes(String(row.lifecycle)) ||
    !['fixture', 'manual', 'live'].includes(String(row.origin)) || !['observed', 'confirmed'].includes(String(row.assertion_level)) ||
    typeof row.market !== 'string' || !/^(?:[A-Z]{2}|global|unknown)$/.test(row.market)) throw new Error('market_contract_mismatch')
  return { schema: MARKET_PROJECTION_SCHEMA, signalRef: ref(row.signal_ref), revision: revision(row.revision), policyRevision: ref(policyRevision),
    title: text(row.title), market: row.market, observedAt: instant(row.observed_at), claimKind: String(row.claim_kind),
    sourceRef: ref(row.source_ref), origin: row.origin as MarketSignalProjection['origin'], assertionLevel: row.assertion_level as MarketSignalProjection['assertionLevel'],
    comparison: comparison(row.comparison), lifecycle: row.lifecycle as MarketSignalProjection['lifecycle'], evidenceRefs: list(row.evidence_refs, 100, ref), limitations: list(row.limitations, 20, text) }
}
export function projectMarketBrief(input: unknown): MarketBriefProjection {
  const row = object(input)
  if (row.spec !== 'radar.market_brief.v1' || !['empty', 'degraded'].includes(String(row.status)) ||
    typeof row.filtered !== 'boolean' || typeof row.timezone !== 'string' || row.timezone.length > 80) throw new Error('market_contract_mismatch')
  try { new Intl.DateTimeFormat('en', { timeZone: row.timezone }) } catch { throw new Error('market_contract_mismatch') }
  const policyRevision = ref(row.policy_revision)
  const main = list(row.main, 5, s => projectMarketSignal(s, policyRevision))
  const watching = list(row.watching, 2, s => projectMarketSignal(s, policyRevision))
  if (new Set([...main, ...watching].map(s => s.signalRef)).size !== main.length + watching.length) throw new Error('market_contract_mismatch')
  const coverage = object(row.coverage)
  if (coverage.spec !== 'radar.market_source_gaps.v1') throw new Error('market_contract_mismatch')
  return { schema: 'dsh.radar.market-brief.v1', briefRef: ref(row.brief_ref), digest: ref(row.digest), policyRevision,
    generatedAt: instant(row.generated_at), timezone: row.timezone, window: window(row.window), status: row.status as MarketBriefProjection['status'],
    main, watching, remaining: number(row.remaining, true), filtered: row.filtered, correctionCount: number(row.correction_count, true),
    limitations: list(row.limitations, 20, text), coverage: list(coverage.sources, 100, input => {
      const source = object(input)
      if (typeof source.qualified !== 'boolean' || !['fresh', 'stale', 'partial', 'unavailable', 'freshness_unknown'].includes(String(source.health))) throw new Error('market_contract_mismatch')
      return { sourceRef: ref(source.source_ref), health: String(source.health), qualified: source.qualified, reasons: list(source.reasons, 20, ref) }
    }) }
}
export function projectMarketEvidence(input: unknown): MarketEvidenceProjection {
  const row = object(input)
  if (!['fixture', 'manual', 'live'].includes(String(row.origin))) throw new Error('market_contract_mismatch')
  return { evidenceRef: ref(row.evidence_ref), sourceRef: ref(row.source_ref), observedAt: instant(row.observed_at),
    summary: text(row.summary), origin: row.origin as MarketEvidenceProjection['origin'], limitations: list(row.limitations, 20, text) }
}

/** Validate the response against the user's exact selection before exposing it. */
export function projectSelectedMarketSignal(input: unknown, selection: { signalRef: string; revision: number }, policyRevision: string): MarketSignalProjection {
  const selectedRef = ref(selection.signalRef), selectedRevision = revision(selection.revision)
  const projected = projectMarketSignal(input, policyRevision)
  if (projected.signalRef !== selectedRef || projected.revision !== selectedRevision) throw new Error('market_selection_mismatch')
  return projected
}

export function projectSelectedMarketEvidence(input: unknown, signal: MarketSignalProjection, evidenceRef: string): MarketEvidenceProjection {
  const selected = ref(evidenceRef)
  if (!signal.evidenceRefs.includes(selected)) throw new Error('market_evidence_not_attached')
  const evidence = projectMarketEvidence(input)
  if (evidence.evidenceRef !== selected) throw new Error('market_selection_mismatch')
  // Cross-source correction evidence is valid when the owner explicitly links
  // it. Do not infer identity or reject it just because the publisher differs.
  return evidence
}

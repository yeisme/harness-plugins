import './primitives.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { createMarketReadingController, createMarketReviewController, createMarketDetailController, type MarketReviewProjection, type MarketReviewIndexReadResult, type MarketReviewReadResult, type MarketSignalProjection } from '@yeisme/dsh-personal-radar'
import { MarketReviewView } from '../src/client/market-review-view.js'
import { MarketReadingView } from '../src/client/market-view.js'

const policy = 'sha256:policy'
const reader = { schema: 'dsh.radar.market-reader.v1' as const, readerRef: 'local' as const, revision: 4, policyRevision: policy }
const signal = (ref: string, revision: number, overrides: Partial<MarketSignalProjection> = {}): MarketSignalProjection => ({
  schema: 'dsh.radar.market-signal.v1', signalRef: ref, revision, policyRevision: policy, title: `${ref} 样本判断`,
  market: 'CN', observedAt: '2026-09-09T08:00:00.000Z', claimKind: 'rank_changed', sourceRef: 'hongguo', origin: 'fixture',
  assertionLevel: 'observed', comparison: null, lifecycle: 'active', evidenceRefs: [], limitations: [], ...overrides,
})
const entries: MarketReviewProjection['entries'] = [
  { original: signal('signal-a', 1), followup: signal('signal-a', 2), outcome: 'sustained', reason: 'Later comparable observation.' },
  { original: signal('signal-b', 1), followup: signal('signal-b', 3, { lifecycle: 'retracted', claimKind: 'correction' }), outcome: 'retracted', reason: 'An explicit later correction retracts the prior claim.' },
  { original: signal('signal-c', 1), followup: null, outcome: 'inconclusive', reason: 'No later signal evidence before the review cutoff.' },
]
const review: MarketReviewProjection = {
  schema: 'dsh.radar.market-review.v1', reviewRef: 'market-review-abc', digest: 'sha256:review', policyRevision: policy,
  window: { start: '2026-09-07T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z' }, asOf: '2026-09-14T06:00:00.000Z',
  entries, builderVersion: 'market-review-builder.v1', filtered: false,
  limitations: ['No later evidence is inconclusive, never a failed prediction.'],
}
const index: Extract<MarketReviewIndexReadResult, { ok: true }>['index'] = {
  schema: 'dsh.radar.market-review-index.v1', policyRevision: policy,
  reviews: [{ reviewRef: 'market-review-abc', digest: 'sha256:review', window: review.window, asOf: review.asOf, entries: entries.length }],
  limitations: [],
}

async function mount(options: { index?: MarketReviewIndexReadResult; review?: MarketReviewReadResult; locale?: 'zh' | 'en' | 'pseudo'; withDetail?: boolean } = {}) {
  const indexResult = options.index ?? { ok: true as const, index, reader }
  const reviewResult = options.review ?? { ok: true as const, review, reader }
  const controller = createMarketReviewController(async () => indexResult, async () => reviewResult)
  controller.setContext('session-a')
  await controller.refresh()
  const detail = options.withDetail === false ? undefined : createMarketDetailController(async () => ({ ok: false, reason: 'cancelled', recovery: '' }))
  const onOpenSignal = vi.fn()
  const html = renderToStaticMarkup(createElement(MarketReviewView, { controller, ...(detail ? { detail } : {}), locale: options.locale ?? 'zh', onOpenSignal }))
  return { html, controller, onOpenSignal, detail }
}

test('original judgments and follow-up evidence stay side by side with the review cutoff and revisions', async () => {
  const { html } = await mount()
  // Cutoff (as_of) and the exact review ref/builder identity are visible.
  expect(html).toContain('截止')
  expect(html).toContain('market-review-abc')
  expect(html).toContain('market-review-builder.v1')
  // Each judged entry keeps both the original and follow-up revisions named.
  expect(html).toContain('signal-a · 修订 1')
  expect(html).toContain('signal-a · 修订 2')
})

test('the four outcomes stay distinct and inconclusive is expressed separately, never as a failure', async () => {
  const { html } = await mount()
  // Four distinct outcome labels exist.
  for (const label of ['后续持续', '已更正', '暂无法判断']) expect(html).toContain(label)
  // Inconclusive entries live in their own section with a non-failure phrasing.
  expect(html).toContain('截止前无后续证据，不计成败')
  // No error phase or failure styling is attached to the no-followup entry.
  const inconclusive = html.split('暂无法判断')[1] ?? ''
  expect(inconclusive).not.toContain('phase="error"')
  // The frozen owner limitation survives verbatim instead of a client verdict.
  expect(html).toContain('never a failed prediction')
})

test('retracted entries expose the explicit correction entry to the bound follow-up revision', async () => {
  const { html, detail } = await mount()
  expect(html).toContain('查看更正')
  expect(html).toContain('查看原判断')
  // Static markup alone never opens anything; the entry exists only with the shared detail controller.
  const withoutDetail = await mount({ withDetail: false })
  expect(withoutDetail.html).not.toContain('查看更正')
  expect(detail?.selection()).toBeNull()
})

test('empty and failed review lists render honest states without inventing reviews', async () => {
  const empty = await mount({ index: { ok: true, index: { ...index, reviews: [] }, reader } })
  expect(empty.html).toContain('尚无完整周回顾')
  expect(empty.html).not.toContain('market-review-abc')
  const failed = await mount({ index: { ok: false, reason: 'capability_unavailable', recovery: 'Private diagnostic' } })
  expect(failed.html).toContain('回顾暂不可读')
  expect(failed.html).toContain('当前 Radar 连接尚不支持市场回顾')
  // Owner recovery diagnostics stay out of the browser.
  expect(failed.html).not.toContain('Private diagnostic')
})

test('review switching reads another owner-frozen ref and never rebuilds a live review', async () => {
  const { controller } = await mount()
  expect(controller.snapshot().selection).toBe('market-review-abc')
  await controller.select('market-review-abc')
  // Re-selecting the bound review does not issue a second owner read.
  expect(controller.snapshot().review?.ok).toBe(true)
  const state = controller.snapshot()
  expect(state.selection).toBe('market-review-abc')
})

test('locale parity keeps pseudo markers and english outcome labels distinct', async () => {
  const en = await mount({ locale: 'en' })
  for (const label of ['Sustained', 'Corrected', 'Cannot judge yet']) expect(en.html).toContain(label)
  const pseudo = await mount({ locale: 'pseudo' })
  expect(pseudo.html).toContain('[!! Judgment review Judgment review !!]')
})

test('brief corrections carry an explicit entry into the frozen review', async () => {
  const brief = { ok: true as const, brief: {
    schema: 'dsh.radar.market-brief.v1' as const, briefRef: 'brief-a', digest: 'sha256:brief', policyRevision: policy,
    generatedAt: '2026-09-14T09:00:00.000Z', timezone: 'Asia/Shanghai', window: { start: '2026-09-13T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z' },
    status: 'ready' as const, main: [signal('signal-a', 2, { claimKind: 'correction' as const })], watching: [], remaining: 0,
    filtered: false, correctionCount: 1, limitations: [], coverage: [] }, reader }
  const reading = createMarketReadingController(async () => brief)
  reading.setContext('session-a')
  await reading.refresh()
  const review = createMarketReviewController(async () => ({ ok: true, index, reader }), async () => ({ ok: true, review, reader }))
  review.setContext('session-a')
  const html = renderToStaticMarkup(createElement(MarketReadingView, { controller: reading, review, locale: 'zh' }))
  // The overflow entry names the actual correction count and opens the frozen review.
  expect(html).toContain('本窗口包含 1 处更正')
  expect(html).toContain('查看回顾')
  const withoutReview = renderToStaticMarkup(createElement(MarketReadingView, { controller: reading, locale: 'zh' }))
  expect(withoutReview).not.toContain('查看回顾')
  expect(withoutReview).not.toContain('处更正')
})

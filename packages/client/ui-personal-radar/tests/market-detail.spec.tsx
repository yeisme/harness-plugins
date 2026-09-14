import './primitives.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import {
  createMarketDetailController,
  createMarketEvidenceTimelineController,
  createMarketReadingController,
  type MarketEvidenceReadResult,
  type MarketSignalReadResult,
  type MarketSignalProjection,
} from '@yeisme/dsh-personal-radar'
import { MarketDetailView } from '../src/client/market-detail-view.js'
import { MarketReadingView } from '../src/client/market-view.js'

const reader = { schema: 'dsh.radar.market-reader.v1' as const, readerRef: 'local' as const, revision: 4, policyRevision: 'sha256:policy' }
const signal: MarketSignalProjection = {
  schema: 'dsh.radar.market-signal.v1', signalRef: 'signal-a', revision: 2, policyRevision: 'sha256:policy',
  title: '原名保留的样本信号', market: 'CN', observedAt: '2026-09-13T08:00:00.000Z', claimKind: 'metric_changed',
  sourceRef: 'hongguo', origin: 'fixture', assertionLevel: 'corroborated',
  comparison: { comparisonKey: 'sha256:cmp', before: 20, after: 5, change: -15, percentChange: -75,
    window: { start: '2026-09-11T00:00:00.000Z', end: '2026-09-13T00:00:00.000Z' }, limitations: ['Same sampled scope only'] },
  lifecycle: 'active', evidenceRefs: ['evidence-a', 'evidence-b'], limitations: ['Synthetic sample only.'],
}
const evidencePayload = (evidenceRef: string) => ({
  evidenceRef, sourceRef: 'hongguo', observedAt: '2026-09-13T08:00:00.000Z',
  summary: '目录样本摘要', origin: 'fixture' as const, policyRevision: 'sha256:policy', limitations: ['Synthetic fixture.'],
})

function detailFixture(result: MarketSignalReadResult) {
  const controller = createMarketDetailController(async () => result)
  controller.setContext('session-a')
  return controller
}

test('the detail view shows the original name, metric window and limits with a revision-bound evidence timeline', async () => {
  const detail = detailFixture({ ok: true, signal, reader })
  await detail.select({ signalRef: 'signal-a', revision: 2 })
  const evidence = createMarketEvidenceTimelineController(async () => { throw new Error('not read in this render') })
  evidence.setContext('session-a')
  evidence.setSelection({ signalRef: 'signal-a', revision: 2 })
  const html = renderToStaticMarkup(createElement(MarketDetailView, { controller: detail, locale: 'zh', onClose: () => {}, evidence }))
  expect(html).toContain('原名保留的样本信号')
  expect(html).toContain('signal-a · 修订 2')
  expect(html).toContain('20 → 5 (-15)')
  expect(html).toContain('Synthetic sample only.')
  // Every attached evidence ref is listed with an explicit read action.
  expect(html).toContain('证据时间线')
  expect(html).toContain('evidence-a')
  expect(html).toContain('evidence-b')
  expect((html.match(/读取证据/g) ?? []).length).toBe(2)
  // No raw URLs or anchors ever reach the browser surface.
  expect(html).not.toContain('href=')
  expect(html).not.toContain('https://')
})

test('evidence entries load through the timeline controller with named failures and no cross-selection reads', async () => {
  const requests: Array<{ contextRef: string; selection: { signalRef: string; revision: number }; evidenceRef: string }> = []
  const evidence = createMarketEvidenceTimelineController(async (contextRef, selection, evidenceRef): Promise<MarketEvidenceReadResult> => {
    requests.push({ contextRef, selection: { ...selection }, evidenceRef })
    // The real host seam maps the owner code before returning; emulate that.
    if (evidenceRef === 'evidence-b') return { ok: false, reason: 'reference_unavailable', recovery: 'The evidence is not attached to this revision.' }
    return { ok: true, evidence: evidencePayload(evidenceRef), reader }
  })
  evidence.setContext('session-a')
  evidence.setSelection({ signalRef: 'signal-a', revision: 2 })
  await evidence.load('evidence-a')
  // A double click while loaded never re-reads the owner.
  await evidence.load('evidence-a')
  await evidence.load('evidence-b')
  expect(requests).toHaveLength(2)
  expect(requests.every(request => request.selection.signalRef === 'signal-a' && request.selection.revision === 2)).toBe(true)
  const snapshot = evidence.snapshot()
  expect(snapshot.entries['evidence-a']).toMatchObject({ state: 'loaded', result: { ok: true, evidence: { evidenceRef: 'evidence-a' } } })
  expect(snapshot.entries['evidence-b']).toMatchObject({ state: 'failed', result: { ok: false, reason: 'reference_unavailable' } })
  // A late response for the previous selection must not attach to a new one.
  let release!: (value: MarketEvidenceReadResult) => void
  const late = createMarketEvidenceTimelineController(() => new Promise(resolve => { release = resolve }))
  late.setContext('session-a')
  late.setSelection({ signalRef: 'signal-a', revision: 2 })
  const pending = late.load('evidence-a')
  late.setSelection({ signalRef: 'signal-b', revision: 1 })
  release({ ok: true, evidence: evidencePayload('evidence-a'), reader })
  await pending
  expect(late.snapshot().entries['evidence-a']).toBeUndefined()
  expect(late.snapshot().selection).toEqual({ signalRef: 'signal-b', revision: 1 })
})

test('the evidence timeline renders loaded summaries and the disabled source-open reason, never a raw URL', async () => {
  const detail = detailFixture({ ok: true, signal, reader })
  await detail.select({ signalRef: 'signal-a', revision: 2 })
  const evidence = createMarketEvidenceTimelineController(async (_context, _selection, evidenceRef) =>
    ({ ok: true, evidence: evidencePayload(evidenceRef), reader }))
  evidence.setContext('session-a')
  evidence.setSelection({ signalRef: 'signal-a', revision: 2 })
  await evidence.load('evidence-a')
  const html = renderToStaticMarkup(createElement(MarketDetailView, { controller: detail, locale: 'zh', onClose: () => {}, evidence }))
  expect(html).toContain('目录样本摘要')
  expect(html).toContain('2026/09/13 08:00')
  // Without a host safe-open seam the action is disabled with the stable
  // reason; the safe summary stays visible.
  expect(html).toContain('source_open_unavailable')
  expect(html).toContain('disabled')
  expect(html).not.toContain('href=')

  const opened: string[] = []
  const withSeam = renderToStaticMarkup(createElement(MarketDetailView, { controller: detail, locale: 'zh', onClose: () => {}, evidence,
    openSource: async contextRef => { opened.push(contextRef); return { ok: true } } }))
  expect(withSeam).not.toContain('source_open_unavailable')
  expect(withSeam.match(/<button[^>]*disabled[^>]*>/g) ?? []).toHaveLength(0)
})

test('closing the detail returns to the same list position with the original focus target intact', async () => {
  // The list keeps every per-signal 打开详情 trigger mounted while the detail
  // overlays it; closing clears the selection and the browser suite restores
  // focus onto exactly this trigger (visual-market detail navigation case).
  const brief = {
    schema: 'dsh.radar.market-brief.v1' as const, briefRef: 'brief-a', digest: 'sha256:brief', policyRevision: 'sha256:policy',
    generatedAt: '2026-09-13T09:00:00.000Z', timezone: 'UTC',
    window: { start: '2026-09-12T00:00:00.000Z', end: '2026-09-13T00:00:00.000Z' },
    status: 'ready' as const, main: [signal], watching: [], remaining: 0, filtered: false, correctionCount: 0,
    limitations: [], coverage: [],
  }
  const reading = createMarketReadingController(async () => ({ ok: true, brief, reader }))
  reading.setContext('session-a')
  await reading.refresh()
  const list = createMarketDetailController(async () => ({ ok: true, signal, reader }))
  list.setContext('session-a')
  const renderList = () => renderToStaticMarkup(createElement(MarketReadingView, { controller: reading, detail: list, locale: 'zh' }))
  const before = renderList()
  await list.select({ signalRef: 'signal-a', revision: 2 })
  list.close()
  const after = renderList()
  // Same row, same order, same trigger: the return-focus target never moved.
  expect(after).toContain('原名保留的样本信号')
  expect(after.indexOf('打开详情')).toBe(before.indexOf('打开详情'))
  expect(list.selection()).toBeNull()
})

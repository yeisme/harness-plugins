import './primitives.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { createMarketReadingController, type MarketBriefProjection, type MarketSignalProjection } from '@yeisme/dsh-personal-radar'
import { MarketReadingView } from '../src/client/market-view.js'

const signal = (index: number, overrides: Partial<MarketSignalProjection> = {}): MarketSignalProjection => ({
  schema: 'dsh.radar.market-signal.v1', signalRef: `signal-${index}`, revision: index, policyRevision: 'sha256:policy',
  title: `样本信号 ${index}：跨市场对照长标题测试`, market: index % 2 === 0 ? 'CN' : 'US',
  observedAt: `2026-09-12T0${index}:00:00.000Z`, claimKind: index === 5 ? 'correction' : 'metric_changed',
  sourceRef: `source-${index}`, origin: 'fixture', assertionLevel: 'confirmed', comparison: null,
  lifecycle: 'active', evidenceRefs: [`evidence-${index}`], limitations: ['Synthetic sample only.'], ...overrides,
})
const reader = { schema: 'dsh.radar.market-reader.v1' as const, readerRef: 'local' as const, revision: 7, policyRevision: 'sha256:policy' }
const briefOf = (overrides: Partial<MarketBriefProjection> = {}): MarketBriefProjection => ({
  schema: 'dsh.radar.market-brief.v1', briefRef: 'brief-reading', digest: 'sha256:brief', policyRevision: 'sha256:policy',
  generatedAt: '2026-09-13T09:00:00.000Z', timezone: 'Asia/Shanghai',
  window: { start: '2026-09-12T01:00:00.000Z', end: '2026-09-13T01:00:00.000Z' },
  status: 'ready', main: [1, 2, 3, 4, 5].map(index => signal(index)), watching: [signal(6), signal(7)],
  remaining: 3, filtered: false, correctionCount: 1, limitations: ['Synthetic fixture'], coverage: [
    { sourceRef: 'hongguo', health: 'unavailable', qualified: false, reasons: ['identity_evidence_missing'] },
    { sourceRef: 'reelshort', health: 'fresh', qualified: true, reasons: [] },
  ], ...overrides,
})

async function renderBrief(brief: MarketBriefProjection | null, failure?: { reason: 'brief_absent' }) {
  const controller = createMarketReadingController(async () => brief
    ? { ok: true, brief, reader }
    : { ok: false, reason: failure?.reason ?? 'brief_absent', recovery: 'Private diagnostic' })
  controller.setContext('session-a')
  await controller.refresh()
  return renderToStaticMarkup(createElement(MarketReadingView, { controller, locale: 'zh' }))
}

test('the daily brief keeps the owner 5+2 bounds, order, dates, timezone and coverage gaps visible', async () => {
  const html = await renderBrief(briefOf())
  const titles = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match => match[1])
  // Owner order is preserved: exactly the 5 main entries first, then the 2
  // watching entries, never re-sorted or supplemented by the client.
  expect(titles).toEqual([...[1, 2, 3, 4, 5].map(index => `样本信号 ${index}：跨市场对照长标题测试`),
    '样本信号 6：跨市场对照长标题测试', '样本信号 7：跨市场对照长标题测试'])
  // Window dates and the declared timezone stay visible, not a refresh time.
  expect(html).toContain('Asia/Shanghai')
  expect(html).toMatch(/dateTime="2026-09-12T01:00:00.000Z"/)
  expect(html).toMatch(/dateTime="2026-09-13T01:00:00.000Z"/)
  // Coverage gaps keep their owner reason; a qualified source is shown too.
  expect(html).toContain('来源身份待核验')
  expect(html).toContain('reelshort')
  // Out-of-brief remainder is counted, not silently dropped.
  expect(html).toContain('其他信号')
})

test('a full ready brief renders corrections, limitations and evidence refs without client reordering', async () => {
  // Deliberately non-monotonic array order AND observed times: whatever order
  // the owner chose is the display order; the client must not re-sort by
  // time, revision or claim kind.
  const shuffled = briefOf({
    main: [signal(2, { observedAt: '2026-09-12T03:00:00.000Z' }),
      signal(4, { observedAt: '2026-09-12T01:00:00.000Z' }),
      signal(1, { observedAt: '2026-09-12T09:00:00.000Z', claimKind: 'correction', lifecycle: 'retracted' }),
      signal(5, { observedAt: '2026-09-12T05:00:00.000Z' }),
      signal(3, { observedAt: '2026-09-12T07:00:00.000Z' })],
  })
  const html = await renderBrief(shuffled)
  const titles = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match => match[1])
  const position = (index: number) => titles.findIndex(title => title.includes(`样本信号 ${index}：`))
  expect(position(4)).toBeLessThan(position(1))
  expect(position(1)).toBeLessThan(position(3))
  expect(titles).toHaveLength(7)
  expect(html).toContain('判断更正')
  expect(html).toContain('Synthetic sample only.')
  expect(html).toContain('证据引用: evidence-1')
})

test('no significant changes (empty) stays distinct from no completed brief (absent)', async () => {
  const empty = await renderBrief(briefOf({ status: 'empty', main: [], watching: [], remaining: 0 }))
  // A legal empty edition keeps the window and coverage; it is NOT absent.
  expect(empty).toContain('本窗口暂无重大变化')
  expect(empty).toContain('Asia/Shanghai')
  expect(empty).toContain('来源身份待核验')
  expect(empty).not.toContain('尚无已完成简报')

  const absent = await renderBrief(null)
  expect(absent).toContain('尚无已完成简报')
  expect(absent).not.toContain('本窗口暂无重大变化')
  // Owner recovery text stays host-side; the empty projection never echoes it.
  expect(absent).not.toContain('Private diagnostic')
})

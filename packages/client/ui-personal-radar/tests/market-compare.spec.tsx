import './primitives.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { createMarketCompareController, type MarketCompareProjection, type MarketSignalProjection } from '@yeisme/dsh-personal-radar'
import { MarketCompareView } from '../src/client/market-compare-view.js'

const reader = { schema: 'dsh.radar.market-reader.v1' as const, readerRef: 'local' as const, revision: 4, policyRevision: 'sha256:policy' }
const signal: MarketSignalProjection = {
  schema: 'dsh.radar.market-signal.v1', signalRef: 'signal-a', revision: 2, policyRevision: 'sha256:policy',
  title: '左侧样本信号', market: 'unknown', observedAt: '2026-09-13T08:00:00.000Z', claimKind: 'cross_market_observed',
  sourceRef: 'hongguo', origin: 'fixture', assertionLevel: 'observed', comparison: null,
  lifecycle: 'active', evidenceRefs: ['evidence-a'], limitations: [],
}
const side = (index: 'left' | 'right', overrides: Partial<MarketCompareProjection['sides'][number]> = {}): MarketCompareProjection['sides'][number] => ({
  signalRef: `signal-${index}`, signalRevision: 2, subjectRef: `work-${index}`, title: `${index === 'left' ? '左侧原名样本' : '右侧原名样本'}`,
  market: index === 'left' ? 'unknown' : 'US', lifecycle: 'active',
  identity: { status: 'candidate', canonicalRef: null },
  observations: [{ observationRef: `observation-${index}`, title: `${index} 观测`, market: index === 'left' ? 'unknown' : 'US',
    observedAt: '2026-09-12T08:00:00.000Z', sourceRef: `source-${index}`, sourceRevision: 1, platform: `platform-${index}`,
    samplingScope: `scope-${index}`, facts: [], evidenceRefs: [], origin: 'fixture' }], ...overrides,
})
const compare = (overrides: Partial<MarketCompareProjection> = {}): MarketCompareProjection => ({
  schema: 'dsh.radar.market-compare.v1', policyRevision: 'sha256:policy', sides: [side('left'), side('right')],
  identityRelation: 'not_established', presentation: 'side_by_side', sharedNumericAxis: false, causalInference: false,
  limitations: ['Different source scopes.'], ...overrides,
})

async function renderCompare(result: { ok: true; compare: MarketCompareProjection; reader: typeof reader } | { ok: false; reason: 'reference_unavailable'; recovery: string }) {
  const controller = createMarketCompareController(async () => result)
  controller.setContext('session-a')
  if (result.ok) await controller.select({ signalRef: 'signal-left', revision: 2 }, { signalRef: 'signal-right', revision: 2 })
  else await controller.select({ signalRef: 'signal-left', revision: 2 }, { signalRef: 'signal-missing', revision: 7 })
  return renderToStaticMarkup(createElement(MarketCompareView, { controller, locale: 'zh', onClose: () => {} }))
}

test('one missing side never renders a half comparison as if it were complete', async () => {
  // The owner could not resolve one selection: the view shows the honest
  // unavailable state instead of silently comparing the surviving side.
  const html = await renderCompare({ ok: false, reason: 'reference_unavailable', recovery: 'Private diagnostic' })
  expect(html).toContain('对照暂不可用')
  expect(html).not.toContain('ys-grid')
  expect(html).not.toContain('Private diagnostic')
})

test('unknown markets stay unknown per side and never get assigned to a country', async () => {
  const html = await renderCompare({ ok: true, compare: compare(), reader })
  expect((html.match(/<p>unknown ·/g) ?? []).length).toBe(1)
  expect((html.match(/<p>US ·/g) ?? []).length).toBe(1)
  // Candidate mapping is shown as mapping status, not merged into one work.
  expect(html).toContain('candidate')
})

test('different metrics stay in per-side columns with their own scopes and no shared axis claim', async () => {
  const html = await renderCompare({ ok: true, compare: compare(), reader })
  // Each side keeps its own platform and sampling scope text; the fixed
  // no-shared-axis / no-causal statement is always rendered.
  expect(html).toContain('platform-left · scope-left')
  expect(html).toContain('platform-right · scope-right')
  expect(html).toContain('两侧保留各自来源口径，不共用数值轴，也不作因果判断。')
  // No combined numeric axis element exists anywhere in the projection UI.
  expect(html).not.toContain('sharedNumericAxis')
  const sides = html.match(/<article[^>]*class="ys-row"[^>]*>/g) ?? []
  expect(sides).toHaveLength(2)
})

import './primitives.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { createMarketReadingController } from '@yeisme/dsh-personal-radar'
import { MarketReadingView } from '../src/client/market-view.js'

test('market Web face uses shared Surface and distinguishes absent from empty without raw errors', async () => {
  const controller = createMarketReadingController(async () => ({ ok: false, reason: 'brief_absent', recovery: 'Private diagnostic' }))
  controller.setContext('session-a')
  await controller.refresh()
  const html = renderToStaticMarkup(createElement(MarketReadingView, { controller, locale: 'zh' }))
  expect(html).toContain('data-yeisme-surface')
  expect(html).toContain('尚无已完成简报')
  expect(html).not.toContain('本窗口暂无重大变化')
  expect(html).not.toContain('Private diagnostic')
})
test('unconnected and pseudo locale states render accessible status rather than fake content', () => {
  const controller = createMarketReadingController(async () => ({ ok: false, reason: 'offline', recovery: 'Offline' }))
  const html = renderToStaticMarkup(createElement(MarketReadingView, { controller, locale: 'pseudo' }))
  expect(html).toContain('role="status"')
  expect(html).toContain('[!! Market changes Market changes !!]')
  expect(html).not.toContain('<article')
})

import './primitives.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { createMarketCatchupController } from '@yeisme/dsh-personal-radar'
import { MarketCatchupView } from '../src/client/market-catchup-view.js'

test.each([
  ['offline', 'Radar 已离线'], ['state_changed', '丢弃旧游标'], ['content_blocked', '内容禁区禁止读取'],
] as const)('catch-up explains %s without exposing raw owner errors', async (reason, expected) => {
  const controller = createMarketCatchupController(async () => ({ ok: false, reason, recovery: 'private diagnostic' }))
  controller.setContext('session-a')
  await controller.first()
  const html = renderToStaticMarkup(createElement(MarketCatchupView, { controller, locale: 'zh' }))
  expect(html).toContain(expected)
  expect(html).toContain('role="alert"')
  expect(html).not.toContain('private diagnostic')
  expect(html).not.toContain('本窗口没有未读变化')
})

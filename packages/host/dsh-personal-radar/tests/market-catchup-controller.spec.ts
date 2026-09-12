import { expect, test } from 'vitest'
import { createMarketCatchupController } from '../src/market-controller.js'
import type { MarketCatchupReadResult } from '../src/market-adapter.js'

function page(nextCursor: string | null): MarketCatchupReadResult {
  return { ok: true, reader: { schema: 'dsh.radar.market-reader.v1', readerRef: 'local', revision: 1, policyRevision: 'sha256:policy' },
    page: { schema: 'dsh.radar.market-catchup.v1', readerRevision: 1, policyRevision: 'sha256:policy',
      window: { start: '2026-09-01T00:00:00Z', end: '2026-09-11T00:00:00Z' }, signals: [], nextCursor,
      historyLimited: true, limitations: [] } }
}
test('empty continuation pages follow only owner cursors and stop at the final page', async () => {
  const cursors: (string | null)[] = []
  const controller = createMarketCatchupController(async (_context, cursor) => { cursors.push(cursor); return page(cursor === null ? 'next' : null) })
  controller.setContext('session-a')
  await controller.first(); await controller.next(); await controller.next()
  expect(cursors).toEqual([null, 'next'])
  controller.setContext('session-b')
  await controller.first()
  expect(cursors).toEqual([null, 'next', null])
})
test('double next does not duplicate reads and policy changes invalidate the pending page', async () => {
  let calls = 0, finish!: (result: MarketCatchupReadResult) => void
  const controller = createMarketCatchupController(async (_context, cursor) => {
    calls++
    return cursor === null ? page('next') : new Promise(resolve => { finish = resolve })
  })
  controller.setContext('session-a')
  await controller.first()
  const pending = controller.next()
  await controller.next()
  expect(calls).toBe(2)
  controller.invalidatePolicy()
  finish(page(null))
  await pending
  expect(controller.snapshot().result).toBeNull()
  await controller.first()
  expect(controller.snapshot().result).toMatchObject({ ok: true, page: { nextCursor: 'next' } })
})

import { expect, test } from 'vitest'
import { createMarketDetailController } from '../src/market-controller.js'
import type { MarketSignalReadResult } from '../src/market-adapter.js'

test('selecting another revision aborts the old detail and closing clears selection', async () => {
  const requests: { revision: number; signal: AbortSignal; resolve: (r: MarketSignalReadResult) => void }[] = []
  const controller = createMarketDetailController(async (_context, selection, signal) => new Promise(resolve => requests.push({ revision: selection.revision, signal, resolve })))
  controller.setContext('session-a')
  const first = controller.select({ signalRef: 'signal-a', revision: 1 })
  const second = controller.select({ signalRef: 'signal-a', revision: 2 })
  expect(requests[0].signal.aborted).toBe(true)
  requests[1].resolve({ ok: false, reason: 'reference_unavailable', recovery: 'Second' })
  await second
  requests[0].resolve({ ok: false, reason: 'offline', recovery: 'Old' })
  await first
  expect(controller.snapshot().result).toMatchObject({ reason: 'reference_unavailable' })
  expect(controller.selection()).toEqual({ signalRef: 'signal-a', revision: 2 })
  controller.close()
  expect(controller.selection()).toBeNull()
  expect(controller.snapshot().result).toBeNull()
})
test('policy changes remove pending detail and invalid selections never dispatch', async () => {
  let calls = 0, finish!: (r: MarketSignalReadResult) => void
  const controller = createMarketDetailController(async () => { calls++; return new Promise(resolve => { finish = resolve }) })
  controller.setContext('session-a')
  await expect(controller.select({ signalRef: '../unsafe', revision: 1 })).rejects.toThrow()
  expect(calls).toBe(0)
  const pending = controller.select({ signalRef: 'signal-a', revision: 1 })
  controller.invalidatePolicy()
  finish({ ok: false, reason: 'offline', recovery: 'Old' })
  await pending
  expect(controller.selection()).toBeNull()
  expect(controller.snapshot().result).toBeNull()
})

test('selection without an active context or after disposal leaves no retained selection', async () => {
  let calls = 0
  const controller = createMarketDetailController(async () => { calls++; return { ok: false, reason: 'offline', recovery: 'Offline' } })
  await controller.select({ signalRef: 'signal-a', revision: 1 })
  expect(controller.selection()).toBeNull()
  controller.setContext('session-a')
  controller.dispose()
  await controller.select({ signalRef: 'signal-a', revision: 2 })
  expect(controller.selection()).toBeNull()
  expect(calls).toBe(0)
})

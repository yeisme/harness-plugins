import { expect, test } from 'vitest'
import { createMarketReadingController } from '../src/market-controller.js'
import type { MarketReadResult } from '../src/market-adapter.js'

test('context changes clear content and discard out-of-order responses even if transport ignores abort', async () => {
  const pending: { ref: string; signal: AbortSignal; resolve: (r: MarketReadResult) => void }[] = []
  const controller = createMarketReadingController((ref, signal) => new Promise(resolve => pending.push({ ref, signal, resolve })))
  controller.setContext('session-a')
  const first = controller.refresh()
  controller.setContext('session-b')
  expect(pending[0].signal.aborted).toBe(true)
  expect(controller.snapshot().result).toBeNull()
  const second = controller.refresh()
  pending[1].resolve({ ok: false, reason: 'brief_absent', recovery: 'Current context' })
  await second
  pending[0].resolve({ ok: false, reason: 'offline', recovery: 'Old context' })
  await first
  expect(controller.snapshot().contextRef).toBe('session-b')
  expect(controller.snapshot().result).toMatchObject({ reason: 'brief_absent' })
  controller.invalidatePolicy()
  expect(controller.snapshot().result).toBeNull()
})
test('unmount cancels outstanding work and removes subscriptions without reloading', async () => {
  let finish!: (result: MarketReadResult) => void
  let signal!: AbortSignal
  const controller = createMarketReadingController((_ref, current) => { signal = current; return new Promise(resolve => { finish = resolve }) })
  let notifications = 0
  controller.subscribe(() => { notifications++ })
  controller.setContext('session-a')
  const pending = controller.refresh()
  const before = notifications
  controller.dispose()
  finish({ ok: false, reason: 'offline', recovery: 'Late' })
  await pending
  expect(signal.aborted).toBe(true)
  expect(notifications).toBe(before)
  expect(controller.snapshot()).toEqual({ contextRef: null, loading: false, result: null })
  await controller.refresh()
  expect(notifications).toBe(before)
})

test('loader-owned results cannot mutate accepted display state', async () => {
  const result: MarketReadResult = { ok: false, reason: 'offline', recovery: 'Original safe recovery' }
  const controller = createMarketReadingController(async () => result)
  controller.setContext('session-a')
  await controller.refresh()
  result.recovery = 'Mutated after return'
  expect(controller.snapshot().result).toMatchObject({ recovery: 'Original safe recovery' })
})
test('a throwing subscriber cannot interrupt reads or other subscribers', async () => {
  const controller = createMarketReadingController(async () => ({ ok: false, reason: 'brief_absent', recovery: 'No brief' }))
  let notifications = 0
  controller.subscribe(() => { throw new Error('Private listener failure') })
  controller.subscribe(() => { notifications++ })
  expect(() => controller.setContext('session-a')).not.toThrow()
  await controller.refresh()
  expect(controller.snapshot().loading).toBe(false)
  expect(controller.snapshot().result).toMatchObject({ reason: 'brief_absent' })
  expect(notifications).toBe(3)
})
test('a context switch during loading notification prevents dispatch for the old context', async () => {
  let reads = 0
  const controller = createMarketReadingController(async () => { reads++; return { ok: false, reason: 'offline', recovery: 'Offline' } })
  controller.setContext('session-a')
  controller.subscribe(state => { if (state.loading) controller.setContext('session-b') })
  await controller.refresh()
  expect(reads).toBe(0)
  expect(controller.snapshot()).toEqual({ contextRef: 'session-b', loading: false, result: null })
})

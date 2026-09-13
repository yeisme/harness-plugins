import './primitives.js'
import { expect, test } from 'vitest'
import type { MarketBriefProjection, MarketSignalProjection } from '@yeisme/dsh-personal-radar'
import { createMarketReadingController, createMarketCatchupController, createMarketDetailController } from '@yeisme/dsh-personal-radar'
import { createMarketQuestionController, type MarketQuestionSessionsFace } from '../src/client/market-question.js'

const signal: MarketSignalProjection = {
  schema: 'dsh.radar.market-signal.v1', signalRef: 'signal-a', revision: 1, policyRevision: 'sha256:policy',
  title: '样本信号', market: 'global', observedAt: '2026-09-13T08:00:00.000Z', claimKind: 'newly_observed', sourceRef: 'source-a',
  origin: 'fixture', assertionLevel: 'observed', comparison: null, lifecycle: 'active', evidenceRefs: ['evidence-a'], limitations: [],
}
const briefOf = (digest: string): MarketBriefProjection => ({
  schema: 'dsh.radar.market-brief.v1', briefRef: 'brief-a', digest, policyRevision: 'sha256:policy',
  generatedAt: '2026-09-13T09:00:00.000Z', timezone: 'UTC', window: { start: '2026-09-12T00:00:00.000Z', end: '2026-09-13T00:00:00.000Z' },
  status: 'empty', main: [], watching: [], remaining: 0, filtered: false, correctionCount: 0, limitations: [], coverage: [],
})
const reader = { schema: 'dsh.radar.market-reader.v1' as const, readerRef: 'local' as const, revision: 4, policyRevision: 'sha256:policy' }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(next => { resolve = next })
  return { promise, resolve }
}

test('late brief responses from session A never overwrite the session B projection', async () => {
  const sessionA = deferred<{ ok: true; brief: MarketBriefProjection; reader: typeof reader } | { ok: false; reason: 'offline'; recovery: string }>()
  let served = 0
  const controller = createMarketReadingController(async () => {
    served++
    return served === 1 ? sessionA.promise : Promise.resolve({ ok: true, brief: briefOf('session-b'), reader })
  })
  controller.setContext('session-a')
  const slow = controller.refresh()
  controller.setContext('session-b')
  await controller.refresh()
  // Session A's response resolves only now; B stays authoritative.
  sessionA.resolve({ ok: true, brief: briefOf('session-a'), reader })
  await slow
  const state = controller.snapshot()
  expect(state.contextRef).toBe('session-b')
  expect(state.result!.ok && state.result.brief.digest).toBe('session-b')
})

test('catch-up pages bound to session A are dropped after the context switch', async () => {
  const pageA = deferred<{ ok: true; page: { readerRevision: number; policyRevision: string; window: { start: string; end: string }; signals: MarketSignalProjection[]; nextCursor: string | null; historyLimited: boolean; limitations: string[] }; reader: typeof reader } | { ok: false; reason: 'offline'; recovery: string }>()
  const controller = createMarketCatchupController(async (_context, _cursor, testSignal) => {
    return testSignal.aborted || controller.snapshot().contextRef === 'session-b'
      ? Promise.resolve({ ok: true, page: { readerRevision: 5, policyRevision: 'sha256:policy', window: { start: '2026-09-12T00:00:00.000Z', end: '2026-09-13T00:00:00.000Z' }, signals: [], nextCursor: null, historyLimited: false, limitations: [] }, reader })
      : pageA.promise
  })
  controller.setContext('session-a')
  const slow = controller.first()
  controller.setContext('session-b')
  await controller.first()
  pageA.resolve({ ok: true, page: { readerRevision: 4, policyRevision: 'sha256:policy', window: { start: '2026-09-12T00:00:00.000Z', end: '2026-09-13T00:00:00.000Z' }, signals: [signal], nextCursor: null, historyLimited: false, limitations: [] }, reader })
  await slow
  const state = controller.snapshot()
  expect(state.contextRef).toBe('session-b')
  expect(state.result!.ok && state.result.page.readerRevision).toBe(5)
  expect(state.result!.ok && state.result.page.signals).toHaveLength(0)
})

test('a detail response from a closed selection never reopens into the new session', async () => {
  const detailA = deferred<{ ok: true; signal: MarketSignalProjection; reader: typeof reader } | { ok: false; reason: 'offline'; recovery: string }>()
  const controller = createMarketDetailController(async (_context, _selection, testSignal) => testSignal.aborted ? { ok: false, reason: 'cancelled', recovery: 'x' } : detailA.promise)
  controller.setContext('session-a')
  const slow = controller.select({ signalRef: 'signal-a', revision: 1 })
  controller.close()
  controller.setContext('session-b')
  detailA.resolve({ ok: true, signal, reader })
  await slow
  expect(controller.selection()).toBeNull()
  expect(controller.snapshot().result).toBeNull()
})

test('policy invalidation clears prior content instead of showing it under an unknown policy', async () => {
  const controller = createMarketReadingController(async () => ({ ok: true, brief: briefOf('loaded'), reader }))
  controller.setContext('session-a')
  await controller.refresh()
  expect(controller.snapshot().result).not.toBeNull()
  controller.invalidatePolicy()
  const state = controller.snapshot()
  expect(state.result).toBeNull()
  expect(state.loading).toBe(false)
})

test('the question draft from session A never leaks into session B (composed isolation)', async () => {
  const prompts: Array<{ sessionId: string }> = []
  let current = 'session-a'
  const listeners = new Set<() => void>()
  const sessions: MarketQuestionSessionsFace = {
    list: { getSnapshot: () => ({ current }), subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } },
    binding: sessionId => ({ session: { prompt: async () => { prompts.push({ sessionId }); return { ok: true } } } }),
  }
  const controller = createMarketQuestionController(sessions)
  controller.prepare(signal)
  controller.edit('旧会话的问题')
  // Switch conversations: the draft binding goes stale automatically.
  current = 'session-b'
  for (const listener of [...listeners]) listener()
  await controller.send()
  expect(prompts).toHaveLength(0)
  expect(controller.snapshot().status).toBe('session_changed')
})

test('detail selections survive page reload of the same session but reset on policy change', async () => {
  const controller = createMarketDetailController(async () => ({ ok: true, signal, reader }))
  controller.setContext('session-a')
  await controller.select({ signalRef: 'signal-a', revision: 1 })
  expect(controller.selection()).toEqual({ signalRef: 'signal-a', revision: 1 })
  controller.invalidatePolicy()
  expect(controller.selection()).toBeNull()
})

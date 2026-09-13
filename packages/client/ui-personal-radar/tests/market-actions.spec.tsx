import './primitives.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { MARKET_MUTATION_SCHEMA, type MarketActionReceiptV1, type MarketMutationIntentV1, type RadarMarketHostFace } from '@yeisme/dsh-personal-radar'
import { createMarketReadingController, createMarketCatchupController } from '@yeisme/dsh-personal-radar'
import { createMarketActionsController } from '../src/client/market-actions.js'
import { MarketReadingView } from '../src/client/market-view.js'
import { MarketCatchupView } from '../src/client/market-catchup-view.js'

interface Harness {
  host: RadarMarketHostFace
  applied: MarketMutationIntentV1[]
  setOutcome(mode: 'hang' | 'accepted' | 'conflict' | 'unknown'): void
  lookups: string[]
  receipts: Map<string, MarketActionReceiptV1>
}

function harness(outcome: 'hang' | 'accepted' | 'conflict' | 'unknown' = 'accepted'): Harness {
  const applied: MarketMutationIntentV1[] = []
  const lookups: string[] = []
  const receipts = new Map<string, MarketActionReceiptV1>()
  let mode = outcome
  const deferred: Array<(next: 'accepted' | 'conflict' | 'unknown') => void> = []
  const host: RadarMarketHostFace = {
    schema: 'dsh.radar.market-host.v1',
    contextRef: () => 'session-a',
    load: async () => ({ ok: false, reason: 'brief_absent', recovery: 'x' }),
    subscribeContext: () => () => {}, subscribePolicy: () => () => {},
    mutationsAvailable: () => true,
    mutate: async (_ref, intent) => {
      applied.push(structuredClone(intent))
      let current = mode
      if (current === 'hang') {
        // Deferred: the test decides the outcome after observing pending.
        current = await new Promise<'accepted' | 'conflict' | 'unknown'>(resolve => { deferred.push(resolve) })
      }
      const receipt: MarketActionReceiptV1 = current === 'accepted'
        ? { schema: 'dsh.radar.market-receipt.v1', idempotencyKey: intent.idempotencyKey, outcome: 'accepted', reason: 'owner applied', readerRevision: 8 }
        : current === 'conflict'
          ? { schema: 'dsh.radar.market-receipt.v1', idempotencyKey: intent.idempotencyKey, outcome: 'conflict', reason: 'reader revision changed' }
          : { schema: 'dsh.radar.market-receipt.v1', idempotencyKey: intent.idempotencyKey, outcome: 'unknown', reason: 'outcome_unknown' }
      // An unknown outcome means the owner has NO receipt for the key yet.
      if (current !== 'unknown') receipts.set(intent.idempotencyKey, receipt)
      return { ok: true, receipt }
    },
    lookupMutationReceipt: async (_ref, key) => {
      lookups.push(key)
      return receipts.get(key) ?? null
    },
  }
  return {
    host, applied, lookups, receipts,
    setOutcome(next: 'hang' | 'accepted' | 'conflict' | 'unknown') {
      mode = next
      for (const resolve of deferred.splice(0)) resolve(next === 'hang' ? 'accepted' : next)
    },
  }
}

const context = { readerRevision: 7, policyRevision: 'sha256:policy' }
const pageOne = [{ signalRef: 'signal-a', revision: 1 }, { signalRef: 'signal-b', revision: 3 }]
const pageTwo = [{ signalRef: 'signal-c', revision: 2 }]

test('pending never fakes success and a double click submits exactly one owner mutation', async () => {
  const h = harness('hang')
  const controller = createMarketActionsController(h.host)
  const first = controller.markRead(pageOne, context)
  await new Promise(resolve => setTimeout(resolve, 20))
  let state = controller.snapshot()
  expect(Object.values(state.entries)[0]!.state).toBe('pending')
  // Second click while pending: same deterministic key, no second dispatch.
  await controller.markRead(pageOne, context)
  expect(h.applied).toHaveLength(1)
  expect(h.applied[0]!.schema).toBe(MARKET_MUTATION_SCHEMA)
  expect(h.applied[0]!.kind).toBe('mark_read')
  h.setOutcome('accepted')
  await first
  state = controller.snapshot()
  expect(Object.values(state.entries)[0]!.state).toBe('accepted')
  // After settlement another click is still the same key: still one call.
  await controller.markRead(pageOne, context)
  expect(h.applied).toHaveLength(1)
})

test('pagination submits only the displayed page; later pages are separate receipts', async () => {
  const h = harness()
  const controller = createMarketActionsController(h.host)
  await controller.markRead(pageOne, context)
  await controller.markRead(pageTwo, context)
  expect(h.applied).toHaveLength(2)
  expect(h.applied[0]!.selections.map(item => item.signalRef).sort()).toEqual(['signal-a', 'signal-b'])
  expect(h.applied[1]!.selections.map(item => item.signalRef)).toEqual(['signal-c'])
  expect(h.applied[0]!.idempotencyKey).not.toBe(h.applied[1]!.idempotencyKey)
  // A different reader revision is a different key: no hidden dedupe across revisions.
  await controller.markRead(pageTwo, { ...context, readerRevision: 8 })
  expect(h.applied).toHaveLength(3)
})

test('pause and resume are separate watch-family intents, never personal save/dismiss', async () => {
  const h = harness()
  const controller = createMarketActionsController(h.host)
  await controller.pauseWatch(pageOne[0]!, context)
  await controller.resumeWatch(pageOne[0]!, context)
  await controller.watch(pageOne[0]!, context)
  const kinds = h.applied.map(intent => intent.kind)
  expect(kinds).toEqual(['pause_watch', 'resume_watch', 'watch'])
  // Market actions never reuse the legacy feedback kinds; that channel
  // (radarHost.dispatch save/dismiss) is not even reachable from here.
  for (const intent of h.applied) {
    expect(intent.schema).toBe('dsh.radar.market-mutation.v1')
    expect(['save', 'dismiss', 'open', 'compare', 'proposal', 'workbench', 'refresh']).not.toContain(intent.kind)
  }
})

test('conflict keeps the draft honest and triggers an authoritative re-read', async () => {
  const h = harness('conflict')
  let refreshes = 0
  const controller = createMarketActionsController(h.host, () => { refreshes++ })
  await controller.watch(pageOne[0]!, context)
  const state = controller.snapshot()
  const entry = Object.values(state.entries)[0]!
  expect(entry.state).toBe('conflict')
  expect(refreshes).toBe(1)
})

test('unknown outcomes reconcile by the original key without re-sending', async () => {
  const h = harness('unknown')
  const controller = createMarketActionsController(h.host)
  await controller.unwatch(pageOne[0]!, context)
  expect(Object.values(controller.snapshot().entries)[0]!.state).toBe('unknown')
  // No receipt yet: reconcile stays unknown, nothing re-dispatched.
  await controller.reconcile(h.applied[0]!.idempotencyKey)
  expect(Object.values(controller.snapshot().entries)[0]!.state).toBe('unknown')
  h.receipts.set(h.applied[0]!.idempotencyKey, { schema: 'dsh.radar.market-receipt.v1', idempotencyKey: h.applied[0]!.idempotencyKey, outcome: 'accepted', reason: 'settled by owner', readerRevision: 9 })
  await controller.reconcile(h.applied[0]!.idempotencyKey)
  expect(Object.values(controller.snapshot().entries)[0]!.state).toBe('reconciled')
  expect(h.applied).toHaveLength(1)
  expect(h.lookups).toEqual([h.applied[0]!.idempotencyKey, h.applied[0]!.idempotencyKey])
})

test('a host without the mutation seam renders the market face read-only with a disabled reason', () => {
  const h = harness()
  const host: RadarMarketHostFace = { ...h.host, mutationsAvailable: () => false }
  delete (host as Partial<RadarMarketHostFace>).mutate
  const actions = createMarketActionsController(host)
  expect(actions.snapshot().available).toBe(false)
  const reading = createMarketReadingController(async () => ({ ok: false, reason: 'offline', recovery: 'x' }))
  const html = renderToStaticMarkup(createElement(MarketReadingView, { controller: reading, actions, locale: 'zh' }))
  expect(html).toContain('市场操作需要可写的 Radar reader seam')
  expect(html).not.toContain('标记已读')
  expect(html).not.toContain('关注')
})

test('the catch-up view exposes a page-level read mark for the displayed page only', async () => {
  const h = harness()
  const actions = createMarketActionsController(h.host)
  const pageOneSignals = [{ schema: 'dsh.radar.market-signal.v1' as const, signalRef: 'signal-a', revision: 1, policyRevision: 'sha256:policy',
    title: '页面一', market: 'global', observedAt: '2026-09-13T08:00:00.000Z', claimKind: 'newly_observed', sourceRef: 'source-a', origin: 'fixture' as const,
    assertionLevel: 'observed' as const, comparison: null, lifecycle: 'active' as const, evidenceRefs: [], limitations: [] }]
  const catchup = createMarketCatchupController(async () => ({
    ok: true,
    reader: { schema: 'dsh.radar.market-reader.v1' as const, readerRef: 'local' as const, revision: 7, policyRevision: 'sha256:policy' },
    page: { schema: 'dsh.radar.market-catchup.v1' as const, readerRevision: 7, policyRevision: 'sha256:policy',
      window: { start: '2026-09-12T00:00:00.000Z', end: '2026-09-13T00:00:00.000Z' }, signals: pageOneSignals, nextCursor: 'page_two', historyLimited: false, limitations: [] },
  }))
  catchup.setContext('session-a')
  await catchup.first()
  const html = renderToStaticMarkup(createElement(MarketCatchupView, { controller: catchup, locale: 'zh', actions }))
  expect(html).toContain('标记本页已读')
  const withoutActions = renderToStaticMarkup(createElement(MarketCatchupView, { controller: catchup, locale: 'zh' }))
  expect(withoutActions).not.toContain('标记本页已读')
})

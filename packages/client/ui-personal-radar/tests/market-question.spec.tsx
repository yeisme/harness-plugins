import './primitives.js'
import { expect, test } from 'vitest'
import type { MarketSignalProjection } from '@yeisme/dsh-personal-radar'
import { createMarketQuestionController, marketQuestionCitation, type MarketQuestionSessionsFace } from '../src/client/market-question.js'

const signal: MarketSignalProjection = {
  schema: 'dsh.radar.market-signal.v1', signalRef: 'signal-a', revision: 3, policyRevision: 'sha256:policy',
  title: '样本信号', market: 'global', observedAt: '2026-09-13T08:00:00.000Z', claimKind: 'metric_changed', sourceRef: 'source-a',
  origin: 'fixture', assertionLevel: 'observed', comparison: null, lifecycle: 'active', evidenceRefs: ['evidence-a', 'evidence-b'], limitations: [],
}

function sessionsFixture(options: { current?: string; promptOk?: boolean; hang?: boolean } = {}) {
  const prompts: Array<{ sessionId: string; text: string; mode: string }> = []
  let current = options.current ?? 'session-a'
  const listeners = new Set<() => void>()
  const release: Array<() => void> = []
  const face: MarketQuestionSessionsFace = {
    list: {
      getSnapshot: () => ({ current }),
      subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    },
    binding: sessionId => sessionId === current || options.current === undefined ? {
      session: { prompt: async (content, mode) => {
        prompts.push({ sessionId, text: content[0]?.text ?? '', mode })
        if (options.hang) await new Promise<void>(resolve => { release.push(resolve) })
        return { ok: options.promptOk ?? true }
      } },
    } : undefined,
  }
  return {
    face, prompts,
    switchSession(next: string) { current = next; for (const listener of [...listeners]) listener() },
    settleHang: () => { for (const resolve of release.splice(0)) resolve() },
  }
}

test('a signal without citable evidence disables the question without hiding the evidence', () => {
  const controller = createMarketQuestionController(sessionsFixture().face)
  controller.prepare({ ...signal, evidenceRefs: [] })
  expect(controller.snapshot().status).toBe('evidence_insufficient')
  void controller.send()
  expect(controller.snapshot().status).toBe('evidence_insufficient')
})

test('a missing sessions seam keeps the draft channel readable but disabled', () => {
  const controller = createMarketQuestionController(undefined)
  controller.prepare(signal)
  expect(controller.snapshot().status).toBe('composer_unavailable')
})

test('no message side effect happens before the explicit user send', async () => {
  const sessions = sessionsFixture()
  const controller = createMarketQuestionController(sessions.face)
  controller.prepare(signal)
  controller.edit('这个变化可信吗？')
  expect(sessions.prompts).toHaveLength(0)
  // An empty question never sends either.
  controller.edit('   ')
  await controller.send()
  expect(sessions.prompts).toHaveLength(0)
  controller.edit('这个变化可信吗？')
  await controller.send()
  expect(sessions.prompts).toHaveLength(1)
  expect(sessions.prompts[0]!.sessionId).toBe('session-a')
  expect(sessions.prompts[0]!.mode).toBe('queue')
  expect(sessions.prompts[0]!.text).toBe(marketQuestionCitation({ title: signal.title, signalRef: signal.signalRef, revision: signal.revision, policyRevision: signal.policyRevision, evidenceRefs: signal.evidenceRefs }) + '这个变化可信吗？')
  expect(controller.snapshot().status).toBe('sent')
})

test('a session switch invalidates the binding: the old draft never reaches the new session', async () => {
  const sessions = sessionsFixture()
  const controller = createMarketQuestionController(sessions.face)
  controller.prepare(signal)
  controller.edit('继续追问')
  sessions.switchSession('session-b')
  expect(controller.snapshot().status).toBe('session_changed')
  await controller.send()
  expect(sessions.prompts).toHaveLength(0)
  // Explicit rebind is the only way to target the new conversation.
  controller.rebind()
  expect(controller.snapshot().status).toBe('draft')
  expect(controller.snapshot().draft!.sessionId).toBe('session-b')
  await controller.send()
  expect(sessions.prompts).toHaveLength(1)
  expect(sessions.prompts[0]!.sessionId).toBe('session-b')
})

test('a session switch during an in-flight send is not reported as success into the new session', async () => {
  const sessions = sessionsFixture({ hang: true })
  const controller = createMarketQuestionController(sessions.face)
  controller.prepare(signal)
  controller.edit('发送期间切换会话')
  const sending = controller.send()
  expect(controller.snapshot().status).toBe('sending')
  sessions.switchSession('session-b')
  sessions.settleHang()
  await sending
  expect(controller.snapshot().status).toBe('session_changed')
})

test('a different loaded revision invalidates the draft citation (stale reference)', () => {
  const controller = createMarketQuestionController(sessionsFixture().face)
  controller.prepare(signal)
  controller.edit('基于修订3的问题')
  controller.invalidateForSelection({ signalRef: 'signal-a', revision: 3 })
  expect(controller.snapshot().status).toBe('draft')
  controller.invalidateForSelection({ signalRef: 'signal-a', revision: 4 })
  expect(controller.snapshot().status).toBe('reference_stale')
  void controller.send()
  // Sending a stale-citation draft is blocked; the user prepares again.
  expect(controller.snapshot().status).toBe('reference_stale')
})

test('a failed prompt keeps the draft for an explicit retry', async () => {
  const sessions = sessionsFixture({ promptOk: false })
  const controller = createMarketQuestionController(sessions.face)
  controller.prepare(signal)
  controller.edit('重试一次')
  await controller.send()
  const state = controller.snapshot()
  expect(state.status).toBe('failed')
  expect(state.draft!.question).toBe('重试一次')
})

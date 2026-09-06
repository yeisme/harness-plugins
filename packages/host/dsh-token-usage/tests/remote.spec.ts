import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  TOKEN_USAGE_REMOTE_SERVICE_KEY,
  SessionInsightsEngine,
  TokenUsageRemoteService,
  TokenUsageService,
  tokenUsageRemoteMarkers,
  type RawUsageSample,
  type SessionHistorySource,
} from '../src/index.ts'

function mockSource(samples: RawUsageSample[]): SessionHistorySource {
  return {
    id: 'session_query',
    read: async () => ({ complete: true, samples }),
  }
}

describe('tokenUsage remote service', () => {
  it('binds the tokenUsage namespace and marks snapshot/refreshBalance', async () => {
    const ctx = new Context()
    const service = new TokenUsageService({ credentials: { resolveApiKey: () => undefined } })
    const remote = new TokenUsageRemoteService(ctx, service)
    expect((remote as unknown as { name: string }).name).toBe(TOKEN_USAGE_REMOTE_SERVICE_KEY)
    expect(tokenUsageRemoteMarkers(remote)).toEqual([
      { method: 'snapshot', invocation: { kind: 'direct' } },
      { method: 'refreshBalance', invocation: { kind: 'direct' } },
      { method: 'capabilities', invocation: { kind: 'direct' } },
      { method: 'query', invocation: { kind: 'direct' } },
    ])
    const answer = await remote.snapshot()
    expect(answer).toMatchObject({ ok: true, specVersion: '1.0' })
    if (!answer.ok) throw new Error('unreachable')
    expect(answer.usage.schemaVersion).toBe('token.usage.snapshot.v1alpha1')
    expect(answer.balance.schemaVersion).toBe('token.balance.snapshot.v1alpha1')
    const refreshed = await remote.refreshBalance()
    expect(refreshed).toMatchObject({ ok: true })
  })

  it('probes the query capability honestly on old and new hosts', async () => {
    const ctx = new Context()
    const oldService = new TokenUsageService({ credentials: { resolveApiKey: () => undefined } })
    const oldRemote = new TokenUsageRemoteService(ctx, oldService)
    const oldCaps = await oldRemote.capabilities()
    expect(oldCaps).toMatchObject({ ok: true, specVersion: '1.0' })
    expect(oldCaps.capabilities.query.available).toBe(false)
    expect(oldCaps.capabilities.query.reason).toBeTruthy()
    const unavailable = await oldRemote.query({ sessionRef: 'session-a' })
    expect(unavailable).toMatchObject({ ok: false, code: 'insights_unavailable' })

    const newCtx = new Context()
    const insights = new SessionInsightsEngine(
      mockSource([{ attemptRef: 't1-s1', kind: 'final', usage: { inputTokens: 10, outputTokens: 5 } }]),
    )
    const newService = new TokenUsageService({ credentials: { resolveApiKey: () => undefined }, insights })
    const newRemote = new TokenUsageRemoteService(newCtx, newService)
    const newCaps = await newRemote.capabilities()
    expect(newCaps.capabilities.query).toEqual({ available: true, schemaVersion: 'session.insights.snapshot.v1alpha1' })
  })

  it('keeps the legacy snapshot()/refreshBalance() contract unchanged on a new host (old client leg)', async () => {
    const ctx = new Context()
    const insights = new SessionInsightsEngine(
      mockSource([{ attemptRef: 't1-s1', kind: 'final', usage: { inputTokens: 6400, outputTokens: 1200 } }]),
    )
    const service = new TokenUsageService({ credentials: { resolveApiKey: () => undefined }, insights })
    const remote = new TokenUsageRemoteService(ctx, service)

    // Old clients only know snapshot()/refreshBalance(); both must keep the
    // published process-observed schemas even when the insights engine exists.
    const answer = await remote.snapshot()
    expect(answer).toMatchObject({ ok: true, specVersion: '1.0' })
    if (!answer.ok) throw new Error('unreachable')
    expect(answer.usage.schemaVersion).toBe('token.usage.snapshot.v1alpha1')
    expect(answer.balance.schemaVersion).toBe('token.balance.snapshot.v1alpha1')
    // Full-history insights never fold into the legacy process windows.
    expect(answer.usage.windows.process.uncachedInputTokens).not.toBe(6400)
    expect(JSON.stringify(answer)).not.toContain('session.insights.snapshot')

    const refreshed = await remote.refreshBalance()
    expect(refreshed).toMatchObject({ ok: true, specVersion: '1.0' })
    if (!refreshed.ok) throw new Error('unreachable')
    expect(refreshed.balance.schemaVersion).toBe('token.balance.snapshot.v1alpha1')

    // The new capability sits alongside, not in place of, the legacy methods.
    const caps = await remote.capabilities()
    expect(caps.capabilities.query).toEqual({ available: true, schemaVersion: 'session.insights.snapshot.v1alpha1' })
  })

  it('serves the insights query end-to-end through the Remote whitelist', async () => {
    const ctx = new Context()
    const insights = new SessionInsightsEngine(
      mockSource([{ attemptRef: 't1-s1', kind: 'final', usage: { inputTokens: 10, outputTokens: 5 } }]),
    )
    const service = new TokenUsageService({ credentials: { resolveApiKey: () => undefined }, insights })
    const remote = new TokenUsageRemoteService(ctx, service)

    const invalid = await remote.query({ sessionRef: 'session-a', apiKey: 'sk-x' })
    expect(invalid).toMatchObject({ ok: false, code: 'invalid_input' })

    const result = await remote.query({ sessionRef: 'session-a' })
    expect(result).toMatchObject({ ok: true, specVersion: '1.0' })
    if (!result.ok) throw new Error('unreachable')
    expect(result.snapshot.schemaVersion).toBe('session.insights.snapshot.v1alpha1')
    expect(result.snapshot.totals.buckets.uncachedInputTokens).toBe(10)
    expect(result.snapshot.coverage.status).toBe('complete')
  })
})

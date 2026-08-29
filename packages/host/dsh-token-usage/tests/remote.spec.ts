import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  TOKEN_USAGE_REMOTE_SERVICE_KEY,
  TokenUsageRemoteService,
  TokenUsageService,
  tokenUsageRemoteMarkers,
} from '../src/index.ts'

describe('tokenUsage remote service', () => {
  it('binds the tokenUsage namespace and marks snapshot/refreshBalance', async () => {
    const ctx = new Context()
    const service = new TokenUsageService({ credentials: { resolveApiKey: () => undefined } })
    const remote = new TokenUsageRemoteService(ctx, service)
    expect((remote as unknown as { name: string }).name).toBe(TOKEN_USAGE_REMOTE_SERVICE_KEY)
    expect(tokenUsageRemoteMarkers(remote)).toEqual([
      { method: 'snapshot', invocation: { kind: 'direct' } },
      { method: 'refreshBalance', invocation: { kind: 'direct' } },
    ])
    const answer = await remote.snapshot()
    expect(answer).toMatchObject({ ok: true, specVersion: '1.0' })
    if (!answer.ok) throw new Error('unreachable')
    expect(answer.usage.schemaVersion).toBe('token.usage.snapshot.v1alpha1')
    expect(answer.balance.schemaVersion).toBe('token.balance.snapshot.v1alpha1')
    const refreshed = await remote.refreshBalance()
    expect(refreshed).toMatchObject({ ok: true })
  })
})

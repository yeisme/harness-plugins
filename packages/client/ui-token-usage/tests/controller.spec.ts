import { describe, expect, it, vi } from 'vitest'
import { TokenUsageController } from '../src/client/controller.ts'
import type { TokenBalanceSnapshotV1, TokenUsageRemoteFace, TokenUsageSnapshotV1 } from '../src/wire.ts'

const usage: TokenUsageSnapshotV1 = {
  schemaVersion: 'token.usage.snapshot.v1alpha1',
  generatedAt: '2026-09-05T08:00:00.000Z',
  freshness: 'fresh',
  windows: {
    today: { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
    week: { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
    process: { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
  },
  bySession: [],
  byProvider: [],
  truncated: false,
}

const balance: TokenBalanceSnapshotV1 = {
  schemaVersion: 'token.balance.snapshot.v1alpha1',
  status: 'ready',
  freshness: 'fresh',
  generatedAt: '2026-09-05T08:00:00.000Z',
  safeMessage: 'DeepSeek balance.',
  isAvailable: true,
  infos: [{ currency: 'CNY', totalBalance: '110.00', grantedBalance: '10.00', toppedUpBalance: '100.00' }],
}

function remote(overrides: Partial<TokenUsageRemoteFace> = {}): TokenUsageRemoteFace {
  return {
    snapshot: vi.fn(async () => ({ ok: true as const, specVersion: '1.0' as const, usage, balance })),
    refreshBalance: vi.fn(async () => ({ ok: true as const, specVersion: '1.0' as const, balance })),
    ...overrides,
  }
}

describe('TokenUsageController independent slices', () => {
  it('初次用量失败: usage failure and balance success stay independent', async () => {
    const face = remote({
      snapshot: vi.fn(async () => ({ ok: false as const, code: 'remote_unavailable' as const, message: 'ledger unavailable' })),
    })
    const controller = new TokenUsageController(face)
    await controller.refresh()
    expect(controller.getSnapshot().usage).toMatchObject({ status: 'error', message: 'ledger unavailable' })
    // Balance refresh still lands even though the usage slice failed.
    await controller.refreshBalance()
    const state = controller.getSnapshot()
    expect(state.balance).toMatchObject({ status: 'ready' })
    expect(state.balance.status === 'ready' && state.balance.balance.infos?.[0]?.totalBalance).toBe('110.00')
    expect(state.usage.status).toBe('error') // untouched by the balance result
  })

  it('keeps the successful balance when a later usage retry fails', async () => {
    let failUsage = false
    const face = remote({
      snapshot: vi.fn(async () => failUsage
        ? { ok: false as const, code: 'remote_unavailable' as const, message: 'ledger unavailable' }
        : { ok: true as const, specVersion: '1.0' as const, usage, balance }),
    })
    const controller = new TokenUsageController(face)
    await controller.refresh()
    expect(controller.getSnapshot().usage.status).toBe('ready')
    failUsage = true
    await controller.refresh()
    const state = controller.getSnapshot()
    expect(state.usage).toMatchObject({ status: 'error', message: 'ledger unavailable' })
    expect(state.usage.status === 'error' && state.usage.previous?.generatedAt).toBe(usage.generatedAt)
    expect(state.balance.status).toBe('ready') // balance result not dropped
  })

  it('refreshBalance surfaces failures with a reason and keeps the stale value', async () => {
    const staleBalance = { ...balance, freshness: 'stale' as const }
    const face = remote({
      refreshBalance: vi.fn(async () => ({ ok: false as const, code: 'balance_unavailable' as const, message: 'network failed' })),
    })
    const controller = new TokenUsageController(face)
    await controller.refresh()
    await controller.refreshBalance()
    const state = controller.getSnapshot()
    expect(state.balance.status).toBe('error')
    expect(state.balance.status === 'error' && state.balance.message).toBe('network failed')
    expect(state.balance.status === 'error' && state.balance.previous).toBeDefined()
    void staleBalance
  })

  it('refreshBalance does not swallow thrown errors', async () => {
    const face = remote({
      refreshBalance: vi.fn(async () => { throw new Error('socket reset') }),
    })
    const controller = new TokenUsageController(face)
    await controller.refreshBalance()
    const state = controller.getSnapshot().balance
    expect(state).toMatchObject({ status: 'error', message: 'socket reset' })
  })

  it('marks the slice busy while an explicit balance refresh is in flight', async () => {
    let resolve: (() => void) | undefined
    const face = remote({
      refreshBalance: vi.fn(() => new Promise<Awaited<ReturnType<TokenUsageRemoteFace['refreshBalance']>>>(res => {
        resolve = () => { res({ ok: true, specVersion: '1.0', balance }) }
      })),
    })
    const controller = new TokenUsageController(face)
    const pending = controller.refreshBalance()
    expect(controller.getSnapshot().balance.status).toBe('loading')
    resolve?.()
    await pending
    expect(controller.getSnapshot().balance.status).toBe('ready')
  })

  it('dispose discards late replies (HMR/unload)', async () => {
    let resolveSnapshot: ((value: unknown) => void) | undefined
    const face = remote({
      snapshot: vi.fn(() => new Promise(res => { resolveSnapshot = res })),
    })
    const controller = new TokenUsageController(face)
    const listener = vi.fn()
    controller.subscribe(listener)
    const pending = controller.refresh()
    controller.dispose()
    resolveSnapshot?.({ ok: true, specVersion: '1.0', usage, balance })
    await pending
    // The late reply is discarded: never published as ready, listener cleared.
    expect(controller.getSnapshot().usage.status).not.toBe('ready')
    const callsAfterDispose = listener.mock.calls.length
    await Promise.resolve()
    expect(listener.mock.calls.length).toBe(callsAfterDispose)
  })
})

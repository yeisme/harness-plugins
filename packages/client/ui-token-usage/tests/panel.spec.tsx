// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TokenUsagePanel } from '../src/client/panel.tsx'
import { deriveTokenUsageViewModel } from '../src/client/projection.ts'
import { en, type TokenUsageTranslator } from '../src/client/locales.ts'
import { EMPTY_BUCKETS, type TokenBalanceSnapshotV1, type TokenUsageSnapshotV1 } from '../src/wire.ts'

afterEach(cleanup)

const t: TokenUsageTranslator = key => en[key]

function readyModel(balance?: TokenBalanceSnapshotV1) {
  const usage: TokenUsageSnapshotV1 = {
    schemaVersion: 'token.usage.snapshot.v1alpha1',
    generatedAt: '2026-08-27T12:34:56.000Z',
    freshness: 'fresh',
    currentSession: { sessionRef: 'session-1', label: 'session-1', buckets: { uncachedInputTokens: 900, outputTokens: 1_200, cacheReadTokens: 0, cacheWriteTokens: 0 } },
    windows: {
      today: { uncachedInputTokens: 30_000, outputTokens: 5_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
      week: { uncachedInputTokens: 1_150_000, outputTokens: 90_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
      process: { uncachedInputTokens: 1_200_000, outputTokens: 95_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    },
    bySession: [
      { sessionRef: 'session-1', label: 'session-1', buckets: { uncachedInputTokens: 900, outputTokens: 1_200, cacheReadTokens: 0, cacheWriteTokens: 0 } },
      { sessionRef: 'session-2', label: 'session-2', buckets: { uncachedInputTokens: 400, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 } },
    ],
    byProvider: [{ providerId: 'deepseek-official', label: 'deepseek-official', buckets: { uncachedInputTokens: 1_000, outputTokens: 1_300, cacheReadTokens: 0, cacheWriteTokens: 0 } }],
    truncated: true,
  }
  return deriveTokenUsageViewModel({ usage, ...(balance === undefined ? {} : { balance }) })
}

describe('TokenUsagePanel', () => {
  it('renders windows, sessions, truncation, and the ready balance', () => {
    render(<TokenUsagePanel model={readyModel({
      schemaVersion: 'token.balance.snapshot.v1alpha1',
      status: 'ready',
      freshness: 'fresh',
      generatedAt: '2026-08-27T12:34:56.000Z',
      safeMessage: 'DeepSeek balance.',
      isAvailable: true,
      infos: [{ currency: 'CNY', totalBalance: '110.00', grantedBalance: '10.00', toppedUpBalance: '100.00' }],
    })} t={t} />)
    expect(screen.getByText('session-1')).toBeTruthy()
    expect(screen.getByText('session-2')).toBeTruthy()
    expect(screen.getByText('deepseek-official')).toBeTruthy()
    expect(screen.getByText(en['truncated'])).toBeTruthy()
    expect(screen.getByText('110.00')).toBeTruthy()
    expect(screen.getByRole('button', { name: en['balance.refresh'] })).toBeTruthy()
  })

  it('fires refresh once per click', () => {
    const onRefresh = vi.fn()
    render(<TokenUsagePanel model={readyModel()} t={t} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: en['balance.refresh'] }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('hides the refresh action and shows the degrade message on unsupported routes', () => {
    render(<TokenUsagePanel model={deriveTokenUsageViewModel({
      usage: {
        schemaVersion: 'token.usage.snapshot.v1alpha1',
        generatedAt: '2026-08-27T12:34:56.000Z',
        freshness: 'fresh',
        windows: { today: EMPTY_BUCKETS, week: EMPTY_BUCKETS, process: EMPTY_BUCKETS },
        bySession: [],
        byProvider: [],
        truncated: false,
      },
      balance: {
        schemaVersion: 'token.balance.snapshot.v1alpha1',
        status: 'unsupported',
        freshness: 'unknown',
        generatedAt: '2026-08-27T12:34:56.000Z',
        reasonCode: 'provider_not_deepseek',
        safeMessage: 'Balance is available for the DeepSeek official route only.',
      },
    })} t={t} />)
    expect(screen.queryByRole('button', { name: en['balance.refresh'] })).toBeNull()
    expect(screen.getByText('Balance is available for the DeepSeek official route only.')).toBeTruthy()
    expect(screen.getByText(en['empty.sessions'])).toBeTruthy()
  })

  it('shows the usage-unavailable empty state without sessions', () => {
    const html = render(<TokenUsagePanel model={deriveTokenUsageViewModel({
      usage: {
        schemaVersion: 'token.usage.snapshot.v1alpha1',
        generatedAt: '2026-08-27T12:34:56.000Z',
        freshness: 'unknown',
        windows: { today: EMPTY_BUCKETS, week: EMPTY_BUCKETS, process: EMPTY_BUCKETS },
        bySession: [],
        byProvider: [],
        truncated: false,
      },
    })} t={t} />).container.innerHTML
    expect(html).toContain(en['empty.usage'])
    expect(html).not.toContain('sk-')
    expect(html).not.toMatch(/bearer|authorization|apikey/iu)
  })
})

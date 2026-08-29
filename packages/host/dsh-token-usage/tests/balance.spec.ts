import { describe, expect, it, vi } from 'vitest'
import { BALANCE_MIN_INTERVAL_MS, DeepSeekBalanceClient, mapBalanceResponse } from '../src/balance.ts'
import { parseBalanceSnapshot } from '../src/projection.ts'

const OFFICIAL_DOC_EXAMPLE = {
  is_available: true,
  balance_infos: [
    { currency: 'CNY', total_balance: '110.00', granted_balance: '10.00', topped_up_balance: '100.00' },
  ],
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

describe('mapBalanceResponse whitelist', () => {
  it('maps the official documentation example verbatim as strings', () => {
    const mapped = mapBalanceResponse(OFFICIAL_DOC_EXAMPLE)
    expect(mapped).toEqual({
      isAvailable: true,
      infos: [{ currency: 'CNY', totalBalance: '110.00', grantedBalance: '10.00', toppedUpBalance: '100.00' }],
    })
  })

  it('drops invalid infos and rejects whole-payload mismatches', () => {
    expect(mapBalanceResponse({ is_available: true })).toBeNull()
    expect(mapBalanceResponse({ balance_infos: [] })).toBeNull()
    expect(mapBalanceResponse({
      is_available: false,
      balance_infos: [
        { currency: 'EUR', total_balance: '1.00', granted_balance: '0.00', topped_up_balance: '1.00' },
        { currency: 'USD', total_balance: 5, granted_balance: '0.00', topped_up_balance: '5.00' },
        { currency: 'USD', total_balance: '5.00', granted_balance: '0.00', topped_up_balance: '5.00' },
      ],
    })).toEqual({
      isAvailable: false,
      infos: [{ currency: 'USD', totalBalance: '5.00', grantedBalance: '0.00', toppedUpBalance: '5.00' }],
    })
  })
})

describe('DeepSeekBalanceClient', () => {
  it('never issues HTTP for non-official providers', async () => {
    const fetchMock = vi.fn()
    let now = 1_000_000
    const client = new DeepSeekBalanceClient({ fetch: fetchMock as never, credentials: { resolveApiKey: () => 'sk-test' }, now: () => now })
    const snapshot = await client.refresh('openai-compatible')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(snapshot).toMatchObject({ status: 'unsupported', reasonCode: 'provider_not_deepseek' })
  })

  it('degrades credential_missing without HTTP', async () => {
    const fetchMock = vi.fn()
    const client = new DeepSeekBalanceClient({ fetch: fetchMock as never, credentials: { resolveApiKey: () => undefined } })
    const snapshot = await client.refresh('deepseek-official')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(snapshot).toMatchObject({ status: 'unavailable', reasonCode: 'credential_missing' })
  })

  it('projects the official example with bearer auth exactly once', async () => {
    const fetchMock = vi.fn(async () => okResponse(OFFICIAL_DOC_EXAMPLE))
    let now = 1_000_000
    const client = new DeepSeekBalanceClient({ fetch: fetchMock as never, credentials: { resolveApiKey: () => 'sk-doc-example' }, now: () => now })
    const snapshot = await client.refresh('deepseek-official')
    expect(snapshot).toMatchObject({
      status: 'ready',
      freshness: 'fresh',
      isAvailable: true,
      infos: [{ currency: 'CNY', totalBalance: '110.00' }],
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer sk-doc-example')

    // Within the 15s window the existing projection returns without HTTP.
    now += BALANCE_MIN_INTERVAL_MS - 1
    const throttled = await client.refresh('deepseek-official')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(throttled).toMatchObject({ status: 'ready' })
  })

  it('keeps the last good amounts as stale on failure', async () => {
    let fail = false
    const fetchMock = vi.fn(async () => (fail ? { ok: false, status: 503, json: async () => ({}) } : okResponse(OFFICIAL_DOC_EXAMPLE)))
    let now = 1_000_000
    const client = new DeepSeekBalanceClient({ fetch: fetchMock as never, credentials: { resolveApiKey: () => 'sk-doc-example' }, now: () => now })
    await client.refresh('deepseek-official')
    now += BALANCE_MIN_INTERVAL_MS + 1
    fail = true
    const degraded = await client.refresh('deepseek-official')
    expect(degraded).toMatchObject({ status: 'error', freshness: 'stale', reasonCode: 'network_failed' })
    expect(degraded.infos?.[0]?.totalBalance).toBe('110.00')
  })

  it('marks contract mismatches without guessing amounts', async () => {
    const fetchMock = vi.fn(async () => okResponse({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: 'not-a-number' }] }))
    const client = new DeepSeekBalanceClient({ fetch: fetchMock as never, credentials: { resolveApiKey: () => 'sk-doc-example' } })
    const snapshot = await client.refresh('deepseek-official')
    expect(snapshot).toMatchObject({ status: 'error', reasonCode: 'contract_mismatch' })
    expect(snapshot.infos).toBeUndefined()
  })

  it('snapshots pass the strict whitelist validator', async () => {
    const fetchMock = vi.fn(async () => okResponse(OFFICIAL_DOC_EXAMPLE))
    const client = new DeepSeekBalanceClient({ fetch: fetchMock as never, credentials: { resolveApiKey: () => 'sk-doc-example' } })
    const snapshot = await client.refresh('deepseek-official')
    expect(() => parseBalanceSnapshot(snapshot)).not.toThrow()
    expect(() => parseBalanceSnapshot({ ...snapshot, apiKey: 'sk-leak' })).toThrow()
  })
})

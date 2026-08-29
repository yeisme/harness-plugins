import { describe, expect, it, vi } from 'vitest'
import { DeepSeekBalanceClient } from '../src/balance.ts'
import { TokenLedger } from '../src/ledger.ts'
import { TokenUsageService } from '../src/service.ts'

/**
 * Red line: no credential, bearer, base URL, or raw response body may reach
 * a projection, an error message, or the ledger surface.
 */
const SECRET_SHAPES = /(api[_-]?key|bearer|authorization|sk-[a-z0-9]|api\.deepseek\.com)/iu

const OFFICIAL_DOC_EXAMPLE = {
  is_available: true,
  balance_infos: [
    { currency: 'CNY', total_balance: '110.00', granted_balance: '10.00', topped_up_balance: '100.00' },
  ],
}

describe('redaction red lines', () => {
  it('keeps credentials, bearer headers, and base URLs out of every projection', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ note: 'sk-should-not-leak https://api.deepseek.com' }) }))
    const client = new DeepSeekBalanceClient({ fetch: fetchMock as never, credentials: { resolveApiKey: () => 'sk-supersecret' } })
    const failed = await client.refresh('deepseek-official')
    expect(SECRET_SHAPES.test(JSON.stringify(failed))).toBe(false)
    expect(SECRET_SHAPES.test(failed.safeMessage)).toBe(false)

    const fetchOk = vi.fn(async () => ({ ok: true, status: 200, json: async () => OFFICIAL_DOC_EXAMPLE }))
    const good = new DeepSeekBalanceClient({ fetch: fetchOk as never, credentials: { resolveApiKey: () => 'sk-supersecret' } })
    const ready = await good.refresh('deepseek-official')
    expect(SECRET_SHAPES.test(JSON.stringify(ready))).toBe(false)
  })

  it('keeps the usage snapshot free of credential and path shapes', () => {
    const ledger = new TokenLedger()
    ledger.observeProvider('session-a', 'deepseek-official')
    ledger.observeTokenUsage('session-a', { uncachedInputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 }, Date.now())
    ledger.observeTokenUsage('/abs/path/session', { uncachedInputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, Date.now())
    ledger.observeTokenUsage('session?apikey=sk-x', { uncachedInputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, Date.now())
    const service = new TokenUsageService({ ledger, credentials: { resolveApiKey: () => 'sk-supersecret' } })
    const parts = service.snapshot()
    expect(SECRET_SHAPES.test(JSON.stringify(parts))).toBe(false)
    expect(parts.usage.bySession.map(row => row.sessionRef)).toEqual(['session-a'])
  })
})

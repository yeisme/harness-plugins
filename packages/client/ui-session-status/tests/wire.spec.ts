import { describe, expect, it } from 'vitest'
import { parseSessionStatusSnapshot, SESSION_STATUS_SCHEMA_VERSION } from '../src/wire.ts'

const valid = {
  schemaVersion: SESSION_STATUS_SCHEMA_VERSION,
  revision: 3,
  generatedAt: '2026-09-01T00:00:00.000Z',
  freshness: 'fresh',
  status: 'ready',
  session: { sessionRef: 'sess_abc', label: 'Main', lifecycle: 'idle' },
  context: {
    status: 'ready',
    usedTokens: 1200,
    limitTokens: 10000,
    remainingRatio: 0.88,
    source: 'token-meter',
    safeMessage: 'Context remaining from owner token meter',
  },
  limits: [],
}

describe('session status client wire', () => {
  it('mirrors a valid host snapshot field-for-field', () => {
    const parsed = parseSessionStatusSnapshot(valid)
    expect(parsed?.revision).toBe(3)
    expect(parsed?.context.remainingRatio).toBe(0.88)
    expect(parsed?.session.sessionRef).toBe('sess_abc')
  })

  it('drops unknown-field and credential-shaped payloads', () => {
    expect(parseSessionStatusSnapshot({ ...valid, apiKey: 'sk-secret' })).toBeNull()
    expect(parseSessionStatusSnapshot({
      ...valid,
      runtime: { authorization: 'Bearer x' },
    })).toBeNull()
  })

  it('degrades a short shape instead of inventing remaining', () => {
    const { session: _session, ...short } = valid
    expect(parseSessionStatusSnapshot(short)).toBeNull()
  })

  it('rejects more than four limits', () => {
    const limits = Array.from({ length: 5 }, (_, index) => ({
      id: `w${index}`,
      label: `Window ${index}`,
      scope: 'rolling',
      status: 'ready',
      safeMessage: 'ok',
    }))
    expect(parseSessionStatusSnapshot({ ...valid, limits })).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { parseSafeSessionRef, parseSessionStatusSnapshot } from '../src/schema.ts'
import { SESSION_STATUS_SCHEMA_VERSION } from '../src/types.ts'

const valid = {
  schemaVersion: SESSION_STATUS_SCHEMA_VERSION,
  revision: 1,
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

describe('session status schema', () => {
  it('accepts a bounded snapshot', () => {
    const parsed = parseSessionStatusSnapshot(valid)
    expect(parsed.session.sessionRef).toBe('sess_abc')
    expect(parsed.limits).toHaveLength(0)
  })

  it('rejects unknown fields', () => {
    expect(() => parseSessionStatusSnapshot({ ...valid, extra: true })).toThrow()
  })

  it('rejects credential-shaped keys', () => {
    expect(() => parseSessionStatusSnapshot({
      ...valid,
      runtime: { providerId: 'deepseek', apiKey: 'sk-secret' },
    })).toThrow()
  })

  it('rejects URL and path-shaped values', () => {
    expect(() => parseSessionStatusSnapshot({
      ...valid,
      context: { ...valid.context, safeMessage: 'see https://api.example/secret' },
    })).toThrow()
    expect(() => parseSafeSessionRef('/home/user/session')).toThrow()
    expect(() => parseSafeSessionRef('sess?apikey=sk-x')).toThrow()
  })

  it('rejects more than four limits', () => {
    const limits = Array.from({ length: 5 }, (_, index) => ({
      id: `w${index}`,
      label: `Window ${index}`,
      scope: 'rolling',
      status: 'unsupported',
      safeMessage: 'unsupported',
    }))
    expect(() => parseSessionStatusSnapshot({ ...valid, limits })).toThrow()
  })

  it('rejects a short shape that omits required session identity', () => {
    const { session: _session, ...short } = valid
    expect(() => parseSessionStatusSnapshot(short)).toThrow()
  })
})

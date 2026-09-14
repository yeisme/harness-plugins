import { describe, expect, it } from 'vitest'
import {
  FAILURE_PRESENTATION,
  FAILURE_TAXONOMY_CODES,
  decodeToolFailure,
  deriveCatalogFailureSignals,
  resolveFailurePresentation,
  retryAfterHint,
  type ToolFailureSignal,
} from '../src/client/failure-decode.ts'
import { en, zh } from '../src/client/locales.ts'

const zhText = (key: string): string => (zh as unknown as Record<string, string>)[key] ?? key
const enText = (key: string): string => (en as unknown as Record<string, string>)[key] ?? key

describe('frozen taxonomy snapshot', () => {
  it('keeps the seven frozen codes and one explicit undecoded state', () => {
    expect([...FAILURE_TAXONOMY_CODES]).toEqual([
      'unauthenticated',
      'permission_denied_or_unknown_action',
      'approval_required',
      'budget_exceeded',
      'rate_limited',
      'upstream_unavailable',
      'protocol_error',
    ])
    for (const code of FAILURE_TAXONOMY_CODES) {
      expect(FAILURE_PRESENTATION[code].taxonomyCode).toBe(code)
      expect(FAILURE_PRESENTATION[code].titleKey).toBe(`failure.code.${code}.title`)
    }
  })

  it.each([
    ['unauthenticated', { kind: 'tool-activity', errorCode: '401', errorName: 'Unauthorized' }],
    ['unauthenticated', { kind: 'tool-activity', errorCode: 'TOKEN_INVALID' }],
    ['permission_denied_or_unknown_action', { kind: 'tool-activity', errorCode: '403' }],
    ['permission_denied_or_unknown_action', { kind: 'tool-activity', errorName: 'Forbidden' }],
    ['approval_required', { kind: 'tool-activity', errorCode: 'approval_required' }],
    ['budget_exceeded', { kind: 'tool-activity', errorCode: '402', errorName: 'quota exceeded' }],
    ['rate_limited', { kind: 'tool-activity', errorCode: '429', errorName: 'Too Many Requests' }],
    ['rate_limited', { kind: 'tool-activity', errorName: 'rate limit exceeded' }],
    ['upstream_unavailable', { kind: 'tool-activity', errorCode: '503' }],
    ['upstream_unavailable', { kind: 'tool-activity', errorName: 'upstream connect timeout' }],
    ['upstream_unavailable', { kind: 'tool-activity', errorName: 'connection refused' }],
    ['protocol_error', { kind: 'tool-activity', errorCode: '-32601' }],
    ['protocol_error', { kind: 'tool-activity', errorCode: '-32700' }],
  ] as const)('decodes %s from %j', (code, signal) => {
    expect(decodeToolFailure(signal as ToolFailureSignal).taxonomyCode).toBe(code)
  })

  it('passes gateway taxonomy literals through verbatim', () => {
    expect(decodeToolFailure({ kind: 'tool-activity', errorCode: 'upstream_unavailable' }).taxonomyCode).toBe('upstream_unavailable')
    expect(decodeToolFailure({ kind: 'tool-activity', errorName: 'permission_denied_or_unknown_action' }).taxonomyCode).toBe('permission_denied_or_unknown_action')
  })

  it('fails closed to undecoded for unknown, missing, and out-of-gate inputs', () => {
    expect(decodeToolFailure({ kind: 'tool-activity', errorCode: 'EPONYMOUS_FAILURE' }).taxonomyCode).toBe('undecoded')
    const missing = decodeToolFailure({ kind: 'tool-activity' })
    expect(missing.taxonomyCode).toBe('undecoded')
    expect(missing.rawSignal).toBeUndefined()
    // Out-of-gate text was dropped by the safe gate: nothing to display, never a guess.
    const outOfGate = decodeToolFailure({ kind: 'tool-activity', errorCode: `x${'a'.repeat(200)}` })
    expect(outOfGate.taxonomyCode).toBe('undecoded')
    expect(outOfGate.rawSignal).toBeUndefined()
    expect(decodeToolFailure({ kind: 'tool-hub-client-error', code: 'endpoint_not_found' }).taxonomyCode).toBe('undecoded')
    expect(decodeToolFailure({ kind: 'tool-hub-client-error', code: 'catalog_unavailable' }).taxonomyCode).toBe('undecoded')
  })

  it('shows the bounded raw signal only for undecoded', () => {
    const decoded = decodeToolFailure({ kind: 'tool-activity', errorCode: 'EPONYMOUS_FAILURE', errorName: 'Mystery' })
    expect(decoded).toEqual({ taxonomyCode: 'undecoded', rawSignal: 'EPONYMOUS_FAILURE Mystery' })
    expect(decodeToolFailure({ kind: 'tool-activity', errorCode: '403' }).rawSignal).toBeUndefined()
  })

  it('maps structured toolHub auth causes and undecodes distinction-lost accessDenied', () => {
    expect(decodeToolFailure({ kind: 'tool-hub-client-error', code: 'unknown', accessDenied: true, authCause: 'unauthenticated' }).taxonomyCode).toBe('unauthenticated')
    expect(decodeToolFailure({ kind: 'tool-hub-client-error', code: 'unknown', accessDenied: true, authCause: 'permission_denied' }).taxonomyCode).toBe('permission_denied_or_unknown_action')
    const lost = decodeToolFailure({ kind: 'tool-hub-client-error', code: 'unknown', accessDenied: true })
    expect(lost.taxonomyCode).toBe('undecoded')
    expect(lost.rawSignal).toBe('unknown')
  })

  it('derives empty-tools signals only from health-gated connected servers', () => {
    const item = (over: Record<string, unknown>) => ({ family: 'mcp', name: 'github', server: 'github', ...over })
    const state = {
      status: 'ready',
      catalog: {
        healthAvailable: true,
        items: [item({ health: { state: 'connected' }, toolCount: 0 }), item({ health: { state: 'connected' }, toolCount: 4 }), item({ health: { state: 'disconnected' }, toolCount: 0 }), item({ family: 'native', toolCount: 0 })],
      },
    }
    expect(deriveCatalogFailureSignals(state as never)).toEqual([{ kind: 'empty-tools', serverId: 'github' }])
    const noHealth = { status: 'ready', catalog: { healthAvailable: false, items: [item({ health: { state: 'connected' }, toolCount: 0 })] } }
    expect(deriveCatalogFailureSignals(noHealth as never)).toEqual([])
    expect(deriveCatalogFailureSignals({ status: 'unavailable', code: 'catalog_unavailable' })).toEqual([])
    expect(deriveCatalogFailureSignals({ status: 'error', code: 'host_unavailable' })).toEqual([{ kind: 'tool-hub-client-error', code: 'host_unavailable' }])
    expect(deriveCatalogFailureSignals({ status: 'error', code: 'unknown', accessDenied: true, authCause: 'permission_denied' })).toEqual([{ kind: 'tool-hub-client-error', code: 'unknown', accessDenied: true, authCause: 'permission_denied' }])
  })
})

// Root-repo frozen contract (existence oracle): the merged state must stay
// one indistinguishable presentation. Any split — cause/hit-reason field or
// forked copy — must turn this suite red instead of drifting silently.
describe('merged-state contract', () => {
  const forbidden403 = decodeToolFailure({ kind: 'tool-activity', errorCode: '403', errorName: 'Forbidden' })
  const forbiddenEmpty = decodeToolFailure({ kind: 'empty-tools', serverId: 'github' })
  const forbiddenUnknownAction = decodeToolFailure({ kind: 'tool-activity', errorCode: 'unknown_action' })

  it('decodes all three trigger signals to one frozen constant', () => {
    expect(forbidden403).toBe(forbiddenEmpty)
    expect(forbiddenEmpty).toBe(forbiddenUnknownAction)
    expect(forbidden403).toBe(decodeToolFailure({ kind: 'empty-tools', serverId: 'another-server' }))
  })

  it('carries no key from which the trigger condition could be reconstructed', () => {
    for (const decoded of [forbidden403, forbiddenEmpty, forbiddenUnknownAction]) {
      expect(Object.keys(decoded).sort()).toEqual(['taxonomyCode'])
    }
  })

  it('renders deep-equal presentation in zh and en', () => {
    const presentations = [forbidden403, forbiddenEmpty, forbiddenUnknownAction].map(decoded => resolveFailurePresentation(decoded.taxonomyCode as 'permission_denied_or_unknown_action', zhText))
    expect(presentations[0]).toEqual(presentations[1])
    expect(presentations[1]).toEqual(presentations[2])
    expect(presentations[0].nextActions).toHaveLength(3)
    expect(presentations[0].likelyCauses).toHaveLength(3)
    const english = [forbidden403, forbiddenEmpty, forbiddenUnknownAction].map(decoded => resolveFailurePresentation(decoded.taxonomyCode as 'permission_denied_or_unknown_action', enText))
    expect(english[0]).toEqual(english[1])
    expect(english[1]).toEqual(english[2])
  })

  it('shares one presentation vocabulary object for the merged code', () => {
    const shared = FAILURE_PRESENTATION.permission_denied_or_unknown_action
    for (const code of FAILURE_TAXONOMY_CODES) {
      const vocabulary = FAILURE_PRESENTATION[code]
      if (code === 'permission_denied_or_unknown_action') expect(vocabulary).toBe(shared)
      else expect(vocabulary).not.toBe(shared)
    }
  })

  it('keeps undecoded copy free of any taxonomy code wording', () => {
    for (const text of [zhText, enText]) {
      const title = text('failure.undecoded.title')
      const hint = text('failure.undecoded.hint')
      for (const code of FAILURE_TAXONOMY_CODES) {
        expect(`${title}${hint}`).not.toContain(code)
      }
    }
  })
})

describe('bounded retry_after_seconds', () => {
  it('carries the owner-declared value only for rate/budget codes', () => {
    expect(decodeToolFailure({ kind: 'tool-activity', errorCode: '429', retryAfterSeconds: 30 })).toEqual({ taxonomyCode: 'rate_limited', retryAfterSeconds: 30 })
    expect(decodeToolFailure({ kind: 'tool-activity', errorCode: '402', retryAfterSeconds: 60 })).toEqual({ taxonomyCode: 'budget_exceeded', retryAfterSeconds: 60 })
    expect('retryAfterSeconds' in decodeToolFailure({ kind: 'tool-activity', errorCode: '429' })).toBe(false)
    expect('retryAfterSeconds' in decodeToolFailure({ kind: 'tool-activity', errorCode: '403', retryAfterSeconds: 30 })).toBe(false)
  })

  it('drops non-finite or negative values instead of fabricating', () => {
    expect('retryAfterSeconds' in decodeToolFailure({ kind: 'tool-activity', errorCode: '429', retryAfterSeconds: Number.NaN })).toBe(false)
    expect('retryAfterSeconds' in decodeToolFailure({ kind: 'tool-activity', errorCode: '429', retryAfterSeconds: -5 })).toBe(false)
  })

  it('bounds the hint: exact within 3600, qualitative above, nothing when absent', () => {
    expect(retryAfterHint(undefined)).toBeUndefined()
    expect(retryAfterHint(0)).toEqual({ kind: 'exact', seconds: 0 })
    expect(retryAfterHint(3600)).toEqual({ kind: 'exact', seconds: 3600 })
    expect(retryAfterHint(3601)).toEqual({ kind: 'qualitative' })
    expect(retryAfterHint(86_400)).toEqual({ kind: 'qualitative' })
  })
})

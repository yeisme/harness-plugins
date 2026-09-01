import { describe, expect, expectTypeOf, it } from 'vitest'
import { probeCapability as contractProbe, type ProbeResult as ContractProbeResult, type SafeProjectionMeta, type BoundedSummary } from '@yeisme/dsh-plugin-contracts'
import { degradeReason, probeCapability as mirrorProbe } from '../src/probe.js'
import type { ProbeResult as MirrorProbeResult } from '../src/probe.js'
import type { ExampleWireSnapshot } from '../src/wire.js'

/**
 * 防漂移 parity（G21 §3.1）：本包源内镜像的 probe 三态必须与
 * packages/sdk/dsh-plugin-contracts 的合同行为一致、形状可互换；
 * wire 投影形状必须落在 SafeProjectionMeta/BoundedSummary 合同内。
 */
describe('probe mirror vs @yeisme/dsh-plugin-contracts', () => {
  it('maps undefined to needs_contract identically', () => {
    expect(mirrorProbe(() => undefined)).toEqual(contractProbe(() => undefined))
    expect(mirrorProbe(() => undefined)).toEqual({ status: 'needs_contract' })
  })

  it('maps thrown errors to unavailable with the message as reason, identically', () => {
    const boom = (): never => {
      throw new Error('demo seam offline')
    }
    expect(mirrorProbe(boom)).toEqual(contractProbe(boom))
    expect(mirrorProbe(boom)).toEqual({ status: 'unavailable', reason: 'demo seam offline' })
  })

  it('passes values through as available identically (falsy values included)', () => {
    expect(mirrorProbe(() => 0)).toEqual(contractProbe(() => 0))
    expect(mirrorProbe(() => ({ id: 'x' }))).toEqual({ status: 'available', capability: { id: 'x' } })
    expect(mirrorProbe(() => 'seam')).toEqual({ status: 'available', capability: 'seam' })
  })

  it('keeps the result type interchangeable with the contract type', () => {
    expectTypeOf<MirrorProbeResult<{ id: string }>>().toEqualTypeOf<ContractProbeResult<{ id: string }>>()
  })
})

describe('degradeReason', () => {
  it('states needs_contract without inventing a host', () => {
    expect(degradeReason({ status: 'needs_contract' })).toBe('seam not shipped in this host (needs_contract)')
  })

  it('carries the sanitized error message for unavailable', () => {
    expect(degradeReason({ status: 'unavailable', reason: 'bridge offline' })).toBe('seam unavailable: bridge offline')
  })
})

describe('wire projection shapes stay inside the sdk contract', () => {
  it('meta is assignable to SafeProjectionMeta (narrowed freshness is allowed)', () => {
    const meta: ExampleWireSnapshot['meta'] = { freshness: 'fresh', version: 'v3' }
    const asContract: SafeProjectionMeta = meta
    expect(asContract.freshness).toBe('fresh')
    const unknownMeta: SafeProjectionMeta = { freshness: 'unknown' }
    expect(unknownMeta.freshness).toBe('unknown')
  })

  it('summary matches the BoundedSummary shape', () => {
    const summary: ExampleWireSnapshot['summary'] = { text: 'a, b', truncated: false }
    const asContract: BoundedSummary = summary
    expect(asContract.truncated).toBe(false)
  })
})

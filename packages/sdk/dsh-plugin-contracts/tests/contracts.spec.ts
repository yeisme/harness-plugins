import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { composeDisposers, probeCapability, type Disposable, type Disposer, type ProjectionFreshness, type ProbeResult } from '../src/index.js'

/**
 * 契约防漂移测试（G18 §6.2）：形状冻结（消费方与 sdk 声明不一致即红）
 * + 行为语义（probe 三态 / disposer 幂等）。CI 中与消费试点一起运行，
 * 试点包自身的 typecheck 构成第二层漂移网。
 */
describe('contract shape freeze', () => {
  it('Disposable/Disposer shapes stay structurally frozen', () => {
    expectTypeOf<Disposable>().toMatchTypeOf<{ dispose(): void }>()
    expectTypeOf<Disposer>().toEqualTypeOf<() => void>()
  })

  it('ProjectionFreshness stays the three-state union', () => {
    expectTypeOf<ProjectionFreshness>().toEqualTypeOf<'fresh' | 'stale' | 'unknown'>()
  })

  it('ProbeResult carries capability only when available; reason only when unavailable', () => {
    expectTypeOf<ProbeResult<{ id: string }>>().toEqualTypeOf<
      | { readonly status: 'available'; readonly capability: { id: string } }
      | { readonly status: 'needs_contract' }
      | { readonly status: 'unavailable'; readonly reason: string }
    >()
  })
})

describe('probeCapability', () => {
  it('maps undefined to needs_contract (seam not shipped → no registration)', () => {
    const result = probeCapability(() => undefined)
    expect(result).toEqual({ status: 'needs_contract' })
  })

  it('maps thrown errors to unavailable with message as reason', () => {
    const result = probeCapability<number>(() => {
      throw new Error('bridge offline')
    })
    expect(result).toEqual({ status: 'unavailable', reason: 'bridge offline' })
  })

  it('passes non-undefined values through as available (including falsy)', () => {
    expect(probeCapability(() => 0)).toEqual({ status: 'available', capability: 0 })
    expect(probeCapability(() => 'x')).toEqual({ status: 'available', capability: 'x' })
  })
})

describe('composeDisposers', () => {
  it('runs all disposers in order, exactly once (idempotent)', () => {
    const calls: string[] = []
    const composed = composeDisposers(
      () => calls.push('a'),
      () => calls.push('b'),
    )
    composed()
    composed()
    expect(calls).toEqual(['a', 'b'])
  })

  it('keeps the disposer shape usable as SubscribeFace return', () => {
    const off = composeDisposers(() => {})
    expectTypeOf(off).toEqualTypeOf<Disposer>()
    const listener = vi.fn()
    const face: { subscribe(listener: () => void): Disposer } = { subscribe: () => off }
    face.subscribe(listener)
    expect(listener).not.toHaveBeenCalled()
  })
})

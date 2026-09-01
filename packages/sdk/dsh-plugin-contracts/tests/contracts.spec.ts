import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { browserPreferenceStorage, composeDisposers, probeCapability, subscriptionHandle, type Disposable, type Disposer, type PreferenceStorage, type ProjectionFreshness, type ProbeResult } from '../src/index.js'

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

describe('browserPreferenceStorage', () => {
  it('keeps the preference face structurally frozen (getItem/setItem only)', () => {
    expectTypeOf<PreferenceStorage>().toMatchTypeOf<{
      getItem(key: string): string | null
      setItem(key: string, value: string): void
    }>()
  })

  it('returns the global storage face when present', () => {
    const storage: PreferenceStorage = { getItem: () => 'append', setItem: () => {} }
    vi.stubGlobal('localStorage', storage)
    try {
      expect(browserPreferenceStorage()).toBe(storage)
      const probed = probeCapability(browserPreferenceStorage)
      expect(probed).toEqual({ status: 'available', capability: storage })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('maps a missing storage global to needs_contract via the probe (in-process degradation)', () => {
    vi.stubGlobal('localStorage', undefined)
    try {
      expect(browserPreferenceStorage()).toBeUndefined()
      expect(probeCapability(browserPreferenceStorage)).toEqual({ status: 'needs_contract' })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('swallows storage access errors instead of throwing (never fake available)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      expect(browserPreferenceStorage()).toBeUndefined()
      expect(probeCapability(browserPreferenceStorage)).toEqual({ status: 'needs_contract' })
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage
      vi.unstubAllGlobals()
    }
  })
})

describe('subscriptionHandle', () => {
  it('gives a single subscription an idempotent, named unsubscribe face', () => {
    const calls: string[] = []
    const handle = subscriptionHandle(() => calls.push('off'))
    expectTypeOf(handle).toMatchTypeOf<Disposable>()
    handle.unsubscribe()
    handle.unsubscribe()
    handle.dispose()
    expect(calls).toEqual(['off'])
  })

  it('keeps the handle usable as a SubscribeFace release shape', () => {
    const off = vi.fn()
    const handle = subscriptionHandle(off)
    handle.unsubscribe()
    expectTypeOf(handle.unsubscribe).toEqualTypeOf<() => void>()
    expect(off).toHaveBeenCalledTimes(1)
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

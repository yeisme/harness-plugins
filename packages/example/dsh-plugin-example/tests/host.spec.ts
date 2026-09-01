import { describe, expect, it, vi } from 'vitest'
import { apply, ExampleHostService } from '../src/index.js'
import type { ExampleWireSnapshot } from '../src/index.js'

/**
 * HOST 层参考面：fail-closed 探测 + 有界折叠服务 + dispose 对称。
 * fake ctx 只实现被结构化探测的面（get/effect），不伪造 cordis。
 */

function makeCtx(overrides: Record<string, unknown> = {}) {
  const effects: Array<() => void> = []
  const ctx = {
    get: (name: string): unknown => {
      if (name in overrides) {
        const value = overrides[name]
        if (typeof value === 'function') return value()
        return value
      }
      return undefined
    },
    effect: (register: () => () => void): (() => void) => {
      const dispose = register()
      effects.push(dispose)
      return dispose
    },
  }
  return { ctx, effects }
}

describe('ExampleHostService', () => {
  it('starts unknown and flips to fresh with a monotonic version on first observe', () => {
    const service = new ExampleHostService()
    expect(service.snapshot()).toEqual({ meta: { freshness: 'unknown' }, summary: { text: '', truncated: false } })
    service.observe('first')
    expect(service.snapshot().meta).toEqual({ freshness: 'fresh', version: 'v1' })
    service.observe('second')
    expect(service.snapshot().meta).toEqual({ freshness: 'fresh', version: 'v2' })
  })

  it('keeps the summary bounded: entry bound, ring bound and total truncation', () => {
    const service = new ExampleHostService()
    const long = 'x'.repeat(500)
    service.observe(long)
    expect(service.snapshot().summary.text.length).toBe(64)
    for (let index = 0; index < 20; index += 1) service.observe(`item-${index}`)
    const summary = service.snapshot().summary
    expect(summary.text.startsWith('item-12')).toBe(true)
    expect(summary.text).not.toContain('item-11,')
  })

  it('notifies subscribers with the new snapshot', () => {
    const service = new ExampleHostService()
    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)
    service.observe('hello')
    expect(listener).toHaveBeenCalledTimes(1)
    expect((listener.mock.calls[0]?.[0] as ExampleWireSnapshot).summary.text).toBe('hello')
    unsubscribe()
    service.observe('again')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('dispose is idempotent and stops all writes and listeners', () => {
    const service = new ExampleHostService()
    const listener = vi.fn()
    service.subscribe(listener)
    service.dispose()
    service.dispose()
    service.observe('after-dispose')
    expect(service.snapshot().meta.freshness).toBe('unknown')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('host apply (fail-closed probe)', () => {
  it('registers nothing when the demo seam is absent (needs_contract)', () => {
    const { ctx, effects } = makeCtx()
    expect(() => apply(ctx)).not.toThrow()
    expect(effects).toHaveLength(0)
  })

  it('registers nothing when the seam has the wrong shape (still fail-closed)', () => {
    const { ctx, effects } = makeCtx({ exampleHostSource: { wrongFace: true } })
    expect(() => apply(ctx)).not.toThrow()
    expect(effects).toHaveLength(0)
  })

  it('subscribes through ctx.effect when the seam is available, and releases symmetrically', () => {
    const emits: Array<(payload: string) => void> = []
    let released = false
    const { ctx, effects } = makeCtx({
      exampleHostSource: {
        onExampleEvent: (listener: (payload: string) => void): (() => void) => {
          emits.push(listener)
          return () => {
            released = true
          }
        },
      },
    })
    apply(ctx)
    expect(emits).toHaveLength(1)
    expect(effects).toHaveLength(1)
    emits[0]?.('payload-1')
    effects[0]?.()
    expect(released).toBe(true)
  })

  it('treats a throwing ctx.get as unavailable (honest degrade, no crash)', () => {
    const ctx = {
      get: (): never => {
        throw new Error('registry locked')
      },
      effect: (): (() => void) => () => {},
    }
    expect(() => apply(ctx)).not.toThrow()
  })
})

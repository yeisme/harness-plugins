/**
 * Host 层示例服务：一个 typed、可订阅、可释放的 safe projection 生产方。
 *
 * 只折叠自有演示数据（有界观察序列），不接管 DSH core state、不创建
 * scheduler/ledger/lease；dispose 幂等，dispose 后 observe 为 no-op、
 * 监听清空（dispose-hmr-conformance 的对称性参照形状）。
 */

import type { ExampleWireSnapshot } from '../wire.js'

/** 观察环上限：摘要有界，消费方不得假定无界 */
const RING_BOUND = 8
/** 单条观察截断长度 */
const ENTRY_BOUND = 64
/** 摘要文本上限 */
const SUMMARY_BOUND = 120

export class ExampleHostService {
  private readonly ring: string[] = []
  private generation = 0
  private readonly listeners = new Set<(snapshot: ExampleWireSnapshot) => void>()
  private disposed = false
  private cache: ExampleWireSnapshot | undefined

  /** 折叠一条观察（有界截断），首条观察把 freshness 从 unknown 抬到 fresh。 */
  observe(input: string): void {
    if (this.disposed) return
    const bounded = input.length > ENTRY_BOUND ? input.slice(0, ENTRY_BOUND) : input
    this.ring.push(bounded)
    if (this.ring.length > RING_BOUND) this.ring.shift()
    this.generation += 1
    this.cache = undefined
    this.emit()
  }

  /** 当前快照；形状随版本稳定（同一代内多次调用返回同一引用）。 */
  snapshot(): ExampleWireSnapshot {
    if (this.cache === undefined) {
      this.cache =
        this.ring.length === 0
          ? { meta: { freshness: 'unknown' }, summary: { text: '', truncated: false } }
          : {
              meta: { freshness: 'fresh', version: `v${this.generation}` },
              summary: summarize(this.ring),
            }
    }
    return this.cache
  }

  /** 订阅面：返回取消订阅（SubscribeFace 合同形状）。 */
  subscribe(listener: (snapshot: ExampleWireSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 幂等释放：清空监听，之后一切写入为 no-op。 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.listeners.clear()
  }

  private emit(): void {
    if (this.disposed) return
    const snapshot = this.snapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}

function summarize(ring: readonly string[]): ExampleWireSnapshot['summary'] {
  const full = ring.join(', ')
  return {
    text: full.length > SUMMARY_BOUND ? full.slice(0, SUMMARY_BOUND) : full,
    truncated: full.length > SUMMARY_BOUND,
  }
}

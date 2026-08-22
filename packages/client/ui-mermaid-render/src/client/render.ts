/**
 * mermaid 懒加载渲染器：strict 初始化、hash 缓存（LRU 32）、in-flight 去重、
 * 主题切换清缓存。`import('mermaid')` 在 tsdown CJS 输出中为懒工厂，首图才求值。
 */

import { sanitizeMermaidSvg } from './sanitize.ts'

export type MermaidTheme = 'default' | 'dark'

export interface MermaidRenderer {
  render(code: string): Promise<string>
  setTheme(theme: MermaidTheme): void
  dispose(): void
}

const CACHE_LIMIT = 32

function hashOf(code: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < code.length; i += 1) {
    h ^= code.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${h.toString(16)}-${code.length}`
}

export function createMermaidRenderer(): MermaidRenderer {
  const cache = new Map<string, string>()
  const inflight = new Map<string, Promise<string>>()
  let mod: typeof import('mermaid') | undefined
  let theme: MermaidTheme = 'default'
  let seq = 0

  async function ensure(): Promise<typeof import('mermaid')> {
    if (mod === undefined) {
      mod = await import('mermaid')
      mod.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme })
    }
    return mod
  }

  async function render(code: string): Promise<string> {
    const key = hashOf(code)
    const cached = cache.get(key)
    if (cached !== undefined) return cached
    const pending = inflight.get(key)
    if (pending !== undefined) return pending
    const task = (async () => {
      const m = await ensure()
      seq += 1
      const { svg } = await m.default.render(`dsh-mermaid-${key}-${seq}`, code)
      const clean = sanitizeMermaidSvg(svg)
      cache.set(key, clean)
      if (cache.size > CACHE_LIMIT) {
        const oldest = cache.keys().next()
        if (!oldest.done) cache.delete(oldest.value)
      }
      return clean
    })()
    inflight.set(key, task)
    try {
      return await task
    } finally {
      inflight.delete(key)
    }
  }

  function setTheme(next: MermaidTheme): void {
    if (next === theme) return
    theme = next
    cache.clear()
    if (mod !== undefined) mod.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme })
  }

  function dispose(): void {
    cache.clear()
    inflight.clear()
    mod = undefined
  }

  return { render, setTheme, dispose }
}

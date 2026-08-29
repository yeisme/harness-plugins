// @vitest-environment jsdom
import { apply } from '../../src/client/index.ts'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function fakeCtx(): { ctx: ClientContext; disposeEffects: () => void } {
  const disposers: Array<() => void> = []
  const ctx = {
    effect: (register: () => () => void, _label?: string) => {
      disposers.push(register())
      return () => {}
    },
  } as unknown as ClientContext
  return { ctx, disposeEffects: () => { for (const d of disposers) d() } }
}

beforeAll(() => {
  if (window.localStorage === undefined) {
    const store = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v) },
        removeItem: (k: string) => { store.delete(k) },
        clear: () => { store.clear() },
      },
    })
  }
})

afterEach(() => {
  document.body.innerHTML = ''
  document.head.querySelectorAll('style').forEach((s) => s.remove())
  window.localStorage?.clear?.()
})

describe('apply lifecycle', () => {
  it('mounts the graft layer and restores on dispose', async () => {
    const { ctx, disposeEffects } = fakeCtx()
    const dispose = await apply(ctx)
    expect(document.head.querySelector('style')).not.toBeNull()
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.className = 'language-mermaid'
    code.textContent = 'A-->B'
    pre.append(code)
    document.body.append(pre)
    await sleep(700)
    expect(document.querySelector('figure[data-dsh-mermaid-figure]')).not.toBeNull()
    dispose()
    expect(document.querySelector('figure[data-dsh-mermaid-figure]')).toBeNull()
    expect(pre.style.display).toBe('')
    expect(document.head.querySelector('style')).toBeNull()
    disposeEffects()
  })

  it('disables mermaid only while keeping the independent table enhancer active', async () => {
    window.localStorage.setItem('dsh-mermaid', 'off')
    const { ctx } = fakeCtx()
    await apply(ctx)
    expect(document.head.querySelector('[data-dsh-structured-table-styles]')).not.toBeNull()
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.className = 'language-mermaid'
    code.textContent = 'A-->B'
    pre.append(code)
    document.body.append(pre)
    await sleep(700)
    expect(document.querySelector('figure[data-dsh-mermaid-figure]')).toBeNull()
  })
})

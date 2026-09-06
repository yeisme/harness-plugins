// @vitest-environment jsdom
/**
 * 端到端闭环（jsdom）：文本选区 → 浮动工具条 → 紧凑 Composer → 批注批 →
 * 多位置提案 → 逐位置审批 → 版本围栏应用 receipt。host 侧用内存参考实现。
 */
import { fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import {
  apply,
  COMPOSER_REFERENCE_ADD_EVENT,
  COMPOSER_REFERENCE_ADD_RESULT_EVENT,
  SELECTION_ANNOTATION_POLICY_KEY,
  SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY,
  SELECTION_ANNOTATION_SUBMIT_EVENT,
  SELECTION_INTERACTION_EVIDENCE_EVENT,
  type ComposerReferenceAddDetail,
} from '../../src/client/index.ts'
import { ApprovalPanelController, type ApprovalServiceAdapter } from '../../src/client/approval.ts'
import { createInMemoryVersionedFileStore, createSelectionAnnotationService } from '@yeisme/dsh-selection-host/node'
import { computeQuoteDigest } from '@yeisme/dsh-selection-host'

function makeCtx(): { ctx: ClientContext; dispose: () => void } {
  const disposers: (() => void)[] = []
  const ctx = {
    effect: (register: () => () => void) => {
      disposers.push(register())
      return () => {}
    },
  } as unknown as ClientContext
  return { ctx, dispose: () => disposers.forEach(fn => fn()) }
}

function markRawSource(element: HTMLElement, ref: string, start = 0): void {
  const end = start + new TextEncoder().encode(element.textContent ?? '').byteLength
  element.setAttribute('data-dsh-reference-source', '')
  element.setAttribute('data-dsh-reference-source-owner', 'file-host')
  element.setAttribute('data-dsh-reference-source-ref', ref)
  element.setAttribute('data-dsh-reference-source-version', 'source-v2')
  element.setAttribute('data-dsh-reference-source-scope', 'raw-text')
  element.setAttribute('data-dsh-reference-source-range-start', String(start))
  element.setAttribute('data-dsh-reference-source-range-end', String(end))
}

async function settleSelection(): Promise<void> {
  vi.advanceTimersByTime(300)
  await vi.advanceTimersByTimeAsync(100)
  vi.useRealTimers()
  await new Promise<void>(resolve => setTimeout(resolve, 20))
}

function sourceProof(anchor: { readonly quoteDigest: string; readonly quotePreview: string }, source: { readonly owner: string; readonly ref: string; readonly version: string; readonly scope: string; readonly window: { readonly start: number; readonly end: number } }) {
  return {
    status: 'available' as const,
    reference: {
      id: `selection:${anchor.quoteDigest}`,
      kind: 'selection' as const,
      intent: 'content' as const,
      owner: source.owner,
      ref: source.ref,
      version: source.version,
      label: `${source.ref} · ${source.window.start}-${source.window.end}`,
      scope: source.scope,
      digest: anchor.quoteDigest,
      freshness: 'fresh',
      preview: anchor.quotePreview,
      window: source.window,
    },
  }
}

// jsdom 不内置 localStorage：按 mermaid-render 集成测试的既存桩模式补内存实现。
if (window.localStorage === undefined) {
  const store = new Map<string, string>()
  const stub = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
  }
  // jsdom 单 realm：window 即 globalThis，同一引用防 getter 自递归。
  Object.defineProperty(window, 'localStorage', { configurable: true, value: stub })
  if (globalThis !== window) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: stub })
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  window.localStorage.clear()
})

describe('selection annotation end-to-end flow', () => {
  it('drops a deferred A anchor after B becomes the active selection', async () => {
    vi.useFakeTimers()
    let disposer: (() => void) | undefined
    let dispose: (() => void) | undefined
    try {
      const mounted = makeCtx()
      dispose = mounted.dispose
      const bridge = {
        snapshot: () => ({ available: true, target: { workspaceId: 'workspace', conversationId: 'conversation' } }),
        subscribe: () => () => {},
        resolveSelection: async ({ anchor, source }: { readonly anchor: { readonly quoteDigest: string; readonly quotePreview: string }; readonly source: { readonly owner: string; readonly ref: string; readonly version: string; readonly scope: string; readonly window: { readonly start: number; readonly end: number } } }) => sourceProof(anchor, source),
      }
      ;(mounted.ctx as unknown as { get(name: string): unknown }).get = name => name === SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY ? bridge : undefined
      disposer = await apply(mounted.ctx)
      const first = document.createElement('p')
      first.textContent = 'first selection A'
      markRawSource(first, 'file:first.ts')
      const second = document.createElement('p')
      second.textContent = 'second selection B'
      markRawSource(second, 'file:second.ts')
      document.body.append(first, second)
      const selection = window.getSelection()!
      const firstRange = document.createRange()
      firstRange.selectNodeContents(first)
      selection.removeAllRanges()
      selection.addRange(firstRange)
      vi.advanceTimersByTime(120)
      const secondRange = document.createRange()
      secondRange.selectNodeContents(second)
      selection.removeAllRanges()
      selection.addRange(secondRange)
      document.dispatchEvent(new Event('selectionchange'))
      await settleSelection()
      // jsdom 会异步补发 trailing selectionchange；等 anchor tracker 的失效/
      // 重解析窗口走完再点主动作，否则按钮会短暂消失。
      await new Promise<void>(resolve => setTimeout(resolve, 260))
      await waitFor(() => expect(document.querySelector('button[data-action-id="dsh:reference"]')).not.toBeNull())

      let request: ComposerReferenceAddDetail | undefined
      window.addEventListener(COMPOSER_REFERENCE_ADD_EVENT, event => { request = (event as CustomEvent<ComposerReferenceAddDetail>).detail }, { once: true })
      fireEvent.click(document.querySelector('button[data-action-id="dsh:reference"]') as HTMLButtonElement)
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      expect(request?.reference.ref).toBe('file:second.ts')
    } finally {
      disposer?.()
      dispose?.()
      vi.useRealTimers()
    }
  })

  it('late-injects a bridge and resolves the current selection without reselection', async () => {
    vi.useFakeTimers()
    let disposer: (() => void) | undefined
    let dispose: (() => void) | undefined
    try {
      const mounted = makeCtx()
      dispose = mounted.dispose
      let provider: unknown
      let injectBody: ((sub: ClientContext) => unknown) | undefined
      const ctx = mounted.ctx as unknown as { get(name: string): unknown; inject(services: readonly string[], body: (sub: ClientContext) => unknown): void }
      ctx.get = () => undefined
      ctx.inject = (services, body) => {
        expect(services).toEqual([SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY])
        injectBody = body
      }
      disposer = await apply(mounted.ctx)
      const block = document.createElement('p')
      block.textContent = 'same selection gets a late bridge'
      markRawSource(block, 'file:late.ts')
      document.body.append(block)
      const selection = window.getSelection()!
      const range = document.createRange()
      range.selectNodeContents(block)
      selection.removeAllRanges()
      selection.addRange(range)
      await settleSelection()
      expect(document.querySelector('button[data-action-id="dsh:reference"]')).toBeNull()

      const unsubscribeFirst = vi.fn()
      provider = {
        snapshot: () => ({ available: true, target: { workspaceId: 'workspace', conversationId: 'conversation' } }),
        subscribe: () => unsubscribeFirst,
        resolveSelection: async ({ anchor, source }: { readonly anchor: { readonly quoteDigest: string; readonly quotePreview: string }; readonly source: { readonly owner: string; readonly ref: string; readonly version: string; readonly scope: string; readonly window: { readonly start: number; readonly end: number } } }) => sourceProof(anchor, source),
      }
      const providerContext = { get: (name: string) => name === SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY ? provider : undefined } as unknown as ClientContext
      const providerCleanup = injectBody?.(providerContext)
      await new Promise<void>(resolve => setTimeout(resolve, 20))
      expect(document.querySelector('button[data-action-id="dsh:reference"]')).not.toBeNull()
      expect(typeof providerCleanup).toBe('function')
      ;(providerCleanup as () => void)()
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      expect(unsubscribeFirst).toHaveBeenCalledTimes(1)
      expect(document.querySelector('button[data-action-id="dsh:reference"]')).toBeNull()

      provider = {
        snapshot: () => ({ available: true, target: { workspaceId: 'workspace', conversationId: 'conversation-new' } }),
        subscribe: () => () => {},
        resolveSelection: async ({ anchor, source }: { readonly anchor: { readonly quoteDigest: string; readonly quotePreview: string }; readonly source: { readonly owner: string; readonly ref: string; readonly version: string; readonly scope: string; readonly window: { readonly start: number; readonly end: number } } }) => sourceProof(anchor, source),
      }
      injectBody?.(providerContext)
      await new Promise<void>(resolve => setTimeout(resolve, 20))
      expect(document.querySelector('button[data-action-id="dsh:reference"]')).not.toBeNull()
    } finally {
      disposer?.()
      dispose?.()
      vi.useRealTimers()
    }
  })

  it('unsubscribes an initially present bridge when its injected provider unloads', async () => {
    vi.useFakeTimers()
    let disposer: (() => void) | undefined
    let dispose: (() => void) | undefined
    try {
      const mounted = makeCtx()
      dispose = mounted.dispose
      const unsubscribe = vi.fn()
      let provider: unknown = {
        snapshot: () => ({ available: true, target: { workspaceId: 'workspace', conversationId: 'conversation' } }),
        subscribe: () => unsubscribe,
        resolveSelection: async ({ anchor, source }: { readonly anchor: { readonly quoteDigest: string; readonly quotePreview: string }; readonly source: { readonly owner: string; readonly ref: string; readonly version: string; readonly scope: string; readonly window: { readonly start: number; readonly end: number } } }) => sourceProof(anchor, source),
      }
      let injectBody: ((sub: ClientContext) => unknown) | undefined
      const ctx = mounted.ctx as unknown as { get(name: string): unknown; inject(services: readonly string[], body: (sub: ClientContext) => unknown): void }
      ctx.get = name => name === SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY ? provider : undefined
      ctx.inject = (services, body) => {
        expect(services).toEqual([SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY])
        injectBody = body
      }
      disposer = await apply(mounted.ctx)
      const block = document.createElement('p')
      block.textContent = 'initial bridge source'
      markRawSource(block, 'file:initial.ts')
      document.body.append(block)
      const selection = window.getSelection()!
      const range = document.createRange()
      range.selectNodeContents(block)
      selection.removeAllRanges()
      selection.addRange(range)
      await settleSelection()
      await waitFor(() => expect(document.querySelector('button[data-action-id="dsh:reference"]')).not.toBeNull())

      const providerContext = { get: (name: string) => name === SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY ? provider : undefined } as unknown as ClientContext
      const providerCleanup = injectBody?.(providerContext)
      provider = undefined
      ;(providerCleanup as () => void)()
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      expect(unsubscribe).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(document.querySelector('button[data-action-id="dsh:reference"]')).toBeNull())
    } finally {
      disposer?.()
      dispose?.()
      vi.useRealTimers()
    }
  })

  it('uses UTF-8 byte offsets across owner-advertised raw text segments', async () => {
    vi.useFakeTimers()
    let disposer: (() => void) | undefined
    let dispose: (() => void) | undefined
    try {
      const mounted = makeCtx()
      dispose = mounted.dispose
      let resolvedWindow: { readonly start: number; readonly end: number } | undefined
      const bridge = {
        snapshot: () => ({ available: true, target: { workspaceId: 'workspace', conversationId: 'conversation' } }),
        subscribe: () => () => {},
        resolveSelection: async ({ anchor, source }: { readonly anchor: { readonly quoteDigest: string; readonly quotePreview: string }; readonly source: { readonly owner: string; readonly ref: string; readonly version: string; readonly scope: string; readonly window: { readonly start: number; readonly end: number } } }) => {
          resolvedWindow = source.window
          return sourceProof(anchor, source)
        },
      }
      ;(mounted.ctx as unknown as { get(name: string): unknown }).get = name => name === SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY ? bridge : undefined
      disposer = await apply(mounted.ctx)
      const first = document.createElement('span')
      first.textContent = 'A😀'
      markRawSource(first, 'file:emoji.txt', 0)
      const second = document.createElement('span')
      second.textContent = '猫B'
      markRawSource(second, 'file:emoji.txt', new TextEncoder().encode(first.textContent).byteLength)
      document.body.append(first, second)
      const selection = window.getSelection()!
      const range = document.createRange()
      range.setStart(first.firstChild!, 1)
      range.setEnd(second.firstChild!, 1)
      selection.removeAllRanges()
      selection.addRange(range)
      await settleSelection()
      expect(resolvedWindow).toEqual({ start: 1, end: 8 })
      expect(document.querySelector('button[data-action-id="dsh:reference"]')).not.toBeNull()
    } finally {
      disposer?.()
      dispose?.()
      vi.useRealTimers()
    }
  })

  it('rejects transformed or non-decimal raw source mappings before calling the resolver', async () => {
    vi.useFakeTimers()
    let disposer: (() => void) | undefined
    let dispose: (() => void) | undefined
    try {
      const mounted = makeCtx()
      dispose = mounted.dispose
      const resolveSelection = vi.fn(async () => ({ status: 'unavailable' as const, reason: 'should not resolve invalid source' }))
      const bridge = {
        snapshot: () => ({ available: true, target: { workspaceId: 'workspace', conversationId: 'conversation' } }),
        subscribe: () => () => {},
        resolveSelection,
      }
      ;(mounted.ctx as unknown as { get(name: string): unknown }).get = name => name === SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY ? bridge : undefined
      disposer = await apply(mounted.ctx)
      const transformed = document.createElement('p')
      transformed.textContent = 'paragraph'
      markRawSource(transformed, 'file:raw.txt')
      transformed.setAttribute('data-dsh-reference-source-range-end', '60')
      document.body.append(transformed)
      const selection = window.getSelection()!
      const range = document.createRange()
      range.selectNodeContents(transformed)
      selection.removeAllRanges()
      selection.addRange(range)
      await settleSelection()
      expect(resolveSelection).not.toHaveBeenCalled()
      expect(document.querySelector('button[data-action-id="dsh:reference"]')).toBeNull()

      transformed.setAttribute('data-dsh-reference-source-range-end', '9junk')
      document.dispatchEvent(new Event('selectionchange'))
      await new Promise<void>(resolve => setTimeout(resolve, 160))
      expect(resolveSelection).not.toHaveBeenCalled()
    } finally {
      disposer?.()
      dispose?.()
      vi.useRealTimers()
    }
  })

  it('ignores a late receipt from a disposed mount with a different target', async () => {
    let disposeA: (() => void) | undefined
    let disposeB: (() => void) | undefined
    let ctxDisposeA: (() => void) | undefined
    let ctxDisposeB: (() => void) | undefined
    try {
      const requestFor = async (workspaceId: string, conversationId: string, ref: string): Promise<ComposerReferenceAddDetail> => {
        vi.useFakeTimers()
        const mounted = makeCtx()
        if (workspaceId === 'workspace-a') ctxDisposeA = mounted.dispose
        else ctxDisposeB = mounted.dispose
        const bridge = {
          snapshot: () => ({ available: true, target: { workspaceId, conversationId, draftRevision: 1 } }),
          subscribe: () => () => {},
          resolveSelection: async ({ anchor, source }: { readonly anchor: { readonly quoteDigest: string; readonly quotePreview: string }; readonly source: { readonly owner: string; readonly ref: string; readonly version: string; readonly scope: string; readonly window: { readonly start: number; readonly end: number } } }) => sourceProof(anchor, source),
        }
        ;(mounted.ctx as unknown as { get(name: string): unknown }).get = name => name === SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY ? bridge : undefined
        const disposer = await apply(mounted.ctx)
        if (workspaceId === 'workspace-a') disposeA = disposer
        else disposeB = disposer
        const block = document.createElement('p')
        block.textContent = ref
        markRawSource(block, ref)
        document.body.append(block)
        const selection = window.getSelection()!
        const range = document.createRange()
        range.selectNodeContents(block)
        selection.removeAllRanges()
        selection.addRange(range)
        await settleSelection()
        const receipt = new Promise<ComposerReferenceAddDetail>(resolve => window.addEventListener(COMPOSER_REFERENCE_ADD_EVENT, event => resolve((event as CustomEvent<ComposerReferenceAddDetail>).detail), { once: true }))
        fireEvent.click(document.querySelector('button[data-action-id="dsh:reference"]') as HTMLButtonElement)
        return receipt
      }

      const requestA = await requestFor('workspace-a', 'conversation-a', 'file:a.ts')
      disposeA?.()
      ctxDisposeA?.()
      document.body.innerHTML = ''
      const requestB = await requestFor('workspace-b', 'conversation-b', 'file:b.ts')
      expect(requestB.requestId).not.toBe(requestA.requestId)

      window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_ADD_RESULT_EVENT, {
        detail: { version: 1, requestId: requestA.requestId, ok: true, target: requestA.target },
      }))
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      expect(document.querySelector('.sa-feedback')?.textContent).toContain('Adding to chat')

      window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_ADD_RESULT_EVENT, {
        detail: { version: 1, requestId: requestB.requestId, ok: true, target: requestB.target },
      }))
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      expect(document.querySelector('.sa-feedback')?.textContent).toContain(`Added to ${requestB.target.conversationId}`)
    } finally {
      disposeA?.()
      disposeB?.()
      ctxDisposeA?.()
      ctxDisposeB?.()
      vi.useRealTimers()
    }
  })

  it('keeps an unresolvable generic DOM selection disabled even with an explicit target', async () => {
    vi.useFakeTimers()
    let disposer: (() => void) | undefined
    let dispose: (() => void) | undefined
    try {
      const mounted = makeCtx()
      dispose = mounted.dispose
      const bridge = {
        snapshot: () => ({ available: true, target: { workspaceId: 'workspace-fixture', conversationId: 'conversation-fixture' } }),
        subscribe: () => () => {},
        resolveSelection: async () => ({ status: 'unavailable' as const, reason: 'generic DOM selection has no owner-safe source proof' }),
      }
      ;(mounted.ctx as unknown as { get(name: string): unknown }).get = name => name === SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY ? bridge : undefined
      disposer = await apply(mounted.ctx)

      const block = document.createElement('p')
      block.textContent = 'rendered-only selection'
      document.body.append(block)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(block)
      selection?.addRange(range)
      vi.advanceTimersByTime(300)
      await vi.advanceTimersByTimeAsync(100)
      vi.useRealTimers()
      await new Promise<void>(resolve => setTimeout(resolve, 20))

      const actions = document.querySelector('[data-dsh-selection-actions]') as HTMLElement
      const more = actions.querySelector('button[aria-controls="sa-more-panel"]') as HTMLButtonElement
      fireEvent.click(more)
      const reference = document.querySelector('#sa-more-panel button[data-action-id="dsh:reference"]') as HTMLButtonElement
      expect(reference.disabled).toBe(true)
      expect(document.querySelector('#sa-more-panel .sa-reason')?.textContent).toContain('reference source or target unavailable')
    } finally {
      disposer?.()
      dispose?.()
      vi.useRealTimers()
    }
  })

  it('adds a selection only through an explicit reference target and shows a revalidated failure receipt', async () => {
    vi.useFakeTimers()
    let disposer: (() => void) | undefined
    let dispose: (() => void) | undefined
    try {
      const mounted = makeCtx()
      dispose = mounted.dispose
      let target = { workspaceId: 'workspace-fixture', conversationId: 'conversation-fixture', draftRevision: 7 }
      const bridgeListeners = new Set<() => void>()
      let resolvedSource: unknown
      const bridge = {
        snapshot: () => ({ available: true, target }),
        subscribe: (listener: () => void) => {
          bridgeListeners.add(listener)
          return () => { bridgeListeners.delete(listener) }
        },
        resolveSelection: async ({ anchor, source }: { readonly anchor: { readonly quoteDigest: string; readonly quotePreview: string }; readonly source: { readonly window: { readonly start: number; readonly end: number } } }) => {
          resolvedSource = source
          return ({
          status: 'available' as const,
          reference: {
            id: `selection:${anchor.quoteDigest}`,
            kind: 'selection' as const,
            intent: 'content' as const,
            owner: 'file-host',
            ref: 'file:src/fixture.ts',
            version: 'source-v2',
            label: 'fixture.ts · L4',
            scope: 'line:4',
            digest: anchor.quoteDigest,
            freshness: 'fresh',
            preview: anchor.quotePreview,
            window: source.window,
          },
          })
        },
      }
      ;(mounted.ctx as unknown as { get(name: string): unknown }).get = name => name === SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY ? bridge : undefined
      disposer = await apply(mounted.ctx, {
        artifactRef: 'conversation:rendered',
        artifactVersion: 'fixture-v1',
      })
      let request: ComposerReferenceAddDetail | undefined
      const onAdd = (event: Event): void => {
        request = (event as CustomEvent<ComposerReferenceAddDetail>).detail
        window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_ADD_RESULT_EVENT, {
          detail: { version: 1, requestId: request.requestId, ok: false, reason: 'target-unavailable', target: request.target },
        }))
      }
      window.addEventListener(COMPOSER_REFERENCE_ADD_EVENT, onAdd, { once: true })

      const origin = document.createElement('button')
      origin.textContent = 'selection origin'
      document.body.append(origin)
      origin.focus()
      const block = document.createElement('p')
      block.textContent = 'selection that needs an explicit conversation reference'
      block.setAttribute('data-dsh-reference-source', '')
      block.setAttribute('data-dsh-reference-source-owner', 'file-host')
      block.setAttribute('data-dsh-reference-source-ref', 'file:src/fixture.ts')
      block.setAttribute('data-dsh-reference-source-version', 'source-v2')
      block.setAttribute('data-dsh-reference-source-scope', 'raw-text')
      block.setAttribute('data-dsh-reference-source-range-start', '0')
      block.setAttribute('data-dsh-reference-source-range-end', String(new TextEncoder().encode(block.textContent).byteLength))
      document.body.append(block)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(block)
      selection?.addRange(range)
      vi.advanceTimersByTime(300)
      await vi.advanceTimersByTimeAsync(100)
      // quote digest uses the platform crypto task queue, outside fake timers.
      vi.useRealTimers()
      await new Promise<void>(resolve => setTimeout(resolve, 20))

      const actions = document.querySelector('[data-dsh-selection-actions]') as HTMLElement
      expect(actions).not.toBeNull()
      const reference = actions.querySelector('button[data-action-id="dsh:reference"]') as HTMLButtonElement
      expect(reference).not.toBeNull()
      expect(reference.textContent).toBe('Add to chat')
      target = { ...target, draftRevision: 8 }
      for (const listener of bridgeListeners) listener()
      await new Promise<void>(resolve => setTimeout(resolve, 20))
      fireEvent.click(actions.querySelector('button[data-action-id="dsh:reference"]') as HTMLButtonElement)
      await new Promise<void>(resolve => setTimeout(resolve, 0))

      expect(request).toMatchObject({
        version: 1,
        target: { workspaceId: 'workspace-fixture', conversationId: 'conversation-fixture', draftRevision: 8 },
        reference: { kind: 'selection', intent: 'content', owner: 'file-host', ref: 'file:src/fixture.ts', version: 'source-v2', scope: 'line:4', window: { start: 0 } },
      })
      expect(resolvedSource).toMatchObject({ owner: 'file-host', ref: 'file:src/fixture.ts', version: 'source-v2', scope: 'raw-text', window: { start: 0 } })
      expect(request?.reference.preview).toContain('explicit conversation reference')
      expect(document.querySelector('.sa-feedback')?.textContent).toContain('target conversation is unavailable')
      expect(document.querySelector('[data-dsh-selection-actions]')?.getAttribute('style')).toContain('display: block')
      expect(document.activeElement).toBe(origin)
    } finally {
      disposer?.()
      dispose?.()
      vi.useRealTimers()
    }
  })

  it('runs selection -> stable Actions -> explicit ask -> composer -> v2 submit event', async () => {
    vi.useFakeTimers()
    try {
      const sends: { intent: string; text: string; approvalPolicy: string }[] = []
      const { ctx, dispose } = makeCtx()
      const disposer = await apply(ctx, { composerAdapter: { send: async input => { sends.push(input) } } })
      // V2 默认：不再有 V1 私有工具条，Actions 由全局交互层渲染。
      expect(document.querySelector('.dsh-selection-toolbar')).toBeNull()
      const actions = document.querySelector('[data-dsh-selection-actions]') as HTMLElement
      expect(actions).not.toBeNull()
      expect(actions.style.display).toBe('none')

      const block = document.createElement('p')
      block.textContent = 'Agent 回复中的可选中段落'
      document.body.append(block)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(block)
      Object.assign(range, {
        getBoundingClientRect: () => ({ top: 160, left: 320, width: 240, height: 28 }),
      })
      selection?.addRange(range)

      const submitted = new Promise<CustomEvent>((resolve) => {
        window.addEventListener(SELECTION_ANNOTATION_SUBMIT_EVENT, event => resolve(event as CustomEvent), { once: true })
      })

      // 未稳定前不渲染 Actions。
      vi.advanceTimersByTime(50)
      expect(actions.style.display).toBe('none')
      vi.advanceTimersByTime(200)
      await vi.advanceTimersByTimeAsync(50)
      expect(actions.style.display).toBe('block')

      const composerOverlay = document.querySelector('.dsh-selection-composer') as HTMLElement
      expect(composerOverlay).not.toBeNull()
      // 只有显式动作才打开 Composer；ask 是 primary。
      const askButton = actions.querySelector('button[data-action-id="dsh:ask"]') as HTMLButtonElement
      expect(askButton).not.toBeNull()
      fireEvent.click(askButton)
      expect(composerOverlay.style.display).toBe('block')
      expect(document.activeElement).toBe(composerOverlay.querySelector('textarea'))
      const injectedStyles = document.getElementById('dsh-selection-annotation-styles')?.textContent
      expect(injectedStyles).toContain('[data-dsh-selection-composer].dsh-selection-composer')
      expect(injectedStyles).toContain('[data-dsh-selection-composer].dsh-selection-composer,[data-dsh-selection-composer] *{transition:none!important;animation:none!important}')
      expect(composerOverlay.querySelector('.dsh-selection-composer__quote')?.textContent).toContain('Agent 回复中的可选中段落')
      expect(composerOverlay.querySelectorAll('.dsh-selection-composer__preset').length).toBeGreaterThanOrEqual(3)
      const sendButton = composerOverlay.querySelector('button[data-action="send"]') as HTMLButtonElement
      expect(sendButton.disabled).toBe(true)

      const textarea = composerOverlay.querySelector('textarea') as HTMLTextAreaElement
      fireEvent.input(textarea, { target: { value: '这一段在说什么？' } })
      expect(sendButton.disabled).toBe(false)
      fireEvent.click(sendButton)
      await vi.advanceTimersByTimeAsync(50)

      const event = await submitted
      const detail = event.detail as { intent: string; text: string; approvalPolicy: string; policyVersion?: string; canonicalActionId?: string; contextKind?: string }
      expect(detail.intent).toBe('ask')
      expect(detail.text).toBe('这一段在说什么？')
      expect(detail.approvalPolicy).toBe('preview-first')
      expect(detail.policyVersion).toBe('v2')
      expect(detail.canonicalActionId).toBe('dsh:ask')
      expect(detail.contextKind).toBe('text')
      expect(sends).toHaveLength(1)
      expect(sends[0].approvalPolicy).toBe('preview-first')

      // Esc 依次关闭 Composer（回 Actions）与 Actions。
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      expect(composerOverlay.style.display).toBe('none')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      expect(actions.style.display).toBe('none')
      disposer()
      dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes the composer with Escape from the textarea (v2: layer returns to actions)', async () => {
    vi.useFakeTimers()
    try {
      const { ctx, dispose } = makeCtx()
      const disposer = await apply(ctx, { composerAdapter: { send: async () => {} } })
      const block = document.createElement('p')
      block.textContent = 'keyboard flow paragraph'
      document.body.append(block)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(block)
      selection?.addRange(range)
      vi.advanceTimersByTime(250)
      const actions = document.querySelector('[data-dsh-selection-actions]') as HTMLElement
      const composerOverlay = document.querySelector('.dsh-selection-composer') as HTMLElement
      const askButton = actions.querySelector('button[data-action-id="dsh:ask"]') as HTMLButtonElement
      askButton.focus()
      fireEvent.click(askButton)
      expect(composerOverlay.style.display).toBe('block')
      const textarea = composerOverlay.querySelector('textarea') as HTMLTextAreaElement
      fireEvent.keyDown(textarea, { key: 'Escape', bubbles: true, cancelable: true })
      expect(composerOverlay.style.display).toBe('none')
      expect(document.activeElement?.getAttribute('data-action-id')).toBe('dsh:ask')
      // Composer 关闭后 Actions 仍可恢复（逐层退出），再一次 Esc 才收起。
      expect(actions.style.display).toBe('block')
      disposer()
      dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('turns an error selection into diagnose/fix presets and supports Ctrl+Enter', async () => {
    vi.useFakeTimers()
    try {
      const sends: string[] = []
      const { ctx, dispose } = makeCtx()
      const disposer = await apply(ctx, { composerAdapter: { send: async input => { sends.push(input.text) } } })
      const block = document.createElement('p')
      block.textContent = "Cannot read properties of undefined (reading 'prepare')"
      document.body.append(block)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(block)
      selection?.addRange(range)
      vi.advanceTimersByTime(250)
      await vi.advanceTimersByTimeAsync(50)

      const actions = document.querySelector('[data-dsh-selection-actions]') as HTMLElement
      const diagnose = actions.querySelector('button[data-action-id="dsh:ask"]') as HTMLButtonElement
      expect(diagnose.textContent).toBe('Diagnose')
      fireEvent.click(diagnose)

      const composerOverlay = document.querySelector('.dsh-selection-composer') as HTMLElement
      const initialPosition = { left: composerOverlay.style.left, top: composerOverlay.style.top }
      const diagnosePreset = composerOverlay.querySelector('button[data-preset="diagnose"]') as HTMLButtonElement
      const fixPreset = composerOverlay.querySelector('button[data-preset="fix"]') as HTMLButtonElement
      expect(diagnosePreset).not.toBeNull()
      expect(fixPreset).not.toBeNull()
      selection?.removeAllRanges()
      fireEvent.click(diagnosePreset)
      expect({ left: composerOverlay.style.left, top: composerOverlay.style.top }).toEqual(initialPosition)
      const initialWidth = window.innerWidth
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
      window.dispatchEvent(new Event('resize'))
      expect(composerOverlay.style.maxHeight).toBe('')
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: initialWidth })
      window.dispatchEvent(new Event('resize'))
      const textarea = composerOverlay.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea.value).toContain('Diagnose the root cause')
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })
      await vi.advanceTimersByTimeAsync(50)
      expect(sends).toEqual([expect.stringContaining('Diagnose the root cause')])

      disposer()
      dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses the active DSH locale instead of navigator.language', async () => {
    vi.useFakeTimers()
    try {
      const { ctx, dispose } = makeCtx()
      ;(ctx as unknown as { get(name: string): unknown }).get = name => name === 'locale'
        ? { getLocale: () => ({ active: 'zh' }) }
        : undefined
      const disposer = await apply(ctx, { composerAdapter: { send: async () => {} } })
      const block = document.createElement('p')
      block.textContent = '错误：无法读取 prepare'
      document.body.append(block)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(block)
      selection?.addRange(range)
      vi.advanceTimersByTime(250)
      await vi.advanceTimersByTimeAsync(50)
      const diagnose = document.querySelector('button[data-action-id="dsh:ask"]') as HTMLButtonElement
      expect(diagnose.textContent).toBe('诊断')
      fireEvent.click(diagnose)
      expect(document.querySelector('.dsh-selection-composer__eyebrow')?.textContent).toContain('当前选区 · 错误')
      disposer()
      dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('v1 adapter renders the legacy toolbar with a deprecated evidence marker and rolls back cleanly', async () => {
    vi.useFakeTimers()
    try {
      window.localStorage.setItem(SELECTION_ANNOTATION_POLICY_KEY, 'v1')
      const evidences: unknown[] = []
      const collect = (event: Event): void => { evidences.push((event as CustomEvent).detail) }
      window.addEventListener(SELECTION_INTERACTION_EVIDENCE_EVENT, collect)
      const { ctx, dispose } = makeCtx()
      const disposer = await apply(ctx)
      try {
        // V1 adapter：旧工具条回归 + deprecated 脱敏标记。
        const toolbar = document.querySelector('.dsh-selection-toolbar') as HTMLElement
        expect(toolbar).not.toBeNull()
        expect(document.querySelector('[data-dsh-selection-actions]')).toBeNull()
        expect(evidences).toContainEqual({ policyVersion: 'v1', capability: 'selection.interaction.v2', result: 'v1-adapter-active', deprecated: true })

        // 回滚验证：移除策略后重新 apply，V2 回归且切回不丢当前选区。
        window.localStorage.removeItem(SELECTION_ANNOTATION_POLICY_KEY)
        disposer()
        const { ctx: ctx2, dispose: dispose2 } = makeCtx()
        const disposer2 = await apply(ctx2)
        try {
          expect(document.querySelector('.dsh-selection-toolbar')).toBeNull()
          const actions = document.querySelector('[data-dsh-selection-actions]') as HTMLElement
          expect(actions).not.toBeNull()
          expect(evidences).toContainEqual({ policyVersion: 'v2', capability: 'selection.interaction.v2', result: 'v2-layer-attached', deprecated: false })
          const block = document.createElement('p')
          block.textContent = 'rollback keeps selection context'
          document.body.append(block)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          const range = document.createRange()
          range.selectNodeContents(block)
          selection?.addRange(range)
          vi.advanceTimersByTime(250)
          expect(actions.style.display).toBe('block')
        } finally {
          disposer2()
          dispose2()
        }
      } finally {
        window.removeEventListener(SELECTION_INTERACTION_EVIDENCE_EVENT, collect)
        window.localStorage.removeItem(SELECTION_ANNOTATION_POLICY_KEY)
        disposer()
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('completes annotation -> proposal -> per-position approval -> fenced apply with receipts', async () => {
    const FILE = 'file:src/page.tsx'
    const { store } = createInMemoryVersionedFileStore({
      [FILE]: ['import React', 'export function Page() {', '  return <footer/>', '}'].join('\n'),
    })
    const service = createSelectionAnnotationService({ fileStore: store })

    // 三个位置的锚点（截图标记形态）。
    const digest = await computeQuoteDigest('shot')
    const anchors = [
      service.publishAnchor({ kind: 'image-point', artifactRef: 'file:shot.png', artifactVersion: 'img-1', quotePreview: '按钮图标不清晰', quoteDigest: digest, x: 0.1, y: 0.05 }),
      service.publishAnchor({ kind: 'image-region', artifactRef: 'file:shot.png', artifactVersion: 'img-1', quotePreview: '编辑模式布局需要调整', quoteDigest: digest, x: 0.2, y: 0.3, width: 0.4, height: 0.2 }),
      service.publishAnchor({ kind: 'image-point', artifactRef: 'file:shot.png', artifactVersion: 'img-1', quotePreview: '这里增加状态反馈', quoteDigest: digest, x: 0.8, y: 0.9 }),
    ]
    const batch = service.submitBatch(service.createBatch({ title: '截图批注', anchorIds: anchors.map(a => a.anchorId) }).batchId)
    const request = service.buildAgentRequest(batch.batchId)
    expect(request.markers.map(m => m.label)).toEqual(['#1', '#2', '#3'])
    expect(request.untrustedContext).toBe(true)

    // Agent 回复引用标记编号并产出多位置提案。
    const version = store.currentVersion(FILE)!
    const patchFooter = service.registerPatch({ artifactRef: FILE, baseVersion: version, ranges: [{ startLine: 3, endLine: 3, replacement: ['  return <footer role="contentinfo"/>'] }] })
    const patchPage = service.registerPatch({ artifactRef: FILE, baseVersion: version, ranges: [{ startLine: 2, endLine: 2, replacement: ['export function Page() { // v2'] }] })
    const proposal = service.createProposal({
      title: '修改提案 · 3 个位置',
      batchId: batch.batchId,
      hunks: [
        { key: 'footer', anchorId: anchors[0].anchorId, owner: 'file-host', baseVersion: version, safeSummary: '#1 Footer icon', patchRef: patchFooter },
        { key: 'page', anchorId: anchors[1].anchorId, owner: 'file-host', baseVersion: version, safeSummary: '#2 Markdown editor', patchRef: patchPage },
        { anchorId: anchors[2].anchorId, owner: 'file-host', baseVersion: version, safeSummary: '#3 Status message', patchRef: patchFooter },
      ],
    })

    const patchesOf = service.patches
    const adapter: ApprovalServiceAdapter = {
      getProposal: async id => service.getProposal(id),
      decide: async (id, hunkId, decision) => service.decide(id, hunkId, decision),
      applyApproved: async id => service.applyApproved(id),
      currentVersion: artifactRef => store.currentVersion(artifactRef),
      artifactRefFor: hunk => patchesOf.get(hunk.patchRef)?.artifactRef,
    }
    const panel = new ApprovalPanelController({ proposalId: proposal.proposalId, adapter })
    let state = await panel.refresh()
    expect(state.rows.map(row => row.marker)).toEqual([1, 2, 3])
    expect(state.rows.every(row => row.decision === 'pending')).toBe(true)

    // 逐位置决策：批准 #1、拒绝 #2、要求重做 #3。
    await panel.decide(state.rows[0].hunkId, 'approved')
    await panel.decide(state.rows[1].hunkId, 'rejected')
    await panel.decide(state.rows[2].hunkId, 'revision_requested')
    state = await panel.refresh()
    expect(state.rows.map(row => row.decision)).toEqual(['approved', 'rejected', 'revision_requested'])

    // 部分批准：只有 #1 应用，#2 不出现在最终写入。
    const receipts = await panel.apply()
    const applied = receipts.filter(r => r.action === 'apply' && r.status === 'ok')
    expect(applied).toHaveLength(1)
    expect(applied[0].resultingVersion).toBeDefined()
    expect(store.readLines(FILE)).toEqual(['import React', 'export function Page() {', '  return <footer role="contentinfo"/>', '}'])

    state = await panel.refresh()
    expect(state.rows.map(row => row.decision)).toEqual(['applied', 'rejected', 'revision_requested'])
    // 批准、拒绝、要求修改、应用都有 owner receipt。
    const all = service.receipts(proposal.proposalId)
    expect(all.filter(r => r.action === 'approve')).toHaveLength(1)
    expect(all.filter(r => r.action === 'reject')).toHaveLength(1)
    expect(all.filter(r => r.action === 'revision')).toHaveLength(1)
    expect(all.filter(r => r.action === 'apply')).toHaveLength(1)
  })

  it('shows version conflict rows when the file drifted while the proposal was open', async () => {
    const FILE = 'file:src/drifting.ts'
    const { store, mutateExternally } = createInMemoryVersionedFileStore({ [FILE]: 'one\ntwo' })
    const service = createSelectionAnnotationService({ fileStore: store })
    const digest = await computeQuoteDigest('drift')
    const anchor = service.publishAnchor({ kind: 'file-range', artifactRef: FILE, artifactVersion: 'v0', quotePreview: 'one', quoteDigest: digest, startLine: 1, endLine: 1, startColumn: 0, endColumn: 3 })
    const version = store.currentVersion(FILE)!
    const patch = service.registerPatch({ artifactRef: FILE, baseVersion: version, ranges: [{ startLine: 1, endLine: 1, replacement: ['ONE'] }] })
    const proposal = service.createProposal({
      title: '漂移提案',
      hunks: [{ anchorId: anchor.anchorId, owner: 'file-host', baseVersion: version, safeSummary: 'upper', patchRef: patch }],
    })
    await service.decide(proposal.proposalId, proposal.hunks[0].hunkId, 'approved')
    mutateExternally(FILE, ['external', 'two'])

    const adapter: ApprovalServiceAdapter = {
      getProposal: async id => service.getProposal(id),
      decide: async (id, hunkId, decision) => service.decide(id, hunkId, decision),
      applyApproved: async id => service.applyApproved(id),
      currentVersion: artifactRef => store.currentVersion(artifactRef),
      artifactRefFor: hunk => service.patches.get(hunk.patchRef)?.artifactRef,
    }
    const panel = new ApprovalPanelController({ proposalId: proposal.proposalId, adapter })
    const state = await panel.refresh()
    expect(state.rows[0].versionConflict).toEqual({ expected: version, actual: store.currentVersion(FILE) })
    expect(state.plan?.appliable).toEqual([])

    const receipts = await panel.apply()
    expect(receipts[0].action).toBe('reconcile')
    expect(receipts[0].status).toBe('conflict')
    expect(store.readLines(FILE)).toEqual(['external', 'two'])
  })
})

// ---------------------------------------------------------------------------
// 添加到对话 / 引用并询问 / 来源详情 / 目标选择（conversation-first actions）
// ---------------------------------------------------------------------------

interface ReferenceFixtureTarget {
  readonly workspaceId: string
  readonly conversationId: string
  readonly draftRevision?: number
  readonly title?: string
}

interface ReferenceFixture {
  readonly disposer: () => void
  readonly dispose: () => void
  readonly addRequests: ComposerReferenceAddDetail[]
  readonly submitDetails: Array<Record<string, unknown>>
  readonly bridge: {
    chooseTarget?: (signal?: AbortSignal) => Promise<unknown>
  }
  readonly source: HTMLElement
  readonly setTarget: (target: ReferenceFixtureTarget) => void
  currentTarget: ReferenceFixtureTarget
}

/** 内存宿主夹具：bridge 快照可携带 features/target，回执由用例手动驱动。 */
async function mountReferenceFixture(options: {
  readonly text?: string
  readonly withSource?: boolean
  readonly features?: { readonly activation?: boolean; readonly chooseTarget?: boolean }
  readonly chooseTarget?: (fixture: { readonly setTarget: (target: ReferenceFixtureTarget) => void }) => (signal?: AbortSignal) => Promise<unknown>
  readonly composerAdapter?: { readonly send: (input: { readonly intent: string; readonly text: string }) => Promise<void> }
} = {}): Promise<ReferenceFixture> {
  const text = options.text ?? 'selection with a structured source proof'
  const fixture = {
    currentTarget: { workspaceId: 'workspace-fixture', conversationId: 'conversation-fixture', title: 'Main Chat' } as ReferenceFixtureTarget,
  }
  const addRequests: ComposerReferenceAddDetail[] = []
  const submitDetails: Array<Record<string, unknown>> = []
  const onAdd = (event: Event): void => { addRequests.push((event as CustomEvent<ComposerReferenceAddDetail>).detail) }
  const onSubmit = (event: Event): void => { submitDetails.push((event as CustomEvent).detail as Record<string, unknown>) }
  window.addEventListener(COMPOSER_REFERENCE_ADD_EVENT, onAdd)
  window.addEventListener(SELECTION_ANNOTATION_SUBMIT_EVENT, onSubmit)
  const mounted = makeCtx()
  const bridgeListeners = new Set<() => void>()
  const setTarget = (target: ReferenceFixtureTarget): void => {
    fixture.currentTarget = target
    for (const listener of bridgeListeners) listener()
  }
  const bridge = {
    snapshot: () => ({
      available: true,
      target: fixture.currentTarget,
      ...(options.features === undefined ? {} : { features: options.features }),
    }),
    subscribe: (listener: () => void) => {
      bridgeListeners.add(listener)
      return () => { bridgeListeners.delete(listener) }
    },
    resolveSelection: async ({ anchor, source }: { readonly anchor: { readonly quoteDigest: string; readonly quotePreview: string }; readonly source: { readonly owner: string; readonly ref: string; readonly version: string; readonly scope: string; readonly window: { readonly start: number; readonly end: number } } }) => sourceProof(anchor, source),
    ...(options.chooseTarget === undefined ? {} : {
      chooseTarget: options.chooseTarget({ setTarget }),
    }),
  }
  ;(mounted.ctx as unknown as { get(name: string): unknown }).get = name => name === SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY ? bridge : undefined
  const disposer = await apply(mounted.ctx, options.composerAdapter === undefined ? undefined : { composerAdapter: options.composerAdapter })
  const block = document.createElement('p')
  block.textContent = text
  if (options.withSource !== false) markRawSource(block, 'file:src/fixture.ts')
  document.body.append(block)
  const selection = window.getSelection()!
  const range = document.createRange()
  range.selectNodeContents(block)
  selection.removeAllRanges()
  selection.addRange(range)
  await settleSelection()
  // jsdom 会异步补发一个 trailing selectionchange；等它完成再交互，避免
  // 用例撞上 anchor tracker 的失效/重解析窗口（120ms 真实计时器 + 解析）。
  await new Promise<void>(resolve => setTimeout(resolve, 260))
  return {
    disposer: () => { disposer(); window.removeEventListener(COMPOSER_REFERENCE_ADD_EVENT, onAdd); window.removeEventListener(SELECTION_ANNOTATION_SUBMIT_EVENT, onSubmit) },
    dispose: mounted.dispose,
    addRequests,
    submitDetails,
    bridge,
    source: block,
    setTarget,
    currentTarget: fixture.currentTarget,
  }
}

function actionsRoot(): HTMLElement {
  return document.querySelector('[data-dsh-selection-actions]') as HTMLElement
}

function actionButton(id: string): HTMLButtonElement | null {
  return actionsRoot().querySelector(`button[data-action-id="${id}"]`)
}

function moreActionButton(id: string): HTMLButtonElement {
  const toggle = actionsRoot().querySelector('button[aria-controls="sa-more-panel"]') as HTMLButtonElement
  if ((document.getElementById('sa-more-panel') as HTMLElement).hidden) fireEvent.click(toggle)
  return document.querySelector(`#sa-more-panel button[data-action-id="${id}"]`) as HTMLButtonElement
}

function receiptFor(request: ComposerReferenceAddDetail, extra: Record<string, unknown> = {}): void {
  window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_ADD_RESULT_EVENT, {
    detail: { version: 1, requestId: request.requestId, ok: true, target: request.target, ...extra },
  }))
}

async function flush(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 20))
}

describe('conversation-first selection actions', () => {
  it('confirms an add with the target title in the receipt feedback', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      fixture = await mountReferenceFixture()
      fireEvent.click(actionButton('dsh:reference') as HTMLButtonElement)
      await flush()
      expect(fixture.addRequests).toHaveLength(1)
      expect(fixture.addRequests[0]?.activation).toBeUndefined()
      receiptFor(fixture.addRequests[0]!)
      await flush()
      expect(document.querySelector('.sa-feedback')?.textContent).toBe('Added to Main Chat')
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('ask-with-reference requests activation and keeps host focus when activated', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      const origin = document.createElement('button')
      origin.textContent = 'origin'
      document.body.append(origin)
      origin.focus()
      fixture = await mountReferenceFixture({ features: { activation: true } })
      const ask = actionButton('dsh:ask-with-reference') as HTMLButtonElement
      expect(ask.disabled).toBe(false)
      fireEvent.click(ask)
      await flush()
      expect(fixture.addRequests).toHaveLength(1)
      expect(fixture.addRequests[0]?.activation).toEqual({ focus: 'composer' })
      receiptFor(fixture.addRequests[0]!, { activated: true })
      await flush()
      expect(document.querySelector('.sa-feedback')?.textContent).toBe('Added to Main Chat; continue your question there')
      // 焦点属于宿主的真实 composer。此内存 bridge 不实现该副作用；插件也
      // 不应在 receipt 后把焦点改写为另一个本地节点。
      expect(document.activeElement).toBe(origin)
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('ask-with-reference without a confirmed activation keeps source focus and says so', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      const origin = document.createElement('button')
      origin.textContent = 'origin'
      document.body.append(origin)
      origin.focus()
      fixture = await mountReferenceFixture({ features: { activation: true } })
      fireEvent.click(actionButton('dsh:ask-with-reference') as HTMLButtonElement)
      await flush()
      // 宿主回执未携带 activated：插件不得宣称已聚焦。
      receiptFor(fixture.addRequests[0]!)
      await flush()
      expect(document.querySelector('.sa-feedback')?.textContent).toBe('Added to Main Chat (host did not confirm focus)')
      expect(document.activeElement).toBe(origin)
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('ask-with-reference failure keeps the selection and shows the reason without resending', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      fixture = await mountReferenceFixture({ features: { activation: true } })
      fireEvent.click(actionButton('dsh:ask-with-reference') as HTMLButtonElement)
      await flush()
      const request = fixture.addRequests[0]!
      window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_ADD_RESULT_EVENT, {
        detail: { version: 1, requestId: request.requestId, ok: false, reason: 'target-unavailable', target: request.target },
      }))
      await flush()
      expect(document.querySelector('.sa-feedback')?.textContent).toContain('target conversation is unavailable')
      expect(actionsRoot().style.display).toBe('block')
      expect(fixture.addRequests).toHaveLength(1)
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('ignores repeated add activations while one insert is pending (no duplicate nodes)', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      fixture = await mountReferenceFixture({ features: { activation: true } })
      fireEvent.click(actionButton('dsh:reference') as HTMLButtonElement)
      await flush()
      fireEvent.click(actionButton('dsh:reference') as HTMLButtonElement)
      fireEvent.click(actionButton('dsh:ask-with-reference') as HTMLButtonElement)
      await flush()
      expect(fixture.addRequests).toHaveLength(1)
      receiptFor(fixture.addRequests[0]!)
      await flush()
      // 回执后允许下一次显式插入。
      fireEvent.click(actionButton('dsh:reference') as HTMLButtonElement)
      await flush()
      expect(fixture.addRequests).toHaveLength(2)
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('keeps a timed-out request addressable, accepts its late receipt, and does not mint a replacement', async () => {
    let fixture: ReferenceFixture | undefined
    try {
      vi.useFakeTimers()
      fixture = await mountReferenceFixture()
      vi.useFakeTimers()
      fireEvent.click(actionButton('dsh:reference') as HTMLButtonElement)
      await Promise.resolve()
      const original = fixture.addRequests[0]!
      await vi.advanceTimersByTimeAsync(5_000)
      await Promise.resolve()
      expect(document.querySelector('.sa-feedback')?.textContent).toContain('still unconfirmed')
      fireEvent.click(actionButton('dsh:reference') as HTMLButtonElement)
      await Promise.resolve()
      expect(fixture.addRequests).toHaveLength(1)
      receiptFor(original)
      await Promise.resolve()
      expect(document.querySelector('.sa-feedback')?.textContent).toBe('Added to Main Chat')
      fireEvent.click(actionButton('dsh:reference') as HTMLButtonElement)
      await Promise.resolve()
      expect(fixture.addRequests).toHaveLength(2)
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('disables ask-with-reference with an honest reason when activation is not probed', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      fixture = await mountReferenceFixture()
      const ask = moreActionButton('dsh:ask-with-reference')
      expect(ask.disabled).toBe(true)
      expect(ask.title).toContain('focus the composer')
      // 添加到对话保持可用。
      expect((actionButton('dsh:reference') as HTMLButtonElement).disabled).toBe(false)
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('opens an editable text-quote draft without implicitly submitting or claiming delivery', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      fixture = await mountReferenceFixture({ withSource: false, text: 'plain rendered text without proof' })
      // 结构化引用不可用；显式文字引用作为 More 入口可用。
      const structured = moreActionButton('dsh:reference')
      expect(structured.disabled).toBe(true)
      const textQuote = document.querySelector('#sa-more-panel button[data-action-id="dsh:add-text-quote"]') as HTMLButtonElement
      expect(textQuote.disabled).toBe(false)
      fireEvent.click(textQuote)
      await flush()
      expect(fixture.addRequests).toHaveLength(0)
      expect(fixture.submitDetails).toHaveLength(0)
      const composer = document.querySelector('.dsh-selection-composer') as HTMLElement
      expect(composer.style.display).toBe('block')
      expect((composer.querySelector('textarea') as HTMLTextAreaElement).value).toBe('plain rendered text without proof')
      expect(composer.textContent).toContain('Selected text draft (no linked source)')
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('marks an explicit text-quote send with the unattributed quote marker', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      const sends: string[] = []
      fixture = await mountReferenceFixture({
        withSource: false,
        text: 'plain rendered text without proof',
        composerAdapter: { send: async input => { sends.push(input.text) } },
      })
      fireEvent.click(moreActionButton('dsh:add-text-quote'))
      await flush()
      expect(fixture.addRequests).toHaveLength(0)
      expect(fixture.submitDetails).toHaveLength(0)
      const composer = document.querySelector('.dsh-selection-composer') as HTMLElement
      fireEvent.click(composer.querySelector('button[data-action="send"]') as HTMLButtonElement)
      await flush()
      expect(sends).toEqual(['plain rendered text without proof'])
      expect(fixture.addRequests).toHaveLength(0)
      expect(fixture.submitDetails).toHaveLength(1)
      expect(fixture.submitDetails[0]).toMatchObject({
        intent: 'ask',
        kind: 'text-quote',
        attribution: 'none',
        canonicalActionId: 'dsh:add-text-quote',
      })
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('does not offer the text-quote fallback when a structured source exists', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      fixture = await mountReferenceFixture()
      const textQuote = moreActionButton('dsh:add-text-quote')
      expect(textQuote.disabled).toBe(true)
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('renders source details with a disabled locate entry, delegates close, and releases its listener', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      fixture = await mountReferenceFixture()
      const details = moreActionButton('dsh:reference-details')
      expect(details.disabled).toBe(false)
      fireEvent.click(details)
      await flush()
      const popover = document.querySelector('.dsh-selection-reference-details') as HTMLElement
      expect(popover.style.display).toBe('block')
      const text = popover.textContent ?? ''
      expect(text).toContain('Source details')
      expect(text).toContain('file-host')
      expect(text).toContain('file:src/fixture.ts')
      expect(text).toContain('source-v2')
      expect(text).toContain('Main Chat')
      const locate = popover.querySelector('button[data-action="locate"]') as HTMLButtonElement
      expect(locate.disabled).toBe(true)
      expect(locate.title).toContain('Locating the source is not available')
      const close = popover.querySelector('button[data-action="close"]') as HTMLButtonElement
      // Delegated popover listener closes the current render and returns focus.
      // （jsdom 在 click 后异步折叠选区并补发 selectionchange，真实浏览器不会；
      // 因此这里不断言 Actions 的瞬时 display，改由下方重开证明已回到可操作状态。）
      fireEvent.click(close)
      await flush()
      expect(popover.style.display).toBe('none')
      expect((document.activeElement as HTMLElement | null)?.dataset.actionId).toBe('dsh:reference-details')
      // Open a freshly rendered dialog, then dispose while it is open. A click
      // on the retained detached node must not reach a leaked root listener.
      // （jsdom 已在点击时折叠选区；重建选区并重发 selectionchange，等层与
      // anchor tracker 双双稳定、引用重新解析后再打开。）
      const sourceParagraph = document.querySelector('p')!
      const reopenRange = document.createRange()
      reopenRange.selectNodeContents(sourceParagraph)
      const reopenSelection = window.getSelection()!
      reopenSelection.removeAllRanges()
      reopenSelection.addRange(reopenRange)
      document.dispatchEvent(new Event('selectionchange'))
      await new Promise<void>(resolve => setTimeout(resolve, 400))
      fireEvent.click(moreActionButton('dsh:reference-details'))
      await flush()
      const retainedClose = popover.querySelector('button[data-action="close"]') as HTMLButtonElement
      expect(popover.style.display).toBe('block')
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
      expect(popover.isConnected).toBe(false)
      fireEvent.click(retainedClose)
      expect(popover.style.display).toBe('block')
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('disables choose-conversation with a reason when the host probe lacks it', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      fixture = await mountReferenceFixture()
      const choose = moreActionButton('dsh:choose-conversation')
      expect(choose.disabled).toBe(true)
      expect(choose.title).toContain('pick or create a conversation')
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('keeps the current target and selection when the host picker is cancelled', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    let pickerSignal: AbortSignal | undefined
    try {
      fixture = await mountReferenceFixture({
        features: { chooseTarget: true },
        chooseTarget: () => async signal => {
          pickerSignal = signal
          return { status: 'cancelled' }
        },
      })
      const choose = moreActionButton('dsh:choose-conversation')
      expect(choose.disabled).toBe(false)
      fireEvent.click(choose)
      await flush()
      // 取消不创建对话、不插入引用；原目标保持可用。
      expect(fixture.addRequests).toHaveLength(0)
      expect(fixture.currentTarget.conversationId).toBe('conversation-fixture')
      expect(pickerSignal?.aborted).toBe(true)
      fireEvent.click(actionButton('dsh:reference') as HTMLButtonElement)
      await flush()
      expect(fixture.addRequests).toHaveLength(1)
      expect(fixture.addRequests[0]?.target.conversationId).toBe('conversation-fixture')
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('re-captures the chosen target for subsequent inserts without a local ledger', async () => {
    vi.useFakeTimers()
    let fixture: ReferenceFixture | undefined
    try {
      fixture = await mountReferenceFixture({
        features: { chooseTarget: true },
        chooseTarget: ({ setTarget }) => async () => {
          const target = { workspaceId: 'workspace-fixture', conversationId: 'conversation-other', title: 'Second Chat' }
          setTarget(target)
          return { status: 'selected', target }
        },
      })
      fireEvent.click(moreActionButton('dsh:choose-conversation'))
      await flush()
      expect(document.querySelector('.sa-feedback')?.textContent).toContain('Second Chat')
      fireEvent.click(actionButton('dsh:reference') as HTMLButtonElement)
      await flush()
      expect(fixture.addRequests).toHaveLength(1)
      expect(fixture.addRequests[0]?.target.conversationId).toBe('conversation-other')
      receiptFor(fixture.addRequests[0]!)
      await flush()
      expect(document.querySelector('.sa-feedback')?.textContent).toBe('Added to Second Chat')
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('does not claim a picked target until the owner snapshot confirms the same tuple', async () => {
    let fixture: ReferenceFixture | undefined
    try {
      vi.useFakeTimers()
      fixture = await mountReferenceFixture({
        features: { chooseTarget: true },
        chooseTarget: () => async () => ({
          status: 'selected',
          target: { workspaceId: 'workspace-fixture', conversationId: 'conversation-unprojected', title: 'Unprojected Chat' },
        }),
      })
      vi.useFakeTimers()
      fireEvent.click(moreActionButton('dsh:choose-conversation'))
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(5_000)
      await Promise.resolve()
      expect(document.querySelector('.sa-feedback')?.textContent).toContain('did not confirm the selected conversation')
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('waits through old snapshots until the picker tuple is published by the owner', async () => {
    let fixture: ReferenceFixture | undefined
    try {
      vi.useFakeTimers()
      const selected = { workspaceId: 'workspace-fixture', conversationId: 'conversation-selected', title: 'Selected Chat' }
      fixture = await mountReferenceFixture({
        features: { chooseTarget: true },
        chooseTarget: () => async () => ({ status: 'selected', target: selected }),
      })
      fireEvent.click(moreActionButton('dsh:choose-conversation'))
      await Promise.resolve()
      fixture.setTarget({ workspaceId: 'workspace-fixture', conversationId: 'conversation-old', title: 'Old Chat' })
      await Promise.resolve()
      expect(document.querySelector('.sa-feedback')?.textContent).not.toContain('Selected Chat')
      fixture.setTarget(selected)
      await Promise.resolve()
      expect(document.querySelector('.sa-feedback')?.textContent).toContain('Selected Chat')
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })

  it('aborts a pending target picker on dispose without changing the target', async () => {
    let fixture: ReferenceFixture | undefined
    let aborted = false
    try {
      vi.useFakeTimers()
      fixture = await mountReferenceFixture({
        features: { chooseTarget: true },
        chooseTarget: () => signal => new Promise(resolve => {
          signal?.addEventListener('abort', () => {
            aborted = true
            resolve({ status: 'cancelled' })
          }, { once: true })
        }),
      })
      fireEvent.click(moreActionButton('dsh:choose-conversation'))
      await Promise.resolve()
      fixture.dispose()
      fixture.disposer()
      fixture = undefined
      await Promise.resolve()
      expect(aborted).toBe(true)
    } finally {
      fixture?.disposer()
      fixture?.dispose()
      vi.useRealTimers()
    }
  })
})

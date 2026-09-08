// @vitest-environment jsdom
/**
 * dsh-project-canvas-continuity-v1 2.3b 面证据：真实 locale face 订阅触发重渲染、
 * 项目切换控制器隔离与草稿保留、注册销毁对称（locale 字典注销、控制器 dispose）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { registerProjectCanvasPane } from '../src/project-canvas-pane.js'

function localeService() {
  const listeners = new Set<() => void>()
  const namespaces = new Map<string, Record<string, Record<string, string>>>()
  let active = 'zh'
  return {
    register: vi.fn((ns: string, dictionaries: Record<string, Record<string, string>>) => {
      namespaces.set(ns, dictionaries)
      return () => namespaces.delete(ns)
    }),
    bind: vi.fn((ns: string) => (key: string) => namespaces.get(ns)?.[active]?.[key] ?? key),
    getSnapshot: vi.fn(() => active),
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    switchTo(next: 'zh' | 'en') {
      active = next
      for (const listener of listeners) listener()
    },
  }
}

function creatorService() {
  let projectRef = 'project:one'
  const reads: string[] = []
  return {
    reads,
    setProject(next: string) { projectRef = next },
    creatorStudio: {
      snapshot: vi.fn(async () => ({
        context: { tenantRef: 'tenant:one', workspaceRef: 'workspace:one', projectRef, principalRef: 'principal:one',
          membershipRevision: '1', runtimeGeneration: 'runtime:one' },
        owners: [],
      })),
      canvasRead: vi.fn(async (input: { scope: { projectRef: string } }) => {
        reads.push(input.scope.projectRef)
        return { status: 'missing' }
      }),
      canvasSave: vi.fn(async (request: { requestId: string; document: { revision: number } }) =>
        ({ status: 'saved', requestId: request.requestId, revision: request.document.revision + 1 })),
      canvasReconcile: vi.fn(async () => ({ status: 'unknown' })),
    },
  }
}

function harness() {
  const locale = localeService()
  const service = creatorService()
  const registered: Array<{ descriptor: { kind: string }; component: () => React.ReactNode }> = []
  const unregisterView = vi.fn()
  const ctx = { get: vi.fn((key: string) => key === 'locale' ? locale : key === 'remote' ? { creatorStudio: service.creatorStudio } : undefined) }
  const unregister = registerProjectCanvasPane(ctx as never, {
    registerView: vi.fn((input: never) => { registered.push(input); return unregisterView }),
  })
  return { locale, service, registered, unregister, unregisterView }
}

async function mountView(component: () => React.ReactNode, container: HTMLElement): Promise<Root> {
  const root = createRoot(container)
  await act(async () => { root.render(createElement(component)) })
  await act(async () => {})
  return root
}

describe('project canvas pane registration', () => {
  beforeEach(() => {
    class TestResizeObserver { observe() {} disconnect() {} unobserve() {} }
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
  })
  afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals() })

  it('re-renders mounted views through the real locale subscription face', async () => {
    const h = harness()
    const container = document.createElement('div')
    document.body.append(container)
    const root = await mountView(h.registered[0]!.component, container)
    expect(container.textContent).toContain('创建画布')
    await act(async () => { h.locale.switchTo('en') })
    expect(container.textContent).toContain('Create canvas')
    expect(container.textContent).not.toContain('创建画布')
    await act(async () => root.unmount())
  })

  it('isolates controllers per project and retains drafts across pane reopen', async () => {
    const h = harness()
    const containerA = document.createElement('div')
    document.body.append(containerA)
    const rootA = await mountView(h.registered[0]!.component, containerA)
    expect(containerA.textContent).toContain('创建画布')
    await act(async () => {
      (containerA.querySelector('button') as HTMLButtonElement).click()
    })
    await act(async () => {})
    expect(containerA.textContent).toContain('未保存')
    await act(async () => rootA.unmount())

    h.service.setProject('project:two')
    const containerB = document.createElement('div')
    document.body.append(containerB)
    const rootB = await mountView(h.registered[0]!.component, containerB)
    expect(containerB.textContent).toContain('创建画布')
    expect(h.service.reads).toEqual(['project:one', 'project:two'])

    h.service.setProject('project:one')
    const containerA2 = document.createElement('div')
    document.body.append(containerA2)
    const rootA2 = await mountView(h.registered[0]!.component, containerA2)
    // The cached controller for project one keeps its unsaved draft and does not re-read the owner document.
    expect(containerA2.textContent).toContain('未保存')
    expect(h.service.reads).toEqual(['project:one', 'project:two'])
    await act(async () => { rootB.unmount(); rootA2.unmount() })
  })

  it('disposes views, controllers and locale dictionaries symmetrically', async () => {
    const h = harness()
    const container = document.createElement('div')
    document.body.append(container)
    const root = await mountView(h.registered[0]!.component, container)
    h.unregister()
    expect(h.unregisterView).toHaveBeenCalledOnce()
    // The namespace dictionary is unregistered, so a later translation falls back to the key.
    const translate = h.locale.bind('yeisme.project-canvas')
    expect(translate('title')).toBe('title')
    expect(h.locale.register).toHaveBeenCalledOnce()
    await act(async () => root.unmount())
  })
})

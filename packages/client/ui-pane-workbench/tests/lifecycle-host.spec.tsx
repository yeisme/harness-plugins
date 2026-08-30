// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { LifecycleViewHost } from '../src/chrome/lifecycle-host.tsx'
import type { PaneAnimationFrame } from '../src/lifecycle.js'
import type { PaneViewInstanceV1 } from '../src/workspace.js'

afterEach(cleanup)

function frame(): PaneAnimationFrame & { flush(): void } {
  const queue: Array<() => void> = []
  return {
    request: callback => { queue.push(callback); return queue.length },
    cancel: () => {},
    flush: () => { const next = queue.shift(); if (next !== undefined) next() },
  }
}

function keepAliveView(id = 'v1'): PaneViewInstanceV1 {
  return { id, kind: 'k', resourceKey: `k:${id}`, role: 'content', region: 'right', groupId: 'g1', title: id, retention: 'keep-alive', singleton: false, preview: false, pinned: false, dirty: false }
}

class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) { this.callback = callback; MockResizeObserver.instances.push(this) }
  observe = vi.fn()
  disconnect = vi.fn()
  emit(width: number, height: number): void { this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver) }
}

beforeEach(() => {
  MockResizeObserver.instances.length = 0
  vi.stubGlobal('ResizeObserver', MockResizeObserver as unknown as typeof ResizeObserver)
})
afterEach(() => vi.unstubAllGlobals())

describe('LifecycleViewHost single live host (V3 2.7)', () => {
  it('mounts children only after two visible frames, suspends on hide, revives on show', async () => {
    const animationFrame = frame()
    const mounts = vi.fn(() => createElement('b', null, 'live'))
    const { container } = render(createElement(LifecycleViewHost, { view: keepAliveView(), animationFrame }, createElement('b', null, 'live')))
    const observer = MockResizeObserver.instances.at(-1)!
    expect(container.querySelector('[data-pane-lifecycle-suspended]')).not.toBeNull()
    observer.emit(400, 300)
    animationFrame.flush()
    expect(container.querySelector('[data-pane-lifecycle-suspended]')).not.toBeNull() // one frame only
    animationFrame.flush()
    await vi.waitFor(() => { expect(container.textContent).toContain('live') })
    observer.emit(0, 0)
    await vi.waitFor(() => { expect(container.querySelector('[data-pane-lifecycle-suspended]')).not.toBeNull() })
    expect(container.textContent).not.toContain('live')
    observer.emit(400, 300)
    animationFrame.flush()
    animationFrame.flush()
    await vi.waitFor(() => { expect(container.textContent).toContain('live') })
  })

  it('disposes on unmount exactly once', () => {
    const animationFrame = frame()
    const view = render(createElement(LifecycleViewHost, { view: keepAliveView('v2'), animationFrame }, null))
    view.unmount()
    const host = document.querySelector('[data-pane-lifecycle-host]')
    expect(host).toBeNull()
  })

  it('keyed remount (cross-root move) reuses one host element identity per view id', () => {
    const animationFrame = frame()
    const view = keepAliveView('move-1')
    const first = render(createElement('div', { key: 'root-a' }, createElement(LifecycleViewHost, { key: view.id, view, animationFrame }, null)))
    const host = first.container.querySelector('[data-pane-lifecycle-host="move-1"]')
    expect(host).not.toBeNull()
    first.rerender(createElement('div', { key: 'root-a' }, createElement(LifecycleViewHost, { key: view.id, view: { ...view, groupId: 'g2' }, animationFrame }, null)))
    const moved = first.container.querySelector('[data-pane-lifecycle-host="move-1"]')
    expect(moved).not.toBeNull()
    expect(first.container.querySelectorAll('[data-pane-lifecycle-host]').length).toBe(1)
  })
})

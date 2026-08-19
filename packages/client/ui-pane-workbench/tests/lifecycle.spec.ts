import { describe, expect, it, vi } from 'vitest'
import {
  PaneRetentionManager,
  type PaneAnimationFrame,
  type PaneViewInstanceV1,
} from '../src/index.js'

function view(id: string, kind = 'file.editor', retention: PaneViewInstanceV1['retention'] = 'keep-alive'): PaneViewInstanceV1 {
  return {
    id,
    kind,
    resourceKey: `resource:${id}`,
    role: 'content',
    region: 'right',
    groupId: 'group:right:content',
    title: id,
    retention,
    singleton: false,
    preview: false,
    pinned: true,
    dirty: false,
    duplicate: false,
    closePolicy: 'allow',
    status: 'ready',
  }
}

function frameQueue(): PaneAnimationFrame & { flush(): void; readonly size: number } {
  const callbacks = new Map<number, () => void>()
  let nextHandle = 0
  return {
    request(callback) {
      const handle = ++nextHandle
      callbacks.set(handle, callback)
      return handle
    },
    cancel(handle) {
      callbacks.delete(handle)
    },
    flush() {
      const next = callbacks.entries().next().value as [number, () => void] | undefined
      if (next === undefined) throw new Error('no queued animation frame')
      callbacks.delete(next[0])
      next[1]()
    },
    get size() {
      return callbacks.size
    },
  }
}

function activate(manager: PaneRetentionManager, frames: ReturnType<typeof frameQueue>, viewId: string): void {
  manager.observeSize(viewId, 640, 480, true)
  frames.flush()
  frames.flush()
}

describe('PaneRetentionManager', () => {
  it('waits for two visible non-zero frames and enforces active LRU per kind', () => {
    const frames = frameQueue()
    const manager = new PaneRetentionManager({ 'file.editor': { maxActive: 1, maxRetained: 4 } }, undefined, frames)
    const firstActivate = vi.fn()
    const firstSuspend = vi.fn()
    const secondActivate = vi.fn()
    const firstDispose = vi.fn()

    manager.register(view('view:one'), { activate: firstActivate, suspend: firstSuspend, dispose: firstDispose })
    manager.observeSize('view:one', 0, 480, true)
    expect(firstActivate).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
    activate(manager, frames, 'view:one')
    expect(firstActivate).toHaveBeenCalledOnce()
    expect(manager.snapshot().find(entry => entry.viewId === 'view:one')?.state).toBe('active')

    manager.register(view('view:two'), { activate: secondActivate })
    activate(manager, frames, 'view:two')
    expect(secondActivate).toHaveBeenCalledOnce()
    expect(firstSuspend).toHaveBeenCalledWith(expect.objectContaining({ id: 'view:one' }))
    expect(firstDispose).not.toHaveBeenCalled()
    expect(manager.snapshot().find(entry => entry.viewId === 'view:one')?.state).toBe('suspended')
    expect(manager.snapshot().find(entry => entry.viewId === 'view:two')?.state).toBe('active')

    manager.close('view:one')
    expect(firstDispose).toHaveBeenCalledOnce()
  })

  it('evicts the least recently used retained view and disposes recreate views when hidden', () => {
    const frames = frameQueue()
    const disposed = vi.fn()
    const secondDisposed = vi.fn()
    const manager = new PaneRetentionManager({ 'file.editor': { maxActive: 2, maxRetained: 2 } }, undefined, frames)
    manager.register(view('view:one'), { activate: vi.fn(), dispose: disposed })
    manager.register(view('view:two'), { activate: vi.fn(), dispose: secondDisposed })
    manager.touch('view:one')
    manager.register(view('view:three'), { activate: vi.fn() })

    expect(manager.snapshot().map(entry => entry.viewId)).toEqual(['view:one', 'view:three'])
    expect(disposed).not.toHaveBeenCalled()
    expect(secondDisposed).toHaveBeenCalledOnce()

    const recreateDisposed = vi.fn()
    manager.register(view('view:recreate', 'file.preview', 'recreate'), { activate: vi.fn(), dispose: recreateDisposed })
    activate(manager, frames, 'view:recreate')
    manager.hide('view:recreate')
    expect(recreateDisposed).toHaveBeenCalledOnce()
    expect(manager.snapshot().find(entry => entry.viewId === 'view:recreate')?.state).toBe('suspended')

    const snapshotSuspend = vi.fn()
    manager.register(view('view:snapshot', 'file.snapshot', 'snapshot'), { activate: vi.fn(), suspend: snapshotSuspend })
    activate(manager, frames, 'view:snapshot')
    manager.hide('view:snapshot')
    expect(snapshotSuspend).toHaveBeenCalledOnce()
  })
})

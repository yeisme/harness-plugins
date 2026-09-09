import { describe, expect, it } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { PaneWorkspacePersistenceAdapter } from '../src/persistence.js'
import { registerPaneWorkbenchCoreViews, DSH_FILE_PREVIEW_VIEW_KIND } from '../src/index.js'
import {
  FILE_REOPEN_DEFAULT_VIEW_KINDS,
  fileReopenStatusIntent,
  recoverFileReferenceView,
  recoverPaneFileReferenceViews,
  type FileReferenceAdmissionV1,
  type FileReferenceAdmissionResultV1,
} from '../src/explorer/file-reopen.js'
import { applyFileLifecycleToView, createFileOpenRequest } from '../src/explorer/file-lifecycle.js'
import type { PaneViewInstanceV1 } from '../src/workspace.js'

function fileView(view: Partial<PaneViewInstanceV1> & Pick<PaneViewInstanceV1, 'id' | 'resourceKey'>): PaneViewInstanceV1 {
  return {
    kind: DSH_FILE_PREVIEW_VIEW_KIND,
    role: 'content',
    region: 'right',
    groupId: 'group:right:content',
    title: view.resourceKey,
    retention: 'recreate',
    singleton: false,
    preview: false,
    pinned: true,
    dirty: false,
    duplicate: false,
    closePolicy: 'allow',
    status: 'ready',
    attention: false,
    offline: false,
    stale: false,
    ...view,
  }
}

function admission(map: Readonly<Record<string, FileReferenceAdmissionResultV1>>): FileReferenceAdmissionV1 {
  return { resolveFileReference: async request => map[request.ref] ?? { ok: false, reason: 'missing' } }
}

interface MemoryStorage {
  getItem(key: string): string | undefined
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function memoryStorage(): MemoryStorage {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key),
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
}

describe('file reference recovery decisions (1.2)', () => {
  it('keeps the default kind list aligned with the registered file preview kind', () => {
    expect(FILE_REOPEN_DEFAULT_VIEW_KINDS).toEqual([DSH_FILE_PREVIEW_VIEW_KIND])
  })

  it('maps admission answers onto ready, stale and conflict outcomes', () => {
    const ready = recoverFileReferenceView(fileView({ id: 'v1', resourceKey: 'file:a', resourceVersion: 'v1' }), { ok: true, version: 'v1' })
    expect(ready).toMatchObject({ kind: 'ready', version: 'v1' })
    const stale = recoverFileReferenceView(fileView({ id: 'v2', resourceKey: 'file:a', resourceVersion: 'v1' }), { ok: true, version: 'v2' })
    expect(stale).toMatchObject({ kind: 'stale', version: 'v2' })
    expect(stale.kind === 'stale' && stale.lifecycle).toMatchObject({ status: 'stale', actions: ['compare', 'reload', 'keep_local'], autoOverwrite: false, dropBuffer: false })
    const conflict = recoverFileReferenceView(fileView({ id: 'v3', resourceKey: 'file:a', resourceVersion: 'v1', dirty: true }), { ok: true, version: 'v2' })
    expect(conflict).toMatchObject({ kind: 'conflict', ownerVersion: 'v2' })
    expect(conflict.kind === 'conflict' && conflict.lifecycle).toMatchObject({
      status: 'conflict',
      actions: ['compare', 'reload', 'save_as', 'keep_local'],
      autoOverwrite: false,
      dropBuffer: false,
    })
  })

  it('keeps the pane with a bounded reason for missing, forbidden and unavailable references', () => {
    const missing = recoverFileReferenceView(fileView({ id: 'v1', resourceKey: 'file:gone' }), { ok: false, reason: 'missing' })
    expect(missing).toMatchObject({ kind: 'unresolved', reason: 'missing' })
    const forbidden = recoverFileReferenceView(fileView({ id: 'v2', resourceKey: 'file:secret' }), { ok: false, reason: 'forbidden', detail: 'denied' })
    expect(forbidden).toMatchObject({ kind: 'unresolved', reason: 'forbidden', detail: 'denied' })
    const throws = admission({})
    const unavailable = recoverFileReferenceView(fileView({ id: 'v3', resourceKey: 'file:x' }), { ok: false, reason: 'unavailable' })
    expect(unavailable).toMatchObject({ kind: 'unresolved', reason: 'unavailable' })
    void throws
  })

  it('defers honestly when the admission face is absent and commits nothing', () => {
    const view = fileView({ id: 'v1', resourceKey: 'file:a', resourceVersion: 'v1', dirty: true })
    const deferredOutcome = recoverFileReferenceView(view, undefined)
    expect(deferredOutcome).toMatchObject({ kind: 'deferred', reason: 'admission_unavailable' })
    expect(fileReopenStatusIntent(deferredOutcome)).toBeUndefined()
  })

  it('degrades a throwing admission to unavailable instead of fake success', async () => {
    const failing: FileReferenceAdmissionV1 = { resolveFileReference: async () => { throw new Error('owner offline') } }
    const outcomes = await recoverPaneFileReferenceViews({ views: [fileView({ id: 'v1', resourceKey: 'file:a' })], admission: failing })
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]).toMatchObject({ kind: 'unresolved', reason: 'unavailable' })
  })
})

describe('file reference recovery across remount (1.2)', () => {
  function controllers(storage: ReturnType<typeof memoryStorage>): {
    registry: PaneViewRegistry
    make: () => PaneWorkbenchController
    adapter: PaneWorkspacePersistenceAdapter
  } {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registerPaneWorkbenchCoreViews(registry)
    const adapter = new PaneWorkspacePersistenceAdapter(storage)
    return { registry, make: () => new PaneWorkbenchController({ registry, persistence: adapter }), adapter }
  }

  function fileViews(controller: PaneWorkbenchController): readonly PaneViewInstanceV1[] {
    return Object.values(controller.getSnapshot().views).filter(view => view.kind === DSH_FILE_PREVIEW_VIEW_KIND)
  }

  it('re-resolves saved opaque references after a refresh without substituting files', async () => {
    const storage = memoryStorage()
    const first = controllers(storage)
    const controllerA = first.make()
    controllerA.openView(createFileOpenRequest('file:a', 'a.ts', 'pin', 'v1'))
    controllerA.openView(createFileOpenRequest('file:b', 'b.ts', 'pin', 'v1'))
    const dirtyView = fileViews(controllerA).find(view => view.resourceKey === 'file:b')!
    controllerA.dispatch({ type: 'set_view_dirty', viewId: dirtyView.id, dirty: true })

    // Remount: a fresh controller restores the persisted presentation state.
    const controllerB = first.make()
    const restored = fileViews(controllerB)
    expect(restored.map(view => view.resourceKey).sort()).toEqual(['file:a', 'file:b'])
    expect(restored.find(view => view.resourceKey === 'file:b')).toMatchObject({ dirty: true, resourceVersion: 'v1' })

    const outcomes = await recoverPaneFileReferenceViews({
      views: Object.values(controllerB.getSnapshot().views),
      admission: admission({
        'file:a': { ok: true, version: 'v2' },
        'file:b': { ok: false, reason: 'forbidden', detail: 'permission revoked' },
      }),
    })
    expect(outcomes.map(outcome => outcome.kind).sort()).toEqual(['stale', 'unresolved'])
    for (const outcome of outcomes) {
      const intent = fileReopenStatusIntent(outcome)
      if (intent !== undefined) expect(controllerB.dispatch(intent).accepted).toBe(true)
    }

    const after = controllerB.getSnapshot().views
    const a = Object.values(after).find(view => view.resourceKey === 'file:a')!
    const b = Object.values(after).find(view => view.resourceKey === 'file:b')!
    expect(a).toMatchObject({ status: 'stale', stale: true, dirty: false, resourceVersion: 'v2' })
    expect(b).toMatchObject({
      status: 'stale',
      attention: true,
      dirty: true,
      pinned: true,
      resourceVersion: 'v1',
    })
    expect(String(b.metadata?.reopen)).toContain('forbidden')
    // No substitute file: the same two references, no extra views opened.
    expect(fileViews(controllerB).map(view => view.resourceKey).sort()).toEqual(['file:a', 'file:b'])
    expect(Object.keys(after).length).toBe(2)

    // The recovery result itself survives another remount.
    const controllerC = first.make()
    const persisted = fileViews(controllerC)
    expect(persisted.find(view => view.resourceKey === 'file:a')).toMatchObject({ status: 'stale', resourceVersion: 'v2' })
    expect(persisted.find(view => view.resourceKey === 'file:b')).toMatchObject({ dirty: true })
    expect(String(persisted.find(view => view.resourceKey === 'file:b')?.metadata?.reopen)).toContain('forbidden')
  })

  it('keeps the dirty buffer and demands an explicit decision on external version change', async () => {
    const storage = memoryStorage()
    const rig = controllers(storage)
    const controller = rig.make()
    controller.openView(createFileOpenRequest('file:draft', 'draft.md', 'pin', 'v1'))
    const view = fileViews(controller)[0]!
    controller.dispatch({ type: 'set_view_dirty', viewId: view.id, dirty: true })

    const outcomes = await recoverPaneFileReferenceViews({
      views: fileViews(controller),
      admission: admission({ 'file:draft': { ok: true, version: 'v9' } }),
    })
    const conflict = outcomes[0]!
    expect(conflict.kind).toBe('conflict')
    const intent = fileReopenStatusIntent(conflict)
    expect(intent).toBeDefined()
    controller.dispatch(intent!)

    const next = fileViews(controller)[0]!
    expect(next).toMatchObject({ status: 'conflict', dirty: true, resourceVersion: 'v1', attention: true })
    expect(next.preview).toBe(false)
    // The lifecycle projection and the reducer agree on the conflict surface.
    const projected = applyFileLifecycleToView(next, conflict.kind === 'conflict' ? conflict.lifecycle : { status: 'ready', actions: [], autoOverwrite: false, dropBuffer: false })
    expect(projected.status).toBe('conflict')
    expect(projected.dirty).toBe(true)
  })

  it('leaves restored views untouched when no admission face exists', async () => {
    const storage = memoryStorage()
    const rig = controllers(storage)
    const controllerA = rig.make()
    controllerA.openView(createFileOpenRequest('file:a', 'a.ts', 'pin', 'v1'))
    const controllerB = rig.make()
    const before = controllerB.getSnapshot().views
    const outcomes = await recoverPaneFileReferenceViews({ views: Object.values(before), admission: undefined })
    expect(outcomes.every(outcome => outcome.kind === 'deferred')).toBe(true)
    expect(controllerB.getSnapshot().views).toBe(before)
  })

  it('rejects unknown views and sanitizes the recovery detail', () => {
    const storage = memoryStorage()
    const rig = controllers(storage)
    const controller = rig.make()
    controller.openView(createFileOpenRequest('file:a', 'a.ts', 'pin', 'v1'))
    const view = fileViews(controller)[0]!
    const rejected = controller.dispatch({ type: 'set_view_status', viewId: 'view:missing', status: 'ready' })
    expect(rejected.accepted).toBe(false)
    const accepted = controller.dispatch({
      type: 'set_view_status',
      viewId: view.id,
      status: 'stale',
      attention: true,
      detail: 'line one\nline two\x07\x00 trimmed  ',
    })
    expect(accepted.accepted).toBe(true)
    const next = fileViews(controller)[0]!
    expect(String(next.metadata?.reopen)).not.toMatch(/[\n\x00\x07]/)
    expect(String(next.metadata?.reopen)).toBe('line oneline two trimmed')
  })
})

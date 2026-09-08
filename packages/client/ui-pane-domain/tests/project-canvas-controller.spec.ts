import { describe, expect, it, vi } from 'vitest'
import { ProjectCanvasController, type ProjectCanvasRemote } from '../src/project-canvas-controller.js'
const target = { scope: { workspaceRef: 'workspace:one', projectRef: 'project:one' }, documentId: 'main' }
function setup() {
  const remote: ProjectCanvasRemote = {
    canvasRead: vi.fn(async () => ({ status: 'missing' })),
    canvasSave: vi.fn(async request => ({ status: 'saved', requestId: request.requestId, revision: request.document.revision + 1 })),
    canvasReconcile: vi.fn(async () => ({ status: 'unknown' })),
  }
  const controller = new ProjectCanvasController(remote, target, () => 'save-one')
  return { controller, remote }
}
describe('canvas save and recovery controller', () => {
  it('does not release an uncertain save on another request not_applied receipt', async () => {
    const { controller, remote } = setup()
    await controller.load(); controller.createDraft()
    vi.mocked(remote.canvasSave).mockRejectedValueOnce(new Error('lost response'))
    await controller.save()
    vi.mocked(remote.canvasReconcile).mockResolvedValueOnce({ status: 'not_applied', requestId: 'different-save' })
    await controller.reconcile(); await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('unknown')
    expect(remote.canvasSave).toHaveBeenCalledOnce()
    vi.mocked(remote.canvasReconcile).mockResolvedValueOnce({ status: 'not_applied', requestId: 'save-one' })
    await controller.reconcile()
    expect(controller.getSnapshot()).toMatchObject({ dirty: true, saveStatus: 'dirty' })
  })
  it('keeps unsaved data and its dirty fact when an explicit reload fails', async () => {
    const { controller, remote } = setup()
    await controller.load(); controller.createDraft()
    controller.edit({ type: 'camera', camera: { x: 75, y: 20, zoom: 1.5 } })
    const editor = controller.getSnapshot().editor
    for (const status of ['error', 'unavailable', 'forbidden', 'invalid']) {
      vi.mocked(remote.canvasRead).mockResolvedValueOnce({ status })
      await controller.load(true)
      expect(controller.getSnapshot()).toMatchObject({ status, dirty: true, saveStatus: 'dirty' })
      expect(controller.getSnapshot().editor).toBe(editor)
    }
    expect(remote.canvasSave).not.toHaveBeenCalled()
  })
  it('coalesces a gesture and keeps its undo revision current when a save finishes mid-gesture', async () => {
    const { controller, remote } = setup()
    await controller.load(); controller.createDraft()
    let resolve!: (value: unknown) => void
    vi.mocked(remote.canvasSave).mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const saving = controller.save()
    controller.beginGesture()
    controller.edit({ type: 'camera', camera: { x: 1, y: 0, zoom: 1 } })
    resolve({ status: 'saved', requestId: 'save-one', revision: 1 }); await saving
    controller.edit({ type: 'camera', camera: { x: 2, y: 0, zoom: 1 } })
    controller.endGesture()
    expect(controller.getSnapshot().editor!.past).toHaveLength(1)
    controller.edit({ type: 'undo' })
    expect(controller.getSnapshot().editor!.document).toMatchObject({ revision: 1, camera: { x: 0 } })
    controller.edit({ type: 'redo' })
    expect(controller.getSnapshot().editor!.document).toMatchObject({ revision: 1, camera: { x: 2 } })
  })
  it('creates only an unsaved draft until the user saves', async () => {
    const { controller, remote } = setup()
    await controller.load(); controller.createDraft()
    expect(remote.canvasSave).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ dirty: true, saveStatus: 'dirty', editor: { document: { revision: 0 } } })
    await controller.save()
    expect(controller.getSnapshot()).toMatchObject({ dirty: false, saveStatus: 'clean', editor: { document: { revision: 1 } } })
  })
  it('preserves edits made while a save is pending and rebases undo history', async () => {
    const { controller, remote } = setup()
    await controller.load(); controller.createDraft()
    let resolve!: (value: unknown) => void
    vi.mocked(remote.canvasSave).mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const saving = controller.save()
    controller.edit({ type: 'camera', camera: { x: 25, y: 0, zoom: 2 } })
    resolve({ status: 'saved', requestId: 'save-one', revision: 1 }); await saving
    expect(controller.getSnapshot()).toMatchObject({ dirty: true, editor: { document: { revision: 1, camera: { x: 25 } } } })
    controller.edit({ type: 'undo' })
    expect(controller.getSnapshot().editor!.document).toMatchObject({ revision: 1, camera: { x: 0, zoom: 1 } })
  })
  it('blocks duplicate save and uses read-only reconciliation for unknown writes', async () => {
    const { controller, remote } = setup()
    await controller.load(); controller.createDraft()
    vi.mocked(remote.canvasSave).mockRejectedValueOnce(new Error('lost response'))
    await controller.save(); await controller.save()
    expect(remote.canvasSave).toHaveBeenCalledTimes(1)
    vi.mocked(remote.canvasReconcile).mockResolvedValueOnce({ status: 'forbidden' })
    await controller.reconcile(); await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('unknown')
    expect(remote.canvasSave).toHaveBeenCalledTimes(1)
    vi.mocked(remote.canvasReconcile).mockResolvedValueOnce({ status: 'saved', requestId: 'save-one', revision: 1 })
    await controller.reconcile()
    expect(controller.getSnapshot()).toMatchObject({ dirty: false, saveStatus: 'clean' })
  })
  it('keeps drafts on conflict and does not reload without explicit discard', async () => {
    const { controller, remote } = setup()
    await controller.load(); controller.createDraft()
    vi.mocked(remote.canvasSave).mockResolvedValueOnce({ status: 'conflict', revision: 3 })
    await controller.save(); await controller.load()
    expect(controller.getSnapshot()).toMatchObject({ dirty: true, saveStatus: 'conflict' })
    expect(remote.canvasRead).toHaveBeenCalledTimes(1)
    await controller.load(true)
    expect(remote.canvasRead).toHaveBeenCalledTimes(2)
  })
  it('recovers a journaled draft from a previous session as dirty edits', async () => {
    const { controller, remote } = setup()
    const draftDocument = { schema: 'dsh.project-canvas.v1alpha1', id: 'main', revision: 0, camera: { x: 5, y: 6, zoom: 1 },
      scope: target.scope, nodes: [{ id: 'draft:one', kind: 'draft', title: 'Recovered', text: 'journaled edit', position: { x: 0, y: 0 }, size: { width: 100, height: 80 } }], edges: [] }
    vi.mocked(remote.canvasRead).mockResolvedValueOnce({ status: 'missing', draft: { requestId: 'save-old', baseRevision: 0, document: draftDocument } })
    vi.mocked(remote.canvasReconcile).mockResolvedValueOnce({ status: 'not_applied', requestId: 'save-old' })
    await controller.load()
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', dirty: true, saveStatus: 'dirty',
      editor: { document: { revision: 0, camera: { x: 5, y: 6 }, nodes: [{ id: 'draft:one', text: 'journaled edit' }] } } })
    await controller.save()
    expect(controller.getSnapshot()).toMatchObject({ dirty: false, saveStatus: 'clean', editor: { document: { revision: 1 } } })
  })
  it('ignores a stale journal whose base revision no longer matches and never reconciles it', async () => {
    const { controller, remote } = setup()
    const confirmed = { schema: 'dsh.project-canvas.v1alpha1', id: 'main', revision: 2, camera: { x: 0, y: 0, zoom: 1 },
      scope: target.scope, nodes: [], edges: [] }
    vi.mocked(remote.canvasRead).mockResolvedValueOnce({ status: 'ready', document: confirmed,
      draft: { requestId: 'save-old', baseRevision: 0, document: { ...confirmed, revision: 0 } } })
    await controller.load()
    expect(remote.canvasReconcile).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', dirty: false, saveStatus: 'clean', editor: { document: { revision: 2 } } })
  })
  it('settles an unknown save as not_applied, keeps the draft retryable under a fresh request', async () => {
    let sequence = 0
    const remote: ProjectCanvasRemote = {
      canvasRead: vi.fn(async () => ({ status: 'missing' })),
      canvasSave: vi.fn(async request => ({ status: 'saved', requestId: request.requestId, revision: request.document.revision + 1 })),
      canvasReconcile: vi.fn(async () => ({ status: 'unknown' })),
    }
    const controller = new ProjectCanvasController(remote, target, () => `save-${++sequence}`)
    await controller.load(); controller.createDraft()
    controller.edit({ type: 'camera', camera: { x: 9, y: 0, zoom: 1 } })
    vi.mocked(remote.canvasSave).mockRejectedValueOnce(new Error('lost response'))
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('unknown')
    vi.mocked(remote.canvasReconcile).mockResolvedValueOnce({ status: 'not_applied', requestId: 'save-1' })
    await controller.reconcile()
    expect(controller.getSnapshot()).toMatchObject({ dirty: true, saveStatus: 'dirty', editor: { document: { camera: { x: 9 } } } })
    await controller.save()
    expect(remote.canvasSave).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot()).toMatchObject({ dirty: false, saveStatus: 'clean', editor: { document: { revision: 1 } } })
  })
  it('rebases a conflicted draft onto the owner revision on reapply and reloads on discard', async () => {
    const { controller, remote } = setup()
    await controller.load(); controller.createDraft()
    vi.mocked(remote.canvasSave).mockResolvedValueOnce({ status: 'conflict', revision: 3 })
    await controller.save()
    expect(controller.getSnapshot()).toMatchObject({ saveStatus: 'conflict', conflictRevision: 3 })
    controller.resolveConflict('reapply')
    expect(controller.getSnapshot()).toMatchObject({ dirty: true, saveStatus: 'dirty', editor: { document: { revision: 3 } } })
    await controller.save()
    expect(controller.getSnapshot()).toMatchObject({ dirty: false, saveStatus: 'clean', editor: { document: { revision: 4 } } })
    controller.edit({ type: 'camera', camera: { x: 11, y: 0, zoom: 1 } })
    vi.mocked(remote.canvasSave).mockResolvedValueOnce({ status: 'conflict', revision: 7 })
    await controller.save()
    controller.resolveConflict('discard')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(remote.canvasRead).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot()).toMatchObject({ saveStatus: 'clean' })
  })
  it('rejects a wrong request receipt and late callbacks after disposal', async () => {
    const { controller, remote } = setup()
    await controller.load(); controller.createDraft()
    vi.mocked(remote.canvasSave).mockResolvedValueOnce({ status: 'saved', requestId: 'another-request', revision: 1 })
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('unknown')
    const listener = vi.fn(); controller.subscribe(listener); controller.dispose()
    await controller.reconcile(); controller.edit({ type: 'camera', camera: { x: 3, y: 4, zoom: 1 } })
    expect(listener).not.toHaveBeenCalled()
  })
})

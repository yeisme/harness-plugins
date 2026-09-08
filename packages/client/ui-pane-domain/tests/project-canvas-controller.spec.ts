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

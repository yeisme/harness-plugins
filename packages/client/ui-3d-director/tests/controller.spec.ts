import { describe, expect, it, vi } from 'vitest'
import { parseSceneDocument } from '@yeisme/dsh-pane-protocol'
import { Scene3DController, type Scene3DControllerOptions } from '../src/scene3d-controller.ts'
import type { Scene3DDirectorRemote } from '../src/remote.ts'
import { blockedDocumentFixture, sceneDocumentFixture, scope, shotFixture, target } from './fixtures.ts'

function setup(options: {
  read?: unknown
  save?: unknown
  reconcile?: unknown
  exportResult?: unknown
  controllerOptions?: Scene3DControllerOptions
} = {}) {
  const read = options.read ?? { status: 'ready', document: sceneDocumentFixture() }
  const remote: Scene3DDirectorRemote = {
    sceneRead: vi.fn(async () => read),
    saveScene: vi.fn(async request => options.save ?? { status: 'saved', requestId: (request as { requestId: string }).requestId, version: (request as { document: { version: number } }).document.version + 1 }),
    reconcileScene: vi.fn(async () => options.reconcile ?? { status: 'unknown' }),
    importGlb: vi.fn(async () => ({ status: 'unavailable', reason: 'byte_source_unavailable' })),
    exportGlb: vi.fn(async () => options.exportResult ?? { status: 'unavailable' }),
    listChangeSets: vi.fn(async () => ({ status: 'ready', changeSets: [] })),
  }
  const controller = new Scene3DController(remote, { scope: { ...scope }, documentId: 'main' }, { newId: () => 'save-1', ...options.controllerOptions })
  return { controller, remote }
}

describe('Scene3DController load', () => {
  it('loads a ready document', async () => {
    const { controller } = setup()
    await controller.load()
    expect(controller.getSnapshot().status).toBe('ready')
    expect(controller.getSnapshot().document?.version).toBe(3)
    expect(controller.getSnapshot().dirty).toBe(false)
  })

  it('fails closed on a schema violation (no partial truth)', async () => {
    const { controller } = setup({ read: { status: 'ready', document: { schema: 'wrong' } } })
    await controller.load()
    expect(controller.getSnapshot().status).toBe('invalid')
    expect(controller.getSnapshot().document).toBeUndefined()
  })

  it('fails closed on a document escaping the bound scope', async () => {
    const { controller } = setup({ read: { status: 'ready', document: sceneDocumentFixture({ id: 'other' }) } })
    await controller.load()
    expect(controller.getSnapshot().status).toBe('invalid')
  })

  it('degrades to error on transport failure and never polls', async () => {
    const { controller, remote } = setup()
    vi.mocked(remote.sceneRead).mockRejectedValueOnce(new Error('socket closed'))
    await controller.load()
    expect(controller.getSnapshot().status).toBe('error')
    expect(remote.sceneRead).toHaveBeenCalledTimes(1)
  })

  it('replays a journaled draft and settles it through reconcileScene', async () => {
    const document = sceneDocumentFixture()
    const draftDocument = sceneDocumentFixture({ version: 3, nodes: [...document.nodes] })
    const { controller, remote } = setup({
      read: { status: 'ready', document, draft: { requestId: 'save-old', baseVersion: 3, document: draftDocument } },
      reconcile: { status: 'saved', requestId: 'save-old', version: 4 },
    })
    await controller.load()
    const state = controller.getSnapshot()
    expect(remote.reconcileScene).toHaveBeenCalledWith({ ...target, requestId: 'save-old' })
    expect(state.saveStatus).toBe('clean')
    expect(state.document?.version).toBe(4)
  })

  it('fails closed on invalid Shot projections', async () => {
    const { controller } = setup()
    expect(controller.setShots([{ shotRef: 42 }])).toBe(false)
    expect(controller.getSnapshot().status).toBe('invalid')
  })

  it('accepts valid Shot and CanvasBinding projections', async () => {
    const { controller } = setup({ controllerOptions: { shots: [shotFixture()] } })
    expect(controller.getSnapshot().shots).toHaveLength(1)
  })
})

describe('Scene3DController createDraft (new scene draft)', () => {
  it('keeps edits made during a pending save dirty and saves them against the acknowledged revision', async () => {
    const { controller, remote } = setup()
    await controller.load()
    controller.editNodeTransform('hero', { translate: [2, 0, 0] })
    let settle: (value: unknown) => void = () => {}
    vi.mocked(remote.saveScene).mockImplementationOnce(() => new Promise(resolve => { settle = resolve }))
    const saving = controller.save()
    controller.editNodeTransform('hero', { translate: [3, 0, 0] })
    settle({ status: 'saved', requestId: 'save-1', version: 4 })
    await saving
    expect(controller.getSnapshot()).toMatchObject({ dirty: true, saveStatus: 'dirty', document: { version: 4 } })
    expect(controller.getSnapshot().document?.nodes.find(node => node.id === 'hero')?.transform.translate).toEqual([3, 0, 0])
    await controller.save()
    expect(vi.mocked(remote.saveScene).mock.calls[1]?.[0].document.version).toBe(4)
    expect(controller.getSnapshot()).toMatchObject({ dirty: false, saveStatus: 'clean', document: { version: 5 } })
  })
  it('starts a schema-valid version-0 draft after a missing read, bound to the target', async () => {
    const { controller } = setup({ read: { status: 'missing' } })
    await controller.load()
    expect(controller.getSnapshot().status).toBe('missing')
    controller.createDraft()
    const state = controller.getSnapshot()
    expect(state.status).toBe('ready')
    expect(state.dirty).toBe(true)
    expect(state.saveStatus).toBe('dirty')
    expect(state.document?.version).toBe(0)
    expect(state.document?.id).toBe('main')
    expect(state.document?.nodes).toHaveLength(0)
    expect(state.document?.scenes[0]?.default).toBe(true)
    // The fresh draft passes the same pane-protocol schema the gateway enforces.
    expect(parseSceneDocument(state.document)).toMatchObject({ id: 'main', version: 0 })
  })

  it('saves the new draft against base revision 0 and lands as version 1', async () => {
    const { controller, remote } = setup({ read: { status: 'missing' } })
    await controller.load()
    controller.createDraft()
    await controller.save()
    const state = controller.getSnapshot()
    expect(remote.saveScene).toHaveBeenCalledTimes(1)
    expect(state.saveStatus).toBe('clean')
    expect(state.dirty).toBe(false)
    expect(state.document?.version).toBe(1)
  })

  it('refuses to start a draft when a scene already exists', async () => {
    const { controller } = setup()
    await controller.load()
    controller.createDraft()
    const state = controller.getSnapshot()
    expect(state.document?.version).toBe(3)
    expect(state.dirty).toBe(false)
  })

  it('never fabricates a draft before the missing read settles', () => {
    const { controller } = setup({ read: { status: 'missing' } })
    controller.createDraft()
    expect(controller.getSnapshot().status).toBe('loading')
    expect(controller.getSnapshot().document).toBeUndefined()
  })

  it('does nothing after dispose', async () => {
    const { controller } = setup({ read: { status: 'missing' } })
    await controller.load()
    controller.dispose()
    controller.createDraft()
    expect(controller.getSnapshot().status).toBe('missing')
    expect(controller.getSnapshot().document).toBeUndefined()
  })
})

describe('Scene3DController edits and save', () => {
  it('applies draft transform edits and saves against the base revision', async () => {
    const { controller, remote } = setup()
    await controller.load()
    expect(controller.editNodeTransform('hero', { translate: [2, 0, 0] })).toBe(true)
    expect(controller.getSnapshot().dirty).toBe(true)
    await controller.save()
    const state = controller.getSnapshot()
    expect(state.saveStatus).toBe('clean')
    expect(state.document?.version).toBe(4)
    expect(state.document?.nodes.find(node => node.id === 'hero')?.transform.translate).toEqual([2, 0, 0])
    expect(remote.saveScene).toHaveBeenCalledTimes(1)
  })

  it('refuses edits on unknown nodes without side effects', async () => {
    const { controller } = setup()
    await controller.load()
    expect(controller.editNodeTransform('ghost', { translate: [0, 0, 0] })).toBe(false)
    expect(controller.getSnapshot().dirty).toBe(false)
  })

  it('freezes writes on conflict, keeps the draft, and summarizes local vs remote revisions', async () => {
    const { controller } = setup({ save: { status: 'conflict', version: 7 } })
    await controller.load()
    controller.editNodeTransform('hero', { translate: [5, 0, 0] })
    controller.setNodeVisibility('key-light', true)
    await controller.save()
    const state = controller.getSnapshot()
    expect(state.frozen).toBe(true)
    expect(state.saveStatus).toBe('conflict')
    expect(state.conflict?.remoteVersion).toBe(7)
    expect(state.conflict?.localBaseVersion).toBe(3)
    expect(state.conflict?.pendingEditCount).toBe(2)
    expect(state.conflict?.summary).toContain('revision 3')
    expect(state.conflict?.summary).toContain('revision 7')
    // Local draft is preserved, never overwritten.
    expect(state.document?.nodes.find(node => node.id === 'hero')?.transform.translate).toEqual([5, 0, 0])
    // Frozen: mutations refuse while frozen, and save is a no-op.
    expect(controller.editNodeTransform('hero', { translate: [9, 9, 9] })).toBe(false)
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('conflict')
  })

  it('reapply rebases the draft onto the owner-confirmed revision without losing edits', async () => {
    const { controller } = setup({ save: { status: 'conflict', version: 7 } })
    await controller.load()
    controller.editNodeTransform('hero', { translate: [5, 0, 0] })
    await controller.save()
    controller.resolveConflict('reapply')
    const state = controller.getSnapshot()
    expect(state.frozen).toBe(false)
    expect(state.saveStatus).toBe('dirty')
    expect(state.document?.version).toBe(7)
    expect(state.document?.nodes.find(node => node.id === 'hero')?.transform.translate).toEqual([5, 0, 0])
  })

  it('discard reloads the owner truth', async () => {
    const { controller, remote } = setup({ save: { status: 'conflict', version: 7 } })
    await controller.load()
    controller.editNodeTransform('hero', { translate: [5, 0, 0] })
    await controller.save()
    vi.mocked(remote.sceneRead).mockResolvedValueOnce({ status: 'ready', document: sceneDocumentFixture({ version: 7 }) })
    controller.resolveConflict('discard')
    await vi.waitFor(() => expect(controller.getSnapshot().document?.version).toBe(7))
    const state = controller.getSnapshot()
    expect(state.frozen).toBe(false)
    expect(state.dirty).toBe(false)
    expect(state.document?.nodes.find(node => node.id === 'hero')?.transform.translate).toEqual([1, 0, 0])
  })

  it('keeps unknown saves pending and settles them only via reconcileScene', async () => {
    const { controller, remote } = setup({ save: { status: 'unknown' }, reconcile: { status: 'saved', requestId: 'save-1', version: 4 } })
    await controller.load()
    controller.setNodeVisibility('hero', false)
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('unknown')
    expect(remote.reconcileScene).not.toHaveBeenCalled()
    await controller.reconcile()
    const state = controller.getSnapshot()
    expect(state.saveStatus).toBe('clean')
    expect(state.document?.version).toBe(4)
  })

  it('treats unparseable save results as unknown, never as success', async () => {
    const { controller } = setup({ save: { bogus: true } })
    await controller.load()
    controller.setNodeVisibility('hero', false)
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('unknown')
    expect(controller.getSnapshot().dirty).toBe(true)
  })

  it('returns not_applied drafts to a retryable dirty state without auto-retrying', async () => {
    const { controller, remote } = setup({ save: { status: 'not_applied', requestId: 'save-1' } })
    await controller.load()
    controller.setNodeVisibility('hero', false)
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('dirty')
    expect(remote.saveScene).toHaveBeenCalledTimes(1)
  })
})

describe('Scene3DController shot drafts', () => {
  it('applies timeline keyframe edits to the draft and clamps to the frame range', async () => {
    const { controller } = setup({ controllerOptions: { shots: [shotFixture()] } })
    await controller.load()
    expect(controller.editShotKeyframe('shot:opening', { type: 'move-keyframe', keyframeId: 'kf-2', frame: 999 })).toBe(true)
    const shot = controller.getSnapshot().shots[0]
    expect(shot?.keyframes.find(keyframe => keyframe.id === 'kf-2')?.frame).toBe(48)
    expect(controller.getSnapshot().dirty).toBe(true)
  })

  it('does not report unsaved keyframes as saved when the host lacks workbench persistence', async () => {
    const { controller, remote } = setup({ controllerOptions: { shots: [shotFixture()] } })
    await controller.load()
    controller.editShotKeyframe('shot:opening', { type: 'move-keyframe', keyframeId: 'kf-2', frame: 10 })
    await controller.save()
    expect(controller.getSnapshot()).toMatchObject({ dirty: true, saveStatus: 'error' })
    expect(remote.saveScene).not.toHaveBeenCalled()
  })

  it('refuses keyframe edits while conflict-frozen', async () => {
    const { controller } = setup({ save: { status: 'conflict', version: 5 }, controllerOptions: { shots: [shotFixture()] } })
    await controller.load()
    controller.setNodeVisibility('hero', false)
    await controller.save()
    expect(controller.editShotKeyframe('shot:opening', { type: 'move-keyframe', keyframeId: 'kf-2', frame: 10 })).toBe(false)
  })
})

describe('Scene3DController export', () => {
  it('blocks export locally when the capability report is not ready (no remote call)', async () => {
    const { controller, remote } = setup({ read: { status: 'ready', document: blockedDocumentFixture() } })
    await controller.load()
    await controller.exportScene()
    const exported = controller.getSnapshot().export
    expect(exported.status).toBe('blocked')
    if (exported.status === 'blocked') {
      expect(exported.gaps[0]?.extension).toBe('KHR_draco_mesh_compression')
      expect(exported.gaps[0]?.reason).toContain('Draco')
    }
    expect(remote.exportGlb).not.toHaveBeenCalled()
  })

  it('surfaces host capability_blocked with its gaps', async () => {
    const { controller } = setup({
      exportResult: { status: 'capability_blocked', gaps: [{ extension: 'KHR_draco_mesh_compression', reason: 'lossy re-encode' }], reason: 'Export is blocked by capability gaps.' },
    })
    await controller.load()
    await controller.exportScene()
    const exported = controller.getSnapshot().export
    expect(exported.status).toBe('blocked')
    if (exported.status === 'blocked') expect(exported.gaps).toHaveLength(1)
  })

  it('hands exported bytes to the onExportBytes callback with the validated report', async () => {
    const onExportBytes = vi.fn()
    const report = { gltfVersion: '2.0', extensions: [], export: { ready: true, gaps: [] } }
    const { controller } = setup({
      exportResult: { status: 'exported', bytesBase64: 'AAAA', size: 3, mediaType: 'model/gltf-binary', report },
      controllerOptions: { onExportBytes },
    })
    await controller.load()
    await controller.exportScene()
    expect(onExportBytes).toHaveBeenCalledWith('AAAA', report)
    expect(controller.getSnapshot().export.status).toBe('exported')
  })

  it('fails closed when the exported report violates the contract', async () => {
    const onExportBytes = vi.fn()
    const { controller } = setup({
      exportResult: { status: 'exported', bytesBase64: 'AAAA', size: 3, mediaType: 'model/gltf-binary', report: { gltfVersion: '1.0' } },
      controllerOptions: { onExportBytes },
    })
    await controller.load()
    await controller.exportScene()
    expect(controller.getSnapshot().export.status).toBe('failed')
    expect(onExportBytes).not.toHaveBeenCalled()
  })

  it('refuses export while conflict-frozen', async () => {
    const { controller, remote } = setup({ save: { status: 'conflict', version: 6 } })
    await controller.load()
    controller.setNodeVisibility('hero', false)
    await controller.save()
    await controller.exportScene()
    expect(remote.exportGlb).not.toHaveBeenCalled()
    expect(controller.getSnapshot().export.status).toBe('idle')
  })
})

describe('Scene3DController change sets and dispose', () => {
  it('lists change sets and degrades the listing on contract violations', async () => {
    const { controller, remote } = setup()
    await controller.load()
    await controller.refreshChangeSets()
    expect(controller.getSnapshot().changeSetsStatus).toBe('ready')
    vi.mocked(remote.listChangeSets).mockResolvedValueOnce({ status: 'ready', changeSets: [{ broken: true }] })
    await controller.refreshChangeSets()
    expect(controller.getSnapshot().changeSetsStatus).toBe('unavailable')
    expect(controller.getSnapshot().changeSets).toHaveLength(0)
  })

  it('dispose is idempotent and silences listeners and late promises', async () => {
    const { controller, remote } = setup()
    const listener = vi.fn()
    controller.subscribe(listener)
    await controller.load()
    expect(listener).toHaveBeenCalled()
    controller.dispose()
    controller.dispose()
    listener.mockClear()
    controller.selectNode('hero')
    await controller.load()
    expect(listener).not.toHaveBeenCalled()
    expect(remote.sceneRead).toHaveBeenCalledTimes(1)
  })
})

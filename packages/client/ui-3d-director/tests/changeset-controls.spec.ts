import { describe, expect, it, vi } from 'vitest'
import { Scene3DController } from '../src/scene3d-controller.ts'
import type { Scene3DDirectorRemote } from '../src/remote.ts'
import { changeSetFixture, sceneDocumentFixture, scope } from './fixtures.ts'

function setup(options: {
  read?: unknown
  changeSets?: unknown
  controls?: Partial<Pick<Scene3DDirectorRemote, 'previewChangeSet' | 'acceptChangeSet' | 'rejectChangeSet' | 'rollbackChangeSet'>>
  omitControls?: boolean
} = {}) {
  const read = options.read ?? { status: 'ready', document: sceneDocumentFixture() }
  const remote: Scene3DDirectorRemote = {
    sceneRead: vi.fn(async () => read),
    saveScene: vi.fn(async request => ({ status: 'saved', requestId: (request as { requestId: string }).requestId, version: (request as { document: { version: number } }).document.version + 1 })),
    reconcileScene: vi.fn(async () => ({ status: 'unknown' })),
    importGlb: vi.fn(async () => ({ status: 'unavailable' })),
    exportGlb: vi.fn(async () => ({ status: 'unavailable' })),
    listChangeSets: vi.fn(async () => options.changeSets ?? { status: 'ready', changeSets: [changeSetFixture()] }),
    ...(options.omitControls === true ? {} : {
      previewChangeSet: vi.fn(async () => ({ status: 'ready', changeSet: changeSetFixture(), currentVersion: 3, baseRevisionRetained: true })),
      acceptChangeSet: vi.fn(async () => ({ status: 'accepted', changeSet: changeSetFixture({ status: 'accepted', rollbackRef: 'scene-revision:main@3' }), version: 4 })),
      rejectChangeSet: vi.fn(async () => ({ status: 'updated', changeSet: changeSetFixture({ status: 'rejected' }) })),
      rollbackChangeSet: vi.fn(async () => ({ status: 'rolled_back', changeSet: changeSetFixture({ status: 'rolled_back', rollbackRef: 'scene-revision:main@4' }), version: 4 })),
      ...options.controls,
    }),
  }
  const controller = new Scene3DController(remote, { scope: { ...scope }, documentId: 'main' }, { newId: () => 'cs-op-1' })
  return { controller, remote }
}

describe('Scene3DController change-set controls', () => {
  it('previews a change set with its comparison baseline, fail-closed', async () => {
    const { controller, remote } = setup()
    await controller.load()
    const preview = await controller.previewChangeSet('changeset:one')
    expect(preview).toMatchObject({ status: 'ready', currentVersion: 3, baseRevisionRetained: true })
    expect(remote.previewChangeSet).toHaveBeenCalledWith({ scope: { ...scope }, documentId: 'main', changeSetRef: 'changeset:one' })
    vi.mocked(remote.previewChangeSet!).mockResolvedValueOnce({ status: 'ready', changeSet: { broken: true } })
    expect((await controller.previewChangeSet('changeset:one')).status).toBe('invalid')
    vi.mocked(remote.previewChangeSet!).mockRejectedValueOnce(new Error('socket closed'))
    expect((await controller.previewChangeSet('changeset:one')).status).toBe('unavailable')
  })

  it('degrades honestly when the host predates the change-set control seam', async () => {
    const { controller } = setup({ omitControls: true })
    await controller.load()
    expect(controller.changeSetControlsAvailable).toBe(false)
    expect((await controller.previewChangeSet('changeset:one')).status).toBe('unavailable')
    expect(await controller.acceptChangeSet('changeset:one')).toMatchObject({ status: 'failed', reason: 'The host does not expose change-set controls.' })
    expect(await controller.rejectChangeSet('changeset:one')).toMatchObject({ status: 'failed' })
    expect(await controller.rollbackChangeSet('changeset:one')).toMatchObject({ status: 'failed' })
  })

  it('accepts a change set by committing the local draft and refreshes the list', async () => {
    const { controller, remote } = setup()
    await controller.load()
    await controller.refreshChangeSets()
    controller.editNodeTransform('hero', { translate: [2, 0, 0] })
    const outcome = await controller.acceptChangeSet('changeset:one')
    expect(outcome).toEqual({ status: 'accepted', version: 4 })
    expect(remote.acceptChangeSet).toHaveBeenCalledWith(expect.objectContaining({
      changeSetRef: 'changeset:one',
      requestId: 'cs-op-1',
      artifactRef: expect.objectContaining({ ref: 'artifact:gen-1' }),
    }))
    const state = controller.getSnapshot()
    expect(state.dirty).toBe(false)
    expect(state.saveStatus).toBe('clean')
    expect(state.document?.version).toBe(4)
    expect(remote.listChangeSets).toHaveBeenCalledTimes(2)
  })

  it('refuses accept without an owner-recorded artifact ref and never calls the remote', async () => {
    const { controller, remote } = setup({ changeSets: { status: 'ready', changeSets: [changeSetFixture({ artifactRef: undefined })] } })
    await controller.load()
    await controller.refreshChangeSets()
    const outcome = await controller.acceptChangeSet('changeset:one')
    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') expect(outcome.reason).toContain('artifact ref')
    expect(remote.acceptChangeSet).not.toHaveBeenCalled()
  })

  it('freezes writes when accept reports a revision conflict, matching save semantics', async () => {
    const { controller } = setup({ controls: { acceptChangeSet: vi.fn(async () => ({ status: 'conflict', version: 7 })) } })
    await controller.load()
    await controller.refreshChangeSets()
    controller.editNodeTransform('hero', { translate: [5, 0, 0] })
    const outcome = await controller.acceptChangeSet('changeset:one')
    expect(outcome).toEqual({ status: 'conflict', version: 7 })
    const state = controller.getSnapshot()
    expect(state.frozen).toBe(true)
    expect(state.saveStatus).toBe('conflict')
    expect(state.conflict?.remoteVersion).toBe(7)
    // Frozen: further change-set mutations refuse without remote calls.
    expect((await controller.acceptChangeSet('changeset:one')).status).toBe('failed')
  })

  it('rejects a change set and refreshes; transition refusals carry a bounded reason', async () => {
    const { controller, remote } = setup()
    await controller.load()
    await controller.refreshChangeSets()
    expect(await controller.rejectChangeSet('changeset:one', 'not the direction')).toEqual({ status: 'rejected' })
    expect(remote.rejectChangeSet).toHaveBeenCalledWith(expect.objectContaining({ changeSetRef: 'changeset:one', reason: 'not the direction' }))
    vi.mocked(remote.rejectChangeSet!).mockResolvedValueOnce({ status: 'invalid_transition', from: 'accepted', to: 'rejected' })
    const refused = await controller.rejectChangeSet('changeset:one')
    expect(refused.status).toBe('failed')
    if (refused.status === 'failed') expect(refused.reason).toContain('accepted')
  })

  it('refuses rollback while a local draft is dirty and never drops it silently', async () => {
    const { controller, remote } = setup()
    await controller.load()
    await controller.refreshChangeSets()
    controller.setNodeVisibility('hero', false)
    const outcome = await controller.rollbackChangeSet('changeset:one')
    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') expect(outcome.reason).toContain('Save or discard')
    expect(remote.rollbackChangeSet).not.toHaveBeenCalled()
    expect(controller.getSnapshot().dirty).toBe(true)
  })

  it('rolls back and reloads the owner truth before further edits', async () => {
    const { controller, remote } = setup()
    await controller.load()
    await controller.refreshChangeSets()
    const outcome = await controller.rollbackChangeSet('changeset:one')
    expect(outcome).toEqual({ status: 'rolled_back', version: 4 })
    expect(remote.rollbackChangeSet).toHaveBeenCalledWith(expect.objectContaining({ changeSetRef: 'changeset:one', requestId: 'cs-op-1' }))
    // The scene re-read after rollback: owner truth, clean, unfrozen.
    expect(remote.sceneRead).toHaveBeenCalledTimes(2)
    const state = controller.getSnapshot()
    expect(state.status).toBe('ready')
    expect(state.dirty).toBe(false)
  })
})

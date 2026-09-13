import { describe, expect, it } from 'vitest'
import { probeScene3DDirector, SCENE_3D_PROBE_REASONS } from '../src/probe.ts'
import { isScene3DDirectorRemote, type Scene3DDirectorRemote } from '../src/remote.ts'

function remoteStub(): Scene3DDirectorRemote {
  return {
    sceneRead: async () => ({ status: 'missing' }),
    saveScene: async () => ({ status: 'unknown' }),
    reconcileScene: async () => ({ status: 'unknown' }),
    importGlb: async () => ({ status: 'unavailable' }),
    exportGlb: async () => ({ status: 'unavailable' }),
    listChangeSets: async () => ({ status: 'ready', changeSets: [] }),
  }
}

describe('probeScene3DDirector', () => {
  it('reports needs_contract when the seam is absent (honest degrade, no fake remote)', () => {
    const ctx = { get: () => undefined }
    const probe = probeScene3DDirector(ctx)
    expect(probe.status).toBe('needs_contract')
    expect(SCENE_3D_PROBE_REASONS.needsContract).toContain('scene3dDirector')
  })

  it('reports needs_contract when the remote has the wrong shape', () => {
    const ctx = { get: (name: string) => name === 'remote' ? { scene3dDirector: { sceneRead: async () => ({}) } } : undefined }
    expect(probeScene3DDirector(ctx).status).toBe('needs_contract')
  })

  it('resolves the remote through the remote record member', () => {
    const remote = remoteStub()
    const ctx = { get: (name: string) => name === 'remote' ? { scene3dDirector: remote } : undefined }
    const probe = probeScene3DDirector(ctx)
    expect(probe.status).toBe('available')
    if (probe.status === 'available') expect(probe.capability).toBe(remote)
  })

  it('resolves the remote through the direct remote.<name> service key', () => {
    const remote = remoteStub()
    const ctx = { get: (name: string) => name === 'remote.scene3dDirector' ? remote : undefined }
    expect(probeScene3DDirector(ctx).status).toBe('available')
  })

  it('maps a throwing context to unavailable with a bounded reason', () => {
    const ctx = { get: (): never => { throw new Error('ctx disposed') } }
    const probe = probeScene3DDirector(ctx)
    expect(probe.status).toBe('unavailable')
    if (probe.status === 'unavailable') expect(probe.reason).toBe('ctx disposed')
  })

  it('isScene3DDirectorRemote refuses partial faces', () => {
    expect(isScene3DDirectorRemote(undefined)).toBe(false)
    expect(isScene3DDirectorRemote({})).toBe(false)
    expect(isScene3DDirectorRemote(remoteStub())).toBe(true)
  })
})

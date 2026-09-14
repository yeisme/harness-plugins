import { describe, expect, it, vi } from 'vitest'
import { SCENE_3D_SCHEMA, type SceneDocumentV1, type ShotV1 } from '@yeisme/dsh-pane-protocol'
import {
  SceneGraphStore,
  parseSceneGraphRow,
  type Scene3DChangeSetsTable,
  type Scene3DDocumentsTable,
  type Scene3DStorage,
  type Scene3DStoreContextV1,
} from '../src/scene-store.ts'

function context(): Scene3DStoreContextV1 {
  return { tenantRef: 'tenant:one', workspaceRef: 'workspace:one', projectRef: 'project:one' }
}

export function sceneDocument(overrides: Partial<SceneDocumentV1> = {}): SceneDocumentV1 {
  return {
    schema: SCENE_3D_SCHEMA,
    scope: { workspaceRef: 'workspace:one', projectRef: 'project:one' },
    id: 'scene:main',
    version: 0,
    scenes: [{ id: 'shot:one', label: 'Shot one', rootNodeIds: ['node:root'], default: true }],
    nodes: [{
      id: 'node:root',
      label: 'Root',
      kind: 'group',
      transform: { translate: [0, 0, 0], rotate: [0, 0, 0, 1], scale: [1, 1, 1] },
      visible: true,
    }],
    resources: [],
    extensions: { used: [], required: [] },
    capabilityReport: { gltfVersion: '2.0', extensions: [], export: { ready: true, gaps: [] } },
    ...overrides,
  }
}

function harness() {
  let current: Scene3DStoreContextV1 | undefined = context()
  const docs = new Map<string, unknown>()
  const sets = new Map<string, unknown>()
  const documents: Scene3DDocumentsTable = { get: key => docs.get(key), put: vi.fn(async (key, value) => { docs.set(key, structuredClone(value)) }) }
  const changeSets: Scene3DChangeSetsTable = { get: key => sets.get(key), put: vi.fn(async (key, value) => { sets.set(key, structuredClone(value)) }) }
  const close = vi.fn(async () => {})
  const storage: Scene3DStorage = { open: vi.fn(async () => ({ table: name => name === 'documents' ? documents : changeSets, close })) }
  const store = new SceneGraphStore(storage, () => current)
  return { store, storage, docs, sets, documents, changeSets, close, setContext: (value: Scene3DStoreContextV1 | undefined) => { current = value } }
}

const read = { scope: sceneDocument().scope, documentId: 'scene:main' }

describe('Host scene graph persistence', () => {
  it('does not write when opening a missing scene and confirms only after durable put', async () => {
    const h = harness()
    expect(await h.store.read(read)).toEqual({ status: 'missing' })
    expect(h.documents.put).not.toHaveBeenCalled()
    expect(await h.store.save({ requestId: 'save-1', document: sceneDocument() })).toEqual({ status: 'saved', requestId: 'save-1', version: 1 })
    expect(await h.store.read(read)).toMatchObject({ status: 'ready', document: { version: 1 } })
    await h.store.close()
    expect(h.close).toHaveBeenCalledOnce()
  })

  it('increments the revision on every committed save', async () => {
    const h = harness()
    expect(await h.store.save({ requestId: 'save-1', document: sceneDocument() })).toEqual({ status: 'saved', requestId: 'save-1', version: 1 })
    expect(await h.store.save({ requestId: 'save-2', document: sceneDocument({ version: 1 }) })).toEqual({ status: 'saved', requestId: 'save-2', version: 2 })
    expect(await h.store.read(read)).toMatchObject({ status: 'ready', document: { version: 2 } })
  })

  it('serializes simultaneous writers so one stale base conflicts and keeps its draft', async () => {
    const h = harness()
    const results = await Promise.all(['one', 'two'].map(requestId => h.store.save({ requestId, document: sceneDocument() })))
    expect(results).toEqual([{ status: 'saved', requestId: 'one', version: 1 }, { status: 'conflict', version: 1 }])
    // One write-ahead journal plus one commit for the winner; the stale writer performs neither.
    expect(h.documents.put).toHaveBeenCalledTimes(2)
    // The conflicting writer's document is never persisted; a read shows only the committed revision.
    expect(await h.store.read(read)).toMatchObject({ status: 'ready', document: { version: 1 } })
  })

  it('replays the original receipt and rejects request id reuse with different content', async () => {
    const h = harness()
    const request = { requestId: 'save-1', document: sceneDocument() }
    const original = await h.store.save(request)
    expect(await h.store.save(request)).toEqual(original)
    const edited = sceneDocument()
    edited.nodes = [{ ...edited.nodes[0]!, label: 'Renamed root' }]
    expect(await h.store.save({ ...request, document: edited })).toEqual({ status: 'conflict', version: 1 })
    expect(h.documents.put).toHaveBeenCalledTimes(2)
  })

  it('returns unavailable before journaling and unknown only after a journaled commit fails', async () => {
    const h = harness()
    vi.mocked(h.documents.put).mockImplementationOnce(async () => { throw new Error('private failure details') })
    expect(await h.store.save({ requestId: 'save-1', document: sceneDocument() })).toEqual({ status: 'unavailable' })
    expect(await h.store.read(read)).toEqual({ status: 'missing' })
  })

  it('returns unknown for a lost commit response and reconciles without another content write', async () => {
    const h = harness()
    vi.mocked(h.documents.put).mockImplementationOnce(async (key, value) => { h.docs.set(key, value); return Promise.resolve() })
    vi.mocked(h.documents.put).mockImplementationOnce(async (key, value) => { h.docs.set(key, value); throw new Error('private failure details') })
    expect(await h.store.save({ requestId: 'save-1', document: sceneDocument() })).toEqual({ status: 'unknown' })
    expect(await h.store.reconcile({ ...read, requestId: 'save-1' })).toEqual({ status: 'saved', requestId: 'save-1', version: 1 })
    expect(h.documents.put).toHaveBeenCalledTimes(2)
  })

  it('recovers a journaled save that never committed and surfaces the draft after remount', async () => {
    const h = harness()
    vi.mocked(h.documents.put).mockImplementationOnce(async (key, value) => { h.docs.set(key, value); return Promise.resolve() })
    vi.mocked(h.documents.put).mockImplementationOnce(async () => { throw new Error('private failure details') })
    const draft = sceneDocument()
    draft.nodes = [{ ...draft.nodes[0]!, label: 'Draft root' }]
    expect(await h.store.save({ requestId: 'save-1', document: draft })).toEqual({ status: 'unknown' })
    // A fresh session sees no confirmed document, only the journaled intent.
    expect(await h.store.read(read)).toEqual({ status: 'missing', draft: { requestId: 'save-1', baseVersion: 0, document: draft } })
    expect(await h.store.reconcile({ ...read, requestId: 'save-1' })).toEqual({ status: 'not_applied', requestId: 'save-1' })
    expect(await h.store.read(read)).toEqual({ status: 'missing' })
    // The recovered draft re-saves under a fresh request id at the same base revision.
    expect(await h.store.save({ requestId: 'save-2', document: draft })).toEqual({ status: 'saved', requestId: 'save-2', version: 1 })
  })

  it('blocks a new save behind an unsettled journal instead of overwriting it', async () => {
    const h = harness()
    vi.mocked(h.documents.put).mockImplementationOnce(async (key, value) => { h.docs.set(key, value); return Promise.resolve() })
    vi.mocked(h.documents.put).mockImplementationOnce(async () => { throw new Error('private failure details') })
    expect(await h.store.save({ requestId: 'save-1', document: sceneDocument() })).toEqual({ status: 'unknown' })
    expect(await h.store.save({ requestId: 'save-2', document: sceneDocument() })).toEqual({ status: 'unknown' })
    expect(h.documents.put).toHaveBeenCalledTimes(2)
  })

  it('retains a bounded history of committed revisions for rollback', async () => {
    const h = harness()
    await h.store.save({ requestId: 'save-1', document: sceneDocument() })
    await h.store.save({ requestId: 'save-2', document: sceneDocument({ version: 1 }) })
    await h.store.save({ requestId: 'save-3', document: sceneDocument({ version: 2 }) })
    expect(await h.store.readVersion(read.scope, 'scene:main', 1)).toMatchObject({ version: 1 })
    expect(await h.store.readVersion(read.scope, 'scene:main', 2)).toMatchObject({ version: 2 })
    expect(await h.store.readVersion(read.scope, 'scene:main', 3)).toMatchObject({ version: 3 })
    expect(await h.store.readVersion(read.scope, 'scene:main', 99)).toBeUndefined()
  })

  it('retains the committed shots of each revision so rollback restores the historical previz state', async () => {
    const h = harness()
    const shot = (frame: number): ShotV1 => ({
      shotRef: 'shot:opening',
      sceneRef: 'scene:one',
      version: 'v1',
      cameraRef: 'node:root',
      frameRange: { start: 0, end: 48, fps: 24 },
      keyframes: [{ id: 'kf-1', frame, objectRef: 'node:root', property: 'translate', value: [0, 0, 0] }],
      objectRefs: ['node:root'],
      visibility: [],
      generationRefs: [],
      deliveryProjection: { status: 'pending' },
    })
    // v1 commits the previz shot at frame 0; v2 moves the keyframe to frame 12.
    await h.store.save({ requestId: 'save-1', document: sceneDocument() }, [shot(0)])
    await h.store.save({ requestId: 'save-2', document: sceneDocument({ version: 1 }) }, [shot(12)])
    expect(await h.store.readWorkbenchVersion(read.scope, 'scene:main', 1)).toMatchObject({ document: { version: 1 }, shots: [{ keyframes: [{ frame: 0 }] }] })
    expect(await h.store.readWorkbenchVersion(read.scope, 'scene:main', 2)).toMatchObject({ document: { version: 2 }, shots: [{ keyframes: [{ frame: 12 }] }] })
    // Rollback path: re-committing the retained v1 payload restores its shots exactly.
    const retained = await h.store.readWorkbenchVersion(read.scope, 'scene:main', 1)
    expect(await h.store.save({ requestId: 'rollback-1', document: { ...retained!.document, version: 2 } }, retained!.shots)).toEqual({ status: 'saved', requestId: 'rollback-1', version: 3 })
    const after = await h.store.readWorkbench(read)
    expect(after.result).toMatchObject({ status: 'ready', document: { version: 3 } })
    expect(after.shots?.[0]?.keyframes[0]?.frame).toBe(0)
    // The ring stays bounded and keeps the payload envelopes, not bare documents.
    const row = parseSceneGraphRow(h.docs.get(JSON.stringify(['tenant:one', 'workspace:one', 'project:one', 'scene:main'])))
    expect(row.history.length).toBeLessThanOrEqual(8)
    expect(row.history.every(entry => typeof entry.document.version === 'number')).toBe(true)
  })

  it('reads legacy bare-document history rows without fabricating shots', async () => {
    const h = harness()
    await h.store.save({ requestId: 'save-1', document: sceneDocument() })
    await h.store.save({ requestId: 'save-2', document: sceneDocument({ version: 1 }) })
    const key = JSON.stringify(['tenant:one', 'workspace:one', 'project:one', 'scene:main'])
    const row = parseSceneGraphRow(h.docs.get(key))
    // Simulate a pre-envelope persisted row: history entries as bare documents.
    h.docs.set(key, { ...row, history: row.history.map(entry => entry.document) })
    const legacy = await h.store.readWorkbenchVersion(read.scope, 'scene:main', 1)
    expect(legacy).toMatchObject({ document: { version: 1 } })
    expect(legacy).not.toHaveProperty('shots')
    // A rollback over a legacy entry keeps the CURRENT shots (save-without-shots semantics).
    expect(await h.store.save({ requestId: 'save-3', document: sceneDocument({ version: 2 }) }, [
      { shotRef: 'shot:opening', sceneRef: 'scene:one', version: 'v1', cameraRef: 'node:root', frameRange: { start: 0, end: 48, fps: 24 }, keyframes: [], objectRefs: [], visibility: [], generationRefs: [], deliveryProjection: { status: 'pending' } },
    ])).toEqual({ status: 'saved', requestId: 'save-3', version: 3 })
    const retained = await h.store.readWorkbenchVersion(read.scope, 'scene:main', 2)
    expect(await h.store.save({ requestId: 'rollback-1', document: { ...retained!.document, version: 3 } }, retained!.shots)).toEqual({ status: 'saved', requestId: 'rollback-1', version: 4 })
    expect(await h.store.readWorkbench(read)).toMatchObject({ result: { status: 'ready' }, shots: [{ shotRef: 'shot:opening' }] })
  })

  it('rejects cross-project reads and forged authority without opening storage', async () => {
    const h = harness()
    expect(await h.store.read({ ...read, scope: { ...read.scope, projectRef: 'project:other' } })).toEqual({ status: 'forbidden' })
    expect(await h.store.save({ requestId: 'save-1', principalRef: 'forged', document: sceneDocument() })).toEqual({ status: 'invalid' })
    expect(h.storage.open).not.toHaveBeenCalled()
    h.setContext(undefined)
    expect(await h.store.save({ requestId: 'save-1', document: sceneDocument() })).toEqual({ status: 'forbidden' })
  })

  it('shares project content across sessions but isolates tenants', async () => {
    const h = harness()
    await h.store.save({ requestId: 'save-1', document: sceneDocument() })
    h.setContext({ ...context(), tenantRef: 'tenant:two' })
    expect(await h.store.read(read)).toEqual({ status: 'missing' })
  })

  it('rechecks context after async acquisition and preserves rejected drafts', async () => {
    const h = harness()
    let release!: () => void
    vi.mocked(h.storage.open).mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { release = resolve })
      return { table: name => name === 'documents' ? h.documents : h.changeSets, close: h.close }
    })
    const saving = h.store.save({ requestId: 'save-1', document: sceneDocument() })
    await Promise.resolve()
    h.setContext({ ...context(), projectRef: 'project:other' })
    release()
    expect(await saving).toEqual({ status: 'forbidden' })
    expect(h.documents.put).not.toHaveBeenCalled()
  })

  it('reads confirmed rows after remount without sharing an in-memory document cache', async () => {
    const h = harness()
    await h.store.save({ requestId: 'save-1', document: sceneDocument() })
    await h.store.close()
    const next = new SceneGraphStore(h.storage, context)
    expect(await next.read(read)).toMatchObject({ status: 'ready', document: { version: 1 } })
    expect(await h.store.read(read)).toEqual({ status: 'forbidden' })
    await next.close()
  })
})

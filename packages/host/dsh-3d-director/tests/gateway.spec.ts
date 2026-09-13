import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  GenerationChangeSetSchema,
  SCENE_3D_SCHEMA,
  SceneDocumentSchema,
  SceneGraphReadResultSchema,
  SceneGraphSaveResultSchema,
  type GenerationChangeSetV1,
  type SceneDocumentV1,
} from '@yeisme/dsh-pane-protocol'
import {
  SCENE_3D_CONTEXT_SCHEMA,
  SCENE_3D_DIRECTOR_SERVICE_KEY,
  SCENE_3D_EXPECTED_CONTEXT,
  SCENE_3D_GLB_BYTE_SOURCE,
  SceneGraphGateway,
  validateScene3DContext,
  type Scene3DContextV1,
  type Scene3DGlbByteSourceV1,
} from '../src/gateway.ts'
import {
  SceneGraphStore,
  type Scene3DChangeSetsTable,
  type Scene3DDocumentsTable,
  type Scene3DStorage,
  type Scene3DStoreContextV1,
} from '../src/scene-store.ts'
import { GenerationChangeSetLog, sceneRevisionRef } from '../src/change-set.ts'

const contexts: Context[] = []
afterEach(async () => { await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose())) })

function scene3dContext(overrides: Partial<Scene3DContextV1> = {}): Scene3DContextV1 {
  return {
    schema: SCENE_3D_CONTEXT_SCHEMA,
    tenantRef: 'tenant:one',
    workspaceRef: 'workspace:one',
    projectRef: 'project:one',
    ...overrides,
  }
}

function sceneDocument(overrides: Partial<SceneDocumentV1> = {}): SceneDocumentV1 {
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

function artifact(ref: string) {
  return { schema: 'pane.artifact.v1alpha1' as const, owner: 'gen3d', kind: 'scene', ref, version: '1', mediaType: 'model/gltf-binary', title: ref, evidenceRefs: [], capabilities: ['read'] }
}

function changeSet(overrides: Partial<GenerationChangeSetV1> = {}): GenerationChangeSetV1 {
  return {
    changeSetRef: 'changeset:one',
    sceneRef: 'scene:main',
    baseVersion: 1,
    inputRefs: ['asset:teapot'],
    operationSummary: 'Regenerate teapot transforms',
    patchDigest: 'sha256:0123456789abcdef',
    status: 'pending',
    ...overrides,
  }
}

/** Minimal valid GLB container: header + one JSON chunk declaring only the asset version. */
function minimalGlb(): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' } }))
  const padded = jsonBytes.length + ((4 - (jsonBytes.length % 4)) % 4)
  const buffer = new ArrayBuffer(12 + 8 + padded)
  const view = new DataView(buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, buffer.byteLength, true)
  view.setUint32(12, padded, true)
  view.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(buffer, 20).set(jsonBytes)
  // GLB JSON chunks are space-padded to 4 bytes.
  new Uint8Array(buffer, 20 + jsonBytes.length).fill(0x20)
  return new Uint8Array(buffer)
}

function storageHarness() {
  const docs = new Map<string, unknown>()
  const sets = new Map<string, unknown>()
  const documents: Scene3DDocumentsTable = { get: key => docs.get(key), put: vi.fn(async (key, value) => { docs.set(key, structuredClone(value)) }) }
  const changeSets: Scene3DChangeSetsTable = { get: key => sets.get(key), put: vi.fn(async (key, value) => { sets.set(key, structuredClone(value)) }) }
  const close = vi.fn(async () => {})
  const storage: Scene3DStorage = { open: vi.fn(async () => ({ table: name => name === 'documents' ? documents : changeSets, close })) }
  return { storage, docs, sets, documents, changeSets, close }
}

async function gatewayHarness(input?: { context?: Scene3DContextV1; storage?: Scene3DStorage; byteSource?: Scene3DGlbByteSourceV1 }) {
  const ctx = new Context()
  contexts.push(ctx)
  if (input?.context !== undefined) ctx.provide(SCENE_3D_EXPECTED_CONTEXT, input.context)
  if (input?.storage !== undefined) ctx.provide('storageDomain', input.storage)
  if (input?.byteSource !== undefined) ctx.provide(SCENE_3D_GLB_BYTE_SOURCE, input.byteSource)
  await ctx.plugin(SceneGraphGateway)
  return { ctx, gateway: ctx.get(SCENE_3D_DIRECTOR_SERVICE_KEY) as SceneGraphGateway }
}

function logHarness() {
  let current: Scene3DStoreContextV1 | undefined = { tenantRef: 'tenant:one', workspaceRef: 'workspace:one', projectRef: 'project:one' }
  const h = storageHarness()
  const store = new SceneGraphStore(h.storage, () => current)
  const log = new GenerationChangeSetLog(store)
  return { ...h, store, log, setContext: (value: Scene3DStoreContextV1 | undefined) => { current = value } }
}

const scope = { workspaceRef: 'workspace:one', projectRef: 'project:one' }
const read = { scope, documentId: 'scene:main' }

describe('scene 3d context validation', () => {
  it('accepts a bound context and rejects unsafe or foreign shapes', () => {
    expect(validateScene3DContext(scene3dContext())).toEqual(scene3dContext())
    expect(validateScene3DContext(undefined)).toBeUndefined()
    expect(validateScene3DContext({})).toBeUndefined()
    expect(validateScene3DContext(scene3dContext({ schema: 'other' as never }))).toBeUndefined()
    expect(validateScene3DContext(scene3dContext({ projectRef: '/etc/passwd' }))).toBeUndefined()
    expect(validateScene3DContext(scene3dContext({ projectRef: 'project with spaces' }))).toBeUndefined()
    expect(validateScene3DContext(scene3dContext({ tenantRef: 'https://example.com' }))).toBeUndefined()
  })
})

describe('SceneGraphGateway sceneRead / saveScene', () => {
  it('fails closed when no 3D context is provided', async () => {
    const { gateway } = await gatewayHarness({ storage: storageHarness().storage })
    expect(await gateway.sceneRead(read)).toEqual({ status: 'unavailable' })
    expect(await gateway.saveScene({ requestId: 'save-1', document: sceneDocument() })).toEqual({ status: 'unavailable' })
    expect(await gateway.listChangeSets(read)).toEqual({ status: 'unavailable' })
  })

  it('reports unavailable when the storage domain is not mounted', async () => {
    const { gateway } = await gatewayHarness({ context: scene3dContext() })
    expect(await gateway.sceneRead(read)).toEqual({ status: 'unavailable' })
    expect(await gateway.saveScene({ requestId: 'save-1', document: sceneDocument() })).toEqual({ status: 'unavailable' })
    expect(await gateway.listChangeSets(read)).toEqual({ status: 'unavailable' })
  })

  it('round-trips a save and read through the transport schemas', async () => {
    const { gateway } = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage })
    const saved = await gateway.saveScene({ requestId: 'save-1', document: sceneDocument() })
    expect(saved).toEqual({ status: 'saved', requestId: 'save-1', version: 1 })
    expect(SceneGraphSaveResultSchema.safeParse(saved).success).toBe(true)
    const result = await gateway.sceneRead(read)
    expect(result).toMatchObject({ status: 'ready', document: { version: 1 } })
    expect(SceneGraphReadResultSchema.safeParse(result).success).toBe(true)
  })

  it('reports a revision conflict without overwriting and keeps the draft local', async () => {
    const { gateway } = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage })
    await gateway.saveScene({ requestId: 'save-1', document: sceneDocument() })
    // A stale writer rebases onto version 0 again and conflicts; the committed row is untouched.
    expect(await gateway.saveScene({ requestId: 'save-2', document: sceneDocument() })).toEqual({ status: 'conflict', version: 1 })
    expect(await gateway.sceneRead(read)).toMatchObject({ status: 'ready', document: { version: 1 } })
    expect(await gateway.reconcileScene({ ...read, requestId: 'save-2' })).toEqual({ status: 'unknown' })
  })

  it('rejects malformed input and foreign scopes', async () => {
    const { gateway } = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage })
    expect(await gateway.sceneRead({ documentId: 'scene:main' })).toEqual({ status: 'invalid' })
    expect(await gateway.sceneRead({ scope: { workspaceRef: 'workspace:two', projectRef: 'project:one' }, documentId: 'scene:main' })).toEqual({ status: 'forbidden' })
    expect(await gateway.saveScene({ requestId: 'save-1' })).toEqual({ status: 'invalid' })
  })
})

describe('SceneGraphGateway importGlb', () => {
  it('imports a valid GLB as a version-0 draft without persisting it', async () => {
    const h = storageHarness()
    const byteSource: Scene3DGlbByteSourceV1 = { readGlb: vi.fn(async () => ({ bytes: minimalGlb(), size: minimalGlb().byteLength, truncated: false })) }
    const { gateway } = await gatewayHarness({ context: scene3dContext(), storage: h.storage, byteSource })
    const result = await gateway.importGlb({ scope, sourceRef: 'file:teapot-glb', documentId: 'scene:main' })
    expect(result.status).toBe('imported')
    if (result.status !== 'imported') throw new Error('unreachable')
    expect(result.document.version).toBe(0)
    expect(result.document.scope).toEqual(scope)
    expect(result.document.id).toBe('scene:main')
    expect(SceneDocumentSchema.safeParse(result.document).success).toBe(true)
    expect(result.warnings.some(warning => warning.includes('no scenes'))).toBe(true)
    // Import is side-effect free: persistence stays an explicit saveScene call.
    expect(await gateway.sceneRead(read)).toEqual({ status: 'missing' })
  })

  it('degrades honestly on unparsable bytes without throwing', async () => {
    const byteSource: Scene3DGlbByteSourceV1 = { readGlb: vi.fn(async () => ({ bytes: new TextEncoder().encode('definitely not a glb'), size: 20, truncated: false })) }
    const { gateway } = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage, byteSource })
    const result = await gateway.importGlb({ scope, sourceRef: 'file:broken' })
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') throw new Error('unreachable')
    expect(result.reason.length).toBeLessThanOrEqual(240)
  })

  it('reports missing, truncated, and unmounted byte sources without fabricating', async () => {
    const { gateway: noSource } = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage })
    expect(await noSource.importGlb({ scope, sourceRef: 'file:none' })).toMatchObject({ status: 'unavailable' })
    const missing: Scene3DGlbByteSourceV1 = { readGlb: vi.fn(async () => undefined) }
    const { gateway: missingGateway } = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage, byteSource: missing })
    expect(await missingGateway.importGlb({ scope, sourceRef: 'file:none' })).toMatchObject({ status: 'missing' })
    const truncated: Scene3DGlbByteSourceV1 = { readGlb: vi.fn(async () => ({ bytes: new Uint8Array(4), size: 128 * 1024 * 1024, truncated: true })) }
    const { gateway: truncatedGateway } = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage, byteSource: truncated })
    expect(await truncatedGateway.importGlb({ scope, sourceRef: 'file:huge' })).toMatchObject({ status: 'too_large' })
  })

  it('fails closed without a bound context and rejects foreign scopes', async () => {
    const byteSource: Scene3DGlbByteSourceV1 = { readGlb: vi.fn(async () => ({ bytes: minimalGlb(), size: 20, truncated: false })) }
    const { gateway } = await gatewayHarness({ storage: storageHarness().storage, byteSource })
    expect(await gateway.importGlb({ scope, sourceRef: 'file:teapot-glb' })).toMatchObject({ status: 'unavailable' })
    const scoped = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage, byteSource })
    expect(await scoped.gateway.importGlb({ scope: { workspaceRef: 'workspace:two', projectRef: 'project:one' }, sourceRef: 'file:teapot-glb' })).toMatchObject({ status: 'forbidden' })
    expect(byteSource.readGlb).not.toHaveBeenCalled()
  })
})

describe('SceneGraphGateway exportGlb', () => {
  it('exports a committed scene as bounded base64 with a validated capability report', async () => {
    const { gateway } = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage })
    await gateway.saveScene({ requestId: 'save-1', document: sceneDocument() })
    const result = await gateway.exportGlb(read)
    expect(result.status).toBe('exported')
    if (result.status !== 'exported') throw new Error('unreachable')
    expect(result.mediaType).toBe('model/gltf-binary')
    const bytes = Buffer.from(result.bytesBase64, 'base64')
    expect(bytes.byteLength).toBe(result.size)
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('glTF')
  })

  it('blocks export with concrete capability gaps instead of silently discarding data', async () => {
    const { gateway } = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage })
    const lossy = sceneDocument({
      extensions: { used: ['KHR_materials_unlit'], required: [] },
      capabilityReport: {
        gltfVersion: '2.0',
        extensions: [{ name: 'KHR_materials_unlit', readable: true, editable: false, exportable: false, opaquePreserved: false }],
        export: { ready: false, gaps: [{ extension: 'KHR_materials_unlit', reason: 'unlit materials are not exportable in v1' }] },
      },
    })
    expect(await gateway.saveScene({ requestId: 'save-1', document: lossy })).toMatchObject({ status: 'saved' })
    const result = await gateway.exportGlb(read)
    expect(result.status).toBe('capability_blocked')
    if (result.status !== 'capability_blocked') throw new Error('unreachable')
    expect(result.gaps).toEqual([{ extension: 'KHR_materials_unlit', reason: 'unlit materials are not exportable in v1' }])
  })

  it('reports missing scenes and unmounted storage honestly', async () => {
    const { gateway } = await gatewayHarness({ context: scene3dContext(), storage: storageHarness().storage })
    expect(await gateway.exportGlb(read)).toEqual({ status: 'missing', reason: 'scene_missing' })
    const { gateway: noStorage } = await gatewayHarness({ context: scene3dContext() })
    expect(await noStorage.exportGlb(read)).toEqual({ status: 'unavailable' })
  })
})

describe('GenerationChangeSetLog invariants', () => {
  async function committedScene(h: ReturnType<typeof logHarness>) {
    expect(await h.store.save({ requestId: 'save-1', document: sceneDocument() })).toEqual({ status: 'saved', requestId: 'save-1', version: 1 })
  }

  it('records a pending change set and rejects duplicate refs and outcome initial states', async () => {
    const h = logHarness()
    await committedScene(h)
    expect(await h.log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })).toMatchObject({ status: 'recorded' })
    expect(await h.log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })).toEqual({ status: 'conflict', reason: 'duplicate_change_set_ref' })
    expect(await h.log.record({ scope, documentId: 'scene:main', changeSet: changeSet({ changeSetRef: 'changeset:two', status: 'accepted' }) })).toMatchObject({ status: 'invalid' })
    expect(await h.log.record({ scope, documentId: 'scene:main', changeSet: changeSet({ changeSetRef: 'changeset:three', sceneRef: 'scene:other' }) })).toMatchObject({ status: 'invalid', reason: 'scene_ref_mismatch' })
    const listed = await h.log.list(read)
    expect(listed.status).toBe('ready')
    if (listed.status !== 'ready') throw new Error('unreachable')
    expect(listed.changeSets.map(entry => entry.changeSetRef)).toEqual(['changeset:one'])
    for (const entry of listed.changeSets) expect(GenerationChangeSetSchema.safeParse(entry).success).toBe(true)
  })

  it('enforces the schema status invariants on every transition', async () => {
    const h = logHarness()
    await committedScene(h)
    await h.log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })
    // preview requires a previewRef
    expect(await h.log.transition({ scope, documentId: 'scene:main', changeSetRef: 'changeset:one', status: 'preview' }))
      .toMatchObject({ status: 'invalid', reason: 'change_set_contract' })
    expect(await h.log.transition({ scope, documentId: 'scene:main', changeSetRef: 'changeset:one', status: 'preview', previewRef: 'preview:one' }))
      .toMatchObject({ status: 'updated', changeSet: { status: 'preview', previewRef: 'preview:one' } })
    // accepted requires an artifactRef
    expect(await h.log.transition({ scope, documentId: 'scene:main', changeSetRef: 'changeset:one', status: 'accepted' }))
      .toMatchObject({ status: 'invalid', reason: 'change_set_contract' })
    // explained statuses require a bounded reason
    expect(await h.log.transition({ scope, documentId: 'scene:main', changeSetRef: 'changeset:one', status: 'failed' }))
      .toMatchObject({ status: 'invalid', reason: 'change_set_contract' })
    expect(await h.log.transition({ scope, documentId: 'scene:main', changeSetRef: 'changeset:one', status: 'failed', reason: 'owner reported failure' }))
      .toMatchObject({ status: 'updated', changeSet: { status: 'failed' } })
    // terminal states never move; nothing auto-retries
    expect(await h.log.transition({ scope, documentId: 'scene:main', changeSetRef: 'changeset:one', status: 'pending' }))
      .toEqual({ status: 'invalid_transition', from: 'failed', to: 'pending' })
  })

  it('accepts a preview change set into a new revision and retains the prior one for rollback', async () => {
    const h = logHarness()
    await committedScene(h)
    await h.log.record({ scope, documentId: 'scene:main', changeSet: changeSet({ status: 'pending' }) })
    await h.log.transition({ scope, documentId: 'scene:main', changeSetRef: 'changeset:one', status: 'preview', previewRef: 'preview:one' })
    const accepted = await h.log.accept({
      scope, documentId: 'scene:main', changeSetRef: 'changeset:one', requestId: 'accept-1',
      document: sceneDocument({ version: 1 }), artifactRef: artifact('artifact:gen-1'),
    })
    expect(accepted).toMatchObject({ status: 'accepted', version: 2 })
    if (accepted.status !== 'accepted') throw new Error('unreachable')
    expect(accepted.changeSet.artifactRef).toMatchObject({ ref: 'artifact:gen-1' })
    expect(accepted.changeSet.rollbackRef).toBe(sceneRevisionRef('scene:main', 1))
    expect(await h.store.read(read)).toMatchObject({ status: 'ready', document: { version: 2 } })
    expect(await h.store.readVersion(scope, 'scene:main', 1)).toMatchObject({ version: 1 })
  })

  it('rolls back an accepted change set by committing the retained revision as a new version', async () => {
    const h = logHarness()
    await committedScene(h)
    await h.log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })
    const edited = sceneDocument({ version: 1 })
    edited.nodes = [{ ...edited.nodes[0]!, label: 'Generated root' }]
    await h.log.accept({ scope, documentId: 'scene:main', changeSetRef: 'changeset:one', requestId: 'accept-1', document: edited, artifactRef: artifact('artifact:gen-1') })
    const rolledBack = await h.log.rollback({ scope, documentId: 'scene:main', changeSetRef: 'changeset:one', requestId: 'rollback-1' })
    expect(rolledBack).toMatchObject({ status: 'rolled_back', version: 3 })
    if (rolledBack.status !== 'rolled_back') throw new Error('unreachable')
    expect(rolledBack.changeSet.rollbackRef).toBe(sceneRevisionRef('scene:main', 3))
    // History is append-only: the restored content lands as a new revision, prior revisions stay readable.
    expect(await h.store.read(read)).toMatchObject({ status: 'ready', document: { version: 3, nodes: [{ label: 'Root' }] } })
    expect(await h.store.readVersion(scope, 'scene:main', 2)).toMatchObject({ version: 2, nodes: [{ label: 'Generated root' }] })
    // rolled_back is terminal
    expect(await h.log.rollback({ scope, documentId: 'scene:main', changeSetRef: 'changeset:one', requestId: 'rollback-2' }))
      .toEqual({ status: 'invalid_transition', from: 'rolled_back', to: 'rolled_back' })
  })

  it('freezes on a revision conflict without overwriting or rewriting the change set', async () => {
    const h = logHarness()
    await committedScene(h)
    await h.log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })
    // Another writer moves the scene forward after the change set's base.
    await h.store.save({ requestId: 'save-2', document: sceneDocument({ version: 1 }) })
    const accepted = await h.log.accept({
      scope, documentId: 'scene:main', changeSetRef: 'changeset:one', requestId: 'accept-1',
      document: sceneDocument({ version: 1 }), artifactRef: artifact('artifact:gen-1'),
    })
    expect(accepted).toEqual({ status: 'conflict', version: 2 })
    const listed = await h.log.list(read)
    expect(listed).toMatchObject({ status: 'ready', changeSets: [{ status: 'pending' }] })
    expect(await h.store.read(read)).toMatchObject({ status: 'ready', document: { version: 2 } })
  })
})

describe('SceneGraphGateway listChangeSets', () => {
  it('lists recorded change sets through the Remote seam', async () => {
    const h = storageHarness()
    const { gateway } = await gatewayHarness({ context: scene3dContext(), storage: h.storage })
    await gateway.saveScene({ requestId: 'save-1', document: sceneDocument() })
    // Record through a log bound to the same storage seam the gateway uses.
    const store = new SceneGraphStore(h.storage, () => ({ tenantRef: 'tenant:one', workspaceRef: 'workspace:one', projectRef: 'project:one' }))
    const log = new GenerationChangeSetLog(store)
    await log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })
    const listed = await gateway.listChangeSets(read)
    expect(listed).toMatchObject({ status: 'ready', changeSets: [{ changeSetRef: 'changeset:one', status: 'pending' }] })
    expect(await gateway.listChangeSets({ scope: { workspaceRef: 'workspace:two', projectRef: 'project:one' }, documentId: 'scene:main' })).toEqual({ status: 'forbidden' })
    expect(await gateway.listChangeSets({ documentId: 'scene:main' })).toEqual({ status: 'invalid' })
  })
})

describe('SceneGraphGateway change-set controls (preview/accept/reject/rollback)', () => {
  async function committedGateway() {
    const h = storageHarness()
    const { gateway } = await gatewayHarness({ context: scene3dContext(), storage: h.storage })
    expect(await gateway.saveScene({ requestId: 'save-1', document: sceneDocument() })).toMatchObject({ status: 'saved', version: 1 })
    const store = new SceneGraphStore(h.storage, () => ({ tenantRef: 'tenant:one', workspaceRef: 'workspace:one', projectRef: 'project:one' }))
    const log = new GenerationChangeSetLog(store)
    return { gateway, log, h }
  }

  it('previews a change set with its comparison baseline and fails closed on bad input', async () => {
    const { gateway, log } = await committedGateway()
    await log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })
    const preview = await gateway.previewChangeSet({ ...read, changeSetRef: 'changeset:one' })
    expect(preview).toMatchObject({
      status: 'ready',
      currentVersion: 1,
      baseRevisionRetained: true,
      changeSet: { changeSetRef: 'changeset:one', patchDigest: 'sha256:0123456789abcdef' },
    })
    if (preview.status !== 'ready') throw new Error('unreachable')
    expect(GenerationChangeSetSchema.safeParse(preview.changeSet).success).toBe(true)
    expect(await gateway.previewChangeSet({ ...read, changeSetRef: 'changeset:ghost' })).toEqual({ status: 'missing' })
    expect(await gateway.previewChangeSet({ documentId: 'scene:main' })).toEqual({ status: 'invalid' })
    expect(await gateway.previewChangeSet({ ...read, scope: { workspaceRef: 'workspace:two', projectRef: 'project:one' }, changeSetRef: 'changeset:one' }))
      .toEqual({ status: 'forbidden' })
  })

  it('accepts through the Remote seam, committing a new revision with a rollback pointer', async () => {
    const { gateway, log } = await committedGateway()
    await log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })
    const accepted = await gateway.acceptChangeSet({
      ...read, changeSetRef: 'changeset:one', requestId: 'accept-1',
      document: sceneDocument({ version: 1 }), artifactRef: artifact('artifact:gen-1'),
    })
    expect(accepted).toMatchObject({ status: 'accepted', version: 2 })
    if (accepted.status !== 'accepted') throw new Error('unreachable')
    expect(accepted.changeSet.rollbackRef).toBe(sceneRevisionRef('scene:main', 1))
    expect(await gateway.sceneRead(read)).toMatchObject({ status: 'ready', document: { version: 2 } })
    // A second accept of the terminal change set is an invalid transition, not a retry.
    const again = await gateway.acceptChangeSet({
      ...read, changeSetRef: 'changeset:one', requestId: 'accept-2',
      document: sceneDocument({ version: 2 }), artifactRef: artifact('artifact:gen-1'),
    })
    expect(again).toMatchObject({ status: 'invalid_transition', from: 'accepted', to: 'accepted' })
  })

  it('freezes accept on a revision conflict without overwriting or rewriting the change set', async () => {
    const { gateway, log } = await committedGateway()
    await log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })
    await gateway.saveScene({ requestId: 'save-2', document: sceneDocument({ version: 1 }) })
    const accepted = await gateway.acceptChangeSet({
      ...read, changeSetRef: 'changeset:one', requestId: 'accept-1',
      document: sceneDocument({ version: 1 }), artifactRef: artifact('artifact:gen-1'),
    })
    expect(accepted).toEqual({ status: 'conflict', version: 2 })
    expect(await gateway.listChangeSets(read)).toMatchObject({ status: 'ready', changeSets: [{ status: 'pending' }] })
    expect(await gateway.sceneRead(read)).toMatchObject({ status: 'ready', document: { version: 2 } })
  })

  it('rejects with a bounded reason and keeps terminal states immovable', async () => {
    const { gateway, log } = await committedGateway()
    await log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })
    const rejected = await gateway.rejectChangeSet({ ...read, changeSetRef: 'changeset:one', reason: '  not the direction we want\n\n' })
    expect(rejected).toMatchObject({ status: 'updated', changeSet: { status: 'rejected', reason: 'not the direction we want' } })
    expect(await gateway.rejectChangeSet({ ...read, changeSetRef: 'changeset:one' }))
      .toEqual({ status: 'invalid_transition', from: 'rejected', to: 'rejected' })
    expect(await gateway.rejectChangeSet({ ...read, changeSetRef: 'changeset:ghost' })).toEqual({ status: 'missing' })
  })

  it('rolls back an accepted change set through the Remote seam as a new revision', async () => {
    const { gateway, log } = await committedGateway()
    await log.record({ scope, documentId: 'scene:main', changeSet: changeSet() })
    const edited = sceneDocument({ version: 1 })
    edited.nodes = [{ ...edited.nodes[0]!, label: 'Generated root' }]
    await gateway.acceptChangeSet({
      ...read, changeSetRef: 'changeset:one', requestId: 'accept-1', document: edited, artifactRef: artifact('artifact:gen-1'),
    })
    const rolledBack = await gateway.rollbackChangeSet({ ...read, changeSetRef: 'changeset:one', requestId: 'rollback-1' })
    expect(rolledBack).toMatchObject({ status: 'rolled_back', version: 3 })
    if (rolledBack.status !== 'rolled_back') throw new Error('unreachable')
    expect(rolledBack.changeSet.rollbackRef).toBe(sceneRevisionRef('scene:main', 3))
    expect(await gateway.sceneRead(read)).toMatchObject({ status: 'ready', document: { version: 3, nodes: [{ label: 'Root' }] } })
    // Terminal: a second rollback is refused, not retried.
    expect(await gateway.rollbackChangeSet({ ...read, changeSetRef: 'changeset:one', requestId: 'rollback-2' }))
      .toEqual({ status: 'invalid_transition', from: 'rolled_back', to: 'rolled_back' })
    expect(await gateway.rollbackChangeSet({ ...read, changeSetRef: 'changeset:one' })).toEqual({ status: 'invalid' })
  })

  it('fails closed without a bound context for every change-set control', async () => {
    const { gateway } = await gatewayHarness({ storage: storageHarness().storage })
    expect(await gateway.previewChangeSet({ ...read, changeSetRef: 'changeset:one' })).toEqual({ status: 'unavailable' })
    expect(await gateway.acceptChangeSet({ ...read, changeSetRef: 'changeset:one', requestId: 'accept-1', document: sceneDocument(), artifactRef: artifact('artifact:gen-1') }))
      .toEqual({ status: 'unavailable' })
    expect(await gateway.rejectChangeSet({ ...read, changeSetRef: 'changeset:one' })).toEqual({ status: 'unavailable' })
    expect(await gateway.rollbackChangeSet({ ...read, changeSetRef: 'changeset:one', requestId: 'rollback-1' })).toEqual({ status: 'unavailable' })
  })
})

/**
 * 3D Director Shot integration scenarios (dsh-3d-director-gltf-workbench-v1, task 4.2).
 *
 * Three reproducible Shot scenarios that chain the REAL client
 * Scene3DController (packages/client/ui-3d-director) against the REAL host
 * SceneGraphGateway (this package) over a real cordis Context with an
 * in-memory `storageDomain` seam and a real GLB byte source. Nothing is a mock
 * of the controller/gateway contract; the only simulated parts are the
 * storage backend (in-memory Map with the real SceneGraphStore journal/commit
 * protocol) and deliberate commit-loss injection for the reconcile arc.
 *
 * Run directly (`vitest run tests/shot-scenarios.integration.spec.ts`) or via
 * the evidence runner `scripts/run-3d-director-integration.mjs`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SCENE_3D_SCHEMA, type SceneDocumentV1, type ShotV1, type CanvasBindingV1 } from '@yeisme/dsh-pane-protocol'
import {
  SCENE_3D_CONTEXT_SCHEMA,
  SCENE_3D_DIRECTOR_SERVICE_KEY,
  SCENE_3D_EXPECTED_CONTEXT,
  SCENE_3D_GLB_BYTE_SOURCE,
  SceneGraphGateway,
  type Scene3DContextV1,
  type Scene3DGlbByteSourceV1,
} from '../src/gateway.ts'
import type { Scene3DChangeSetsTable, Scene3DDocumentsTable, Scene3DStorage } from '../src/scene-store.ts'
import { Scene3DController } from '../../../client/ui-3d-director/src/scene3d-controller.js'
import {
  buildScene3DSelectionConvergence,
  buildShotPreviewDocument,
  resolveShotCameraNodeId,
  sampleShotAtFrame,
} from '../../../client/ui-3d-director/src/previz.js'

const contexts: Context[] = []
const controllers: Scene3DController[] = []
afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.dispose()
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

const SCOPE = { workspaceRef: 'workspace:one', projectRef: 'project:one' } as const
const IDENTITY = { translate: [0, 0, 0] as [number, number, number], rotate: [0, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number] }

function scene3dContext(overrides: Partial<Scene3DContextV1> = {}): Scene3DContextV1 {
  return { schema: SCENE_3D_CONTEXT_SCHEMA, tenantRef: 'tenant:one', ...SCOPE, ...overrides }
}

/** Scene graph with a Shot-addressable hero, its camera node and a hidden light. */
function sceneDocument(overrides: Partial<SceneDocumentV1> = {}): SceneDocumentV1 {
  return {
    schema: SCENE_3D_SCHEMA,
    scope: { ...SCOPE },
    id: 'scene:main',
    version: 0,
    scenes: [{ id: 'main', label: 'Main scene', rootNodeIds: ['root'], default: true }],
    nodes: [
      { id: 'root', label: 'Root', kind: 'group', transform: IDENTITY, visible: true },
      { id: 'hero', label: 'Hero', kind: 'mesh', parentId: 'root', transform: { ...IDENTITY, translate: [1, 0, 0] }, visible: true, resourceRef: 'asset:hero' },
      { id: 'key-light', label: 'Key light', kind: 'light', parentId: 'root', transform: IDENTITY, visible: false },
      { id: 'camera-main', label: 'Main camera', kind: 'camera', parentId: 'root', transform: { ...IDENTITY, translate: [0, 2, 6] }, visible: true, resourceRef: 'camera:main' },
    ],
    resources: [],
    extensions: { used: [], required: [] },
    capabilityReport: { gltfVersion: '2.0', extensions: [], export: { ready: true, gaps: [] } },
    ...overrides,
  }
}

function shotOpening(): ShotV1 {
  return {
    shotRef: 'shot:opening',
    sceneRef: 'scene:main',
    version: 'v1',
    cameraRef: 'camera:main',
    frameRange: { start: 0, end: 48, fps: 24 },
    keyframes: [
      { id: 'kf-1', frame: 0, objectRef: 'asset:hero', property: 'translate', value: [0, 0, 0] },
      { id: 'kf-2', frame: 24, objectRef: 'asset:hero', property: 'translate', value: [3, 1, 0] },
      { id: 'kf-3', frame: 36, objectRef: 'asset:hero', property: 'visibility', value: false },
    ],
    objectRefs: ['asset:hero'],
    visibility: [{ objectRef: 'asset:hero', visible: true }],
    generationRefs: [],
    deliveryProjection: { status: 'pending' },
  }
}

function binding(): CanvasBindingV1 {
  return { nodeRef: 'canvas:node-1', shotRef: 'shot:opening', sceneObjectRef: 'asset:hero', edgeKind: 'reference', layout: { position: { x: 0, y: 0 } } }
}

/** Minimal valid GLB container: header + one JSON chunk. */
function minimalGlb(json: Record<string, unknown> = { asset: { version: '2.0' } }): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  const padded = jsonBytes.length + ((4 - (jsonBytes.length % 4)) % 4)
  const buffer = new ArrayBuffer(12 + 8 + padded)
  const view = new DataView(buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, buffer.byteLength, true)
  view.setUint32(12, padded, true)
  view.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(buffer, 20).set(jsonBytes)
  new Uint8Array(buffer, 20 + jsonBytes.length).fill(0x20)
  return new Uint8Array(buffer)
}

interface StorageHarness {
  readonly storage: Scene3DStorage
  /** Commit writes for these request ids fail once (journal stays durable). */
  readonly failCommitFor: Set<string>
}

function storageHarness(): StorageHarness {
  const docs = new Map<string, unknown>()
  const sets = new Map<string, unknown>()
  const failCommitFor = new Set<string>()
  const documents: Scene3DDocumentsTable = {
    get: key => docs.get(key),
    put: vi.fn(async (key, value) => {
      // A commit row carries no inflight journal; failing it simulates commit
      // loss AFTER the write-ahead journal landed (the reconcile precondition).
      const commit = value.inflight === undefined
        ? value.receipts.find(receipt => failCommitFor.has(receipt.requestId))
        : undefined
      if (commit !== undefined) {
        failCommitFor.delete(commit.requestId)
        throw new Error('simulated commit loss after journal write')
      }
      docs.set(key, structuredClone(value))
    }),
  }
  const changeSets: Scene3DChangeSetsTable = { get: key => sets.get(key), put: vi.fn(async (key, value) => { sets.set(key, structuredClone(value)) }) }
  const storage: Scene3DStorage = { open: vi.fn(async () => ({ table: name => name === 'documents' ? documents : changeSets, close: async () => {} })) }
  return { storage, failCommitFor }
}

async function gatewayHarness(input: { storage: Scene3DStorage; byteSource?: Scene3DGlbByteSourceV1 }) {
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide(SCENE_3D_EXPECTED_CONTEXT, scene3dContext())
  ctx.provide('storageDomain', input.storage)
  if (input.byteSource !== undefined) ctx.provide(SCENE_3D_GLB_BYTE_SOURCE, input.byteSource)
  await ctx.plugin(SceneGraphGateway)
  return ctx.get(SCENE_3D_DIRECTOR_SERVICE_KEY) as SceneGraphGateway
}

function makeController(gateway: SceneGraphGateway, documentId: string, options: { newId?: () => string; onExportBytes?: (bytes: string) => void } = {}) {
  const controller = new Scene3DController(gateway, { scope: { ...SCOPE }, documentId }, {
    shots: [shotOpening()],
    bindings: [binding()],
    ...(options.newId === undefined ? {} : { newId: options.newId }),
    ...(options.onExportBytes === undefined ? {} : { onExportBytes: options.onExportBytes }),
  })
  controllers.push(controller)
  return controller
}

describe('Shot scenario A: shot-anchored open → timeline scrub → step-sampled preview', () => {
  it('persists previsualization keyframes, keeps legacy reads strict and recovers a journal after remount', async () => {
    const storage = storageHarness()
    const gateway = await gatewayHarness(storage)
    await gateway.saveScene({ requestId: 'seed', document: sceneDocument() })
    const first = makeController(gateway, 'scene:main', { newId: () => 'shots-one' })
    await first.load()
    expect(first.canPersistShots).toBe(true)
    const keyframeId = first.getSnapshot().shots[0]!.keyframes[0]!.id
    first.editShotKeyframe('shot:opening', { type: 'move-keyframe', keyframeId, frame: 12 })
    await first.save()
    expect(first.getSnapshot().saveStatus).toBe('clean')
    const legacy = await gateway.sceneRead({ scope: SCOPE, documentId: 'scene:main' })
    expect(legacy).not.toHaveProperty('shots')
    if (legacy.status === 'ready') expect(legacy.document).not.toHaveProperty('shots')
    first.dispose()
    const restoredGateway = await gatewayHarness(storage)
    const second = makeController(restoredGateway, 'scene:main', { newId: () => 'shots-lost' })
    await second.load()
    expect(second.getSnapshot().shots[0]!.keyframes[0]!.frame).toBe(12)
    expect(second.setShots([shotOpening()])).toBe(false)
    expect(second.getSnapshot().shots[0]!.keyframes[0]!.frame).toBe(12)
    storage.failCommitFor.add('shots-lost')
    second.editShotKeyframe('shot:opening', { type: 'move-keyframe', keyframeId, frame: 18 })
    await second.save()
    expect(second.getSnapshot().saveStatus).toBe('unknown')
    second.dispose()
    const third = makeController(await gatewayHarness(storage), 'scene:main', { newId: () => 'shots-recovered' })
    await third.load()
    expect(third.getSnapshot().saveStatus).toBe('dirty')
    expect(third.getSnapshot().shots[0]!.keyframes[0]!.frame).toBe(18)
    await third.save()
    const fourth = makeController(await gatewayHarness(storage), 'scene:main')
    await fourth.load()
    expect(fourth.getSnapshot().shots[0]!.keyframes[0]!.frame).toBe(18)
    expect(fourth.getSnapshot().saveStatus).toBe('clean')
    const foreign = await restoredGateway.saveSceneWorkbench({ requestId: 'foreign', document: sceneDocument({ scope: { ...SCOPE, projectRef: 'project:other' } }), shots: [shotOpening()] })
    expect(foreign.status).toBe('forbidden')
    const duplicate = await restoredGateway.saveSceneWorkbench({ requestId: 'duplicate', document: sceneDocument(), shots: [shotOpening(), shotOpening()] })
    expect(duplicate.status).toBe('invalid')
  })
  it('loads through the gateway, converges selection, and step-samples without touching owner truth', async () => {
    const gateway = await gatewayHarness({ storage: storageHarness().storage })
    expect(await gateway.saveScene({ requestId: 'seed-a', document: sceneDocument() }))
      .toEqual({ status: 'saved', requestId: 'seed-a', version: 1 })

    const controller = makeController(gateway, 'scene:main')
    await controller.load()
    expect(controller.getSnapshot().status).toBe('ready')
    const committed = controller.getSnapshot().document
    expect(committed?.version).toBe(1)

    // Shot anchor opens the viewport preview: select the Shot and converge to its camera node.
    const shot = shotOpening()
    controller.selectShot(shot.shotRef)
    expect(controller.getSnapshot().selectedShotRef).toBe('shot:opening')
    const cameraNodeId = resolveShotCameraNodeId(committed!, shot)
    expect(cameraNodeId).toBe('camera-main')
    controller.selectNode(cameraNodeId)

    // Canvas/viewport convergence: the binding maps hero ⇄ shot:opening both ways.
    const convergence = buildScene3DSelectionConvergence(committed!, [binding()])
    expect(convergence.nodeToShots.get('hero')).toEqual(['shot:opening'])
    expect(convergence.shotToNodes.get('shot:opening')).toEqual(['hero'])

    // Timeline scrub: step sampling — the latest keyframe at or before the playhead wins.
    const heroAt = (frame: number) => {
      const preview = buildShotPreviewDocument(committed!, shot, frame)
      return preview.nodes.find(node => node.id === 'hero')
    }
    expect(heroAt(0)?.transform.translate).toEqual([0, 0, 0])
    expect(heroAt(23)?.transform.translate).toEqual([0, 0, 0])
    expect(heroAt(24)?.transform.translate).toEqual([3, 1, 0])
    expect(heroAt(24)?.visible).toBe(true)
    expect(heroAt(35)?.visible).toBe(true)
    expect(heroAt(36)?.visible).toBe(false)
    expect(heroAt(48)?.visible).toBe(false)
    // Playhead clamps into the frame range.
    expect(sampleShotAtFrame(shot, 999).get('asset:hero')).toMatchObject({ translate: [3, 1, 0], visible: false })

    // Display-only: no draft mutation, no save, owner truth untouched.
    expect(controller.getSnapshot().dirty).toBe(false)
    expect(buildShotPreviewDocument(committed!, undefined, 24)).toBe(committed)
    const reread = await gateway.sceneRead({ scope: { ...SCOPE }, documentId: 'scene:main' })
    expect(reread).toMatchObject({ status: 'ready', document: { version: 1 } })
  })
})

describe('Shot scenario B: edit draft → save → conflict freeze → reconcile recovery', () => {
  it('walks save, commit-loss reconcile and a revision conflict with draft preservation', async () => {
    const harness = storageHarness()
    const gateway = await gatewayHarness({ storage: harness.storage })
    expect(await gateway.saveScene({ requestId: 'seed-b', document: sceneDocument() }))
      .toEqual({ status: 'saved', requestId: 'seed-b', version: 1 })

    let idCounter = 0
    const controller = makeController(gateway, 'scene:main', { newId: () => `save-b-${++idCounter}` })
    await controller.load()
    expect(controller.getSnapshot().status).toBe('ready')

    // Draft edits (transform + visibility + Shot keyframe) then a confirmed save.
    expect(controller.editNodeTransform('hero', { translate: [2, 0, 0] })).toBe(true)
    expect(controller.setNodeVisibility('key-light', true)).toBe(true)
    expect(controller.editShotKeyframe('shot:opening', { type: 'move-keyframe', keyframeId: 'kf-2', frame: 12 })).toBe(true)
    expect(controller.getSnapshot().dirty).toBe(true)
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('clean')
    expect(controller.getSnapshot().document?.version).toBe(2)

    // Commit loss: the journal lands, the commit write fails → unknown, settled
    // only through the owner reconcile channel (no automatic retry).
    harness.failCommitFor.add('save-b-2')
    expect(controller.editNodeTransform('hero', { translate: [5, 0, 0] })).toBe(true)
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('unknown')
    await controller.reconcile()
    expect(controller.getSnapshot().saveStatus).toBe('dirty') // not_applied: draft kept, journal cleared
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('clean')
    expect(controller.getSnapshot().document?.version).toBe(3)

    // Conflict injection: a second writer commits against the same base revision.
    const ownerWrite = { ...sceneDocument({ version: 3 }), nodes: sceneDocument().nodes.map(node => node.id === 'hero' ? { ...node, visible: false } : node) }
    expect(await gateway.saveScene({ requestId: 'owner-write', document: ownerWrite }))
      .toEqual({ status: 'saved', requestId: 'owner-write', version: 4 })

    // Our next save is based on revision 3 → conflict: frozen, draft preserved.
    expect(controller.editNodeTransform('hero', { translate: [7, 0, 0] })).toBe(true)
    await controller.save()
    const frozen = controller.getSnapshot()
    expect(frozen.saveStatus).toBe('conflict')
    expect(frozen.frozen).toBe(true)
    expect(frozen.conflict).toMatchObject({ localBaseVersion: 3, remoteVersion: 4 })
    // Read-only freeze: mutations and export are refused without side effects.
    expect(controller.editNodeTransform('hero', { translate: [9, 0, 0] })).toBe(false)
    expect(controller.setNodeVisibility('hero', false)).toBe(false)
    await controller.exportScene()
    expect(controller.getSnapshot().export.status).toBe('idle')
    // The owner truth is the conflicting revision; the frozen draft never overwrote it.
    const ownerTruth = await gateway.sceneRead({ scope: { ...SCOPE }, documentId: 'scene:main' })
    expect(ownerTruth).toMatchObject({ status: 'ready', document: { version: 4 } })
    expect((ownerTruth as { document: SceneDocumentV1 }).document.nodes.find(node => node.id === 'hero')?.visible).toBe(false)

    // Reconcile by rebasing the local draft onto the confirmed revision, then save.
    controller.resolveConflict('reapply')
    const rebased = controller.getSnapshot()
    expect(rebased.frozen).toBe(false)
    expect(rebased.document?.version).toBe(4)
    expect(rebased.document?.nodes.find(node => node.id === 'hero')?.transform.translate).toEqual([7, 0, 0])
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('clean')
    expect(controller.getSnapshot().document?.version).toBe(5)
  })
})

describe('Shot scenario C: GLB import → capability report → export (incl. capability_blocked)', () => {
  it('imports real GLB bytes through the host byte source and exports with capability gating', async () => {
    const glbs = new Map<string, Uint8Array>([
      ['file:fixture-clean', minimalGlb()],
      ['file:fixture-lights', minimalGlb({ asset: { version: '2.0' }, extensionsUsed: ['KHR_lights_punctual'] })],
    ])
    const byteSource: Scene3DGlbByteSourceV1 = { readGlb: async ref => {
      const bytes = glbs.get(ref)
      return bytes === undefined ? undefined : { bytes, size: bytes.byteLength, truncated: false }
    } }
    const gateway = await gatewayHarness({ storage: storageHarness().storage, byteSource })

    // Import: real GLB bytes → real parser → version-0 draft with a fresh capability report.
    const controller = makeController(gateway, 'scene:import')
    const outcome = await controller.importGlb('file:fixture-clean', 'scene:import')
    expect(outcome.status).toBe('imported')
    // The synthetic minimal GLB legitimately warns; the list is bounded strings.
    expect((outcome as { warnings: readonly string[] }).warnings.every(warning => typeof warning === 'string' && warning.length <= 240)).toBe(true)
    const imported = controller.getSnapshot()
    expect(imported.status).toBe('ready')
    expect(imported.dirty).toBe(true)
    expect(imported.document?.version).toBe(0)
    expect(imported.document?.capabilityReport.export.ready).toBe(true)

    // Save the imported draft through the real revision protocol.
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('clean')
    expect(controller.getSnapshot().document?.version).toBe(1)

    // Export: real GLB encoder; bytes leave only through the onExportBytes handoff.
    const exported: string[] = []
    const exporter = makeController(gateway, 'scene:import', { onExportBytes: bytes => { exported.push(bytes) } })
    await exporter.load()
    await exporter.exportScene()
    expect(exporter.getSnapshot().export.status).toBe('exported')
    expect(exported).toHaveLength(1)
    const bytes = Buffer.from(exported[0]!, 'base64')
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('glTF')
    expect((exporter.getSnapshot().export as { size: number }).size).toBe(bytes.byteLength)

    // capability_blocked: a lossy scene-structure extension must block with a
    // concrete gap on BOTH the local precheck and the host wire path.
    const exportCalls: unknown[] = []
    const blockedGateway = new Proxy(gateway, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver)
        if (prop === 'exportGlb') return async (input: unknown) => { exportCalls.push(input); return value.call(target, input) }
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const blocked = makeController(blockedGateway as SceneGraphGateway, 'scene:blocked')
    const blockedOutcome = await blocked.importGlb('file:fixture-lights', 'scene:blocked')
    expect(blockedOutcome.status).toBe('imported')
    expect(blocked.getSnapshot().document?.capabilityReport.export.ready).toBe(false)
    await blocked.save()
    expect(blocked.getSnapshot().document?.version).toBe(1)

    await blocked.exportScene()
    const blockedExport = blocked.getSnapshot().export
    expect(blockedExport.status).toBe('blocked')
    expect((blockedExport as { gaps: readonly { extension?: string }[] }).gaps.map(gap => gap.extension)).toEqual(['KHR_lights_punctual'])
    // Local precheck: the blocked export never reached the remote.
    expect(exportCalls).toEqual([])

    // Wire path: the host re-derives the report from the committed document and
    // answers capability_blocked with the same gap (nothing silently discarded).
    const wire = await gateway.exportGlb({ scope: { ...SCOPE }, documentId: 'scene:blocked' })
    expect(wire.status).toBe('capability_blocked')
    expect((wire as { gaps: readonly { extension?: string }[] }).gaps.map(gap => gap.extension)).toEqual(['KHR_lights_punctual'])
  })
})

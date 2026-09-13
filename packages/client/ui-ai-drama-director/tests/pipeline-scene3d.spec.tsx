// @vitest-environment jsdom
/**
 * Scene3D embed — controller logic layer.
 *
 * Covers the probe-first availability contract (no dead buttons, fail-closed
 * envelope decode), the shot-anchored viewport lifecycle (lazy open, close
 * preservation, symmetric dispose, target-switch recycling), the bidirectional
 * selection convergence with its echo fence (canvas ⇄ 3D, binding reverse
 * lookup, unbound silence), and the binding helper unit contract.
 *
 * Pane render-chain coverage (Inspector section, docked region, fallback
 * interactions) lives in `pipeline-scene3d-pane.spec.tsx`.
 */
import { describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import type { SceneDocumentV1 } from '@yeisme/dsh-pane-protocol'
import type { Scene3DDirectorRemote } from '@yeisme/dsh-client-ui-3d-director'
import {
  createPipelineFixtureOwner,
  createPipelineFixtureScene3DRemote,
  PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT,
  PIPELINE_FIXTURE_SCENE_3D_DOCUMENT_ID,
  PIPELINE_FIXTURE_SHOT_NODE_ID,
  PIPELINE_FIXTURE_SHOT_REF,
} from '../src/client/pipeline/fixture-owner.js'
import {
  PipelineWorkbenchController,
  PIPELINE_SCENE_3D_NO_PROJECTION_REASON,
  type PipelineWorkbenchOwnerFaceV1,
} from '../src/client/pipeline/workbench-controller.js'
import { probePipelineScene3DRemote } from '../src/client/pipeline/workbench-pane.js'
import {
  findScene3DBindingForCanvasNode,
  findScene3DBindingForSceneObject,
} from '../src/client/pipeline/scene-3d.js'
import { SCENE_3D_PROBE_REASONS } from '@yeisme/dsh-client-ui-3d-director'
import {
  canvasSelection,
  installScene3DJSDOMEnvironment,
  openScene3DViewport,
  ownerWithBrokenScene3DProjection,
  ownerWithoutScene3DProjection,
  ownerWithoutScene3DRemote,
  readyPipelineController,
  readyScene3DController,
} from './helpers/scene3d.js'

installScene3DJSDOMEnvironment()

describe('scene3d envelope decode + probe-first availability (controller layer)', () => {
  it('decodes the owner-projected scene3d section and exposes it as available', async () => {
    const controller = await readyPipelineController()
    const state = controller.getSnapshot()
    expect(state.scene3d.available).toBe(true)
    expect(state.scene3d.reason).toBeUndefined()
    expect(state.scene3d.open).toBe(false)
    expect(state.scene3d.documentId).toBe(PIPELINE_FIXTURE_SCENE_3D_DOCUMENT_ID)
    controller.dispose()
  })

  it('disables the entry with the probe reason when the scene3dDirector seam is absent', async () => {
    const controller = await readyPipelineController(ownerWithoutScene3DRemote())
    controller.selectObject(PIPELINE_FIXTURE_SHOT_NODE_ID)
    const state = controller.getSnapshot()
    expect(state.selectedShot?.shotRef).toBe(PIPELINE_FIXTURE_SHOT_REF)
    expect(state.scene3d.available).toBe(false)
    expect(state.scene3d.reason).toBe(SCENE_3D_PROBE_REASONS.needsContract)

    // Defense-in-depth: a programmatic open on the disabled entry opens
    // nothing and surfaces a bounded notice.
    controller.openScene3DViewport()
    const after = controller.getSnapshot()
    expect(after.scene3d.open).toBe(false)
    expect(after.scene3d.controller).toBeUndefined()
    expect(after.notice).toBe(SCENE_3D_PROBE_REASONS.needsContract)
    expect(after.notice).toContain('scene3dDirector')
    controller.dispose()
  })

  it('disables the entry when the owner projects no scene3d binding', async () => {
    const controller = await readyPipelineController(ownerWithoutScene3DProjection())
    const state = controller.getSnapshot()
    expect(state.scene3d.available).toBe(false)
    expect(state.scene3d.reason).toBe(PIPELINE_SCENE_3D_NO_PROJECTION_REASON)

    // A programmatic open on the disabled entry opens nothing.
    controller.openScene3DViewport()
    expect(controller.getSnapshot().scene3d.open).toBe(false)
    controller.dispose()
  })

  it('fails the scene3d section closed without taking the pipeline graph down', async () => {
    const controller = await readyPipelineController(ownerWithBrokenScene3DProjection())
    // Adjunct fail-closed: the graph still renders, only the 3D entry degrades.
    const state = controller.getSnapshot()
    expect(state.phase).toBe('ready')
    expect(state.nodes.length).toBeGreaterThan(0)
    expect(state.scene3d.available).toBe(false)
    expect(state.scene3d.reason).toContain('shot failed the transport schema')
    expect(state.scene3d.reason).toContain('3D viewport stays disabled')
    controller.dispose()
  })
})

describe('scene3d binding lookup helpers', () => {
  it('binding helpers match node id or domain ref in both directions', () => {
    const bindings = [
      { nodeRef: 'node:a', shotRef: 'shot:1', sceneObjectRef: 'scene3d:a', edgeKind: 'reference' as const, layout: { position: { x: 0, y: 0 } } },
    ]
    expect(findScene3DBindingForCanvasNode(bindings, 'node:a', undefined)?.sceneObjectRef).toBe('scene3d:a')
    expect(findScene3DBindingForCanvasNode(bindings, 'canvas-only-id', 'node:a')?.sceneObjectRef).toBe('scene3d:a')
    expect(findScene3DBindingForCanvasNode(bindings, 'node:other', 'ref:other')).toBeUndefined()
    expect(findScene3DBindingForSceneObject(bindings, 'scene3d:a', undefined)?.nodeRef).toBe('node:a')
    expect(findScene3DBindingForSceneObject(bindings, 'scene-node-id', 'scene3d:a')?.nodeRef).toBe('node:a')
    expect(findScene3DBindingForSceneObject(bindings, 'scene3d:other', undefined)).toBeUndefined()
  })
})

describe('shot anchoring + bidirectional selection convergence (controller layer)', () => {
  it('resolves a shot canvas selection to its owner ref and bound scene object; non-shot selections carry no anchor', async () => {
    const controller = await readyPipelineController()
    expect(controller.getSnapshot().selectedShot).toBeUndefined()
    controller.selectObject(PIPELINE_FIXTURE_SHOT_NODE_ID)
    const shot = controller.getSnapshot().selectedShot
    expect(shot).toMatchObject({
      nodeId: PIPELINE_FIXTURE_SHOT_NODE_ID,
      shotRef: PIPELINE_FIXTURE_SHOT_REF,
      sceneObjectRef: PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT,
    })
    // A non-shot selection carries no shot anchor.
    controller.selectObject('node:char-lin')
    expect(controller.getSnapshot().selectedShot).toBeUndefined()

    // Reselecting the shot then opening the viewport anchors shot and bound object.
    controller.selectObject(PIPELINE_FIXTURE_SHOT_NODE_ID)
    const scene = await openScene3DViewport(controller)
    expect(scene.getSnapshot().selectedShotRef).toBe(PIPELINE_FIXTURE_SHOT_REF)
    expect(scene.getSnapshot().selectedNodeId).toBe(PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT)
    controller.dispose()
  })

  it('canvas → 3D: selecting the shot node re-anchors shot and bound scene object', async () => {
    const { controller, scene } = await readyScene3DController()

    controller.selectObject('node:char-lin')
    controller.selectObject(PIPELINE_FIXTURE_SHOT_NODE_ID)
    expect(scene.getSnapshot().selectedShotRef).toBe(PIPELINE_FIXTURE_SHOT_REF)
    expect(scene.getSnapshot().selectedNodeId).toBe(PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT)
    controller.dispose()
  })

  it('canvas → 3D: bound non-shot nodes highlight without re-anchoring the shot; unbound nodes stay silent', async () => {
    const { controller, scene } = await readyScene3DController()
    expect(scene.getSnapshot().selectedNodeId).toBe(PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT)

    // Bound non-shot node: scene object highlight moves, the shot anchor stays.
    controller.selectObject('node:char-lin')
    expect(scene.getSnapshot().selectedNodeId).toBe('scene3d:lin')
    expect(scene.getSnapshot().selectedShotRef).toBe(PIPELINE_FIXTURE_SHOT_REF)
    expect(controller.getSnapshot().selectedShot).toBeUndefined()

    controller.selectObject('node:scene-rooftop')
    expect(scene.getSnapshot().selectedNodeId).toBe('scene3d:rooftop')

    // Unbound node: the scene side is untouched (no highlight, no clearing).
    controller.selectObject('node:asset-poster')
    expect(scene.getSnapshot().selectedNodeId).toBe('scene3d:rooftop')
    controller.dispose()
  })

  it('3D → canvas: picks route through canvasNodeRef exactly once without ping-pong; the shot anchor clears and converges back', async () => {
    const { controller, scene } = await readyScene3DController()

    // canvasNodeRef path: the camera carries a back-pointer to the shot node.
    controller.selectScene3DNode(PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT)
    expect(canvasSelection(controller)).toEqual([PIPELINE_FIXTURE_SHOT_NODE_ID])
    expect(controller.getSnapshot().selectedShot?.shotRef).toBe(PIPELINE_FIXTURE_SHOT_REF)
    expect(scene.getSnapshot().selectedNodeId).toBe(PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT)

    // Picking the character moves the canvas selection exactly once; the
    // character is not a shot, so the shot anchor clears while the scene pick stays.
    controller.selectScene3DNode('scene3d:lin')
    expect(canvasSelection(controller)).toEqual(['node:char-lin'])
    expect(controller.getSnapshot().selectedShot).toBeUndefined()
    expect(scene.getSnapshot().selectedNodeId).toBe('scene3d:lin')

    // A pick of another bound object moves the canvas selection exactly once.
    controller.selectScene3DNode('scene3d:rooftop')
    expect(canvasSelection(controller)).toEqual(['node:scene-rooftop'])
    // Echo guard: the canvas-driven sync must not rewrite the user's pick.
    expect(scene.getSnapshot().selectedNodeId).toBe('scene3d:rooftop')

    // Picking the shot camera converges back onto the shot node.
    controller.selectScene3DNode(PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT)
    expect(canvasSelection(controller)).toEqual([PIPELINE_FIXTURE_SHOT_NODE_ID])
    expect(controller.getSnapshot().selectedShot?.shotRef).toBe(PIPELINE_FIXTURE_SHOT_REF)
    controller.dispose()
  })

  it('scene-only picks without a canvasNodeRef never touch canvas selection', async () => {
    const { controller, scene } = await readyScene3DController()
    scene.selectNode('scene3d:unbound')
    expect(canvasSelection(controller)).toEqual([PIPELINE_FIXTURE_SHOT_NODE_ID])
    controller.dispose()
  })

  it('falls back to the CanvasBinding reverse lookup when the scene node has no canvasNodeRef; unbound picks stay silent', async () => {
    const baseRemote = createPipelineFixtureScene3DRemote()
    const remote: Scene3DDirectorRemote = {
      ...baseRemote,
      sceneRead: async input => {
        const result = await baseRemote.sceneRead(input) as { readonly status: 'ready'; readonly document: SceneDocumentV1 }
        const nodes = result.document.nodes.map(node => {
          if (node.id !== 'scene3d:lin') return node
          const { canvasNodeRef: _dropped, ...rest } = node
          return rest
        })
        return {
          status: 'ready',
          document: {
            ...result.document,
            nodes: [
              ...nodes,
              {
                id: 'scene3d:extra-prop',
                label: 'Extra prop',
                kind: 'prop' as const,
                transform: { translate: [0, 0, 0] as [number, number, number], rotate: [0, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number] },
                visible: true,
              },
            ],
          },
        }
      },
    }
    const controller = new PipelineWorkbenchController({ owner: createPipelineFixtureOwner(), scene3dRemote: remote })
    await controller.load()
    await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
    controller.openScene3DViewport()
    const scene = controller.getSnapshot().scene3d.controller!
    await waitFor(() => expect(scene.getSnapshot().status).toBe('ready'))

    // Binding reverse lookup: no canvasNodeRef, but the binding maps the object.
    controller.selectScene3DNode('scene3d:lin')
    expect(canvasSelection(controller)).toEqual(['node:char-lin'])

    // Unbound pick: no canvasNodeRef and no binding — canvas selection untouched.
    controller.selectScene3DNode('scene3d:extra-prop')
    expect(canvasSelection(controller)).toEqual(['node:char-lin'])
    expect(scene.getSnapshot().selectedNodeId).toBe('scene3d:extra-prop')
    controller.dispose()
  })
})

describe('scene3d viewport lifecycle (controller layer)', () => {
  it('opens lazily, keeps the controller and its local draft across close, and reopens without replay', async () => {
    const { controller, scene } = await readyScene3DController()
    expect(scene.getSnapshot().selectedShotRef).toBe(PIPELINE_FIXTURE_SHOT_REF)
    expect(scene.getSnapshot().selectedNodeId).toBe(PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT)

    controller.closeScene3DViewport()
    expect(controller.getSnapshot().scene3d.open).toBe(false)
    expect(controller.getSnapshot().scene3d.controller).toBe(scene)

    // Reopen keeps the same controller — local drafts survive a hidden region.
    controller.openScene3DViewport()
    expect(controller.getSnapshot().scene3d.open).toBe(true)
    expect(controller.getSnapshot().scene3d.controller).toBe(scene)
    controller.dispose()
  })

  it('dispose tears down the scene controller and its subscription symmetrically and idempotently', async () => {
    const { controller, scene } = await readyScene3DController()
    const listener = vi.fn()
    scene.subscribe(listener)

    controller.dispose()
    expect(() => controller.dispose()).not.toThrow()
    controller.openScene3DViewport()
    controller.selectScene3DNode('scene3d:lin')
    // The disposed scene controller never publishes again; the last published
    // workbench state is retained, nothing live.
    scene.selectShot('shot:other')
    expect(listener).not.toHaveBeenCalled()
    expect(scene.getSnapshot().selectedShotRef).toBe(PIPELINE_FIXTURE_SHOT_REF)
    expect(controller.getSnapshot().scene3d.open).toBe(true)
  })

  it('project/target switch disposes the stale scene controller and closes the region', async () => {
    const fixture = createPipelineFixtureOwner()
    const envelope = await fixture.snapshot() as Record<string, unknown>
    let current: unknown = envelope
    const owner: PipelineWorkbenchOwnerFaceV1 = { ...fixture, snapshot: async () => current }
    const controller = new PipelineWorkbenchController({ owner })
    await controller.load()
    await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
    controller.openScene3DViewport()
    const scene = controller.getSnapshot().scene3d.controller!
    await waitFor(() => expect(scene.getSnapshot().status).toBe('ready'))
    const sceneListener = vi.fn()
    scene.subscribe(sceneListener)

    // The owner projection moves to a different scene document (project switch).
    current = {
      ...envelope,
      scene3d: {
        ...(envelope.scene3d as Record<string, unknown>),
        documentId: 'scene3d:second',
      },
    }
    await controller.load()

    const state = controller.getSnapshot()
    expect(state.scene3d.open).toBe(false)
    expect(state.scene3d.controller).toBeUndefined()
    // The stale controller is disposed: it never publishes again.
    scene.selectShot('shot:late')
    expect(sceneListener).not.toHaveBeenCalled()

    // Reopening binds the NEW target and re-reads the owner truth.
    controller.openScene3DViewport()
    const reopened = controller.getSnapshot().scene3d.controller
    expect(reopened).toBeDefined()
    expect(reopened).not.toBe(scene)
    expect(reopened!.target.documentId).toBe('scene3d:second')
    controller.dispose()
  })
})

describe('scene3d remote probe', () => {
  it('probes remote.scene3dDirector both nested and direct, and rejects shape mismatches', () => {
    const remote = createPipelineFixtureOwner().scene3dRemote!
    expect(probePipelineScene3DRemote({ get: key => key === 'remote' ? { scene3dDirector: remote } : undefined })).toBe(remote)
    expect(probePipelineScene3DRemote({ get: key => key === 'remote.scene3dDirector' ? remote : undefined })).toBe(remote)
    expect(probePipelineScene3DRemote({ get: () => undefined })).toBeUndefined()
    expect(probePipelineScene3DRemote({ get: key => key === 'remote' ? { scene3dDirector: { sceneRead: 'nope' } } : undefined })).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import type { CanvasBindingV1, SceneDocumentV1, ShotV1 } from '@yeisme/dsh-pane-protocol'
import {
  buildScene3DSelectionConvergence,
  buildShotNavItems,
  buildShotPreviewDocument,
  resolveShotCameraNodeId,
  resolveShotPreviewNodeIds,
  sampleShotAtFrame,
} from '../src/previz.ts'
import { sceneDocumentFixture, shotFixture } from './fixtures.ts'

function previewDocument(): SceneDocumentV1 {
  return sceneDocumentFixture({
    nodes: [
      { id: 'root', label: 'Root', kind: 'group', transform: { translate: [0, 0, 0], rotate: [0, 0, 0, 1], scale: [1, 1, 1] }, visible: true },
      { id: 'hero', label: 'Hero', kind: 'mesh', parentId: 'root', transform: { translate: [1, 0, 0], rotate: [0, 0, 0, 1], scale: [1, 1, 1] }, visible: true, resourceRef: 'asset:hero' },
      { id: 'main-camera', label: 'Main camera', kind: 'camera', parentId: 'root', transform: { translate: [0, 2, 6], rotate: [0, 0, 0, 1], scale: [1, 1, 1] }, visible: true, resourceRef: 'camera:main' },
      { id: 'prop-chair', label: 'Chair', kind: 'prop', parentId: 'root', transform: { translate: [2, 0, 1], rotate: [0, 0, 0, 1], scale: [1, 1, 1] }, visible: true, resourceRef: 'asset:chair' },
    ],
  })
}

function animatedShot(): ShotV1 {
  return shotFixture({
    objectRefs: ['asset:hero', 'asset:chair'],
    visibility: [{ objectRef: 'asset:chair', visible: false }],
    keyframes: [
      { id: 'kf-1', frame: 0, objectRef: 'asset:hero', property: 'translate', value: [0, 0, 0] },
      { id: 'kf-2', frame: 24, objectRef: 'asset:hero', property: 'translate', value: [4, 0, 0] },
      { id: 'kf-3', frame: 12, objectRef: 'asset:hero', property: 'visibility', value: false },
      { id: 'kf-4', frame: 36, objectRef: 'asset:hero', property: 'visibility', value: true },
      { id: 'kf-5', frame: 48, objectRef: 'asset:hero', property: 'scale', value: [2, 2, 2] },
    ],
  })
}

describe('sampleShotAtFrame', () => {
  it('step-samples the latest keyframe at or before the playhead per property', () => {
    const shot = animatedShot()
    const at10 = sampleShotAtFrame(shot, 10).get('asset:hero')
    expect(at10?.translate).toEqual([0, 0, 0])
    expect(at10?.visible).toBeUndefined()
    const at24 = sampleShotAtFrame(shot, 24).get('asset:hero')
    expect(at24?.translate).toEqual([4, 0, 0])
    expect(at24?.visible).toBe(false)
    const at48 = sampleShotAtFrame(shot, 48).get('asset:hero')
    expect(at48?.visible).toBe(true)
    expect(at48?.scale).toEqual([2, 2, 2])
  })

  it('carries the shot visibility baseline without a keyframe', () => {
    const shot = animatedShot()
    expect(sampleShotAtFrame(shot, 0).get('asset:chair')?.visible).toBe(false)
  })

  it('clamps the playhead into the shot frame range', () => {
    const shot = animatedShot()
    expect(sampleShotAtFrame(shot, -100)).toEqual(sampleShotAtFrame(shot, 0))
    expect(sampleShotAtFrame(shot, 9999)).toEqual(sampleShotAtFrame(shot, 48))
  })
})

describe('buildShotPreviewDocument', () => {
  it('applies sampled transforms and visibility to resourceRef-matched nodes only', () => {
    const document = previewDocument()
    const preview = buildShotPreviewDocument(document, animatedShot(), 24)
    const hero = preview.nodes.find(node => node.id === 'hero')
    expect(hero?.transform.translate).toEqual([4, 0, 0])
    expect(hero?.visible).toBe(false)
    const chair = preview.nodes.find(node => node.id === 'prop-chair')
    expect(chair?.visible).toBe(false)
    expect(chair?.transform.translate).toEqual([2, 0, 1])
    const camera = preview.nodes.find(node => node.id === 'main-camera')
    expect(camera?.transform.translate).toEqual([0, 2, 6])
  })

  it('keeps the original document untouched and returns its identity when nothing changes', () => {
    const document = previewDocument()
    expect(buildShotPreviewDocument(document, undefined, 0)).toBe(document)
    const untouched = buildShotPreviewDocument(document, shotFixture({ objectRefs: [], visibility: [], keyframes: [] }), 0)
    expect(untouched).toBe(document)
    const hero = document.nodes.find(node => node.id === 'hero')
    expect(hero?.transform.translate).toEqual([1, 0, 0])
    expect(hero?.visible).toBe(true)
  })
})

describe('shot-scoped node resolution', () => {
  it('resolves the nodes a shot frames, including its camera', () => {
    const ids = resolveShotPreviewNodeIds(previewDocument(), shotFixture({ objectRefs: ['asset:hero'] }))
    expect([...ids].sort()).toEqual(['hero', 'main-camera'])
    expect(resolveShotPreviewNodeIds(previewDocument(), undefined).size).toBe(0)
  })

  it('resolves the shot camera node through its resourceRef', () => {
    expect(resolveShotCameraNodeId(previewDocument(), shotFixture())).toBe('main-camera')
    expect(resolveShotCameraNodeId(previewDocument(), shotFixture({ cameraRef: 'camera:absent' }))).toBeUndefined()
    expect(resolveShotCameraNodeId(previewDocument(), undefined)).toBeUndefined()
  })
})

describe('selection convergence', () => {
  const bindings: readonly CanvasBindingV1[] = [
    { nodeRef: 'canvas:node-1', shotRef: 'shot:opening', sceneObjectRef: 'asset:hero', edgeKind: 'reference', layout: { position: { x: 0, y: 0 } } },
    { nodeRef: 'canvas:node-2', shotRef: 'shot:opening', sceneObjectRef: 'asset:hero', edgeKind: 'execution', layout: { position: { x: 10, y: 0 } } },
    { nodeRef: 'canvas:node-3', shotRef: 'shot:closeup', sceneObjectRef: 'asset:hero', edgeKind: 'reference', layout: { position: { x: 20, y: 0 } } },
    { nodeRef: 'canvas:node-4', shotRef: 'shot:closeup', sceneObjectRef: 'asset:absent', edgeKind: 'reference', layout: { position: { x: 30, y: 0 } } },
  ]

  it('maps scene nodes to bound shots and back, deduplicated', () => {
    const convergence = buildScene3DSelectionConvergence(previewDocument(), bindings)
    expect(convergence.nodeToShots.get('hero')).toEqual(['shot:opening', 'shot:closeup'])
    expect(convergence.shotToNodes.get('shot:opening')).toEqual(['hero'])
    // sceneObjectRef without a matching node is skipped, never faked
    expect(convergence.nodeToShots.has('prop-chair')).toBe(false)
  })

  it('marks navigator rows selected/bound from the convergence', () => {
    const convergence = buildScene3DSelectionConvergence(previewDocument(), bindings)
    const shots = [
      shotFixture(),
      shotFixture({ shotRef: 'shot:closeup', keyframes: [], deliveryProjection: { status: 'blocked', summary: 'Waiting on the render owner.' } }),
    ]
    const items = buildShotNavItems(shots, 'shot:opening', 'hero', convergence)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ shotRef: 'shot:opening', selected: true, bound: true, keyframeCount: 2 })
    expect(items[1]).toMatchObject({ shotRef: 'shot:closeup', selected: false, bound: true, deliveryStatus: 'blocked', deliverySummary: 'Waiting on the render owner.' })
    const unbound = buildShotNavItems(shots, undefined, 'prop-chair', convergence)
    expect(unbound.every(item => !item.selected && !item.bound)).toBe(true)
  })
})

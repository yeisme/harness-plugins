import {
  SCENE_3D_SCHEMA,
  type CanvasBindingV1,
  type GenerationChangeSetV1,
  type SceneDocumentV1,
  type ShotV1,
} from '@yeisme/dsh-pane-protocol'

export const scope = { workspaceRef: 'workspace:one', projectRef: 'project:one' } as const
export const target = { scope, documentId: 'main' } as const

const IDENTITY = { translate: [0, 0, 0] as [number, number, number], rotate: [0, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number] }

export function sceneDocumentFixture(overrides: Partial<SceneDocumentV1> = {}): SceneDocumentV1 {
  return {
    schema: SCENE_3D_SCHEMA,
    scope: { ...scope },
    id: 'main',
    version: 3,
    scenes: [{ id: 'main', label: 'Main scene', rootNodeIds: ['root'], default: true }],
    nodes: [
      { id: 'root', label: 'Root', kind: 'group', transform: IDENTITY, visible: true },
      { id: 'hero', label: 'Hero', kind: 'mesh', parentId: 'root', transform: { ...IDENTITY, translate: [1, 0, 0] }, visible: true, resourceRef: 'asset:hero' },
      { id: 'key-light', label: 'Key light', kind: 'light', parentId: 'root', transform: IDENTITY, visible: false },
    ],
    resources: [],
    extensions: { used: [], required: [] },
    capabilityReport: { gltfVersion: '2.0', extensions: [], export: { ready: true, gaps: [] } },
    ...overrides,
  }
}

/** Document whose draco mesh cannot be exported nor opaque-preserved: export must block with a gap. */
export function blockedDocumentFixture(): SceneDocumentV1 {
  return sceneDocumentFixture({
    extensions: { used: ['KHR_draco_mesh_compression'], required: [] },
    capabilityReport: {
      gltfVersion: '2.0',
      extensions: [{ name: 'KHR_draco_mesh_compression', readable: true, editable: false, exportable: false, opaquePreserved: false }],
      export: { ready: false, gaps: [{ extension: 'KHR_draco_mesh_compression', reason: 'Draco-compressed meshes cannot be re-encoded for export.' }] },
    },
  })
}

export function shotFixture(overrides: Partial<ShotV1> = {}): ShotV1 {
  return {
    shotRef: 'shot:opening',
    sceneRef: 'scene:main',
    version: 'v1',
    cameraRef: 'camera:main',
    frameRange: { start: 0, end: 48, fps: 24 },
    keyframes: [
      { id: 'kf-1', frame: 0, objectRef: 'asset:hero', property: 'translate', value: [0, 0, 0] },
      { id: 'kf-2', frame: 24, objectRef: 'asset:hero', property: 'visibility', value: true },
    ],
    objectRefs: ['asset:hero'],
    visibility: [{ objectRef: 'asset:hero', visible: true }],
    generationRefs: [],
    deliveryProjection: { status: 'pending' },
    ...overrides,
  }
}

export function bindingFixture(): CanvasBindingV1 {
  return {
    nodeRef: 'canvas:node-1',
    shotRef: 'shot:opening',
    sceneObjectRef: 'asset:hero',
    edgeKind: 'reference',
    layout: { position: { x: 0, y: 0 } },
  }
}

export function changeSetFixture(overrides: Partial<GenerationChangeSetV1> = {}): GenerationChangeSetV1 {
  return {
    changeSetRef: 'changeset:one',
    sceneRef: 'main',
    baseVersion: 3,
    inputRefs: ['asset:hero'],
    operationSummary: 'Regenerate hero transform',
    patchDigest: 'sha256:0123456789abcdef',
    status: 'preview',
    previewRef: 'preview:one',
    artifactRef: { schema: 'pane.artifact.v1alpha1', owner: 'gen3d', kind: 'scene', ref: 'artifact:gen-1', version: '1', mediaType: 'model/gltf-binary', title: 'gen 1', evidenceRefs: [], capabilities: ['read'] },
    ...overrides,
  }
}

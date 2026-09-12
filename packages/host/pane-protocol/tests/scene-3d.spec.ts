import { describe, expect, it } from 'vitest'
import {
  GLTF_2_0_OFFICIAL_EXTENSIONS,
  PANE_ARTIFACT_SCHEMA,
  SCENE_3D_SCHEMA,
  CanvasBindingSchema,
  GenerationChangeSetSchema,
  GltfCapabilityReportSchema,
  SceneDocumentSchema,
  SceneGraphReadResultSchema,
  SceneGraphSaveResultSchema,
  ShotSchema,
  isOfficialGltfExtension,
  parseCanvasBinding,
  parseGenerationChangeSet,
  parseGltfCapabilityReport,
  parseSceneDocument,
  parseSceneGraphSaveResult,
  parseShot,
} from '../src/index.js'

const artifact = {
  schema: PANE_ARTIFACT_SCHEMA,
  owner: 'eikona',
  kind: 'model',
  ref: 'artifact:eikona:mesh:1',
  version: '1',
  mediaType: 'model/gltf-binary',
  title: 'Rooftop kit',
  evidenceRefs: ['evidence:1'],
  capabilities: ['open'],
}

const capabilityReport = {
  gltfVersion: '2.0',
  extensions: [
    { name: 'KHR_materials_unlit', readable: true, editable: true, exportable: true, opaquePreserved: false },
    { name: 'KHR_draco_mesh_compression', readable: true, editable: false, exportable: false, opaquePreserved: true, note: 'Decoded for preview, preserved verbatim.' },
    { name: 'VENDOR_magic_fx', readable: false, editable: false, exportable: false, opaquePreserved: true },
  ],
  export: { ready: true, gaps: [] },
}

const sceneDocument = {
  schema: SCENE_3D_SCHEMA,
  scope: { workspaceRef: 'workspace:demo', projectRef: 'project:one' },
  id: 'scene-graph:one',
  version: 1,
  scenes: [
    { id: 'scene:main', label: 'Main scene', rootNodeIds: ['node:root'], default: true },
  ],
  nodes: [
    {
      id: 'node:root', label: 'Root', kind: 'group',
      transform: { translate: [0, 0, 0], rotate: [0, 0, 0, 1], scale: [1, 1, 1] },
      visible: true,
    },
    {
      id: 'node:hero', label: 'Hero', kind: 'character', parentId: 'node:root',
      transform: { translate: [1, 0, 0], rotate: [0, 0, 0, 1], scale: [1, 1, 1] },
      visible: true, resourceRef: 'resource:hero:1', canvasNodeRef: 'canvas-node:character:1',
    },
  ],
  resources: [artifact],
  extensions: { used: ['KHR_materials_unlit', 'KHR_draco_mesh_compression', 'VENDOR_magic_fx'], required: ['KHR_draco_mesh_compression'] },
  capabilityReport,
}

const shot = {
  shotRef: 'shot:12',
  sceneRef: 'scene-graph:one',
  version: '3',
  cameraRef: 'scene-object:camera:main',
  frameRange: { start: 0, end: 48, fps: 24 },
  keyframes: [
    { id: 'kf:1', frame: 0, objectRef: 'scene-object:hero', property: 'translate', value: [0, 0, 0] },
    { id: 'kf:2', frame: 48, objectRef: 'scene-object:hero', property: 'visibility', value: true },
  ],
  objectRefs: ['scene-object:hero', 'scene-object:camera:main'],
  visibility: [{ objectRef: 'scene-object:hero', visible: true }],
  generationRefs: ['changeset:gen:1'],
  deliveryProjection: { status: 'ready', artifact },
}

const changeSet = {
  changeSetRef: 'changeset:gen:1',
  sceneRef: 'scene-graph:one',
  baseVersion: 1,
  inputRefs: ['artifact:eikona:mesh:1'],
  operationSummary: 'Regenerate hero prop with bounded summary only.',
  previewRef: 'preview:gen:1',
  patchDigest: 'sha256:0123456789abcdef',
  status: 'preview',
}

describe('glTF capability report', () => {
  it('lists the official glTF 2.0 extension registry snapshot', () => {
    expect(GLTF_2_0_OFFICIAL_EXTENSIONS).toContain('KHR_materials_unlit')
    expect(GLTF_2_0_OFFICIAL_EXTENSIONS).toContain('KHR_materials_pbrSpecularGlossiness')
    expect(GLTF_2_0_OFFICIAL_EXTENSIONS).toContain('EXT_meshopt_compression')
    expect(isOfficialGltfExtension('KHR_lights_punctual')).toBe(true)
    expect(isOfficialGltfExtension('VENDOR_magic_fx')).toBe(false)
  })

  it('accepts a report with opaque-preserved unsupported extensions', () => {
    const parsed = parseGltfCapabilityReport(capabilityReport)
    expect(parsed.export.ready).toBe(true)
    expect(parsed.extensions).toHaveLength(3)
  })

  it('blocks export with a capability gap when an extension would lose data', () => {
    const lossy = {
      gltfVersion: '2.0',
      extensions: [
        { name: 'KHR_texture_basisu', readable: true, editable: false, exportable: false, opaquePreserved: false },
      ],
      export: {
        ready: false,
        gaps: [{ extension: 'KHR_texture_basisu', reason: 'BasisU transcode target unavailable.' }],
      },
    }
    const parsed = GltfCapabilityReportSchema.parse(lossy)
    expect(parsed.export.ready).toBe(false)
    expect(parsed.export.gaps).toHaveLength(1)
  })

  it('rejects silent data loss: lossy extension without a gap or without blocking export', () => {
    const lossyExtension = { name: 'KHR_texture_basisu', readable: true, editable: false, exportable: false, opaquePreserved: false }
    expect(GltfCapabilityReportSchema.safeParse({
      gltfVersion: '2.0',
      extensions: [lossyExtension],
      export: { ready: true, gaps: [] },
    }).success).toBe(false)
    expect(GltfCapabilityReportSchema.safeParse({
      gltfVersion: '2.0',
      extensions: [lossyExtension],
      export: { ready: false, gaps: [] },
    }).success).toBe(false)
  })

  it('rejects inconsistent capability levels and malformed extension names', () => {
    expect(GltfCapabilityReportSchema.safeParse({
      gltfVersion: '2.0',
      extensions: [{ name: 'KHR_materials_unlit', readable: false, editable: true, exportable: false, opaquePreserved: false }],
      export: { ready: true, gaps: [] },
    }).success).toBe(false)
    expect(GltfCapabilityReportSchema.safeParse({
      gltfVersion: '2.0',
      extensions: [{ name: 'not an extension', readable: true, editable: false, exportable: true, opaquePreserved: false }],
      export: { ready: true, gaps: [] },
    }).success).toBe(false)
    expect(GltfCapabilityReportSchema.safeParse({
      gltfVersion: '3.0',
      extensions: [],
      export: { ready: true, gaps: [] },
    }).success).toBe(false)
  })
})

describe('scene document', () => {
  it('accepts a bounded versioned scene graph with capability report', () => {
    const parsed = parseSceneDocument(sceneDocument)
    expect(parsed.version).toBe(1)
    expect(parsed.nodes.map(node => node.id)).toEqual(['node:root', 'node:hero'])
  })

  it('rejects unsafe refs, smuggled fields and contract drift', () => {
    expect(SceneDocumentSchema.safeParse({ ...sceneDocument, rawPrompt: 'private' }).success).toBe(false)
    expect(SceneDocumentSchema.safeParse({
      ...sceneDocument,
      nodes: [{ ...sceneDocument.nodes[1], resourceRef: '/private/mesh.glb' }],
    }).success).toBe(false)
    expect(SceneDocumentSchema.safeParse({
      ...sceneDocument,
      nodes: [{ ...sceneDocument.nodes[1], canvasNodeRef: 'https://evil.example/node' }],
    }).success).toBe(false)
    expect(SceneDocumentSchema.safeParse({ ...sceneDocument, schema: 'dsh.scene-3d.v2' }).success).toBe(false)
    expect(() => parseSceneDocument({ ...sceneDocument, token: 'secret' })).toThrow()
  })

  it('rejects structural violations: duplicate ids, cycles, dangling roots, extension mismatches', () => {
    expect(SceneDocumentSchema.safeParse({
      ...sceneDocument,
      nodes: [...sceneDocument.nodes, { ...sceneDocument.nodes[1] }],
    }).success).toBe(false)
    expect(SceneDocumentSchema.safeParse({
      ...sceneDocument,
      nodes: [{ ...sceneDocument.nodes[1], id: 'node:root', parentId: 'node:root' }],
    }).success).toBe(false)
    expect(SceneDocumentSchema.safeParse({
      ...sceneDocument,
      scenes: [{ id: 'scene:main', label: 'Main', rootNodeIds: ['node:missing'] }],
    }).success).toBe(false)
    expect(SceneDocumentSchema.safeParse({
      ...sceneDocument,
      extensions: { used: ['KHR_materials_unlit'], required: ['KHR_draco_mesh_compression'] },
    }).success).toBe(false)
    expect(SceneDocumentSchema.safeParse({
      ...sceneDocument,
      extensions: { used: ['KHR_materials_unlit', 'KHR_texture_transform'], required: [] },
    }).success).toBe(false)
  })
})

describe('shot', () => {
  it('accepts a shot with camera, frame range, keyframes and delivery projection', () => {
    const parsed = parseShot(shot)
    expect(parsed.frameRange.fps).toBe(24)
    expect(parsed.keyframes).toHaveLength(2)
  })

  it('rejects inverted frame ranges and unexplained blocked delivery', () => {
    expect(ShotSchema.safeParse({
      ...shot,
      frameRange: { start: 48, end: 0, fps: 24 },
    }).success).toBe(false)
    expect(ShotSchema.safeParse({
      ...shot,
      deliveryProjection: { status: 'blocked' },
    }).success).toBe(false)
    expect(ShotSchema.safeParse({
      ...shot,
      deliveryProjection: { status: 'blocked', summary: 'Owner render farm offline.' },
    }).success).toBe(true)
  })

  it('rejects unsafe object refs and undeclared fields', () => {
    expect(ShotSchema.safeParse({ ...shot, cameraRef: 'C:\\renders\\cam' }).success).toBe(false)
    expect(ShotSchema.safeParse({ ...shot, providerPayload: {} }).success).toBe(false)
  })
})

describe('canvas binding', () => {
  const binding = {
    nodeRef: 'canvas-node:shot:12',
    shotRef: 'shot:12',
    sceneObjectRef: 'scene-object:hero',
    edgeKind: 'reference',
    layout: { position: { x: 10, y: 20 }, size: { width: 120, height: 80 } },
  }

  it('accepts reference and execution bindings with bounded layout', () => {
    expect(parseCanvasBinding(binding).edgeKind).toBe('reference')
    expect(CanvasBindingSchema.safeParse({ ...binding, edgeKind: 'execution' }).success).toBe(true)
  })

  it('rejects unsafe refs and negative geometry', () => {
    expect(CanvasBindingSchema.safeParse({ ...binding, sceneObjectRef: 'file:///tmp/model.glb' }).success).toBe(false)
    expect(CanvasBindingSchema.safeParse({
      ...binding,
      layout: { position: { x: 0, y: 0 }, size: { width: -1, height: 10 } },
    }).success).toBe(false)
  })
})

describe('generation change set', () => {
  it('accepts a preview change set with safe refs and digest', () => {
    const parsed = parseGenerationChangeSet(changeSet)
    expect(parsed.status).toBe('preview')
  })

  it('enforces status payloads: preview/accepted/rolled_back refs and explained failures', () => {
    expect(GenerationChangeSetSchema.safeParse({ ...changeSet, previewRef: undefined }).success).toBe(false)
    expect(GenerationChangeSetSchema.safeParse({ ...changeSet, status: 'accepted' }).success).toBe(false)
    expect(GenerationChangeSetSchema.safeParse({ ...changeSet, status: 'accepted', artifactRef: artifact }).success).toBe(true)
    expect(GenerationChangeSetSchema.safeParse({ ...changeSet, status: 'rolled_back' }).success).toBe(false)
    expect(GenerationChangeSetSchema.safeParse({
      ...changeSet, status: 'rolled_back', rollbackRef: 'revision:scene-graph:one:1',
    }).success).toBe(true)
    for (const status of ['failed', 'partial', 'stale', 'unknown'] as const) {
      expect(GenerationChangeSetSchema.safeParse({ ...changeSet, status }).success).toBe(false)
      expect(GenerationChangeSetSchema.safeParse({
        ...changeSet, status, reason: 'Owner reported a bounded reason.',
      }).success).toBe(true)
    }
  })

  it('rejects raw prompts, provider payloads and unsafe refs', () => {
    expect(GenerationChangeSetSchema.safeParse({ ...changeSet, operationSummary: 'https://internal.example/raw-prompt' }).success).toBe(false)
    expect(GenerationChangeSetSchema.safeParse({ ...changeSet, inputRefs: ['https://evil.example/input'] }).success).toBe(false)
    expect(GenerationChangeSetSchema.safeParse({ ...changeSet, rawPrompt: 'private' }).success).toBe(false)
  })
})

describe('scene graph save/read results', () => {
  it('mirrors the project canvas conflict + draft preservation pattern', () => {
    const saved = parseSceneGraphSaveResult({ status: 'saved', requestId: 'req-save-1', version: 2 })
    expect(saved).toEqual({ status: 'saved', requestId: 'req-save-1', version: 2 })

    const conflict = SceneGraphSaveResultSchema.parse({ status: 'conflict', version: 2 })
    expect(conflict).toEqual({ status: 'conflict', version: 2 })

    expect(SceneGraphSaveResultSchema.parse({ status: 'not_applied', requestId: 'req-save-1' }).status).toBe('not_applied')
    for (const status of ['unavailable', 'forbidden', 'invalid', 'unknown'] as const) {
      expect(SceneGraphSaveResultSchema.parse({ status }).status).toBe(status)
    }

    const read = SceneGraphReadResultSchema.parse({
      status: 'ready',
      document: { ...sceneDocument, version: 2 },
      draft: { requestId: 'req-save-1', baseVersion: 1, document: sceneDocument },
    })
    expect(read.status).toBe('ready')
    if (read.status === 'ready' || read.status === 'missing') {
      expect(read.draft?.document.version).toBe(1)
      expect(read.draft?.document.nodes.some(node => node.kind === 'character')).toBe(true)
    }
  })

  it('never fabricates success: unknown save results carry no version', () => {
    expect(SceneGraphSaveResultSchema.safeParse({ status: 'unknown', version: 3 }).success).toBe(false)
    expect(SceneGraphSaveResultSchema.safeParse({ status: 'saved', requestId: 'req-1' }).success).toBe(false)
  })
})

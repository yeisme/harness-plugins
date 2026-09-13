import { describe, expect, it } from 'vitest'
import { Document, NodeIO } from '@gltf-transform/core'
import {
  GLTF_2_0_OFFICIAL_EXTENSIONS,
  parseGltfCapabilityReport,
  parseSceneDocument,
  type SceneDocumentV1,
} from '@yeisme/dsh-pane-protocol'
import {
  evaluateGltfCapabilityReport,
  exportSceneDocumentToGlb,
  importGlbToSceneDocument,
  MAX_GLB_BYTES,
} from '../src/gltf/index.js'

const IMPORT_OPTIONS = {
  scope: { workspaceRef: 'workspace:test', projectRef: 'project:test' },
  documentId: 'scene-graph:test',
  version: 3,
} as const

/** Programmatic minimal GLB: one default scene, Root(group) → Hero(mesh, TRS). No binary fixtures committed. */
async function buildFixtureGlb(): Promise<Uint8Array> {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene('Main scene')
  const root = doc.createNode('Root')
  const hero = doc.createNode('Hero').setTranslation([1, 2, 3]).setRotation([0, 0, 0, 1]).setScale([2, 2, 2])
  const position = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buffer)
  const mesh = doc.createMesh('HeroMesh')
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', position))
  hero.setMesh(mesh)
  root.addChild(hero)
  scene.addChild(root)
  doc.getRoot().setDefaultScene(scene)
  return new NodeIO().writeBinary(doc)
}

/** Rewrites the JSON chunk of a GLB in place (e.g. to inject extension declarations) and repacks lengths. */
function rewriteGlbJson(glb: Uint8Array, mutate: (json: Record<string, unknown>) => void): Uint8Array {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
  const jsonLength = view.getUint32(12, true)
  const jsonChunkType = view.getUint32(16, true)
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength))) as Record<string, unknown>
  mutate(json)
  let jsonText = JSON.stringify(json)
  while (jsonText.length % 4 !== 0) jsonText += ' '
  const jsonBytes = new TextEncoder().encode(jsonText)
  const rest = glb.subarray(20 + jsonLength)
  const out = new Uint8Array(12 + 8 + jsonBytes.length + rest.length)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, view.getUint32(0, true), true)
  outView.setUint32(4, view.getUint32(4, true), true)
  outView.setUint32(8, out.length, true)
  outView.setUint32(12, jsonBytes.length, true)
  outView.setUint32(16, jsonChunkType, true)
  out.set(jsonBytes, 20)
  out.set(rest, 20 + jsonBytes.length)
  return out
}

function isGlb(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) === 0x46546c67
}

describe('importGlbToSceneDocument', () => {
  it('projects a valid GLB into a contract-conformant SceneDocumentV1', async () => {
    const result = await importGlbToSceneDocument(await buildFixtureGlb(), IMPORT_OPTIONS)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const document = parseSceneDocument(result.document)
    expect(document.schema).toBe('dsh.scene-3d.v1alpha1')
    expect(document.version).toBe(3)
    expect(document.scenes).toHaveLength(1)
    expect(document.scenes[0]).toMatchObject({ label: 'Main scene', default: true, rootNodeIds: ['node:0'] })

    expect(document.nodes).toHaveLength(2)
    expect(document.nodes[0]).toMatchObject({ id: 'node:0', label: 'Root', kind: 'group', visible: true })
    expect(document.nodes[0].parentId).toBeUndefined()
    expect(document.nodes[1]).toMatchObject({
      id: 'node:1',
      label: 'Hero',
      kind: 'mesh',
      parentId: 'node:0',
      resourceRef: 'resource:mesh:0',
      transform: { translate: [1, 2, 3], rotate: [0, 0, 0, 1], scale: [2, 2, 2] },
    })

    // mesh payloads stay behind opaque resource refs — no embedded bytes anywhere
    expect(document.resources).toHaveLength(1)
    expect(document.resources[0]).toMatchObject({
      owner: 'gltf-import',
      kind: 'mesh',
      ref: 'resource:mesh:0',
      mediaType: 'model/gltf-binary',
      title: 'HeroMesh',
    })
    const serialized = JSON.stringify(document)
    expect(serialized).not.toMatch(/https?:|file:|javascript:|[A-Za-z]:[\\/]/)

    expect(document.capabilityReport).toEqual({ gltfVersion: '2.0', extensions: [], export: { ready: true, gaps: [] } })
    expect(result.capabilityReport).toEqual(document.capabilityReport)
  })

  it('accepts self-contained glTF JSON', async () => {
    const json = JSON.stringify({
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0], name: 'Json scene' }],
      nodes: [{ name: 'Solo' }],
    })
    const result = await importGlbToSceneDocument(new TextEncoder().encode(json))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.nodes[0]).toMatchObject({ id: 'node:0', label: 'Solo', kind: 'prop' })
    expect(result.document.scenes[0].rootNodeIds).toEqual(['node:0'])
  })

  it('fails closed on corrupt bytes with a bounded, content-free reason', async () => {
    const garbage = await importGlbToSceneDocument(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))
    expect(garbage).toMatchObject({ ok: false, code: 'unsupported_container' })

    const truncated = await importGlbToSceneDocument((await buildFixtureGlb()).subarray(0, 40))
    expect(truncated.ok).toBe(false)
    if (truncated.ok) return
    expect(['parse_failed', 'unsupported_container']).toContain(truncated.code)
    expect(truncated.reason.length).toBeLessThanOrEqual(240)
  })

  it('rejects input beyond the byte ceiling before parsing', async () => {
    const result = await importGlbToSceneDocument(new Uint8Array(MAX_GLB_BYTES + 1))
    expect(result).toMatchObject({ ok: false, code: 'too_large' })
  })

  it('never fetches external resources from glTF JSON', async () => {
    const json = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'mesh.bin', byteLength: 0 }],
      scenes: [],
      nodes: [],
    })
    const result = await importGlbToSceneDocument(new TextEncoder().encode(json))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('external_resources')
    expect(result.reason).not.toContain('mesh.bin')
  })

  it('rejects any required extension fail-closed, including KHR_draco_mesh_compression', async () => {
    for (const name of ['VENDOR_magic_fx', 'KHR_draco_mesh_compression']) {
      const glb = rewriteGlbJson(await buildFixtureGlb(), json => {
        json.extensionsUsed = [name]
        json.extensionsRequired = [name]
      })
      const result = await importGlbToSceneDocument(glb)
      expect(result).toMatchObject({ ok: false, code: 'unknown_required_extension' })
      if (!result.ok) expect(result.reason).toContain(name)
    }
  })

  it('rejects malformed extension names', async () => {
    const glb = rewriteGlbJson(await buildFixtureGlb(), json => {
      json.extensionsUsed = ['not an extension']
    })
    const result = await importGlbToSceneDocument(glb)
    expect(result).toMatchObject({ ok: false, code: 'invalid_extension' })
  })

  it('rejects non-2.0 assets', async () => {
    const glb = rewriteGlbJson(await buildFixtureGlb(), json => {
      json.asset = { version: '1.0' }
    })
    const result = await importGlbToSceneDocument(glb)
    expect(result).toMatchObject({ ok: false, code: 'unsupported_version' })
  })
})

describe('evaluateGltfCapabilityReport', () => {
  it('covers the entire official glTF 2.0 extension registry deterministically', () => {
    const report = evaluateGltfCapabilityReport(GLTF_2_0_OFFICIAL_EXTENSIONS, [])
    expect(parseGltfCapabilityReport(report)).toEqual(report)
    expect(report.extensions.map(entry => entry.name)).toEqual([...GLTF_2_0_OFFICIAL_EXTENSIONS])
    for (const entry of report.extensions) {
      expect(typeof entry.readable).toBe('boolean')
      expect(typeof entry.editable).toBe('boolean')
      expect(typeof entry.exportable).toBe('boolean')
      expect(typeof entry.opaquePreserved).toBe('boolean')
    }

    // resource-internal payloads are preserved verbatim with the opaque source resource
    const draco = report.extensions.find(entry => entry.name === 'KHR_draco_mesh_compression')
    expect(draco).toMatchObject({ readable: true, editable: false, exportable: false, opaquePreserved: true })

    // scene-structure payloads cannot survive a snapshot and must block export with gaps
    const sceneStructure = ['KHR_animation_pointer', 'KHR_interactivity', 'KHR_lights_punctual', 'EXT_lights_ies', 'EXT_mesh_gpu_instancing']
    for (const name of sceneStructure) {
      const entry = report.extensions.find(candidate => candidate.name === name)
      expect(entry).toMatchObject({ readable: true, editable: false, exportable: false, opaquePreserved: false })
    }
    expect(report.export.ready).toBe(false)
    expect(report.export.gaps.map(gap => gap.extension).sort()).toEqual(sceneStructure.sort())
  })

  it('treats well-formed unknown vendor extensions fail-closed', () => {
    const report = evaluateGltfCapabilityReport(['VENDOR_magic_fx'], [])
    expect(report.export.ready).toBe(false)
    expect(report.export.gaps).toHaveLength(1)
    expect(report.export.gaps[0].extension).toBe('VENDOR_magic_fx')
  })

  it('is ready for extension-free assets and unions required names into the report', () => {
    expect(evaluateGltfCapabilityReport([], [])).toEqual({
      gltfVersion: '2.0',
      extensions: [],
      export: { ready: true, gaps: [] },
    })
    const report = evaluateGltfCapabilityReport([], ['KHR_materials_unlit'])
    expect(report.extensions).toHaveLength(1)
    expect(report.export.ready).toBe(true)
  })

  it('throws a bounded error on malformed names', () => {
    expect(() => evaluateGltfCapabilityReport(['bad name!'], [])).toThrow(/Malformed glTF extension name/)
  })
})

describe('exportSceneDocumentToGlb', () => {
  async function importWithExtensions(extensionsUsed: string[]): Promise<SceneDocumentV1> {
    const glb = rewriteGlbJson(await buildFixtureGlb(), json => {
      json.extensionsUsed = extensionsUsed
    })
    const result = await importGlbToSceneDocument(glb, IMPORT_OPTIONS)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('fixture import failed')
    return result.document
  }

  it('blocks export with concrete gaps when an extension cannot be preserved — nothing is silently discarded', async () => {
    const document = await importWithExtensions(['KHR_draco_mesh_compression', 'KHR_lights_punctual', 'VENDOR_magic_fx'])

    // draco payload stays verbatim with the opaque mesh resource; the other two are lossy
    expect(document.capabilityReport.export.ready).toBe(false)
    expect(document.capabilityReport.export.gaps.map(gap => gap.extension).sort()).toEqual(['KHR_lights_punctual', 'VENDOR_magic_fx'])

    const result = await exportSceneDocumentToGlb(document)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('capability_blocked')
    expect(result.gaps.map(gap => gap.extension).sort()).toEqual(['KHR_lights_punctual', 'VENDOR_magic_fx'])
    expect(result.gaps.every(gap => gap.reason.length > 0 && gap.reason.length <= 2048)).toBe(true)
  })

  it('exports snapshots when every declared extension is opaque-preserved', async () => {
    const document = await importWithExtensions(['KHR_draco_mesh_compression', 'KHR_materials_unlit'])
    expect(document.capabilityReport.export.ready).toBe(true)

    const result = await exportSceneDocumentToGlb(document)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(isGlb(result.bytes)).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)

    // declarations ride the extras stash, so a re-import restores them
    const reimport = await importGlbToSceneDocument(result.bytes, IMPORT_OPTIONS)
    expect(reimport.ok).toBe(true)
    if (!reimport.ok) return
    expect(reimport.document.extensions).toEqual({ used: ['KHR_draco_mesh_compression', 'KHR_materials_unlit'], required: [] })
    expect(reimport.document).toEqual(document)
  })

  it('rejects contract-violating documents before writing', async () => {
    const result = await exportSceneDocumentToGlb({ schema: 'nope' } as unknown as SceneDocumentV1)
    expect(result).toMatchObject({ ok: false, code: 'invalid_document', gaps: [] })
  })
})

describe('import → export → import round-trip', () => {
  it('preserves nodes, transforms, hierarchy, visibility, and resource references', async () => {
    const first = await importGlbToSceneDocument(await buildFixtureGlb(), IMPORT_OPTIONS)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const exported = await exportSceneDocumentToGlb(first.document)
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    expect(isGlb(exported.bytes)).toBe(true)

    const second = await importGlbToSceneDocument(exported.bytes, IMPORT_OPTIONS)
    expect(second.ok).toBe(true)
    if (!second.ok) return

    // full document identity: ids, kinds, parents, TRS, visibility, resource refs, scenes, declarations
    expect(second.document).toEqual(first.document)
    expect(parseSceneDocument(second.document)).toEqual(second.document)
  })

  it('keeps working when the original asset carries no workbench extras', async () => {
    const first = await importGlbToSceneDocument(await buildFixtureGlb())
    expect(first.ok).toBe(true)
    if (!first.ok) return
    // digest-derived default id and generic import scope
    expect(first.document.id).toMatch(/^scene-graph:sha256:[0-9a-f]{16}$/)
    expect(first.document.scope).toEqual({ workspaceRef: 'workspace:gltf-import', projectRef: 'project:gltf-import' })
    expect(first.document.version).toBe(0)
  })
})

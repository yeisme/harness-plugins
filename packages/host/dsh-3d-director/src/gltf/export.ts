import { Document, NodeIO, type ILogger, type Node as GltfNode } from '@gltf-transform/core'
import {
  SceneDocumentSchema,
  type GltfCapabilityGapV1,
  type SceneDocumentV1,
} from '@yeisme/dsh-pane-protocol'
import { evaluateGltfCapabilityReport } from './capability.js'
import { SCENE_GRAPH_EXTRAS_KEY } from './import.js'
import { boundedReason, type GltfExportResult } from './types.js'

const SILENT_LOGGER: ILogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

function blocked(reason: string, gaps: GltfCapabilityGapV1[]): GltfExportResult {
  return { ok: false, code: 'capability_blocked', reason: boundedReason(reason), gaps }
}

/**
 * Exports a SceneDocumentV1 as a core-only GLB scene-graph snapshot: scenes,
 * node hierarchy, TRS transforms, plus namespaced extras carrying workbench
 * ids/kinds/visibility/resourceRefs and the resources/extensions declarations
 * so a re-import restores the same projection. Mesh payloads are never
 * synthesized — they stay with the opaque resourceRef owners.
 *
 * Fail-closed: the document is revalidated against the frozen contract, and a
 * fresh capability evaluation blocks the export (`capability_blocked` with
 * concrete gaps) whenever any declared extension can neither be exported nor
 * opaque-preserved. Nothing is silently discarded.
 */
export async function exportSceneDocumentToGlb(document: SceneDocumentV1): Promise<GltfExportResult> {
  const parsed = SceneDocumentSchema.safeParse(document)
  if (!parsed.success) {
    const detail = parsed.error.issues.slice(0, 3).map(issue => issue.message).join('; ')
    return { ok: false, code: 'invalid_document', reason: boundedReason(`document failed contract validation: ${detail}`), gaps: [] }
  }
  const valid = parsed.data

  let capabilityReport
  try {
    capabilityReport = evaluateGltfCapabilityReport(valid.extensions.used, valid.extensions.required)
  } catch (error) {
    return {
      ok: false,
      code: 'invalid_document',
      reason: boundedReason(error instanceof Error ? error.message : error),
      gaps: [],
    }
  }
  if (!capabilityReport.export.ready) {
    return blocked(
      `export blocked: ${capabilityReport.export.gaps.length} extension(s) would lose data in a scene-graph snapshot`,
      capabilityReport.export.gaps,
    )
  }

  const warnings: string[] = []
  if (valid.extensions.used.length > 0) {
    warnings.push(
      boundedReason(
        `${valid.extensions.used.length} extension declaration(s) retained in the document; the snapshot GLB is core-only and extension payloads remain with their opaque resources`,
      ),
    )
  }

  const gltf = new Document()
  gltf.setLogger(SILENT_LOGGER)

  const nodeByGltf = new Map<string, GltfNode>()
  for (const node of valid.nodes) {
    const gltfNode = gltf.createNode(node.label)
    gltfNode
      .setTranslation([...node.transform.translate])
      .setRotation([...node.transform.rotate])
      .setScale([...node.transform.scale])
    gltfNode.setExtras({
      [SCENE_GRAPH_EXTRAS_KEY]: {
        id: node.id,
        kind: node.kind,
        visible: node.visible,
        ...(node.resourceRef ? { resourceRef: node.resourceRef } : {}),
        ...(node.canvasNodeRef ? { canvasNodeRef: node.canvasNodeRef } : {}),
      },
    })
    nodeByGltf.set(node.id, gltfNode)
  }
  for (const node of valid.nodes) {
    if (node.parentId === undefined) continue
    const child = nodeByGltf.get(node.id)
    const parent = nodeByGltf.get(node.parentId)
    if (child && parent) parent.addChild(child)
  }

  const defaultScene = valid.scenes.find(scene => scene.default === true)
  for (const scene of valid.scenes) {
    const gltfScene = gltf.createScene(scene.label)
    gltfScene.setExtras({ [SCENE_GRAPH_EXTRAS_KEY]: { id: scene.id } })
    for (const rootId of scene.rootNodeIds) {
      const gltfNode = nodeByGltf.get(rootId)
      if (gltfNode) gltfScene.addChild(gltfNode)
    }
    if (defaultScene && scene.id === defaultScene.id) gltf.getRoot().setDefaultScene(gltfScene)
  }

  gltf.getRoot().setExtras({
    [SCENE_GRAPH_EXTRAS_KEY]: {
      format: 1,
      resources: valid.resources,
      extensions: { used: valid.extensions.used, required: valid.extensions.required },
    },
  })

  try {
    const bytes = await new NodeIO().setLogger(SILENT_LOGGER).writeBinary(gltf)
    return { ok: true, bytes, capabilityReport, warnings }
  } catch (error) {
    return {
      ok: false,
      code: 'write_failed',
      reason: boundedReason(`GLB snapshot could not be written: ${error instanceof Error ? error.message : String(error)}`),
      gaps: [],
    }
  }
}

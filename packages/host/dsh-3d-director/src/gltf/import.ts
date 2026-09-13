import { createHash } from 'node:crypto'
import {
  NodeIO,
  type Document,
  type ILogger,
  type JSONDocument,
  type Node as GltfNode,
} from '@gltf-transform/core'
import {
  ArtifactRefSchema,
  GltfExtensionNameSchema,
  PANE_ARTIFACT_SCHEMA,
  SceneDocumentSchema,
  SCENE_3D_SCHEMA,
  type ArtifactRefV1,
  type SceneDocumentV1,
} from '@yeisme/dsh-pane-protocol'
import { evaluateGltfCapabilityReport } from './capability.js'
import {
  boundedReason,
  MAX_GLB_BYTES,
  type GltfImportFailureCode,
  type GltfImportOptions,
  type GltfImportResult,
} from './types.js'

/** Namespaced extras key carrying workbench scene-graph fields through exported GLBs. */
export const SCENE_GRAPH_EXTRAS_KEY = 'dsh3d.sceneGraph'

const GLB_MAGIC = 0x46546c67
const MAX_WARNINGS = 64
const MAX_SCENE_NODES = 10_000
const MAX_SCENES = 256
const MAX_SCENE_ROOTS = 1_000
const MAX_RESOURCES = 1_000

const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9._:/-]*$/i
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/
const UNSAFE_PROTOCOL = /^(?:https?|file|javascript|data):/i
const NODE_KIND_VALUES = ['mesh', 'camera', 'light', 'character', 'prop', 'environment', 'group'] as const
type NodeKind = (typeof NODE_KIND_VALUES)[number]
const NODE_KINDS = new Set<string>(NODE_KIND_VALUES)

const SILENT_LOGGER: ILogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

const DEFAULT_SCOPE = { workspaceRef: 'workspace:gltf-import', projectRef: 'project:gltf-import' } as const

function asIdentifier(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 120 && SAFE_IDENTIFIER.test(value) ? value : undefined
}

function asOpaqueRef(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return undefined
  if (value.startsWith('/') || value.startsWith('\\\\') || WINDOWS_ABSOLUTE_PATH.test(value) || UNSAFE_PROTOCOL.test(value)) return undefined
  return value
}

function asNodeKind(value: unknown): NodeKind | undefined {
  return typeof value === 'string' && NODE_KINDS.has(value) ? (value as NodeKind) : undefined
}

/** Asset-authored names are untrusted text: fall back when they would trip the contract safety scan. */
function safeLabel(value: string | null | undefined, fallback: string): string {
  const label = (value ?? '').slice(0, 160)
  if (label.length === 0) return fallback
  if (label.startsWith('/') || label.startsWith('\\\\') || WINDOWS_ABSOLUTE_PATH.test(label) || UNSAFE_PROTOCOL.test(label)) return fallback
  return label
}

function fail(code: GltfImportFailureCode, reason: string): GltfImportResult {
  return { ok: false, code, reason: boundedReason(reason) }
}

function decodeDataUri(uri: string): Uint8Array | undefined {
  const match = /^data:[\w.+-]*(?:;[\w=.+-]+)*(;base64)?,([\s\S]*)$/.exec(uri)
  if (!match?.[1]) return undefined
  const base64 = match[2]
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return undefined
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

interface StashedSceneGraph {
  resources: ArtifactRefV1[]
  extensions: { used: string[]; required: string[] }
}

/** Adopts a stashed round-trip payload only when every entry revalidates against the frozen contract. */
function readStash(extras: Record<string, unknown>): StashedSceneGraph | undefined {
  const stash = extras[SCENE_GRAPH_EXTRAS_KEY]
  if (stash === null || typeof stash !== 'object' || Array.isArray(stash)) return undefined
  const { resources, extensions } = stash as Record<string, unknown>
  if (!Array.isArray(resources) || resources.length > MAX_RESOURCES) return undefined
  const parsedResources: ArtifactRefV1[] = []
  for (const entry of resources) {
    const parsed = ArtifactRefSchema.safeParse(entry)
    if (!parsed.success) return undefined
    parsedResources.push(parsed.data)
  }
  if (extensions === null || typeof extensions !== 'object' || Array.isArray(extensions)) return undefined
  const { used, required } = extensions as Record<string, unknown>
  if (!Array.isArray(used) || !Array.isArray(required)) return undefined
  if (used.length > 256 || required.length > 256) return undefined
  if (![...used, ...required].every(name => typeof name === 'string' && GltfExtensionNameSchema.safeParse(name).success)) return undefined
  const usedSet = new Set(used as string[])
  if (!(required as string[]).every(name => usedSet.has(name))) return undefined
  return { resources: parsedResources, extensions: { used: used as string[], required: required as string[] } }
}

async function toJsonDocument(bytes: Uint8Array): Promise<JSONDocument | GltfImportResult> {
  if (bytes.length >= 4 && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) === GLB_MAGIC) {
    try {
      return await new NodeIO().setLogger(SILENT_LOGGER).binaryToJSON(bytes)
    } catch (error) {
      return fail('parse_failed', `GLB container could not be parsed: ${boundedReason(error instanceof Error ? error.message : error)}`)
    }
  }

  let json: Record<string, unknown>
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const parsed: unknown = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('top level must be an object')
    json = parsed as Record<string, unknown>
  } catch {
    return fail('unsupported_container', 'input is neither a GLB container nor a valid glTF JSON document')
  }

  const resources: Record<string, Uint8Array> = {}
  const buffers = Array.isArray(json.buffers) ? (json.buffers as Record<string, unknown>[]) : []
  for (const buffer of buffers) {
    if (buffer.uri === undefined) {
      return fail('unsupported_container', 'glTF JSON references a GLB binary chunk but no GLB container was provided')
    }
    if (typeof buffer.uri !== 'string' || !buffer.uri.startsWith('data:')) {
      return fail('external_resources', 'external buffer URIs are never fetched; embed data or provide a GLB container')
    }
    const decoded = decodeDataUri(buffer.uri)
    if (!decoded) return fail('parse_failed', 'embedded buffer data URI is malformed')
    resources[buffer.uri] = decoded
  }
  const images = Array.isArray(json.images) ? (json.images as Record<string, unknown>[]) : []
  for (const image of images) {
    if (image.uri === undefined) continue
    if (typeof image.uri !== 'string' || !image.uri.startsWith('data:')) {
      return fail('external_resources', 'external image URIs are never fetched; embed data or provide a GLB container')
    }
    const decoded = decodeDataUri(image.uri)
    if (!decoded) return fail('parse_failed', 'embedded image data URI is malformed')
    resources[image.uri] = decoded
  }

  return { json: json as unknown as JSONDocument['json'], resources: resources as JSONDocument['resources'] }
}

interface RawGltfJson {
  asset?: { version?: unknown }
  extensionsUsed?: unknown
  extensionsRequired?: unknown
  nodes?: Record<string, unknown>[]
  scenes?: Record<string, unknown>[]
  meshes?: unknown[]
  cameras?: unknown[]
  animations?: unknown[]
  skins?: unknown[]
}

function prevalidate(json: RawGltfJson): GltfImportResult | undefined {
  if (json.asset?.version !== '2.0') {
    return fail('unsupported_version', `only glTF 2.0 assets are accepted, got ${boundedReason(String(json.asset?.version ?? 'missing'), 40)}`)
  }
  const used = Array.isArray(json.extensionsUsed) ? json.extensionsUsed : []
  const required = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : []
  for (const name of [...used, ...required]) {
    if (typeof name !== 'string' || !GltfExtensionNameSchema.safeParse(name).success) {
      return fail('invalid_extension', `malformed extension name rejected: ${boundedReason(String(name), 80)}`)
    }
  }
  if (required.length > 0) {
    return fail(
      'unknown_required_extension',
      `required extensions cannot be honored by this engine (none registered): ${boundedReason(required.map(String).join(', '), 160)}`,
    )
  }
  if ((json.nodes?.length ?? 0) > MAX_SCENE_NODES || (json.scenes?.length ?? 0) > MAX_SCENES || (json.meshes?.length ?? 0) > MAX_RESOURCES) {
    return fail('too_complex', 'asset exceeds scene graph projection limits')
  }
  return undefined
}

function finiteVec(values: ArrayLike<number>, size: 3 | 4, fallback: number[], nodeId: string, field: string, warn: (m: string) => void): number[] {
  const out: number[] = []
  for (let index = 0; index < size; index += 1) {
    const value = Number(values[index])
    out.push(Number.isFinite(value) ? value : fallback[index])
  }
  if (out.some((value, index) => value !== Number(values[index]))) {
    warn(`node ${nodeId} ${field} contained non-finite values and was reset`)
  }
  return out
}

function detectKind(node: GltfNode, rawNode: Record<string, unknown> | undefined, extrasKind: unknown): NodeKind {
  const stashed = asNodeKind(extrasKind)
  if (stashed) return stashed
  if (node.getMesh()) return 'mesh'
  if (node.getCamera()) return 'camera'
  const rawExtensions = rawNode?.extensions
  if (rawExtensions && typeof rawExtensions === 'object' && 'KHR_lights_punctual' in rawExtensions) return 'light'
  return node.listChildren().length > 0 ? 'group' : 'prop'
}

/**
 * Imports a GLB container or self-contained glTF JSON document into the frozen
 * SceneDocumentV1 projection. Fail-closed: oversize input, unparseable bytes,
 * external resource URIs, malformed or required extensions, and contract-limit
 * overflows all return a bounded `{ ok: false, code, reason }` without leaking
 * paths, byte content, or payloads. Mesh payloads are never embedded — nodes
 * reference them through opaque resourceRefs.
 */
export async function importGlbToSceneDocument(bytes: Uint8Array, options: GltfImportOptions = {}): Promise<GltfImportResult> {
  if (bytes.byteLength > MAX_GLB_BYTES) {
    return fail('too_large', `input exceeds the ${MAX_GLB_BYTES}-byte import ceiling`)
  }

  const jsonDoc = await toJsonDocument(bytes)
  if (!('json' in jsonDoc)) return jsonDoc

  const raw = jsonDoc.json as RawGltfJson
  const rejected = prevalidate(raw)
  if (rejected) return rejected

  const io = new NodeIO().setLogger(SILENT_LOGGER)
  let document: Document
  try {
    document = await io.readJSON(jsonDoc)
  } catch (error) {
    return fail('parse_failed', `glTF document could not be read: ${boundedReason(error instanceof Error ? error.message : error)}`)
  }

  const warnings: string[] = []
  const warn = (message: string) => {
    if (warnings.length < MAX_WARNINGS) warnings.push(boundedReason(message))
  }

  const root = document.getRoot()
  const stash = readStash(root.getExtras())
  if (root.getExtras()[SCENE_GRAPH_EXTRAS_KEY] !== undefined && !stash) {
    warn('ignored a scene-graph extras payload that failed contract validation')
  }

  const gltfNodes = root.listNodes()
  const gltfMeshes = root.listMeshes()
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : []

  const parentOf = new Map<GltfNode, GltfNode>()
  for (const node of gltfNodes) {
    for (const child of node.listChildren()) parentOf.set(child, node)
  }

  const nodeIds = new Map<GltfNode, string>()
  gltfNodes.forEach((node, index) => {
    const extras = node.getExtras()[SCENE_GRAPH_EXTRAS_KEY]
    const stashedId = extras && typeof extras === 'object' ? asIdentifier((extras as Record<string, unknown>).id) : undefined
    nodeIds.set(node, stashedId ?? `node:${index}`)
  })
  const seenIds = new Set<string>()
  for (const [node, id] of nodeIds) {
    if (seenIds.has(id)) {
      const fallback = `node:${gltfNodes.indexOf(node)}`
      warn(`duplicate stashed node id ${id} replaced with ${fallback}`)
      nodeIds.set(node, fallback)
      seenIds.add(fallback)
    } else {
      seenIds.add(id)
    }
  }

  const synthesizedRefs = new Map<number, string>()
  const synthesizedResources: ArtifactRefV1[] = []
  if (!stash) {
    const referenced = new Set<number>()
    for (const node of gltfNodes) {
      const mesh = node.getMesh()
      if (mesh) referenced.add(gltfMeshes.indexOf(mesh))
    }
    for (const meshIndex of [...referenced].sort((a, b) => a - b)) {
      const ref = `resource:mesh:${meshIndex}`
      synthesizedRefs.set(meshIndex, ref)
      synthesizedResources.push({
        schema: PANE_ARTIFACT_SCHEMA,
        owner: 'gltf-import',
        kind: 'mesh',
        ref,
        version: '1',
        mediaType: 'model/gltf-binary',
        title: safeLabel(gltfMeshes[meshIndex]?.getName(), `Mesh ${meshIndex}`),
        evidenceRefs: [],
        capabilities: ['read'],
      })
    }
  }

  const nodes = gltfNodes.map((node, index) => {
    const id = nodeIds.get(node) ?? `node:${index}`
    const extrasValue = node.getExtras()[SCENE_GRAPH_EXTRAS_KEY]
    const extras = extrasValue && typeof extrasValue === 'object' ? (extrasValue as Record<string, unknown>) : undefined
    const rawNode = rawNodes[index]
    if (rawNode && 'matrix' in rawNode) warn(`node ${id} matrix transform decomposed to TRS`)
    const mesh = node.getMesh()
    const resourceRef = asOpaqueRef(extras?.resourceRef) ?? (mesh ? synthesizedRefs.get(gltfMeshes.indexOf(mesh)) : undefined)
    const canvasNodeRef = asOpaqueRef(extras?.canvasNodeRef)
    return {
      id,
      label: safeLabel(node.getName(), `Node ${index}`),
      kind: detectKind(node, rawNode, extras?.kind),
      ...(parentOf.has(node) ? { parentId: nodeIds.get(parentOf.get(node)!) } : {}),
      transform: {
        translate: finiteVec(node.getTranslation(), 3, [0, 0, 0], id, 'translate', warn) as [number, number, number],
        rotate: finiteVec(node.getRotation(), 4, [0, 0, 0, 1], id, 'rotate', warn) as [number, number, number, number],
        scale: finiteVec(node.getScale(), 3, [1, 1, 1], id, 'scale', warn) as [number, number, number],
      },
      visible: typeof extras?.visible === 'boolean' ? extras.visible : true,
      ...(resourceRef ? { resourceRef } : {}),
      ...(canvasNodeRef ? { canvasNodeRef } : {}),
    }
  })

  const defaultScene = root.getDefaultScene()
  const gltfScenes = root.listScenes()
  const scenes = gltfScenes.map((scene, index) => {
    const extrasValue = scene.getExtras()[SCENE_GRAPH_EXTRAS_KEY]
    const stashedId = extrasValue && typeof extrasValue === 'object' ? asIdentifier((extrasValue as Record<string, unknown>).id) : undefined
    const roots = scene.listChildren().map(child => nodeIds.get(child) ?? 'node:0')
    if (roots.length > MAX_SCENE_ROOTS) warn(`scene ${stashedId ?? `scene:${index}`} roots truncated at ${MAX_SCENE_ROOTS}`)
    return {
      id: stashedId ?? `scene:${index}`,
      label: safeLabel(scene.getName(), `Scene ${index}`),
      rootNodeIds: roots.slice(0, MAX_SCENE_ROOTS),
      ...(defaultScene === scene ? { default: true } : {}),
    }
  })
  if (scenes.length === 0) warn('asset declares no scenes')

  const nativeUsed = Array.isArray(raw.extensionsUsed) ? (raw.extensionsUsed as string[]) : []
  const nativeRequired = Array.isArray(raw.extensionsRequired) ? (raw.extensionsRequired as string[]) : []
  const usedNames = [...new Set([...(stash?.extensions.used ?? []), ...nativeUsed])]
  const requiredNames = [...new Set([...(stash?.extensions.required ?? []), ...nativeRequired])]
  for (const name of requiredNames) {
    if (!usedNames.includes(name)) usedNames.push(name)
  }
  if (usedNames.length > 0) warn(`${usedNames.length} extension(s) declared; payloads are not parsed — see capabilityReport`)

  if ((raw.cameras?.length ?? 0) > 0) warn('camera parameters are not part of the v1 projection')
  if ((raw.animations?.length ?? 0) > 0) warn('animations are not projected in v1 and will not appear in snapshots')
  if ((raw.skins?.length ?? 0) > 0) warn('skins are not projected in v1')

  let capabilityReport
  try {
    capabilityReport = evaluateGltfCapabilityReport(usedNames, requiredNames)
  } catch (error) {
    return fail('invalid_extension', error instanceof Error ? error.message : String(error))
  }

  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
  const candidate = {
    schema: SCENE_3D_SCHEMA,
    scope: options.scope ?? DEFAULT_SCOPE,
    id: options.documentId ?? `scene-graph:sha256:${digest}`,
    version: options.version ?? 0,
    scenes,
    nodes,
    resources: stash ? stash.resources : synthesizedResources,
    extensions: { used: usedNames, required: requiredNames },
    capabilityReport,
  }
  const parsed = SceneDocumentSchema.safeParse(candidate)
  if (!parsed.success) {
    const detail = parsed.error.issues.slice(0, 3).map(issue => issue.message).join('; ')
    return fail('invalid_document', `projection failed contract validation: ${detail}`)
  }

  const result: SceneDocumentV1 = parsed.data
  return { ok: true, document: result, capabilityReport: result.capabilityReport, warnings }
}

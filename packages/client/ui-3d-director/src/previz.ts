import type {
  CanvasBindingV1,
  SceneDocumentV1,
  ShotV1,
} from '@yeisme/dsh-pane-protocol'

/**
 * Shot-scoped previsualization view model (Group 3.1: shot navigation and
 * canvas/viewport selection convergence).
 *
 * Everything here is a pure derivation over the frozen pane-protocol
 * contracts: keyframe sampling, display-only preview documents and the
 * binding-driven selection convergence. Previews never flow back into the
 * controller draft or the save path — the surface renders the derived
 * document, the owner truth stays untouched. Step sampling only (latest
 * keyframe at or before the playhead wins); interpolation is a later seam.
 */

/** Per-object preview override produced by keyframe sampling. */
export interface ShotObjectPreview {
  readonly translate?: [number, number, number]
  readonly rotate?: [number, number, number, number]
  readonly scale?: [number, number, number]
  readonly visible?: boolean
}

type ShotKeyframe = ShotV1['keyframes'][number]

function isVec3(value: ShotKeyframe['value']): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3
}

function isVec4(value: ShotKeyframe['value']): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4
}

/**
 * Sample a shot at a playhead frame. For each (objectRef, property) pair the
 * latest keyframe at or before the frame wins; `shot.visibility` supplies the
 * baseline visibility that earlier frames fall back to. The playhead is
 * clamped into the shot frame range.
 */
export function sampleShotAtFrame(shot: ShotV1, frame: number): ReadonlyMap<string, ShotObjectPreview> {
  const clamped = Math.min(Math.max(frame, shot.frameRange.start), shot.frameRange.end)
  const overrides = new Map<string, { translate?: [number, number, number]; rotate?: [number, number, number, number]; scale?: [number, number, number]; visible?: boolean }>()
  const touch = (objectRef: string): { translate?: [number, number, number]; rotate?: [number, number, number, number]; scale?: [number, number, number]; visible?: boolean } => {
    const existing = overrides.get(objectRef)
    if (existing !== undefined) return existing
    const created: { translate?: [number, number, number]; rotate?: [number, number, number, number]; scale?: [number, number, number]; visible?: boolean } = {}
    overrides.set(objectRef, created)
    return created
  }
  for (const entry of shot.visibility) {
    touch(entry.objectRef).visible = entry.visible
  }
  const keyframes = [...shot.keyframes].sort((left, right) => left.frame - right.frame || left.id.localeCompare(right.id))
  for (const keyframe of keyframes) {
    if (keyframe.frame > clamped) break
    const target = touch(keyframe.objectRef)
    if (keyframe.property === 'visibility' && typeof keyframe.value === 'boolean') {
      target.visible = keyframe.value
    } else if (keyframe.property === 'translate' && isVec3(keyframe.value)) {
      target.translate = keyframe.value
    } else if (keyframe.property === 'rotate' && isVec4(keyframe.value)) {
      target.rotate = keyframe.value
    } else if (keyframe.property === 'scale' && isVec3(keyframe.value)) {
      target.scale = keyframe.value
    }
  }
  return overrides
}

/**
 * Display-only preview document for a shot at a frame: nodes whose
 * `resourceRef` is sampled by the shot receive the sampled transform and
 * visibility. Returns the original document identity when nothing changes so
 * downstream memoization stays stable; the draft/save path never sees this.
 */
export function buildShotPreviewDocument(
  document: SceneDocumentV1,
  shot: ShotV1 | undefined,
  frame: number,
): SceneDocumentV1 {
  if (shot === undefined) return document
  const overrides = sampleShotAtFrame(shot, frame)
  if (overrides.size === 0) return document
  let changed = false
  const nodes = document.nodes.map(node => {
    const override = node.resourceRef === undefined ? undefined : overrides.get(node.resourceRef)
    if (override === undefined) return node
    const translate = override.translate ?? node.transform.translate
    const rotate = override.rotate ?? node.transform.rotate
    const scale = override.scale ?? node.transform.scale
    const visible = override.visible ?? node.visible
    if (
      visible === node.visible
      && translate.every((value, index) => value === node.transform.translate[index])
      && rotate.every((value, index) => value === node.transform.rotate[index])
      && scale.every((value, index) => value === node.transform.scale[index])
    ) {
      return node
    }
    changed = true
    return { ...node, visible, transform: { translate, rotate, scale } }
  })
  return changed ? { ...document, nodes } : document
}

/** Scene node ids a shot frames: sampled objects plus its camera (resourceRef match). */
export function resolveShotPreviewNodeIds(document: SceneDocumentV1, shot: ShotV1 | undefined): ReadonlySet<string> {
  if (shot === undefined) return new Set<string>()
  const refs = new Set<string>([shot.cameraRef, ...shot.objectRefs, ...shot.visibility.map(entry => entry.objectRef)])
  return new Set(document.nodes.filter(node => node.resourceRef !== undefined && refs.has(node.resourceRef)).map(node => node.id))
}

/** The scene node standing in for the shot camera, when the scene graph carries it. */
export function resolveShotCameraNodeId(document: SceneDocumentV1, shot: ShotV1 | undefined): string | undefined {
  if (shot === undefined) return undefined
  return document.nodes.find(node => node.resourceRef === shot.cameraRef)?.id
}

/**
 * Binding-driven selection convergence. A `CanvasBinding.sceneObjectRef`
 * matches a scene node through its opaque `resourceRef`; picking either side
 * highlights the other without switching the user's explicit selection.
 */
export interface Scene3DSelectionConvergence {
  /** Scene node id → bound shot refs (deduplicated, declaration order). */
  readonly nodeToShots: ReadonlyMap<string, readonly string[]>
  /** Shot ref → bound scene node ids (deduplicated, declaration order). */
  readonly shotToNodes: ReadonlyMap<string, readonly string[]>
}

export function buildScene3DSelectionConvergence(
  document: SceneDocumentV1,
  bindings: readonly CanvasBindingV1[],
): Scene3DSelectionConvergence {
  const nodeByResourceRef = new Map<string, string>()
  for (const node of document.nodes) {
    if (node.resourceRef !== undefined && !nodeByResourceRef.has(node.resourceRef)) nodeByResourceRef.set(node.resourceRef, node.id)
  }
  const nodeToShots = new Map<string, string[]>()
  const shotToNodes = new Map<string, string[]>()
  for (const binding of bindings) {
    const nodeId = nodeByResourceRef.get(binding.sceneObjectRef)
    if (nodeId === undefined) continue
    const shots = nodeToShots.get(nodeId) ?? []
    if (!shots.includes(binding.shotRef)) shots.push(binding.shotRef)
    nodeToShots.set(nodeId, shots)
    const nodes = shotToNodes.get(binding.shotRef) ?? []
    if (!nodes.includes(nodeId)) nodes.push(nodeId)
    shotToNodes.set(binding.shotRef, nodes)
  }
  return { nodeToShots, shotToNodes }
}

/** One row in the Shot navigator. */
export interface ShotNavItemV1 {
  readonly shotRef: string
  readonly keyframeCount: number
  readonly frameRange: ShotV1['frameRange']
  readonly deliveryStatus: ShotV1['deliveryProjection']['status']
  readonly deliverySummary?: string
  /** The shot the surface currently previews. */
  readonly selected: boolean
  /** Converged with the currently selected scene node through a canvas binding. */
  readonly bound: boolean
}

export function buildShotNavItems(
  shots: readonly ShotV1[],
  selectedShotRef: string | undefined,
  selectedNodeId: string | undefined,
  convergence: Scene3DSelectionConvergence,
): readonly ShotNavItemV1[] {
  const boundShots = selectedNodeId === undefined ? undefined : convergence.nodeToShots.get(selectedNodeId)
  return shots.map(shot => ({
    shotRef: shot.shotRef,
    keyframeCount: shot.keyframes.length,
    frameRange: shot.frameRange,
    deliveryStatus: shot.deliveryProjection.status,
    ...(shot.deliveryProjection.summary === undefined ? {} : { deliverySummary: shot.deliveryProjection.summary }),
    selected: shot.shotRef === selectedShotRef,
    bound: boundShots?.includes(shot.shotRef) ?? false,
  }))
}

/**
 * CanvasBinding lookup helpers for the pipeline ⇄ 3D Director selection sync
 * (dsh-creative-pipeline-visual-workbench-v1 priority 6; consumes
 * dsh-3d-director-gltf-workbench-v1 Wave C/D1).
 *
 * The canvas stays the single selection truth: viewport picks are routed back
 * through the existing canvas selection path, and nodes without a binding sync
 * silently in neither direction. The `scene3dDirector` remote probe itself
 * lives in `workbench-pane.ts` (`probePipelineScene3DRemote`).
 */

import type { CanvasBindingV1 } from '@yeisme/dsh-pane-protocol'

/**
 * Binding lookup for a canvas selection. `nodeRef` matches either the canvas
 * node id or the node's domain ref, so owner projections may key bindings on
 * either identity. No binding → undefined (the sync stays silent).
 */
export function findScene3DBindingForCanvasNode(
  bindings: readonly CanvasBindingV1[],
  nodeId: string,
  nodeRef: string | undefined,
): CanvasBindingV1 | undefined {
  return bindings.find(binding => binding.nodeRef === nodeId || (nodeRef !== undefined && binding.nodeRef === nodeRef))
}

/** Reverse lookup: a picked scene object → its canvas binding (by scene node id or resourceRef). */
export function findScene3DBindingForSceneObject(
  bindings: readonly CanvasBindingV1[],
  sceneNodeId: string,
  resourceRef: string | undefined,
): CanvasBindingV1 | undefined {
  return bindings.find(binding => binding.sceneObjectRef === sceneNodeId || (resourceRef !== undefined && binding.sceneObjectRef === resourceRef))
}

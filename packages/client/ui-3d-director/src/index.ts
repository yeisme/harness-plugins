/**
 * @yeisme/dsh-client-ui-3d-director — client face of the 3D Director
 * workbench (dsh-3d-director-gltf-workbench-v1, Group 3).
 *
 * Consumes the `scene3dDirector` host remote through a capability probe and
 * renders a Shot-anchored 3D viewport + timeline on the shared Surface
 * chrome. The controller owns local drafts and the revision protocol:
 * conflict → read-only freeze + owner reconcile, unknown → reconcileScene,
 * transport loss → degrade without polling. GLB bytes never cross this
 * package (import resolves through the host byte source; export bytes leave
 * through the onExportBytes callback only).
 *
 * @module @yeisme/dsh-client-ui-3d-director
 */

export { SCENE_3D_DIRECTOR_REMOTE_KEY, hasScene3DChangeSetControls, isScene3DDirectorRemote } from './remote.js'
export type {
  Scene3DChangeSetAcceptRequest,
  Scene3DChangeSetControlRequest,
  Scene3DDirectorRemote,
  Scene3DImportGlbRequest,
  Scene3DReconcileRequest,
} from './remote.js'

export { probeScene3DDirector, SCENE_3D_PROBE_REASONS } from './probe.js'
export type { Scene3DContextReader } from './probe.js'

export { Scene3DController } from './scene3d-controller.js'
export type {
  Scene3DChangeSetActionOutcome,
  Scene3DChangeSetPreviewResult,
  Scene3DConflictState,
  Scene3DControllerOptions,
  Scene3DExportState,
  Scene3DImportOutcome,
  Scene3DLoadStatus,
  Scene3DNodeTransformPatch,
  Scene3DSaveStatus,
  Scene3DShotKeyframeEdit,
  Scene3DViewState,
} from './scene3d-controller.js'

export { NodeTransformEditor, SCENE_3D_TRANSFORM_COMPONENT_LIMIT } from './NodeTransformEditor.js'
export type { NodeTransformEditorProps } from './NodeTransformEditor.js'

export { ChangeSetPanel } from './ChangeSetPanel.js'
export type { ChangeSetPanelProps } from './ChangeSetPanel.js'

export {
  scene3DExportAvailability,
  scene3DSaveTone,
  scene3DSurfacePhase,
  SCENE_3D_SAVE_LABELS,
} from './view-model.js'

export { Director3DViewport, prefersReducedMotion, SceneTreeFallback } from './Director3DViewport.js'
export type { Director3DViewportProps } from './Director3DViewport.js'

export { createThreeViewportEngine } from './three-engine.js'
export type {
  CreateViewport3DEngine,
  CreateViewport3DEngineInput,
  Viewport3DEngine,
} from './three-engine.js'

export { ShotTimeline } from './ShotTimeline.js'
export type { ShotTimelineProps } from './ShotTimeline.js'

export {
  buildScene3DSelectionConvergence,
  buildShotNavItems,
  buildShotPreviewDocument,
  resolveShotCameraNodeId,
  resolveShotPreviewNodeIds,
  sampleShotAtFrame,
} from './previz.js'
export type {
  Scene3DSelectionConvergence,
  ShotNavItemV1,
  ShotObjectPreview,
} from './previz.js'

export { ShotNavigator } from './ShotNavigator.js'
export type { ShotNavigatorProps } from './ShotNavigator.js'

export { Director3DSurface } from './Director3DSurface.js'
export type { Director3DSurfaceProps } from './Director3DSurface.js'

export { director3DStyles, DIRECTOR_3D_SCOPE } from './styles.js'

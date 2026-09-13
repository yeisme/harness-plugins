import type {
  ArtifactRefV1,
  SceneGraphReadRequest,
  SceneGraphSaveRequest,
  SceneWorkbenchSaveRequest,
} from '@yeisme/dsh-pane-protocol'

/**
 * Wire namespace of the host SceneGraphGateway
 * (`@yeisme/dsh-3d-director-host` SCENE_3D_DIRECTOR_SERVICE_KEY). The client
 * probes this key and degrades honestly when it is absent.
 */
export const SCENE_3D_DIRECTOR_REMOTE_KEY = 'scene3dDirector' as const

/** Reconcile request: read selector plus the id of the save intent to settle. */
export type Scene3DReconcileRequest = SceneGraphReadRequest & { readonly requestId: string }

/** GLB import request; bytes are resolved by the host-side byte source, never by the client. */
export interface Scene3DImportGlbRequest {
  readonly scope: SceneGraphReadRequest['scope']
  readonly sourceRef: string
  readonly documentId?: string
}

/** Change-set control selector: the scene read target plus the audited change-set ref. */
export interface Scene3DChangeSetControlRequest {
  readonly scope: SceneGraphReadRequest['scope']
  readonly documentId: string
  readonly changeSetRef: string
}

/** Accept commits the current workbench draft as the change set's resulting revision. */
export interface Scene3DChangeSetAcceptRequest extends Scene3DChangeSetControlRequest {
  readonly requestId: string
  readonly document: SceneGraphSaveRequest['document']
  readonly artifactRef: ArtifactRefV1
}

/**
 * Client face of the `scene3dDirector` host remote. Results cross as unknown
 * and are fail-closed parsed by the controller against pane-protocol schemas.
 * The change-set control methods are optional: hosts predating the control
 * seam probe without them and the panel disables its controls with the reason
 * instead of rendering dead buttons.
 */
export interface Scene3DDirectorRemote {
  sceneWorkbenchRead?(input: SceneGraphReadRequest): Promise<unknown>
  saveSceneWorkbench?(input: SceneWorkbenchSaveRequest): Promise<unknown>
  sceneRead(input: SceneGraphReadRequest): Promise<unknown>
  saveScene(input: SceneGraphSaveRequest): Promise<unknown>
  reconcileScene(input: Scene3DReconcileRequest): Promise<unknown>
  importGlb(input: Scene3DImportGlbRequest): Promise<unknown>
  exportGlb(input: SceneGraphReadRequest): Promise<unknown>
  listChangeSets(input: SceneGraphReadRequest): Promise<unknown>
  previewChangeSet?(input: Scene3DChangeSetControlRequest): Promise<unknown>
  acceptChangeSet?(input: Scene3DChangeSetAcceptRequest): Promise<unknown>
  rejectChangeSet?(input: Scene3DChangeSetControlRequest & { readonly reason?: string }): Promise<unknown>
  rollbackChangeSet?(input: Scene3DChangeSetControlRequest & { readonly requestId: string }): Promise<unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

/** Structural guard: every method must be a function, nothing is faked. */
export function isScene3DDirectorRemote(value: unknown): value is Scene3DDirectorRemote {
  return isRecord(value)
    && typeof value.sceneRead === 'function'
    && typeof value.saveScene === 'function'
    && typeof value.reconcileScene === 'function'
    && typeof value.importGlb === 'function'
    && typeof value.exportGlb === 'function'
    && typeof value.listChangeSets === 'function'
}

/** Probe-first guard for the change-set review controls; absent methods disable them with a reason. */
export function hasScene3DChangeSetControls(remote: Scene3DDirectorRemote): boolean {
  return typeof remote.previewChangeSet === 'function'
    && typeof remote.acceptChangeSet === 'function'
    && typeof remote.rejectChangeSet === 'function'
    && typeof remote.rollbackChangeSet === 'function'
}

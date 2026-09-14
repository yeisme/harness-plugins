/**
 * Pipeline workbench pane registration + view (dsh-creative-pipeline-visual-workbench-v1, D6).
 *
 * Probe-first: the pane registers whenever the Pane Workbench face exists, but
 * the view renders a disabled SurfaceState with a bounded reason until a
 * pipeline owner projection source probes (real `remote.creativePipeline`
 * owner, or an explicitly provided fixture owner under
 * `creativePipelineFixture` for the fixture evidence tier). No dead buttons:
 * the disabled surface carries no actions.
 *
 * Remounts restore observer identity only: a fresh controller re-reads the
 * owner projection; nothing replays commands.
 */

import { useEffect, useState, useSyncExternalStore, type DragEvent, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { ArtifactRefV1 } from '@yeisme/dsh-pane-protocol'
import {
  Director3DViewport,
  director3DStyles,
  NodeTransformEditor,
  probeScene3DDirector,
  scene3DSaveTone,
  SCENE_3D_SAVE_LABELS,
  type Scene3DController,
  type Scene3DDirectorRemote,
  type Scene3DViewState,
} from '@yeisme/dsh-client-ui-3d-director'
import { PipelineInspector } from './inspector.js'
import { PipelineWorkbenchShell } from './workbench-shell.js'
import type { PipelinePaneLinkBusV1 } from './pane-link-bus.js'
import type { PipelineWorkbenchSection } from './types.js'
import { handlePipelineMediaDrop } from './media-drag.js'
import type { PipelineMediaEntry, PipelineMediaResolveFn } from './media.js'
import {
  PipelineWorkbenchController,
  type PipelineConfirmationStoreV1,
  type PipelineWorkbenchOwnerFaceV1,
  type PipelineWorkbenchRunActionRequestV1,
  type PipelineWorkbenchViewStateV1,
} from './workbench-controller.js'
import { PIPELINE_FIXTURE_OWNER_SERVICE } from './fixture-owner.js'

export const PIPELINE_WORKBENCH_PANE_KIND = 'creator.pipeline'
export const PIPELINE_WORKBENCH_COMPONENT_KEY = 'drama.pipeline.workbench'
export const PIPELINE_WORKBENCH_UNAVAILABLE_REASON = 'missing creative-pipeline owner projection'

export interface PipelineWorkbenchViewDescriptorSpec {
  readonly kind: string
  readonly label: string
  readonly componentKey: string
  readonly role: 'content'
  readonly preferredRegion: 'right'
  readonly retention: 'keep-alive'
  readonly singleton: true
  readonly presentation: {
    readonly icon: string
    readonly group: string
    readonly description: string
    readonly order: number
    readonly launcher: true
  }
}

export function pipelineWorkbenchViewDescriptor(): PipelineWorkbenchViewDescriptorSpec {
  return {
    kind: PIPELINE_WORKBENCH_PANE_KIND,
    label: 'Pipeline Workbench',
    componentKey: PIPELINE_WORKBENCH_COMPONENT_KEY,
    role: 'content',
    preferredRegion: 'right',
    retention: 'keep-alive',
    singleton: true,
    presentation: {
      icon: 'workflow',
      group: 'drama',
      description: 'Creative pipeline visual workbench (canvas, capsule, inspector)',
      order: 70,
      launcher: true,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isPipelineWorkbenchOwner(value: unknown): value is PipelineWorkbenchOwnerFaceV1 {
  return isRecord(value) && typeof value.snapshot === 'function'
}

interface ContextReader {
  get(key: string): unknown
}

function readContextService<T>(ctx: ContextReader, name: string): T | undefined {
  try {
    return ctx.get(name) as T | undefined
  } catch {
    return undefined
  }
}

/**
 * Owner probe: the real `remote.creativePipeline` host transport first
 * (snapshot/canvasRead mapped onto the owner face, canvasSave/canvasReconcile
 * stay honest-unavailable — the single canvas writer remains the host-side
 * Creator Studio gateway), then the explicitly named fixture service (fixture
 * evidence tier). Missing both → the pane renders disabled.
 *
 * Namespace member reads are guarded: on the real client runtime the typed
 * remote guards a namespace property access behind the caller's service
 * inject, and a missing/unauthorized member must degrade to `undefined`
 * (probe-only), never throw out of a mount cycle.
 */
export function probePipelineWorkbenchOwner(ctx: ContextReader): PipelineWorkbenchOwnerFaceV1 | undefined {
  const remote = readContextService<unknown>(ctx, 'remote')
  const owner = readRemoteMember(remote, 'creativePipeline')
  const creator = readRemoteMember(remote, 'creatorStudio') ?? readContextService<Record<string, unknown>>(ctx, 'remote.creatorStudio')
  const remoteFace = isRecord(owner) ? creativePipelineRemoteOwnerFace(owner, isRecord(creator) ? creator : undefined) : undefined
  if (remoteFace !== undefined) return remoteFace
  const direct = readContextService<unknown>(ctx, 'remote.creativePipeline')
  const directFace = isRecord(direct) ? creativePipelineRemoteOwnerFace(direct, isRecord(creator) ? creator : undefined) : undefined
  if (directFace !== undefined) return directFace
  const fixture = readContextService<unknown>(ctx, PIPELINE_FIXTURE_OWNER_SERVICE)
  if (isPipelineWorkbenchOwner(fixture)) return fixture
  return undefined
}

/** Reads one namespace member off the resolved `remote` service; guards throw to undefined. */
function readRemoteMember(remote: unknown, member: string): unknown {
  if (!isRecord(remote)) return undefined
  try {
    return (remote as Record<string, unknown>)[member]
  } catch {
    return undefined
  }
}

/**
 * Maps the host `creativePipeline` remote (CreativePipelineGateway wire face)
 * onto the workbench owner face. Only functions that actually probe are
 * mapped; observation hooks (subscribe/onUnavailable/onAvailable) pass
 * through when the transport offers them. The canvas remote is read-only:
 * the Creator Studio seam is used when available; otherwise saves and
 * reconciles degrade to `unavailable`. No second writer is created.
 *
 * The real typert transport wraps every method result in a `RemoteResult`
 * (`{ ok: true, value } | { ok: false, error }`); the mapping unwraps the
 * payload here so the controller keeps decoding plain projections. A failed
 * transport call maps to the gateway's data-less failure envelope (honest
 * `unavailable` degradation), never a fabricated projection.
 */
export function creativePipelineRemoteOwnerFace(remote: Record<string, unknown>, creator?: Record<string, unknown>): PipelineWorkbenchOwnerFaceV1 | undefined {
  if (typeof remote.snapshot !== 'function') return undefined
  const snapshot = remote.snapshot as () => Promise<unknown>
  const face: {
    -readonly [K in keyof PipelineWorkbenchOwnerFaceV1]?: PipelineWorkbenchOwnerFaceV1[K]
  } & { snapshot: () => Promise<unknown> } = {
    snapshot: async () => unwrapSnapshot(await snapshot.call(remote)),
  }
  if (typeof remote.canvasRead === 'function') {
    const canvasRead = remote.canvasRead as (input: never) => Promise<unknown>
    face.canvasRemote = {
      canvasRead: async input => unwrapPayload(await canvasRead.call(remote, input as never), { status: 'unavailable' }),
      // The single canvas writer stays host-side; this face never writes.
      canvasSave: async () => ({ status: 'unavailable' }),
      canvasReconcile: async () => ({ status: 'unavailable' }),
    }
  }
  // The existing Creator Studio service remains the sole canvas writer.
  // Use its read path too, so both surfaces observe the same CAS document.
  if (creator && ['canvasRead', 'canvasSave', 'canvasReconcile'].every(key => typeof creator[key] === 'function')) {
    const writer = creator as unknown as NonNullable<PipelineWorkbenchOwnerFaceV1['canvasRemote']>
    face.canvasRemote = {
      canvasRead: async input => unwrapPayload(await writer.canvasRead.call(creator, input), { status: 'unavailable' }),
      canvasSave: async input => unwrapPayload(await writer.canvasSave.call(creator, input), { status: 'unavailable' }),
      canvasReconcile: async input => unwrapPayload(await writer.canvasReconcile.call(creator, input), { status: 'unavailable' }),
    }
  }
  if (typeof remote.dispatchRunAction === 'function') {
    const dispatch = remote.dispatchRunAction as (input: PipelineWorkbenchRunActionRequestV1) => Promise<unknown>
    face.dispatchRunAction = async input => unwrapPayload(await dispatch.call(remote, input), undefined)
  }
  if (typeof remote.resolveMedia === 'function') {
    const resolve = remote.resolveMedia as PipelineMediaResolveFn
    face.resolveMedia = async entry => unwrapPayload(await resolve.call(remote, entry), undefined)
  }
  for (const key of ['subscribe', 'onUnavailable', 'onAvailable'] as const) {
    if (typeof remote[key] === 'function') {
      const hook = remote[key] as (listener: () => void) => () => void
      face[key] = listener => hook.call(remote, listener)
    }
  }
  return face as PipelineWorkbenchOwnerFaceV1
}

/**
 * Unwraps one typert `RemoteResult`. A transport failure without a payload
 * degrades to the data-less snapshot failure envelope; an unwrapped (test or
 * fixture) result passes through unchanged so the existing evidence tiers
 * keep their plain-projection shape.
 */
function unwrapSnapshot(result: unknown): unknown {
  if (isRemoteResult(result)) {
    if (result.ok) return result.value
    warnTransportFailure('creativePipeline.snapshot', result)
    return { schema: 'dsh.creative-pipeline-workbench-snapshot.v1alpha1', status: 'unavailable', reasonCode: 'remote_transport', safeMessage: 'The pipeline owner projection transport failed; nothing was fabricated.' }
  }
  return result
}

/**
 * Bounded transport diagnostic: surfaces the owner's failure CODE (never the
 * payload) on the console so an honest degradation is observable; the surface
 * state stays the single source of truth.
 */
function warnTransportFailure(endpoint: string, result: { readonly ok: boolean; readonly error?: unknown }): void {
  const code = isRecord(result.error) && typeof result.error.code === 'string' ? result.error.code : 'unknown'
  try {
    console.warn(`[pipeline-pane] ${endpoint} transport failure: ${code.slice(0, 80)}`)
  } catch { /* console may be absent */ }
}

/** Unwraps one typert `RemoteResult` with a caller-chosen failure fallback. */
function unwrapPayload<T>(result: unknown, failure: T): T {
  if (isRemoteResult(result)) return result.ok ? result.value as T : failure
  return result as T
}

function isRemoteResult(value: unknown): value is { readonly ok: boolean; readonly value?: unknown } {
  return isRecord(value) && typeof value.ok === 'boolean'
}

/**
 * Probes the host `scene3dDirector` remote for the embedded Shot-anchored 3D
 * viewport (priority 6). A missing/shape-mismatched seam returns undefined —
 * the Inspector 3D entry renders disabled with the probe reason, never a dead
 * button.
 *
 * The probed capability is wrapped in a transport adapter: the real typert
 * namespace wraps every method result in a `RemoteResult`, while the
 * Scene3DController decodes plain payloads fail-closed. A transport failure
 * unwraps to `undefined` → the controller's own invalid/error degradation;
 * plain (fixture) remotes pass through unchanged.
 */
export function probePipelineScene3DRemote(ctx: ContextReader): Scene3DDirectorRemote | undefined {
  const probe = probeScene3DDirector(ctx)
  return probe.status === 'available' ? wrapScene3DTransport(probe.capability) : undefined
}

/** Unwraps typert `RemoteResult` envelopes around every scene3d remote method. */
function wrapScene3DTransport(remote: Scene3DDirectorRemote): Scene3DDirectorRemote {
  const unwrap = async (call: () => Promise<unknown>, endpoint: string): Promise<unknown> => {
    let result: unknown
    try {
      result = await call()
    } catch (error) {
      // Carrier/assembly faults surface the bounded message so the honest
      // degradation is observable; the caller's fail-closed path still owns it.
      try {
        console.warn(`[pipeline-pane] ${endpoint} transport threw: ${String(error).slice(0, 160)}`)
      } catch { /* console may be absent */ }
      throw error
    }
    if (isRemoteResult(result)) {
      if (result.ok) return result.value
      warnTransportFailure(endpoint, result)
      return undefined
    }
    return result
  }
  const wrapped: Record<string, unknown> = {}
  for (const key of ['sceneWorkbenchRead', 'saveSceneWorkbench', 'sceneRead', 'saveScene', 'reconcileScene', 'importGlb', 'exportGlb', 'listChangeSets', 'previewChangeSet', 'acceptChangeSet', 'rejectChangeSet', 'rollbackChangeSet'] as const) {
    const method = remote[key]
    if (typeof method !== 'function') continue
    wrapped[key] = async (...args: unknown[]) => unwrap(() => (method as (...input: unknown[]) => Promise<unknown>).apply(remote, args), `scene3dDirector.${key}`)
  }
  return wrapped as unknown as Scene3DDirectorRemote
}

export interface PipelineWorkbenchViewDeps {
  readonly owner?: PipelineWorkbenchOwnerFaceV1
  readonly disabledReason?: string
  readonly newId?: () => string
  /** Preview/confirm record store (R6); injectable for evidence tiers, in-memory by default. */
  readonly confirmations?: PipelineConfirmationStoreV1
  /** Probed `scene3dDirector` remote; absent → the 3D viewport entry stays disabled with a reason. */
  readonly scene3dRemote?: Scene3DDirectorRemote
  /** Pane-link bus for professional-pane handoff/adoption intake + 3D pick emission (task 3.2). */
  readonly paneLinkBus?: PipelinePaneLinkBusV1
}

function artifactMediaEntry(artifact: ArtifactRefV1): PipelineMediaEntry {
  return {
    ref: artifact.ref,
    kind: artifact.kind === 'video' ? 'video' : 'image',
    title: artifact.title,
    version: artifact.version,
    freshness: 'unknown',
    capabilities: ['preview', 'playback'],
  }
}

const SCENE_3D_SECTION_STYLES = `
[data-pipeline-scene3d-section]{display:grid;gap:8px;margin-bottom:12px}
[data-pipeline-scene3d-section] .p3d-row{display:flex;min-width:0;gap:8px;align-items:baseline}
[data-pipeline-scene3d-section] .p3d-key{flex:none;width:72px;color:var(--vk-text-quaternary);font-size:11px}
[data-pipeline-scene3d-section] .p3d-val{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-secondary);font-size:12px}
[data-pipeline-scene3d-section] .p3d-reason{margin:0;color:var(--vk-text-tertiary);font-size:11px}
`

function Scene3DRow({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return <div className="p3d-row"><span className="p3d-key">{label}</span><span className="p3d-val">{value}</span></div>
}

/**
 * Inspector 3D section (priority 6): appears when the canvas selection is a
 * shot node. The open entry is probe-first — without the scene3dDirector seam
 * or an owner scene projection the button is disabled with the bounded reason.
 */
function Scene3DInspectorSection({ state, controller }: { readonly state: PipelineWorkbenchViewStateV1; readonly controller: PipelineWorkbenchController }): ReactNode {
  const shot = state.selectedShot
  if (shot === undefined) return null
  const scene = state.scene3d
  const openable = scene.available
  const label = scene.open ? 'Close 3D viewport' : 'Open 3D viewport'
  return (
    <div data-pipeline-scene3d-section="">
      <style>{SCENE_3D_SECTION_STYLES}</style>
      <SurfaceSection title="3D scene" description="Shot-anchored 3D viewport embedded in this workbench; selection converges canvas ⇄ viewport.">
        <Scene3DRow label="shot" value={shot.shotRef} />
        {shot.sceneObjectRef === undefined ? null : <Scene3DRow label="object" value={shot.sceneObjectRef} />}
        {scene.documentId === undefined ? null : <Scene3DRow label="scene" value={scene.documentId} />}
        {scene.open && scene.saveStatus !== undefined ? <Scene3DRow label="status" value={SCENE_3D_SAVE_LABELS[scene.saveStatus]} /> : null}
        <div>
          <Button
            type="button"
            size="sm"
            variant="toolbar"
            disabled={!openable}
            aria-disabled={!openable}
            title={openable ? label : scene.reason}
            aria-label={openable ? label : `${label}: ${scene.reason ?? 'disabled'}`}
            onClick={() => {
              if (!openable) return
              if (scene.open) controller.closeScene3DViewport()
              else controller.openScene3DViewport()
            }}
          >{label}</Button>
        </div>
        {openable ? null : <p className="p3d-reason" role="status">{scene.reason}</p>}
      </SurfaceSection>
    </div>
  )
}

function Scene3DBody({ state, controller, onSelectNode }: { readonly state: Scene3DViewState; readonly controller: Scene3DController; readonly onSelectNode: (nodeId: string) => void }): ReactNode {
  if (state.status === 'loading') {
    return <SurfaceState phase="loading" title="Loading scene graph" description={`Reading scene ${controller.target.documentId} and its revision from the owner.`} />
  }
  if (state.status === 'missing') {
    return <SurfaceState phase="empty" title="No scene yet" description="The owner has not committed a scene graph for this document."
      action={<Button type="button" size="sm" variant="toolbar" onClick={() => controller.createDraft()}>New scene draft</Button>} />
  }
  if (state.status === 'unavailable' || state.status === 'forbidden') {
    return <SurfaceState phase="disabled" title={state.status === 'forbidden' ? 'Scene access denied' : 'Scene service unavailable'}
      description={state.status === 'forbidden'
        ? 'The owner rejected this context. The viewport stays read-only; contact the project owner.'
        : 'The scene3dDirector host remote is unavailable. Nothing is polled; reopen after the channel returns.'} />
  }
  if (state.status === 'invalid' || state.status === 'error') {
    return <SurfaceState phase="error" title={state.status === 'invalid' ? 'Scene data failed the contract' : 'Scene read failed'}
      description={state.status === 'invalid'
        ? 'The owner response did not pass the scene graph schema, so nothing was rendered.'
        : 'The scene read failed. Reload to try again; no automatic retry runs.'}
      action={state.status === 'error'
        ? <Button type="button" size="sm" variant="toolbar" onClick={() => void controller.load()}>Reload</Button>
        : undefined} />
  }
  const document = state.document
  if (document === undefined) return null
  return <>
    {state.conflict === undefined ? null : <div className="vk-alert" data-tone="warn" role="alert" data-conflict-frozen="">
      <strong>Revision conflict — edits are frozen.</strong>
      <p>{state.conflict.summary}</p>
      <div>
        <Button type="button" size="sm" variant="toolbar" onClick={() => controller.resolveConflict('reapply')}>Reapply my draft onto revision {state.conflict.remoteVersion}</Button>
        {' '}<Button type="button" size="sm" variant="toolbar" onClick={() => controller.resolveConflict('discard')}>Discard my draft</Button>
      </div>
    </div>}
    {state.saveStatus === 'unknown' && state.conflict === undefined ? <div className="vk-alert" data-tone="warn" role="alert">
      <strong>Save outcome unknown.</strong>
      <p>The commit never settled. Use “Reconcile save” to let the owner decide; nothing is retried automatically.</p>
      <div><Button type="button" size="sm" variant="toolbar" onClick={() => void controller.reconcile()}>Reconcile save</Button></div>
    </div> : null}
    {controller.shotSaveUnavailable ? <SurfaceState phase="disabled" title="Keyframe persistence unavailable" description="Connect a compatible host before saving previsualization edits. Your draft remains unsaved." /> : null}
    {state.dirty && !state.frozen ? <div className="d3d-draft-bar" role="status">
      <span>Draft changes are local until saved against revision {document.version}.</span>
      <Button type="button" size="sm" variant="toolbar"
        disabled={state.saveStatus === 'saving' || state.saveStatus === 'unknown' || controller.shotSaveUnavailable}
        title={controller.shotSaveUnavailable ? 'This host cannot persist keyframes; the draft is retained.' : state.saveStatus === 'saving' ? 'A save is already in flight.' : undefined}
        onClick={() => void controller.save()}>Save</Button>
    </div> : null}
    <Director3DViewport
      document={document}
      {...(state.selectedNodeId === undefined ? {} : { selectedNodeId: state.selectedNodeId })}
      onSelect={onSelectNode}
      frozen={state.frozen}
    />
    {(() => {
      const selectedNode = state.selectedNodeId === undefined
        ? undefined
        : document.nodes.find(entry => entry.id === state.selectedNodeId)
      if (selectedNode === undefined) return null
      return <NodeTransformEditor
        node={selectedNode}
        disabled={state.frozen}
        {...(state.frozen ? { disabledReason: 'Writes are frozen until the revision conflict is reconciled.' } : {})}
        onEditTransform={patch => controller.editNodeTransform(selectedNode.id, patch)}
        onSetVisibility={visible => controller.setNodeVisibility(selectedNode.id, visible)}
      />
    })()}
  </>
}

/**
 * Docked 3D viewport region below the pipeline canvas. Subscribes to the scene
 * controller directly so draft edits re-render the viewport; scene status and
 * conflicts degrade honestly instead of blanking the region.
 */
function Scene3DViewportRegion({ controller, onSelectNode, onClose }: { readonly controller: Scene3DController; readonly onSelectNode: (nodeId: string) => void; readonly onClose: () => void }): ReactNode {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  return (
    <>
      <style>{director3DStyles}</style>
      <div className="plw-scene3d-head">
        <span className="plw-scene3d-title">{`3D viewport · ${controller.target.documentId}`}</span>
        <span className="plw-scene3d-status" role="status">
          <span className="vk-dot" data-tone={scene3DSaveTone(state.saveStatus)} aria-hidden="true" />
          {SCENE_3D_SAVE_LABELS[state.saveStatus]}
        </span>
        {state.saveStatus === 'unknown'
          ? <Button type="button" size="sm" variant="toolbar" className="plw-scene3d-reconcile"
              onClick={() => void controller.reconcile()}>Reconcile save</Button>
          : null}
        <Button type="button" size="sm" variant="toolbar" className="plw-scene3d-save"
          disabled={!state.dirty || state.frozen || state.saveStatus === 'saving'}
          title={state.frozen
            ? 'Writes are frozen until the revision conflict is reconciled.'
            : state.dirty ? 'Save the draft against the owner revision.' : 'No unsaved draft changes.'}
          onClick={() => void controller.save()}>Save</Button>
        <Button type="button" size="sm" variant="toolbar" className="plw-scene3d-close" onClick={onClose}>Close</Button>
      </div>
      <div className="plw-scene3d-body" data-3d-director="">
        <Scene3DBody state={state} controller={controller} onSelectNode={onSelectNode} />
      </div>
    </>
  )
}

function InspectorPane({ state, controller }: { readonly state: PipelineWorkbenchViewStateV1; readonly controller: PipelineWorkbenchController }): ReactNode {
  return (
    <div data-pipeline-workbench-inspector="">
      <Scene3DInspectorSection state={state} controller={controller} />
      <ul aria-label="Pipeline edges" className="plw-edge-list">
        {state.edgeItems.map(edge => (
          <li key={edge.id}>
            <button
              type="button"
              className="vk-btn"
              aria-pressed={edge.selected}
              onClick={() => controller.selectEdge(edge.selected ? undefined : edge.id)}
            >
              {`${edge.label} · ${edge.kind}`}
            </button>
          </li>
        ))}
      </ul>
      <PipelineInspector model={state.inspector} onAction={(action, runRef) => void controller.runAction(action, runRef)} />
    </div>
  )
}

/** Builds the registered view component. Deps are fixed for the component's lifetime. */
export function createPipelineWorkbenchView(deps: PipelineWorkbenchViewDeps): () => ReactNode {
  if (deps.owner === undefined) {
    const reason = deps.disabledReason ?? PIPELINE_WORKBENCH_UNAVAILABLE_REASON
    return function PipelineWorkbenchDisabled(): ReactNode {
      return (
        <Surface kind="workspace" data-pipeline-workbench-pane="disabled" aria-label="Pipeline Workbench">
          <SurfaceState phase="disabled" title="Pipeline workbench unavailable" description={reason} />
        </Surface>
      )
    }
  }
  const owner = deps.owner
  return function PipelineWorkbenchPane(): ReactNode {
    // One controller per mount: reopening restores the observer identity
    // (fresh projection read) and never replays commands.
    const [controller] = useState(() => new PipelineWorkbenchController({
      owner,
      ...(deps.newId === undefined ? {} : { newId: deps.newId }),
      ...(deps.confirmations === undefined ? {} : { confirmations: deps.confirmations }),
      ...(deps.scene3dRemote === undefined ? {} : { scene3dRemote: deps.scene3dRemote }),
      ...(deps.paneLinkBus === undefined ? {} : { paneLinkBus: deps.paneLinkBus }),
    }))
    useEffect(() => {
      void controller.load()
      return () => controller.dispose()
    }, [controller])
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
    const [section, setSection] = useState<PipelineWorkbenchSection>('workflow')

    const onCanvasDropIntent = (event: DragEvent, toFlowPosition: (point: { x: number; y: number }) => { x: number; y: number }): void => {
      // Drop lands inside the React Flow pane: the transient toFlowPosition
      // borrow converts client coordinates into flow coordinates; the ReactFlow
      // instance itself is never exposed. Non-pipeline drags pass through.
      handlePipelineMediaDrop(event, {
        onIntent: (intent, position) => controller.receiveAssetNodeIntent(intent, toFlowPosition(position)),
        onReject: reason => controller.rejectDrop(reason),
      })
    }

    if (state.phase !== 'ready' || state.project === undefined || state.capsule === undefined) {
      const phase = state.phase === 'loading' ? 'loading' : state.phase === 'error' ? 'error' : 'disabled'
      return (
        <Surface kind="workspace" data-pipeline-workbench-pane={state.phase} aria-label="Pipeline Workbench">
          <SurfaceState
            phase={phase}
            title={state.phase === 'loading' ? 'Loading pipeline projection' : 'Pipeline workbench unavailable'}
            {...(state.reason === undefined ? {} : { description: state.reason })}
          />
        </Surface>
      )
    }

    return (
      <PipelineWorkbenchShell
        title="Pipeline"
        project={state.project}
        section={section}
        onSelectSection={setSection}
        capsule={state.capsule}
        onSwitchSurface={surface => controller.switchSurface(surface)}
        objects={state.objects}
        onSelectObject={id => controller.selectObject(id)}
        {...(state.canvas === undefined
          ? {
            canvasPlaceholder: {
              phase: 'empty' as const,
              title: 'Canvas is not connected',
              description: 'The pipeline owner did not project a canvas binding.',
            },
          }
          : {
            canvas: {
              controller: state.canvas,
              // Canvas edge selection is the primary inspector path; the edge
              // list in the inspector stays only as the compact-width fallback.
              onEdgeSelect: edgeId => controller.selectEdge(edgeId),
              onCanvasDropIntent,
              resolveMedia: async (artifact: ArtifactRefV1) => {
                const resolution = await controller.resolveMedia(artifactMediaEntry(artifact))
                return resolution.status === 'ready' ? { url: resolution.url, expiresAt: resolution.expiresAt } : undefined
              },
            },
          })}
        {...(state.notice === undefined ? {} : { canvasNotice: state.notice })}
        {...(state.availabilityBanner === undefined ? {} : { availabilityBanner: state.availabilityBanner })}
        {...(state.errorStrip === undefined ? {} : { errorStrip: state.errorStrip })}
        {...(state.scene3d.open && state.scene3d.controller !== undefined
          ? {
            viewport3d: <Scene3DViewportRegion
              controller={state.scene3d.controller}
              onSelectNode={nodeId => controller.selectScene3DNode(nodeId)}
              onClose={() => controller.closeScene3DViewport()}
            />,
          }
          : {})}
        inspectorTabs={{ inspector: <InspectorPane state={state} controller={controller} /> }}
        runStrip={state.runStrip}
        ariaLabel="Pipeline Workbench"
      />
    )
  }
}

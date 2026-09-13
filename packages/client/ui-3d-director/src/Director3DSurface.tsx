import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceActionBar, SurfaceContextBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { GltfCapabilityGapV1 } from '@yeisme/dsh-pane-protocol'
import type { Scene3DController } from './scene3d-controller.js'
import { scene3DExportAvailability, scene3DSaveTone, SCENE_3D_SAVE_LABELS } from './view-model.js'
import {
  buildScene3DSelectionConvergence,
  buildShotNavItems,
  buildShotPreviewDocument,
  resolveShotCameraNodeId,
  resolveShotPreviewNodeIds,
} from './previz.js'
import { director3DStyles } from './styles.js'
import { Director3DViewport, type CreateViewport3DEngine } from './Director3DViewport.js'
import { NodeTransformEditor } from './NodeTransformEditor.js'
import { ChangeSetPanel } from './ChangeSetPanel.js'
import { ShotNavigator } from './ShotNavigator.js'
import { ShotTimeline } from './ShotTimeline.js'

export interface Director3DSurfaceProps {
  readonly controller: Scene3DController
  /** Shot shown in the timeline; defaults to the controller selection or the first shot. */
  readonly shotRef?: string
  readonly reducedMotion?: boolean
  readonly forceViewportFallback?: boolean
  readonly createViewportEngine?: CreateViewport3DEngine
}

function gapText(gap: GltfCapabilityGapV1): string {
  const target = gap.extension ?? gap.resourceRef ?? 'unknown'
  return `${target}: ${gap.reason}`
}

/**
 * Composed 3D Director panel (adopted/workspace archetype). One ContextBar,
 * viewport + Shot timeline, revision/conflict language in text, and export
 * gating from the authoritative capability report.
 */
export function Director3DSurface(props: Director3DSurfaceProps): ReactNode {
  const { controller } = props
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [playhead, setPlayhead] = useState(0)
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (state.status === 'loading') void controller.load()
  }, [controller, state.status])

  useEffect(() => {
    if (state.status === 'ready' && state.changeSetsStatus === 'unknown') void controller.refreshChangeSets()
  }, [controller, state.status, state.changeSetsStatus])

  const saveTone = scene3DSaveTone(state.saveStatus)
  const statusLine = <span className="d3d-status" role="status">
    <span className="vk-dot" data-tone={saveTone} aria-hidden="true" />
    {SCENE_3D_SAVE_LABELS[state.saveStatus]}
  </span>

  if (state.status === 'loading') {
    return <Surface kind="workspace" data-3d-director>
      <style>{director3DStyles}</style>
      <SurfaceContextBar title="3D Director" context={`${controller.target.documentId}`} />
      <SurfaceState phase="loading" title="Loading scene graph" description={`Reading scene ${controller.target.documentId} and its revision from the owner.`} />
      <div className="d3d-body"><div className="vk-skeleton" /><div className="vk-skeleton" /></div>
    </Surface>
  }

  if (state.status === 'missing') {
    return <Surface kind="workspace" data-3d-director>
      <style>{director3DStyles}</style>
      <SurfaceContextBar title="3D Director" context={controller.target.documentId} />
      <SurfaceState phase="empty" title="No scene yet" description="The owner has not committed a scene graph for this document. Start a draft or import a GLB."
        action={<Button type="button" size="sm" variant="toolbar" onClick={() => controller.createDraft()}>New scene draft</Button>} />
    </Surface>
  }

  if (state.status === 'unavailable' || state.status === 'forbidden') {
    return <Surface kind="workspace" data-3d-director>
      <style>{director3DStyles}</style>
      <SurfaceContextBar title="3D Director" context={controller.target.documentId} />
      <SurfaceState phase="disabled" title={state.status === 'forbidden' ? 'Scene access denied' : 'Scene service unavailable'}
        description={state.status === 'forbidden'
          ? 'The owner rejected this context. The 3D Director stays read-only; contact the project owner.'
          : 'The scene3dDirector host remote is unavailable. The panel recovers automatically when the channel returns; nothing is polled.'} />
    </Surface>
  }

  if (state.status === 'invalid' || state.status === 'error') {
    return <Surface kind="workspace" data-3d-director>
      <style>{director3DStyles}</style>
      <SurfaceContextBar title="3D Director" context={controller.target.documentId} />
      <SurfaceState phase="error" title={state.status === 'invalid' ? 'Scene data failed the contract' : 'Scene read failed'}
        description={state.status === 'invalid'
          ? 'The owner response did not pass the scene graph schema, so nothing was rendered. Fail-closed: no partial truth is shown.'
          : 'The scene read failed. Reload to try again; no automatic retry runs.'}
        action={state.status === 'error'
          ? <Button type="button" size="sm" variant="toolbar" onClick={() => void controller.load()}>Reload</Button>
          : undefined} />
    </Surface>
  }

  const document = state.document
  if (document === undefined) return null

  const exportAvailability = scene3DExportAvailability(state)
  const shotRef = props.shotRef ?? state.selectedShotRef ?? state.shots[0]?.shotRef
  const shot = shotRef === undefined ? undefined : state.shots.find(entry => entry.shotRef === shotRef)
  const conflict = state.conflict
  const selectedNode = state.selectedNodeId === undefined
    ? undefined
    : document.nodes.find(node => node.id === state.selectedNodeId)

  // Previsualization derivations: display-only, step-sampled at the playhead;
  // the controller draft and the save path always keep the owner truth.
  // Plain derivations (no hooks): the early-return state matrix above makes
  // the hook count unstable across phases, and these maps are cheap.
  const convergence = buildScene3DSelectionConvergence(document, state.bindings)
  const previewDocument = buildShotPreviewDocument(document, shot, playhead)
  const emphasizedNodeIds = [...resolveShotPreviewNodeIds(document, shot)]
  const shotNavItems = buildShotNavItems(state.shots, shotRef, state.selectedNodeId, convergence)
  const selectShot = (nextRef: string): void => {
    controller.selectShot(nextRef)
    const nextShot = state.shots.find(entry => entry.shotRef === nextRef)
    // Selection convergence: a shot selects its camera node when the scene
    // graph carries it; picking never switches the shot implicitly.
    const cameraNodeId = resolveShotCameraNodeId(document, nextShot)
    if (cameraNodeId !== undefined) controller.selectNode(cameraNodeId)
    setSelectedKeyframeId(undefined)
    setPlayhead(nextShot?.frameRange.start ?? 0)
  }

  return <Surface kind="workspace" data-3d-director>
    <style>{director3DStyles}</style>
    <SurfaceContextBar
      title="3D Director"
      context={`${document.id} · revision ${document.version}`}
      description={`${state.shots.length} shot${state.shots.length === 1 ? '' : 's'} · ${state.bindings.length} canvas binding${state.bindings.length === 1 ? '' : 's'}`}
      status={statusLine}
      actions={<>
        {state.saveStatus === 'unknown' ? <Button type="button" size="sm" variant="toolbar" onClick={() => void controller.reconcile()}>Reconcile save</Button> : null}
        <Button type="button" size="sm" variant="toolbar" disabled={!state.dirty || state.frozen || state.saveStatus === 'saving' || state.saveStatus === 'unknown' || controller.shotSaveUnavailable}
          title={controller.shotSaveUnavailable ? 'This host cannot persist keyframes. Draft retained; connect a compatible host.' : state.frozen ? 'Writes are frozen until the revision conflict is reconciled.' : undefined}
          onClick={() => void controller.save()}>Save</Button>
        <Button type="button" size="sm" variant="toolbar" disabled={exportAvailability.disabled}
          title={exportAvailability.reason}
          onClick={() => void controller.exportScene()}>Export GLB</Button>
      </>}
    />
    {controller.shotSaveUnavailable ? <SurfaceState phase="disabled" title="Keyframe persistence unavailable" description="This host cannot persist previsualization edits. The draft is retained and is not marked saved." /> : null}
    {conflict !== undefined ? <div className="vk-alert" data-tone="warn" role="alert" data-conflict-frozen>
      <strong>Revision conflict — edits are frozen.</strong>
      <p>{conflict.summary}</p>
      <div>
        <Button type="button" size="sm" variant="toolbar" onClick={() => controller.resolveConflict('reapply')}>Reapply my draft onto revision {conflict.remoteVersion}</Button>
        {' '}<Button type="button" size="sm" variant="toolbar" onClick={() => controller.resolveConflict('discard')}>Discard my draft</Button>
      </div>
    </div> : null}
    {state.saveStatus === 'unknown' && conflict === undefined ? <div className="vk-alert" data-tone="warn" role="alert">
      <strong>Save outcome unknown.</strong>
      <p>The commit never settled. Use “Reconcile save” to let the owner decide; nothing is retried automatically.</p>
    </div> : null}
    {state.export.status === 'blocked' ? <div className="vk-alert" data-tone="info" role="status" data-export-blocked>
      <strong>Export blocked by capability gaps.</strong>
      <p>{state.export.reason}</p>
      <ul className="d3d-gaps">{state.export.gaps.map((gap, index) => <li key={index}>{gapText(gap)}</li>)}</ul>
    </div> : null}
    {state.export.status === 'failed' ? <div className="vk-alert" role="alert"><strong>Export failed.</strong><p>{state.export.reason}</p></div> : null}
    {state.export.status === 'exported' ? <div className="vk-alert" data-tone="info" role="status"><strong>Scene exported.</strong><p>{state.export.size} bytes ({state.export.mediaType}).</p></div> : null}
    <div className="d3d-body">
      <SurfaceSection title="Shots" description="Shot-anchored previsualization; rows bound to the selected scene node are marked in text.">
        <ShotNavigator items={shotNavItems} frozen={state.frozen} onSelectShot={selectShot} />
      </SurfaceSection>
      <SurfaceSection title="Viewport" description={shot === undefined
        ? 'Placeholder geometry stands in for opaque mesh assets; picking a node selects it everywhere.'
        : `Previewing shot ${shot.shotRef} at frame ${Math.min(Math.max(playhead, shot.frameRange.start), shot.frameRange.end)} (step-sampled, display only); picking a node selects it everywhere.`}>
        <Director3DViewport
          document={previewDocument}
          {...(state.selectedNodeId === undefined ? {} : { selectedNodeId: state.selectedNodeId })}
          emphasizedNodeIds={emphasizedNodeIds}
          onSelect={nodeId => controller.selectNode(nodeId)}
          frozen={state.frozen}
          {...(props.reducedMotion === undefined ? {} : { reducedMotion: props.reducedMotion })}
          {...(props.forceViewportFallback === undefined ? {} : { forceFallback: props.forceViewportFallback })}
          {...(props.createViewportEngine === undefined ? {} : { createEngine: props.createViewportEngine })}
        />
      </SurfaceSection>
      {selectedNode === undefined ? null : <SurfaceSection title="Selected node" description="Numeric transform and visibility editing; edits land in the local draft and persist only through Save.">
        <NodeTransformEditor
          node={selectedNode}
          disabled={state.frozen}
          {...(state.frozen ? { disabledReason: 'Writes are frozen until the revision conflict is reconciled.' } : {})}
          onEditTransform={patch => controller.editNodeTransform(selectedNode.id, patch)}
          onSetVisibility={visible => controller.setNodeVisibility(selectedNode.id, visible)}
        />
      </SurfaceSection>}
      <SurfaceSection title="Shot timeline" description={shot === undefined ? 'No shot is bound to this scene yet.' : `Shot ${shot.shotRef} · ${shot.keyframes.length} keyframes`}>
        {shot === undefined
          ? <div className="vk-empty"><strong>No shot selected</strong><p>Select a shot on the canvas or in the navigation to edit its timeline.</p></div>
          : <ShotTimeline
              shot={shot}
              playhead={playhead}
              {...(selectedKeyframeId === undefined ? {} : { selectedKeyframeId })}
              disabled={state.frozen}
              onScrub={setPlayhead}
              onSelectKeyframe={setSelectedKeyframeId}
              onEditKeyframe={edit => { controller.editShotKeyframe(shot.shotRef, edit) }}
            />}
      </SurfaceSection>
      {state.changeSetsStatus === 'unknown' ? null : <SurfaceSection title="Generation change sets" meta={state.changeSetsStatus === 'ready' ? <span className="vk-muted">{state.changeSets.length} recorded</span> : undefined}
        description="Append-only generation audit; preview compares summary, inputs and patch digest, and accept/rollback commit through the same conflict-fenced revision seam.">
        <ChangeSetPanel state={state} controller={controller} />
      </SurfaceSection>}
    </div>
    {state.dirty && !state.frozen ? <SurfaceActionBar>
      <span className="vk-muted">Draft changes are local until saved against revision {document.version}.</span>
    </SurfaceActionBar> : null}
  </Surface>
}

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
import { Surface, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { ArtifactRefV1 } from '@yeisme/dsh-pane-protocol'
import { PipelineInspector } from './inspector.js'
import { PipelineWorkbenchShell } from './workbench-shell.js'
import type { PipelineWorkbenchSection } from './types.js'
import { handlePipelineMediaDrop, hasPipelineMediaDragPayload } from './media-drag.js'
import type { PipelineMediaEntry } from './media.js'
import {
  PipelineWorkbenchController,
  type PipelineWorkbenchOwnerFaceV1,
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
 * Owner probe: real owner transport first, then the explicitly named fixture
 * service (fixture evidence tier). Missing both → the pane renders disabled.
 */
export function probePipelineWorkbenchOwner(ctx: ContextReader): PipelineWorkbenchOwnerFaceV1 | undefined {
  const remote = readContextService<unknown>(ctx, 'remote')
  const owner = isRecord(remote) ? remote.creativePipeline : undefined
  if (isPipelineWorkbenchOwner(owner)) return owner
  const direct = readContextService<unknown>(ctx, 'remote.creativePipeline')
  if (isPipelineWorkbenchOwner(direct)) return direct
  const fixture = readContextService<unknown>(ctx, PIPELINE_FIXTURE_OWNER_SERVICE)
  if (isPipelineWorkbenchOwner(fixture)) return fixture
  return undefined
}

export interface PipelineWorkbenchViewDeps {
  readonly owner?: PipelineWorkbenchOwnerFaceV1
  readonly disabledReason?: string
  readonly newId?: () => string
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

function InspectorPane({ state, controller }: { readonly state: PipelineWorkbenchViewStateV1; readonly controller: PipelineWorkbenchController }): ReactNode {
  return (
    <div data-pipeline-workbench-inspector="">
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
    const [controller] = useState(() => new PipelineWorkbenchController({ owner, ...(deps.newId === undefined ? {} : { newId: deps.newId }) }))
    useEffect(() => {
      void controller.load()
      return () => controller.dispose()
    }, [controller])
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
    const [section, setSection] = useState<PipelineWorkbenchSection>('workflow')

    const onCanvasDragOver = (event: DragEvent<HTMLDivElement>): void => {
      if (hasPipelineMediaDragPayload(event.dataTransfer)) event.preventDefault()
    }
    const onCanvasDrop = (event: DragEvent<HTMLDivElement>): void => {
      const rect = event.currentTarget.getBoundingClientRect()
      handlePipelineMediaDrop(event, {
        // Canvas-region-relative position. Exact flow-coordinate conversion
        // (React Flow screenToFlowPosition) needs an upstream
        // ui-pane-domain seam that exposes the viewport; until then the
        // drop lands region-relative, clamped by the canvas draft edit.
        onIntent: (intent, position) => controller.receiveAssetNodeIntent(intent, {
          x: position.x - rect.left,
          y: position.y - rect.top,
        }),
        onReject: reason => controller.rejectDrop(reason),
      })
    }

    if (state.phase !== 'ready' || state.project === undefined || state.capsule === undefined) {
      return (
        <Surface kind="workspace" data-pipeline-workbench-pane={state.phase} aria-label="Pipeline Workbench">
          <SurfaceState
            phase={state.phase === 'loading' ? 'loading' : state.phase === 'error' ? 'error' : 'disabled'}
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
              resolveMedia: async (artifact: ArtifactRefV1) => {
                const resolution = await controller.resolveMedia(artifactMediaEntry(artifact))
                return resolution.status === 'ready' ? { url: resolution.url, expiresAt: resolution.expiresAt } : undefined
              },
            },
          })}
        onCanvasDrop={onCanvasDrop}
        onCanvasDragOver={onCanvasDragOver}
        {...(state.notice === undefined ? {} : { canvasNotice: state.notice })}
        inspectorTabs={{ inspector: <InspectorPane state={state} controller={controller} /> }}
        runStrip={state.runStrip}
        ariaLabel="Pipeline Workbench"
      />
    )
  }
}

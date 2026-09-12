/**
 * PipelineInspector (dsh-creative-pipeline-visual-workbench-v1, D4).
 *
 * Renders the pipeline inspector for the current canvas edge selection:
 * - execution edge → full run inspector (inputs/versions, output, owner run
 *   state, budget, evidence refs, confirmation lifecycle, pause/resume/
 *   reconcile actions). Actions are server-authored; clicking one only emits
 *   `onAction(action, runRef)` — the component never dispatches, retries, or
 *   replaces a writer itself.
 * - reference edge → relationship info only; no execution controls.
 * - no selection → empty state pointing back to the canvas.
 *
 * The view model is pre-computed by `buildPipelineInspectorViewModel`; this
 * component holds no projection logic. Styles are scoped to
 * `[data-pipeline-inspector]` and consume `--vk-*` tokens only.
 */

import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'
import { statusTone } from '@yeisme/dsh-client-ui-visual-kit'
import type { CreativePipelineRunActionKindV1 } from '@yeisme/dsh-plugin-contracts'
import type { PipelineRunStatus } from '@yeisme/dsh-pane-protocol'
import type {
  PipelineInspectorExecutionViewV1,
  PipelineInspectorReferenceViewV1,
  PipelineInspectorViewModelV1,
} from './inspector-state.js'

export interface PipelineInspectorProps {
  readonly model: PipelineInspectorViewModelV1
  /** Callback-only action channel; the inspector never executes owner actions itself. */
  readonly onAction?: (action: CreativePipelineRunActionKindV1, runRef: string) => void
}

const ACTION_LABELS: Readonly<Record<CreativePipelineRunActionKindV1, string>> = {
  pause: 'Pause',
  resume: 'Resume',
  reconcile: 'Reconcile',
}

const INSPECTOR_STYLES = `
[data-pipeline-inspector]{height:100%;overflow-y:auto;outline:none}
[data-pipeline-inspector] .pi-badge{flex:none;padding:1px 6px;border-radius:999px;background:var(--vk-bg-layer-2);color:var(--vk-text-tertiary);font-size:10px;text-transform:uppercase;letter-spacing:.04em}
[data-pipeline-inspector] .pi-badge[data-tone='positive']{background:color-mix(in srgb,var(--vk-tone-positive) 16%,transparent);color:var(--vk-tone-positive)}
[data-pipeline-inspector] .pi-badge[data-tone='info']{background:color-mix(in srgb,var(--vk-tone-info) 16%,transparent);color:var(--vk-tone-info)}
[data-pipeline-inspector] .pi-badge[data-tone='warn']{background:color-mix(in srgb,var(--vk-tone-warn) 16%,transparent);color:var(--vk-tone-warn)}
[data-pipeline-inspector] .pi-badge[data-tone='critical']{background:color-mix(in srgb,var(--vk-tone-critical) 16%,transparent);color:var(--vk-tone-critical)}
[data-pipeline-inspector] .pi-stack{display:grid;gap:12px;padding:12px}
[data-pipeline-inspector] .pi-row{display:flex;min-width:0;gap:8px;align-items:baseline}
[data-pipeline-inspector] .pi-key{flex:none;width:96px;color:var(--vk-text-quaternary);font-size:11px}
[data-pipeline-inspector] .pi-val{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-secondary)}
[data-pipeline-inspector] .pi-note{margin:0;padding:8px;border:1px solid color-mix(in srgb,var(--vk-tone-warn) 35%,var(--vk-border-subtle));border-radius:8px;color:var(--vk-tone-warn);font-size:12px}
[data-pipeline-inspector] .pi-evidence{margin:0;padding:0;list-style:none;display:grid;gap:4px}
[data-pipeline-inspector] .pi-evidence li{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-secondary);font-size:12px}
[data-pipeline-inspector] .pi-action-note{margin:0;color:var(--vk-text-tertiary);font-size:11px}
@media(max-width:420px){[data-pipeline-inspector] .pi-key{width:72px}}
@media(pointer:coarse){[data-pipeline-inspector] .ys-action-bar button{min-height:44px}}
@media(prefers-reduced-motion:reduce){[data-pipeline-inspector] *{transition:none !important;animation:none !important}}
`

function Row({ label, value }: { readonly label: string; readonly value: ReactNode }): ReactNode {
  return <div className="pi-row"><span className="pi-key">{label}</span><span className="pi-val">{value}</span></div>
}

function StatusBadge({ status }: { readonly status: string }): ReactNode {
  return <span className="pi-badge" data-tone={statusTone(status)}>{status}</span>
}

function runStripPhase(status: PipelineRunStatus): 'error' | 'stale' | 'partial' | 'disabled' | undefined {
  switch (status) {
    case 'stale': return 'stale'
    case 'partial': return 'partial'
    case 'needs_contract': return 'disabled'
    case 'blocked':
    case 'unknown': return 'error'
    default: return undefined
  }
}

function budgetText(budget: PipelineInspectorExecutionViewV1['budget']): string | undefined {
  if (budget === undefined) return undefined
  const parts: string[] = []
  if (budget.spent !== undefined) parts.push(`spent ${budget.spent}`)
  if (budget.limit !== undefined) parts.push(`limit ${budget.limit}`)
  if (parts.length === 0) return 'not projected by owner'
  return `${parts.join(' / ')}${budget.currency === undefined ? '' : ` ${budget.currency}`}`
}

function ReferenceEdgeBody({ view }: { readonly view: PipelineInspectorReferenceViewV1 }): ReactNode {
  return <>
    <SurfaceContextBar
      title="Reference edge"
      status={<span className="pi-badge">reference</span>}
    />
    <div className="pi-stack">
      <SurfaceSection title="Relationship" description="Reference edges describe relationships only; they never trigger execution.">
        <Row label="source" value={`${view.source.label}${view.source.version === undefined ? '' : ` · v${view.source.version}`}`} />
        <Row label="target" value={`${view.target.label}${view.target.version === undefined ? '' : ` · v${view.target.version}`}`} />
        {view.label === undefined ? null : <Row label="label" value={view.label} />}
      </SurfaceSection>
    </div>
  </>
}

function ExecutionEdgeBody({ view, onAction }: { readonly view: PipelineInspectorExecutionViewV1; readonly onAction?: PipelineInspectorProps['onAction'] }): ReactNode {
  const stripPhase = runStripPhase(view.runStatus)
  const budget = budgetText(view.budget)
  const disabledReasons = view.actions.filter(action => !action.enabled && action.disabledReason !== undefined)
  return <>
    <SurfaceContextBar
      title="Pipeline run"
      context={view.inputPurpose}
      status={<>
        <StatusBadge status={view.runStatus} />
        <span className="pi-badge" data-tone={statusTone(view.freshness)}>{view.freshness}</span>
      </>}
    />
    <div className="pi-stack">
      {stripPhase === undefined ? null : <SurfaceState
        phase={stripPhase}
        title={`Run ${view.runStatus}`}
        description={view.statusReason}
      />}
      {view.draftReason === undefined ? null : <p className="pi-note" role="status">{`Connection draft: ${view.draftReason}`}</p>}
      <SurfaceSection title="Input" description={view.draftReason === undefined ? undefined : 'Incompatible connection is kept as a draft; it is never converted implicitly.'}>
        <Row label="source" value={view.source.label} />
        <Row label="ref" value={view.source.ref} />
        <Row label="version" value={view.source.version ?? 'unknown — node projection unavailable'} />
        <Row label="purpose" value={view.inputPurpose} />
      </SurfaceSection>
      <SurfaceSection title="Output">
        <Row label="candidate" value={view.target.label} />
        <Row label="ref" value={view.target.ref} />
        <Row label="version" value={view.target.version ?? 'unknown — node projection unavailable'} />
        <Row label="output" value={view.outputVersion} />
      </SurfaceSection>
      <SurfaceSection
        title="Run"
        meta={<StatusBadge status={view.runStatus} />}
      >
        <Row label="status" value={view.statusReason} />
        {view.impact === undefined ? null : <Row label="impact" value={view.impact} />}
        {view.nextAction === undefined ? null : <Row label="next action" value={view.nextAction} />}
        {view.blockerCode === undefined ? null : <Row label="blocker" value={view.blockerCode} />}
        {view.runRef === undefined ? null : <Row label="run ref" value={view.runRef} />}
        {view.runVersion === undefined ? null : <Row label="revision" value={view.runVersion} />}
        {budget === undefined ? null : <Row label="budget" value={budget} />}
        <Row label="confirmation" value={view.confirmation.reason} />
        {view.evidenceRefs.length === 0
          ? <Row label="evidence" value="No evidence refs projected" />
          : <ul className="pi-evidence" aria-label="Evidence refs">
            {view.evidenceRefs.map(ref => <li key={ref} title={ref}>{ref}</li>)}
          </ul>}
      </SurfaceSection>
    </div>
    <SurfaceActionBar>
      {view.actions.map(action => {
        const label = ACTION_LABELS[action.action]
        return <Button
          key={action.action}
          type="button"
          size="sm"
          variant="toolbar"
          disabled={!action.enabled}
          aria-disabled={!action.enabled}
          title={action.enabled ? label : action.disabledReason}
          aria-label={action.enabled ? label : `${label}: ${action.disabledReason ?? 'disabled'}`}
          onClick={() => {
            if (!action.enabled || view.runRef === undefined) return
            onAction?.(action.action, view.runRef)
          }}
        >{label}</Button>
      })}
      {disabledReasons.length === 0 ? null : <p className="pi-action-note" role="status">{disabledReasons[0]?.disabledReason}</p>}
    </SurfaceActionBar>
  </>
}

/** Inspector for the selected pipeline edge; pure render over the pre-computed view model. */
export function PipelineInspector({ model, onAction }: PipelineInspectorProps): ReactNode {
  return <Surface kind="inspector" data-pipeline-inspector="" aria-label="Pipeline inspector">
    <style data-pipeline-inspector-styles>{INSPECTOR_STYLES}</style>
    {model.selection === 'none'
      ? <div className="pi-stack"><SurfaceState
        phase="empty"
        title="No edge selected"
        description="Select an execution edge on the canvas to inspect its run, or a reference edge to see its relationship."
      /></div>
      : model.selection === 'reference'
        ? <ReferenceEdgeBody view={model} />
        : <ExecutionEdgeBody view={model} onAction={onAction} />}
  </Surface>
}

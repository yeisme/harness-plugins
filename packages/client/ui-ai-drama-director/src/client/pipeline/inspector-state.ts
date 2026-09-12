/**
 * Pipeline inspector view-model projection (dsh-creative-pipeline-visual-workbench-v1, D4).
 *
 * Pure functions only: no store, no transport, no mutation. Inputs are the frozen
 * D1 contracts — the execution/reference edge projection from
 * `@yeisme/dsh-plugin-contracts` (creative-pipeline) and the owner run projection
 * from `@yeisme/dsh-pane-protocol` (`PipelineRunProjectionV1`).
 *
 * Safety rules enforced here (never relaxed by callers):
 * - unknown/stale/blocked/needs_contract/partial runs disable pause/resume and
 *   require owner reconcile; reconcile itself stays server-authored (it is the
 *   read-only recovery entry, not a run mutation). Nothing auto-retries.
 * - A missing owner run projection (adapter not installed) derives a synthetic
 *   needs_contract state with a reason; run controls stay disabled.
 * - Budget is pass-through: unknown budget stays undefined and is never shown
 *   as 0.
 * - Confirmation lifecycle preview → confirm → invalidated → re-preview is
 *   derived from version comparison only; an input version change after
 *   preview/confirm invalidates the confirmation.
 */

import type {
  CreativePipelineEdgeProjectionV1,
  CreativePipelineExecutionEdgeV1,
  CreativePipelineNodeProjectionV1,
  CreativePipelineRunActionKindV1,
  CreativePipelineRunProjectionV1,
  ProjectionFreshness,
} from '@yeisme/dsh-plugin-contracts'
import type { PipelineRunProjectionV1, PipelineRunStatus } from '@yeisme/dsh-pane-protocol'

export type PipelineInspectorSelectionKindV1 = 'none' | 'reference' | 'execution'

export const PIPELINE_RUN_ACTION_KINDS: readonly CreativePipelineRunActionKindV1[] = ['pause', 'resume', 'reconcile']

/** Statuses whose runs never accept mutations; owner reconcile is the only path forward. */
export const PIPELINE_RUN_MUTATION_BLOCKED_STATUSES: readonly PipelineRunStatus[] = [
  'blocked',
  'stale',
  'unknown',
  'needs_contract',
  'partial',
]

export interface PipelineInspectorNodeRefViewV1 {
  readonly nodeId: string
  readonly label: string
  /** Opaque owner ref when the node projection is available; otherwise the node id. */
  readonly ref: string
  /** Pinned version; undefined when the node projection is unavailable — never fabricated. */
  readonly version?: string
  readonly status?: string
}

export interface PipelineInspectorActionViewV1 {
  readonly action: CreativePipelineRunActionKindV1
  readonly enabled: boolean
  /** Bounded, already-redacted reason whenever the action is disabled. */
  readonly disabledReason?: string
}

/** Budget summary as projected by the owner; absent fields stay absent (unknown ≠ 0). */
export interface PipelineInspectorBudgetViewV1 {
  readonly spent?: number
  readonly limit?: number
  readonly currency?: string
}

export type PipelineConfirmationPhaseV1 = 'none' | 'previewed' | 'confirmed' | 'invalidated'

export interface PipelineConfirmationRecordV1 {
  /** Input version captured when the run preview was generated. */
  readonly previewInputVersion?: string
  /** Input version the user explicitly confirmed. */
  readonly confirmedInputVersion?: string
}

export interface PipelineConfirmationViewV1 {
  readonly phase: PipelineConfirmationPhaseV1
  /** True when a new preview is required before any confirm can happen again. */
  readonly requiresRepreview: boolean
  readonly reason: string
}

export interface PipelineInspectorNoneViewV1 {
  readonly selection: 'none'
}

export interface PipelineInspectorReferenceViewV1 {
  readonly selection: 'reference'
  readonly edgeId: string
  readonly source: PipelineInspectorNodeRefViewV1
  readonly target: PipelineInspectorNodeRefViewV1
  readonly label?: string
}

export interface PipelineInspectorExecutionViewV1 {
  readonly selection: 'execution'
  readonly edgeId: string
  readonly source: PipelineInspectorNodeRefViewV1
  readonly target: PipelineInspectorNodeRefViewV1
  readonly inputPurpose: string
  readonly outputVersion: string
  /** Present when the connection is kept as an incompatible draft. */
  readonly draftReason?: string
  readonly runStatus: PipelineRunStatus
  readonly freshness: ProjectionFreshness
  /** Bounded status reason (blocker reason preferred, then run reason). */
  readonly statusReason: string
  /** Impact scope / next action from the richer SDK run state when projected. */
  readonly impact?: string
  readonly nextAction?: string
  readonly blockerCode?: string
  readonly runRef?: string
  readonly runVersion?: string
  readonly budget?: PipelineInspectorBudgetViewV1
  readonly evidenceRefs: readonly string[]
  readonly confirmation: PipelineConfirmationViewV1
  readonly actions: readonly PipelineInspectorActionViewV1[]
}

export type PipelineInspectorViewModelV1 =
  | PipelineInspectorNoneViewV1
  | PipelineInspectorReferenceViewV1
  | PipelineInspectorExecutionViewV1

export interface PipelineInspectorInputV1 {
  /** Currently selected edge; undefined renders the empty state. */
  readonly edge?: CreativePipelineEdgeProjectionV1
  /** Owner run projection for the selected execution edge (pane-protocol transport shape). */
  readonly run?: PipelineRunProjectionV1
  /** Optional richer SDK run state carrying reason/impact/next_action text. */
  readonly runDetail?: CreativePipelineRunProjectionV1
  /** Node projections keyed by node id, for input/output labels and pinned versions. */
  readonly nodes?: ReadonlyMap<string, CreativePipelineNodeProjectionV1>
  /** Owner-projected budget summary; omitted entirely when unknown. */
  readonly budget?: PipelineInspectorBudgetViewV1
  /** Preview/confirm record for the selected edge, keyed by input version. */
  readonly confirmation?: PipelineConfirmationRecordV1
}

/**
 * Derives the confirmation lifecycle phase from version identity only.
 * preview → confirmed stays valid while the current input version equals the
 * confirmed version; any drift (or an unreadable input) invalidates it and
 * requires a re-preview before the next confirm.
 */
export function derivePipelineConfirmationPhase(
  currentInputVersion: string | undefined,
  record?: PipelineConfirmationRecordV1,
): PipelineConfirmationPhaseV1 {
  if (record?.previewInputVersion === undefined) return 'none'
  if (currentInputVersion === undefined) return 'invalidated'
  if (record.confirmedInputVersion !== undefined) {
    return currentInputVersion === record.confirmedInputVersion ? 'confirmed' : 'invalidated'
  }
  return currentInputVersion === record.previewInputVersion ? 'previewed' : 'invalidated'
}

const CONFIRMATION_REASON: Readonly<Record<PipelineConfirmationPhaseV1, string>> = {
  none: 'No preview yet; preview the run before confirming.',
  previewed: 'Preview matches the current input version; confirmation is still required.',
  confirmed: 'Confirmed against the current input version.',
  invalidated: 'Input version changed after preview; the confirmation is invalidated — re-preview required.',
}

function confirmationView(currentInputVersion: string | undefined, record?: PipelineConfirmationRecordV1): PipelineConfirmationViewV1 {
  const phase = derivePipelineConfirmationPhase(currentInputVersion, record)
  return {
    phase,
    requiresRepreview: phase === 'invalidated' || phase === 'none',
    reason: CONFIRMATION_REASON[phase],
  }
}

function nodeRefView(nodeId: string, nodes: ReadonlyMap<string, CreativePipelineNodeProjectionV1> | undefined): PipelineInspectorNodeRefViewV1 {
  const node = nodes?.get(nodeId)
  if (node === undefined) return { nodeId, label: nodeId, ref: nodeId }
  return {
    nodeId,
    label: node.summary.text,
    ref: node.ref,
    version: node.version,
    status: node.status,
  }
}

function disabledAction(action: CreativePipelineRunActionKindV1, disabledReason: string): PipelineInspectorActionViewV1 {
  return { action, enabled: false, disabledReason }
}

function resolveActions(
  run: PipelineRunProjectionV1 | undefined,
  status: PipelineRunStatus,
  freshness: ProjectionFreshness,
  statusReason: string,
  draftReason: string | undefined,
): readonly PipelineInspectorActionViewV1[] {
  if (run === undefined) {
    return PIPELINE_RUN_ACTION_KINDS.map(action =>
      disabledAction(action, 'Owner run projection is unavailable; the adapter contract is required before run controls activate.'))
  }
  return PIPELINE_RUN_ACTION_KINDS.map(action => {
    const authored = run.actions.find(entry => entry.action === action)
    if (authored === undefined) return disabledAction(action, 'The owner did not author this action for the current run.')
    if (!authored.enabled) return disabledAction(action, authored.disabledReason ?? 'The owner disabled this action.')
    if (action === 'reconcile') return { action, enabled: true }
    // pause/resume are run mutations: client-side safety overrides apply even when
    // the server authored them as enabled, so a stale/blocked run can never be mutated.
    if (draftReason !== undefined) return disabledAction(action, `Connection draft is unresolved: ${draftReason}`)
    if (PIPELINE_RUN_MUTATION_BLOCKED_STATUSES.includes(status)) {
      return disabledAction(action, `${statusReason} Owner reconcile is required; no automatic retry.`)
    }
    if (freshness !== 'fresh') return disabledAction(action, `Run projection is ${freshness}; reconcile before mutation.`)
    return { action, enabled: true }
  })
}

function executionView(edge: CreativePipelineExecutionEdgeV1, input: PipelineInspectorInputV1): PipelineInspectorExecutionViewV1 {
  const source = nodeRefView(edge.source, input.nodes)
  const target = nodeRefView(edge.target, input.nodes)
  const run = input.run
  const status: PipelineRunStatus = run?.status ?? 'needs_contract'
  const statusReason = run === undefined
    ? 'Owner run projection is unavailable for this edge; the adapter contract is missing.'
    : run.blocker?.reason ?? run.reason ?? `Run is ${status}.`
  const freshness: ProjectionFreshness = run?.freshness ?? 'unknown'
  const detail = input.runDetail
  const detailState = detail?.state
  return {
    selection: 'execution',
    edgeId: edge.id,
    source,
    target,
    inputPurpose: edge.input_purpose,
    outputVersion: edge.output_version,
    ...(edge.draft !== undefined ? { draftReason: edge.draft.reason } : {}),
    runStatus: status,
    freshness,
    statusReason,
    ...(detailState !== undefined ? { impact: detailState.impact, nextAction: detailState.next_action } : {}),
    ...(run?.blocker !== undefined ? { blockerCode: run.blocker.code } : {}),
    ...(run !== undefined ? { runRef: run.runRef, runVersion: run.version } : {}),
    ...(input.budget !== undefined ? { budget: input.budget } : {}),
    evidenceRefs: run?.evidenceRefs ?? [],
    confirmation: confirmationView(source.version, input.confirmation),
    actions: resolveActions(run, status, freshness, statusReason, edge.draft?.reason),
  }
}

/** Builds the inspector view model for the current canvas selection. */
export function buildPipelineInspectorViewModel(input: PipelineInspectorInputV1): PipelineInspectorViewModelV1 {
  const edge = input.edge
  if (edge === undefined) return { selection: 'none' }
  if (edge.kind === 'reference') {
    return {
      selection: 'reference',
      edgeId: edge.id,
      source: nodeRefView(edge.source, input.nodes),
      target: nodeRefView(edge.target, input.nodes),
      ...(edge.label !== undefined ? { label: edge.label } : {}),
    }
  }
  return executionView(edge, input)
}

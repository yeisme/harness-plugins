/**
 * Fixture-tier pipeline projection owner (dsh-creative-pipeline-visual-workbench-v1, D6).
 *
 * This is a FIXTURE projection source — it exists so the pipeline workbench
 * vertical slice can be exercised at the local/fixture evidence tier. It is
 * not a real owner: it holds no domain truth, accepts no mutations
 * (dispatchRunAction is intentionally absent), its canvas saves reconcile to
 * `unavailable`, and its media resolver never grants access (every entry
 * resolves to the honest `unavailable` state).
 *
 * Everything it returns is raw JSON-shaped data that the workbench controller
 * re-decodes through the fail-closed D1 decoders, so the fixture also
 * exercises the same contract boundary a real owner would cross.
 *
 * Convention: the envelope schema id is the NEUTRAL snapshot contract name
 * `dsh.creative-pipeline-workbench-snapshot.v1alpha1`, shared by any owner —
 * the fail-closed decoder accepts that single neutral id, so a future real
 * owner passes the same gate. Fixture identity is carried only by the
 * `creativePipelineFixture` context service key and the exports of this
 * module, never by the schema value.
 */

import {
  PROJECT_CANVAS_SCHEMA,
  type ArtifactRefV1,
  type ProjectCanvasDocument,
} from '@yeisme/dsh-pane-protocol'
import type { PipelineCanvasRemote } from './workbench-controller.js'
import type { PipelineMediaResolveFn } from './media.js'
import type { PipelineWorkbenchOwnerFaceV1 } from './workbench-controller.js'

/** Envelope schema emitted by the fixture owner: the neutral snapshot contract id the controller decodes fail-closed on. */
export const PIPELINE_FIXTURE_SNAPSHOT_SCHEMA = 'dsh.creative-pipeline-workbench-snapshot.v1alpha1' as const

/** Context service key for an explicitly provided fixture owner (fixture tier only). */
export const PIPELINE_FIXTURE_OWNER_SERVICE = 'creativePipelineFixture' as const

export const PIPELINE_FIXTURE_PROJECT_REF = 'project:night-rain'
export const PIPELINE_FIXTURE_RUNNING_EDGE_ID = 'edge:shot04-run'
export const PIPELINE_FIXTURE_BLOCKED_EDGE_ID = 'edge:poster-run'
export const PIPELINE_FIXTURE_RUNNING_RUN_REF = 'run:shot04'
export const PIPELINE_FIXTURE_BLOCKED_RUN_REF = 'run:poster'

const WORKSPACE_REF = 'ws:fixture'

function fixtureNodes(): readonly unknown[] {
  const node = (
    id: string,
    kind: string,
    ref: string,
    text: string,
    version: string,
    status: string,
    layout: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  ): unknown => ({
    id,
    kind,
    ref,
    summary: { text, truncated: false },
    version,
    status,
    layout,
    freshness: 'fresh',
  })
  return [
    node('node:asset-poster', 'asset', 'asset:poster-frame', 'Poster frame', 'v2', 'ready', { x: 40, y: 40, width: 220, height: 140 }),
    node('node:char-lin', 'character', 'character:lin', 'Lin (lead)', 'v5', 'ready', { x: 40, y: 240, width: 220, height: 140 }),
    node('node:scene-rooftop', 'scene', 'scene:rooftop', 'Rooftop night rain', 'v4', 'ready', { x: 330, y: 140, width: 240, height: 150 }),
    node('node:shot04', 'shot', 'shot:episode01-04', 'Shot 04 · rooftop chase', 'v6', 'pending_review', { x: 620, y: 140, width: 240, height: 150 }),
    node('node:candidate-c2', 'candidate', 'candidate:shot04-c2', 'Candidate C2', 'v3', 'draft', { x: 910, y: 60, width: 220, height: 140 }),
    node('node:candidate-c1', 'candidate', 'candidate:poster-c1', 'Candidate P1', 'v1', 'blocked', { x: 910, y: 260, width: 220, height: 140 }),
  ]
}

function fixtureEdges(): readonly unknown[] {
  return [
    { id: 'edge:cast', kind: 'reference', source: 'node:char-lin', target: 'node:scene-rooftop', label: 'cast' },
    {
      id: PIPELINE_FIXTURE_RUNNING_EDGE_ID,
      kind: 'execution',
      source: 'node:shot04',
      target: 'node:candidate-c2',
      input_purpose: 'reference-image',
      output_version: 'v3',
      owner_projection_ref: 'runproj:shot04',
    },
    {
      id: PIPELINE_FIXTURE_BLOCKED_EDGE_ID,
      kind: 'execution',
      source: 'node:asset-poster',
      target: 'node:candidate-c1',
      input_purpose: 'asset',
      output_version: 'v1',
      owner_projection_ref: 'runproj:poster',
    },
  ]
}

/** Rich SDK run projections (state reason/impact/next_action + server-authored actions). */
function fixtureRuns(): readonly unknown[] {
  return [
    {
      run_ref: PIPELINE_FIXTURE_RUNNING_RUN_REF,
      revision: 'r7',
      freshness: 'fresh',
      state: {
        state: 'running',
        reason: 'Generating shot variants',
        impact: 'Shot 04 candidate outputs',
        next_action: 'Review candidate C2',
      },
      actions: [
        { action: 'pause', available: true, action_ref: 'action:pause-shot04', expected_revision: 'r7' },
        { action: 'resume', available: false, disabled_reason_code: 'not_paused', action_ref: 'action:resume-shot04', expected_revision: 'r7' },
        { action: 'reconcile', available: true, action_ref: 'action:reconcile-shot04', expected_revision: 'r7' },
      ],
      progress: { completed: 3, total: 8 },
    },
    {
      run_ref: PIPELINE_FIXTURE_BLOCKED_RUN_REF,
      revision: 'r2',
      freshness: 'fresh',
      state: {
        state: 'blocked',
        reason: 'Upstream input requires owner review',
        impact: 'Poster candidate outputs',
        next_action: 'Reconcile with the owner',
      },
      actions: [
        { action: 'pause', available: false, disabled_reason_code: 'run_blocked', action_ref: 'action:pause-poster', expected_revision: 'r2' },
        { action: 'resume', available: false, disabled_reason_code: 'run_blocked', action_ref: 'action:resume-poster', expected_revision: 'r2' },
        { action: 'reconcile', available: true, action_ref: 'action:reconcile-poster', expected_revision: 'r2' },
      ],
    },
  ]
}

/** Pane-protocol run projections keyed to the execution edges (inspector transport shape). */
function fixtureRunProjections(): readonly unknown[] {
  return [
    {
      schema: 'dsh.pipeline-run.v1alpha1',
      runRef: PIPELINE_FIXTURE_RUNNING_RUN_REF,
      executionEdgeRef: 'runproj:shot04',
      status: 'running',
      freshness: 'fresh',
      actions: [
        { action: 'pause', enabled: true },
        { action: 'resume', enabled: false, disabledReason: 'Run is not paused.' },
        { action: 'reconcile', enabled: true },
      ],
      evidenceRefs: ['evidence:shot04-preview'],
      version: 'r7',
    },
    {
      schema: 'dsh.pipeline-run.v1alpha1',
      runRef: PIPELINE_FIXTURE_BLOCKED_RUN_REF,
      executionEdgeRef: 'runproj:poster',
      status: 'blocked',
      freshness: 'fresh',
      blocker: { code: 'input_review', reason: 'Upstream input requires owner review.' },
      actions: [
        { action: 'pause', enabled: false, disabledReason: 'Run is blocked.' },
        { action: 'resume', enabled: false, disabledReason: 'Run is blocked.' },
        { action: 'reconcile', enabled: true },
      ],
      evidenceRefs: [],
      version: 'r2',
    },
  ]
}

function fixtureCapsule(): unknown {
  return {
    contract_version: 'dsh.creative-pipeline.v1',
    project_ref: PIPELINE_FIXTURE_PROJECT_REF,
    surface: 'workbench',
    unsaved_draft: false,
    pending_review: true,
    run: { state: 'running', progress: { completed: 3, total: 8 } },
    menu: {
      project: { text: 'Night Rain', truncated: false },
      surface: 'workbench',
      work_context: { text: 'Episode 01 · Shot 04', truncated: false },
      run_state: 'running',
      next_action: { text: 'Review candidate C2', truncated: false },
    },
  }
}

function artifact(owner: string, kind: string, ref: string, version: string, mediaType: string, title: string): ArtifactRefV1 {
  return {
    schema: 'pane.artifact.v1alpha1',
    owner,
    kind,
    ref,
    version,
    mediaType,
    title,
    evidenceRefs: [],
    capabilities: ['preview'],
  }
}

function fixtureCanvasDocument(): ProjectCanvasDocument {
  return {
    schema: PROJECT_CANVAS_SCHEMA,
    scope: { workspaceRef: WORKSPACE_REF, projectRef: PIPELINE_FIXTURE_PROJECT_REF },
    id: 'main',
    revision: 1,
    camera: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: 'node:asset-poster', kind: 'asset', title: 'Poster frame', position: { x: 40, y: 40 }, size: { width: 220, height: 140 }, domainRef: 'asset:poster-frame', version: 'v2', artifact: artifact('eikona', 'image', 'asset:poster-frame', 'v2', 'image/png', 'Poster frame') },
      { id: 'node:char-lin', kind: 'character', title: 'Lin (lead)', position: { x: 40, y: 240 }, size: { width: 220, height: 140 }, domainRef: 'character:lin', version: 'v5' },
      { id: 'node:scene-rooftop', kind: 'scene', title: 'Rooftop night rain', position: { x: 330, y: 140 }, size: { width: 240, height: 150 }, domainRef: 'scene:rooftop', version: 'v4' },
      { id: 'node:shot04', kind: 'shot', title: 'Shot 04 · rooftop chase', position: { x: 620, y: 140 }, size: { width: 240, height: 150 }, domainRef: 'shot:episode01-04', version: 'v6' },
      { id: 'node:op-image-gen', kind: 'operation', title: 'Image generation', position: { x: 620, y: 340 }, size: { width: 240, height: 140 }, owner: 'eikona', actionRef: 'action:generate-image', controls: {} },
      { id: 'node:candidate-c2', kind: 'candidate', title: 'Candidate C2', position: { x: 910, y: 60 }, size: { width: 220, height: 140 }, domainRef: 'candidate:shot04-c2', version: 'v3', artifact: artifact('eikona', 'image', 'candidate:shot04-c2', 'v3', 'image/png', 'Candidate C2'), operationId: 'node:op-image-gen' },
      { id: 'node:candidate-c1', kind: 'candidate', title: 'Candidate P1', position: { x: 910, y: 260 }, size: { width: 220, height: 140 }, domainRef: 'candidate:poster-c1', version: 'v1', artifact: artifact('eikona', 'image', 'candidate:poster-c1', 'v1', 'image/png', 'Candidate P1') },
    ],
    edges: [
      { id: 'edge:cast', kind: 'reference', source: 'node:char-lin', target: 'node:scene-rooftop', label: 'cast' },
      { id: 'edge:shot04-exec', kind: 'execution', source: 'node:shot04', target: 'node:op-image-gen', output: 'selected', input: 'reference-image', purpose: 'reference-image' },
      { id: 'edge:op-out', kind: 'reference', source: 'node:op-image-gen', target: 'node:candidate-c2', label: 'output' },
    ],
  }
}

export interface PipelineFixtureOwnerV1 extends PipelineWorkbenchOwnerFaceV1 {
  /** Test/evidence observability: how often the projection was re-read. */
  readonly calls: { snapshot: number }
}

/**
 * Builds the fixture owner. `dispatchRunAction` is deliberately absent: the
 * fixture never mutates runs, so the workbench must render its run controls
 * through the action-channel-disabled path unless a test injects a channel.
 */
export function createPipelineFixtureOwner(): PipelineFixtureOwnerV1 {
  const calls = { snapshot: 0 }
  // Fixture media policy: never grant access; the resolver reports the honest
  // `unavailable` state (`owner did not grant media access`).
  const resolveMedia: PipelineMediaResolveFn = async () => undefined
  const canvasRemote: PipelineCanvasRemote = {
    canvasRead: async () => ({ status: 'ready', document: fixtureCanvasDocument() }),
    // The fixture canvas is read-only: saves never land and never pretend to.
    canvasSave: async () => ({ status: 'unavailable' }),
    canvasReconcile: async () => ({ status: 'unavailable' }),
  }
  return {
    calls,
    canvasRemote,
    canvasScope: { workspaceRef: WORKSPACE_REF, projectRef: PIPELINE_FIXTURE_PROJECT_REF },
    canvasDocumentId: 'main',
    resolveMedia,
    snapshot: async () => {
      calls.snapshot += 1
      return {
        schema: PIPELINE_FIXTURE_SNAPSHOT_SCHEMA,
        project: { ref: PIPELINE_FIXTURE_PROJECT_REF, label: 'Night Rain' },
        capsule: fixtureCapsule(),
        nodes: fixtureNodes(),
        edges: fixtureEdges(),
        runs: fixtureRuns(),
        runProjections: fixtureRunProjections(),
      }
    },
  }
}

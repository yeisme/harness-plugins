// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type {
  CreativePipelineExecutionEdgeV1,
  CreativePipelineNodeProjectionV1,
  CreativePipelineReferenceEdgeV1,
} from '@yeisme/dsh-plugin-contracts'
import { PIPELINE_RUN_SCHEMA, type PipelineRunProjectionV1, type PipelineRunStatus } from '@yeisme/dsh-pane-protocol'
import {
  buildPipelineInspectorViewModel,
  derivePipelineConfirmationPhase,
  type PipelineInspectorExecutionViewV1,
} from '../src/client/pipeline/inspector-state.js'
import { PipelineInspector } from '../src/client/pipeline/inspector.js'

afterEach(cleanup)

const node = (id: string, version: string): CreativePipelineNodeProjectionV1 => ({
  id,
  kind: 'asset',
  ref: `ref-${id}`,
  summary: { text: `Node ${id}`, truncated: false },
  version,
  status: 'ready',
  layout: { x: 0, y: 0, width: 120, height: 64 },
  freshness: 'fresh',
})

const executionEdge = (overrides?: Partial<CreativePipelineExecutionEdgeV1>): CreativePipelineExecutionEdgeV1 => ({
  id: 'edge-exec-one',
  kind: 'execution',
  source: 'node-1',
  target: 'node-2',
  input_purpose: 'keyframe reference',
  output_version: 'v3',
  owner_projection_ref: 'owner-projection-one',
  ...overrides,
})

const referenceEdge = (): CreativePipelineReferenceEdgeV1 => ({
  id: 'edge-ref-one',
  kind: 'reference',
  source: 'node-1',
  target: 'node-2',
  label: 'stylistic reference',
})

const INACTIVE: readonly PipelineRunStatus[] = ['blocked', 'stale', 'unknown', 'needs_contract', 'partial']

const runProjection = (status: PipelineRunStatus, overrides?: Partial<PipelineRunProjectionV1>): PipelineRunProjectionV1 => ({
  schema: PIPELINE_RUN_SCHEMA,
  runRef: 'run-one',
  executionEdgeRef: 'edge-exec-one',
  status,
  freshness: 'fresh',
  ...(INACTIVE.includes(status) ? { reason: `run is ${status}` } : {}),
  actions: [
    { action: 'pause', enabled: true },
    { action: 'resume', enabled: true },
    { action: 'reconcile', enabled: true },
  ],
  evidenceRefs: ['evidence-one', 'evidence-two'],
  version: '7',
  ...overrides,
})

const nodes = (sourceVersion = 'v1') => new Map([
  ['node-1', node('node-1', sourceVersion)],
  ['node-2', node('node-2', 'v3')],
])

function executionModel(overrides?: Parameters<typeof buildPipelineInspectorViewModel>[0]): PipelineInspectorExecutionViewV1 {
  const model = buildPipelineInspectorViewModel({
    edge: executionEdge(),
    run: runProjection('running'),
    nodes: nodes(),
    ...overrides,
  })
  if (model.selection !== 'execution') throw new Error('expected execution view')
  return model
}

describe('pipeline inspector state', () => {
  it('derives an empty selection when no edge is selected', () => {
    expect(buildPipelineInspectorViewModel({})).toEqual({ selection: 'none' })
  })

  it('projects input refs/versions, output candidate, evidence refs and run identity for execution edges', () => {
    const model = executionModel({ budget: { spent: 12, limit: 500, currency: 'credits' } })
    expect(model.source).toMatchObject({ nodeId: 'node-1', ref: 'ref-node-1', version: 'v1' })
    expect(model.target).toMatchObject({ nodeId: 'node-2', version: 'v3' })
    expect(model.inputPurpose).toBe('keyframe reference')
    expect(model.outputVersion).toBe('v3')
    expect(model.runRef).toBe('run-one')
    expect(model.runVersion).toBe('7')
    expect(model.evidenceRefs).toEqual(['evidence-one', 'evidence-two'])
    expect(model.budget).toEqual({ spent: 12, limit: 500, currency: 'credits' })
  })

  it('never shows unknown budget as zero', () => {
    expect(executionModel({ budget: undefined }).budget).toBeUndefined()
    const limitOnly = executionModel({ budget: { limit: 500 } })
    expect(limitOnly.budget).toEqual({ limit: 500 })
    expect(limitOnly.budget?.spent).toBeUndefined()
  })

  describe('run action disable matrix across the seven run states', () => {
    const cases: ReadonlyArray<readonly [PipelineRunStatus, { pause: boolean; resume: boolean; reconcile: boolean }]> = [
      ['running', { pause: true, resume: true, reconcile: true }],
      ['paused', { pause: true, resume: true, reconcile: true }],
      ['blocked', { pause: false, resume: false, reconcile: true }],
      ['stale', { pause: false, resume: false, reconcile: true }],
      ['unknown', { pause: false, resume: false, reconcile: true }],
      ['needs_contract', { pause: false, resume: false, reconcile: true }],
      ['partial', { pause: false, resume: false, reconcile: true }],
    ]
    it.each(cases)('%s → pause=%o resume=%o reconcile=%o', (status, expected) => {
      const model = executionModel({ run: runProjection(status) })
      const byAction = new Map(model.actions.map(action => [action.action, action]))
      expect(byAction.get('pause')?.enabled).toBe(expected.pause)
      expect(byAction.get('resume')?.enabled).toBe(expected.resume)
      expect(byAction.get('reconcile')?.enabled).toBe(expected.reconcile)
      for (const name of ['pause', 'resume', 'reconcile'] as const) {
        const action = byAction.get(name)
        if (!action?.enabled) expect(action?.disabledReason).toBeTruthy()
      }
    })
  })

  it('disables pause/resume on stale or unknown freshness even when the run is active; reconcile stays server-authored', () => {
    for (const freshness of ['stale', 'unknown'] as const) {
      const model = executionModel({ run: runProjection('running', { freshness }) })
      const byAction = new Map(model.actions.map(action => [action.action, action]))
      expect(byAction.get('pause')?.enabled).toBe(false)
      expect(byAction.get('pause')?.disabledReason).toContain(freshness)
      expect(byAction.get('resume')?.enabled).toBe(false)
      expect(byAction.get('reconcile')?.enabled).toBe(true)
    }
  })

  it('disables mutations while a connection draft is unresolved, keeping the draft reason', () => {
    const model = executionModel({ edge: executionEdge({ draft: { reason: 'input kind mismatch' } }) })
    expect(model.draftReason).toBe('input kind mismatch')
    const byAction = new Map(model.actions.map(action => [action.action, action]))
    expect(byAction.get('pause')?.disabledReason).toContain('input kind mismatch')
    expect(byAction.get('resume')?.enabled).toBe(false)
    expect(byAction.get('reconcile')?.enabled).toBe(true)
  })

  it('derives needs_contract with a reason and disables all run controls when the adapter run projection is missing', () => {
    const model = executionModel({ run: undefined })
    expect(model.runStatus).toBe('needs_contract')
    expect(model.statusReason).toContain('adapter contract')
    expect(model.runRef).toBeUndefined()
    for (const action of model.actions) {
      expect(action.enabled).toBe(false)
      expect(action.disabledReason).toContain('adapter contract')
    }
  })

  it('honors server-authored disabled reasons and never fabricates un-authored actions', () => {
    const model = executionModel({
      run: runProjection('running', {
        actions: [{ action: 'pause', enabled: false, disabledReason: 'owner paused by policy' }],
      }),
    })
    const byAction = new Map(model.actions.map(action => [action.action, action]))
    expect(byAction.get('pause')).toEqual({ action: 'pause', enabled: false, disabledReason: 'owner paused by policy' })
    expect(byAction.get('resume')?.enabled).toBe(false)
    expect(byAction.get('resume')?.disabledReason).toContain('did not author')
  })

  it('projects reference edges without any run state or actions', () => {
    const model = buildPipelineInspectorViewModel({ edge: referenceEdge(), nodes: nodes() })
    expect(model.selection).toBe('reference')
    if (model.selection !== 'reference') return
    expect(model.label).toBe('stylistic reference')
    expect(model.source.version).toBe('v1')
    expect('actions' in model).toBe(false)
  })
})

describe('confirmation lifecycle', () => {
  it('derives preview → confirm → invalidated → re-preview from version identity', () => {
    expect(derivePipelineConfirmationPhase('v1')).toBe('none')
    expect(derivePipelineConfirmationPhase('v1', { previewInputVersion: 'v1' })).toBe('previewed')
    expect(derivePipelineConfirmationPhase('v1', { previewInputVersion: 'v1', confirmedInputVersion: 'v1' })).toBe('confirmed')
    // input version changed after confirm → confirmation invalidated, re-preview required
    expect(derivePipelineConfirmationPhase('v2', { previewInputVersion: 'v1', confirmedInputVersion: 'v1' })).toBe('invalidated')
    expect(derivePipelineConfirmationPhase('v2', { previewInputVersion: 'v1' })).toBe('invalidated')
    expect(derivePipelineConfirmationPhase(undefined, { previewInputVersion: 'v1', confirmedInputVersion: 'v1' })).toBe('invalidated')
  })

  it('marks an invalidated confirmation in the view model when the source node version drifts', () => {
    const confirmed = executionModel({ confirmation: { previewInputVersion: 'v1', confirmedInputVersion: 'v1' } })
    expect(confirmed.confirmation).toMatchObject({ phase: 'confirmed', requiresRepreview: false })
    const drifted = executionModel({
      nodes: nodes('v2'),
      confirmation: { previewInputVersion: 'v1', confirmedInputVersion: 'v1' },
    })
    expect(drifted.confirmation.phase).toBe('invalidated')
    expect(drifted.confirmation.requiresRepreview).toBe(true)
    expect(drifted.confirmation.reason).toContain('re-preview')
  })
})

describe('PipelineInspector component', () => {
  it('renders the empty state when nothing is selected', () => {
    render(<PipelineInspector model={{ selection: 'none' }} />)
    expect(screen.getByText('No edge selected')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Select an execution edge')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders reference edges as relationship info only, without execution controls', () => {
    render(<PipelineInspector model={buildPipelineInspectorViewModel({ edge: referenceEdge(), nodes: nodes() })} />)
    expect(screen.getByText('Reference edge')).toBeTruthy()
    expect(screen.getByText(/never trigger execution/)).toBeTruthy()
    expect(screen.getByText('stylistic reference')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders run details, evidence refs and the confirmation state for execution edges', () => {
    render(<PipelineInspector model={executionModel({
      budget: { spent: 12, limit: 500, currency: 'credits' },
      confirmation: { previewInputVersion: 'v1', confirmedInputVersion: 'v1' },
    })} />)
    expect(screen.getByText('Pipeline run')).toBeTruthy()
    expect(screen.getByText('run-one')).toBeTruthy()
    expect(screen.getByText('spent 12 / limit 500 credits')).toBeTruthy()
    expect(screen.getByText('evidence-one')).toBeTruthy()
    expect(screen.getByText(/Confirmed against the current input version/)).toBeTruthy()
  })

  it('omits the budget row entirely when the budget is unknown', () => {
    render(<PipelineInspector model={executionModel()} />)
    expect(screen.queryByText('budget')).toBeNull()
  })

  it('shows the needs_contract reason and disables every run control when the adapter is missing', () => {
    render(<PipelineInspector model={executionModel({ run: undefined })} />)
    expect(screen.getAllByText(/adapter contract is missing/).length).toBeGreaterThan(0)
    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('aria-disabled')).toBe('true')
      expect((button as HTMLButtonElement).disabled).toBe(true)
      expect(button.getAttribute('title')).toBeTruthy()
    }
  })

  it('emits onAction(action, runRef) for enabled actions only and never executes by itself', () => {
    const onAction = vi.fn()
    const model = executionModel({
      run: runProjection('running', {
        actions: [
          { action: 'pause', enabled: true },
          { action: 'resume', enabled: false, disabledReason: 'run is not paused' },
          { action: 'reconcile', enabled: true },
        ],
      }),
    })
    render(<PipelineInspector model={model} onAction={onAction} />)
    const resume = screen.getByRole('button', { name: /Resume/ })
    expect(resume.getAttribute('aria-disabled')).toBe('true')
    expect(resume.getAttribute('title')).toBe('run is not paused')
    fireEvent.click(resume)
    expect(onAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith('pause', 'run-one')
    fireEvent.click(screen.getByRole('button', { name: 'Reconcile' }))
    expect(onAction).toHaveBeenCalledWith('reconcile', 'run-one')
  })
})

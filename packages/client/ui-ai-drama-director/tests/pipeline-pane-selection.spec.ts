// @vitest-environment jsdom
/**
 * Professional-pane selection handoff + candidate adoption backfill
 * (dsh-screenplay-production-continuity-v1 task 3.2 选择联动).
 *
 * Controller-layer coverage for the fixed-reference linkage between the
 * pipeline canvas/Inspector and professional panes (the canonical Scaena
 * 镜头表 keyed by shot_ref/scene_ref, and the 3D Director pane keyed by its
 * scene object refs):
 * - handoff by STABLE ref (projection ref, canvas domainRef, and the 3D
 *   sceneObjectRef → CanvasBinding mapping) — never by array index;
 * - late/duplicate deliveries dropped by the per-source sequence gate;
 * - adoption backfill updates the envelope/object list fixed refs without
 *   reopening the workbench or touching unrelated nodes;
 * - no cross-project/cross-session leakage.
 */
import { describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import {
  createPipelineFixtureOwner,
  PIPELINE_FIXTURE_PROJECT_REF,
} from '../src/client/pipeline/fixture-owner.js'
import {
  PipelineWorkbenchController,
  type PipelineWorkbenchViewStateV1,
} from '../src/client/pipeline/workbench-controller.js'
import { decodePipelinePaneSelectionHandoff } from '../src/client/pipeline/pane-selection.js'

async function readyController() {
  const controller = new PipelineWorkbenchController({ owner: createPipelineFixtureOwner() })
  await controller.load()
  await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
  return controller
}

function handoff(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'dsh.pipeline-pane-selection-handoff.v1alpha1',
    source: 'scaena-table',
    projectRef: PIPELINE_FIXTURE_PROJECT_REF,
    seq: 1,
    issuedAt: Date.now(),
    selection: { kind: 'shot' as const, ref: 'shot:episode01-04' },
    ...overrides,
  }
}

function adoption(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'dsh.pipeline-candidate-adoption.v1alpha1',
    source: 'scaena-table',
    projectRef: PIPELINE_FIXTURE_PROJECT_REF,
    seq: 1,
    issuedAt: Date.now(),
    candidateRef: 'candidate:shot04-c2',
    adoptedVersion: 'v4',
    ...overrides,
  }
}

function objectsOf(state: PipelineWorkbenchViewStateV1) {
  return state.objects.map(object => ({ id: object.id, status: object.status, version: object.version }))
}

describe('professional-pane selection handoff (controller layer)', () => {
  it('applies a scaena-table handoff by the canonical shot ref and anchors the pipeline selection', async () => {
    const controller = await readyController()
    expect(controller.applyPaneSelectionHandoff(handoff())).toEqual({ status: 'applied' })
    const state = controller.getSnapshot()
    // Stable ref → the pipeline/canvas shot node (never an array index).
    expect(state.selectedShot).toMatchObject({ nodeId: 'node:shot04', shotRef: 'shot:episode01-04' })
    expect(state.paneSelection).toMatchObject({ source: 'scaena-table', kind: 'shot', ref: 'shot:episode01-04' })
    expect(controller.getSnapshot().canvas?.getSnapshot().editor?.selection).toEqual(['node:shot04'])
    controller.dispose()
  })

  it('applies a 3d-director handoff by mapping the scene object ref through the CanvasBinding', async () => {
    const controller = await readyController()
    const outcome = controller.applyPaneSelectionHandoff(handoff({
      source: '3d-director',
      seq: 1,
      selection: { kind: 'object', ref: 'scene3d:lin' },
    }))
    expect(outcome).toEqual({ status: 'applied' })
    // scene3d:lin is bound to the character canvas node via the owner binding.
    expect(controller.getSnapshot().canvas?.getSnapshot().editor?.selection).toEqual(['node:char-lin'])
    controller.dispose()
  })

  it('resolves a canvas-only ref through the draft domainRef and stays silent for unknown refs', async () => {
    const controller = await readyController()
    expect(controller.applyPaneSelectionHandoff(handoff({ selection: { kind: 'scene', ref: 'scene:rooftop' } }))).toEqual({ status: 'applied' })
    expect(controller.getSnapshot().canvas?.getSnapshot().editor?.selection).toEqual(['node:scene-rooftop'])
    // Unknown stable ref: dropped with a bounded reason, selection untouched.
    expect(controller.applyPaneSelectionHandoff(handoff({ seq: 2, selection: { kind: 'object', ref: 'ref:unknown' } })))
      .toMatchObject({ status: 'dropped', reason: expect.stringContaining('ref:unknown') })
    expect(controller.getSnapshot().canvas?.getSnapshot().editor?.selection).toEqual(['node:scene-rooftop'])
    controller.dispose()
  })

  it('drops late and duplicate deliveries by the per-source sequence gate', async () => {
    const controller = await readyController()
    expect(controller.applyPaneSelectionHandoff(handoff({ seq: 5 }))).toEqual({ status: 'applied' })
    expect(controller.getSnapshot().paneSelection?.ref).toBe('shot:episode01-04')
    // Duplicate seq: dropped even though the payload is byte-identical.
    expect(controller.applyPaneSelectionHandoff(handoff({ seq: 5 }))).toMatchObject({ status: 'dropped', reason: expect.stringContaining('Late or duplicate') })
    // Late (older) seq: dropped; the selection keeps the newest applied ref.
    expect(controller.applyPaneSelectionHandoff(handoff({ seq: 3, selection: { kind: 'scene', ref: 'scene:rooftop' } })))
      .toMatchObject({ status: 'dropped' })
    expect(controller.getSnapshot().paneSelection?.ref).toBe('shot:episode01-04')
    expect(controller.getSnapshot().canvas?.getSnapshot().editor?.selection).toEqual(['node:shot04'])
    // Per-source isolation: the 3D director stream starts at its own seq 1.
    expect(controller.applyPaneSelectionHandoff(handoff({ source: '3d-director', seq: 1, selection: { kind: 'object', ref: 'scene3d:lin' } }))).toEqual({ status: 'applied' })
    controller.dispose()
  })

  it('drops cross-project payloads without touching the workbench', async () => {
    const controller = await readyController()
    expect(controller.applyPaneSelectionHandoff(handoff({ seq: 7, projectRef: 'project:other' })))
      .toMatchObject({ status: 'dropped', reason: expect.stringContaining('another project') })
    // The cross-project entry never consumed the sequence for THIS project's stream.
    expect(controller.applyPaneSelectionHandoff(handoff({ seq: 7 }))).toEqual({ status: 'applied' })
    expect(controller.getSnapshot().selectedShot?.shotRef).toBe('shot:episode01-04')
    controller.dispose()
  })

  it('fails the handoff contract closed and stays disposal-safe', async () => {
    const controller = await readyController()
    expect(controller.applyPaneSelectionHandoff({ schema: 'dsh.other.v1' })).toMatchObject({ status: 'dropped', reason: expect.stringContaining('schema') })
    expect(controller.applyPaneSelectionHandoff(handoff({ source: 'unknown-pane', seq: 1 }))).toMatchObject({ status: 'dropped' })
    expect(controller.applyPaneSelectionHandoff(handoff({ issuedAt: Date.now() + 60 * 60 * 1000 }))).toMatchObject({ status: 'dropped', reason: expect.stringContaining('clock') })
    expect(decodePipelinePaneSelectionHandoff(handoff({ selection: { kind: 'shot', ref: 'not _safe' } })).ok).toBe(false)
    controller.dispose()
    expect(controller.applyPaneSelectionHandoff(handoff({ seq: 2 }))).toMatchObject({ status: 'dropped', reason: expect.stringContaining('closed') })
  })
})

describe('candidate adoption backfill (controller layer)', () => {
  it('backfills the adopted fixed refs onto the envelope object list without reopening or touching unrelated nodes', async () => {
    const controller = await readyController()
    // Select an unrelated object so the row mapping is observable.
    controller.selectObject('node:shot04')
    const before = objectsOf(controller.getSnapshot())
    const beforeCanvas = controller.getSnapshot().canvas
    const beforeGeneration = controller.getSnapshot().generation

    expect(controller.applyCandidateAdoption(adoption())).toEqual({ status: 'applied' })
    const state = controller.getSnapshot()
    const after = objectsOf(state)
    // Only the matching candidate row changed: adopted status + adopted version.
    expect(after.find(object => object.id === 'node:candidate-c2')).toMatchObject({ status: 'adopted', version: 'v4' })
    expect(after.filter(object => object.id !== 'node:candidate-c2')).toEqual(before.filter(object => object.id !== 'node:candidate-c2'))
    // The adoption is recorded in the view state with its fixed refs.
    expect(state.candidateAdoptions).toEqual([
      expect.objectContaining({ candidateRef: 'candidate:shot04-c2', adoptedVersion: 'v4', seq: 1 }),
    ])
    expect(state.notice).toContain('candidate:shot04-c2')
    // No reopen: same canvas controller instance, no projection re-read.
    expect(state.canvas).toBe(beforeCanvas)
    expect(state.generation).toBe(beforeGeneration)
    controller.dispose()
  })

  it('keeps the newest adoption per candidate and drops late, duplicate and cross-project entries', async () => {
    const controller = await readyController()
    expect(controller.applyCandidateAdoption(adoption({ seq: 10, adoptedVersion: 'v4' }))).toEqual({ status: 'applied' })
    expect(controller.applyCandidateAdoption(adoption({ seq: 10, adoptedVersion: 'v5' }))).toMatchObject({ status: 'dropped' })
    expect(controller.applyCandidateAdoption(adoption({ seq: 4, adoptedVersion: 'v9' }))).toMatchObject({ status: 'dropped' })
    expect(controller.applyCandidateAdoption(adoption({ seq: 11, projectRef: 'project:other' }))).toMatchObject({ status: 'dropped' })
    // Newer adoption of the SAME candidate replaces the record.
    expect(controller.applyCandidateAdoption(adoption({ seq: 11, adoptedVersion: 'v5' }))).toEqual({ status: 'applied' })
    const state = controller.getSnapshot()
    expect(state.candidateAdoptions).toHaveLength(1)
    expect(state.candidateAdoptions[0]).toMatchObject({ adoptedVersion: 'v5', seq: 11 })
    expect(objectsOf(state).find(object => object.id === 'node:candidate-c2')).toMatchObject({ version: 'v5' })
    // A candidate with no matching row is recorded but backfills nothing.
    expect(controller.applyCandidateAdoption(adoption({ seq: 12, candidateRef: 'candidate:not-projected', adoptedVersion: 'v1' }))).toEqual({ status: 'applied' })
    expect(controller.getSnapshot().candidateAdoptions).toHaveLength(2)
    controller.dispose()
  })

  it('shares the per-source sequence stream with selection handoffs', async () => {
    const controller = await readyController()
    expect(controller.applyPaneSelectionHandoff(handoff({ seq: 3 }))).toEqual({ status: 'applied' })
    // Same source, lower seq: the adoption is a late entry in the same stream.
    expect(controller.applyCandidateAdoption(adoption({ seq: 2 }))).toMatchObject({ status: 'dropped', reason: expect.stringContaining('Late or duplicate') })
    expect(controller.applyCandidateAdoption(adoption({ seq: 4 }))).toEqual({ status: 'applied' })
    controller.dispose()
  })

  it('keeps adoptions session-local: a fresh controller never inherits pane-link state', async () => {
    const owner = createPipelineFixtureOwner()
    const first = new PipelineWorkbenchController({ owner })
    await first.load()
    await waitFor(() => expect(first.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
    expect(first.applyCandidateAdoption(adoption())).toEqual({ status: 'applied' })
    first.selectObject('node:shot04')

    // A second session (remount) on the same owner: no cross-session leakage.
    const second = new PipelineWorkbenchController({ owner })
    await second.load()
    await waitFor(() => expect(second.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
    expect(second.getSnapshot().candidateAdoptions).toEqual([])
    expect(second.getSnapshot().paneSelection).toBeUndefined()
    expect(second.getSnapshot().objects.find(object => object.id === 'node:candidate-c2')?.status).toBe('draft')
    first.dispose()
    second.dispose()
  })
})

// @vitest-environment jsdom
/**
 * Pane-link bus — the EMITTING half of the professional-pane selection
 * linkage (dsh-screenplay-production-continuity-v1 task 3.2 选择联动).
 *
 * Covers:
 * - envelope construction stays inside the consuming contracts: every bus
 *   emission re-decodes through the fail-closed consumer decoders;
 * - per-source monotonic sequences assigned at the bus, and a rejected input
 *   consumes no sequence (a rejected emission can never wedge the stream);
 * - the mounted workbench controller's bus intake: stable-ref application,
 *   cross-project fence, adoption backfill, session-locality after dispose;
 * - 3D-director emission: a user pick of a bound scene object publishes a
 *   '3d-director' handoff AND converges the canvas selection (both
 *   directions through the same single selection truth).
 */
import { describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import {
  createPipelineFixtureOwner,
  PIPELINE_FIXTURE_PROJECT_REF,
  PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT,
} from '../src/client/pipeline/fixture-owner.js'
import { PipelineWorkbenchController } from '../src/client/pipeline/workbench-controller.js'
import {
  decodePipelineCandidateAdoption,
  decodePipelinePaneSelectionHandoff,
  type PipelineCandidateAdoptionV1,
  type PipelinePaneSelectionHandoffV1,
} from '../src/client/pipeline/pane-selection.js'
import { createPipelinePaneLinkBus, isPipelinePaneLinkBus, type PipelinePaneLinkBus } from '../src/client/pipeline/pane-link-bus.js'
import { installScene3DJSDOMEnvironment } from './helpers/scene3d.js'

installScene3DJSDOMEnvironment()

describe('pane-link bus envelope contract', () => {
  it('emits handoff envelopes the fail-closed consumer decoder accepts, with per-source monotonic sequences', () => {
    const bus = createPipelinePaneLinkBus()
    const entries: unknown[] = []
    bus.subscribe(entry => entries.push(entry))
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: 'project:one', kind: 'shot', ref: 'shot:episode01-04' })).toBe(true)
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: 'project:one', kind: 'scene', ref: 'scene:rooftop' })).toBe(true)
    // Per-source isolation: the 3D director stream starts at its own seq 1.
    expect(bus.emitPaneSelectionHandoff({ source: '3d-director', projectRef: 'project:one', kind: 'object', ref: 'scene3d:lin' })).toBe(true)
    const decoded = entries.map(entry => decodePipelinePaneSelectionHandoff(entry))
    expect(decoded.every(result => result.ok)).toBe(true)
    expect((decoded[0].value as PipelinePaneSelectionHandoffV1).seq).toBe(1)
    expect((decoded[1].value as PipelinePaneSelectionHandoffV1).seq).toBe(2)
    expect((decoded[2].value as PipelinePaneSelectionHandoffV1).selection).toEqual({ kind: 'object', ref: 'scene3d:lin' })
    expect((decoded[2].value as PipelinePaneSelectionHandoffV1).seq).toBe(1)
  })

  it('rejects contract-violating inputs whole without consuming a sequence', () => {
    const bus = createPipelinePaneLinkBus()
    const seen: unknown[] = []
    bus.subscribe(entry => seen.push(entry))
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: 'project:one', kind: 'shot', ref: 'not _safe' })).toBe(false)
    expect(bus.emitPaneSelectionHandoff({ source: 'unknown-pane' as never, projectRef: 'project:one', kind: 'shot', ref: 'shot:s1' })).toBe(false)
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: 'project:one', kind: 'storyboard' as never, ref: 'shot:s1' })).toBe(false)
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: '', kind: 'shot', ref: 'shot:s1' })).toBe(false)
    // The stream is unwedged: the first accepted emission still takes seq 1.
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: 'project:one', kind: 'shot', ref: 'shot:s1' })).toBe(true)
    expect(bus.emitCandidateAdoption({ source: 'scaena-table', projectRef: 'project:one', candidateRef: 'breakdown:ep01', adoptedVersion: 'sha256:abc' })).toBe(true)
    expect(seen).toHaveLength(2)
    expect((decodePipelinePaneSelectionHandoff(seen[0]).value as PipelinePaneSelectionHandoffV1).seq).toBe(1)
  })

  it('emits adoption envelopes the consumer decoder accepts, with and without the optional artifact', () => {
    const bus = createPipelinePaneLinkBus()
    const entries: unknown[] = []
    bus.subscribe(entry => entries.push(entry))
    expect(bus.emitCandidateAdoption({
      source: 'scaena-table',
      projectRef: 'project:one',
      candidateRef: 'breakdown:ep01',
      adoptedVersion: 'sha256:' + 'a'.repeat(64),
      adoptedForShotRef: 'shot:episode01-04',
    })).toBe(true)
    expect(bus.emitCandidateAdoption({
      source: '3d-director',
      projectRef: 'project:one',
      candidateRef: 'candidate:c2',
      adoptedVersion: 'v5',
      artifact: { owner: 'eikona', kind: 'image', ref: 'candidate:c2', version: 'v5', mediaType: 'image/png', title: 'Shot 04 C2' },
    })).toBe(true)
    expect(bus.emitCandidateAdoption({ source: 'scaena-table', projectRef: 'project:one', candidateRef: 'breakdown:ep01', adoptedVersion: 'bad version!' })).toBe(false)
    expect(bus.emitCandidateAdoption({
      source: 'scaena-table',
      projectRef: 'project:one',
      candidateRef: 'breakdown:ep01',
      adoptedVersion: 'v5',
      artifact: { owner: 'owner with spaces!', kind: 'image', ref: 'candidate:c2', version: 'v5' },
    })).toBe(false)
    const decoded = entries.map(entry => decodePipelineCandidateAdoption(entry))
    expect(decoded.every(result => result.ok)).toBe(true)
    expect((decoded[1].value as PipelineCandidateAdoptionV1).artifact?.ref).toBe('candidate:c2')
    expect(entries).toHaveLength(2)
  })

  it('is dispose-safe: emissions stop dispatching, consume nothing, and subscriptions release', () => {
    const bus = createPipelinePaneLinkBus()
    let deliveries = 0
    bus.subscribe(() => { deliveries += 1 })
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: 'project:one', kind: 'shot', ref: 'shot:s1' })).toBe(true)
    bus.dispose()
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: 'project:one', kind: 'shot', ref: 'shot:s2' })).toBe(false)
    expect(bus.emitCandidateAdoption({ source: 'scaena-table', projectRef: 'project:one', candidateRef: 'c:1', adoptedVersion: 'v1' })).toBe(false)
    expect(deliveries).toBe(1)
    expect(bus.subscribe(() => { deliveries += 1 })).toBeInstanceOf(Function)
    expect(isPipelinePaneLinkBus(bus)).toBe(true)
  })
})

/** Controller with the pane-link bus wired exactly like the pane view wires it. */
async function controllerWithBus(): Promise<{ controller: PipelineWorkbenchController; bus: PipelinePaneLinkBus }> {
  const bus = createPipelinePaneLinkBus()
  const controller = new PipelineWorkbenchController({ owner: createPipelineFixtureOwner(), paneLinkBus: bus })
  await controller.load()
  await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
  return { controller, bus }
}

describe('workbench bus intake (controller layer)', () => {
  it('applies a bus handoff by the canonical shot ref through the fail-closed appliers', async () => {
    const { controller, bus } = await controllerWithBus()
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: PIPELINE_FIXTURE_PROJECT_REF, kind: 'shot', ref: 'shot:episode01-04' })).toBe(true)
    const state = controller.getSnapshot()
    expect(state.selectedShot).toMatchObject({ nodeId: 'node:shot04', shotRef: 'shot:episode01-04' })
    expect(state.paneSelection).toMatchObject({ source: 'scaena-table', kind: 'shot', ref: 'shot:episode01-04' })
    controller.dispose()
  })

  it('fences cross-project bus entries at the consumer and keeps the stream unwedged', async () => {
    const { controller, bus } = await controllerWithBus()
    // The bus itself cannot know the workbench's project; the fence is the consumer's.
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: 'project:other', kind: 'shot', ref: 'shot:episode01-04' })).toBe(true)
    expect(controller.getSnapshot().paneSelection).toBeUndefined()
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: PIPELINE_FIXTURE_PROJECT_REF, kind: 'shot', ref: 'shot:episode01-04' })).toBe(true)
    expect(controller.getSnapshot().paneSelection?.ref).toBe('shot:episode01-04')
    controller.dispose()
  })

  it('records a bus adoption and backfills the candidate row until the next owner refresh', async () => {
    const { controller, bus } = await controllerWithBus()
    expect(bus.emitCandidateAdoption({ source: 'scaena-table', projectRef: PIPELINE_FIXTURE_PROJECT_REF, candidateRef: 'candidate:shot04-c2', adoptedVersion: 'v4' })).toBe(true)
    const state = controller.getSnapshot()
    expect(state.candidateAdoptions).toEqual([expect.objectContaining({ candidateRef: 'candidate:shot04-c2', adoptedVersion: 'v4' })])
    expect(state.objects.find(object => object.id === 'node:candidate-c2')).toMatchObject({ status: 'adopted', version: 'v4' })
    // A newer adoption of the SAME candidate replaces the record (bus seq strictly increases).
    expect(bus.emitCandidateAdoption({ source: 'scaena-table', projectRef: PIPELINE_FIXTURE_PROJECT_REF, candidateRef: 'candidate:shot04-c2', adoptedVersion: 'v5' })).toBe(true)
    expect(controller.getSnapshot().candidateAdoptions[0]).toMatchObject({ adoptedVersion: 'v5' })
    controller.dispose()
  })

  it('stops observing after controller dispose (session-local intake)', async () => {
    const { controller, bus } = await controllerWithBus()
    controller.dispose()
    expect(bus.emitPaneSelectionHandoff({ source: 'scaena-table', projectRef: PIPELINE_FIXTURE_PROJECT_REF, kind: 'shot', ref: 'shot:episode01-04' })).toBe(true)
    // No listener remains; nothing throws and nothing is buffered.
    expect(isPipelinePaneLinkBus(bus)).toBe(true)
  })
})

describe('3D-director pick emission (controller layer)', () => {
  it('publishes a 3d-director handoff for a bound scene-object pick and converges the canvas both ways', async () => {
    const bus = createPipelinePaneLinkBus()
    const entries: unknown[] = []
    bus.subscribe(entry => entries.push(entry))
    const controller = new PipelineWorkbenchController({ owner: createPipelineFixtureOwner(), paneLinkBus: bus })
    await controller.load()
    await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
    // Open the embedded viewport anchored on the fixture shot.
    controller.selectObject('node:shot04')
    controller.openScene3DViewport()
    const scene = controller.getSnapshot().scene3d.controller
    expect(scene).toBeDefined()
    await waitFor(() => expect(scene!.getSnapshot().status).toBe('ready'))

    // User pick of the bound character object (canvasNodeRef → node:char-lin):
    // the pick is published to the bus AND routed through the canvas truth.
    scene!.selectNode('scene3d:lin')
    await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().editor?.selection).toEqual(['node:char-lin']))
    expect(controller.getSnapshot().paneSelection).toMatchObject({ source: '3d-director', kind: 'object', ref: 'scene3d:lin' })
    const decoded = decodePipelinePaneSelectionHandoff(entries.at(-1))
    expect(decoded.ok).toBe(true)
    // Canvas → viewport direction still holds after the pick converges.
    expect(scene!.getSnapshot().selectedNodeId).toBe('scene3d:lin')
    controller.dispose()
  })

  it('fences the pushed-highlight echo and publishes re-picks of the shot-bound camera', async () => {
    const bus = createPipelinePaneLinkBus()
    const entries: unknown[] = []
    bus.subscribe(entry => entries.push(entry))
    const controller = new PipelineWorkbenchController({ owner: createPipelineFixtureOwner(), paneLinkBus: bus })
    await controller.load()
    await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
    controller.selectObject('node:shot04')
    controller.openScene3DViewport()
    const scene = controller.getSnapshot().scene3d.controller
    await waitFor(() => expect(scene!.getSnapshot().status).toBe('ready'))
    // The viewport anchored the shot's bound camera as its pushed highlight:
    // re-selecting that same object is the push echo, not a pick — no
    // handoff, no canvas churn.
    scene!.selectNode(PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(entries).toHaveLength(0)
    expect(controller.getSnapshot().canvas?.getSnapshot().editor?.selection).toEqual(['node:shot04'])
    // After a divergent selection, picking the camera back IS a user pick:
    // published as a handoff and the canvas re-anchors on the shot node.
    scene!.selectNode('scene3d:lin')
    await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().editor?.selection).toEqual(['node:char-lin']))
    scene!.selectNode(PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT)
    await waitFor(() => expect(controller.getSnapshot().paneSelection).toMatchObject({ source: '3d-director', kind: 'object', ref: PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT }))
    expect(controller.getSnapshot().canvas?.getSnapshot().editor?.selection).toEqual(['node:shot04'])
    controller.dispose()
  })
})

// @vitest-environment jsdom
/**
 * Scaena 镜头表 professional-pane emission (dsh-screenplay-production-
 * continuity-v1 task 3.2 选择联动).
 *
 * The Scaena workspace publishes through the pane-link bus:
 * - a selection handoff per user shot click, addressed by the canonical
 *   STABLE shot_ref (never a row position) and fenced by the workspace's
 *   project ref — only once the canonical table view is actually loaded;
 * - a candidate adoption keyed by the table's stable breakdown ref whenever
 *   a scaena.table.* edit settles completed, carrying the owner-confirmed
 *   fixed version (the candidate digest) and the shot the edit applied to;
 * - nothing when no bus is provided: the selection stays purely local.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DomainStudioView } from '../src/domain-studio.tsx'
import { CreatorStudioController } from '../src/controller.ts'
import type { CreatorPaneLinkBusFace } from '../src/views.tsx'
import type { PaneActionDescriptorV1 } from '@yeisme/dsh-pane-protocol'
import { action, creatorContext, creatorSnapshot } from './fixtures.ts'

afterEach(cleanup)

const DIGEST = `sha256:${'a'.repeat(64)}`

function scaenaTableView(shotRefs = ['shot:ep01-04', 'shot:ep01-05']) {
  return {
    schema_version: 'scaena.storyboard_table_view.v1alpha1',
    project_ref: 'project:one',
    breakdown_ref: 'breakdown:ep01',
    candidate_ref: 'scaena:candidate:4',
    candidate_digest: DIGEST,
    expected_version: 4,
    columns: [{ field: 'summary', label: 'Summary' }],
    shots: shotRefs.map((ref, index) => ({ scene_ref: 'scene:ep01', shot_ref: ref, order: index, cells: { summary: 'x' } })),
  }
}

function scaenaOwner(shotRefs: string[], actions: PaneActionDescriptorV1[]) {
  const snapshot = creatorSnapshot()
  const scaena = snapshot.owners.find(owner => owner.owner === 'scaena')!
  return { ...scaena, resources: shotRefs.map(ref => ({ ref, version: '4', kind: 'shot', title: ref, status: 'ready', evidenceRefs: [] })), actions }
}

async function controllerWith(options: {
  readonly shots?: string[]
  readonly actions?: PaneActionDescriptorV1[]
}) {
  const shots = options.shots ?? ['shot:ep01-04', 'shot:ep01-05']
  const actions = options.actions ?? []
  const remote = {
    snapshot: vi.fn(),
    // The dispatch echo settles completed for whatever descriptor the
    // controller submits, carrying the new fixed candidate identity.
    dispatch: vi.fn(async (request: { owner: string; actionId: string }) => ({
      ok: true,
      value: { owner: request.owner, actionId: request.actionId, status: 'completed', receiptRef: 'scaena:candidate:9', summary: 'saved', evidenceRefs: [DIGEST] },
    })),
    resolveArtifact: vi.fn(),
    recallOperationIdentity: vi.fn(async () => ({ ok: true, value: null })),
    readScaenaTable: vi.fn(async () => ({ ok: true, value: { status: 'ready', view: scaenaTableView(shots) } })),
    snapshotOwner: vi.fn(async () => ({ ok: true, value: { ...creatorSnapshot(), owners: [scaenaOwner(shots, actions)] } })),
  }
  const controller = new CreatorStudioController(remote, 'scaena')
  await controller.refresh()
  return { controller, remote }
}

async function openTable(paneLinkBus?: CreatorPaneLinkBusFace) {
  const { controller, remote } = await controllerWith({})
  const rendered = render(<DomainStudioView owner="scaena" mode="production" controller={controller}
    pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} {...(paneLinkBus === undefined ? {} : { paneLinkBus })} />)
  // Open the canonical storyboard table view by its stable breakdown ref.
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'table' } })
  fireEvent.input(screen.getByRole('textbox'), { target: { value: 'breakdown:ep01' } })
  fireEvent.submit(screen.getByRole('textbox').closest('form')!)
  await waitFor(() => expect(remote.readScaenaTable).toHaveBeenCalled())
  await waitFor(() => expect(screen.getByRole('table')).toBeTruthy())
  return { controller, remote, rendered }
}

it('publishes a stable-ref handoff when a shot is selected with the canonical table open', async () => {
  const emitPaneSelectionHandoff = vi.fn(() => true)
  const emitCandidateAdoption = vi.fn(() => true)
  const { remote } = await openTable({ emitPaneSelectionHandoff, emitCandidateAdoption })
  // Click the shot resource row; the handoff carries the FIXED shot_ref and
  // this workspace's project ref, source 'scaena-table'.
  const shotButton = screen.getAllByRole('button').find(button => button.textContent?.includes('shot:ep01-04'))!
  fireEvent.click(shotButton)
  await waitFor(() => expect(emitPaneSelectionHandoff).toHaveBeenCalledWith({ source: 'scaena-table', projectRef: 'project:one', kind: 'shot', ref: 'shot:ep01-04' }))
  expect(emitPaneSelectionHandoff).toHaveBeenCalledTimes(1)
  expect(remote.readScaenaTable).toHaveBeenCalled()
})

it('keeps selection purely local without the pane-link bus', async () => {
  const { remote } = await openTable(undefined)
  const shotButton = screen.getAllByRole('button').find(button => button.textContent?.includes('shot:ep01-04'))!
  fireEvent.click(shotButton)
  await waitFor(() => expect(remote.readScaenaTable).toHaveBeenCalled())
  // No emission surface, no crash: the local selection state still moves.
  expect(screen.getAllByRole('button').some(button => button.getAttribute('aria-pressed') === 'true')).toBe(true)
})

it('publishes a candidate adoption keyed by the breakdown ref when a scaena.table edit settles completed', async () => {
  const emitPaneSelectionHandoff = vi.fn(() => true)
  const emitCandidateAdoption = vi.fn(() => true)
  const tableSet = action('scaena', 'video', 'scaena.table.set')
  const { controller } = await openTable({ emitPaneSelectionHandoff, emitCandidateAdoption })
  // Select the shot first so the adoption carries adoptedForShotRef.
  const shotButton = screen.getAllByRole('button').find(button => button.textContent?.includes('shot:ep01-04'))!
  fireEvent.click(shotButton)
  await waitFor(() => expect(emitPaneSelectionHandoff).toHaveBeenCalled())
  // A completed scaena.table.set receipt: the professional pane adopted a new
  // fixed storyboard candidate version for the table's breakdown ref.
  await controller.dispatchAction(tableSet, { field: 'summary', value: 'Rain, heavier.' })
  await waitFor(() => expect(emitCandidateAdoption).toHaveBeenCalledWith({
    source: 'scaena-table',
    projectRef: 'project:one',
    candidateRef: 'breakdown:ep01',
    adoptedVersion: DIGEST,
    adoptedForShotRef: 'shot:ep01-04',
  }))
  expect(emitCandidateAdoption).toHaveBeenCalledTimes(1)
})

it('does not publish an adoption for other owners receipts', async () => {
  const emitPaneSelectionHandoff = vi.fn(() => true)
  const emitCandidateAdoption = vi.fn(() => true)
  const otherAction = action('scaena', 'video', 'scaena.package.open')
  const { controller } = await openTable({ emitPaneSelectionHandoff, emitCandidateAdoption })
  await controller.dispatchAction(otherAction, { brief: 'x' })
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(emitCandidateAdoption).not.toHaveBeenCalled()
})

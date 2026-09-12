// @vitest-environment jsdom
/**
 * D6 integration: pipeline workbench pane registration (probe-first degrade),
 * fixture projection render chain (capsule + canvas + inspector), capsule
 * switching invariants, media drop handoff, dispose symmetry, and the
 * reopen-without-replay guarantee.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { Context } from '@deepseek-ai/cordis'
import { PaneViewDescriptorSchema } from '@yeisme/dsh-pane-protocol'
import { apply } from '../src/client/index.js'
import {
  createPipelineFixtureOwner,
  PIPELINE_FIXTURE_BLOCKED_EDGE_ID,
  PIPELINE_FIXTURE_BLOCKED_RUN_REF,
  PIPELINE_FIXTURE_OWNER_SERVICE,
  PIPELINE_FIXTURE_PROJECT_REF,
  PIPELINE_FIXTURE_RUNNING_EDGE_ID,
  PIPELINE_FIXTURE_RUNNING_RUN_REF,
  type PipelineFixtureOwnerV1,
} from '../src/client/pipeline/fixture-owner.js'
import {
  PipelineWorkbenchController,
  PIPELINE_WORKBENCH_NO_CHANNEL_REASON,
  type PipelineWorkbenchRunActionRequestV1,
} from '../src/client/pipeline/workbench-controller.js'
import {
  createPipelineWorkbenchView,
  PIPELINE_WORKBENCH_PANE_KIND,
  PIPELINE_WORKBENCH_UNAVAILABLE_REASON,
} from '../src/client/pipeline/workbench-pane.js'
import { PIPELINE_MEDIA_DRAG_MIME, PIPELINE_MEDIA_DRAG_SCHEMA } from '../src/client/pipeline/media-drag.js'

beforeEach(() => {
  class TestResizeObserver { observe() {} disconnect() {} unobserve() {} }
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

interface RegisteredView {
  readonly descriptor: Record<string, unknown>
  readonly component: () => ReturnType<typeof createElement>
}

function fakePane() {
  const views = new Map<string, RegisteredView>()
  return {
    views,
    registerView(input: unknown) {
      const registration = input as RegisteredView
      const kind = registration.descriptor.kind as string
      if (views.has(kind)) throw new Error(`duplicate_kind ${kind}`)
      views.set(kind, registration)
      return () => { views.delete(kind) }
    },
    openView() {},
  }
}

function dropDataTransfer(payload: unknown): { types: string[]; getData(type: string): string; setData(type: string, data: string): void } {
  const data = new Map<string, string>()
  if (payload !== undefined) data.set(PIPELINE_MEDIA_DRAG_MIME, typeof payload === 'string' ? payload : JSON.stringify(payload))
  return {
    types: payload === undefined ? [] : [PIPELINE_MEDIA_DRAG_MIME],
    getData: type => data.get(type) ?? '',
    setData: (type, value) => { data.set(type, value) },
  }
}

function validMediaPayload(): unknown {
  return { schema: PIPELINE_MEDIA_DRAG_SCHEMA, ref: 'media:still-01', kind: 'image', version: 'v1' }
}

async function renderWorkbench(owner: PipelineFixtureOwnerV1, newId?: () => string) {
  const View = createPipelineWorkbenchView({ owner, ...(newId === undefined ? {} : { newId }) })
  const rendered = render(createElement(View))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Workbench' })).toBeTruthy())
  return rendered
}

async function waitForCanvas(container: HTMLElement): Promise<void> {
  await waitFor(() => expect(container.querySelector('[data-project-canvas="true"]')).toBeTruthy())
}

describe('pipeline workbench pane registration (probe-first)', () => {
  it('registers creator.pipeline and renders a disabled, reasoned surface when no owner probes', async () => {
    const ctx = new Context()
    const pane = fakePane()
    ctx.provide('paneWorkbench', pane)
    const dispose = await apply(ctx as never)

    const registration = pane.views.get(PIPELINE_WORKBENCH_PANE_KIND)
    expect(registration).toBeTruthy()
    expect(() => PaneViewDescriptorSchema.parse(registration!.descriptor)).not.toThrow()
    expect(registration!.descriptor).toMatchObject({
      kind: 'creator.pipeline',
      componentKey: 'drama.pipeline.workbench',
      role: 'content',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
    })

    render(createElement(registration!.component))
    expect(screen.getByText('Pipeline workbench unavailable')).toBeTruthy()
    expect(screen.getByText(PIPELINE_WORKBENCH_UNAVAILABLE_REASON)).toBeTruthy()
    // The disabled surface carries no run/action buttons (no dead buttons).
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()

    dispose()
    expect(pane.views.size).toBe(0)
  })

  it('renders the fixture vertical slice when an explicit fixture owner is provided', async () => {
    const ctx = new Context()
    const pane = fakePane()
    ctx.provide('paneWorkbench', pane)
    ctx.provide(PIPELINE_FIXTURE_OWNER_SERVICE, createPipelineFixtureOwner())
    const dispose = await apply(ctx as never)

    const registration = pane.views.get(PIPELINE_WORKBENCH_PANE_KIND)!
    const { container } = render(createElement(registration.component))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agent' })).toBeTruthy())
    expect(screen.getAllByText('Night Rain').length).toBeGreaterThan(0)
    await waitForCanvas(container)
    expect(screen.getByLabelText('Pipeline edges')).toBeTruthy()
    expect(screen.getByTestId('plw-run-strip')).toBeTruthy()
    dispose()
  })
})

describe('pipeline workbench fixture render chain', () => {
  it('selecting the running execution edge wires the inspector run actions through the host channel', async () => {
    const fixture = createPipelineFixtureOwner()
    const dispatched: PipelineWorkbenchRunActionRequestV1[] = []
    const owner: PipelineFixtureOwnerV1 = {
      ...fixture,
      dispatchRunAction: async input => { dispatched.push(input) },
    }
    await renderWorkbench(owner)

    fireEvent.click(screen.getByRole('button', { name: /Candidate C2 · execution/ }))
    const inspector = await screen.findByLabelText('Pipeline inspector')
    expect(within(inspector).getAllByText('running').length).toBeGreaterThan(0)

    // Server-authored state: pause + reconcile enabled, resume disabled with reason.
    const pause = within(inspector).getByRole('button', { name: 'Pause' })
    expect((pause as HTMLButtonElement).disabled).toBe(false)
    expect(within(inspector).getByRole('button', { name: 'Reconcile' })).toBeTruthy()
    expect(within(inspector).getByRole('button', { name: /^Resume: / }).getAttribute('aria-disabled')).toBe('true')

    fireEvent.click(pause)
    await waitFor(() => expect(dispatched).toHaveLength(1))
    expect(dispatched[0]).toMatchObject({
      schema: 'dsh.creative-pipeline-run-action.v1',
      action: 'pause',
      runRef: PIPELINE_FIXTURE_RUNNING_RUN_REF,
      projectRef: PIPELINE_FIXTURE_PROJECT_REF,
    })
  })

  it('keeps blocked-run mutations disabled while reconcile stays available', async () => {
    const fixture = createPipelineFixtureOwner()
    const dispatched: PipelineWorkbenchRunActionRequestV1[] = []
    const owner: PipelineFixtureOwnerV1 = {
      ...fixture,
      dispatchRunAction: async input => { dispatched.push(input) },
    }
    await renderWorkbench(owner)

    fireEvent.click(screen.getByRole('button', { name: /Candidate P1 · execution/ }))
    const inspector = await screen.findByLabelText('Pipeline inspector')
    expect(within(inspector).getAllByText('blocked').length).toBeGreaterThan(0)
    const pause = within(inspector).getByRole('button', { name: /^Pause: / })
    expect(pause.getAttribute('aria-disabled')).toBe('true')
    expect(within(inspector).getByRole('button', { name: /^Resume: / }).getAttribute('aria-disabled')).toBe('true')
    expect((within(inspector).getByRole('button', { name: 'Reconcile' }) as HTMLButtonElement).disabled).toBe(false)

    // Disabled mutations never reach the channel — no automatic retry, no local execution.
    fireEvent.click(pause)
    expect(dispatched).toHaveLength(0)
    expect(PIPELINE_FIXTURE_BLOCKED_EDGE_ID).toBe('edge:poster-run')
  })

  it('force-disables every run action with a reason when the host action channel is missing', async () => {
    await renderWorkbench(createPipelineFixtureOwner())
    fireEvent.click(screen.getByRole('button', { name: /Candidate C2 · execution/ }))
    const inspector = await screen.findByLabelText('Pipeline inspector')
    const pause = within(inspector).getByRole('button', { name: new RegExp(`^Pause: `) })
    expect(pause.getAttribute('aria-disabled')).toBe('true')
    expect(pause.getAttribute('aria-label')).toContain('Host action channel is unavailable')
  })

  it('wires a valid media drop into a canvas asset-node draft intent and shows reject reasons', async () => {
    let id = 0
    const owner = createPipelineFixtureOwner()
    const { container } = await renderWorkbench(owner, () => `node:dropped-${++id}`)
    await waitForCanvas(container)

    const region = container.querySelector('.plw-canvas-region')!
    fireEvent.drop(region, { dataTransfer: dropDataTransfer(validMediaPayload()), clientX: 120, clientY: 80 })
    await waitFor(() => expect(screen.getByText(/Asset node draft created for media:still-01/)).toBeTruthy())

    // The drop reject path surfaces a bounded, visible reason and adds nothing.
    fireEvent.drop(region, { dataTransfer: dropDataTransfer('not json'), clientX: 10, clientY: 10 })
    await waitFor(() => expect(screen.getByText(/media\.invalid_shape/)).toBeTruthy())
  })
})

describe('pipeline workbench controller invariants', () => {
  it('capsule surface switching never resets projectRef, edge selection, or runs', async () => {
    const controller = new PipelineWorkbenchController({ owner: createPipelineFixtureOwner() })
    await controller.load()
    controller.selectEdge(PIPELINE_FIXTURE_RUNNING_EDGE_ID)
    const before = controller.getSnapshot()
    expect(before.phase).toBe('ready')

    controller.switchSurface('agent')
    const after = controller.getSnapshot()
    expect(after.capsule?.surface).toBe('agent')
    expect(after.projectRef).toBe(before.projectRef)
    expect(after.selectedEdgeId).toBe(PIPELINE_FIXTURE_RUNNING_EDGE_ID)
    expect(after.inspector.selection).toBe('execution')
    expect(after.runStrip).toEqual(before.runStrip)

    controller.switchSurface('workbench')
    expect(controller.getSnapshot().capsule?.surface).toBe('workbench')
    controller.dispose()
  })

  it('runAction without a channel surfaces a notice and executes nothing', async () => {
    const controller = new PipelineWorkbenchController({ owner: createPipelineFixtureOwner() })
    await controller.load()
    await controller.runAction('pause', PIPELINE_FIXTURE_RUNNING_RUN_REF)
    expect(controller.getSnapshot().notice).toBe(PIPELINE_WORKBENCH_NO_CHANNEL_REASON)
    controller.dispose()
  })

  it('runAction defense-in-depth: pause on a blocked run is rejected before the channel, reconcile still passes', async () => {
    const fixture = createPipelineFixtureOwner()
    const dispatched: PipelineWorkbenchRunActionRequestV1[] = []
    const owner: PipelineFixtureOwnerV1 = {
      ...fixture,
      dispatchRunAction: async input => { dispatched.push(input) },
    }
    const controller = new PipelineWorkbenchController({ owner })
    await controller.load()

    // Programmatic call bypassing the disabled UI button: never reaches the channel.
    await controller.runAction('pause', PIPELINE_FIXTURE_BLOCKED_RUN_REF)
    expect(dispatched).toHaveLength(0)
    expect(controller.getSnapshot().notice).toContain('Owner reconcile is required')

    // Reconcile stays the server-authored recovery entry even for a blocked run.
    await controller.runAction('reconcile', PIPELINE_FIXTURE_BLOCKED_RUN_REF)
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]).toMatchObject({ action: 'reconcile', runRef: PIPELINE_FIXTURE_BLOCKED_RUN_REF })
    controller.dispose()
  })

  it('runAction defense-in-depth: a stale run projection rejects resume before the channel', async () => {
    const fixture = createPipelineFixtureOwner()
    const dispatched: PipelineWorkbenchRunActionRequestV1[] = []
    const base = await fixture.snapshot() as Record<string, unknown>
    const runProjections = (base.runProjections as Record<string, unknown>[]).map(entry =>
      entry.runRef === PIPELINE_FIXTURE_RUNNING_RUN_REF ? { ...entry, freshness: 'stale' } : entry)
    const owner: PipelineFixtureOwnerV1 = {
      ...fixture,
      snapshot: async () => ({ ...base, runProjections }),
      dispatchRunAction: async input => { dispatched.push(input) },
    }
    const controller = new PipelineWorkbenchController({ owner })
    await controller.load()
    expect(controller.getSnapshot().phase).toBe('ready')

    await controller.runAction('resume', PIPELINE_FIXTURE_RUNNING_RUN_REF)
    expect(dispatched).toHaveLength(0)
    expect(controller.getSnapshot().notice).toContain('stale')
    controller.dispose()
  })

  it('fails closed on an unreadable owner projection', async () => {
    const owner: PipelineFixtureOwnerV1 = {
      ...createPipelineFixtureOwner(),
      snapshot: async () => ({ schema: 'dsh.creative-pipeline-workbench-snapshot.v1alpha1', project: { ref: 'project:night-rain', label: 'Night Rain' }, capsule: { broken: true }, nodes: [], edges: [], runs: [], runProjections: [] }),
    }
    const controller = new PipelineWorkbenchController({ owner })
    await controller.load()
    const state = controller.getSnapshot()
    expect(state.phase).toBe('disabled')
    expect(state.reason).toContain('pipeline.')
    controller.dispose()
  })

  it('dispose is idempotent and releases the canvas controller and subscriptions', async () => {
    const controller = new PipelineWorkbenchController({ owner: createPipelineFixtureOwner() })
    await controller.load()
    await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
    const listener = vi.fn()
    controller.subscribe(listener)

    controller.dispose()
    controller.dispose()
    expect(() => controller.dispose()).not.toThrow()
    controller.selectEdge(PIPELINE_FIXTURE_RUNNING_EDGE_ID)
    expect(listener).not.toHaveBeenCalled()
    expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready')
    // The disposed canvas rejects further draft edits.
    expect(controller.getSnapshot().canvas?.edit({ type: 'select', ids: ['node:shot04'] })).toBe(false)
  })

  it('reopen restores observer identity only: fresh projection read, zero command replay', async () => {
    const fixture = createPipelineFixtureOwner()
    const dispatched: PipelineWorkbenchRunActionRequestV1[] = []
    const owner: PipelineFixtureOwnerV1 = {
      ...fixture,
      dispatchRunAction: async input => { dispatched.push(input) },
    }
    const View = createPipelineWorkbenchView({ owner })

    const first = render(createElement(View))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Workbench' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Candidate C2 · execution/ }))
    await screen.findByLabelText('Pipeline inspector')
    first.unmount()
    expect(fixture.calls.snapshot).toBe(1)

    const second = render(createElement(View))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Workbench' })).toBeTruthy())
    // Observer identity restored: projection re-read, selection not carried over.
    expect(fixture.calls.snapshot).toBe(2)
    expect(dispatched).toHaveLength(0)
    const inspector = screen.getByLabelText('Pipeline inspector')
    expect(within(inspector).getByText('No edge selected')).toBeTruthy()
    second.unmount()
  })
})

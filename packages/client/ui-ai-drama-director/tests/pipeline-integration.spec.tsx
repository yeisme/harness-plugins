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
import { ProjectCanvasStore, type ProjectCanvasStorage } from '../../../host/creator-studio/src/project-canvas-store.ts'
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
  decodePipelineWorkbenchSnapshotV1,
  PIPELINE_WORKBENCH_NO_CHANNEL_REASON,
  type PipelineConfirmationStoreV1,
  type PipelineWorkbenchOwnerFaceV1,
  type PipelineWorkbenchRunActionRequestV1,
} from '../src/client/pipeline/workbench-controller.js'
import {
  createPipelineWorkbenchView,
  creativePipelineRemoteOwnerFace,
  probePipelineWorkbenchOwner,
  PIPELINE_WORKBENCH_PANE_KIND,
  PIPELINE_WORKBENCH_UNAVAILABLE_REASON,
} from '../src/client/pipeline/workbench-pane.js'
import type { PipelineConfirmationRecordV1 } from '../src/client/pipeline/inspector-state.js'
import type { ProjectCanvasDocument } from '@yeisme/dsh-pane-protocol'
import { PIPELINE_MEDIA_DRAG_MIME, PIPELINE_MEDIA_DRAG_SCHEMA } from '../src/client/pipeline/media-drag.js'

let originalOffsetHeight: PropertyDescriptor | undefined
let originalOffsetWidth: PropertyDescriptor | undefined
let originalGetBBox: PropertyDescriptor | undefined
beforeEach(() => {
  class TestResizeObserver {
    private readonly callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) { this.callback = callback }
    observe(target: Element) {
      queueMicrotask(() => this.callback([{ target, contentRect: {
        width: (target as HTMLElement).offsetWidth || 1,
        height: (target as HTMLElement).offsetHeight || 1,
      } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver))
    }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  // jsdom layout shims required for @xyflow/react edge rendering (see xyflow testing guide).
  class DOMMatrixReadOnlyMock {
    readonly m22: number
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([^)]+)\)/)?.[1]
      this.m22 = scale === undefined ? 1 : Number(scale)
    }
  }
  vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixReadOnlyMock)
  originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
  Object.defineProperties(HTMLElement.prototype, {
    // A large default keeps every fixture node/edge inside the jsdom viewport
    // (onlyRenderVisibleElements culls off-screen geometry).
    offsetHeight: { configurable: true, get(this: HTMLElement) { return parseFloat(this.style.height) || 1000 } },
    offsetWidth: { configurable: true, get(this: HTMLElement) { return parseFloat(this.style.width) || 1600 } },
  })
  originalGetBBox = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox')
  Object.defineProperty(SVGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: 0, height: 0 }) })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  if (originalOffsetHeight !== undefined) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
  if (originalOffsetWidth !== undefined) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth)
  if (originalGetBBox !== undefined) Object.defineProperty(SVGElement.prototype, 'getBBox', originalGetBBox)
  else Reflect.deleteProperty(SVGElement.prototype, 'getBBox')
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

/** Primary edge-selection path: click the edge inside the React Flow canvas. */
async function clickCanvasEdge(container: HTMLElement, edgeId: string): Promise<void> {
  await waitFor(() => expect(container.querySelector(`.react-flow__edge[data-id="${edgeId}"]`)).toBeTruthy())
  fireEvent.click(container.querySelector(`.react-flow__edge[data-id="${edgeId}"]`)!)
}

/**
 * Compact-fallback edge selection: the inspector edge list stays in the DOM
 * (hidden above compact width) as the narrow-screen path. jsdom does not
 * evaluate container queries, so the buttons are matched with hidden: true.
 */
async function clickFallbackEdge(edgeLabel: RegExp): Promise<void> {
  const button = await screen.findByRole('button', { name: edgeLabel, hidden: true })
  fireEvent.click(button)
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
    const { container } = await renderWorkbench(owner)
    await waitForCanvas(container)

    await clickFallbackEdge(/Candidate C2 · execution/)
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
    const { container } = await renderWorkbench(owner)
    await waitForCanvas(container)

    await clickCanvasEdge(container, PIPELINE_FIXTURE_BLOCKED_EDGE_ID)
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
    const { container } = await renderWorkbench(createPipelineFixtureOwner())
    await waitForCanvas(container)
    await clickFallbackEdge(/Candidate C2 · execution/)
    const inspector = await screen.findByLabelText('Pipeline inspector')
    const pause = within(inspector).getByRole('button', { name: new RegExp(`^Pause: `) })
    expect(pause.getAttribute('aria-disabled')).toBe('true')
    expect(pause.getAttribute('aria-label')).toContain('Host action channel is unavailable')
  })

  it('wires a valid media drop inside the React Flow pane into a canvas asset-node draft intent and shows reject reasons', async () => {
    let id = 0
    const owner = createPipelineFixtureOwner()
    const { container } = await renderWorkbench(owner, () => `node:dropped-${++id}`)
    await waitForCanvas(container)

    // Drop lands on the React Flow pane; the seam borrows screenToFlowPosition
    // (zero-sized jsdom rects + identity camera make flow coords equal client coords).
    const stage = container.querySelector('.react-flow')!
    fireEvent.drop(stage, { dataTransfer: dropDataTransfer(validMediaPayload()), clientX: 120, clientY: 80 })
    await waitFor(() => expect(screen.getByText(/Asset node draft created for media:still-01/)).toBeTruthy())
    const dropped = container.querySelector('.react-flow__node[data-id="node:dropped-1"]')
    expect(dropped).toBeTruthy()

    // The drop reject path surfaces a bounded, visible reason and adds nothing.
    fireEvent.drop(stage, { dataTransfer: dropDataTransfer('not json'), clientX: 10, clientY: 10 })
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
    await waitForCanvas(first.container)
    await clickFallbackEdge(/Candidate C2 · execution/)
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

/** Fixture canvas document as returned by the fixture read-only canvas remote. */
async function fixtureCanvasDocument(): Promise<ProjectCanvasDocument> {
  const fixture = createPipelineFixtureOwner()
  const result = await fixture.canvasRemote!.canvasRead({ scope: fixture.canvasScope!, documentId: 'main' }) as { status: string; document: ProjectCanvasDocument }
  return result.document
}

/** Owner face with controllable snapshot + observation hooks (push / available / unavailable). */
function controllableOwner(initial: unknown) {
  let envelope = initial
  let fail = false
  const calls = { snapshot: 0 }
  const push = new Set<() => void>()
  const available = new Set<() => void>()
  const unavailable = new Set<() => void>()
  const base = createPipelineFixtureOwner()
  const owner: PipelineWorkbenchOwnerFaceV1 = {
    canvasRemote: base.canvasRemote,
    canvasScope: base.canvasScope,
    canvasDocumentId: base.canvasDocumentId,
    snapshot: async () => {
      calls.snapshot += 1
      if (fail) throw new Error('owner read failed')
      return envelope
    },
    subscribe: listener => { push.add(listener); return () => { push.delete(listener) } },
    onAvailable: listener => { available.add(listener); return () => { available.delete(listener) } },
    onUnavailable: listener => { unavailable.add(listener); return () => { unavailable.delete(listener) } },
  }
  return {
    owner,
    calls,
    setEnvelope: (next: unknown) => { envelope = next },
    setFail: (next: boolean) => { fail = next },
    firePush: () => { for (const listener of [...push]) listener() },
    fireAvailable: () => { for (const listener of [...available]) listener() },
    fireUnavailable: () => { for (const listener of [...unavailable]) listener() },
  }
}

describe('real owner remote mapping', () => {
  it('reopens an embedded canvas through the same application store without replaying a save', async () => {
    const fixture = createPipelineFixtureOwner()
    const document = { ...await fixtureCanvasDocument(), revision: 0 }
    const context = { ...document.scope, tenantRef: 'tenant:test', principalRef: 'principal:test', revision: '1', membershipRevision: '1', installationRef: 'install:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1' }
    const rows = new Map<string, unknown>()
    const storage: ProjectCanvasStorage = { open: async () => ({ table: () => ({ get: key => rows.get(key), put: async (key, value) => { rows.set(key, structuredClone(value)) } }), close: async () => {} }) }
    let store = new ProjectCanvasStore(storage, () => context)
    await store.save({ requestId: 'seed', document })
    const creator = { canvasRead: (input: unknown) => store.read(input), canvasSave: vi.fn((input: unknown) => store.save(input)), canvasReconcile: (input: unknown) => store.reconcile(input) }
    const remote = { snapshot: async () => ({ ...await fixture.snapshot() as object, canvas: document }) }
    const first = new PipelineWorkbenchController({ owner: creativePipelineRemoteOwnerFace(remote, creator)! })
    await first.load()
    await waitFor(() => expect(first.getSnapshot().canvas?.getSnapshot().editor).toBeTruthy())
    first.getSnapshot().canvas!.edit({ type: 'add', nodes: [{ id: 'persisted-note', kind: 'draft', title: 'Production notes', text: 'Local workbench draft', position: { x: -80, y: 40 }, size: { width: 180, height: 100 } }] })
    await first.getSnapshot().canvas!.save()
    expect(first.getSnapshot().canvas!.getSnapshot().saveStatus).toBe('clean')
    first.dispose(); await store.close()
    store = new ProjectCanvasStore(storage, () => context)
    const second = new PipelineWorkbenchController({ owner: creativePipelineRemoteOwnerFace(remote, creator)! })
    await second.load()
    await waitFor(() => expect(second.getSnapshot().objects.some(node => node.id === 'persisted-note')).toBe(true))
    expect(creator.canvasSave).toHaveBeenCalledTimes(1)
    expect(second.getSnapshot().canvas!.getSnapshot().editor!.document.revision).toBe(2)
    second.dispose(); await store.close()
  })
  it('keeps the compact object list synchronized with canvas edits and undo without inventing run status', async () => {
    const owner = createPipelineFixtureOwner()
    const controller = new PipelineWorkbenchController({ owner })
    await controller.load()
    await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().editor).toBeTruthy())
    const canvas = controller.getSnapshot().canvas!
    canvas.edit({ type: 'add', nodes: [{ id: 'local-draft', kind: 'draft', title: 'Local notes', text: '', position: { x: -120, y: -80 }, size: { width: 180, height: 100 } }] })
    expect(controller.getSnapshot().objects.find(node => node.id === 'local-draft')).toMatchObject({ title: 'Local notes', kind: 'draft' })
    expect(controller.getSnapshot().objects.find(node => node.id === 'local-draft')?.status).toBeUndefined()
    canvas.edit({ type: 'undo' })
    expect(controller.getSnapshot().objects.some(node => node.id === 'local-draft')).toBe(false)
    controller.dispose()
  })
  it('delegates embedded canvas reads, saves and reconciliation to the existing Creator Studio owner', async () => {
    const fixture = createPipelineFixtureOwner()
    const creator = {
      canvasRead: vi.fn(fixture.canvasRemote!.canvasRead),
      canvasSave: vi.fn(async () => ({ status: 'conflict', storageRevision: 4 })),
      canvasReconcile: vi.fn(async () => ({ status: 'unknown' })),
    }
    const pipelineRead = vi.fn()
    const face = probePipelineWorkbenchOwner({ get: key => key === 'remote' ? { creativePipeline: { snapshot: fixture.snapshot, canvasRead: pipelineRead }, creatorStudio: creator } : undefined })!
    const request = { scope: fixture.canvasScope!, documentId: 'main' }
    await face.canvasRemote!.canvasRead(request)
    expect(creator.canvasRead).toHaveBeenCalledWith(request)
    expect(pipelineRead).not.toHaveBeenCalled()
    await expect(face.canvasRemote!.canvasSave({ document: await fixtureCanvasDocument(), requestId: 'save-owner' } as never)).resolves.toMatchObject({ status: 'conflict' })
    await face.canvasRemote!.canvasReconcile({ ...request, requestId: 'save-owner' })
    expect(creator.canvasReconcile).toHaveBeenCalledWith({ ...request, requestId: 'save-owner' })
    const incomplete = creativePipelineRemoteOwnerFace({ snapshot: fixture.snapshot, canvasRead: pipelineRead }, { canvasSave: creator.canvasSave })!
    await expect(incomplete.canvasRemote!.canvasSave({} as never)).resolves.toEqual({ status: 'unavailable' })
    expect(creator.canvasSave).toHaveBeenCalledTimes(1)
  })
  it('maps remote.creativePipeline snapshot/canvasRead onto the owner face with a read-only canvas remote', async () => {
    const fixture = createPipelineFixtureOwner()
    const snapshot = vi.fn(async () => fixture.snapshot())
    const canvasRead = vi.fn(fixture.canvasRemote!.canvasRead)
    const ctx = { get: (key: string) => key === 'remote' ? { creativePipeline: { snapshot, canvasRead } } : undefined }
    const face = probePipelineWorkbenchOwner(ctx)
    expect(face).toBeTruthy()

    await face!.snapshot()
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(face!.canvasRemote).toBeTruthy()
    await face!.canvasRemote!.canvasRead({ scope: fixture.canvasScope!, documentId: 'main' })
    expect(canvasRead).toHaveBeenCalledTimes(1)
    // The single canvas writer stays host-side: this face never writes.
    await expect(face!.canvasRemote!.canvasSave({} as never)).resolves.toEqual({ status: 'unavailable' })
    await expect(face!.canvasRemote!.canvasReconcile({} as never)).resolves.toEqual({ status: 'unavailable' })
    // No observation hooks on the wire face → none fabricated.
    expect(face!.subscribe).toBeUndefined()
    expect(face!.onAvailable).toBeUndefined()
    expect(face!.onUnavailable).toBeUndefined()
  })

  it('falls back to the explicit fixture service only when no real remote probes', () => {
    const fixture = createPipelineFixtureOwner()
    const fixtureOnly = { get: (key: string) => key === PIPELINE_FIXTURE_OWNER_SERVICE ? fixture : undefined }
    expect(probePipelineWorkbenchOwner(fixtureOnly)).toBe(fixture)

    const remoteSnapshot = vi.fn(async () => ({}))
    const both = {
      get: (key: string) => key === 'remote'
        ? { creativePipeline: { snapshot: remoteSnapshot } }
        : key === PIPELINE_FIXTURE_OWNER_SERVICE ? fixture : undefined,
    }
    const face = probePipelineWorkbenchOwner(both)
    expect(face).not.toBe(fixture)
    expect(face).toBeTruthy()
  })

  it('starts the canvas lazily from the envelope-projected canvas binding', async () => {
    const fixture = createPipelineFixtureOwner()
    const document = await fixtureCanvasDocument()
    const canvasRead = vi.fn(fixture.canvasRemote!.canvasRead)
    const remote = {
      snapshot: async () => ({
        ...await fixture.snapshot() as Record<string, unknown>,
        status: 'ready',
        availability: { canvas: 'ready', runs: 'ready' },
        canvas: document,
      }),
      canvasRead,
    }
    const face = creativePipelineRemoteOwnerFace(remote)
    expect(face).toBeTruthy()
    // No explicit canvasScope: the binding arrives inside the snapshot envelope.
    expect(face!.canvasScope).toBeUndefined()

    const controller = new PipelineWorkbenchController({ owner: face! })
    await controller.load()
    expect(controller.getSnapshot().phase).toBe('ready')
    expect(controller.getSnapshot().canvas).toBeTruthy()
    await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
    expect(canvasRead).toHaveBeenCalledWith({ scope: fixture.canvasScope!, documentId: 'main' })
    controller.dispose()
  })
})

describe('degrade envelope rendering', () => {
  it('maps a needs_contract failure envelope to a disabled surface with the owner safe message', async () => {
    const owner: PipelineWorkbenchOwnerFaceV1 = {
      ...createPipelineFixtureOwner(),
      snapshot: async () => ({
        schema: 'dsh.creative-pipeline-workbench-snapshot.v1alpha1',
        status: 'needs_contract',
        reasonCode: 'context_unavailable',
        safeMessage: 'Waiting for a bound pipeline context.',
      }),
    }
    const controller = new PipelineWorkbenchController({ owner })
    await controller.load()
    expect(controller.getSnapshot().phase).toBe('disabled')
    expect(controller.getSnapshot().reason).toBe('Waiting for a bound pipeline context.')
    controller.dispose()

    const View = createPipelineWorkbenchView({ owner })
    render(createElement(View))
    await waitFor(() => expect(screen.getByText('Pipeline workbench unavailable')).toBeTruthy())
    expect(screen.getByText('Waiting for a bound pipeline context.')).toBeTruthy()
  })

  it('maps contract_mismatch to an error surface and unavailable to a disabled surface', async () => {
    const failure = (status: string) => ({
      schema: 'dsh.creative-pipeline-workbench-snapshot.v1alpha1',
      status,
      reasonCode: 'canvas_contract_mismatch',
      safeMessage: `Owner reported ${status}.`,
    })
    const mismatch = new PipelineWorkbenchController({
      owner: { ...createPipelineFixtureOwner(), snapshot: async () => failure('contract_mismatch') },
    })
    await mismatch.load()
    expect(mismatch.getSnapshot().phase).toBe('error')
    expect(mismatch.getSnapshot().reason).toBe('Owner reported contract_mismatch.')
    mismatch.dispose()

    const unavailable = new PipelineWorkbenchController({
      owner: { ...createPipelineFixtureOwner(), snapshot: async () => failure('unavailable') },
    })
    await unavailable.load()
    expect(unavailable.getSnapshot().phase).toBe('disabled')
    unavailable.dispose()
  })

  it('renders a partial snapshot with a degrade banner while the graph stays rendered', async () => {
    const fixture = createPipelineFixtureOwner()
    const base = await fixture.snapshot() as Record<string, unknown>
    const owner: PipelineWorkbenchOwnerFaceV1 = {
      ...fixture,
      snapshot: async () => ({ ...base, status: 'partial', availability: { canvas: 'ready', runs: 'needs_contract' }, runProjections: [] }),
    }
    const { container } = await renderWorkbench(owner)
    await waitFor(() => expect(screen.getByText(/Run projections require the owner contract/)).toBeTruthy())
    await waitForCanvas(container)
    expect(screen.getByTestId('plw-run-strip')).toBeTruthy()
  })

  it('decode consumes status/availability/canvas and rejects a canvas scope mismatch fail-closed', async () => {
    const fixture = createPipelineFixtureOwner()
    const base = await fixture.snapshot() as Record<string, unknown>
    const document = await fixtureCanvasDocument()
    const decoded = decodePipelineWorkbenchSnapshotV1({
      ...base,
      status: 'partial',
      availability: { canvas: 'ready', runs: 'contract_mismatch' },
      canvas: document,
    })
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.value.status).toBe('partial')
      expect(decoded.value.availability).toEqual({ canvas: 'ready', runs: 'contract_mismatch' })
      expect(decoded.value.canvasScope).toEqual(fixture.canvasScope)
    }

    const mismatch = decodePipelineWorkbenchSnapshotV1({
      ...base,
      canvas: { ...document, scope: { ...document.scope, projectRef: 'project:other' } },
    })
    expect(mismatch.ok).toBe(false)
    if (!mismatch.ok) expect(mismatch.failureStatus).toBe('contract_mismatch')
  })
})

describe('R7 refresh semantics', () => {
  it('keeps the decoded graph and shows a compact error strip when a refresh fails', async () => {
    const fixture = createPipelineFixtureOwner()
    const base = await fixture.snapshot()
    const harness = controllableOwner(base)
    const { container } = await renderWorkbench(harness.owner)
    await waitForCanvas(container)

    harness.setFail(true)
    harness.firePush()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('refresh failed'))
    // The graph, capsule, and run strip stay rendered behind the strip.
    expect(container.querySelector('[data-project-canvas="true"]')).toBeTruthy()
    expect(screen.getAllByText('Night Rain').length).toBeGreaterThan(0)
    expect(screen.getByTestId('plw-run-strip')).toBeTruthy()

    // Recovery push re-reads once and clears the strip.
    harness.setFail(false)
    harness.firePush()
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('onAvailable re-reads exactly once per recovery and never retries a failure', async () => {
    const fixture = createPipelineFixtureOwner()
    const harness = controllableOwner(await fixture.snapshot())
    const controller = new PipelineWorkbenchController({ owner: harness.owner })
    await controller.load()
    expect(harness.calls.snapshot).toBe(1)

    harness.fireAvailable()
    await waitFor(() => expect(harness.calls.snapshot).toBe(2))
    expect(controller.getSnapshot().phase).toBe('ready')

    harness.setFail(true)
    harness.fireAvailable()
    await waitFor(() => expect(harness.calls.snapshot).toBe(3))
    // No automatic retry: the failed re-read settles into the error strip only.
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(harness.calls.snapshot).toBe(3)
    expect(controller.getSnapshot().errorStrip).toContain('refresh failed')
    expect(controller.getSnapshot().nodes.length).toBeGreaterThan(0)

    // Disconnect degrades the banner without any re-read.
    harness.fireUnavailable()
    await waitFor(() => expect(controller.getSnapshot().availabilityBanner).toContain('offline'))
    expect(harness.calls.snapshot).toBe(3)
    controller.dispose()
  })

  it('migrates run statuses faithfully across refreshes', async () => {
    const fixture = createPipelineFixtureOwner()
    const base = await fixture.snapshot() as Record<string, unknown>
    const harness = controllableOwner(base)
    const owner: PipelineWorkbenchOwnerFaceV1 = { ...harness.owner, dispatchRunAction: async () => ({}) }
    const controller = new PipelineWorkbenchController({ owner })
    await controller.load()
    controller.selectEdge(PIPELINE_FIXTURE_RUNNING_EDGE_ID)
    let inspector = controller.getSnapshot().inspector
    expect(inspector.selection === 'execution' && inspector.runStatus).toBe('running')

    const staleProjections = (base.runProjections as Record<string, unknown>[]).map(entry =>
      entry.runRef === PIPELINE_FIXTURE_RUNNING_RUN_REF
        ? { ...entry, status: 'stale', reason: 'Owner marked this run projection stale.' }
        : entry)
    harness.setEnvelope({ ...base, runProjections: staleProjections })
    harness.firePush()
    await waitFor(() => {
      const next = controller.getSnapshot().inspector
      expect(next.selection === 'execution' && next.runStatus).toBe('stale')
    })
    inspector = controller.getSnapshot().inspector
    if (inspector.selection === 'execution') {
      const pause = inspector.actions.find(action => action.action === 'pause')
      expect(pause?.enabled).toBe(false)
      expect(pause?.disabledReason).toContain('Owner reconcile is required')
    }
    controller.dispose()
  })
})

describe('R6 confirmation wiring', () => {
  it('preview → confirm → input-version drift invalidates the confirmation', async () => {
    const fixture = createPipelineFixtureOwner()
    const base = await fixture.snapshot() as Record<string, unknown>
    const harness = controllableOwner(base)
    const controller = new PipelineWorkbenchController({ owner: harness.owner })
    await controller.load()
    controller.selectEdge(PIPELINE_FIXTURE_RUNNING_EDGE_ID)

    controller.recordRunPreview(PIPELINE_FIXTURE_RUNNING_EDGE_ID)
    let inspector = controller.getSnapshot().inspector
    expect(inspector.selection === 'execution' && inspector.confirmation.phase).toBe('previewed')

    controller.confirmRunPreview(PIPELINE_FIXTURE_RUNNING_EDGE_ID)
    inspector = controller.getSnapshot().inspector
    expect(inspector.selection === 'execution' && inspector.confirmation.phase).toBe('confirmed')

    // Input version drift after the confirm invalidates it — no silent carry-over.
    const drifted = (base.nodes as Record<string, unknown>[]).map(node =>
      node.id === 'node:shot04' ? { ...node, version: 'v7' } : node)
    harness.setEnvelope({ ...base, nodes: drifted })
    await controller.load()
    inspector = controller.getSnapshot().inspector
    expect(inspector.selection === 'execution' && inspector.confirmation.phase).toBe('invalidated')
    expect(inspector.selection === 'execution' && inspector.confirmation.requiresRepreview).toBe(true)

    // Confirm on a drifted input is refused with a visible reason.
    controller.confirmRunPreview(PIPELINE_FIXTURE_RUNNING_EDGE_ID)
    expect(controller.getSnapshot().notice).toContain('re-preview')

    // Re-preview on the new version restores the previewed phase.
    controller.recordRunPreview(PIPELINE_FIXTURE_RUNNING_EDGE_ID)
    inspector = controller.getSnapshot().inspector
    expect(inspector.selection === 'execution' && inspector.confirmation.phase).toBe('previewed')
    controller.dispose()
  })

  it('records previews in the injected store keyed by the execution edge ref', async () => {
    const fixture = createPipelineFixtureOwner()
    const backing = new Map<string, PipelineConfirmationRecordV1>()
    const keys: string[] = []
    const store: PipelineConfirmationStoreV1 = {
      get: key => backing.get(key),
      set: (key, record) => { keys.push(key); backing.set(key, record) },
    }
    const controller = new PipelineWorkbenchController({ owner: fixture, confirmations: store })
    await controller.load()
    controller.recordRunPreview(PIPELINE_FIXTURE_RUNNING_EDGE_ID)
    expect(keys).toEqual([PIPELINE_FIXTURE_RUNNING_EDGE_ID])
    expect(backing.get(PIPELINE_FIXTURE_RUNNING_EDGE_ID)).toEqual({ previewInputVersion: 'v6' })
    controller.dispose()
  })

  it('shows the invalidated confirmation in the inspector UI', async () => {
    const backing = new Map<string, PipelineConfirmationRecordV1>([
      [PIPELINE_FIXTURE_RUNNING_EDGE_ID, { previewInputVersion: 'v5', confirmedInputVersion: 'v5' }],
    ])
    const store: PipelineConfirmationStoreV1 = {
      get: key => backing.get(key),
      set: (key, record) => { backing.set(key, record) },
    }
    const View = createPipelineWorkbenchView({ owner: createPipelineFixtureOwner(), confirmations: store })
    const { container } = render(createElement(View))
    await waitForCanvas(container)
    await clickFallbackEdge(/Candidate C2 · execution/)
    const inspector = await screen.findByLabelText('Pipeline inspector')
    await waitFor(() => expect(within(inspector).getByText(/confirmation is invalidated/)).toBeTruthy())
  })
})

describe('canvas media drop landing position', () => {
  it('creates the asset node at the converted flow position (rounded, clamped)', async () => {
    const controller = new PipelineWorkbenchController({
      owner: createPipelineFixtureOwner(),
      newId: () => 'node:dropped-x',
    })
    await controller.load()
    await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
    controller.receiveAssetNodeIntent(
      { intent: 'pipeline.create-asset-node', ref: 'media:still-01', mediaKind: 'image', version: 'v1' },
      { x: 120.4, y: 79.6 },
    )
    const node = controller.getSnapshot().canvas?.getSnapshot().editor?.document.nodes.find(item => item.id === 'node:dropped-x')
    expect(node?.position).toEqual({ x: 120, y: 80 })
    expect(node?.kind).toBe('asset')
    controller.dispose()
  })
})

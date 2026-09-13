/**
 * Shared jsdom environment stubs and pipeline scene3d test helpers.
 *
 * `installScene3DJSDOMEnvironment()` registers the beforeEach/afterEach hooks
 * that stub ResizeObserver / DOMMatrixReadOnly / element offsets / SVG getBBox
 * so the React Flow canvas and the scene-tree fallback render under jsdom.
 */
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import type { Scene3DController, Scene3DDirectorRemote } from '@yeisme/dsh-client-ui-3d-director'
import {
  createPipelineFixtureOwner,
  PIPELINE_FIXTURE_SCENE_3D_DOCUMENT_ID,
  PIPELINE_FIXTURE_SHOT_NODE_ID,
} from '../../src/client/pipeline/fixture-owner.js'
import {
  PipelineWorkbenchController,
  type PipelineWorkbenchOwnerFaceV1,
} from '../../src/client/pipeline/workbench-controller.js'
import { createPipelineWorkbenchView } from '../../src/client/pipeline/workbench-pane.js'

/** Registers the jsdom stubs required by the pipeline canvas + scene3d fallback. */
export function installScene3DJSDOMEnvironment(): void {
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
}

/** Owner without the 3D remote (exactOptionalPropertyTypes-safe strip). */
export function ownerWithoutScene3DRemote(): PipelineWorkbenchOwnerFaceV1 {
  const { scene3dRemote: _dropped, ...rest } = createPipelineFixtureOwner()
  return rest
}

/** Owner variant whose envelope drops the scene3d section entirely. */
export function ownerWithoutScene3DProjection(): PipelineWorkbenchOwnerFaceV1 {
  const base = createPipelineFixtureOwner()
  return {
    ...base,
    snapshot: async () => {
      const envelope = await base.snapshot() as Record<string, unknown>
      const { scene3d: _dropped, ...rest } = envelope
      return rest
    },
  }
}

/** Owner variant whose scene3d section fails the transport contract. */
export function ownerWithBrokenScene3DProjection(): PipelineWorkbenchOwnerFaceV1 {
  const base = createPipelineFixtureOwner()
  return {
    ...base,
    snapshot: async () => {
      const envelope = await base.snapshot() as Record<string, unknown>
      return { ...envelope, scene3d: { documentId: PIPELINE_FIXTURE_SCENE_3D_DOCUMENT_ID, shots: [{ broken: true }], bindings: [] } }
    },
  }
}

/** Starts a controller on the given owner and waits for the canvas to be ready. */
export async function readyPipelineController(
  owner: PipelineWorkbenchOwnerFaceV1 = createPipelineFixtureOwner(),
): Promise<PipelineWorkbenchController> {
  const controller = new PipelineWorkbenchController({ owner })
  await controller.load()
  await waitFor(() => expect(controller.getSnapshot().canvas?.getSnapshot().status).toBe('ready'))
  return controller
}

/** Selects the fixture shot node, opens the viewport, and waits for the scene to be ready. */
export async function openScene3DViewport(controller: PipelineWorkbenchController): Promise<Scene3DController> {
  controller.selectObject(PIPELINE_FIXTURE_SHOT_NODE_ID)
  controller.openScene3DViewport()
  const scene = controller.getSnapshot().scene3d.controller
  expect(scene).toBeDefined()
  await waitFor(() => expect(scene!.getSnapshot().status).toBe('ready'))
  return scene!
}

/** Starts a controller with canvas ready and the 3D viewport already open and ready. */
export async function readyScene3DController(
  owner: PipelineWorkbenchOwnerFaceV1 = createPipelineFixtureOwner(),
): Promise<{ controller: PipelineWorkbenchController; scene: Scene3DController }> {
  const controller = await readyPipelineController(owner)
  const scene = await openScene3DViewport(controller)
  return { controller, scene }
}

export function canvasSelection(controller: PipelineWorkbenchController): readonly string[] {
  return controller.getSnapshot().canvas?.getSnapshot().editor?.selection ?? []
}

/** Renders the pipeline workbench view and waits for the canvas region. */
export async function renderPipelineWorkbench(
  owner: PipelineWorkbenchOwnerFaceV1 = createPipelineFixtureOwner(),
  deps: { readonly scene3dRemote?: Scene3DDirectorRemote } = {},
) {
  const View = createPipelineWorkbenchView({
    owner,
    ...(deps.scene3dRemote === undefined ? {} : { scene3dRemote: deps.scene3dRemote }),
  })
  const rendered = render(createElement(View))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Workbench' })).toBeTruthy())
  await waitFor(() => expect(rendered.container.querySelector('[data-project-canvas="true"]')).toBeTruthy())
  return rendered
}

/** Compact object-list selection: the sanctioned selectObject path (jsdom never measures React Flow nodes). */
export function clickObjectRow(container: HTMLElement, title: string): void {
  const row = [...container.querySelectorAll('.plw-object-row')].find(item => item.textContent?.includes(title))
  expect(row, `object row ${title}`).toBeTruthy()
  fireEvent.click(row!)
}

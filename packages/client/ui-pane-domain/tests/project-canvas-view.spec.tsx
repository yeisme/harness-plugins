// @vitest-environment jsdom
/**
 * dsh-project-canvas-continuity-v1 5.2 键盘等价操作：Tab 循环选择、方向键步进移动、
 * Ctrl+D 复制、Delete 移除、Ctrl+Shift+F 适配；输入控件内按键不劫持。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PROJECT_CANVAS_SCHEMA, PANE_ARTIFACT_SCHEMA, type ArtifactRefV1, type ProjectCanvasDocument } from '@yeisme/dsh-pane-protocol'
import { ProjectCanvasController, type ProjectCanvasRemote } from '../src/project-canvas-controller.js'
import { ProjectCanvasView, canvasZh, type CanvasTranslator } from '../src/project-canvas-view.js'

const scope = { workspaceRef: 'workspace:one', projectRef: 'project:one' }
function documentFixture(): ProjectCanvasDocument {
  return { schema: PROJECT_CANVAS_SCHEMA, id: 'main', revision: 0, camera: { x: 0, y: 0, zoom: 1 },
    scope, nodes: [
      { id: 'a', kind: 'draft', title: 'Alpha', text: 'one', position: { x: 0, y: 0 }, size: { width: 100, height: 80 } },
      { id: 'b', kind: 'draft', title: 'Beta', text: 'two', position: { x: 40, y: 0 }, size: { width: 100, height: 80 } },
    ], edges: [] }
}
function setup() {
  let current = documentFixture()
  const remote: ProjectCanvasRemote = {
    canvasRead: vi.fn(async () => ({ status: 'ready', document: current })),
    canvasSave: vi.fn(async request => ({ status: 'saved', requestId: request.requestId, revision: request.document.revision + 1 })),
    canvasReconcile: vi.fn(async () => ({ status: 'unknown' })),
  }
  const controller = new ProjectCanvasController(remote, { scope, documentId: 'main' })
  return { controller, remote, replace: (next: ProjectCanvasDocument) => { current = next } }
}
const t: CanvasTranslator = key => canvasZh[key]
async function mount(controller: ProjectCanvasController, container: HTMLElement): Promise<Root> {
  const root = createRoot(container)
  await act(async () => { root.render(createElement(ProjectCanvasView, { controller, artifacts: [], actions: [], t })) })
  await act(async () => {})
  return root
}
async function key(element: Element, init: KeyboardEventInit): Promise<void> {
  await act(async () => { element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })) })
}

let originalOffsetHeight: PropertyDescriptor | undefined
let originalOffsetWidth: PropertyDescriptor | undefined
let originalGetBBox: PropertyDescriptor | undefined
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
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
    offsetHeight: { configurable: true, get(this: HTMLElement) { return parseFloat(this.style.height) || 1 } },
    offsetWidth: { configurable: true, get(this: HTMLElement) { return parseFloat(this.style.width) || 1 } },
  })
  originalGetBBox = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox')
  Object.defineProperty(SVGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: 0, height: 0 }) })
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  if (originalOffsetHeight !== undefined) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
  if (originalOffsetWidth !== undefined) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth)
  if (originalGetBBox !== undefined) Object.defineProperty(SVGElement.prototype, 'getBBox', originalGetBBox)
  else Reflect.deleteProperty(SVGElement.prototype, 'getBBox')
})

describe('project canvas keyboard equivalents', () => {
  it('cycles selection with Tab, nudges with arrows and duplicates with ctrl+d', async () => {
    const { controller } = setup()
    await controller.load()
    const container = document.createElement('div')
    document.body.append(container)
    const root = await mount(controller, container)
    const surface = container.querySelector('[data-project-canvas="true"]')!
    expect(surface).not.toBeNull()
    expect(surface.querySelector('.ys-context-bar')).not.toBeNull()
    expect(surface.querySelector('.ys-context-title')?.textContent).toBe(canvasZh.title)
    expect(surface.querySelector('.ys-context-value')?.textContent).toBe(scope.projectRef)

    await key(surface, { key: 'Tab' })
    expect(controller.getSnapshot().editor!.selection).toEqual(['a'])
    await key(surface, { key: 'ArrowRight', shiftKey: true })
    expect(controller.getSnapshot().editor!.document.nodes.find(node => node.id === 'a')).toMatchObject({ position: { x: 10, y: 0 } })
    await key(surface, { key: 'Tab' })
    expect(controller.getSnapshot().editor!.selection).toEqual(['b'])
    await key(surface, { key: 'ArrowDown' })
    expect(controller.getSnapshot().editor!.document.nodes.find(node => node.id === 'b')).toMatchObject({ position: { x: 40, y: 1 } })

    await key(surface, { key: 'Tab' })
    await key(surface, { key: 'd', ctrlKey: true })
    const duplicated = controller.getSnapshot().editor!.document
    expect(duplicated.nodes).toHaveLength(3)
    expect(duplicated.nodes.some(node => node.id !== 'a' && node.id !== 'b')).toBe(true)

    await key(surface, { key: 'Delete' })
    expect(controller.getSnapshot().editor!.document.nodes).toHaveLength(2)
    await act(async () => root.unmount())
  })

  it('leaves keystrokes inside text controls alone', async () => {
    const { controller } = setup()
    await controller.load()
    const container = document.createElement('div')
    document.body.append(container)
    const root = await mount(controller, container)
    const surface = container.querySelector('[data-project-canvas="true"]')!
    await key(surface, { key: 'Tab' })
    expect(controller.getSnapshot().editor!.selection).toEqual(['a'])
    const input = container.querySelector('input[type="number"]') as HTMLInputElement
    expect(input).not.toBeNull()
    await key(input, { key: 'ArrowUp', shiftKey: true })
    await key(input, { key: 'Tab' })
    // Editing the selected node through the inspector: only the inspector value path ran, no canvas move.
    const node = controller.getSnapshot().editor!.document.nodes.find(item => item.id === 'a')
    expect(node).toMatchObject({ position: { x: 0, y: 0 } })
    await act(async () => root.unmount())
  })
  it('hides a stale run preview when document inputs change', async () => {
    const { controller } = setup()
    await controller.load()
    const container = document.createElement('div')
    document.body.append(container)
    const root = await mount(controller, container)
    const inspect = [...container.querySelectorAll('button')].find(button => button.textContent === canvasZh.inspect)!
    await act(async () => inspect.click())
    expect(container.textContent).toContain(canvasZh.noExecution)
    await act(async () => { controller.edit({ type: 'text', id: 'a', text: 'new prompt' }) })
    expect(container.textContent).not.toContain(canvasZh.noExecution)
    await act(async () => inspect.click())
    expect(container.textContent).toContain(canvasZh.noExecution)
    await act(async () => { controller.edit({ type: 'select', ids: ['b'] }) })
    expect(container.textContent).not.toContain(canvasZh.noExecution)
    await act(async () => root.unmount())
  })

  it('pans, zooms and clears selection from the keyboard through document camera edits', async () => {
    const { controller } = setup()
    await controller.load()
    const container = document.createElement('div')
    document.body.append(container)
    const root = await mount(controller, container)
    const surface = container.querySelector('[data-project-canvas="true"]')!

    // No selection: arrows pan the camera (screen space / zoom).
    await key(surface, { key: 'ArrowRight' })
    expect(controller.getSnapshot().editor!.document.camera).toEqual({ x: -40, y: 0, zoom: 1 })
    await key(surface, { key: 'ArrowDown', shiftKey: true })
    expect(controller.getSnapshot().editor!.document.camera).toEqual({ x: -40, y: -100, zoom: 1 })

    // Ctrl+= zooms around the stage center (clientWidth is 0 in jsdom, so the
    // camera anchor scales deterministically); Ctrl+- and Ctrl+0 return it.
    await key(surface, { key: '=', ctrlKey: true })
    expect(controller.getSnapshot().editor!.document.camera).toEqual({ x: -48, y: -120, zoom: 1.2 })
    await key(surface, { key: '0', ctrlKey: true })
    expect(controller.getSnapshot().editor!.document.camera).toEqual({ x: -40, y: -100, zoom: 1 })
    await key(surface, { key: '=', ctrlKey: true })
    await key(surface, { key: '-', ctrlKey: true })
    expect(controller.getSnapshot().editor!.document.camera).toEqual({ x: -40, y: -100, zoom: 1 })

    // Plain f fits the whole graph without changing the selection.
    await key(surface, { key: 'Tab' })
    expect(controller.getSnapshot().editor!.selection).toEqual(['a'])
    await key(surface, { key: 'f' })
    const camera = controller.getSnapshot().editor!.document.camera
    expect(Number.isFinite(camera.x) && Number.isFinite(camera.y) && camera.zoom > 0).toBe(true)
    expect(controller.getSnapshot().editor!.selection).toEqual(['a'])

    // Escape clears the selection; undo restores the previous camera step.
    await key(surface, { key: 'Escape' })
    expect(controller.getSnapshot().editor!.selection).toEqual([])
    await act(async () => { controller.edit({ type: 'undo' }) })
    expect(controller.getSnapshot().editor!.document.camera).toEqual({ x: -40, y: -100, zoom: 1 })
    await act(async () => root.unmount())
  })

})

describe('material reference kinds and lazy media (5.1/5.5)', () => {
  const media = (kind: string, mediaType: string): ArtifactRefV1 => ({ schema: PANE_ARTIFACT_SCHEMA, owner: 'eikona', kind, ref: `eikona://asset/${kind}`, version: '1', mediaType, title: `Material ${kind}`, evidenceRefs: [], capabilities: ['preview'] })
  function materialDocument(): ProjectCanvasDocument {
    // All nodes overlap the origin so onlyRenderVisibleElements does not cull
    // them inside the 1px jsdom stage; rendering order still follows the array.
    const position = { x: 0, y: 0 }
    const size = { width: 100, height: 80 }
    return { schema: PROJECT_CANVAS_SCHEMA, id: 'main', revision: 0, camera: { x: 0, y: 0, zoom: 1 }, scope, nodes: [
      { id: 'mat-image', kind: 'material', title: 'Image', artifact: media('image', 'image/png'), position, size },
      { id: 'mat-video', kind: 'material', title: 'Video', artifact: media('video', 'video/mp4'), position, size },
      { id: 'mat-audio', kind: 'material', title: 'Audio', artifact: media('audio', 'audio/mpeg'), position, size },
      { id: 'mat-file', kind: 'material', title: 'File', artifact: media('file', 'application/pdf'), position, size },
      { id: 'mat-domain', kind: 'material', title: 'Domain', artifact: media('shot', 'application/vnd.scaena.shot+json'), position, size },
      { id: 'mat-prompt', kind: 'material', title: 'Prompt', artifact: media('prompt', 'text/markdown'), position, size },
    ], edges: [] }
  }
  function materialSetup() {
    let current = materialDocument()
    const remote: ProjectCanvasRemote = {
      canvasRead: vi.fn(async () => ({ status: 'ready', document: current })),
      canvasSave: vi.fn(async request => ({ status: 'saved', requestId: request.requestId, revision: request.document.revision + 1 })),
      canvasReconcile: vi.fn(async () => ({ status: 'unknown' })),
    }
    return { controller: new ProjectCanvasController(remote, { scope, documentId: 'main' }) }
  }
  async function mountMaterials(controller: ProjectCanvasController, container: HTMLElement, props: Record<string, unknown>): Promise<Root> {
    const root = createRoot(container)
    await act(async () => { root.render(createElement(ProjectCanvasView, { controller, artifacts: [], actions: [], t, ...props })) })
    await act(async () => {})
    return root
  }

  it('labels each material node with its localized reference kind, never color only', async () => {
    const { controller } = materialSetup()
    await controller.load()
    const container = document.createElement('div')
    document.body.append(container)
    const root = await mountMaterials(controller, container, {})
    const kinds = [...container.querySelectorAll('[data-reference-kind-chip]')].map(chip => chip.textContent)
    expect(kinds).toEqual([canvasZh.kindImage, canvasZh.kindVideo, canvasZh.kindAudio, canvasZh.kindFile, canvasZh.kindDomain, canvasZh.kindPrompt])
    expect([...container.querySelectorAll('.canvas-node[data-reference-kind]')].map(node => (node as HTMLElement).dataset.referenceKind)).toEqual(['image', 'video', 'audio', 'file', 'domain', 'prompt'])
    await act(async () => root.unmount())
  })

  it('resolves media lazily on visibility and pauses offscreen video', async () => {
    // Controllable IntersectionObserver: no initial callback, tests flip visibility.
    const observers: IntersectionObserverCallback[] = []
    class TestIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) { observers.push(callback) }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const { controller } = materialSetup()
    await controller.load()
    const container = document.createElement('div')
    document.body.append(container)
    const resolveMedia = vi.fn(async (artifact: ArtifactRefV1) => ({ url: `https://media.invalid/${artifact.kind}.${artifact.kind === 'image' ? 'png' : 'mp4'}`, expiresAt: new Date(Date.now() + 60_000).toISOString() }))
    const root = await mountMaterials(controller, container, { resolveMedia })

    // Offscreen (never intersected): nothing resolves, honest placeholder shown.
    await act(async () => {})
    expect(resolveMedia).not.toHaveBeenCalled()
    expect(container.textContent).toContain(canvasZh.mediaUnavailable)

    // Entering the viewport resolves and renders the media.
    await act(async () => { for (const callback of [...observers]) callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver) })
    await act(async () => {})
    expect(resolveMedia).toHaveBeenCalledTimes(6)
    expect(container.querySelectorAll('.canvas-node img')).toHaveLength(1)

    // Leaving the viewport pauses the playing video without unmounting it.
    const video = container.querySelector('video[data-video="canvas"]')!
    expect(video).not.toBeNull()
    pause.mockClear()
    await act(async () => { for (const callback of [...observers]) callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver) })
    expect(pause).toHaveBeenCalled()
    // The resolved URL stays cached so re-entering the viewport does not refetch.
    expect(resolveMedia).toHaveBeenCalledTimes(6)
    await act(async () => root.unmount())
  })
})

describe('creative pipeline seams', () => {
  const artifact: ArtifactRefV1 = { schema: PANE_ARTIFACT_SCHEMA, owner: 'eikona', kind: 'image', ref: 'eikona://asset/one', version: '4',
    mediaType: 'image/png', title: 'Image', evidenceRefs: [], capabilities: ['preview'] }
  function pipelineDocument(): ProjectCanvasDocument {
    return { schema: PROJECT_CANVAS_SCHEMA, id: 'main', revision: 0, camera: { x: 0, y: 0, zoom: 1 },
      scope, nodes: [
        { id: 'asset', kind: 'asset', title: 'Asset', domainRef: 'creator://asset/one', version: '1', artifact: structuredClone(artifact), position: { x: 0, y: 0 }, size: { width: 100, height: 80 } },
        { id: 'candidate', kind: 'candidate', title: 'Candidate', domainRef: 'creator://candidate/one', version: '1', artifact: structuredClone(artifact), position: { x: 0, y: 0 }, size: { width: 100, height: 80 } },
      ], edges: [{ id: 'e1', kind: 'reference', source: 'asset', target: 'candidate' }] }
  }
  function pipelineSetup() {
    let current = pipelineDocument()
    const remote: ProjectCanvasRemote = {
      canvasRead: vi.fn(async () => ({ status: 'ready', document: current })),
      canvasSave: vi.fn(async request => ({ status: 'saved', requestId: request.requestId, revision: request.document.revision + 1 })),
      canvasReconcile: vi.fn(async () => ({ status: 'unknown' })),
    }
    return { controller: new ProjectCanvasController(remote, { scope, documentId: 'main' }) }
  }
  async function mountWith(controller: ProjectCanvasController, container: HTMLElement, props: Record<string, unknown>): Promise<Root> {
    const root = createRoot(container)
    await act(async () => { root.render(createElement(ProjectCanvasView, { controller, artifacts: [], actions: [], t, ...props })) })
    await act(async () => {})
    return root
  }

  it('reports edge selection through onEdgeSelect without touching editor.selection', async () => {
    const { controller } = pipelineSetup()
    await controller.load()
    const container = document.createElement('div')
    document.body.append(container)
    const onEdgeSelect = vi.fn()
    const root = await mountWith(controller, container, { onEdgeSelect })
    const edge = container.querySelector('.react-flow__edge')
    expect(edge).not.toBeNull()
    await act(async () => { edge!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) })
    expect(onEdgeSelect).toHaveBeenCalledWith('e1')
    expect(controller.getSnapshot().editor!.selection).toEqual([])
    expect(controller.getSnapshot().editor!.past).toEqual([])
    await act(async () => root.unmount())
  })

  it('renders asset and candidate thumbnails through resolveMedia and stays honest without it', async () => {
    const { controller } = pipelineSetup()
    await controller.load()
    const container = document.createElement('div')
    document.body.append(container)
    const resolveMedia = vi.fn(async () => ({ url: 'https://media.invalid/preview.png', expiresAt: new Date(Date.now() + 60_000).toISOString() }))
    const root = await mountWith(controller, container, { resolveMedia })
    const images = [...container.querySelectorAll('.canvas-node img')]
    expect(images).toHaveLength(2)
    expect(images.every(image => (image as HTMLImageElement).src === 'https://media.invalid/preview.png')).toBe(true)
    await act(async () => root.unmount())

    const honest = pipelineSetup()
    await honest.controller.load()
    const plainContainer = document.createElement('div')
    document.body.append(plainContainer)
    const plainRoot = await mountWith(honest.controller, plainContainer, {})
    expect(plainContainer.querySelectorAll('.canvas-node img')).toHaveLength(0)
    expect(plainContainer.textContent).toContain(canvasZh.mediaUnavailable)
    await act(async () => plainRoot.unmount())
  })

  it('hands drop intent a transient screenToFlowPosition without exposing the ReactFlow instance', async () => {
    const { controller } = pipelineSetup()
    await controller.load()
    const container = document.createElement('div')
    document.body.append(container)
    const onCanvasDropIntent = vi.fn()
    const root = await mountWith(controller, container, { onCanvasDropIntent })
    const stage = container.querySelector('.react-flow')!
    expect(stage).not.toBeNull()
    await act(async () => { stage.dispatchEvent(new MouseEvent('drop', { bubbles: true, cancelable: true })) })
    expect(onCanvasDropIntent).toHaveBeenCalledTimes(1)
    const [, toFlowPosition] = onCanvasDropIntent.mock.calls[0]!
    expect(typeof toFlowPosition).toBe('function')
    const point = toFlowPosition({ x: 12, y: 34 })
    expect(typeof point.x).toBe('number')
    expect(typeof point.y).toBe('number')
    // The document must stay untouched: drop intent never edits the draft itself.
    expect(controller.getSnapshot().editor!.document.nodes).toHaveLength(2)
    await act(async () => root.unmount())
  })
})

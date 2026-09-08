// @vitest-environment jsdom
/**
 * dsh-project-canvas-continuity-v1 5.2 键盘等价操作：Tab 循环选择、方向键步进移动、
 * Ctrl+D 复制、Delete 移除、Ctrl+Shift+F 适配；输入控件内按键不劫持。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PROJECT_CANVAS_SCHEMA, type ProjectCanvasDocument } from '@yeisme/dsh-pane-protocol'
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

describe('project canvas keyboard equivalents', () => {
  beforeEach(() => {
    class TestResizeObserver { observe() {} disconnect() {} unobserve() {} }
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
  })
  afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals() })

  it('cycles selection with Tab, nudges with arrows and duplicates with ctrl+d', async () => {
    const { controller } = setup()
    await controller.load()
    const container = document.createElement('div')
    document.body.append(container)
    const root = await mount(controller, container)
    const surface = container.querySelector('[data-project-canvas="true"]')!
    expect(surface).not.toBeNull()

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
})

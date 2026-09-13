// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Director3DSurface, Scene3DController } from '../src/index.ts'
import type { Scene3DDirectorRemote } from '../src/remote.ts'
import { bindingFixture, sceneDocumentFixture, scope, shotFixture } from './fixtures.ts'

let container: HTMLElement
let root: Root | undefined
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
})
afterEach(async () => {
  if (root !== undefined) await act(async () => root?.unmount())
  root = undefined
  container.remove()
})

const IDENTITY = { translate: [0, 0, 0] as [number, number, number], rotate: [0, 0, 0, 1] as [number, number, number], scale: [1, 1, 1] as [number, number, number] }

function previewDocumentFixture() {
  return sceneDocumentFixture({
    nodes: [
      { id: 'root', label: 'Root', kind: 'group', transform: IDENTITY, visible: true },
      { id: 'hero', label: 'Hero', kind: 'mesh', parentId: 'root', transform: IDENTITY, visible: true, resourceRef: 'asset:hero' },
      { id: 'main-camera', label: 'Main camera', kind: 'camera', parentId: 'root', transform: IDENTITY, visible: true, resourceRef: 'camera:main' },
    ],
  })
}

function setupRemote(overrides: Partial<Scene3DDirectorRemote> = {}): Scene3DDirectorRemote {
  return {
    sceneRead: vi.fn(async () => ({ status: 'ready', document: previewDocumentFixture() })),
    saveScene: vi.fn(async request => ({ status: 'saved', requestId: (request as { requestId: string }).requestId, version: (request as { document: { version: number } }).document.version + 1 })),
    reconcileScene: vi.fn(async () => ({ status: 'unknown' })),
    importGlb: vi.fn(async () => ({ status: 'unavailable' })),
    exportGlb: vi.fn(async () => ({ status: 'unavailable' })),
    listChangeSets: vi.fn(async () => ({ status: 'ready', changeSets: [] })),
    ...overrides,
  }
}

async function mountSurface(controller: Scene3DController, props: Record<string, unknown> = {}): Promise<void> {
  root = createRoot(container)
  await act(async () => { root?.render(createElement(Director3DSurface, { controller, forceViewportFallback: true, ...props })) })
  await act(async () => {})
}

function treeRow(nodeId: string): HTMLButtonElement {
  const row = container.querySelector(`[role="treeitem"][data-node-id="${nodeId}"]`)
  expect(row).not.toBeNull()
  return row as HTMLButtonElement
}

describe('Director3DSurface previsualization', () => {
  it('renders the shot navigator with text status and previews the first shot by default', async () => {
    const controller = new Scene3DController(setupRemote(), { scope: { ...scope }, documentId: 'main' }, { shots: [shotFixture()] })
    await mountSurface(controller)
    const options = container.querySelectorAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')
    expect(container.textContent).toContain('delivery pending')
    expect(container.textContent).toContain('Previewing shot shot:opening at frame 0')
    // The shot frames hero + camera: both carry the convergence emphasis marker.
    expect(treeRow('hero').dataset.shotBound).toBe('true')
    expect(treeRow('main-camera').dataset.shotBound).toBe('true')
    expect(treeRow('root').dataset.shotBound).toBe('false')
  })

  it('selecting a shot converges node selection to its camera and resets the playhead', async () => {
    const second = shotFixture({ shotRef: 'shot:closeup', cameraRef: 'camera:absent', frameRange: { start: 10, end: 40, fps: 24 } })
    const controller = new Scene3DController(setupRemote(), { scope: { ...scope }, documentId: 'main' }, { shots: [shotFixture(), second] })
    await mountSurface(controller)
    const rows = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'))
    await act(async () => rows[1]?.click())
    expect(controller.getSnapshot().selectedShotRef).toBe('shot:closeup')
    // No camera node matches camera:absent — selection stays untouched, nothing is faked.
    expect(controller.getSnapshot().selectedNodeId).toBeUndefined()
    expect(container.textContent).toContain('Previewing shot shot:closeup at frame 10')
    await act(async () => rows[0]?.click())
    expect(controller.getSnapshot().selectedShotRef).toBe('shot:opening')
    expect(controller.getSnapshot().selectedNodeId).toBe('main-camera')
    expect(treeRow('main-camera').getAttribute('aria-selected')).toBe('true')
  })

  it('picking a scene node highlights the bound shots without switching the selection', async () => {
    const shots = [shotFixture(), shotFixture({ shotRef: 'shot:unbound', objectRefs: [], visibility: [], keyframes: [] })]
    const controller = new Scene3DController(setupRemote(), { scope: { ...scope }, documentId: 'main' }, { shots, bindings: [bindingFixture()] })
    await mountSurface(controller)
    await act(async () => treeRow('hero').click())
    expect(controller.getSnapshot().selectedNodeId).toBe('hero')
    const bound = container.querySelector('[role="option"][data-shot-ref="shot:opening"]')
    expect(bound?.getAttribute('data-bound')).toBe('true')
    expect(bound?.textContent).toContain('bound to selection')
    expect(container.querySelector('[role="option"][data-shot-ref="shot:unbound"]')?.getAttribute('data-bound')).toBe('false')
    // The shot selection itself never moves on a pick.
    expect(controller.getSnapshot().selectedShotRef).toBeUndefined()
  })

  it('scrubbing the playhead step-samples the preview while the draft stays untouched', async () => {
    const shot = shotFixture({
      keyframes: [
        { id: 'kf-1', frame: 0, objectRef: 'asset:hero', property: 'visibility', value: true },
        { id: 'kf-2', frame: 24, objectRef: 'asset:hero', property: 'visibility', value: false },
      ],
    })
    const controller = new Scene3DController(setupRemote(), { scope: { ...scope }, documentId: 'main' }, { shots: [shot] })
    await mountSurface(controller)
    expect(treeRow('hero').textContent).not.toContain('hidden')
    const scrub = container.querySelector('input[type="range"]') as HTMLInputElement
    expect(scrub).not.toBeNull()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(scrub, '30')
      scrub.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(treeRow('hero').textContent).toContain('hidden')
    expect(container.textContent).toContain('Previewing shot shot:opening at frame 30')
    // Display-only: the controller document keeps the owner truth.
    expect(controller.getSnapshot().document?.nodes.find(node => node.id === 'hero')?.visible).toBe(true)
    expect(controller.getSnapshot().dirty).toBe(false)
  })

  it('renders an honest empty state when the owner projects no shots', async () => {
    const controller = new Scene3DController(setupRemote(), { scope: { ...scope }, documentId: 'main' })
    await mountSurface(controller)
    expect(container.querySelector('[data-shot-nav-empty]')).not.toBeNull()
    expect(container.textContent).toContain('No shots yet')
    expect(container.textContent).not.toContain('Previewing shot')
  })
})

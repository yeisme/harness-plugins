// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Director3DSurface, Scene3DController } from '../src/index.ts'
import type { Scene3DDirectorRemote } from '../src/remote.ts'
import { blockedDocumentFixture, sceneDocumentFixture, scope, shotFixture } from './fixtures.ts'

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

function setupRemote(overrides: Partial<Scene3DDirectorRemote> = {}): Scene3DDirectorRemote {
  return {
    sceneRead: vi.fn(async () => ({ status: 'ready', document: sceneDocumentFixture() })),
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

describe('Director3DSurface state matrix', () => {
  it('renders loading with text and skeleton while reading', async () => {
    let release: ((value: unknown) => void) | undefined
    const remote = setupRemote({ sceneRead: () => new Promise(resolve => { release = resolve }) })
    const controller = new Scene3DController(remote, { scope: { ...scope }, documentId: 'main' })
    await mountSurface(controller)
    expect(container.querySelector('[data-phase="loading"]')).not.toBeNull()
    expect(container.textContent).toContain('Loading scene graph')
    await act(async () => { release?.({ status: 'ready', document: sceneDocumentFixture() }) })
  })

  it('renders the disabled state with reason when the owner reports unavailable', async () => {
    const remote = setupRemote({ sceneRead: async () => ({ status: 'unavailable' }) })
    const controller = new Scene3DController(remote, { scope: { ...scope }, documentId: 'main' })
    await mountSurface(controller)
    expect(container.querySelector('[data-phase="disabled"]')).not.toBeNull()
    expect(container.textContent).toContain('Scene service unavailable')
  })

  it('renders the empty state with a real next step when the scene is missing', async () => {
    const remote = setupRemote({ sceneRead: async () => ({ status: 'missing' }) })
    const controller = new Scene3DController(remote, { scope: { ...scope }, documentId: 'main' })
    await mountSurface(controller)
    expect(container.querySelector('[data-phase="empty"]')).not.toBeNull()
    expect(container.textContent).toContain('No scene yet')
    const button = Array.from(container.querySelectorAll('button')).find(entry => entry.textContent === 'New scene draft')
    expect(button).toBeDefined()
    await act(async () => button?.click())
    expect(controller.getSnapshot().status).toBe('ready')
    expect(controller.getSnapshot().dirty).toBe(true)
  })

  it('renders an error state on schema fail-closed without partial truth', async () => {
    const remote = setupRemote({ sceneRead: async () => ({ status: 'ready', document: { nope: 1 } }) })
    const controller = new Scene3DController(remote, { scope: { ...scope }, documentId: 'main' })
    await mountSurface(controller)
    expect(container.querySelector('[data-phase="error"]')).not.toBeNull()
    expect(container.textContent).toContain('failed the contract')
    expect(container.querySelector('[data-3d-viewport]')).toBeNull()
  })

  it('renders the ready scene: viewport tree, timeline, save state text', async () => {
    const controller = new Scene3DController(setupRemote(), { scope: { ...scope }, documentId: 'main' }, { shots: [shotFixture()] })
    await mountSurface(controller, { shotRef: 'shot:opening' })
    expect(container.textContent).toContain('revision 3')
    expect(container.textContent).toContain('Saved')
    expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(3)
    expect(container.querySelectorAll('.d3d-keyframe')).toHaveLength(2)
  })

  it('freezes into a text conflict strip with reconcile entries and disabled mutations', async () => {
    const remote = setupRemote({ saveScene: async () => ({ status: 'conflict', version: 9 }) })
    const controller = new Scene3DController(remote, { scope: { ...scope }, documentId: 'main' }, { shots: [shotFixture()] })
    await mountSurface(controller, { shotRef: 'shot:opening' })
    await act(async () => { controller.setNodeVisibility('hero', false) })
    await act(async () => { await controller.save() })
    expect(container.querySelector('[data-conflict-frozen]')).not.toBeNull()
    expect(container.textContent).toContain('Revision conflict')
    expect(container.textContent).toContain('revision 3')
    expect(container.textContent).toContain('revision 9')
    const labels = Array.from(container.querySelectorAll('button')).map(entry => entry.textContent)
    expect(labels).toContain('Reapply my draft onto revision 9')
    expect(labels).toContain('Discard my draft')
    const save = Array.from(container.querySelectorAll('button')).find(entry => entry.textContent === 'Save') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(save.title).toContain('frozen')
  })

  it('explains unknown saves and routes to owner reconcile', async () => {
    const remote = setupRemote({
      saveScene: async () => ({ status: 'unknown' }),
      reconcileScene: async () => ({ status: 'saved', requestId: 'save-x', version: 4 }),
    })
    const controller = new Scene3DController(remote, { scope: { ...scope }, documentId: 'main' }, { newId: () => 'save-x' })
    await mountSurface(controller)
    await act(async () => { controller.setNodeVisibility('hero', false) })
    await act(async () => { await controller.save() })
    expect(container.textContent).toContain('Save outcome unknown')
    const reconcile = Array.from(container.querySelectorAll('button')).find(entry => entry.textContent === 'Reconcile save')
    expect(reconcile).toBeDefined()
    await act(async () => { (reconcile as HTMLButtonElement).click() })
    expect(controller.getSnapshot().saveStatus).toBe('clean')
  })

  it('disables export with its reason and lists capability gaps when blocked', async () => {
    const remote = setupRemote({ sceneRead: async () => ({ status: 'ready', document: blockedDocumentFixture() }) })
    const controller = new Scene3DController(remote, { scope: { ...scope }, documentId: 'main' })
    await mountSurface(controller)
    const exportButton = Array.from(container.querySelectorAll('button')).find(entry => entry.textContent === 'Export GLB') as HTMLButtonElement
    expect(exportButton.disabled).toBe(true)
    expect(exportButton.title).toContain('capability gaps')
    await act(async () => { await controller.exportScene() })
    expect(container.querySelector('[data-export-blocked]')).not.toBeNull()
    expect(container.textContent).toContain('KHR_draco_mesh_compression')
    expect(container.textContent).toContain('cannot be re-encoded')
  })

  it('scopes styles under the data-3d-director root', async () => {
    const controller = new Scene3DController(setupRemote(), { scope: { ...scope }, documentId: 'main' })
    await mountSurface(controller)
    expect(container.querySelector('[data-3d-director]')).not.toBeNull()
    const styles = Array.from(container.querySelectorAll('style')).map(entry => entry.textContent ?? '')
    expect(styles.some(text => text.includes('[data-3d-director]'))).toBe(true)
  })
})

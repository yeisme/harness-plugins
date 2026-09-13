// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Director3DViewport, type Viewport3DEngine } from '../src/index.ts'
import { sceneDocumentFixture } from './fixtures.ts'

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

async function mount(element: Parameters<Root['render']>[0]): Promise<void> {
  root = createRoot(container)
  await act(async () => { root?.render(element) })
  await act(async () => {})
}

describe('Director3DViewport fallback tree', () => {
  it('renders the scene hierarchy as a selectable tree when forced to fallback', async () => {
    const onSelect = vi.fn()
    await mount(createElement(Director3DViewport, { document: sceneDocumentFixture(), forceFallback: true, onSelect }))
    expect(container.querySelector('[data-mode="tree"]')).not.toBeNull()
    const rows = container.querySelectorAll('[role="treeitem"]')
    expect(rows).toHaveLength(3)
    const hero = container.querySelector('[data-node-id="hero"]')
    expect(hero?.textContent).toContain('Hero')
    expect(hero?.textContent).toContain('asset ref')
    const light = container.querySelector('[data-node-id="key-light"]')
    expect(light?.textContent).toContain('hidden')
    await act(async () => { (hero as HTMLButtonElement).click() })
    expect(onSelect).toHaveBeenCalledWith('hero')
  })

  it('marks the selected node with aria-selected', async () => {
    await mount(createElement(Director3DViewport, { document: sceneDocumentFixture(), forceFallback: true, selectedNodeId: 'hero' }))
    expect(container.querySelector('[data-node-id="hero"]')?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[data-node-id="root"]')?.getAttribute('aria-selected')).toBe('false')
  })

  it('shows an empty state for a scene without nodes', async () => {
    const empty = sceneDocumentFixture({ scenes: [{ id: 'main', label: 'Main scene', rootNodeIds: [], default: true }], nodes: [] })
    await mount(createElement(Director3DViewport, { document: empty, forceFallback: true }))
    expect(container.querySelector('[data-scene-tree-empty]')).not.toBeNull()
  })

  it('degrades to the tree in jsdom where WebGL is unavailable (default engine factory)', async () => {
    const onSelect = vi.fn()
    await mount(createElement(Director3DViewport, { document: sceneDocumentFixture(), onSelect }))
    expect(container.querySelector('[data-mode="tree"]')).not.toBeNull()
    await act(async () => { (container.querySelector('[data-node-id="hero"]') as HTMLButtonElement).click() })
    expect(onSelect).toHaveBeenCalledWith('hero')
  })
})

describe('Director3DViewport engine lifecycle', () => {
  it('drives an injected engine and disposes it exactly once on unmount (idempotent)', async () => {
    const engine: Viewport3DEngine & { setDocument: ReturnType<typeof vi.fn>; setSelected: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> } = {
      setDocument: vi.fn(),
      setSelected: vi.fn(),
      dispose: vi.fn(),
    }
    const createEngine = vi.fn(() => engine)
    await mount(createElement(Director3DViewport, { document: sceneDocumentFixture(), createEngine, selectedNodeId: 'root' }))
    expect(createEngine).toHaveBeenCalledTimes(1)
    expect(engine.setDocument).toHaveBeenCalled()
    expect(engine.setSelected).toHaveBeenCalledWith('root')
    expect(container.querySelector('[data-mode="webgl"]')).not.toBeNull()
    await act(async () => { root?.unmount() })
    root = undefined
    expect(engine.dispose).toHaveBeenCalledTimes(1)
    // Double unmount safety: dispose must not fire again.
    await act(async () => {})
    expect(engine.dispose).toHaveBeenCalledTimes(1)
  })

  it('falls back when the injected factory cannot create an engine', async () => {
    await mount(createElement(Director3DViewport, { document: sceneDocumentFixture(), createEngine: () => undefined }))
    expect(container.querySelector('[data-mode="tree"]')).not.toBeNull()
  })
})

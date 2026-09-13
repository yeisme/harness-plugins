// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { NodeTransformEditor, SCENE_3D_TRANSFORM_COMPONENT_LIMIT } from '../src/NodeTransformEditor.tsx'
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
}

function setInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function field(label: string): HTMLInputElement {
  const input = Array.from(container.querySelectorAll('input[type="number"]'))
    .find(entry => entry.getAttribute('aria-label') === label) as HTMLInputElement | undefined
  expect(input, `field ${label}`).toBeDefined()
  return input!
}

const hero = () => sceneDocumentFixture().nodes.find(node => node.id === 'hero')!

describe('NodeTransformEditor', () => {
  it('renders the node head and all transform vector groups', async () => {
    await mount(createElement(NodeTransformEditor, { node: hero() }))
    expect(container.textContent).toContain('Hero')
    expect(container.textContent).toContain('mesh · hero')
    for (const label of ['Translate X', 'Translate Y', 'Translate Z', 'Rotate (quaternion) W', 'Scale X']) {
      expect(field(label)).toBeDefined()
    }
    expect(field('Translate X').value).toBe('1')
  })

  it('routes finite component edits as draft transform patches', async () => {
    const onEditTransform = vi.fn()
    await mount(createElement(NodeTransformEditor, { node: hero(), onEditTransform }))
    await act(async () => setInput(field('Translate Y'), '2.5'))
    expect(onEditTransform).toHaveBeenCalledWith({ translate: [1, 2.5, 0] })
  })

  it('rejects non-finite input with a reason and never touches the draft', async () => {
    const onEditTransform = vi.fn()
    await mount(createElement(NodeTransformEditor, { node: hero(), onEditTransform }))
    await act(async () => setInput(field('Translate X'), ''))
    expect(onEditTransform).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('must be a finite number')
  })

  it('rejects components beyond the bounded magnitude with a reason', async () => {
    const onEditTransform = vi.fn()
    await mount(createElement(NodeTransformEditor, { node: hero(), onEditTransform }))
    await act(async () => setInput(field('Scale X'), String(SCENE_3D_TRANSFORM_COMPONENT_LIMIT + 1)))
    expect(onEditTransform).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('bound')
  })

  it('routes the visibility toggle as a draft visibility intent', async () => {
    const onSetVisibility = vi.fn()
    const keyLight = sceneDocumentFixture().nodes.find(node => node.id === 'key-light')!
    await mount(createElement(NodeTransformEditor, { node: keyLight, onSetVisibility }))
    const toggle = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(toggle.checked).toBe(false)
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set
      setter?.call(toggle, true)
      toggle.dispatchEvent(new Event('click', { bubbles: true }))
    })
    expect(onSetVisibility).toHaveBeenCalledWith(true)
  })

  it('disables every editing affordance with the read-only reason when frozen', async () => {
    await mount(createElement(NodeTransformEditor, {
      node: hero(),
      disabled: true,
      disabledReason: 'Writes are frozen until the revision conflict is reconciled.',
      onEditTransform: vi.fn(),
      onSetVisibility: vi.fn(),
    }))
    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[]
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) expect(input.disabled).toBe(true)
    expect(container.querySelector('[role="status"]')?.textContent).toContain('frozen')
  })

  it('explains that camera-specific parameters stay with the asset owner', async () => {
    const camera = { ...hero(), id: 'cam:main', kind: 'camera' as const }
    await mount(createElement(NodeTransformEditor, { node: camera }))
    expect(container.textContent).toContain('fov')
    expect(container.textContent).toContain('not part of the SceneDocumentV1 contract')
  })
})

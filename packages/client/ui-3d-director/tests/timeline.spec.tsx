// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ShotTimeline } from '../src/index.ts'
import { shotFixture } from './fixtures.ts'

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

describe('ShotTimeline', () => {
  it('lists keyframes with frame/property accessible names and selects on click', async () => {
    const onSelectKeyframe = vi.fn()
    await mount(createElement(ShotTimeline, { shot: shotFixture(), playhead: 0, onSelectKeyframe }))
    const markers = container.querySelectorAll('.d3d-keyframe')
    expect(markers).toHaveLength(2)
    expect(markers[0]?.getAttribute('aria-label')).toContain('translate at frame 0')
    expect(markers[1]?.getAttribute('aria-label')).toContain('visibility at frame 24')
    await act(async () => { (markers[1] as HTMLButtonElement).click() })
    expect(onSelectKeyframe).toHaveBeenCalledWith('kf-2')
  })

  it('scrubs the playhead through the range input', async () => {
    const onScrub = vi.fn()
    await mount(createElement(ShotTimeline, { shot: shotFixture(), playhead: 0, onScrub }))
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider.min).toBe('0')
    expect(slider.max).toBe('48')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(slider, '12')
      slider.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onScrub).toHaveBeenCalledWith(12)
  })

  it('emits a draft edit intent when the selected keyframe frame changes', async () => {
    const onEditKeyframe = vi.fn()
    await mount(createElement(ShotTimeline, { shot: shotFixture(), playhead: 0, selectedKeyframeId: 'kf-1', onEditKeyframe }))
    const input = container.querySelector('input[type="number"]') as HTMLInputElement
    expect(input.disabled).toBe(false)
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '30')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onEditKeyframe).toHaveBeenCalledWith({ type: 'move-keyframe', keyframeId: 'kf-1', frame: 30 })
  })

  it('keeps edits disabled (with reason) while the workbench is read-only', async () => {
    await mount(createElement(ShotTimeline, { shot: shotFixture(), playhead: 0, selectedKeyframeId: 'kf-1', disabled: true, onEditKeyframe: vi.fn() }))
    const input = container.querySelector('input[type="number"]') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(input.title).toContain('read-only')
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider.disabled).toBe(true)
  })

  it('shows a text empty state for shots without keyframes', async () => {
    await mount(createElement(ShotTimeline, { shot: shotFixture({ keyframes: [] }), playhead: 0 }))
    expect(container.textContent).toContain('No keyframes')
  })
})

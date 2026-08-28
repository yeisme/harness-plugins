// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { edgeAnchorSide, placeToolbar, SelectionToolbarController, TOOLBAR_GAP_PX } from '../../src/client/toolbar.ts'
import { labelsFor } from '../../src/client/locales.ts'

const VIEWPORT = { width: 1280, height: 800 }
const TOOLBAR = { width: 320, height: 36 }

describe('toolbar placement', () => {
  it('floats 8px above the selection when there is room', () => {
    const placement = placeToolbar({ selection: { top: 300, left: 400, width: 200, height: 40 }, viewport: VIEWPORT, toolbar: TOOLBAR })
    expect(placement.flipped).toBe(false)
    expect(placement.y).toBe(300 - TOOLBAR.height - TOOLBAR_GAP_PX)
    expect(placement.x).toBe(500 - TOOLBAR.width / 2)
  })

  it('flips below when the selection is too close to the top', () => {
    const placement = placeToolbar({ selection: { top: 10, left: 400, width: 200, height: 40 }, viewport: VIEWPORT, toolbar: TOOLBAR })
    expect(placement.flipped).toBe(true)
    expect(placement.y).toBe(10 + 40 + TOOLBAR_GAP_PX)
  })

  it('clamps horizontally so the bar never leaves the viewport', () => {
    const left = placeToolbar({ selection: { top: 300, left: 0, width: 10, height: 40 }, viewport: VIEWPORT, toolbar: TOOLBAR })
    expect(left.x).toBeGreaterThanOrEqual(0)
    const right = placeToolbar({ selection: { top: 300, left: VIEWPORT.width - 20, width: 10, height: 40 }, viewport: VIEWPORT, toolbar: TOOLBAR })
    expect(right.x + TOOLBAR.width).toBeLessThanOrEqual(VIEWPORT.width)
  })

  it('collapses to an edge anchor instead of disappearing when scrolled out', () => {
    expect(edgeAnchorSide({ top: -300, height: 40 }, VIEWPORT)).toBe('top')
    expect(edgeAnchorSide({ top: 1200, height: 40 }, VIEWPORT)).toBe('bottom')
    expect(edgeAnchorSide({ top: 300, height: 40 }, VIEWPORT)).toBeNull()
  })
})

describe('toolbar DOM controller', () => {
  it('shows, hides and forwards actions with keyboard navigation and Esc', () => {
    const onAction = vi.fn()
    const controller = new SelectionToolbarController({ labels: labelsFor('zh-CN'), onAction })
    const element = document.querySelector('.dsh-selection-toolbar') as HTMLElement
    expect(element).not.toBeNull()
    expect(controller.isHidden()).toBe(true)

    const placement = controller.show({ top: 300, left: 400, width: 200, height: 40 }, VIEWPORT)
    expect(placement.flipped).toBe(false)
    expect(controller.isHidden()).toBe(false)

    const buttons = Array.from(element.querySelectorAll('button'))
    expect(buttons.length).toBeGreaterThanOrEqual(4)
    buttons[0]?.click()
    expect(onAction).toHaveBeenCalledWith('ask')

    const focused = controller.moveFocus(1)
    expect(focused).toBe(buttons[0])
    expect(document.activeElement).toBe(buttons[0])
    expect(controller.moveFocus(1)).toBe(buttons[1])
    expect(document.activeElement).toBe(buttons[1])

    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.dispatchEvent(esc)
    expect(controller.isHidden()).toBe(true)
    controller.dispose()
    expect(document.querySelector('.dsh-selection-toolbar')).toBeNull()
  })

  it('degrades to icon buttons in narrow panes while keeping labels', () => {
    const controller = new SelectionToolbarController({ labels: labelsFor('zh-CN'), onAction: () => {}, narrow: true })
    const element = document.querySelector('.dsh-selection-toolbar') as HTMLElement
    const first = element.querySelector('button') as HTMLButtonElement
    expect(first.textContent).not.toContain('问 Agent')
    expect(first.getAttribute('aria-label')).toBe('问 Agent')
    controller.setNarrow(false)
    expect(first.textContent).toContain('问 Agent')
    controller.dispose()
  })

  it('collapses to a viewport edge on demand', () => {
    const controller = new SelectionToolbarController({ labels: labelsFor('en-US'), onAction: () => {} })
    controller.collapseToEdge('top')
    const element = document.querySelector('.dsh-selection-toolbar') as HTMLElement
    expect(element.style.display).toBe('flex')
    expect(element.classList.contains('dsh-selection-toolbar--edge')).toBe(true)
    controller.dispose()
  })
})

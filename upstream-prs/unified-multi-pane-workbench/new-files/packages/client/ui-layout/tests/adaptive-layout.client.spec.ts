import { describe, expect, it } from 'vitest'
import { emptyWorkspace, groupForPane, layoutAxis, layoutBoxes, movePane, openPane, type PaneReference } from '../src/client/workspace-model.ts'
import { hitTestLayout, resizeSplit } from '../src/client/workspace-service.ts'

const view = { x: 0, y: 0, width: 1200, height: 900 }
const chat = (id: string): PaneReference => ({ id, kind: 'conversation', sessionId: id, title: id, pinned: true })
function pair() {
  let state = openPane(openPane(emptyWorkspace('A'), chat('a')), chat('b'))
  state = movePane(state, 'b', { type: 'split', groupId: state.focused!, edge: 'right' })
  return state
}
describe('adaptive Pane docking', () => {
  it('detects broad proportional edges instead of requiring a 40px target', () => {
    const state = pair(), group = groupForPane(state, 'a')!
    expect(hitTestLayout(state, view, 300, 115, 'b').destination).toEqual({ type: 'split', groupId: group.id, edge: 'top' })
    expect(hitTestLayout(state, view, 490, 450, 'b').destination).toEqual({ type: 'split', groupId: group.id, edge: 'right' })
  })
  it('retains the current edge briefly past its boundary, without locking the next target', () => {
    const state = pair(), group = groupForPane(state, 'a')!
    const previous = { type: 'split', groupId: group.id, edge: 'top' } as const
    expect(hitTestLayout(state, view, 300, 177, 'b', { previous }).destination).toEqual(previous)
    expect(hitTestLayout(state, view, 300, 210, 'b', { previous }).destination?.type).toBe('tab')
    expect(hitTestLayout(state, view, 5, 120, 'b', { previous }).destination).toEqual({ type: 'split', groupId: group.id, edge: 'left' })
  })
  it('joins another group from its body, while Alt and same-group tear-off retain floating', () => {
    const state = pair()
    expect(hitTestLayout(state, view, 300, 450, 'b').destination?.type).toBe('tab')
    expect(hitTestLayout(state, view, 300, 450, 'a').destination?.type).toBe('float')
    expect(hitTestLayout(state, view, 490, 450, 'b', { float: true }).destination?.type).toBe('float')
    expect(hitTestLayout(state, view, 300, 450, undefined, { bodyMerge: false }).destination?.type).toBe('float')
  })
  it('stacks narrow splits without rewriting the preferred tree or ratio', () => {
    const state = pair(), narrow = { ...view, width: 420 }
    const original = JSON.stringify(state), a = groupForPane(state, 'a')!, b = groupForPane(state, 'b')!
    const boxes = layoutBoxes(state, narrow)
    expect(boxes[a.id]!.width).toBe(420); expect(boxes[b.id]!.width).toBe(420)
    expect(boxes[b.id]!.y).toBeGreaterThan(boxes[a.id]!.y)
    expect(layoutBoxes(state, view)[a.id]!.height).toBe(900)
    expect(JSON.stringify(state)).toBe(original)
    expect(state.root!.type === 'split' && layoutAxis(state.root, state, narrow)).toBe('vertical')
    const resized = resizeSplit(state, state.root!.id, 300, narrow)
    expect(layoutBoxes(resized, narrow)[a.id]!.height).toBeCloseTo(300)
  })
  it('clamps preferred ratios to readable sizes when the viewport narrows', () => {
    const state = pair()
    if (state.root?.type !== 'split') throw new Error('Expected split')
    state.root.ratio = .24
    const boxes = layoutBoxes(state, { ...view, width: 620, height: 300 })
    expect(boxes[groupForPane(state, 'a')!.id]!.width).toBe(280)
    expect(state.root.ratio).toBe(.24)
  })
})

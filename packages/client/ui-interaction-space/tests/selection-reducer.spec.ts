import { describe, expect, it } from 'vitest'
import { selectionInteractionReducer, type SelectionInteractionState } from '../src/selection/reducer.ts'
import { SELECTION_STABLE_DEBOUNCE_MS } from '../src/selection/contracts.ts'

const CONTEXT = {
  contextId: 'sel-1',
  kind: 'text',
  source: 'conversation',
  stableForMs: SELECTION_STABLE_DEBOUNCE_MS + 10,
  capabilities: ['conversation.composer'],
  sensitive: false,
} as const

const CONTEXT2 = { ...CONTEXT, contextId: 'sel-2' }

function from(state: SelectionInteractionState): { run: (event: Parameters<typeof selectionInteractionReducer>[1]) => SelectionInteractionState } {
  return {
    run: event => selectionInteractionReducer(state, event),
  }
}

describe('selection interaction reducer', () => {
  it('walks idle → candidate → stable → actions-visible', () => {
    let state: SelectionInteractionState = { phase: 'idle' }
    state = selectionInteractionReducer(state, { type: 'selection-candidate', contextId: 'sel-1' })
    expect(state.phase).toBe('candidate')
    state = selectionInteractionReducer(state, { type: 'selection-stable', context: CONTEXT })
    expect(state.phase).toBe('stable')
    state = selectionInteractionReducer(state, { type: 'show-actions' })
    expect(state.phase).toBe('actions-visible')
  })

  it('reselect replaces the context; old context actions stop dispatching', () => {
    let state: SelectionInteractionState = { phase: 'actions-visible', context: CONTEXT }
    state = selectionInteractionReducer(state, { type: 'selection-candidate', contextId: 'sel-2' })
    expect(state).toEqual({ phase: 'candidate', contextId: 'sel-2' })
    // 旧 contextId 的 dispatch 不再被接受（无 actions-visible）
    state = selectionInteractionReducer(state, { type: 'action-dispatch', actionId: 'dsh:ask' })
    expect(state.phase).toBe('candidate')
  })

  it('dispatch → local completes and dismisses; composer/owner open a surface', () => {
    let state: SelectionInteractionState = { phase: 'actions-visible', context: CONTEXT }
    state = selectionInteractionReducer(state, { type: 'action-dispatch', actionId: 'dsh:copy-quote' })
    expect(state.phase).toBe('dispatching')
    expect(selectionInteractionReducer(state, { type: 'dispatch-settled', local: true }).phase).toBe('dismissed')
    expect(selectionInteractionReducer(state, { type: 'dispatch-settled', surface: 'composer' }).phase).toBe('surface')
  })

  it('scroll/resize dismiss transient surfaces but never kill an open composer draft', () => {
    const actions: SelectionInteractionState = { phase: 'actions-visible', context: CONTEXT }
    expect(selectionInteractionReducer(actions, { type: 'scroll' }).phase).toBe('dismissed')
    expect(selectionInteractionReducer(actions, { type: 'resize' }).phase).toBe('dismissed')
    const surface: SelectionInteractionState = { phase: 'surface', context: CONTEXT, surface: 'composer', actionId: 'dsh:ask' }
    expect(selectionInteractionReducer(surface, { type: 'scroll' }).phase).toBe('surface')
    expect(selectionInteractionReducer(surface, { type: 'resize' }).phase).toBe('surface')
  })

  it('Esc closes nested surface first, then actions, restoring layer by layer', () => {
    let state: SelectionInteractionState = { phase: 'surface', context: CONTEXT, surface: 'more', actionId: '' }
    state = selectionInteractionReducer(state, { type: 'esc' })
    expect(state.phase).toBe('actions-visible')
    state = selectionInteractionReducer(state, { type: 'esc' })
    expect(state.phase).toBe('dismissed')
  })

  it('outside pointerdown dismisses actions but not an open composer', () => {
    expect(selectionInteractionReducer({ phase: 'actions-visible', context: CONTEXT }, { type: 'outside-pointer' }).phase).toBe('dismissed')
    expect(selectionInteractionReducer({ phase: 'surface', context: CONTEXT, surface: 'composer', actionId: 'dsh:ask' }, { type: 'outside-pointer' }).phase).toBe('surface')
  })

  it('context invalidation dismisses everything including pinned entries', () => {
    expect(selectionInteractionReducer({ phase: 'pinned', context: CONTEXT }, { type: 'context-invalid' }).phase).toBe('dismissed')
    expect(selectionInteractionReducer({ phase: 'actions-visible', context: CONTEXT }, { type: 'context-invalid' }).phase).toBe('dismissed')
  })

  it('pin only from stable/actions-visible; pinned survives scroll but not invalidation', () => {
    let state: SelectionInteractionState = { phase: 'actions-visible', context: CONTEXT }
    state = selectionInteractionReducer(state, { type: 'pin' })
    expect(state.phase).toBe('pinned')
    expect(selectionInteractionReducer(state, { type: 'scroll' }).phase).toBe('pinned')
    // 新选择接管 pinned
    expect(selectionInteractionReducer(state, { type: 'selection-candidate', contextId: 'sel-2' }).phase).toBe('candidate')
    // idle 下不能 pin
    expect(selectionInteractionReducer({ phase: 'idle' }, { type: 'pin' }).phase).toBe('idle')
  })

  it('surface-open from actions-visible; surface-close returns to actions', () => {
    let state: SelectionInteractionState = { phase: 'actions-visible', context: CONTEXT }
    state = selectionInteractionReducer(state, { type: 'surface-open', surface: 'bottom-sheet' })
    expect(state.phase).toBe('surface')
    state = selectionInteractionReducer(state, { type: 'surface-close' })
    expect(state.phase).toBe('actions-visible')
  })

  it('excluded selections idle the layer unless a composer surface is open', () => {
    expect(selectionInteractionReducer({ phase: 'candidate', contextId: 'sel-1' }, { type: 'selection-excluded' }).phase).toBe('idle')
    expect(selectionInteractionReducer({ phase: 'surface', context: CONTEXT, surface: 'composer', actionId: 'dsh:ask' }, { type: 'selection-excluded' }).phase).toBe('surface')
  })

  it('unknown event combos are no-ops (fail-safe)', () => {
    expect(selectionInteractionReducer({ phase: 'idle' }, { type: 'action-dispatch', actionId: 'dsh:ask' }).phase).toBe('idle')
    expect(selectionInteractionReducer({ phase: 'idle' }, { type: 'show-actions' }).phase).toBe('idle')
    expect(from({ phase: 'stable', context: CONTEXT2 }).run({ type: 'surface-close' }).phase).toBe('stable')
  })
})

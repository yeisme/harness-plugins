import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMMAND_KEYMAP,
  formatKeyEvent,
  resolveKeyAction,
  resolveKeymap,
  type CommandKeyEvent,
  type CommandKeyContext,
  type CommandKeyResolution,
} from '../src/keymap'
import {
  commandReducer,
  createInitialState,
  actions,
} from '../src/reducer'
import type { CommandExperienceEntryV1, CommandReducerAction } from '../src/types'

function actionOf(resolution: CommandKeyResolution): CommandReducerAction {
  if (resolution.kind !== 'action') {
    throw new Error(`expected action resolution, got ${resolution.kind}`)
  }
  return resolution.action
}

function key(k: string, mods: Partial<CommandKeyEvent> = {}): CommandKeyEvent {
  return { key: k, ctrl: false, meta: false, alt: false, shift: false, ...mods }
}

const commands: CommandExperienceEntryV1[] = [
  {
    canonicalName: 'session',
    aliases: ['sessions'],
    description: 'Manage sessions',
    category: 'session',
    input: { selectorKey: 'sessionId' },
    surfaces: ['web', 'tui'],
    actionKind: 'owner-action',
    owner: 'dsh',
    danger: 'safe',
    availability: { state: 'available' },
    coverage: 'adapted',
  },
  {
    canonicalName: 'status',
    aliases: [],
    description: 'Show runtime status',
    category: 'discovery',
    input: {},
    surfaces: ['web', 'tui'],
    actionKind: 'inspect',
    owner: 'dsh',
    danger: 'safe',
    availability: { state: 'available' },
    coverage: 'staged',
  },
]

const context: CommandKeyContext = {
  candidateKeys: ['cmd:session', 'cmd:status'],
  commands,
}

describe('keymap config', () => {
  it('exposes defaults without bare j/k bindings', () => {
    expect(DEFAULT_COMMAND_KEYMAP.navigateUp).toEqual(['arrowup', 'ctrl+p'])
    expect(DEFAULT_COMMAND_KEYMAP.navigateDown).toEqual(['arrowdown', 'ctrl+n'])
    expect(DEFAULT_COMMAND_KEYMAP.confirmExecute).toEqual(['ctrl+enter', 'meta+enter'])
    expect(DEFAULT_COMMAND_KEYMAP.execute).toEqual(['enter'])
    expect(JSON.stringify(DEFAULT_COMMAND_KEYMAP)).not.toContain('"k"')
    expect(JSON.stringify(DEFAULT_COMMAND_KEYMAP)).not.toContain('"j"')
  })

  it('merges partial overrides onto defaults', () => {
    const merged = resolveKeymap({ navigateUp: ['k'] })
    expect(merged.navigateUp).toEqual(['k'])
    expect(merged.navigateDown).toEqual(DEFAULT_COMMAND_KEYMAP.navigateDown)
  })

  it('formats key events as binding strings', () => {
    expect(formatKeyEvent(key('Enter'))).toBe('enter')
    expect(formatKeyEvent(key('ArrowDown'))).toBe('arrowdown')
    expect(formatKeyEvent(key('k', { ctrl: true }))).toBe('ctrl+k')
    expect(formatKeyEvent(key('Enter', { meta: true }))).toBe('meta+enter')
  })
})

describe('resolveKeyAction per state', () => {
  it('returns a toggle intent from idle on ctrl+k only', () => {
    const state = createInitialState()
    expect(resolveKeyAction({ event: key('k', { ctrl: true }), state, context }))
      .toEqual({ kind: 'toggle' })
    expect(resolveKeyAction({ event: key('k', { meta: true }), state, context }))
      .toEqual({ kind: 'toggle' })
    expect(resolveKeyAction({ event: key('k'), state, context }).kind).toBe('unhandled')
    expect(resolveKeyAction({ event: key('Enter'), state, context }).kind).toBe('unhandled')
  })

  it('moves the cursor in assist state', () => {
    let state = commandReducer(createInitialState(), actions.startAssist('/', ''))
    const down = resolveKeyAction({ event: key('ArrowDown'), state, context })
    expect(down).toEqual({
      kind: 'action',
      action: { type: 'MOVE_SELECTION', delta: 1, candidateKeys: context.candidateKeys },
    })
    state = commandReducer(state, actionOf(down))
    expect(state.cursorKey).toBe('cmd:session')
    expect(state.cursorMoved).toBe(true)

    const up = resolveKeyAction({ event: key('p', { ctrl: true }), state, context })
    state = commandReducer(state, actionOf(up))
    expect(state.cursorKey).toBeNull()
    expect(state.cursorMoved).toBe(false)
  })

  it('jumps to first and last candidates', () => {
    let state = commandReducer(createInitialState(), actions.startAssist('/', ''))
    const last = resolveKeyAction({ event: key('End'), state, context })
    state = commandReducer(state, actionOf(last))
    expect(state.cursorKey).toBe('cmd:status')
    const first = resolveKeyAction({ event: key('Home'), state, context })
    state = commandReducer(state, actionOf(first))
    expect(state.cursorKey).toBe('cmd:session')
  })

  it('completes a safe unique prefix on Tab in assist state', () => {
    let state = commandReducer(createInitialState(), actions.startAssist('/se', '/se'))
    const tab = resolveKeyAction({ event: key('Tab'), state, context })
    expect(tab).toEqual({
      kind: 'action',
      action: { type: 'UPDATE_QUERY', query: '/session' },
    })
    state = commandReducer(state, actionOf(tab))
    expect(state.query).toBe('/session')
  })

  it('leaves Tab unhandled when the prefix is ambiguous', () => {
    const state = commandReducer(createInitialState(), actions.startAssist('/s', '/s'))
    expect(resolveKeyAction({ event: key('Tab'), state, context }).kind).toBe('unhandled')
  })

  it('returns execute-cursor and cancel in assist and selector states', () => {
    const assist = commandReducer(createInitialState(), actions.startAssist('/', ''))
    expect(resolveKeyAction({ event: key('Enter'), state: assist, context }).kind)
      .toBe('execute-cursor')
    expect(resolveKeyAction({ event: key('Escape'), state: assist, context }))
      .toEqual({ kind: 'action', action: { type: 'CANCEL' } })

    let selector = commandReducer(assist, actions.selectCommand(commands[0]))
    selector = commandReducer(selector, actions.openSelector())
    expect(resolveKeyAction({ event: key('ArrowDown'), state: selector, context }).kind)
      .toBe('action')
    expect(resolveKeyAction({ event: key('Enter'), state: selector, context }).kind)
      .toBe('execute-cursor')
  })

  it('keeps cursor navigation available after auto-select in selected state', () => {
    let state = commandReducer(createInitialState(), actions.startAssist('/se', '/se'))
    state = commandReducer(state, actions.selectCommand(commands[0]))
    expect(state.state).toBe('selected')

    const down = resolveKeyAction({ event: key('ArrowDown'), state, context })
    expect(down.kind).toBe('action')
    state = commandReducer(state, actionOf(down))
    expect(state.cursorKey).toBe('cmd:session')

    expect(resolveKeyAction({ event: key('Enter'), state, context }).kind)
      .toBe('execute-cursor')
  })

  it('never confirms on bare Enter in confirmation state', () => {
    let state = commandReducer(createInitialState(), actions.startAssist('/', ''))
    state = commandReducer(state, actions.selectCommand(commands[0]))
    state = commandReducer(state, actions.requestConfirmation())
    expect(state.state).toBe('confirmation')

    expect(resolveKeyAction({ event: key('Enter'), state, context }).kind).toBe('unhandled')
    expect(resolveKeyAction({ event: key('Enter', { ctrl: true }), state, context }))
      .toEqual({ kind: 'action', action: { type: 'CONFIRM' } })
    expect(resolveKeyAction({ event: key('Enter', { meta: true }), state, context }))
      .toEqual({ kind: 'action', action: { type: 'CONFIRM' } })
    expect(resolveKeyAction({ event: key('Escape'), state, context }))
      .toEqual({ kind: 'action', action: { type: 'CANCEL' } })
  })

  it('closes receipts with escape or ctrl+d', () => {
    let state = commandReducer(createInitialState(), actions.startAssist('/', ''))
    state = commandReducer(state, actions.dispatch('corr-1'))
    state = commandReducer(state, actions.receipt('success', 'corr-1'))
    expect(resolveKeyAction({ event: key('Escape'), state, context }).kind).toBe('close-receipt')
    expect(resolveKeyAction({ event: key('d', { ctrl: true }), state, context }).kind)
      .toBe('close-receipt')
    expect(resolveKeyAction({ event: key('d'), state, context }).kind).toBe('unhandled')
  })

  it('ignores keys while dispatching', () => {
    const state = commandReducer(
      commandReducer(createInitialState(), actions.startAssist('/', '')),
      actions.dispatch('corr-2'),
    )
    expect(resolveKeyAction({ event: key('Escape'), state, context }).kind).toBe('unhandled')
  })

  it('reports toggle while the palette is open but not inside modal states', () => {
    const assist = commandReducer(createInitialState(), actions.startAssist('/', ''))
    expect(resolveKeyAction({ event: key('k', { ctrl: true }), state: assist, context }).kind)
      .toBe('toggle')

    let confirmation = commandReducer(assist, actions.selectCommand(commands[0]))
    confirmation = commandReducer(confirmation, actions.requestConfirmation())
    expect(resolveKeyAction({ event: key('k', { ctrl: true }), state: confirmation, context }).kind)
      .toBe('unhandled')
  })
})


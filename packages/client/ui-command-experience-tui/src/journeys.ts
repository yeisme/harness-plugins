/**
 * TUI first-support journeys over the shipped update() function.
 */

import type { CommandExperienceEntryV1 } from '@yeisme/dsh-client-ui-command-experience-core'
import { createInitialTuiState, update, type TuiCommandShellStateV1 } from './shell'

export const TUI_FIRST_SUPPORT = [
  'help', 'commands', 'status', 'session', 'new', 'fork', 'rename', 'compact', 'model', 'permissions',
] as const

export function runTuiJourney(
  commands: readonly CommandExperienceEntryV1[],
  name: string,
): TuiCommandShellStateV1 {
  let state = createInitialTuiState({ width: 80, height: 24 })
  ;({ state } = update(state, { type: 'input', text: `/${name}` }, commands))
  state = { ...state, cursorKey: name }
  ;({ state } = update(state, { type: 'key', key: 'Enter' }, commands))
  if (state.mode === 'selector') {
    ;({ state } = update(state, { type: 'key', key: 'ArrowDown' }, commands))
    ;({ state } = update(state, { type: 'key', key: 'Enter' }, commands))
  }
  if (state.mode === 'confirm') {
    ;({ state } = update(state, { type: 'key', key: 'y' }, commands))
  }
  return state
}

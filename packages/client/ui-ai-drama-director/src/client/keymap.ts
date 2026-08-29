/**
 * Drama keyboard shortcuts on the shared command-experience keymap face.
 *
 * Bindings are declared as `CommandKeymapConfig` overrides and resolved
 * through `resolveKeymap`; physical chords are normalized with
 * `formatKeyEvent` semantics. This module never touches window/document:
 * view components feed element-scoped key events in, and unmounting the
 * view is the exact unregistration (global listener counts never change).
 *
 * Conflicts (one binding claimed by two slots) degrade deterministically by
 * the shared slot priority and stay visible as conflict entries.
 */

import {
  DEFAULT_COMMAND_KEYMAP,
  formatKeyEvent,
  resolveKeymap,
  type CommandKeyEvent,
  type CommandKeymapConfig,
} from '@yeisme/dsh-client-ui-command-experience-core'
import type { DramaKeyEventV1 } from '@yeisme/dsh-ai-drama-director'

/**
 * Drama additions to the shared keymap. `alt+d` toggles the command center
 * (replacing the stub's bare window keydown listener).
 */
export const DRAMA_KEYMAP_OVERRIDES: Partial<CommandKeymapConfig> = {
  toggle: [...DEFAULT_COMMAND_KEYMAP.toggle, 'alt+d'],
}

export type DramaKeymapSlot = keyof CommandKeymapConfig

/**
 * Deterministic winner order when two slots claim the same binding. Mirrors
 * the shared resolver's matching order (toggle first). `closeReceipt` is
 * excluded on purpose: it only fires in the palette's receipt state, which
 * drama views never drive, so its default overlap with `cancel` (Escape) is
 * state-disjoint and not a real conflict.
 */
export const DRAMA_KEYMAP_SLOT_PRIORITY: readonly DramaKeymapSlot[] = [
  'toggle',
  'cancel',
  'confirmExecute',
  'execute',
  'navigateUp',
  'navigateDown',
  'moveFirst',
  'moveLast',
  'tabComplete',
]

export interface DramaKeymapConflictV1 {
  readonly binding: string
  readonly slots: readonly DramaKeymapSlot[]
  /** The slot that keeps the binding; the rest degrade without firing. */
  readonly winner: DramaKeymapSlot
  readonly reason: string
}

export type DramaViewKeyAction =
  | { readonly type: 'toggle-palette' }
  | { readonly type: 'cycle-zone'; readonly reverse: boolean }
  | { readonly type: 'focus-command-zone' }
  | { readonly type: 'move'; readonly slot: 'navigateUp' | 'navigateDown' | 'moveFirst' | 'moveLast' }
  | { readonly type: 'execute-focused' }
  | { readonly type: 'unhandled' }

export interface DramaKeymap {
  readonly config: CommandKeymapConfig
  readonly conflicts: readonly DramaKeymapConflictV1[]
  /** Resolves one normalized key event to a drama view action. */
  resolveViewKey(event: CommandKeyEvent): DramaViewKeyAction
}

export function detectDramaKeymapConflicts(config: CommandKeymapConfig): readonly DramaKeymapConflictV1[] {
  const claims = new Map<string, DramaKeymapSlot[]>()
  for (const slot of DRAMA_KEYMAP_SLOT_PRIORITY) {
    for (const binding of config[slot]) {
      const list = claims.get(binding) ?? []
      list.push(slot)
      claims.set(binding, list)
    }
  }
  const conflicts: DramaKeymapConflictV1[] = []
  for (const [binding, slots] of claims) {
    if (slots.length < 2) continue
    const winner = DRAMA_KEYMAP_SLOT_PRIORITY.find(slot => slots.includes(slot)) ?? slots[0]!
    conflicts.push({
      binding,
      slots: [...slots],
      winner,
      reason: `binding ${binding} is claimed by ${slots.join(', ')}; only ${winner} fires`,
    })
  }
  return conflicts
}

/** Normalizes a KeyboardEvent-like object into the shared logical event. */
export function toCommandKeyEvent(event: {
  readonly key: string
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
  readonly altKey?: boolean
  readonly shiftKey?: boolean
}): CommandKeyEvent {
  return {
    key: event.key.toLowerCase(),
    ctrl: event.ctrlKey === true,
    meta: event.metaKey === true,
    alt: event.altKey === true,
    shift: event.shiftKey === true,
  }
}

function slotFor(config: CommandKeymapConfig, binding: string, conflicts: readonly DramaKeymapConflictV1[]): DramaKeymapSlot | undefined {
  for (const slot of DRAMA_KEYMAP_SLOT_PRIORITY) {
    if (!config[slot].includes(binding)) continue
    const conflict = conflicts.find(item => item.binding === binding)
    if (conflict !== undefined && conflict.winner !== slot) continue
    return slot
  }
  return undefined
}

/**
 * Maps a resolved slot back onto the drama interaction model's key event so
 * the host pack's `applyDramaKey` stays the single focus-navigation owner.
 */
export function dramaKeyEventForAction(action: DramaViewKeyAction): DramaKeyEventV1 | undefined {
  switch (action.type) {
    case 'cycle-zone':
      return { key: 'Tab', shiftKey: action.reverse }
    case 'focus-command-zone':
      return { key: 'Escape' }
    case 'move':
      if (action.slot === 'navigateUp') return { key: 'ArrowUp' }
      if (action.slot === 'navigateDown') return { key: 'ArrowDown' }
      if (action.slot === 'moveFirst') return { key: 'Home' }
      return { key: 'End' }
    case 'execute-focused':
      return { key: 'Enter' }
    default:
      return undefined
  }
}

export function createDramaKeymap(overrides?: Partial<CommandKeymapConfig>): DramaKeymap {
  const config = resolveKeymap({ ...DRAMA_KEYMAP_OVERRIDES, ...overrides })
  const conflicts = detectDramaKeymapConflicts(config)
  return {
    config,
    conflicts,
    resolveViewKey(event) {
      const binding = formatKeyEvent(event)
      let slot = slotFor(config, binding, conflicts)
      // Shift+Tab has no default binding of its own; resolve it as the
      // reverse of the tabComplete slot so zone cycling works backwards.
      let reverseCycle = false
      if (slot === undefined && event.shift) {
        const strippedSlot = slotFor(config, formatKeyEvent({ ...event, shift: false }), conflicts)
        if (strippedSlot === 'tabComplete') {
          slot = 'tabComplete'
          reverseCycle = true
        }
      }
      switch (slot) {
        case 'toggle':
          return { type: 'toggle-palette' }
        case 'tabComplete':
          return { type: 'cycle-zone', reverse: reverseCycle }
        case 'cancel':
          return { type: 'focus-command-zone' }
        case 'navigateUp':
        case 'navigateDown':
        case 'moveFirst':
        case 'moveLast':
          return { type: 'move', slot }
        case 'execute':
        case 'confirmExecute':
          return { type: 'execute-focused' }
        default:
          return { type: 'unhandled' }
      }
    },
  }
}

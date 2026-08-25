/**
 * Command-group help, selection, and fail-closed error copy.
 */

import type { DramaCommandResultV1 } from './commands.js'
import type { DramaCommandEntryV1 } from './panes.js'

export interface DramaHelpCopyV1 {
  readonly title: string
  readonly commands: readonly string[]
  readonly next: string
}

export interface DramaErrorCopyV1 {
  readonly title: string
  readonly reason: string
  readonly next: string
}

export function dramaHelpCopy(): DramaHelpCopyV1 {
  return {
    title: 'Drama Director',
    commands: [
      '/drama',
      '/drama help',
      '/drama open',
      '/drama review',
      '/drama evidence',
      '/drama handoff',
    ],
    next: 'Select a typed command. Mutations stay preview-before-submit.',
  }
}

export function mapDramaCommandError(result: DramaCommandResultV1): DramaErrorCopyV1 {
  if (result.kind === 'unknown') {
    return {
      title: 'Settlement unknown',
      reason: result.reason,
      next: 'Do not retry with a new idempotency key. Reconcile the owner first.',
    }
  }
  if (result.kind === 'reconcile_required') {
    return {
      title: 'Reconcile required',
      reason: result.reason,
      next: 'Resync the current context snapshot, then request a fresh preview.',
    }
  }
  if (result.kind === 'needs_contract') {
    return {
      title: 'Needs contract',
      reason: result.reason,
      next: 'Keep the command disabled until the drama owner projection is mounted.',
    }
  }
  if (result.kind === 'disabled') {
    return {
      title: 'Command disabled',
      reason: result.reason,
      next: 'Use /drama help or wait for capability.',
    }
  }
  return {
    title: 'Command result',
    reason: result.reason,
    next: 'Continue from the current context.',
  }
}

export function selectedDramaCommand(
  commands: readonly DramaCommandEntryV1[],
  id: string,
): DramaCommandEntryV1 | undefined {
  return commands.find((entry) => entry.id === id)
}

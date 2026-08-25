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
  readonly kind: 'success' | 'error' | 'warning' | 'disabled'
  readonly title: string
  readonly message: string
  readonly retryable: boolean
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
      kind: 'error',
      title: 'Command Unknown',
      message: 'The command could not be completed. Do not retry automatically.',
      retryable: false,
    }
  }
  if (result.kind === 'reconcile_required') {
    return {
      kind: 'warning',
      title: 'Context Updated',
      message: 'Context has been updated. Please refresh and try again.',
      retryable: true,
    }
  }
  if (result.kind === 'needs_contract') {
    return {
      kind: 'disabled',
      title: 'Contract Required',
      message: 'Server descriptor is missing or contract not available.',
      retryable: false,
    }
  }
  if (result.kind === 'opened' || result.kind === 'submitted' || result.kind === 'proposal_created') {
    return {
      kind: 'success',
      title: 'Command Successful',
      message: result.reason,
      retryable: false,
    }
  }
  return {
    kind: 'error',
    title: 'Command Result',
    message: result.reason,
    retryable: false,
  }
}

export function canRetryDramaResult(result: DramaCommandResultV1): boolean {
  return result.kind === 'reconcile_required'
}

export function selectedDramaCommand(
  commands: readonly DramaCommandEntryV1[],
  id: string,
): DramaCommandEntryV1 | undefined {
  return commands.find((entry) => entry.id === id)
}

/**
 * First-support command journeys over the shared directory and draft.
 *
 * Outcomes are owner-authored: success, disabled, stale, permission, and
 * owner-error. The shell never invents a second log or transcript message.
 */

import type { CommandDraftV1, CommandExperienceEntryV1 } from '@yeisme/dsh-client-ui-command-experience-core'
import { commandDraftReducer, isCommandExecutable } from '@yeisme/dsh-client-ui-command-experience-core'
import {
  receiptLaneFromDraft,
  restoreActivityFromEvents,
  selectWebCommand,
  startWebDraft,
  type CommandActivityEventV1,
  type CommandActivityRowV1,
  type ReceiptLaneV1,
} from './shell'

export const FIRST_SUPPORT_NAMES = [
  'status',
  'session',
  'new',
  'fork',
  'rename',
  'compact',
  'model',
  'permissions',
] as const

export type FirstSupportName = (typeof FIRST_SUPPORT_NAMES)[number]
export type FirstSupportOutcome = 'success' | 'disabled' | 'stale' | 'permission' | 'owner-error'

export interface FirstSupportJourneyResult {
  readonly name: FirstSupportName
  readonly outcome: FirstSupportOutcome
  readonly dispatched: boolean
  readonly draft: CommandDraftV1
  readonly receipt: ReceiptLaneV1
  readonly activity: readonly CommandActivityRowV1[]
  readonly events: readonly CommandActivityEventV1[]
}

function ownerReceiptStatus(outcome: FirstSupportOutcome): 'success' | 'rejected' | 'failed' | 'stale' {
  if (outcome === 'success') return 'success'
  if (outcome === 'stale') return 'stale'
  if (outcome === 'permission') return 'rejected'
  return 'failed'
}

export function runFirstSupportJourney(input: {
  readonly commands: readonly CommandExperienceEntryV1[]
  readonly name: FirstSupportName
  readonly outcome: FirstSupportOutcome
  readonly sessionRef?: string
}): FirstSupportJourneyResult {
  const sessionRef = input.sessionRef ?? 'sess_1'
  const command = input.commands.find(item => item.canonicalName === input.name)
  if (command === undefined) {
    const draft = startWebDraft(`/${input.name}`, '')
    return {
      name: input.name,
      outcome: 'owner-error',
      dispatched: false,
      draft,
      receipt: receiptLaneFromDraft(draft),
      activity: [],
      events: [],
    }
  }

  let draft = selectWebCommand(startWebDraft(`/${input.name}`, ''), command)
  if (input.outcome === 'disabled' || !isCommandExecutable(command)) {
    return {
      name: input.name,
      outcome: 'disabled',
      dispatched: false,
      draft,
      receipt: receiptLaneFromDraft(draft),
      activity: [],
      events: [],
    }
  }

  if (command.input.selectorKey && draft.selectedRef === null) {
    draft = commandDraftReducer(draft, { type: 'SET_REF', ref: sessionRef })
  }
  if (command.input.hint && draft.step === 'argument') {
    draft = commandDraftReducer(draft, { type: 'SET_ARGUMENT', text: 'Renamed' })
  }
  if (command.danger !== 'safe') {
    draft = commandDraftReducer(draft, { type: 'REQUEST_CONFIRM' })
    draft = commandDraftReducer(draft, { type: 'CONFIRM' })
  } else {
    draft = commandDraftReducer(draft, { type: 'DISPATCH', correlationId: `fs-${input.name}` })
  }

  const correlationId = draft.correlationId ?? `fs-${input.name}`
  const runEvent: CommandActivityEventV1 = {
    type: 'command/run',
    sessionRef,
    canonicalName: input.name,
    correlationId,
  }
  const doneEvent: CommandActivityEventV1 = {
    type: 'command/done',
    sessionRef,
    canonicalName: input.name,
    correlationId,
    status: ownerReceiptStatus(input.outcome),
    summary: `/${input.name} ${input.outcome}`,
    reasonCode: input.outcome === 'success' ? undefined : input.outcome,
  }
  draft = commandDraftReducer(draft, {
    type: 'RECEIPT',
    status: ownerReceiptStatus(input.outcome),
    correlationId,
    message: doneEvent.summary,
  })
  const events = [runEvent, doneEvent]
  return {
    name: input.name,
    outcome: input.outcome,
    dispatched: true,
    draft,
    receipt: receiptLaneFromDraft(draft),
    activity: restoreActivityFromEvents(events, sessionRef),
    events,
  }
}

export function runFirstSupportMatrix(
  commands: readonly CommandExperienceEntryV1[],
): readonly FirstSupportJourneyResult[] {
  const outcomes: readonly FirstSupportOutcome[] = ['success', 'disabled', 'stale', 'permission', 'owner-error']
  const results: FirstSupportJourneyResult[] = []
  for (const name of FIRST_SUPPORT_NAMES) {
    for (const outcome of outcomes) {
      const catalog = outcome === 'disabled'
        ? commands.map(item => item.canonicalName === name
          ? { ...item, availability: { state: 'disabled' as const, reason: `/${name} disabled for journey` } }
          : item)
        : commands
      results.push(runFirstSupportJourney({ commands: catalog, name, outcome }))
    }
  }
  return results
}

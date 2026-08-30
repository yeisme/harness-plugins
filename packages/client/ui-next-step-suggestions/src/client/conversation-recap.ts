/** Deterministic completion recap derived only from the published safe Chat snapshot. */

import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { NextStepSuggestionV1 } from './types.ts'

export interface ConversationRecapV1 {
  readonly id: string
  readonly turn: number
  readonly summary: string
}

export interface CompletionSuggestionCopy {
  readonly reviewLabel: string
  readonly reviewPrompt: string
  readonly verifyLabel: string
  readonly verifyPrompt: string
  readonly continueLabel: string
  readonly continuePrompt: string
}

const RECAP_LIMIT = 180

function boundedSummary(text: string): string | null {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized === '') return null
  const characters = [...normalized]
  return characters.length <= RECAP_LIMIT
    ? normalized
    : `${characters.slice(0, RECAP_LIMIT - 1).join('')}…`
}

/**
 * Read the latest successfully finalized assistant text without touching
 * reasoning blocks, tool payloads, provider payloads, or raw event data.
 */
export function conversationRecapFromSnapshot(snapshot: ConversationSnapshot): ConversationRecapV1 | null {
  if (
    snapshot.openState !== 'open'
    || snapshot.removed
    || snapshot.running
    || snapshot.pending.length > 0
    || snapshot.partial !== null
  ) return null

  const turn = [...snapshot.turnEnds.keys()].sort((left, right) => right - left)[0]
  if (turn === undefined) return null
  if (snapshot.nodes.some(node => (
    (node.kind === 'turn-error' || node.kind === 'turn-max-tokens') && node.turn === turn
  ))) return null

  const assistant = [...snapshot.nodes].reverse().find(node => (
    node.kind === 'assistant' && node.turn === turn && node.interrupted !== true
  ))
  if (assistant?.kind !== 'assistant') return null
  const summary = boundedSummary(
    assistant.blocks
      .filter((block): block is Extract<typeof block, { kind: 'text' }> => block.kind === 'text')
      .map(block => block.text)
      .join(' '),
  )
  if (summary === null) return null

  return {
    id: `turn:${turn}:${snapshot.turnEnds.get(turn) ?? assistant.seq}`,
    turn,
    summary,
  }
}

/** Exactly three generic draft-only actions used only when owner sources are empty. */
export function completionSuggestions(recap: ConversationRecapV1, copy: CompletionSuggestionCopy): readonly NextStepSuggestionV1[] {
  return [
    {
      id: `${recap.id}:review`,
      label: copy.reviewLabel,
      prompt: copy.reviewPrompt,
      source: 'host',
      recommended: true,
      order: 10,
    },
    {
      id: `${recap.id}:verify`,
      label: copy.verifyLabel,
      prompt: copy.verifyPrompt,
      source: 'host',
      order: 20,
    },
    {
      id: `${recap.id}:continue`,
      label: copy.continueLabel,
      prompt: copy.continuePrompt,
      source: 'host',
      order: 30,
    },
  ]
}

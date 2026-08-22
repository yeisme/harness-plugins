/**
 * DSH Web next-step suggestions client plugin.
 *
 * Registers a suggestion dock in `conversation.input.dock`. The dock reads
 * the plan-options projection directly and also accepts client-local sources
 * through `SuggestionSourceRegistry`.
 *
 * @module @yeisme/dsh-client-ui-next-step-suggestions/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { SuggestionDock } from './SuggestionDock.tsx'
import { SuggestionSourceRegistry } from './sources.ts'
import { en, NS, zh } from './locales.ts'

export { SuggestionDock } from './SuggestionDock.tsx'
export type { SuggestionDockInjected, SuggestionDockProps } from './SuggestionDock.tsx'
export { SuggestionSourceRegistry } from './sources.ts'
export { planOptionsToSuggestions } from './plan-options-source.ts'
export { appendPrompt, applySelected, composeParallelPrompt, mergeSuggestions } from './suggestion-composer.ts'
export type {
  NextStepSuggestionV1,
  PlanOption,
  PlanOptionsProjection,
  PlanOptionsProjectionValue,
  SuggestionSource,
} from './types.ts'
export { en, NS, zh } from './locales.ts'
export type { NextStepSuggestionsKey } from './locales.ts'

export const name = 'client-ui-next-step-suggestions'
export const inject = ['slots', 'locale'] as const

/**
 * Mount the client face.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): () => void {
  const registry = new SuggestionSourceRegistry()
  ctx.provide('nextStepSuggestions', registry)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-next-step-suggestions: dictionaries')
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'next-step-suggestions',
    order: 5,
    locale: NS,
    inject: () => ({ getSources: () => registry.list() }),
  }, SuggestionDock))
  return () => {}
}

/**
 * Plan-options source adapter.
 *
 * Reads the DSH `plan-options` session projection (by string key at runtime)
 * and converts each proposed PlanOption into a `NextStepSuggestionV1`.
 *
 * @module @yeisme/dsh-client-ui-next-step-suggestions/plan-options-source
 */

import type { NextStepSuggestionV1, PlanOptionsProjectionValue } from './types.ts'

/**
 * Convert the current plan-options projection to suggestions.
 *
 * @param value - the `plan-options` projection value, or undefined when the
 * capability is absent.
 * @returns Proposed plan options as suggestions; empty when no proposal is active.
 */
export function planOptionsToSuggestions(
  value: PlanOptionsProjectionValue | undefined,
): NextStepSuggestionV1[] {
  const latest = value?.latest
  if (latest === undefined || latest.status !== 'proposed') return []
  return latest.options.map(option => ({
    id: `plan-option:${latest.planId}:${option.optionId}`,
    label: option.title,
    prompt: `/plan-select ${JSON.stringify({ optionId: option.optionId })}`,
    source: 'plan',
    mode: 'parallel',
    planOptionId: option.optionId,
    planId: latest.planId,
    parallelSafe: true,
    recommended: option.recommended === true,
    order: option.recommended === true ? -1 : 0,
  }))
}

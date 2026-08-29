/**
 * One clickable next-step suggestion chip.
 *
 * In single mode the chip applies its prompt immediately. In multi-select
 * mode the chip toggles its selected state and the dock applies the batch.
 *
 * @module @yeisme/dsh-client-ui-next-step-suggestions/SuggestionChip
 */

import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { NextStepSuggestionV1 } from './types.ts'
import { NS, type NextStepSuggestionsKey } from './locales.ts'

export interface SuggestionChipProps extends PropsLocale<typeof NS> {
  readonly suggestion: NextStepSuggestionV1
  readonly selected: boolean
  readonly disabled: boolean
  readonly multiSelect: boolean
  readonly onActivate: () => void
}

/** Render a single suggestion chip. */
export function SuggestionChip({
  suggestion,
  selected,
  disabled,
  multiSelect,
  onActivate,
  t,
}: SuggestionChipProps) {
  const title = suggestion.source === 'plan' ? t('suggestions.source.plan') : suggestion.source
  return (
    <Button
      type="button"
      className="ns-chip"
      aria-pressed={multiSelect ? selected : undefined}
      aria-label={`${suggestion.label}${suggestion.recommended === true ? ` (${t('suggestions.recommended')})` : ''}`}
      title={title}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault()
        onActivate()
      }}
    >
      <span>{suggestion.label}</span>
      {suggestion.recommended === true && (
        <span className="ns-chip-rec">{t('suggestions.recommended')}</span>
      )}
    </Button>
  )
}

export type { NextStepSuggestionsKey }

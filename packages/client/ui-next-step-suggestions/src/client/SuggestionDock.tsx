/**
 * Composer dock that renders next-step suggestion chips.
 *
 * Single mode applies a chip immediately to the draft. Multi-select mode lets
 * the user choose several suggestions and either append them in order or
 * compose a parallel execution prompt. This component never submits the
 * composer; it only writes the draft through `inputActions.setDraft`.
 *
 * @module @yeisme/dsh-client-ui-next-step-suggestions/SuggestionDock
 */

import { useEffect, useMemo, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NextStepSuggestionV1, PlanOptionsProjectionValue, SuggestionSource } from './types.ts'
import { planOptionsToSuggestions } from './plan-options-source.ts'
import {
  applyPrompt,
  applySelected,
  composeParallelPrompt,
  mergeSuggestions,
  type SuggestionApplyPreference,
} from './suggestion-composer.ts'
import { SuggestionChip } from './SuggestionChip.tsx'
import { NS } from './locales.ts'

/** Injected face for the dock: a snapshot function of client-local sources. */
export interface SuggestionDockInjected {
  readonly getSources: () => readonly SuggestionSource[]
  /** 可注入的偏好存储；缺省安全访问 window.localStorage（不可用则进程内）。 */
  readonly storage?: SuggestionStorage
}

/** Minimal persistence seam for the replace/append preference. */
export type SuggestionStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * 6.3 用户偏好持久化：建议写入草稿时“替换”或“追加”（默认追加）。
 * 只存枚举值；非法/缺失值回退到默认，绝不把草稿内容写进 storage。
 */
const APPLY_PREFERENCE_KEY = 'nextStepSuggestions.applyPreference'

function defaultStorage(): SuggestionStorage | undefined {
  try {
    return window.localStorage ?? undefined
  } catch {
    return undefined
  }
}

function readApplyPreference(storage: SuggestionStorage | undefined): SuggestionApplyPreference {
  try {
    const stored = storage?.getItem(APPLY_PREFERENCE_KEY)
    return stored === 'replace' ? 'replace' : 'append'
  } catch {
    return 'append'
  }
}

function writeApplyPreference(storage: SuggestionStorage | undefined, preference: SuggestionApplyPreference): void {
  try {
    storage?.setItem(APPLY_PREFERENCE_KEY, preference)
  } catch {
    // Storage 不可用时偏好退化为进程内状态，不影响写入草稿的行为。
  }
}

export type SuggestionDockProps =
  PropsRuntime<'conversation.input.dock'>
  & SuggestionDockInjected
  & PropsLocale<typeof NS>

/** Render the suggestion dock above the composer. */
export function SuggestionDock({ useProjection, useInput, inputActions, getSources, storage: injectedStorage, t }: SuggestionDockProps) {
  const storage = injectedStorage ?? defaultStorage()
  const draft = useInput((state) => state.draft)
  const [multiSelect, setMultiSelect] = useState(false)
  const [parallel, setParallel] = useState(false)
  const [applyPreference, setApplyPreference] = useState<SuggestionApplyPreference>(() => readApplyPreference(storage))
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())

  // plan-options is read by string key because this plugin intentionally does
  // not depend on the plan-mode package's TypeScript projection merge.
  const readProjection = useProjection as unknown as (key: string) => unknown
  const planValue = readProjection('plan-options') as PlanOptionsProjectionValue | undefined

  const suggestions = useMemo(() => {
    const planSource: SuggestionSource = {
      id: 'plan-options',
      getSuggestions: () => planOptionsToSuggestions(planValue),
    }
    return mergeSuggestions([planSource, ...getSources()])
  }, [planValue, getSources])

  // Prune selections that no longer exist.
  useEffect(() => {
    const ids = new Set(suggestions.map(suggestion => suggestion.id))
    setSelectedIds(current => {
      const next = new Set([...current].filter(id => ids.has(id)))
      return next.size === current.size ? current : next
    })
  }, [suggestions])

  const selectedSuggestions = useMemo(
    () => suggestions.filter(suggestion => selectedIds.has(suggestion.id)),
    [suggestions, selectedIds],
  )

  const writeDraft = (next: string) => {
    inputActions.setDraft(next)
  }

  const handleChip = (suggestion: NextStepSuggestionV1) => {
    if (multiSelect) {
      setSelectedIds(current => {
        const next = new Set(current)
        if (next.has(suggestion.id)) next.delete(suggestion.id)
        else next.add(suggestion.id)
        return next
      })
      return
    }
    writeDraft(applyPrompt(draft ?? '', suggestion.prompt, applyPreference))
  }

  const handleApply = () => {
    writeDraft(applySelected(draft ?? '', selectedSuggestions, applyPreference))
    setSelectedIds(new Set())
  }

  const handleParallel = () => {
    const safe = selectedSuggestions.filter(suggestion => suggestion.parallelSafe !== false)
    writeDraft(composeParallelPrompt(safe))
    setSelectedIds(new Set())
  }

  if (suggestions.length === 0) return null

  return (
    <div role="group" aria-label={t('suggestions.aria')} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {suggestions.map(suggestion => (
          <SuggestionChip
            key={suggestion.id}
            suggestion={suggestion}
            selected={selectedIds.has(suggestion.id)}
            disabled={parallel && suggestion.parallelSafe === false}
            multiSelect={multiSelect}
            onActivate={() => handleChip(suggestion)}
            t={t}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.85em' }}>
        <label>
          <input
            type="checkbox"
            checked={multiSelect}
            onChange={(event) => {
              setMultiSelect(event.currentTarget.checked)
              if (!event.currentTarget.checked) setSelectedIds(new Set())
            }}
          />
          {t('suggestions.multiSelect')}
        </label>
        <label>
          <input
            type="checkbox"
            aria-label={t('suggestions.replaceMode')}
            checked={applyPreference === 'replace'}
            onChange={(event) => {
              const next: SuggestionApplyPreference = event.currentTarget.checked ? 'replace' : 'append'
              setApplyPreference(next)
              writeApplyPreference(storage, next)
            }}
          />
          {t('suggestions.replaceMode')}
        </label>
        {multiSelect && (
          <label>
            <input
              type="checkbox"
              checked={parallel}
              onChange={(event) => { setParallel(event.currentTarget.checked) }}
            />
            {t('suggestions.parallel')}
          </label>
        )}
        {multiSelect && selectedSuggestions.length > 0 && (
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <button type="button" onClick={handleApply}>
              {t('suggestions.apply')}
            </button>
            <button
              type="button"
              onClick={handleParallel}
              disabled={parallel && selectedSuggestions.some(suggestion => suggestion.parallelSafe === false)}
            >
              {t('suggestions.parallel')}
            </button>
          </span>
        )}
        <span role="note" style={{ opacity: 0.7 }}>{t('suggestions.hint')}</span>
      </div>
    </div>
  )
}


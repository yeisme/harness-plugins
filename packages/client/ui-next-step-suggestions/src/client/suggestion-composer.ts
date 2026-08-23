/**
 * Pure functions for composing next-step suggestion prompts.
 *
 * These functions contain no React/DOM/cordis dependencies so they can be
 * unit-tested directly and reused by any surface.
 *
 * @module @yeisme/dsh-client-ui-next-step-suggestions/suggestion-composer
 */

import type { NextStepSuggestionV1, SuggestionSource } from './types.ts'

/**
 * Append a suggestion prompt to the current draft.
 *
 * @param current - current composer draft.
 * @param prompt - suggestion prompt to add.
 * @returns The next draft. An empty draft is replaced; a non-empty draft is
 * appended on a new line.
 */
export function appendPrompt(current: string, prompt: string): string {
  const trimmedPrompt = prompt.trim()
  if (current === '') return trimmedPrompt
  return `${current.replace(/\s+$/, '')}\n${trimmedPrompt}`
}

/** 用户偏好：建议写入草稿时“追加”或“替换”（V1 默认追加）。 */
export type SuggestionApplyPreference = 'append' | 'replace'

/**
 * Apply one suggestion prompt to the current draft under a replace/append
 * preference. `append` keeps the legacy behavior (empty draft is replaced,
 * non-empty draft gets a new line); `replace` always writes the prompt alone.
 */
export function applyPrompt(
  current: string,
  prompt: string,
  preference: SuggestionApplyPreference = 'append',
): string {
  if (preference === 'replace') return prompt.trim()
  return appendPrompt(current, prompt)
}

/**
 * Apply a list of selected suggestions to the current draft in order.
 *
 * @param current - current composer draft.
 * @param suggestions - selected suggestions in display order.
 * @param preference - replace/append user preference (defaults to append).
 * @returns The next draft with every selected prompt appended, or the joined
 * prompts alone when the preference is replace.
 */
export function applySelected(
  current: string,
  suggestions: readonly NextStepSuggestionV1[],
  preference: SuggestionApplyPreference = 'append',
): string {
  if (preference === 'replace') {
    return suggestions.map(suggestion => suggestion.prompt.trim()).join('\n')
  }
  return suggestions.reduce((draft, suggestion) => appendPrompt(draft, suggestion.prompt), current)
}

/**
 * Build a combined prompt that asks the agent to execute the selected
 * suggestions in parallel. The actual parallel scheduling remains owned by
 * the plan/agent runtime; this function only composes user-facing text.
 *
 * @param suggestions - selected suggestions, all expected to be parallelSafe.
 * @returns A multi-line parallel execution prompt.
 */
export function composeParallelPrompt(suggestions: readonly NextStepSuggestionV1[]): string {
  const lines = suggestions.map((suggestion, index) => {
    const title = suggestion.label.trim()
    const prompt = suggestion.prompt.trim()
    return `${index + 1}. ${title} — ${prompt}`
  })
  return [
    '请并行执行以下方案：',
    ...lines,
    '优先采用 DAG/并行模式，冲突时向我确认。',
  ].join('\n')
}

/**
 * Merge suggestions from multiple sources, deduplicate by id, and sort by
 * `order` (lower first; ties keep source order).
 *
 * @param sources - suggestion sources.
 * @returns Merged suggestions.
 */
export function mergeSuggestions(sources: readonly SuggestionSource[]): NextStepSuggestionV1[] {
  const byId = new Map<string, NextStepSuggestionV1>()
  for (const source of sources) {
    for (const suggestion of source.getSuggestions()) {
      if (!byId.has(suggestion.id)) byId.set(suggestion.id, suggestion)
    }
  }
  return [...byId.values()].sort((left, right) => {
    const leftOrder = left.order ?? 0
    const rightOrder = right.order ?? 0
    return leftOrder - rightOrder
  })
}

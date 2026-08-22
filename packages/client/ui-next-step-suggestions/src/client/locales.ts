/** Locale strings for the next-step suggestion dock. */

export const NS = 'nextStepSuggestions'

export const zh = {
  'suggestions.aria': '下一步建议',
  'suggestions.multiSelect': '多选',
  'suggestions.apply': '应用到输入框',
  'suggestions.parallel': '并行执行',
  'suggestions.recommended': '推荐',
  'suggestions.source.plan': '方案',
  'suggestions.hint': '点击建议只填入输入框，不会自动发送。',
} satisfies Record<string, string>

export type NextStepSuggestionsKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    nextStepSuggestions: NextStepSuggestionsKey
  }
}

export const en = {
  'suggestions.aria': 'Next-step suggestions',
  'suggestions.multiSelect': 'Multi-select',
  'suggestions.apply': 'Apply to input',
  'suggestions.parallel': 'Run in parallel',
  'suggestions.recommended': 'Recommended',
  'suggestions.source.plan': 'Plan',
  'suggestions.hint': 'Clicking a suggestion fills the input box; it will not send automatically.',
} satisfies Record<NextStepSuggestionsKey, string>

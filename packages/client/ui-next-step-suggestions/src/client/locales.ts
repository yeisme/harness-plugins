/** Locale strings for the next-step suggestion dock. */

export const NS = 'nextStepSuggestions'

export const zh = {
  'suggestions.aria': '下一步建议',
  'suggestions.multiSelect': '多选',
  'suggestions.apply': '应用到输入框',
  'suggestions.parallel': '并行执行',
  'suggestions.replaceMode': '替换草稿',
  'suggestions.recommended': '推荐',
  'suggestions.source.plan': '方案',
  'suggestions.hint': '点击建议只填入输入框，不会自动发送。',
  'suggestions.keyboardHint': 'Tab/Shift+Tab 或左右方向键轮转，Esc 退出多选。',
  'suggestions.recapTitle': 'Conversation recap',
  'suggestions.reviewResult': '检查结果',
  'suggestions.runVerification': '运行验证',
  'suggestions.continueNextStep': '继续下一步',
  'suggestions.prompt.reviewResult': '检查已完成工作的遗漏、风险与回归。',
  'suggestions.prompt.runVerification': '运行本次工作的聚焦测试、类型检查和构建，并修复发现的问题。',
  'suggestions.prompt.continueNextStep': '根据已完成的工作，继续推进价值最高的下一步。',
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
  'suggestions.replaceMode': 'Replace draft',
  'suggestions.recommended': 'Recommended',
  'suggestions.source.plan': 'Plan',
  'suggestions.hint': 'Clicking a suggestion fills the input box; it will not send automatically.',
  'suggestions.keyboardHint': 'Use Tab/Shift+Tab or arrow keys to cycle; Escape exits multi-select.',
  'suggestions.recapTitle': 'Conversation recap',
  'suggestions.reviewResult': 'Review result',
  'suggestions.runVerification': 'Run verification',
  'suggestions.continueNextStep': 'Continue next step',
  'suggestions.prompt.reviewResult': 'Review the completed work for omissions, risks, and regressions.',
  'suggestions.prompt.runVerification': 'Run the focused tests, typecheck, and build for the completed work, then fix any failures.',
  'suggestions.prompt.continueNextStep': 'Continue with the highest-value next step based on the completed work.',
} satisfies Record<NextStepSuggestionsKey, string>

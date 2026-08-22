/**
 * DSH Next-Step Suggestions browser entry.
 *
 * 直接复用 `@yeisme/dsh-client-ui-next-step-suggestions/client` 的 slot 注册；
 * 本文件只做 re-export，不复制任何业务状态。
 *
 * @module @yeisme/dsh-next-step-suggestions/client
 */

export {
  apply,
  inject,
  SuggestionDock,
  SuggestionSourceRegistry,
  planOptionsToSuggestions,
  appendPrompt,
  applySelected,
  composeParallelPrompt,
  mergeSuggestions,
  en,
  NS,
  zh,
} from '@yeisme/dsh-client-ui-next-step-suggestions/client'
export type {
  NextStepSuggestionV1,
  NextStepSuggestionsKey,
  PlanOption,
  PlanOptionsProjection,
  PlanOptionsProjectionValue,
  SuggestionDockInjected,
  SuggestionDockProps,
  SuggestionSource,
} from '@yeisme/dsh-client-ui-next-step-suggestions/client'

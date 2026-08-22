/**
 * Types for the DSH Web next-step suggestion surface.
 *
 * These types are intentionally local to this plugin: V1 consumes the
 * published DSH runtime surface without requiring a compile-time dependency
 * on `@deepseek-ai/dsh-plan-mode`. The wire shapes mirror the plan-mode
 * projection so the plugin can read it by string key at runtime.
 *
 * @module @yeisme/dsh-client-ui-next-step-suggestions/types
 */

/** One clickable next-step suggestion shown above the composer. */
export interface NextStepSuggestionV1 {
  /** Stable id used for selection/dedup. */
  id: string
  /** Short label shown on the chip. */
  label: string
  /** Complete text inserted into the composer draft on click. */
  prompt: string
  /** Provenance: plan / tool / plugin / host. */
  source: 'plan' | 'tool' | 'plugin' | 'host'
  /** Selection semantics. */
  mode?: 'single' | 'multi' | 'parallel' | undefined
  /** Optional plan option identifier for parallel composition. */
  planOptionId?: string
  /** Optional plan identifier for parallel composition. */
  planId?: string
  /** Whether this suggestion may participate in parallel composition. */
  parallelSafe?: boolean
  /** Whether to show a recommendation badge. */
  recommended?: boolean
  /** Display order; lower sorts first. */
  order?: number
}

/** A client-side source of suggestions. */
export interface SuggestionSource {
  readonly id: string
  readonly getSuggestions: () => readonly NextStepSuggestionV1[]
}

/** Local mirror of the plan-mode PlanOption wire value. */
export interface PlanOption {
  optionId: string
  title: string
  summary: string
  markdown: string
  tradeoffs?: string[] | undefined
  estimatedSteps?: number | undefined
  recommended?: boolean | undefined
}

/** Local mirror of the plan-mode plan-options projection value. */
export interface PlanOptionsProjection {
  planId: string
  round: number
  options: PlanOption[]
  selectedOptionId?: string | undefined
  status: 'proposed' | 'selected' | 'superseded'
}

/** Local mirror of the plan-mode plan-options projection value envelope. */
export interface PlanOptionsProjectionValue {
  latest?: PlanOptionsProjection | undefined
  revisions: PlanOptionsProjection[]
}

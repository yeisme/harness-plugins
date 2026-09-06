/**
 * @yeisme/dsh-client-ui-token-usage root entry (library face).
 *
 * The browser ModuleLoader face lives in `./client`; this entry re-exports
 * the pure derivation and wire types for hosts and tests.
 *
 * @module @yeisme/dsh-client-ui-token-usage
 */

export {
  apply,
  ControllerBinding,
  inject,
  InsightsProbeStore,
  name,
  OverlayToggle,
  probeInsightsCapabilities,
  readViewSessionRef,
  SessionInsightsBinding,
  SessionInsightsBindingRegistry,
  sessionInsightsTargetKey,
  TokenUsageController,
  tokenUsageRemoteContribution,
} from './client/index.ts'
export type { InsightsProbeState } from './client/index.ts'
export type { TokenBalanceSlice, TokenUsageControllerState, TokenUsageSlice } from './client/controller.ts'
export type {
  SessionInsightsBindingState,
  SessionInsightsSource,
  SessionInsightsTarget,
} from './client/insights-binding.ts'
export { deriveSessionInsightsViewModel } from './client/insights-projection.ts'
export type { SessionInsightsViewModel } from './client/insights-projection.ts'
export { SessionInsightsPanel } from './client/insights-panel.tsx'
export type { SessionInsightsPanelProps, SessionInsightsTrajectorySeam } from './client/insights-panel.tsx'
export { deriveTokenUsageViewModel, formatTokens } from './client/projection.ts'
export type { TokenUsageViewModel } from './client/projection.ts'
export { TokenUsagePanel } from './client/panel.tsx'
export type { TokenUsagePanelProps } from './client/panel.tsx'
export { en, NS, zh } from './client/locales.ts'
export type { TokenUsageKey, TokenUsageTranslator } from './client/locales.ts'
export { EMPTY_BUCKETS, SESSION_INSIGHTS_SCHEMA_VERSION } from './wire.ts'
export type {
  SessionInsightsQueryInputV1,
  SessionInsightsQueryResultV1,
  SessionInsightsSnapshotV1,
  TokenBalanceInfoV1,
  TokenBalanceSnapshotV1,
  TokenBucketsV1,
  TokenUsageCapabilitiesV1,
  TokenUsageProviderRowV1,
  TokenUsageRemoteFace,
  TokenUsageSessionRowV1,
  TokenUsageSnapshotAnswerV1,
  TokenUsageRefreshAnswerV1,
  TokenUsageSnapshotV1,
} from './wire.ts'

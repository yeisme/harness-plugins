/**
 * @yeisme/dsh-client-ui-token-usage root entry (library face).
 *
 * The browser ModuleLoader face lives in `./client`; this entry re-exports
 * the pure derivation and wire types for hosts and tests.
 *
 * @module @yeisme/dsh-client-ui-token-usage
 */

export {
  ControllerBinding,
  OverlayToggle,
  TokenUsageController,
  apply,
  inject,
  name,
  tokenUsageRemoteContribution,
} from './client/index.ts'
export { deriveTokenUsageViewModel, formatTokens } from './client/projection.ts'
export type { TokenUsageViewModel } from './client/projection.ts'
export { TokenUsagePanel } from './client/panel.tsx'
export type { TokenUsagePanelProps } from './client/panel.tsx'
export { en, NS, zh } from './client/locales.ts'
export type { TokenUsageKey, TokenUsageTranslator } from './client/locales.ts'
export { EMPTY_BUCKETS } from './wire.ts'
export type {
  TokenBalanceInfoV1,
  TokenBalanceSnapshotV1,
  TokenBucketsV1,
  TokenUsageProviderRowV1,
  TokenUsageRemoteFace,
  TokenUsageSessionRowV1,
  TokenUsageSnapshotAnswerV1,
  TokenUsageRefreshAnswerV1,
  TokenUsageSnapshotV1,
} from './wire.ts'

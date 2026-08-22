/**
 * DSH login-state profile manager, Phase 1 client face.
 *
 * @module @yeisme/dsh-client-ui-session-cookie-manager
 */

export {
  FORBIDDEN_PROFILE_KEYS,
  parseProfileMeta,
  type ProfileMetaV1,
  type ProfileParseResult,
} from './profile-types.ts'
export { ProfileStore, ProfileStoreError } from './profile-store.ts'
export type { CreateProfileInput, ProfileStoreOptions } from './profile-store.ts'
export { CookieManagerPanel } from './panel.tsx'
export {
  renderableQuotaFields,
  submitProfileCreate,
  submitProfileRemove,
  submitProfileRename,
} from './panel.tsx'
export type {
  AccountProjectionV1,
  CookieManagerPanelLabels,
  CookieManagerPanelProps,
  ProfileCreateHandler,
  ProfileRemoveHandler,
  ProfileRenameHandler,
  QuotaProjectionV1,
} from './panel.tsx'

export {
  composeAccountProjections,
  providerSnapshotToAccounts,
  sessionSnapshotToAccounts,
  type ProviderGroupLike,
  type ProviderSnapshotLike,
  type SessionListSnapshotLike,
  type SessionSummaryLike,
} from './provider-adapter.ts'
export { createLoginProfilesView, profileErrorMessage, registerLoginProfilesPaneViews } from './pane-views.tsx'
export type { ProfilesPaneDeps, ProfilesPaneSurface } from './pane-views.tsx'
export {
  COOKIE_JARS_CAPABILITY,
  applyCookieJar,
  bindCookieJars,
  clearCookieJar,
  hasCookieJarsCapability,
  isSafeCookieJarProfile,
  receiptErrorMessage,
  redactCookieJarReceipt,
  switchCookieJar,
} from './cookie-jars.ts'
export type {
  CookieJarAction,
  CookieJarCallResult,
  CookieJarProfileRef,
  CookieJarReceipt,
  CookieJarSource,
} from './cookie-jars.ts'

export const name = 'dsh-session-cookie-manager'
export const inject = [] as const

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
export type {
  AccountProjectionV1,
  CookieManagerPanelLabels,
  CookieManagerPanelProps,
  QuotaProjectionV1,
} from './panel.tsx'

export {
  providerSnapshotToAccounts,
  type ProviderGroupLike,
  type ProviderSnapshotLike,
} from './provider-adapter.ts'
export { createLoginProfilesView, registerLoginProfilesPaneViews } from './pane-views.tsx'
export type { ProfilesPaneDeps, ProfilesPaneSurface } from './pane-views.tsx'

export const name = 'dsh-session-cookie-manager'
export const inject = [] as const

/**
 * Login profiles pane view (Phase 1): registers one singleton navigator
 * `workspace.login-profiles` on the Pane Workbench V2 surface, rendering the
 * metadata-only CookieManagerPanel. No credential value ever flows here.
 *
 * @module @yeisme/dsh-client-ui-session-cookie-manager
 */

import { useMemo, useState } from 'react'
import { CookieManagerPanel, type AccountProjectionV1 } from './panel.tsx'
import { ProfileStore, ProfileStoreError } from './profile-store.ts'
import { providerSnapshotToAccounts, type ProviderSnapshotLike } from './provider-adapter.ts'

/** Minimal structural pane surface; avoids a hard dependency on the shell. */
export interface ProfilesPaneSurface {
  registerView(input: unknown): () => void
}

export interface ProfilesPaneDeps {
  /** Metadata store; a fresh in-memory store is created when absent. */
  store?: ProfileStore | undefined
  /** Owner provider snapshot composed read-only into the accounts section. */
  providerSnapshot?: ProviderSnapshotLike | undefined
}

/** Local factory for the singleton login-profiles navigator view. */
export function createLoginProfilesView(deps: ProfilesPaneDeps = {}) {
  return function LoginProfilesPaneView() {
    const store = useMemo(() => deps.store ?? new ProfileStore(), [deps.store])
    const [profiles, setProfiles] = useState(() => [...store.list()])
    const [error, setError] = useState<string | undefined>(undefined)
    const accounts: readonly AccountProjectionV1[] = providerSnapshotToAccounts(deps.providerSnapshot)
    const refresh = (): void => { setProfiles([...store.list()]) }
    const fail = (caught: unknown): void => {
      const message = caught instanceof ProfileStoreError ? caught.message : 'Profile change failed.'
      setError(message)
    }
    return (
      <CookieManagerPanel
        profiles={profiles}
        accounts={accounts}
        error={error}
        onCreate={input => {
          try {
            store.create(input)
            setError(undefined)
            refresh()
          } catch (caught) {
            fail(caught)
          }
        }}
        onRename={(profileId, displayName) => {
          try {
            store.rename(profileId, displayName)
            setError(undefined)
            refresh()
          } catch (caught) {
            fail(caught)
          }
        }}
        onRemove={profileId => {
          store.remove(profileId)
          setError(undefined)
          refresh()
        }}
      />
    )
  }
}

/** Register the login-profiles pane view; returns a disposer. */
export function registerLoginProfilesPaneViews(pane: ProfilesPaneSurface, deps: ProfilesPaneDeps = {}): () => void {
  return pane.registerView({
    descriptor: {
      kind: 'workspace.login-profiles',
      label: 'Login profiles',
      componentKey: 'login-profiles',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
    },
    component: createLoginProfilesView(deps),
  })
}

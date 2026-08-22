/**
 * Login profiles pane view (Phase 1): registers one singleton navigator
 * `workspace.login-profiles` on the Pane Workbench V2 surface, rendering the
 * metadata-only CookieManagerPanel. No credential value ever flows here.
 *
 * @module @yeisme/dsh-client-ui-session-cookie-manager
 */

import { useMemo, useState } from 'react'
import { CookieManagerPanel } from './panel.tsx'
import { ProfileStore, ProfileStoreError } from './profile-store.ts'
import { composeAccountProjections, type ProviderSnapshotLike, type SessionListSnapshotLike } from './provider-adapter.ts'

/** Minimal structural pane surface; avoids a hard dependency on the shell. */
export interface ProfilesPaneSurface {
  registerView(input: unknown): () => void
}

/**
 * Map a store failure onto the panel error text. Store errors carry fixed
 * parser messages (never echoed user input); anything else degrades to the
 * generic constant so no foreign message text can leak into the renderer.
 */
export function profileErrorMessage(caught: unknown): string {
  return caught instanceof ProfileStoreError ? caught.message : 'Profile change failed.'
}

export interface ProfilesPaneDeps {
  /** Metadata store; a fresh in-memory store is created when absent. */
  store?: ProfileStore | undefined
  /** Owner provider snapshot composed read-only into the accounts section. */
  providerSnapshot?: ProviderSnapshotLike | undefined
  /** Owner session-resume snapshot composed read-only into the accounts section. */
  sessionSnapshot?: SessionListSnapshotLike | undefined
}

/** Local factory for the singleton login-profiles navigator view. */
export function createLoginProfilesView(deps: ProfilesPaneDeps = {}) {
  return function LoginProfilesPaneView() {
    const store = useMemo(() => deps.store ?? new ProfileStore(), [deps.store])
    const [profiles, setProfiles] = useState(() => [...store.list()])
    const [error, setError] = useState<string | undefined>(undefined)
    const accounts = composeAccountProjections(deps.providerSnapshot, deps.sessionSnapshot)
    const refresh = (): void => { setProfiles([...store.list()]) }
    const fail = (caught: unknown): void => {
      setError(profileErrorMessage(caught))
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

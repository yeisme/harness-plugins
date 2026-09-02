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
import { composeAccountProjections, officialSessionsToSnapshot, type ProviderSnapshotLike, type SessionListSnapshotLike } from './provider-adapter.ts'
import {
  applyCookieJar,
  bindCookieJars,
  clearCookieJar,
  receiptErrorMessage,
  switchCookieJar,
  type CookieJarSource,
} from './cookie-jars.ts'
import type { ProfileMetaV1 } from './profile-types.ts'

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
  /** Official DSH `sessions` host; folded into sessionSnapshot when that dep is absent. */
  sessions?: unknown
  /**
   * Host cookie-jar face. Published DSH is absent; only a live
   * `WebCookieJarsV1` source enables apply/switch/clear.
   */
  cookieJars?: CookieJarSource | unknown | undefined
}

/** Local factory for the singleton login-profiles navigator view. */
export function createLoginProfilesView(deps: ProfilesPaneDeps = {}) {
  return function LoginProfilesPaneView() {
    const store = useMemo(() => deps.store ?? new ProfileStore(), [deps.store])
    const cookieJars = useMemo(() => bindCookieJars(deps.cookieJars), [deps.cookieJars])
    const [profiles, setProfiles] = useState(() => [...store.list()])
    const [error, setError] = useState<string | undefined>(undefined)
    const [activeProfileId, setActiveProfileId] = useState<string | undefined>(undefined)
    const sessionSnapshot = deps.sessionSnapshot ?? officialSessionsToSnapshot(deps.sessions)
    const accounts = composeAccountProjections(deps.providerSnapshot, sessionSnapshot)
    const refresh = (): void => { setProfiles([...store.list()]) }
    const fail = (caught: unknown): void => {
      setError(profileErrorMessage(caught))
    }
    const refOf = (profileId: string): { profileRef: string; siteScope: string } | undefined => {
      const profile: ProfileMetaV1 | undefined = store.list().find(item => item.profileId === profileId)
      if (profile === undefined) return undefined
      return { profileRef: profile.profileId, siteScope: profile.siteScope }
    }
    return (
      <CookieManagerPanel
        profiles={profiles}
        accounts={accounts}
        error={error}
        activeProfileId={activeProfileId}
        {...cookieJars === undefined ? {} : {
          onApply: (profileId: string) => {
            const profile = refOf(profileId)
            if (profile === undefined) {
              setError('profile not found')
              return
            }
            void applyCookieJar(cookieJars, profile).then(result => {
              const message = receiptErrorMessage(result)
              setError(message)
              if (result.ok) setActiveProfileId(profileId)
            })
          },
          onSwitch: (fromProfileId: string, toProfileId: string) => {
            const from = refOf(fromProfileId)
            const to = refOf(toProfileId)
            if (from === undefined || to === undefined) {
              setError('profile not found')
              return
            }
            void switchCookieJar(cookieJars, from, to).then(result => {
              const message = receiptErrorMessage(result)
              setError(message)
              if (result.ok) setActiveProfileId(toProfileId)
            })
          },
          onClear: (profileId: string) => {
            const profile = refOf(profileId)
            if (profile === undefined) {
              setError('profile not found')
              return
            }
            void clearCookieJar(cookieJars, profile).then(result => {
              const message = receiptErrorMessage(result)
              setError(message)
              if (result.ok && activeProfileId === profileId) setActiveProfileId(undefined)
            })
          },
        }}
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

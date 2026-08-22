/**
 * Login-state profile manager panel (Phase 1): metadata CRUD, read-only
 * account composition, quota skeleton, and an honest degraded state while
 * the host cookie seam (`web.cookieJars`) is pending upstream.
 *
 * @module @yeisme/dsh-client-ui-session-cookie-manager
 */

import { useState } from 'react'
import { FORBIDDEN_PROFILE_KEYS, type ProfileMetaV1 } from './profile-types.ts'

/** Read-only account projection composed from an existing owner (e.g. model-provider resume). */
export interface AccountProjectionV1 {
  provider: string
  accountSummary: string
  status: 'active' | 'expired' | 'unknown'
}

/** Owner-provided quota projection; absent means fail-visible, never guessed. */
export interface QuotaProjectionV1 {
  fields: Record<string, string>
  freshness?: string
}

export type ProfileCreateHandler = (input: { siteScope: string; displayName: string }) => void
export type ProfileRenameHandler = (profileId: string, displayName: string) => void
export type ProfileRemoveHandler = (profileId: string) => void

/**
 * Create submission used by the panel's form: trims both fields and refuses
 * empty ones. Returns false (and never invokes the handler) on invalid input.
 */
export function submitProfileCreate(
  onCreate: ProfileCreateHandler | undefined,
  siteScope: string,
  displayName: string,
): boolean {
  const site = siteScope.trim()
  const name = displayName.trim()
  if (site.length === 0 || name.length === 0 || onCreate === undefined) return false
  onCreate({ siteScope: site, displayName: name })
  return true
}

/**
 * Rename submission used by the panel's rows: a cleared draft is a no-op, not
 * an invalid rename. Returns false when nothing valid was submitted.
 */
export function submitProfileRename(
  onRename: ProfileRenameHandler | undefined,
  profileId: string,
  draft: string,
): boolean {
  const next = draft.trim()
  if (next.length === 0 || onRename === undefined) return false
  onRename(profileId, next)
  return true
}

/** Delete submission used by the panel's rows. */
export function submitProfileRemove(onRemove: ProfileRemoveHandler | undefined, profileId: string): boolean {
  if (onRemove === undefined) return false
  onRemove(profileId)
  return true
}

/**
 * Deny-by-default quota field filter: credential-shaped keys and non-string
 * owner values are never rendered even if a projection carries them.
 */
export function renderableQuotaFields(quota: QuotaProjectionV1): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(quota.fields)) {
    if (typeof value !== 'string') continue
    if ((FORBIDDEN_PROFILE_KEYS as readonly string[]).includes(key.trim().toLowerCase())) continue
    fields[key] = value
  }
  return fields
}

export interface CookieManagerPanelLabels {
  title?: string
  create?: string
  site?: string
  displayName?: string
  rename?: string
  remove?: string
  apply?: string
  applyUnavailable?: string
  accounts?: string
  noAccounts?: string
  quota?: string
  quotaUnavailable?: string
  empty?: string
  error?: string
}

const DEFAULT_LABELS: Required<CookieManagerPanelLabels> = {
  title: 'Login profiles',
  create: 'Add profile',
  site: 'Site',
  displayName: 'Display name',
  rename: 'Rename',
  remove: 'Delete',
  apply: 'Apply login state',
  applyUnavailable: 'Applying a real cookie jar waits for the host seam (web.cookieJars); nothing is stored or written locally.',
  accounts: 'Accounts',
  noAccounts: 'No account projection available.',
  quota: 'Quota',
  quotaUnavailable: 'Quota source unavailable.',
  empty: 'No profiles yet.',
  error: 'Profile change failed.',
}

export interface CookieManagerPanelProps {
  profiles: readonly ProfileMetaV1[]
  onCreate?: ProfileCreateHandler | undefined
  onRename?: ProfileRenameHandler | undefined
  onRemove?: ProfileRemoveHandler | undefined
  /** Host seam bridge; absent renders the degraded state. */
  onApply?: ((profileId: string) => void) | undefined
  accounts?: readonly AccountProjectionV1[] | undefined
  quota?: QuotaProjectionV1 | undefined
  labels?: CookieManagerPanelLabels | undefined
  /** Latest CRUD failure; never contains credential values. */
  error?: string | undefined
}

/** Phase 1 panel: metadata only — no credential value ever appears here. */
export function CookieManagerPanel({
  profiles, onCreate, onRename, onRemove, onApply, accounts, quota, labels, error,
}: CookieManagerPanelProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [site, setSite] = useState('')
  const [name, setName] = useState('')
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({})
  return (
    <section aria-label={text.title} data-dsh-cookie-manager style={{ display: 'grid', gap: 10, fontSize: 12 }}>
      <h3>{text.title}</h3>
      {error !== undefined && error.length > 0 && (
        <p role="alert" data-dsh-cookie-error>{error}</p>
      )}

      <form
        onSubmit={event => {
          event.preventDefault()
          if (submitProfileCreate(onCreate, site, name)) {
            setSite('')
            setName('')
          }
        }}
        aria-label={text.create}
      >
        <label>{text.site}<input value={site} onChange={e => { setSite(e.target.value) }} aria-label={text.site} /></label>
        <label>{text.displayName}<input value={name} onChange={e => { setName(e.target.value) }} aria-label={text.displayName} /></label>
        <button type="submit">{text.create}</button>
      </form>

      {profiles.length === 0 && <p>{text.empty}</p>}
      <ul data-profile-count={profiles.length}>
        {profiles.map(profile => (
          <li key={profile.profileId} data-profile-id={profile.profileId}>
            <span>{profile.displayName}</span>
            <span aria-label="site">{profile.siteScope}</span>
            {profile.accountSummary !== undefined && <span aria-label="account">{profile.accountSummary}</span>}
            <label>
              <span className="sr-only">{text.rename}</span>
              <input
                value={renameDrafts[profile.profileId] ?? profile.displayName}
                aria-label={`${text.rename} ${profile.displayName}`}
                onChange={event => {
                  const value = event.target.value
                  setRenameDrafts(current => ({ ...current, [profile.profileId]: value }))
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                submitProfileRename(onRename, profile.profileId, renameDrafts[profile.profileId] ?? profile.displayName)
              }}
            >
              {text.rename}
            </button>
            <button type="button" onClick={() => { submitProfileRemove(onRemove, profile.profileId) }}>{text.remove}</button>
            {onApply === undefined
              ? <button type="button" disabled aria-describedby="apply-unavailable">{text.apply}</button>
              : <button type="button" onClick={() => { onApply(profile.profileId) }}>{text.apply}</button>}
          </li>
        ))}
      </ul>
      {onApply === undefined && <p id="apply-unavailable" role="note">{text.applyUnavailable}</p>}

      <section aria-label={text.accounts} data-dsh-cookie-accounts>
        <h4>{text.accounts}</h4>
        {accounts === undefined || accounts.length === 0
          ? <p>{text.noAccounts}</p>
          : (
            <ul>
              {accounts.map(account => (
                <li key={`${account.provider}:${account.accountSummary}`}>
                  <span>{account.provider}</span>
                  <span aria-label="account">{account.accountSummary}</span>
                  <span aria-label="status">{account.status}</span>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section aria-label={text.quota} data-dsh-cookie-quota data-available={quota !== undefined || undefined}>
        <h4>{text.quota}</h4>
        {quota === undefined || Object.keys(renderableQuotaFields(quota)).length === 0
          ? <p role="status">{text.quotaUnavailable}</p>
          : (
            <dl>
              {Object.entries(renderableQuotaFields(quota)).map(([key, value]) => (
                <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
              ))}
              {quota.freshness !== undefined && <div><dt>freshness</dt><dd>{quota.freshness}</dd></div>}
            </dl>
          )}
      </section>
    </section>
  )
}

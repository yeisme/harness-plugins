/**
 * Login-state profile manager panel (Phase 1): metadata CRUD, read-only
 * account composition, quota skeleton, and an honest degraded state while
 * the host cookie seam (`web.cookieJars`) is absent on published DSH.
 *
 * @module @yeisme/dsh-client-ui-session-cookie-manager
 */

import { useState } from 'react'
import { statusTone } from '@yeisme/dsh-client-ui-visual-kit'
import { FORBIDDEN_PROFILE_KEYS, type ProfileMetaV1 } from './profile-types.ts'
import { cookieManagerStyles } from './styles.ts'

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
  switchProfile?: string
  switchUnavailable?: string
  clear?: string
  clearUnavailable?: string
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
  switchProfile: 'Switch login state',
  switchUnavailable: 'Atomic jar switch waits for the host seam (web.cookieJars); nothing is stored or written locally.',
  clear: 'Clear login state',
  clearUnavailable: 'Clearing a real cookie jar waits for the host seam (web.cookieJars); nothing is stored or written locally.',
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
  /** Host apply bridge; absent renders the degraded apply state. */
  onApply?: ((profileId: string) => void) | undefined
  /** Host atomic switch; absent keeps the switch control disabled. */
  onSwitch?: ((fromProfileId: string, toProfileId: string) => void) | undefined
  /** Host clear; absent keeps the clear control disabled. */
  onClear?: ((profileId: string) => void) | undefined
  /** Currently applied profile; used only as an opaque switch source. */
  activeProfileId?: string | undefined
  accounts?: readonly AccountProjectionV1[] | undefined
  quota?: QuotaProjectionV1 | undefined
  labels?: CookieManagerPanelLabels | undefined
  /** Latest CRUD failure; never contains credential values. */
  error?: string | undefined
}

/** Phase 1 panel: metadata only — no credential value ever appears here. */
export function CookieManagerPanel({
  profiles, onCreate, onRename, onRemove, onApply, onSwitch, onClear, activeProfileId, accounts, quota, labels, error,
}: CookieManagerPanelProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [site, setSite] = useState('')
  const [name, setName] = useState('')
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({})
  return (
    <section aria-label={text.title} data-dsh-cookie-manager style={{ display: 'grid', gap: 12 }}>
      <style>{cookieManagerStyles}</style>
      <h3 className="cm-title">{text.title}</h3>
      {error !== undefined && error.length > 0 && (
        <p role="alert" data-dsh-cookie-error className="cm-alert">{error}</p>
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
        className="cm-card cm-form"
      >
        <label>{text.site}<input value={site} onChange={e => { setSite(e.target.value) }} aria-label={text.site} /></label>
        <label>{text.displayName}<input value={name} onChange={e => { setName(e.target.value) }} aria-label={text.displayName} /></label>
        <button type="submit" className="cm-btn">{text.create}</button>
      </form>

      {profiles.length === 0 && <p className="cm-empty">{text.empty}</p>}
      <ul data-profile-count={profiles.length} className="cm-list">
        {profiles.map(profile => (
          <li key={profile.profileId} data-profile-id={profile.profileId} className="cm-row">
            <span className="cm-name">{profile.displayName}</span>
            <span aria-label="site" className="cm-site">{profile.siteScope}</span>
            {profile.accountSummary !== undefined && <span aria-label="account" className="cm-site">{profile.accountSummary}</span>}
            <label className="cm-rename">
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
            className="cm-btn"
            >
              {text.rename}
            </button>
            <button type="button" className="cm-btn" onClick={() => { submitProfileRemove(onRemove, profile.profileId) }}>{text.remove}</button>
            {onApply === undefined
              ? <button type="button" disabled aria-describedby="apply-unavailable" className="cm-btn">{text.apply}</button>
              : <button type="button" className="cm-btn" onClick={() => { onApply(profile.profileId) }}>{text.apply}</button>}
            {onSwitch === undefined || activeProfileId === undefined || activeProfileId === profile.profileId
              ? <button type="button" disabled aria-describedby="switch-unavailable" className="cm-btn">{text.switchProfile}</button>
              : <button type="button" className="cm-btn" onClick={() => { onSwitch(activeProfileId, profile.profileId) }}>{text.switchProfile}</button>}
            {onClear === undefined
              ? <button type="button" disabled aria-describedby="clear-unavailable" className="cm-btn">{text.clear}</button>
              : <button type="button" className="cm-btn" onClick={() => { onClear(profile.profileId) }}>{text.clear}</button>}
          </li>
        ))}
      </ul>
      {onApply === undefined && <p id="apply-unavailable" role="note" className="cm-note">{text.applyUnavailable}</p>}
      {onSwitch === undefined && <p id="switch-unavailable" role="note" className="cm-note">{text.switchUnavailable}</p>}
      {onClear === undefined && <p id="clear-unavailable" role="note" className="cm-note">{text.clearUnavailable}</p>}

      <section aria-label={text.accounts} data-dsh-cookie-accounts className="cm-card">
        <h4>{text.accounts}</h4>
        {accounts === undefined || accounts.length === 0
          ? <p className="cm-empty">{text.noAccounts}</p>
          : (
            <ul>
              {accounts.map(account => (
                <li key={`${account.provider}:${account.accountSummary}`} className="cm-account">
                  <span className="cm-name">{account.provider}</span>
                  <span aria-label="account" className="cm-account-summary">{account.accountSummary}</span>
                  <span aria-label="status" className="cm-account-status"><i className="cm-dot" data-tone={statusTone(account.status)} aria-hidden="true" />{account.status}</span>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section aria-label={text.quota} data-dsh-cookie-quota data-available={quota !== undefined || undefined} className="cm-card cm-quota">
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

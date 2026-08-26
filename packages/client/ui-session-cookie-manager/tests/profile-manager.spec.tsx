import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  COOKIE_JARS_CAPABILITY,
  CookieManagerPanel,
  ProfileStore,
  ProfileStoreError,
  FORBIDDEN_PROFILE_KEYS,
  applyCookieJar,
  bindCookieJars,
  clearCookieJar,
  composeAccountProjections,
  createLoginProfilesView,
  hasCookieJarsCapability,
  isSafeCookieJarProfile,
  parseProfileMeta,
  profileErrorMessage,
  providerSnapshotToAccounts,
  redactCookieJarReceipt,
  registerLoginProfilesPaneViews,
  renderableQuotaFields,
  sessionSnapshotToAccounts,
  submitProfileCreate,
  submitProfileRemove,
  submitProfileRename,
  switchCookieJar,
} from '../src/index.ts'
import type { CookieJarReceipt, CookieJarSource } from '../src/index.ts'
import type { ProfileMetaV1, SessionListSnapshotLike } from '../src/index.ts'

const base = {
  profileId: 'profile-1',
  siteScope: 'example.com',
  displayName: 'Work account',
  capabilities: ['apply'],
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
}

describe('parseProfileMeta', () => {
  it('accepts valid metadata and rejects every forbidden credential field', () => {
    expect(parseProfileMeta(base).ok).toBe(true)
    for (const key of FORBIDDEN_PROFILE_KEYS) {
      expect(parseProfileMeta({ ...base, [key]: 'x' }).ok).toBe(false)
    }
  })
  it('rejects URL/path scopes and non-ISO timestamps', () => {
    expect(parseProfileMeta({ ...base, siteScope: 'https://x' }).ok).toBe(false)
    expect(parseProfileMeta({ ...base, siteScope: 'a/b' }).ok).toBe(false)
    expect(parseProfileMeta({ ...base, createdAt: 'yesterday' }).ok).toBe(false)
  })
})

describe('ProfileStore', () => {
  const store = () => new ProfileStore({
    idFactory: (() => { let n = 0; return () => `profile-${++n}` })(),
    now: () => '2026-08-20T10:00:00Z',
  })

  it('creates, renames, removes, and lists deterministically', () => {
    const s = store()
    s.create({ siteScope: 'example.com', displayName: 'A' })
    s.create({ siteScope: '*', displayName: 'B', accountSummary: 'acct-1' })
    expect(s.list().map(p => p.displayName)).toEqual(['A', 'B'])
    s.rename('profile-1', 'A2')
    expect(s.list()[0]?.displayName).toBe('A2')
    expect(s.remove('profile-2')).toBe(true)
    expect(s.list()).toHaveLength(1)
  })

  it('serialization round-trips and provably carries no credential values', () => {
    const s = store()
    s.create({ siteScope: 'example.com', displayName: 'A' })
    const text = s.serialize()
    for (const word of ['cookie', 'token', 'secret', 'bearer']) {
      expect(text).not.toContain(word)
    }
    const restored = ProfileStore.deserialize(text)
    expect(restored.list()).toEqual(s.list())
  })

  it('persisted schema is a closed whitelist: no credential field can exist', () => {
    const s = store()
    s.create({ siteScope: 'example.com', displayName: 'A', accountSummary: 'acct-1' })
    s.create({ siteScope: '*', displayName: 'B' })
    const entries = JSON.parse(s.serialize()) as Record<string, unknown>[]
    const allowed = new Set(['profileId', 'siteScope', 'displayName', 'accountSummary', 'capabilities', 'createdAt', 'updatedAt'])
    for (const entry of entries) {
      for (const key of Object.keys(entry)) {
        expect(allowed.has(key)).toBe(true)
      }
    }
    expect(entries.every(e => typeof e.profileId === 'string' && Array.isArray(e.capabilities))).toBe(true)
  })

  it('deserialize fails closed on forbidden or invalid entries', () => {
    expect(() => ProfileStore.deserialize(JSON.stringify([{ ...base, token: 'x' }]))).toThrow(/forbidden/)
    expect(() => ProfileStore.deserialize(JSON.stringify([{ ...base, siteScope: 'https://x' }]))).toThrow()
    expect(() => ProfileStore.deserialize('not-json')).toThrow()
  })
})

const profiles: readonly ProfileMetaV1[] = [
  { ...base },
  { ...base, profileId: 'profile-2', displayName: 'Personal', siteScope: 'example.com', accountSummary: 'acct-2' },
]

describe('CookieManagerPanel', () => {
  it('renders profile rows with metadata only', () => {
    const html = renderToStaticMarkup(<CookieManagerPanel profiles={profiles} />)
    expect(html).toContain('data-dsh-cookie-manager')
    expect(html).toContain('Work account')
    expect(html).toContain('acct-2')
    expect(html).toContain('data-profile-count="2"')
    expect(html).not.toContain('cookie=')
  })
  it('renders the degraded apply state without a host seam', () => {
    const html = renderToStaticMarkup(<CookieManagerPanel profiles={profiles} />)
    expect(html).toContain('disabled')
    expect(html).toContain('web.cookieJars')
    expect(html).toContain('role="note"')
    expect(html).toContain('Apply login state')
    expect(html).toContain('Switch login state')
    expect(html).toContain('Clear login state')
  })
  it('enables apply/switch/clear only when the host bridges are present', () => {
    const html = renderToStaticMarkup(
      <CookieManagerPanel
        profiles={profiles}
        activeProfileId="profile-1"
        onApply={() => {}}
        onSwitch={() => {}}
        onClear={() => {}}
      />,
    )
    expect(html).not.toContain('web.cookieJars')
    expect(html).not.toContain('role="note"')
    expect(html).toContain('Apply login state')
    expect(html).toContain('Switch login state')
    expect(html).toContain('Clear login state')
  })
  it('renders read-only accounts and a fail-visible quota section', () => {
    const html = renderToStaticMarkup(
      <CookieManagerPanel
        profiles={[]}
        accounts={[{ provider: 'deepseek', accountSummary: 'acct-1', status: 'active' }]}
      />,
    )
    expect(html).toContain('acct-1')
    expect(html).toContain('active')
    expect(html).toContain('data-dsh-cookie-quota')
    expect(html).toContain('Quota source unavailable')
  })
  it('renders owner quota fields when provided', () => {
    const html = renderToStaticMarkup(
      <CookieManagerPanel profiles={[]} quota={{ fields: { used: '12 GB' }, freshness: '2026-08-20T09:00:00Z' }} />,
    )
    expect(html).toContain('data-available')
    expect(html).toContain('12 GB')
    expect(html).toContain('freshness')
  })
  it('renders a CRUD failure without credential values', () => {
    const html = renderToStaticMarkup(
      <CookieManagerPanel profiles={profiles} error="displayName must be a clean bounded string" />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('data-dsh-cookie-error')
    expect(html).toContain('displayName must be a clean bounded string')
    expect(html).not.toContain('cookie=')
    expect(html).not.toContain('token')
  })
  it('exposes a rename field instead of silently suffixing the name', () => {
    const html = renderToStaticMarkup(<CookieManagerPanel profiles={profiles} />)
    expect(html).toContain('aria-label="Rename Work account"')
    expect(html).not.toContain('A2')
  })
})

describe('provider adapter and pane view', () => {
  it('maps provider snapshot statuses to read-only account projections', () => {
    const snapshot = {
      revision: 3,
      state: 'ready' as const,
      providers: [
        { id: 'p1', name: 'deepseek', status: 'available' as const, modelCount: 2 },
        { id: 'p2', name: 'other', status: 'needs-key' as const, modelCount: 0 },
      ],
    }
    const accounts = providerSnapshotToAccounts(snapshot)
    expect(accounts).toEqual([
      { provider: 'deepseek', accountSummary: '2 models', status: 'active' },
      { provider: 'other', accountSummary: '0 models', status: 'unknown' },
    ])
    expect(providerSnapshotToAccounts({ ...snapshot, state: 'unavailable' })).toEqual([])
    expect(providerSnapshotToAccounts(undefined)).toEqual([])
  })

  it('composes account-resume sessions read-only and drops owner-private fields', () => {
    const snapshot: SessionListSnapshotLike = {
      revision: 7,
      state: 'ready',
      sessions: [
        { ref: 's1', title: 'Work account', status: 'running', modelLabel: 'deepseek-chat', enabled: true },
        { ref: 's2', title: 'Old account', status: 'archived', enabled: true },
        { ref: 's3', title: 'Disabled account', status: 'active', enabled: false },
      ],
    }
    expect(sessionSnapshotToAccounts(snapshot)).toEqual([
      { provider: 'deepseek-chat', accountSummary: 'Work account', status: 'active' },
      { provider: 'session', accountSummary: 'Old account', status: 'expired' },
    ])
    expect(sessionSnapshotToAccounts({ ...snapshot, state: 'unavailable' })).toEqual([])
    expect(sessionSnapshotToAccounts(undefined)).toEqual([])
    const withPrivateFields = {
      ...snapshot,
      sessions: snapshot.sessions.map(s => ({ ...s, reason: 'host-private', actionRefs: { resume: 'server-ref' } })),
    } as SessionListSnapshotLike
    const projected = JSON.stringify(sessionSnapshotToAccounts(withPrivateFields))
    expect(projected).not.toContain('reason')
    expect(projected).not.toContain('actionRefs')
    expect(projected).not.toContain('server-ref')
  })

  it('composition has no second state owner: pure per-call derivation, inputs untouched', () => {
    const providerSnapshot = Object.freeze({
      revision: 1,
      state: 'ready' as const,
      providers: Object.freeze([
        Object.freeze({ id: 'p1', name: 'deepseek', status: 'available' as const, modelCount: 1 }),
      ]),
    })
    const sessionSnapshot = Object.freeze({
      revision: 1,
      state: 'ready' as const,
      sessions: Object.freeze([
        Object.freeze({ ref: 's1', title: 'Work account', status: 'active' as const, enabled: true }),
      ]),
    })
    const first = composeAccountProjections(providerSnapshot, sessionSnapshot)
    expect(first).toHaveLength(2)
    // Owner state changes are reflected on the very next call — nothing is cached locally.
    const second = composeAccountProjections(
      { ...providerSnapshot, state: 'stale' },
      { ...sessionSnapshot, state: 'unavailable' },
    )
    expect(second.map(a => a.provider)).toEqual(['deepseek'])
    expect(providerSnapshot.state).toBe('ready')
    expect(sessionSnapshot.sessions[0]?.ref).toBe('s1')
  })

  it('renders the composed view read-only from owner snapshots and the metadata store', () => {
    const store = new ProfileStore({ idFactory: () => 'profile-9', now: () => '2026-08-22T09:00:00Z' })
    store.create({ siteScope: 'example.com', displayName: 'Work account' })
    const View = createLoginProfilesView({
      store,
      providerSnapshot: { revision: 2, state: 'ready', providers: [{ id: 'p1', name: 'deepseek', status: 'available', modelCount: 3 }] },
      sessionSnapshot: { revision: 5, state: 'ready', sessions: [{ ref: 's1', title: 'Work account session', status: 'active', enabled: true }] },
    })
    const html = renderToStaticMarkup(<View />)
    expect(html).toContain('Work account')
    expect(html).toContain('3 models')
    expect(html).toContain('Work account session')
    expect(html).toContain('data-profile-count="1"')
    expect(html).not.toContain('reason')
    expect(html).not.toContain('actionRefs')
  })

  it('registers a singleton login-profiles pane view with a disposer', () => {
    const registered: unknown[] = []
    const dispose = registerLoginProfilesPaneViews({
      registerView(input) { registered.push(input); return () => { registered.pop() } },
    })
    const view = registered[0] as { descriptor: { kind: string; singleton: boolean; role: string } }
    expect(view.descriptor.kind).toBe('workspace.login-profiles')
    expect(view.descriptor.singleton).toBe(true)
    expect(view.descriptor.role).toBe('navigator')
    dispose()
    expect(registered).toHaveLength(0)
  })
})

describe('profile CRUD wiring and failure surfaces', () => {
  it('create submission trims and only fires the handler on valid input', () => {
    const calls: { siteScope: string; displayName: string }[] = []
    const onCreate = (input: { siteScope: string; displayName: string }): void => { calls.push(input) }
    expect(submitProfileCreate(onCreate, '  example.com  ', '  Work  ')).toBe(true)
    expect(calls).toEqual([{ siteScope: 'example.com', displayName: 'Work' }])
    expect(submitProfileCreate(onCreate, '', 'Work')).toBe(false)
    expect(submitProfileCreate(onCreate, 'example.com', '   ')).toBe(false)
    expect(submitProfileCreate(undefined, 'example.com', 'Work')).toBe(false)
    expect(calls).toHaveLength(1)
  })

  it('rename submission ignores cleared drafts and delete submission passes the profile id', () => {
    const renames: [string, string][] = []
    expect(submitProfileRename((id, name) => { renames.push([id, name]) }, 'profile-1', '  Renamed  ')).toBe(true)
    expect(submitProfileRename((id, name) => { renames.push([id, name]) }, 'profile-1', '   ')).toBe(false)
    expect(submitProfileRename(undefined, 'profile-1', 'Renamed')).toBe(false)
    expect(renames).toEqual([['profile-1', 'Renamed']])

    const removed: string[] = []
    expect(submitProfileRemove(id => { removed.push(id) }, 'profile-2')).toBe(true)
    expect(submitProfileRemove(undefined, 'profile-2')).toBe(false)
    expect(removed).toEqual(['profile-2'])
  })

  it('renders the create form and per-row delete affordances', () => {
    const html = renderToStaticMarkup(<CookieManagerPanel profiles={profiles} />)
    expect(html).toContain(`aria-label="Add profile"`)
    expect(html).toContain('aria-label="Site"')
    expect(html).toContain('aria-label="Display name"')
    expect(html).toContain('<button type="submit" class="cm-btn">Add profile</button>')
    expect(html).toContain('<button type="button" class="cm-btn">Delete</button>')
    expect(html).toContain('<button type="button" class="cm-btn">Rename</button>')
  })

  it('maps store failures onto fixed panel error text without echoing foreign messages', () => {
    expect(profileErrorMessage(new ProfileStoreError('invalid', 'displayName must be a clean bounded string')))
      .toBe('displayName must be a clean bounded string')
    expect(profileErrorMessage(new ProfileStoreError('not_found', 'profile profile-1 not found')))
      .toBe('profile profile-1 not found')
    expect(profileErrorMessage(new Error('token=raw-secret'))).toBe('Profile change failed.')
    expect(profileErrorMessage('cookie: abc')).toBe('Profile change failed.')
  })
})

describe('quota panel deny-by-default rendering', () => {
  it('drops credential-shaped quota keys even when an owner projection carries them', () => {
    expect(renderableQuotaFields({ fields: { used: '12 GB', token: 'x', secret: 'y', Cookie: 'z', count: 3 as unknown as string } }))
      .toEqual({ used: '12 GB' })
    const html = renderToStaticMarkup(
      <CookieManagerPanel profiles={[]} quota={{ fields: { used: '12 GB', bearer: 'raw-value' } }} />,
    )
    expect(html).toContain('12 GB')
    expect(html).not.toContain('raw-value')
    expect(html).not.toContain('bearer')
  })

  it('fails visible when the owner source is absent or renders zero fields', () => {
    const noSource = renderToStaticMarkup(<CookieManagerPanel profiles={[]} />)
    expect(noSource).toContain('Quota source unavailable')
    expect(noSource).toContain('role="status"')
    const emptySource = renderToStaticMarkup(<CookieManagerPanel profiles={[]} quota={{ fields: {} }} />)
    expect(emptySource).toContain('Quota source unavailable')
    expect(emptySource).not.toContain('<dl>')
  })

  it('renders only owner-provided quota fields plus freshness', () => {
    const html = renderToStaticMarkup(
      <CookieManagerPanel profiles={[]} quota={{ fields: { used: '12 GB', limit: '100 GB' }, freshness: '2026-08-22T09:00:00Z' }} />,
    )
    expect(html).toContain('<dt>used</dt><dd>12 GB</dd>')
    expect(html).toContain('<dt>limit</dt><dd>100 GB</dd>')
    expect(html).toContain('<dt>freshness</dt><dd>2026-08-22T09:00:00Z</dd>')
    expect(html).not.toContain('<dt>guessed')
  })
})

describe('credential red line sweep across rendered surfaces', () => {
  it('no credential pattern appears in any rendered panel state', () => {
    const states = [
      <CookieManagerPanel key="list" profiles={profiles} />,
      <CookieManagerPanel key="error" profiles={profiles} error="displayName must be a clean bounded string" />,
      <CookieManagerPanel
        key="composed"
        profiles={profiles}
        accounts={[
          { provider: 'deepseek', accountSummary: 'acct-1', status: 'active' },
          { provider: 'session', accountSummary: 'Work account session', status: 'active' },
        ]}
        quota={{ fields: { used: '12 GB' }, freshness: '2026-08-22T09:00:00Z' }}
      />,
    ]
    const credentialPattern = /(cookie|token|secret|bearer|password|authorization|credential)\s*[:=]/i
    for (const state of states) {
      const html = renderToStaticMarkup(state)
      expect(html).not.toMatch(credentialPattern)
    }
  })
})

function liveCookieJars(receipts: CookieJarReceipt[] = []): CookieJarSource {
  const accepted = (action: CookieJarReceipt['action'], profileRef: string): CookieJarReceipt => {
    const receipt = { action, profileRef, status: 'accepted' as const }
    receipts.push(receipt)
    return receipt
  }
  return {
    capabilities: [COOKIE_JARS_CAPABILITY],
    applyJar: async (profile) => accepted('apply', profile.profileRef),
    switchJar: async (_from, to) => accepted('switch', to.profileRef),
    clearJar: async (profile) => accepted('clear', profile.profileRef),
  }
}

describe('web.cookieJars probe', () => {
  it('rejects credential-shaped refs and incomplete hosts', () => {
    expect(isSafeCookieJarProfile({ profileRef: 'acct-42', siteScope: 'example.com' })).toBe(true)
    expect(isSafeCookieJarProfile({ profileRef: 'token=abc', siteScope: 'example.com' })).toBe(false)
    expect(hasCookieJarsCapability({ capabilities: [COOKIE_JARS_CAPABILITY] })).toBe(false)
    expect(bindCookieJars(undefined)).toBeUndefined()
    expect(bindCookieJars({ capabilities: [COOKIE_JARS_CAPABILITY] })).toBeUndefined()
    expect(bindCookieJars(liveCookieJars())).toBeDefined()
  })

  it('applies, switches, and clears only through the host and never locally', async () => {
    const receipts: CookieJarReceipt[] = []
    const source = liveCookieJars(receipts)
    const from = { profileRef: 'profile-1', siteScope: 'example.com' }
    const to = { profileRef: 'profile-2', siteScope: 'example.com' }
    await expect(applyCookieJar(source, from)).resolves.toMatchObject({ ok: true })
    await expect(switchCookieJar(source, from, to)).resolves.toMatchObject({ ok: true })
    await expect(clearCookieJar(source, to)).resolves.toMatchObject({ ok: true })
    expect(receipts.map(item => item.action)).toEqual(['apply', 'switch', 'clear'])
    await expect(applyCookieJar(source, { profileRef: 'cookie=raw', siteScope: 'example.com' }))
      .resolves.toEqual({ ok: false, reason: 'unsafe profile ref' })
  })

  it('redacts credential words from host receipts', () => {
    expect(redactCookieJarReceipt({
      action: 'apply',
      profileRef: 'acct-42',
      status: 'rejected',
      reason: 'cookie header missing',
    }).reason).toBe('redacted')
  })

  it('keeps the pane degraded until a live host face is injected', () => {
    const store = new ProfileStore({ idFactory: () => 'profile-9', now: () => '2026-08-22T09:00:00Z' })
    store.create({ siteScope: 'example.com', displayName: 'Work account' })
    const Degraded = createLoginProfilesView({ store })
    const Live = createLoginProfilesView({ store, cookieJars: liveCookieJars() })
    const degraded = renderToStaticMarkup(<Degraded />)
    expect(degraded).toContain('web.cookieJars')
    const live = renderToStaticMarkup(<Live />)
    expect(live).not.toContain('web.cookieJars')
    expect(live).toContain('Apply login state')
    expect(live).toContain('Switch login state')
    expect(live).toContain('Clear login state')
  })
})

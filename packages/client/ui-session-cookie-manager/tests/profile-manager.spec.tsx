import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CookieManagerPanel,
  ProfileStore,
  FORBIDDEN_PROFILE_KEYS,
  parseProfileMeta,
  providerSnapshotToAccounts,
  registerLoginProfilesPaneViews,
} from '../src/index.ts'
import type { ProfileMetaV1 } from '../src/index.ts'

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

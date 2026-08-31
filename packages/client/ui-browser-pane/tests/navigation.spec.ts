import { describe, expect, it } from 'vitest'
import { NAVIGATION_DRAFT_MAX, clearNavigationDraft, navigationRejectionCopy, sealNavigationDraft } from '../src/navigation.js'

describe('ephemeral navigation draft (browser-pane 2.7)', () => {
  it('accepts bare hosts and https targets; seals bounded drafts', () => {
    expect(sealNavigationDraft('example.com/docs')).toEqual({ ok: true, draft: 'example.com/docs' })
    expect(sealNavigationDraft('  https://example.com/x  ')).toEqual({ ok: true, draft: 'https://example.com/x' })
    expect(sealNavigationDraft(`x${'a'.repeat(NAVIGATION_DRAFT_MAX)}`)).toMatchObject({ ok: false, reason: 'invalid_scheme' })
  })

  it('rejects dangerous schemes and credential-shaped targets with typed reasons', () => {
    expect(sealNavigationDraft('file:///etc/passwd')).toMatchObject({ ok: false, reason: 'invalid_scheme' })
    expect(sealNavigationDraft('javascript:alert(1)')).toMatchObject({ ok: false, reason: 'invalid_scheme' })
    expect(sealNavigationDraft('data:text/html,x')).toMatchObject({ ok: false, reason: 'invalid_scheme' })
    expect(sealNavigationDraft('user:pass@example.com')).toMatchObject({ ok: false, reason: 'credential_embedded' })
    expect(sealNavigationDraft('host token=abc123')).toMatchObject({ ok: false, reason: 'credential_embedded' })
    expect(sealNavigationDraft('')).toMatchObject({ ok: false, reason: 'invalid_scheme' })
  })

  it('rejection copy carries the typed reason only — never the full target', () => {
    for (const reason of ['invalid_scheme', 'unsafe_host', 'credential_embedded', 'blocked_by_policy', 'needs_confirm', 'unknown'] as const) {
      const copy = navigationRejectionCopy(reason)
      expect(copy.length).toBeGreaterThan(0)
      expect(copy).not.toContain('example.com')
      expect(copy).not.toContain('http')
    }
  })

  it('every terminal outcome clears the pending draft', () => {
    expect(clearNavigationDraft({ text: 'https://secret.example' })).toEqual({ text: undefined })
    expect(clearNavigationDraft({ text: undefined })).toEqual({ text: undefined })
  })
})

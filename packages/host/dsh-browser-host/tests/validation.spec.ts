import { describe, expect, it } from 'vitest'
import {
  BROWSER_PAGE_BUDGET,
  validateBrowserActionRequest,
  validateBrowserPaneEvent,
  validateBrowserPaneSnapshot,
} from '../src/validation.js'

function snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'browser.automation.projection.v0.1',
    generation: 2,
    cursor: 10,
    freshness: 'fresh',
    safeMessage: 'ok',
    pages: [{ pageRef: 'page:1', location: { protocol: 'https:', host: 'example.com', pathDigest: 'a1b2c3d4e5', title: 'Example' }, status: 'ready', agentActivityCount: 3 }],
    activePageRef: 'page:1',
    controlHolder: 'agent',
    ...overrides,
  }
}

describe('browser snapshot validation (browser-pane 1.3)', () => {
  it('accepts a valid safe projection; unknown fields reject wholesale', () => {
    expect(validateBrowserPaneSnapshot(snapshot())?.pages[0]?.pageRef).toBe('page:1')
    expect(validateBrowserPaneSnapshot(snapshot({ extra: true }))).toBeUndefined()
  })

  it('forbidden text and unsafe hosts/paths reject', () => {
    expect(validateBrowserPaneSnapshot(snapshot({ safeMessage: 'see https://evil.example' }))).toBeUndefined()
    expect(validateBrowserPaneSnapshot(snapshot({ safeMessage: 'Bearer abc' }))).toBeUndefined()
    const badPage = snapshot({ pages: [{ pageRef: 'page:1', location: { protocol: 'https:', host: 'example.com/path', pathDigest: 'a1b2c3d4e5' }, status: 'ready', agentActivityCount: 0 }] })
    expect(validateBrowserPaneSnapshot(badPage)).toBeUndefined()
    const queryLeak = snapshot({ pages: [{ pageRef: 'page:1', location: { protocol: 'https:', host: 'example.com', pathDigest: 'zz' }, status: 'ready', agentActivityCount: 0 }] })
    expect(validateBrowserPaneSnapshot(queryLeak)).toBeUndefined()
  })

  it('enforces the 32-page domain budget', () => {
    const flood = Array.from({ length: BROWSER_PAGE_BUDGET + 1 }, (_, i) => ({ pageRef: `page:${i}`, location: { protocol: 'about:', host: 'localhost', pathDigest: 'a1b2c3d4e5' }, status: 'ready', agentActivityCount: 0 }))
    expect(validateBrowserPaneSnapshot(snapshot({ pages: flood }))).toBeUndefined()
    const atBound = flood.slice(0, BROWSER_PAGE_BUDGET)
    expect(validateBrowserPaneSnapshot(snapshot({ pages: atBound }))?.pages).toHaveLength(BROWSER_PAGE_BUDGET)
  })
})

describe('browser event validation (64 KiB budget)', () => {
  const event = { schemaVersion: 'browser.automation.event.v0.1', generation: 2, sequence: 11, kind: 'page_status' as const, pageRef: 'page:1', safeSummary: 'loaded' }

  it('accepts in-budget events and rejects duplicates-by-sequence shape drift', () => {
    expect(validateBrowserPaneEvent(event)?.kind).toBe('page_status')
    expect(validateBrowserPaneEvent({ ...event, sequence: 0 })).toBeUndefined()
    expect(validateBrowserPaneEvent({ ...event, kind: 'unknown_kind' })).toBeUndefined()
  })
})

describe('browser action request validation', () => {
  const request = { schemaVersion: 'browser.automation.action.v0.1', actionId: 'navigate-1', binding: { tenantRef: 't:1', workspaceRef: 'w:1', principalRef: 'p:1', contextRevision: 3, sessionRef: 's:1' }, pageRef: 'page:1', idempotencyKey: 'key-12345678', navigationDraft: 'example.com/docs' }

  it('accepts a valid request; bad keys and oversized drafts reject', () => {
    expect(validateBrowserActionRequest(request)?.actionId).toBe('navigate-1')
    expect(validateBrowserActionRequest({ ...request, idempotencyKey: 'short' })).toBeUndefined()
    expect(validateBrowserActionRequest({ ...request, navigationDraft: 'x'.repeat(3_000) })).toBeUndefined()
    expect(validateBrowserActionRequest({ ...request, navigationDraft: 'https://user:pass@evil.example' })).toBeUndefined()
  })
})

import { validateBrowserPaneSnapshot } from '../src/validation.js'

describe('negative fixture battery (browser-pane 1.4)', () => {
  it('rejects cookie/header/authorization/secret/token/credential carriers', () => {
    for (const bad of [
      'cookie: sessionid=abc',
      'authorization: Bearer x',
      'secret_key=abc',
      'token: abc123',
      'password=hunter2',
      '-----BEGIN PRIVATE KEY-----',
    ]) {
      expect(validateBrowserPaneSnapshot(snapshot({ safeMessage: bad })), bad).toBeUndefined()
    }
  })

  it('rejects raw and signed URLs, userinfo, and query values', () => {
    expect(validateBrowserPaneSnapshot(snapshot({ safeMessage: 'go to https://a.example/x?token=1' }))).toBeUndefined()
    expect(validateBrowserPaneSnapshot(snapshot({ safeMessage: 'https://user:pass@a.example' }))).toBeUndefined()
    expect(validateBrowserPaneSnapshot(snapshot({ safeMessage: 'see ?code=xyz' }))).toBeUndefined()
  })

  it('rejects absolute paths and DOM/screenshot/download byte shapes', () => {
    expect(validateBrowserPaneSnapshot(snapshot({ safeMessage: '/etc/passwd contents' }))).toBeUndefined()
    expect(validateBrowserPaneSnapshot(snapshot({ safeMessage: 'C:\\Users\\home\\file' }))).toBeUndefined()
    expect(validateBrowserPaneSnapshot(snapshot({ pages: [{ pageRef: 'page:1', location: { protocol: 'about:', host: 'localhost', pathDigest: 'a1b2c3d4e5' }, status: 'ready', agentActivityCount: 0, dom: '<html>' }] }))).toBeUndefined()
  })

  it('rejects raw prompt / provider payload / private args / reasoning leakage in summaries', () => {
    for (const bad of ['prompt: you are...', 'provider_payload:{...}', 'tool_args: --secret 1', 'chain_of_thought: first I...']) {
      // exact-key schemas reject these as unknown fields; text regex catches URL/credential variants
      const result = validateBrowserPaneSnapshot(snapshot({ pages: [{ pageRef: 'page:1', location: { protocol: 'about:', host: 'localhost', pathDigest: 'a1b2c3d4e5' }, status: 'ready', agentActivityCount: 0, [bad.split(':')[0]]: bad }] }))
      expect(result, bad).toBeUndefined()
    }
  })

  it('credential absence: no valid projection ever contains auth-shaped fields (exact keys)', () => {
    const valid = validateBrowserPaneSnapshot(snapshot())
    expect(valid).toBeDefined()
    for (const field of ['cookie', 'header', 'authorization', 'token', 'credential', 'dom', 'screenshot', 'download']) {
      expect(valid, field).not.toHaveProperty(field)
      expect(valid?.pages[0], field).not.toHaveProperty(field)
    }
  })
})

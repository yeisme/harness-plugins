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

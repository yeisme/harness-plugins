import { describe, expect, it, vi } from 'vitest'
import { createBrowserPaneHost, DSH_BROWSER_PANE_HOST_CONTEXT_KEY } from '../src/remote.js'

const binding = { tenantRef: 't:1', workspaceRef: 'w:1', principalRef: 'p:1', contextRevision: 1, sessionRef: 's:1' }
const validSnapshot = { schemaVersion: 'browser.automation.projection.v0.1', generation: 1, cursor: 1, freshness: 'fresh', safeMessage: 'ok', pages: [], activePageRef: undefined, controlHolder: 'none' }

describe('validated host adapter (browser-pane 1.5)', () => {
  it('exposes the context key and experimental capability', () => {
    expect(DSH_BROWSER_PANE_HOST_CONTEXT_KEY).toBe('dsh.browserPaneHost')
    const host = createBrowserPaneHost({ probe: vi.fn(), listSessions: vi.fn(), snapshot: vi.fn(), dispatch: vi.fn(), reconcile: vi.fn() })
    expect(host.capability).toBe('browser.pane.host')
    expect(host.experimental).toContain('experimental')
  })

  it('passes valid snapshots through and degrades invalid ones fail-closed', async () => {
    const remote = { probe: vi.fn(async () => ({ available: true })), listSessions: vi.fn(async () => ['s:1']), snapshot: vi.fn().mockResolvedValueOnce(validSnapshot).mockResolvedValueOnce({ ...validSnapshot, safeMessage: 'https://leak.example' }), dispatch: vi.fn(), reconcile: vi.fn() }
    const host = createBrowserPaneHost(remote)
    expect((await host.snapshot(binding)).safeMessage).toBe('ok')
    const degraded = await host.snapshot(binding)
    expect(degraded).toMatchObject({ freshness: 'offline', safeMessage: 'owner projection failed validation', pages: [] })
  })

  it('rejects invalid action requests before they reach the remote', async () => {
    const dispatch = vi.fn()
    const host = createBrowserPaneHost({ probe: vi.fn(), listSessions: vi.fn(), snapshot: vi.fn(), dispatch, reconcile: vi.fn() })
    const bad = await host.dispatch({ schemaVersion: 'browser.automation.action.v0.1', actionId: 'nav', binding, pageRef: undefined, idempotencyKey: 'short', navigationDraft: undefined })
    expect(bad).toMatchObject({ status: 'rejected', reasonCode: 'request_failed_validation' })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('reconcile routes through the same validated snapshot path', async () => {
    const snapshot = vi.fn().mockResolvedValue(validSnapshot)
    const host = createBrowserPaneHost({ probe: vi.fn(), listSessions: vi.fn(), snapshot, dispatch: vi.fn(), reconcile: vi.fn() })
    expect((await host.reconcile(binding)).generation).toBe(1)
    expect(snapshot).toHaveBeenCalledWith(binding)
  })
})

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

  it('fails closed when the remote receipt changes action identity', async () => {
    const dispatch = vi.fn(async () => ({ status: 'ok' as const, actionId: 'other', receiptRef: 'receipt:other', reasonCode: undefined }))
    const host = createBrowserPaneHost({ probe: vi.fn(), listSessions: vi.fn(), snapshot: vi.fn(), dispatch, reconcile: vi.fn() })
    const receipt = await host.dispatch({ schemaVersion: 'browser.automation.action.v0.1', actionId: 'navigate', binding, pageRef: 'page:1', idempotencyKey: 'request-12345678', navigationDraft: undefined })
    expect(receipt).toMatchObject({ status: 'unknown', actionId: 'navigate', reasonCode: 'receipt_failed_validation' })
  })

  it('reconcile calls the real owner reconcile path and validates its result', async () => {
    const snapshot = vi.fn().mockResolvedValue({ ...validSnapshot, generation: 99 })
    const reconcile = vi.fn().mockResolvedValue(validSnapshot)
    const host = createBrowserPaneHost({ probe: vi.fn(), listSessions: vi.fn(), snapshot, dispatch: vi.fn(), reconcile })
    expect((await host.reconcile(binding)).generation).toBe(1)
    expect(reconcile).toHaveBeenCalledWith(binding)
    expect(snapshot).not.toHaveBeenCalled()
  })

  it('requires exact action identity before an unknown lock can settle', async () => {
    const reconcileAction = vi.fn()
      .mockResolvedValueOnce({ actionId: 'other', idempotencyKey: 'request-12345678', settled: true, snapshot: validSnapshot })
      .mockResolvedValueOnce({ actionId: 'reload', idempotencyKey: 'request-12345678', settled: true, snapshot: validSnapshot })
    const host = createBrowserPaneHost({ probe: vi.fn(), listSessions: vi.fn(), snapshot: vi.fn(), dispatch: vi.fn(), reconcile: vi.fn(), reconcileAction })
    const request = { binding, actionId: 'reload', idempotencyKey: 'request-12345678' }
    expect(await host.reconcileAction?.(request)).toMatchObject({ actionId: 'reload', idempotencyKey: 'request-12345678', settled: false, snapshot: { freshness: 'offline' } })
    expect(await host.reconcileAction?.(request)).toMatchObject({ actionId: 'reload', idempotencyKey: 'request-12345678', settled: true })
  })

  it('rejects an invalid reconcile identity before calling the owner', async () => {
    const reconcileAction = vi.fn()
    const host = createBrowserPaneHost({ probe: vi.fn(), listSessions: vi.fn(), snapshot: vi.fn(), dispatch: vi.fn(), reconcile: vi.fn(), reconcileAction })
    expect(await host.reconcileAction?.({ binding, actionId: 'reload', idempotencyKey: 'short' })).toMatchObject({ settled: false, snapshot: { safeMessage: 'owner action reconcile request failed validation' } })
    expect(reconcileAction).not.toHaveBeenCalled()
  })

  it('never settles unknown actions from malformed or extended wire results', async () => {
    const result = { actionId: 'reload', idempotencyKey: 'request-12345678', settled: false, snapshot: validSnapshot }
    const reconcileAction = vi.fn()
    const host = createBrowserPaneHost({ probe: vi.fn(), listSessions: vi.fn(), snapshot: vi.fn(), dispatch: vi.fn(), reconcile: vi.fn(), reconcileAction })
    const request = { binding, actionId: 'reload', idempotencyKey: 'request-12345678' }
    for (const raw of [null, undefined, [], 'false', { ...result, settled: 'false' }, { ...result, settled: 1 }, { ...result, settled: undefined }, { ...result, settled: true, extra: 'unexpected' }]) {
      reconcileAction.mockResolvedValueOnce(raw)
      await expect(host.reconcileAction?.(request)).resolves.toMatchObject({ settled: false, snapshot: { freshness: 'offline' } })
    }
    reconcileAction.mockResolvedValueOnce(result)
    await expect(host.reconcileAction?.(request)).resolves.toMatchObject({ settled: false, snapshot: { generation: 1 } })
    reconcileAction.mockResolvedValueOnce({ ...result, settled: true })
    await expect(host.reconcileAction?.(request)).resolves.toMatchObject({ settled: true, snapshot: { generation: 1 } })
  })

  it('rejects snapshots whose environment belongs to another workspace', async () => {
    const wrong = { ...validSnapshot, environment: { name: 'Preview', workspaceRef: 'w:other', status: 'ready' as const, identity: 'known' as const } }
    const host = createBrowserPaneHost({ probe: vi.fn(), listSessions: vi.fn(), snapshot: vi.fn(async () => wrong), dispatch: vi.fn(), reconcile: vi.fn(async () => wrong) })
    expect(await host.snapshot(binding)).toMatchObject({ freshness: 'offline', safeMessage: 'owner projection failed validation' })
    expect(await host.reconcile(binding)).toMatchObject({ freshness: 'offline', safeMessage: 'owner reconcile failed validation' })
  })
})

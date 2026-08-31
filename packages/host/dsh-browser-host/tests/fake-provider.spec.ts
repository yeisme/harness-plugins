import { describe, expect, it } from 'vitest'
import { createFakeBrowserAutomationProvider } from '../src/fake-provider.js'
import { validateBrowserPaneSnapshot } from '../src/validation.js'

const binding = { tenantRef: 't:1', workspaceRef: 'w:1', principalRef: 'p:1', contextRevision: 1, sessionRef: 'fake-session:1' }
const request = (actionId: string) => ({ schemaVersion: 'browser.automation.action.v0.1' as const, actionId, binding, pageRef: 'page:1', idempotencyKey: 'key-12345678', navigationDraft: undefined })

describe('fake provider (browser-pane 1.6)', () => {
  it('discovers one session and opens exactly that host', async () => {
    const provider = createFakeBrowserAutomationProvider()
    expect(await provider.discoverSessions()).toEqual(['fake-session:1'])
    const host = await provider.openSession('fake-session:1')
    expect(host?.capability).toBe('browser.pane.host')
    expect(await provider.openSession('unknown:1')).toBeUndefined()
    expect(provider.hostsOpened).toEqual(['fake-session:1', 'unknown:1'])
  })

  it('snapshots validate through the strict schema and reset generation on demand', async () => {
    const provider = createFakeBrowserAutomationProvider({ resetGenerationOnNextSnapshot: true, pages: [{ pageRef: 'page:1', host: 'a.example', title: 'A' }, { pageRef: 'page:2', host: 'b.example' }] })
    const host = (await provider.openSession('fake-session:1'))!
    const first = await host.snapshot(binding)
    expect(validateBrowserPaneSnapshot(first)?.pages).toHaveLength(2)
    expect(first.generation).toBe(2) // reset bumped
    expect(first.controlHolder).toBe('agent')
  })

  it('dispatch drives deterministic events: navigation, control transfer, evidence/download candidates', async () => {
    const provider = createFakeBrowserAutomationProvider()
    const host = (await provider.openSession('fake-session:1'))!
    const kinds: string[] = []
    provider.subscribe(event => { kinds.push(event.kind) })
    expect((await host.dispatch(request('navigate-1'))).status).toBe('ok')
    expect((await host.dispatch(request('take_control-1'))).status).toBe('ok')
    expect((await host.dispatch(request('evidence_request-1'))).status).toBe('ok')
    expect((await host.dispatch(request('download_authorize-1'))).status).toBe('ok')
    expect(kinds).toEqual(['navigation_completed', 'receipt', 'control_changed', 'receipt', 'agent_activity', 'receipt', 'agent_activity', 'receipt'])
  })

  it('unknown dispatch status surfaces receipts without ok; reconcile invalidates and refetches', async () => {
    const provider = createFakeBrowserAutomationProvider({ dispatchStatus: 'unknown' })
    const host = (await provider.openSession('fake-session:1'))!
    const receipt = await host.dispatch(request('navigate-1'))
    expect(receipt).toMatchObject({ status: 'unknown', reasonCode: 'fake_unknown' })
    const events: string[] = []
    provider.subscribe(event => { events.push(event.kind) })
    const refetched = await host.reconcile(binding)
    expect(refetched.freshness).toBe('fresh')
    expect(events).toContain('invalidate')
  })
})

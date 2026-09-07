// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { BrowserPaneView } from '../src/view.tsx'
import { browserEn, browserPseudoLong, browserPseudoRtl, browserZh, createBrowserPaneTranslator } from '../src/locales.ts'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const binding = { tenantRef: 'tenant:one', workspaceRef: 'workspace:one', principalRef: 'principal:one', contextRevision: 1, sessionRef: 'session:one' }

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
function snapshot(input: Partial<any> = {}) { return { schemaVersion: 'browser.automation.projection.v0.1' as const, generation: 1, cursor: 0, freshness: 'fresh' as const, safeMessage: 'Owner projection ready.', pages: [{ pageRef: 'page:one', location: { protocol: 'https:' as const, host: 'app.example', pathDigest: 'a1b2c3d4e5', title: 'App' }, status: 'ready' as const, agentActivityCount: 0 }], activePageRef: 'page:one', controlHolder: 'agent' as const, ...input } }
function hostOf(input: Partial<any> = {}) { return { capability: 'browser.pane.host' as const, experimental: 'browser.automation.experimental.v0.1' as const, probe: async () => ({ available: true }), listSessions: async () => ['session:one'], snapshot: async () => snapshot(), reconcile: async () => snapshot(), dispatch: async (request: any) => ({ status: 'ok' as const, actionId: request.actionId, receiptRef: 'receipt:one', reasonCode: undefined }), ...input } }
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) }) }
async function mount(element: React.ReactElement) { const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); await act(async () => { root.render(element) }); await flush(); return { container, root } }
function button(container: HTMLElement, label: string): HTMLButtonElement { const found = [...container.querySelectorAll('button')].find(item => item.textContent === label); if (found === undefined) throw new Error(`button not found: ${label}`); return found }

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks() })

describe('BrowserPaneView', () => {
  it('uses exact descriptor ids, requires confirm/approval, and disables stale actions', async () => {
    const dispatch = vi.fn(async (request: any) => ({ status: 'ok' as const, actionId: request.actionId, receiptRef: 'receipt:one', reasonCode: undefined }))
    const actions = [
      { actionId: 'owner.navigate.42', label: 'Navigate', kind: 'navigate' as const, requiresConfirmation: 'confirm' as const, disabledReason: undefined },
      { actionId: 'environment.start.9', label: 'Start', kind: 'open_page' as const, requiresConfirmation: 'approval' as const, disabledReason: undefined },
    ]
    const host = hostOf({ dispatch, snapshot: async () => snapshot({ actions }), reconcile: async () => snapshot({ actions }) })
    const mounted = await mount(<BrowserPaneView host={host} binding={binding} />)
    await act(async () => { button(mounted.container, 'Navigate').click() })
    expect(dispatch).not.toHaveBeenCalled()
    await act(async () => { button(mounted.container, 'Confirm Navigate').click() })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'owner.navigate.42', navigationDraft: '' }))
    await act(async () => { button(mounted.container, 'Start').click() })
    expect(dispatch).toHaveBeenCalledTimes(1)
    await act(async () => { button(mounted.container, 'Approve Start').click() })
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ actionId: 'environment.start.9' }))
    await act(async () => { mounted.root.render(<BrowserPaneView host={hostOf({ snapshot: async () => snapshot({ freshness: 'stale', actions }) })} binding={binding} />) }); await flush()
    expect(button(mounted.container, 'Navigate').disabled).toBe(true)
    expect(mounted.container.textContent).toContain('Environment identity unavailable')
    await act(async () => { mounted.root.unmount() })
  })

  it('locks rapid duplicates and unknown settlement until owner reconciliation completes', async () => {
    const action = { actionId: 'owner.reload.1', label: 'Reload', kind: 'reload' as const, requiresConfirmation: 'none' as const, disabledReason: undefined }
    const dispatched = deferred<any>()
    const firstReconcile = deferred<any>()
    const dispatch = vi.fn(() => dispatched.promise)
    const reconcile = vi.fn(async () => snapshot({ actions: [action] }))
    const reconcileAction = vi.fn(() => firstReconcile.promise)
    const host = hostOf({ dispatch, snapshot: async () => snapshot({ actions: [action] }), reconcile, reconcileAction })
    const mounted = await mount(<BrowserPaneView host={host} binding={binding} />)
    await act(async () => { const target = button(mounted.container, 'Reload'); target.click(); target.click() })
    expect(dispatch).toHaveBeenCalledTimes(1)
    await act(async () => { dispatched.resolve({ status: 'unknown', actionId: action.actionId, receiptRef: 'receipt:unknown', reasonCode: 'settlement_unknown' }); await Promise.resolve() })
    const locked = button(mounted.container, 'Working…')
    expect(locked.disabled).toBe(true)
    locked.click()
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(reconcileAction).toHaveBeenCalledWith(expect.objectContaining({ actionId: action.actionId, idempotencyKey: expect.stringContaining('bp-') }))
    const exactRequest = reconcileAction.mock.calls[0]![0]
    await act(async () => { firstReconcile.resolve({ actionId: exactRequest.actionId, idempotencyKey: exactRequest.idempotencyKey, settled: false, snapshot: snapshot({ actions: [action], safeMessage: 'Still pending.' }) }); await Promise.resolve() }); await flush()
    expect(button(mounted.container, 'Reload').disabled).toBe(true)
    expect(reconcile).not.toHaveBeenCalled()
    reconcileAction.mockResolvedValueOnce({ actionId: exactRequest.actionId, idempotencyKey: exactRequest.idempotencyKey, settled: true, snapshot: snapshot({ actions: [action], safeMessage: 'Settled.' }) })
    await act(async () => { button(mounted.container, 'Reconnect').click(); await Promise.resolve() }); await flush()
    expect(button(mounted.container, 'Reload').disabled).toBe(false)
    await act(async () => { mounted.root.unmount() })
  })

  it('does not let a delayed A snapshot overwrite binding B', async () => {
    const a = deferred<any>()
    const host = hostOf({ snapshot: (current: typeof binding) => current.sessionRef === 'session:a' ? a.promise : Promise.resolve(snapshot({ safeMessage: 'Binding B', pages: [{ ...snapshot().pages[0], pageRef: 'page:b', location: { ...snapshot().pages[0].location, host: 'b.example' } }], activePageRef: 'page:b' })) })
    const bindingA = { ...binding, sessionRef: 'session:a' }
    const bindingB = { ...binding, sessionRef: 'session:b', contextRevision: 2 }
    const mounted = await mount(<BrowserPaneView host={host} binding={bindingA} />)
    await act(async () => { mounted.root.render(<BrowserPaneView host={host} binding={bindingB} />) }); await flush()
    expect(mounted.container.textContent).toContain('b.example')
    await act(async () => { a.resolve(snapshot({ safeMessage: 'Binding A', pages: [{ ...snapshot().pages[0], location: { ...snapshot().pages[0].location, host: 'a.example' } }] })); await Promise.resolve() }); await flush()
    expect(mounted.container.textContent).toContain('b.example')
    expect(mounted.container.textContent).not.toContain('a.example')
    await act(async () => { mounted.root.unmount() })
  })

  it('rejects wrong viewport leases and cleans up a late async attachment', async () => {
    const attach = vi.fn(async () => undefined)
    const transport = { attach, sendInput: vi.fn(() => ({ sequence: 1, accepted: false, reason: 'no_control_lease' as const })), resize: vi.fn(), detach: vi.fn(), events: { onEnded: vi.fn(), onStalled: vi.fn() } }
    const wrong = hostOf({ viewportLease: async () => ({ pageRef: 'page:wrong', generation: 1, sessionRef: binding.sessionRef, leaseToken: 'lease:wrong', expiresAt: '2999-01-01T00:00:00Z' }) })
    const mounted = await mount(<BrowserPaneView host={wrong} binding={binding} transport={transport} />)
    await flush()
    expect(attach).not.toHaveBeenCalled()
    const late = deferred<MediaStream | undefined>()
    const stop = vi.fn()
    const goodTransport = { ...transport, attach: vi.fn(() => late.promise), detach: vi.fn() }
    const good = hostOf({ viewportLease: async () => ({ pageRef: 'page:one', generation: 1, sessionRef: binding.sessionRef, leaseToken: 'lease:good', expiresAt: '2999-01-01T00:00:00Z' }) })
    await act(async () => { mounted.root.render(<BrowserPaneView host={good} binding={binding} transport={goodTransport} />) }); await flush()
    expect(goodTransport.attach).toHaveBeenCalledTimes(1)
    await act(async () => { mounted.root.unmount() })
    await act(async () => { late.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream); await Promise.resolve() })
    expect(stop).toHaveBeenCalled()
    expect(goodTransport.detach).toHaveBeenCalled()
  })

  it('gates viewport input and resize on the real control lease and cleans up disconnect', async () => {
    let ended: (() => void) | undefined
    let resizeCallback: ResizeObserverCallback | undefined
    class TestResizeObserver { constructor(callback: ResizeObserverCallback) { resizeCallback = callback } observe() {} disconnect() {} unobserve() {} }
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    const sendInput = vi.fn((_event, held: boolean) => ({ sequence: 1, accepted: held, reason: held ? 'ok' as const : 'no_control_lease' as const }))
    const transport = { attach: vi.fn(async () => ({ getTracks: () => [] } as unknown as MediaStream)), sendInput, resize: vi.fn(), detach: vi.fn(), events: { onEnded: (handler: () => void) => { ended = handler }, onStalled: vi.fn() } }
    const takeover = { actionId: 'control.take', label: 'Take control', kind: 'take_control' as const, requiresConfirmation: 'none' as const, disabledReason: undefined }
    let human = false
    const host = hostOf({
      snapshot: async () => snapshot({ actions: [takeover], controlHolder: human ? 'human' : 'agent' }),
      reconcile: async () => snapshot({ actions: [takeover], controlHolder: human ? 'human' : 'agent' }),
      viewportLease: async () => ({ pageRef: 'page:one', generation: 1, sessionRef: binding.sessionRef, leaseToken: 'lease:good', expiresAt: '2999-01-01T00:00:00Z' }),
      dispatch: async (request: any) => {
        human = true
        return { status: 'ok' as const, actionId: request.actionId, receiptRef: 'receipt:control', reasonCode: undefined, controlLease: { holder: 'human' as const, issuedAt: '2026-01-01T00:00:00Z', expiresAt: '2999-01-01T00:00:00Z', agentInputPaused: true as const } }
      },
    })
    const mounted = await mount(<BrowserPaneView host={host} binding={binding} transport={transport} />)
    const viewport = mounted.container.querySelector('[data-browser-viewport]') as HTMLVideoElement
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ x: 10, y: 20, left: 10, top: 20, right: 410, bottom: 220, width: 400, height: 200, toJSON: () => ({}) })
    await act(async () => { viewport.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 110, clientY: 170, button: 0, buttons: 1, ctrlKey: true })) })
    expect(sendInput).toHaveBeenLastCalledWith({ type: 'pointer', phase: 'down', x: 0.25, y: 0.75, button: 0, buttons: 1, modifiers: { alt: false, ctrl: true, meta: false, shift: false } }, false)
    resizeCallback?.([{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry], {} as ResizeObserver)
    expect(transport.resize).not.toHaveBeenCalled()
    await act(async () => { button(mounted.container, 'Take control').click(); await Promise.resolve() }); await flush()
    await act(async () => { viewport.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 210, clientY: 120, button: 0, buttons: 1 })) })
    expect(sendInput).toHaveBeenLastCalledWith({ type: 'pointer', phase: 'down', x: 0.5, y: 0.5, button: 0, buttons: 1, modifiers: { alt: false, ctrl: false, meta: false, shift: false } }, true)
    resizeCallback?.([{ contentRect: { width: 800.4, height: 600.4 } } as ResizeObserverEntry], {} as ResizeObserver)
    expect(transport.resize).toHaveBeenCalledWith({ width: 800, height: 600 })
    await act(async () => { ended?.() })
    expect(transport.detach).toHaveBeenCalled()
    await act(async () => { viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, shiftKey: true })) })
    expect(sendInput).toHaveBeenLastCalledWith({ type: 'key', phase: 'down', key: 'a', code: 'KeyA', repeat: false, modifiers: { alt: false, ctrl: false, meta: false, shift: true } }, false)
    await act(async () => { mounted.root.unmount() })
  })

  it('keeps zh, en, and pseudo locale tables in parity and renders localized copy', async () => {
    expect(Object.keys(browserEn)).toEqual(Object.keys(browserZh))
    expect(Object.keys(browserPseudoLong)).toEqual(Object.keys(browserZh))
    expect(Object.keys(browserPseudoRtl)).toEqual(Object.keys(browserZh))
    const mounted = await mount(<BrowserPaneView host={undefined} binding={undefined} t={createBrowserPaneTranslator('zh')} />)
    expect(mounted.container.textContent).toContain('需要工作区环境绑定')
    await act(async () => { mounted.root.render(<BrowserPaneView host={undefined} binding={undefined} t={createBrowserPaneTranslator('pseudo-long')} />) })
    expect(mounted.container.textContent).toMatch(/woorkspaacee .* biindiing/u)
    await act(async () => { mounted.root.unmount() })
  })
})

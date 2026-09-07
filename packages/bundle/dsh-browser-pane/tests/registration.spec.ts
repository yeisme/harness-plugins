import { describe, expect, it, vi } from 'vitest'
import { BROWSER_OPEN_COMMAND_ID, BROWSER_PANE_PLUGIN_ID, BROWSER_SLASH_COMMAND, applyBrowserPaneRegistration } from '../src/registration.js'
import { createFakeBrowserAutomationProvider } from '@yeisme/dsh-browser-host'

function fakePane() {
  const views: Array<{ descriptor: { kind: string; singleton: boolean }; presentation?: unknown; component?: () => unknown }> = []
  const commands: Array<{ descriptor: { id: string; slash?: unknown }; execute?: () => void }> = []
  return {
    views, commands,
    registerView: vi.fn((input: { descriptor: { kind: string; singleton: boolean }; presentation?: unknown; component?: () => unknown }) => {
      views.push(input); return () => {}
    }),
    registerCommand: vi.fn((input: { descriptor: { id: string; slash?: unknown }; execute?: () => void }) => {
      commands.push(input); return () => {}
    }),
    openView: vi.fn(),
  }
}

describe('browser pane registration (browser-pane 3.2/3.3)', () => {
  it('freezes the plugin id, command id, and slash entry', () => {
    expect(BROWSER_PANE_PLUGIN_ID).toBe('dsh-browser-pane')
    expect(BROWSER_OPEN_COMMAND_ID).toBe('browser.open')
    expect(BROWSER_SLASH_COMMAND).toBe('/browser')
  })

  it('registers the non-singleton dsh.browser view and browser.open command after a successful probe', async () => {
    const pane = fakePane()
    const result = await applyBrowserPaneRegistration({ pane, provider: createFakeBrowserAutomationProvider(), viewportTransportAvailable: true, component: () => null })
    expect(result.registered).toBe(true)
    expect(result.capabilities).toEqual({ automation: true, viewportTransport: true })
    expect(pane.views[0]?.descriptor).toMatchObject({ kind: 'dsh.browser', singleton: false })
    expect(pane.views[0]?.presentation).toMatchObject({ icon: 'window' })
    expect(pane.views[0]?.component).toBeTypeOf('function')
    expect(pane.commands[0]?.descriptor).toMatchObject({ id: 'browser.open', slash: { name: 'browser' } })
    pane.commands[0]?.execute?.()
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'dsh.browser' }))
    result.dispose()
    result.dispose() // idempotent
  })

  it('no provider → needs_contract; provider failure/empty sessions → unavailable — never live descriptors', async () => {
    const pane = fakePane()
    const noProvider = await applyBrowserPaneRegistration({ pane, provider: undefined, viewportTransportAvailable: false })
    expect(noProvider).toMatchObject({ registered: false, unavailableReason: 'needs_contract' })
    expect(pane.registerView).not.toHaveBeenCalled()

    const failing = { id: 'x', discoverSessions: async () => { throw new Error('offline') }, openSession: async () => undefined }
    const offline = await applyBrowserPaneRegistration({ pane, provider: failing as never, viewportTransportAvailable: false, component: () => null })
    expect(offline).toMatchObject({ registered: false, unavailableReason: 'unavailable' })

    const empty = { id: 'y', discoverSessions: async () => [], openSession: async () => undefined }
    const noSessions = await applyBrowserPaneRegistration({ pane, provider: empty as never, viewportTransportAvailable: false, component: () => null })
    expect(noSessions).toMatchObject({ registered: false, unavailableReason: 'unavailable' })
    expect(pane.registerView).not.toHaveBeenCalled()
  })

  it('does not advertise a live view when the Client renderer is absent', async () => {
    const pane = fakePane()
    const provider = createFakeBrowserAutomationProvider()
    const discover = vi.spyOn(provider, 'discoverSessions')
    const result = await applyBrowserPaneRegistration({ pane, provider, viewportTransportAvailable: true })
    expect(result).toMatchObject({ registered: false, unavailableReason: 'needs_contract' })
    expect(pane.registerView).not.toHaveBeenCalled()
    expect(pane.registerCommand).not.toHaveBeenCalled()
    expect(discover).not.toHaveBeenCalled()
  })
})

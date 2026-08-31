import { describe, expect, it, vi } from 'vitest'
import { BROWSER_OPEN_COMMAND_ID, BROWSER_PANE_PLUGIN_ID, BROWSER_SLASH_COMMAND, applyBrowserPaneRegistration } from '../src/registration.js'
import { createFakeBrowserAutomationProvider } from '@yeisme/dsh-browser-host'

function fakePane() {
  const views: Array<{ descriptor: { kind: string; singleton: boolean }; presentation?: unknown }> = []
  const commands: Array<{ descriptor: { id: string; slash?: unknown } }> = []
  return {
    views, commands,
    registerView: vi.fn((input: { descriptor: { kind: string; singleton: boolean }; presentation?: unknown }) => {
      views.push(input); return () => {}
    }),
    registerCommand: vi.fn((input: { descriptor: { id: string; slash?: unknown } }) => {
      commands.push(input); return () => {}
    }),
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
    const result = await applyBrowserPaneRegistration({ pane, provider: createFakeBrowserAutomationProvider(), viewportTransportAvailable: true })
    expect(result.registered).toBe(true)
    expect(result.capabilities).toEqual({ automation: true, viewportTransport: true })
    expect(pane.views[0]?.descriptor).toMatchObject({ kind: 'dsh.browser', singleton: false })
    expect(pane.views[0]?.presentation).toMatchObject({ icon: 'window' })
    expect(pane.commands[0]?.descriptor).toMatchObject({ id: 'browser.open', slash: { name: 'browser' } })
    result.dispose()
    result.dispose() // idempotent
  })

  it('no provider → needs_contract; provider failure/empty sessions → unavailable — never live descriptors', async () => {
    const pane = fakePane()
    const noProvider = await applyBrowserPaneRegistration({ pane, provider: undefined, viewportTransportAvailable: false })
    expect(noProvider).toMatchObject({ registered: false, unavailableReason: 'needs_contract' })
    expect(pane.registerView).not.toHaveBeenCalled()

    const failing = { id: 'x', discoverSessions: async () => { throw new Error('offline') }, openSession: async () => undefined }
    const offline = await applyBrowserPaneRegistration({ pane, provider: failing as never, viewportTransportAvailable: false })
    expect(offline).toMatchObject({ registered: false, unavailableReason: 'unavailable' })

    const empty = { id: 'y', discoverSessions: async () => [], openSession: async () => undefined }
    const noSessions = await applyBrowserPaneRegistration({ pane, provider: empty as never, viewportTransportAvailable: false })
    expect(noSessions).toMatchObject({ registered: false, unavailableReason: 'unavailable' })
    expect(pane.registerView).not.toHaveBeenCalled()
  })
})

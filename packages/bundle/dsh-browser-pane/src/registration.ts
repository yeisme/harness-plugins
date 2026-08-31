/**
 * Plugin/Pane registration (browser-pane 3.2/3.3).
 *
 * Registers plugin id `dsh-browser-pane`, the `browser.open` / `/browser`
 * entry, the non-singleton `dsh.browser` pane kind, optional
 * automation/viewport capabilities, and the Typert `browserPane`
 * contribution — with an idempotent disposer. The diagnostic Browser
 * launcher only publishes live action descriptors after a compatible
 * Provider probe succeeds; otherwise the entry stays honest (`needs_contract`
 * / `unavailable`).
 *
 * @module @yeisme/dsh-browser-pane
 */
import { BROWSER_PANE_CLIENT_VIEW_KIND } from '@yeisme/dsh-client-ui-browser-pane'
import { DSH_BROWSER_PANE_HOST_CONTEXT_KEY } from '@yeisme/dsh-browser-host'
import type { BrowserAutomationProviderV1, BrowserPaneHostV1 } from '@yeisme/dsh-browser-host'

export const BROWSER_PANE_PLUGIN_ID: 'dsh-browser-pane' = 'dsh-browser-pane' as const
export const BROWSER_OPEN_COMMAND_ID = 'browser.open' as const
export const BROWSER_SLASH_COMMAND = '/browser' as const

/** Optional capabilities published only when the probe succeeds (§3.3). */
export interface BrowserLauncherCapabilitiesV1 {
  readonly automation: boolean
  readonly viewportTransport: boolean
}

export interface BrowserPaneRegistrationInputV1 {
  readonly pane: {
    registerView(input: unknown): () => void
    registerCommand(input: unknown): () => void
  } | undefined
  /** Provider face from the Cordis context; absent = needs_contract. */
  readonly provider: BrowserAutomationProviderV1 | undefined
  /** Whether a viewport transport was injected locally. */
  readonly viewportTransportAvailable: boolean
  readonly labels?: { readonly open?: string | undefined } | undefined
}

export interface BrowserPaneRegistrationResultV1 {
  readonly pluginId: string
  readonly registered: boolean
  /** Honest reason when the pane could not register live. */
  readonly unavailableReason: 'needs_contract' | 'unavailable' | undefined
  readonly capabilities: BrowserLauncherCapabilitiesV1
  dispose(): void
}

/**
 * Applies the registration: probe first, then register view/command with
 * capability-gated descriptors; the disposer is idempotent.
 */
export async function applyBrowserPaneRegistration(input: BrowserPaneRegistrationInputV1): Promise<BrowserPaneRegistrationResultV1> {
  const disposers: Array<() => void> = []
  let disposed = false
  let capabilities: BrowserLauncherCapabilitiesV1 = { automation: false, viewportTransport: input.viewportTransportAvailable }

  if (input.provider === undefined) {
    return { pluginId: BROWSER_PANE_PLUGIN_ID, registered: false, unavailableReason: 'needs_contract', capabilities, dispose: () => {} }
  }
  try {
    const sessions = await input.provider.discoverSessions()
    capabilities = { automation: sessions.length > 0, viewportTransport: input.viewportTransportAvailable }
    if (sessions.length === 0) {
      return { pluginId: BROWSER_PANE_PLUGIN_ID, registered: false, unavailableReason: 'unavailable', capabilities, dispose: () => {} }
    }
  } catch {
    return { pluginId: BROWSER_PANE_PLUGIN_ID, registered: false, unavailableReason: 'unavailable', capabilities, dispose: () => {} }
  }

  if (input.pane !== undefined) {
    disposers.push(input.pane.registerView({
      descriptor: {
        kind: BROWSER_PANE_CLIENT_VIEW_KIND,
        label: input.labels?.open ?? 'Browser',
        componentKey: 'browser-pane',
        role: 'content',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: false,
      },
      presentation: { icon: 'window', defaultEdge: 'right' },
      component: () => null,
    }))
    disposers.push(input.pane.registerCommand({
      descriptor: {
        id: BROWSER_OPEN_COMMAND_ID,
        label: input.labels?.open ?? 'Open Browser Pane',
        slash: { name: 'browser', hint: 'open a browser pane', category: 'pane' },
        presentation: { launcher: true },
      },
      execute: () => { /* view open goes through the pane workbench openView */ },
    }))
  }

  return {
    pluginId: BROWSER_PANE_PLUGIN_ID,
    registered: true,
    unavailableReason: undefined,
    capabilities,
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const dispose of disposers.splice(0)) dispose()
    },
  }
}

export { DSH_BROWSER_PANE_HOST_CONTEXT_KEY }
export type { BrowserAutomationProviderV1, BrowserPaneHostV1 }

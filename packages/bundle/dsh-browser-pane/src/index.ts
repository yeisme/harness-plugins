/**
 * @yeisme/dsh-browser-pane — bundle root (v0.1 rc).
 *
 * Composes the host contracts and the client face into an optional,
 * independent Pane bundle. The Cordis Host plugin owns only lifecycle: live
 * Browser Pane surfaces register compose-time through
 * `applyBrowserPaneRegistration` (§3.2/3.3) after a compatible
 * BrowserAutomationProviderV1 probe succeeds; without a provider the bundle
 * stays honest (needs_contract) and renders no live controls.
 *
 * @module @yeisme/dsh-browser-pane
 */
import type { Context } from '@deepseek-ai/cordis'
import type { BrowserAutomationBindingV1, BrowserAutomationProviderV1 } from '@yeisme/dsh-browser-host'
import type { BrowserViewportTransportV1 } from '@yeisme/dsh-client-ui-browser-pane'
import {
  DSH_BROWSER_AUTOMATION_BINDING_CONTEXT_KEY,
  DSH_BROWSER_AUTOMATION_PROVIDER_CONTEXT_KEY,
  applyBrowserPaneRegistration,
} from './registration.js'

export * from '@yeisme/dsh-browser-host'
export { BROWSER_PANE_CLIENT_VIEW_KIND, BROWSER_PANE_CLIENT_EXPERIMENTAL } from '@yeisme/dsh-client-ui-browser-pane/contracts'
export * from './registration.js'

export const name = 'dsh-browser-pane'
export const inject = [] as const

/** Mount the lifecycle-only Host face and return an exact disposer. */
export async function apply(ctx: Context): Promise<() => void> {
  const get = (name: string): unknown => (ctx as unknown as { get?(key: string): unknown }).get?.(name)
  const result = await applyBrowserPaneRegistration({
    pane: get('paneWorkbench') as { registerView(input: unknown): () => void; registerCommand(input: unknown): () => void } | undefined,
    provider: get(DSH_BROWSER_AUTOMATION_PROVIDER_CONTEXT_KEY) as BrowserAutomationProviderV1 | undefined,
    binding: get(DSH_BROWSER_AUTOMATION_BINDING_CONTEXT_KEY) as BrowserAutomationBindingV1 | undefined,
    viewportTransport: get('dsh.browserViewportTransport') as BrowserViewportTransportV1 | undefined,
    viewportTransportAvailable: get('dsh.browserViewportTransport') !== undefined,
  })
  const disposers: Array<() => void> = [result.dispose]
  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

const BrowserPanePlugin = { name, inject, apply }
export default BrowserPanePlugin

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

export * from '@yeisme/dsh-browser-host'
export { BROWSER_PANE_CLIENT_VIEW_KIND, BROWSER_PANE_CLIENT_EXPERIMENTAL } from '@yeisme/dsh-client-ui-browser-pane'
export * from './registration.js'

export const name = 'dsh-browser-pane'
export const inject = [] as const

/** Mount the lifecycle-only Host face and return an exact disposer. */
export async function apply(_ctx: Context): Promise<() => void> {
  const disposers: Array<() => void> = []
  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

const BrowserPanePlugin = { name, inject, apply }
export default BrowserPanePlugin

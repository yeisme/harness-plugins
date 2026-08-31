/**
 * @yeisme/dsh-browser-host — experimental v0 marker.
 *
 * Full BrowserAutomationProviderV1 / BrowserPaneHostV1 contracts land with
 * tasks 1.2+; this skeleton freezes the package boundary and strict build
 * first so the contract surface can land reviewably.
 *
 * @module @yeisme/dsh-browser-host
 */

/** Experimental API marker: contracts may change within the 0.1.0-rc series. */
export const BROWSER_PANE_EXPERIMENTAL_API = 'browser.automation.experimental.v0.1' as const
export * from './contracts.js'
export * from './remote.js'
export * from './fake-provider.js'

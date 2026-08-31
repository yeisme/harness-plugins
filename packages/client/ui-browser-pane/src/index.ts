/**
 * @yeisme/dsh-client-ui-browser-pane — Browser Pane client face (v0.1 rc).
 *
 * Consumes ONLY @yeisme/dsh-browser-host safe contracts, React, and approved
 * DSH peers (pane workbench/public surfaces). The reducer/controller and
 * view components land with tasks 2.2+; this entry freezes the package
 * boundary and its dependency allowlist first.
 *
 * @module @yeisme/dsh-client-ui-browser-pane
 */
export const BROWSER_PANE_CLIENT_VIEW_KIND = 'dsh.browser' as const
export const BROWSER_PANE_CLIENT_EXPERIMENTAL = 'browser.pane.client.experimental.v0.1' as const
export * from './view-model.js'
export * from './viewport-transport.js'
export * from './control-lease.js'

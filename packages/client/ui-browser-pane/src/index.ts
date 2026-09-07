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
export { BROWSER_PANE_CLIENT_VIEW_KIND, BROWSER_PANE_CLIENT_EXPERIMENTAL } from './contracts.js'
export * from './reducer.js'
export * from './phases.js'
export * from './view-model.js'
export * from './viewport-transport.js'
export * from './control-lease.js'
export * from './navigation.js'
export * from './actions.js'
export * from './teardown.js'
export * from './locales.js'
export { browserPaneStyles } from './styles.js'
export { BrowserPaneProviderView, BrowserPaneView } from './view.js'
export type { BrowserPaneProviderViewProps, BrowserPaneViewProps } from './view.js'

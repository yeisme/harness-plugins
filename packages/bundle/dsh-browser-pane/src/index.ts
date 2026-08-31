/**
 * @yeisme/dsh-browser-pane — bundle root (v0.1 rc).
 *
 * Composes the host contracts and the client face into an optional,
 * independent Pane bundle. Registration (§3.2/3.3) lands next; this entry
 * freezes the package boundary and re-exports both faces.
 *
 * @module @yeisme/dsh-browser-pane
 */
export * from '@yeisme/dsh-browser-host'
export { BROWSER_PANE_CLIENT_VIEW_KIND, BROWSER_PANE_CLIENT_EXPERIMENTAL } from '@yeisme/dsh-client-ui-browser-pane'
export * from './registration.js'

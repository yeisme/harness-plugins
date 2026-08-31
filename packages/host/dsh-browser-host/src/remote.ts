/**
 * Typert `browserPane` Remote contribution (browser-pane 1.5).
 *
 * Safe projection adapter: every method validates owner output fail-closed
 * through the §1.3 validators before it crosses to the browser. No timer
 * polling — snapshot refresh is caller-driven (receipt/reconcile), matching
 * the Pane event model.
 *
 * @module @yeisme/dsh-browser-host
 */
import {
  validateBrowserActionRequest,
  validateBrowserPaneSnapshot,
} from './validation.js'
import type {
  BrowserActionReceiptV1,
  BrowserActionRequestV1,
  BrowserAutomationBindingV1,
  BrowserPaneHostV1,
  BrowserPaneSnapshotV1,
} from './contracts.js'
import { BROWSER_PANE_EXPERIMENTAL_API } from './index.js'

/** Cordis context key the browser client probes for the host face. */
export const DSH_BROWSER_PANE_HOST_CONTEXT_KEY = 'dsh.browserPaneHost' as const

/** Typed remote face the browser consumes (validated adapter). */
export interface BrowserPaneRemoteV1 {
  probe(): Promise<{ readonly available: boolean; readonly reason?: string }>
  listSessions(): Promise<readonly string[]>
  snapshot(binding: BrowserAutomationBindingV1): Promise<BrowserPaneSnapshotV1>
  dispatch(request: BrowserActionRequestV1): Promise<BrowserActionReceiptV1>
  reconcile(binding: BrowserAutomationBindingV1): Promise<BrowserPaneSnapshotV1>
}

class ValidatedBrowserPaneHost implements BrowserPaneHostV1 {
  readonly capability = 'browser.pane.host' as const
  readonly experimental = BROWSER_PANE_EXPERIMENTAL_API

  constructor(private readonly remote: BrowserPaneRemoteV1) {}

  probe() { return this.remote.probe() }
  listSessions() { return this.remote.listSessions() }

  async snapshot(binding: BrowserAutomationBindingV1): Promise<BrowserPaneSnapshotV1> {
    const raw = await this.remote.snapshot(binding)
    const validated = validateBrowserPaneSnapshot(raw)
    if (validated === undefined) {
      return { schemaVersion: 'browser.automation.projection.v0.1', generation: 0, cursor: 0, freshness: 'offline', safeMessage: 'owner projection failed validation', pages: [], activePageRef: undefined, controlHolder: 'none' }
    }
    return validated
  }

  async dispatch(request: BrowserActionRequestV1): Promise<BrowserActionReceiptV1> {
    const validated = validateBrowserActionRequest(request)
    if (validated === undefined) {
      return { status: 'rejected', actionId: request.actionId, receiptRef: 'invalid-request', reasonCode: 'request_failed_validation' }
    }
    return this.remote.dispatch(validated)
  }

  reconcile(binding: BrowserAutomationBindingV1): Promise<BrowserPaneSnapshotV1> {
    return this.snapshot(binding)
  }
}

/** Wraps a remote face with fail-closed validation (the only host constructor). */
export function createBrowserPaneHost(remote: BrowserPaneRemoteV1): BrowserPaneHostV1 {
  return new ValidatedBrowserPaneHost(remote)
}

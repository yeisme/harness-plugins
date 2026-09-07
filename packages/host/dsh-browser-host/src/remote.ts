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
  validateBrowserActionReceipt,
  validateBrowserPaneSnapshot,
} from './validation.js'
import type {
  BrowserActionReceiptV1,
  BrowserActionReconcileRequestV1,
  BrowserActionReconcileResultV1,
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
  reconcileAction?(request: BrowserActionReconcileRequestV1): Promise<BrowserActionReconcileResultV1>
  viewportLease?(binding: BrowserAutomationBindingV1, pageRef: string): Promise<import('./contracts.js').BrowserViewportLeaseV1 | undefined>
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
    if (validated === undefined || (validated.environment !== undefined && validated.environment.workspaceRef !== binding.workspaceRef)) {
      return { schemaVersion: 'browser.automation.projection.v0.1', generation: 0, cursor: 0, freshness: 'offline', safeMessage: 'owner projection failed validation', pages: [], activePageRef: undefined, controlHolder: 'none' }
    }
    return validated
  }

  async dispatch(request: BrowserActionRequestV1): Promise<BrowserActionReceiptV1> {
    const validated = validateBrowserActionRequest(request)
    if (validated === undefined) {
      return { status: 'rejected', actionId: request.actionId, receiptRef: 'invalid-request', reasonCode: 'request_failed_validation' }
    }
    const receipt = validateBrowserActionReceipt(await this.remote.dispatch(validated), validated.actionId)
    return receipt ?? { status: 'unknown', actionId: validated.actionId, receiptRef: 'invalid-receipt', reasonCode: 'receipt_failed_validation' }
  }

  async reconcile(binding: BrowserAutomationBindingV1): Promise<BrowserPaneSnapshotV1> {
    const raw = await this.remote.reconcile(binding)
    const validated = validateBrowserPaneSnapshot(raw)
    if (validated === undefined || (validated.environment !== undefined && validated.environment.workspaceRef !== binding.workspaceRef)) return { schemaVersion: 'browser.automation.projection.v0.1', generation: 0, cursor: 0, freshness: 'offline', safeMessage: 'owner reconcile failed validation', pages: [], activePageRef: undefined, controlHolder: 'none' }
    return validated
  }

  async reconcileAction(request: BrowserActionReconcileRequestV1): Promise<BrowserActionReconcileResultV1> {
    const identity = validateBrowserActionRequest({ schemaVersion: 'browser.automation.action.v0.1', actionId: request.actionId, binding: request.binding, pageRef: undefined, idempotencyKey: request.idempotencyKey, navigationDraft: undefined })
    if (identity === undefined) return { actionId: request.actionId, idempotencyKey: request.idempotencyKey, settled: false, snapshot: { schemaVersion: 'browser.automation.projection.v0.1', generation: 0, cursor: 0, freshness: 'offline', safeMessage: 'owner action reconcile request failed validation', pages: [], activePageRef: undefined, controlHolder: 'none' } }
    const validatedRequest = { binding: identity.binding, actionId: identity.actionId, idempotencyKey: identity.idempotencyKey }
    const raw = await this.remote.reconcileAction?.(validatedRequest)
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)
      || Object.keys(raw).length !== 4
      || Object.keys(raw).some(key => !['actionId', 'idempotencyKey', 'settled', 'snapshot'].includes(key))
      || typeof raw.settled !== 'boolean'
      || raw.actionId !== validatedRequest.actionId || raw.idempotencyKey !== validatedRequest.idempotencyKey) return { actionId: validatedRequest.actionId, idempotencyKey: validatedRequest.idempotencyKey, settled: false, snapshot: { schemaVersion: 'browser.automation.projection.v0.1', generation: 0, cursor: 0, freshness: 'offline', safeMessage: 'owner action reconcile unavailable', pages: [], activePageRef: undefined, controlHolder: 'none' } }
    const validated = validateBrowserPaneSnapshot(raw.snapshot)
    if (validated === undefined || (validated.environment !== undefined && validated.environment.workspaceRef !== validatedRequest.binding.workspaceRef)) return { actionId: validatedRequest.actionId, idempotencyKey: validatedRequest.idempotencyKey, settled: false, snapshot: { schemaVersion: 'browser.automation.projection.v0.1', generation: 0, cursor: 0, freshness: 'offline', safeMessage: 'owner action reconcile failed validation', pages: [], activePageRef: undefined, controlHolder: 'none' } }
    return { actionId: validatedRequest.actionId, idempotencyKey: validatedRequest.idempotencyKey, settled: raw.settled, snapshot: validated }
  }

  async viewportLease(binding: BrowserAutomationBindingV1, pageRef: string) {
    return await this.remote.viewportLease?.(binding, pageRef)
  }
}

/** Wraps a remote face with fail-closed validation (the only host constructor). */
export function createBrowserPaneHost(remote: BrowserPaneRemoteV1): BrowserPaneHostV1 {
  return new ValidatedBrowserPaneHost(remote)
}

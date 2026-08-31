/**
 * Owner-authored browser actions (browser-pane 2.8).
 *
 * Navigation, history, reload/stop, page switching, takeover/release,
 * download authorization, and evidence requests are dispatched ONLY as
 * owner-authored descriptors: no local effect, no automatic retry — unknown
 * outcomes reconcile through the reducer instead.
 *
 * @module @yeisme/dsh-client-ui-browser-pane
 */
import type { BrowserActionDescriptorV1, BrowserActionRequestV1 } from '@yeisme/dsh-browser-host'

export type BrowserUiActionId =
  | 'navigate' | 'history_back' | 'history_forward' | 'reload' | 'stop'
  | 'open_page' | 'close_page' | 'activate_page'
  | 'download_authorize' | 'evidence_request' | 'take_control' | 'release_control'

/** Local intent → typed request; the owner owns every effect. */
export function buildBrowserUiAction(input: {
  readonly actionId: BrowserUiActionId
  readonly binding: BrowserActionRequestV1['binding']
  readonly pageRef: string | undefined
  readonly navigationDraft?: string | undefined
  readonly idempotencySeed: number
}): BrowserActionRequestV1 {
  return {
    schemaVersion: 'browser.automation.action.v0.1',
    actionId: input.actionId,
    binding: input.binding,
    pageRef: input.pageRef,
    idempotencyKey: `bp-${input.actionId}-${input.idempotencySeed}`,
    navigationDraft: input.navigationDraft,
  }
}

/** UI-side descriptor gating: owner-disabled actions render disabled with the reason. */
export function gateBrowserUiAction(
  descriptor: BrowserActionDescriptorV1 | undefined,
  liveControls: boolean,
): { readonly enabled: boolean; readonly label: string | undefined; readonly reason: string | undefined } {
  if (descriptor === undefined) return { enabled: false, label: undefined, reason: 'action_not_offered' }
  if (descriptor.disabledReason !== undefined) return { enabled: false, label: descriptor.label, reason: descriptor.disabledReason }
  if (!liveControls) return { enabled: false, label: descriptor.label, reason: 'phase_locked' }
  return { enabled: true, label: descriptor.label, reason: undefined }
}

export type BrowserDispatchOutcome =
  | { readonly kind: 'submitted'; readonly receiptRef: string }
  | { readonly kind: 'rejected'; readonly reasonCode: string }
  | { readonly kind: 'needs_confirm' }
  | { readonly kind: 'unknown'; readonly reasonCode: string | undefined }

/** Maps an owner receipt; `unknown` requests reconcile — never an auto retry. */
export function mapBrowserReceipt(receipt: { readonly status: string; readonly receiptRef: string; readonly reasonCode?: string | undefined }): BrowserDispatchOutcome {
  switch (receipt.status) {
    case 'ok': return { kind: 'submitted', receiptRef: receipt.receiptRef }
    case 'rejected': return { kind: 'rejected', reasonCode: receipt.reasonCode ?? 'rejected' }
    case 'needs_confirm': return { kind: 'needs_confirm' }
    default: return { kind: 'unknown', reasonCode: receipt.reasonCode }
  }
}

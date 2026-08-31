/**
 * Browser automation safe contracts v0.1 (browser-pane 1.2).
 *
 * The browser process, pages, network stack, credentials, and downloads stay
 * with the external automation owner. These types freeze ONLY the safe
 * projection surface the Pane consumes: opaque refs, bounded summaries, typed
 * actions with owner receipts, and exclusive control/viewport leases. No
 * field here carries a URL, path, credential, DOM bytes, or media address —
 * the viewport streams through a separately injected local Transport.
 *
 * @module @yeisme/dsh-browser-host
 */

/** Opaque automation session handle (never a URL or browser profile path). */
export type BrowserAutomationSessionRef = string

/** Opaque page handle inside one automation session (max 32 per Pane). */
export type BrowserAutomationPageRef = string

export const BROWSER_AUTOMATION_PROJECTION_SCHEMA = 'browser.automation.projection.v0.1' as const
export const BROWSER_AUTOMATION_EVENT_SCHEMA = 'browser.automation.event.v0.1' as const
export const BROWSER_AUTOMATION_ACTION_SCHEMA = 'browser.automation.action.v0.1' as const
export const BROWSER_VIEWPORT_ATTACHMENT_SCHEMA = 'browser.viewport.attachment.v0.1' as const

/** Owner-side context binding — every request/receipt must echo it exactly. */
export interface BrowserAutomationBindingV1 {
  readonly tenantRef: string
  readonly workspaceRef: string
  readonly principalRef: string
  readonly contextRevision: number
  readonly sessionRef: BrowserAutomationSessionRef
}

/** Redacted address: protocol + punycode host + path digest only. */
export interface BrowserSafeLocationV1 {
  readonly protocol: 'http:' | 'https:' | 'file:' | 'about:' | 'other'
  readonly host: string
  readonly pathDigest: string
  readonly title: string | undefined
}

export type BrowserPageStatusV1 = 'loading' | 'ready' | 'crashed' | 'closed'

export interface BrowserPageSummaryV1 {
  readonly pageRef: BrowserAutomationPageRef
  readonly location: BrowserSafeLocationV1
  readonly status: BrowserPageStatusV1
  readonly agentActivityCount: number
}

export type BrowserAutomationFreshness = 'fresh' | 'stale' | 'offline'

export interface BrowserPaneSnapshotV1 {
  readonly schemaVersion: typeof BROWSER_AUTOMATION_PROJECTION_SCHEMA
  readonly generation: number
  readonly cursor: number
  readonly freshness: BrowserAutomationFreshness
  readonly safeMessage: string
  readonly pages: readonly BrowserPageSummaryV1[]
  readonly activePageRef: BrowserAutomationPageRef | undefined
  readonly controlHolder: 'agent' | 'human' | 'none'
}

export type BrowserAutomationEventKind =
  | 'page_opened' | 'page_closed' | 'navigation_completed' | 'page_status'
  | 'agent_activity' | 'receipt' | 'control_changed' | 'invalidate'

export interface BrowserPaneEventV1 {
  readonly schemaVersion: typeof BROWSER_AUTOMATION_EVENT_SCHEMA
  readonly generation: number
  readonly sequence: number
  readonly kind: BrowserAutomationEventKind
  readonly pageRef: BrowserAutomationPageRef | undefined
  readonly safeSummary: string
}

export type BrowserActionKindV1 =
  | 'navigate' | 'history_back' | 'history_forward' | 'reload' | 'stop'
  | 'open_page' | 'close_page' | 'activate_page'
  | 'download_authorize' | 'evidence_request' | 'take_control' | 'release_control'

export interface BrowserActionDescriptorV1 {
  readonly actionId: string
  readonly label: string
  readonly kind: BrowserActionKindV1
  readonly requiresConfirmation: 'none' | 'confirm' | 'approval'
  readonly disabledReason: string | undefined
}

export interface BrowserActionRequestV1 {
  readonly schemaVersion: typeof BROWSER_AUTOMATION_ACTION_SCHEMA
  readonly actionId: string
  readonly binding: BrowserAutomationBindingV1
  readonly pageRef: BrowserAutomationPageRef | undefined
  readonly idempotencyKey: string
  /** Ephemeral navigation draft — exists only inside this request. */
  readonly navigationDraft: string | undefined
}

export type BrowserActionReceiptStatus = 'ok' | 'rejected' | 'needs_confirm' | 'unknown'

export interface BrowserActionReceiptV1 {
  readonly status: BrowserActionReceiptStatus
  readonly actionId: string
  readonly receiptRef: string
  readonly reasonCode: string | undefined
}

/** Exclusive human takeover lease; agent input pauses while held. */
export interface BrowserControlLeaseV1 {
  readonly holder: 'human'
  readonly issuedAt: string
  readonly expiresAt: string
  readonly agentInputPaused: true
}

/** Opaque handle the injected Transport resolves locally to a MediaStream. */
export interface BrowserViewportLeaseV1 {
  readonly pageRef: BrowserAutomationPageRef
  readonly leaseToken: string
  readonly expiresAt: string
}

/** The safe host face the Pane consumes; owners implement it externally. */
export interface BrowserPaneHostV1 {
  readonly capability: 'browser.pane.host'
  readonly experimental: typeof import('./index.js').BROWSER_PANE_EXPERIMENTAL_API
  probe(): Promise<{ readonly available: boolean; readonly reason?: string }>
  listSessions(): Promise<readonly BrowserAutomationSessionRef[]>
  snapshot(binding: BrowserAutomationBindingV1): Promise<BrowserPaneSnapshotV1>
  dispatch(request: BrowserActionRequestV1): Promise<BrowserActionReceiptV1>
  reconcile(binding: BrowserAutomationBindingV1): Promise<BrowserPaneSnapshotV1>
}

/** Owner-side provider (session discovery + safe projection). */
export interface BrowserAutomationProviderV1 {
  readonly id: string
  discoverSessions(): Promise<readonly BrowserAutomationSessionRef[]>
  openSession(sessionRef: BrowserAutomationSessionRef): Promise<BrowserPaneHostV1 | undefined>
}

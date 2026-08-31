/**
 * Browser pane teardown (browser-pane 2.9).
 *
 * Tab switch, unmount, page/context/generation/epoch switch, and HMR must
 * release everything the pane owns: detach the transport idempotently, drop
 * every listener/observer, and clear the navigation draft. A fresh mount
 * re-attaches from scratch — nothing survives except durable state owned
 * elsewhere.
 *
 * @module @yeisme/dsh-client-ui-browser-pane
 */
import type { BrowserViewportTransportV1 } from './viewport-transport.js'
import { clearNavigationDraft, type NavigationDraftStateV1 } from './navigation.js'

export interface BrowserPaneTeardownAuditV1 {
  readonly transportDetachCalls: number
  readonly listenersCleared: boolean
  readonly draftCleared: boolean
}

/** Single idempotent teardown path for every lifecycle trigger. */
export function teardownBrowserPane(input: {
  readonly transport: Pick<BrowserViewportTransportV1, 'detach'> | undefined
  readonly listeners: Set<() => void>
  readonly draft: NavigationDraftStateV1
}): { readonly draft: NavigationDraftStateV1; readonly audit: BrowserPaneTeardownAuditV1 } {
  let detachCalls = 0
  if (input.transport !== undefined) {
    input.transport.detach()
    detachCalls += 1
  }
  input.listeners.clear()
  const draft = clearNavigationDraft(input.draft)
  return {
    draft,
    audit: { transportDetachCalls: detachCalls, listenersCleared: input.listeners.size === 0, draftCleared: draft.text === undefined },
  }
}

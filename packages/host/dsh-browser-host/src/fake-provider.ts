/**
 * Deterministic fake automation provider (browser-pane 1.6).
 *
 * Covers pages, agent activity, receipts, unknown/reconcile, evidence and
 * download candidates, generation reset, and the exclusive control lease —
 * with zero real browser, network, or timer dependency. Consumed by tests,
 * fixtures, and the conformance suite.
 *
 * @module @yeisme/dsh-browser-host
 */
import type {
  BrowserActionReceiptV1,
  BrowserActionRequestV1,
  BrowserAutomationBindingV1,
  BrowserAutomationProviderV1,
  BrowserAutomationSessionRef,
  BrowserPaneEventV1,
  BrowserPaneHostV1,
  BrowserPaneSnapshotV1,
} from './contracts.js'
import { BROWSER_PANE_EXPERIMENTAL_API } from './index.js'

export interface FakeBrowserScript {
  readonly pages?: readonly { readonly pageRef: string; readonly host: string; readonly title?: string }[]
  /** Rejects every dispatch with this status (unknown path). */
  readonly dispatchStatus?: BrowserActionReceiptV1['status'] | undefined
  /** Bumps the generation on the next snapshot (reset path). */
  readonly resetGenerationOnNextSnapshot?: boolean | undefined
  /** Control holder reported by the snapshot. */
  readonly controlHolder?: BrowserPaneSnapshotV1['controlHolder'] | undefined
}

export interface FakeBrowserProviderEvents {
  /** Subscribe to the deterministic event stream emitted by dispatch/reconcile. */
  subscribe(listener: (event: BrowserPaneEventV1) => void): () => void
}

export function createFakeBrowserAutomationProvider(script: FakeBrowserScript = {}): BrowserAutomationProviderV1 & FakeBrowserProviderEvents & { readonly hostsOpened: readonly string[] } {
  const hostsOpened: string[] = []
  const listeners = new Set<(event: BrowserPaneEventV1) => void>()
  let generation = 1
  let cursor = 0
  let resetPending = script.resetGenerationOnNextSnapshot === true
  const controlHolder = script.controlHolder ?? 'agent'

  const emit = (kind: BrowserPaneEventV1['kind'], pageRef: string | undefined, safeSummary: string): void => {
    cursor += 1
    const event: BrowserPaneEventV1 = { schemaVersion: 'browser.automation.event.v0.1', generation, sequence: cursor, kind, pageRef, safeSummary }
    for (const listener of listeners) listener(event)
  }

  const snapshot = (): BrowserPaneSnapshotV1 => {
    if (resetPending) {
      generation += 1
      cursor = 0
      resetPending = false
    }
    const pages = (script.pages ?? [{ pageRef: 'page:1', host: 'example.com' }]).map(entry => ({
      pageRef: entry.pageRef,
      location: { protocol: 'https:' as const, host: entry.host, pathDigest: 'a1b2c3d4e5'.padEnd(10, '0'), title: entry.title ?? entry.host },
      status: 'ready' as const,
      agentActivityCount: 2,
    }))
    return {
      schemaVersion: 'browser.automation.projection.v0.1',
      generation,
      cursor,
      freshness: 'fresh',
      safeMessage: 'fake provider ready',
      pages,
      activePageRef: pages[0]?.pageRef,
      controlHolder,
    }
  }

  const host: BrowserPaneHostV1 = {
    capability: 'browser.pane.host',
    experimental: BROWSER_PANE_EXPERIMENTAL_API,
    probe: async () => ({ available: true }),
    listSessions: async () => ['fake-session:1'],
    snapshot: async (_binding: BrowserAutomationBindingV1) => snapshot(),
    dispatch: async (request: BrowserActionRequestV1): Promise<BrowserActionReceiptV1> => {
      if (script.dispatchStatus !== undefined && script.dispatchStatus !== 'ok') {
        emit('receipt', request.pageRef, `receipt ${script.dispatchStatus}`)
        return { status: script.dispatchStatus, actionId: request.actionId, receiptRef: `fake-receipt:${++cursor}`, reasonCode: `fake_${script.dispatchStatus}` }
      }
      if (request.actionId.startsWith('take_control')) {
        emit('control_changed', request.pageRef, 'human took control')
      } else if (request.actionId.startsWith('release_control')) {
        emit('control_changed', request.pageRef, 'agent resumed control')
      } else if (request.actionId.startsWith('evidence')) {
        emit('agent_activity', request.pageRef, 'evidence candidate ready')
      } else if (request.actionId.startsWith('download')) {
        emit('agent_activity', request.pageRef, 'download candidate ready')
      } else {
        emit('navigation_completed', request.pageRef, 'navigation completed')
      }
      emit('receipt', request.pageRef, 'receipt ok')
      return { status: 'ok', actionId: request.actionId, receiptRef: `fake-receipt:${++cursor}`, reasonCode: undefined }
    },
    reconcile: async (_binding: BrowserAutomationBindingV1) => {
      emit('invalidate', undefined, 'reconcile requested')
      return snapshot()
    },
  }

  return {
    id: 'fake-browser-automation',
    discoverSessions: async () => ['fake-session:1'],
    openSession: async (sessionRef: BrowserAutomationSessionRef) => {
      hostsOpened.push(sessionRef)
      return sessionRef === 'fake-session:1' ? host : undefined
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    get hostsOpened() { return [...hostsOpened] },
  }
}

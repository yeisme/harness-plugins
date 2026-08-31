/**
 * Browser viewport transport (browser-pane 2.5).
 *
 * Client-local attachment under `dsh.browserViewportTransport`: the owner
 * hands out an opaque viewport lease; the injected Transport resolves it
 * locally into a synthetic MediaStream, forwards input with typed acks,
 * handles resize, and reports ended/stalled — with idempotent detach and
 * zero credential or bearer in any field. Input flows only while a local
 * non-bearer control lease is held.
 *
 * @module @yeisme/dsh-client-ui-browser-pane
 */
import type { BrowserViewportLeaseV1 } from '@yeisme/dsh-browser-host'

export const DSH_BROWSER_VIEWPORT_TRANSPORT_CONTEXT_KEY = 'dsh.browserViewportTransport' as const

export interface ViewportInputAckV1 {
  readonly sequence: number
  readonly accepted: boolean
  readonly reason: 'ok' | 'no_control_lease' | 'detached' | 'stalled'
}

export interface ViewportTransportEventsV1 {
  onEnded(handler: () => void): void
  onStalled(handler: () => void): void
}

export interface BrowserViewportTransportV1 {
  /** Resolves the opaque lease into a local synthetic MediaStream. */
  attach(lease: BrowserViewportLeaseV1): Promise<MediaStream | undefined>
  /** Sends input; only honored while the local control lease is held. */
  sendInput(event: { readonly type: 'key' | 'pointer'; readonly summary: string }, controlHeld: boolean): ViewportInputAckV1
  /** Notifies the page viewport size change. */
  resize(size: { readonly width: number; readonly height: number }): void
  /** Idempotent detach: stops media tracks and removes listeners. */
  detach(): void
  readonly events: ViewportTransportEventsV1
}

/** Deterministic fake transport for tests (synthetic stream via stub track). */
export function createFakeViewportTransport(): BrowserViewportTransportV1 & { readonly attachedCount: number; readonly detachCount: number; readonly inputs: readonly { summary: string; controlHeld: boolean }[] } {
  let attached = 0
  let detached = 0
  const inputs: Array<{ summary: string; controlHeld: boolean }> = []
  const endedHandlers = new Set<() => void>()
  const stalledHandlers = new Set<() => void>()
  let stream: MediaStream | undefined
  return {
    attach: async () => {
      attached += 1
      stream = { getTracks: () => [{ stop: () => {} }], getVideoTracks: () => [] } as unknown as MediaStream
      return stream
    },
    sendInput: (event, controlHeld) => {
      if (detached > 0 && attached <= detached) return { sequence: inputs.length, accepted: false, reason: 'detached' }
      inputs.push({ summary: event.summary, controlHeld })
      if (!controlHeld) return { sequence: inputs.length, accepted: false, reason: 'no_control_lease' }
      return { sequence: inputs.length, accepted: true, reason: 'ok' }
    },
    resize: () => {},
    detach: () => { detached += 1; stream?.getTracks().forEach(track => track.stop()); stream = undefined; endedHandlers.clear(); stalledHandlers.clear() },
    events: {
      onEnded: handler => { endedHandlers.add(handler) },
      onStalled: handler => { stalledHandlers.add(handler) },
    },
    get attachedCount() { return attached },
    get detachCount() { return detached },
    get inputs() { return [...inputs] },
  }
}

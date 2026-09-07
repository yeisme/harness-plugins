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
  readonly reason: 'ok' | 'no_control_lease' | 'detached' | 'stalled' | 'invalid_input'
}

export interface ViewportInputModifiersV1 { readonly alt: boolean; readonly ctrl: boolean; readonly meta: boolean; readonly shift: boolean }
export type BrowserViewportInputV1 = {
  readonly type: 'pointer'; readonly phase: 'down' | 'move' | 'up'; readonly x: number; readonly y: number; readonly button: number; readonly buttons: number; readonly modifiers: ViewportInputModifiersV1
} | {
  readonly type: 'key'; readonly phase: 'down' | 'up'; readonly key: string; readonly code: string; readonly repeat: boolean; readonly modifiers: ViewportInputModifiersV1
}

export function validateViewportInput(input: BrowserViewportInputV1): boolean {
  const modifiers = input.modifiers
  if (typeof modifiers?.alt !== 'boolean' || typeof modifiers.ctrl !== 'boolean' || typeof modifiers.meta !== 'boolean' || typeof modifiers.shift !== 'boolean') return false
  if (input.type === 'pointer') return ['down', 'move', 'up'].includes(input.phase) && Number.isFinite(input.x) && input.x >= 0 && input.x <= 1 && Number.isFinite(input.y) && input.y >= 0 && input.y <= 1 && Number.isInteger(input.button) && input.button >= -1 && input.button <= 4 && Number.isInteger(input.buttons) && input.buttons >= 0 && input.buttons <= 31
  if (input.type !== 'key') return false
  return ['down', 'up'].includes(input.phase) && input.key.length >= 1 && input.key.length <= 64 && input.code.length <= 64 && !/[\u0000-\u001f\u007f]/u.test(input.key) && !/[\u0000-\u001f\u007f]/u.test(input.code)
}

export interface ViewportTransportEventsV1 {
  onEnded(handler: () => void): void
  onStalled(handler: () => void): void
}

export interface BrowserViewportTransportV1 {
  /** Resolves the opaque lease into a local synthetic MediaStream. */
  attach(lease: BrowserViewportLeaseV1): Promise<MediaStream | undefined>
  /** Sends input; only honored while the local control lease is held. */
  sendInput(event: BrowserViewportInputV1, controlHeld: boolean): ViewportInputAckV1
  /** Notifies the page viewport size change. */
  resize(size: { readonly width: number; readonly height: number }): void
  /** Idempotent detach: stops media tracks and removes listeners. */
  detach(): void
  readonly events: ViewportTransportEventsV1
}

/** Deterministic fake transport for tests (synthetic stream via stub track). */
export function createFakeViewportTransport(): BrowserViewportTransportV1 & { readonly attachedCount: number; readonly detachCount: number; readonly inputs: readonly { event: BrowserViewportInputV1; controlHeld: boolean }[] } {
  let attached = 0
  let detached = 0
  const inputs: Array<{ event: BrowserViewportInputV1; controlHeld: boolean }> = []
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
      if (!validateViewportInput(event)) return { sequence: inputs.length, accepted: false, reason: 'invalid_input' }
      inputs.push({ event, controlHeld })
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

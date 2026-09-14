/**
 * Lightweight connect-doc controller: digest endorsement, drift-to-stale, and
 * exactly-once explicit re-discovery for the capability map card.
 *
 * The browser never contacts the Gateway directly — every byte comes from the
 * host `toolHub` remote projection. Missing probes degrade honestly to a
 * disabled state with a reason; stale docs stay rendered but explicitly marked
 * and are never presented as fresh.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client/connect-doc
 */

import type { ToolHubConnectDocAnswerV1, ToolHubConnectDocOkV1, ToolHubRemoteFace } from './wire.ts'

const DOC_DIGEST = /^[0-9a-f]{16}$/
const SAFE_FACE_TEXT = /^[A-Za-z0-9_.:-]{1,120}$/
const MAX_FACES = 64

export type ConnectDocControllerState =
  | { readonly status: 'idle' }
  | { readonly status: 'reading' }
  | { readonly status: 'disabled'; readonly reason: string }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly doc: ToolHubConnectDocOkV1 }
  | { readonly status: 'stale'; readonly doc: ToolHubConnectDocOkV1; readonly currentDigest: string }

export interface ConnectDocNotice {
  readonly kind: 'rediscover-failed' | 'rediscover-rejected'
  readonly message: string
}

const IDLE: ConnectDocControllerState = Object.freeze({ status: 'idle' })
const READING: ConnectDocControllerState = Object.freeze({ status: 'reading' })

function parseDoc(answer: ToolHubConnectDocAnswerV1): ToolHubConnectDocOkV1 | undefined {
  if (!('docDigest' in answer) || typeof answer.docDigest !== 'string' || !DOC_DIGEST.test(answer.docDigest)) return undefined
  if (typeof answer.observedAt !== 'number' || !Number.isFinite(answer.observedAt) || answer.observedAt < 0) return undefined
  if (!Array.isArray(answer.faces) || answer.faces.length > MAX_FACES) return undefined
  for (const face of answer.faces) {
    if (typeof face?.id !== 'string' || !SAFE_FACE_TEXT.test(face.id)) return undefined
    if (typeof face.publicName !== 'string' || face.publicName.length === 0 || face.publicName.length > 120) return undefined
    if (typeof face.kind !== 'string' || !SAFE_FACE_TEXT.test(face.kind)) return undefined
    if (face.toolCount !== undefined && (typeof face.toolCount !== 'number' || !Number.isInteger(face.toolCount) || face.toolCount < 0)) return undefined
  }
  return { ok: true, docDigest: answer.docDigest, observedAt: answer.observedAt, faces: answer.faces }
}

/** Resolves the remote per query, so a missing projection is recoverable. */
export type ConnectDocRemoteResolver = () => Promise<ToolHubRemoteFace | undefined>

export class ConnectDocController {
  private readonly resolve: ConnectDocRemoteResolver
  private state: ConnectDocControllerState = IDLE
  private notice: ConnectDocNotice | undefined
  private reading = false
  private rediscovering = false
  private readonly listeners = new Set<() => void>()

  constructor(resolve: ConnectDocRemoteResolver) {
    this.resolve = resolve
  }

  getSnapshot(): ConnectDocControllerState {
    return this.state
  }

  noticeSnapshot(): ConnectDocNotice | undefined {
    return this.notice
  }

  rediscoveringSnapshot(): boolean {
    return this.rediscovering
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Plugin unmount: drop listeners; the controller holds no other resources. */
  dispose(): void {
    this.listeners.clear()
  }

  private setState(next: ConnectDocControllerState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }

  /**
   * Read the projection once. A digest different from the rendered doc keeps
   * the rendered doc and flips to an explicit stale state — the fresh digest is
   * surfaced for the mismatch banner, never silently adopted.
   */
  async read(): Promise<void> {
    if (this.reading) return
    this.reading = true
    if (this.state.status !== 'ready' && this.state.status !== 'stale') this.setState(READING)
    try {
      const face = await this.resolve()
      if (face === undefined || typeof face.connectDoc !== 'function') {
        this.setState({ status: 'disabled', reason: face === undefined ? 'toolHub remote projection is unavailable' : 'connectDoc is not exposed by this host' })
        return
      }
      let answer: ToolHubConnectDocAnswerV1
      try {
        answer = await face.connectDoc()
      } catch {
        this.setState({ status: 'error', message: 'connect doc transport failed' })
        return
      }
      if (answer === undefined || typeof answer !== 'object' || answer === null) {
        this.setState({ status: 'error', message: 'connect doc answer was malformed' })
        return
      }
      if (!answer.ok) {
        this.setState({ status: 'disabled', reason: answer.message })
        return
      }
      const doc = parseDoc(answer)
      if (doc === undefined) {
        this.setState({ status: 'error', message: 'connect doc failed validation' })
        return
      }
      if (this.state.status === 'ready' && this.state.doc.docDigest !== doc.docDigest) {
        this.setState({ status: 'stale', doc: this.state.doc, currentDigest: doc.docDigest })
        return
      }
      if (this.state.status === 'stale') {
        if (this.state.currentDigest !== doc.docDigest) this.setState({ status: 'stale', doc: this.state.doc, currentDigest: doc.docDigest })
        return
      }
      this.setState({ status: 'ready', doc })
    } finally {
      this.reading = false
    }
  }

  /**
   * User-triggered exactly-once re-discovery. On success the doc is re-read and
   * the mismatch banner clears only when the re-read digest matches the digest
   * the owner returned for this re-discovery; a further drift stays stale.
   * Nothing schedules this method — the caller owns the single action button.
   */
  async rediscover(): Promise<void> {
    if (this.rediscovering) return
    // The guard must hold synchronously: the resolver below is async, so a
    // second user action in the same tick must already see in-flight.
    this.rediscovering = true
    this.notify()
    try {
      const face = await this.resolve()
      if (face === undefined || typeof face.rediscover !== 'function') {
        this.notice = { kind: 'rediscover-rejected', message: face === undefined ? 'toolHub remote projection is unavailable' : 'rediscover is not exposed by this host' }
        return
      }
      const answer = await face.rediscover()
      if (!answer.ok) {
        this.notice = { kind: 'rediscover-failed', message: answer.message }
        return
      }
      this.notice = undefined
      const doc = await this.readFresh(face)
      if (doc === undefined) return
      if (doc.docDigest === answer.docDigest) {
        this.setState({ status: 'ready', doc })
      } else if (this.state.status === 'ready' || this.state.status === 'stale') {
        this.setState({ status: 'stale', doc: this.state.doc, currentDigest: doc.docDigest })
      } else {
        this.setState({ status: 'ready', doc })
      }
    } catch {
      this.notice = { kind: 'rediscover-failed', message: 're-discovery transport failed' }
    } finally {
      this.rediscovering = false
      this.notify()
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  private async readFresh(face: ToolHubRemoteFace): Promise<ToolHubConnectDocOkV1 | undefined> {
    const answer = await face.connectDoc!()
    if (!answer.ok) {
      this.setState({ status: 'disabled', reason: answer.message })
      return undefined
    }
    const doc = parseDoc(answer)
    if (doc === undefined) {
      this.setState({ status: 'error', message: 'connect doc failed validation' })
      return undefined
    }
    return doc
  }
}

export function createConnectDocController(resolve: ConnectDocRemoteResolver): ConnectDocController {
  return new ConnectDocController(resolve)
}

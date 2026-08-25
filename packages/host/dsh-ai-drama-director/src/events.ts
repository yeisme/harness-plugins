/**
 * Snapshot + push event session. No polling. Gaps pause mutation.
 */

import { type DramaContextV1 } from './contracts.js'
import { shouldResyncContext } from './context.js'

export type DramaEventKind = 'snapshot' | 'updated' | 'gap' | 'duplicate'

export interface DramaPushEventV1 {
  readonly sequence: number
  readonly kind: DramaEventKind
  readonly contextRevision: string
}

export interface DramaEventSessionState {
  readonly listening: boolean
  readonly lastSequence: number | null
  readonly context?: DramaContextV1
  readonly paused: boolean
  readonly reason: string
}

export class DramaEventSession {
  private state: DramaEventSessionState = {
    listening: false,
    lastSequence: null,
    paused: true,
    reason: 'no snapshot yet',
  }

  private disposer: (() => void) | undefined

  getSnapshot(): DramaEventSessionState {
    return this.state
  }

  applySnapshot(context: DramaContextV1, sequence = 0): DramaEventSessionState {
    this.teardown()
    this.state = {
      listening: true,
      lastSequence: sequence,
      context,
      paused: context.freshness !== 'fresh',
      reason: context.freshness === 'fresh' ? 'snapshot applied' : `snapshot freshness is ${context.freshness}`,
    }
    return this.state
  }

  applyEvent(event: DramaPushEventV1): DramaEventSessionState {
    if (!this.state.listening) {
      return this.pause('event received before snapshot')
    }
    if (this.state.lastSequence !== null && event.sequence <= this.state.lastSequence) {
      this.state = { ...this.state, reason: 'duplicate event ignored' }
      return this.state
    }
    if (this.state.lastSequence !== null && event.sequence > this.state.lastSequence + 1) {
      return this.pause('event gap; resync snapshot')
    }
    if (event.kind === 'gap') {
      return this.pause('owner reported a cursor gap')
    }
    const nextContext = this.state.context === undefined
      ? undefined
      : { ...this.state.context, contextRevision: event.contextRevision }
    if (nextContext !== undefined && shouldResyncContext(this.state.context, nextContext)) {
      return this.pause('context revision changed; resync snapshot')
    }
    this.state = {
      ...this.state,
      lastSequence: event.sequence,
      context: nextContext ?? this.state.context,
      paused: false,
      reason: 'event applied',
    }
    return this.state
  }

  attach(disposer: () => void): void {
    this.teardown()
    this.disposer = disposer
    this.state = { ...this.state, listening: true }
  }

  teardown(): void {
    this.disposer?.()
    this.disposer = undefined
    this.state = {
      listening: false,
      lastSequence: this.state.lastSequence,
      context: this.state.context,
      paused: true,
      reason: 'session torn down',
    }
  }

  usesPolling(): false {
    return false
  }

  private pause(reason: string): DramaEventSessionState {
    this.teardown()
    this.state = { ...this.state, listening: false, paused: true, reason }
    return this.state
  }
}

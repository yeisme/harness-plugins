/** Generation-aware client projection for `sessionOrganization.snapshot`. */

import type { SessionOrganizationRemoteFace, SessionOrganizationSnapshotV1 } from './organization-wire.ts'

export type SessionOrganizationControllerState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'ready'; readonly snapshot: SessionOrganizationSnapshotV1 }
  | { readonly status: 'error'; readonly message: string }

export class SessionOrganizationController {
  private state: SessionOrganizationControllerState = Object.freeze({ status: 'idle' })
  private readonly listeners = new Set<() => void>()
  private generation = 0
  private disposed = false

  constructor(private readonly remote: SessionOrganizationRemoteFace) {}

  getSnapshot(): SessionOrganizationControllerState { return this.state }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async refresh(): Promise<void> {
    if (this.disposed) return
    const generation = ++this.generation
    if (this.state.status === 'idle') this.setState(Object.freeze({ status: 'loading' }))
    try {
      const answer = await this.remote.snapshot()
      if (this.disposed || generation !== this.generation) return
      this.setState(answer.ok
        ? Object.freeze({ status: 'ready', snapshot: answer })
        : Object.freeze({ status: 'error', message: answer.message }))
    } catch (error) {
      if (this.disposed || generation !== this.generation) return
      this.setState(Object.freeze({ status: 'error', message: error instanceof Error ? error.message : String(error) }))
    }
  }

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
    this.state = Object.freeze({ status: 'idle' })
  }

  private setState(next: SessionOrganizationControllerState): void {
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }
}

export function createSessionOrganizationController(remote: SessionOrganizationRemoteFace): SessionOrganizationController {
  return new SessionOrganizationController(remote)
}

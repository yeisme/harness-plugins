/**
 * Generation-aware tool-hub catalog controller.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client/controller
 */

import type {
  ToolHubCatalogV1,
  ToolHubRemoteFace,
  ToolHubSetEnabledAnswerV1,
} from './wire.ts'
import { normalizeToolHubClientError, type ToolHubClientErrorCode } from './remote.ts'

export type ToolsHubControllerState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly catalog: ToolHubCatalogV1 }
  | { readonly status: 'unavailable'; readonly message: string; readonly code?: ToolHubClientErrorCode }
  | { readonly status: 'error'; readonly message: string; readonly code?: ToolHubClientErrorCode }

const IDLE: ToolsHubControllerState = Object.freeze({ status: 'idle' })
const LOADING: ToolsHubControllerState = Object.freeze({ status: 'loading' })

export class ToolsHubController {
  private readonly remote: ToolHubRemoteFace
  private state: ToolsHubControllerState = IDLE
  private readonly listeners = new Set<() => void>()
  private generation = 0
  private served = 0
  private readonly waiters: Array<{ readonly generation: number; readonly resolve: () => void }> = []
  private running = false
  private disposed = false
  private pendingId: string | undefined

  constructor(remote: ToolHubRemoteFace) {
    this.remote = remote
  }

  getSnapshot(): ToolsHubControllerState {
    return this.state
  }

  pendingIdSnapshot(): string | undefined {
    return this.pendingId
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async refresh(): Promise<void> {
    if (this.disposed) return
    this.generation += 1
    const generation = this.generation
    if (this.state.status !== 'ready') this.setState(LOADING)
    await new Promise<void>(resolve => {
      this.waiters.push({ generation, resolve })
      void this.pump()
    })
  }

  async setEnabled(id: string, enabled: boolean): Promise<ToolHubSetEnabledAnswerV1> {
    if (this.disposed) return { ok: false, code: 'catalog-unavailable', message: 'disposed' }
    const current = this.state
    if (current.status !== 'ready') return { ok: false, code: 'catalog-unavailable', message: 'catalog not ready' }
    this.pendingId = id
    this.emit()
    try {
      const answer = await this.remote.setEnabled({ id, enabled, ifGeneration: current.catalog.generation })
      if (answer.ok || answer.code === 'generation-conflict') await this.refresh()
      return answer
    } catch (error) {
      const normalized = normalizeToolHubClientError(error)
      return { ok: false, code: 'catalog-unavailable', message: normalized.code }
    } finally {
      this.pendingId = undefined
      this.emit()
    }
  }

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
    for (const waiter of this.waiters) waiter.resolve()
    this.waiters.length = 0
  }

  private async pump(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (this.served < this.generation && !this.disposed) {
        const serving = this.generation
        try {
          const answer = await this.remote.list()
          if (this.disposed || serving !== this.generation) continue
          if (answer.ok) this.setState({ status: 'ready', catalog: answer })
          else this.setState({ status: 'unavailable', message: answer.code, code: answer.code === 'storage-unavailable' ? 'storage_unavailable' : 'catalog_unavailable' })
        } catch (error) {
          if (this.disposed || serving !== this.generation) continue
          const normalized = normalizeToolHubClientError(error)
          this.setState({ status: 'error', message: normalized.code, code: normalized.code })
        } finally {
          this.served = serving
          this.resolveWaiters(serving)
        }
      }
    } finally {
      this.running = false
    }
  }

  private resolveWaiters(served: number): void {
    const pending = this.waiters.splice(0)
    for (const waiter of pending) {
      if (waiter.generation <= served) waiter.resolve()
      else this.waiters.push(waiter)
    }
  }

  private setState(next: ToolsHubControllerState): void {
    this.state = next
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

export function createToolsHubController(remote: ToolHubRemoteFace): ToolsHubController {
  return new ToolsHubController(remote)
}

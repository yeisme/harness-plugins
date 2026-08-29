/**
 * Mutable Tools-hub binding so the conversation view can subscribe after
 * the async `toolHub` Remote probe settles.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client/binding
 */

import type { ToolsHubController } from './controller.ts'

export class ToolsHubBinding {
  private controller: ToolsHubController | undefined
  private readonly listeners = new Set<() => void>()

  getSnapshot(): ToolsHubController | undefined {
    return this.controller
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  attach(controller: ToolsHubController): void {
    this.controller = controller
    for (const listener of this.listeners) listener()
  }

  dispose(): void {
    this.controller?.dispose()
    this.controller = undefined
    this.listeners.clear()
  }
}

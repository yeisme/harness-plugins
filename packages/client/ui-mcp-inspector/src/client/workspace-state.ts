import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolsSection } from './McpInspectorView.tsx'
import type { EnabledFilter, FamilyFilter, PurposeFilter, SourceFilter } from './filter.ts'
import { createToolsHubController, type ToolsHubController, type ToolsHubControllerState } from './controller.ts'
import { reconnectingToolHubRemote } from './remote.ts'
import { sessionCatalogRemote } from './session-catalog.ts'

export interface ToolsSelection {
  query: string; family: FamilyFilter; enabled: EnabledFilter; purpose: PurposeFilter; source: SourceFilter; scope: 'session' | 'installed'; selectedId: string | undefined
  activeSection: ToolsSection
}
/** Presentation only; never stores calls, arguments or tool results. */
export class ToolsViewState {
  private value: ToolsSelection
  private listeners = new Set<() => void>()
  constructor(family: FamilyFilter = 'all', section: ToolsSection = 'catalog') {
    this.value = { query: '', family, enabled: 'all', purpose: 'all', source: 'all', scope: 'session', selectedId: undefined, activeSection: section }
  }
  getSnapshot = (): ToolsSelection => this.value
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  set<K extends keyof ToolsSelection>(key: K, value: ToolsSelection[K] | ((previous: ToolsSelection[K]) => ToolsSelection[K])): void {
    const next = typeof value === 'function' ? (value as (old: ToolsSelection[K]) => ToolsSelection[K])(this.value[key]) : value
    if (next === this.value[key]) return
    this.value = { ...this.value, [key]: next }; for (const listener of this.listeners) listener()
  }
}
interface Resource { readonly state: ToolsViewState; readonly controller: ToolsHubController; refs: number; timer?: ReturnType<typeof setInterval> }
export class SessionToolsWorkspace {
  private readonly resources = new Map<string, Resource>()
  private readonly states = new Map<string, ToolsViewState>()
  private readonly catalogListeners = new Set<(sessionId: string | undefined, state: ToolsHubControllerState) => void>()
  constructor(private readonly ctx: ClientContext) {}
  get(sessionId?: string): Resource {
    const key = sessionId === undefined ? 'global' : `session:${sessionId}`
    let resource = this.resources.get(key)
    if (!resource) {
      const state = this.states.get(key) ?? new ToolsViewState('all', 'catalog')
      this.states.set(key, state)
      resource = { state, refs: 0, controller: createToolsHubController(sessionId ? sessionCatalogRemote(this.ctx, sessionId) : reconnectingToolHubRemote(this.ctx)) }
      this.resources.set(key, resource)
      const current = resource
      current.controller.subscribe(() => {
        for (const listener of this.catalogListeners) {
          try { listener(sessionId, current.controller.getSnapshot()) } catch { /* Observers cannot block the owner controller. */ }
        }
      })
    }
    return resource
  }
  retain(sessionId?: string): () => void {
    const key = sessionId === undefined ? 'global' : `session:${sessionId}`, resource = this.get(sessionId)
    if (resource.refs++ === 0) {
      void resource.controller.refresh()
      resource.timer = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void resource.controller.refresh() }, 30_000)
    }
    return () => { if (--resource.refs === 0) { clearInterval(resource.timer); queueMicrotask(() => { if (resource.refs === 0) { resource.controller.dispose(); if (this.resources.get(key) === resource) this.resources.delete(key) } }) } }
  }
  refreshActive(): void { for (const resource of this.resources.values()) if (resource.refs) void resource.controller.refresh() }
  subscribeCatalog(listener: (sessionId: string | undefined, state: ToolsHubControllerState) => void): () => void {
    this.catalogListeners.add(listener); return () => { this.catalogListeners.delete(listener) }
  }
  dispose(): void { for (const resource of this.resources.values()) { clearInterval(resource.timer); resource.controller.dispose() }; this.resources.clear(); this.states.clear(); this.catalogListeners.clear() }
}

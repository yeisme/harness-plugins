import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ActivityFilter, ActivityMode, ToolsSection } from './McpInspectorView.tsx'
import type { EnabledFilter, FamilyFilter } from './filter.ts'
import { createToolsHubController, type ToolsHubController } from './controller.ts'
import { reconnectingToolHubRemote } from './remote.ts'
import { sessionCatalogRemote } from './session-catalog.ts'

export interface ToolsSelection {
  query: string; family: FamilyFilter; enabled: EnabledFilter; selectedId: string | undefined
  selectedCall: string | undefined; activeSection: ToolsSection; activityMode: ActivityMode; activityFilter: ActivityFilter
}
/** Presentation only; never stores calls, arguments or tool results. */
export class ToolsViewState {
  private value: ToolsSelection
  private listeners = new Set<() => void>()
  constructor(family: FamilyFilter = 'all', section: ToolsSection = 'activity') {
    this.value = { query: '', family, enabled: 'all', selectedId: undefined, selectedCall: undefined, activeSection: section, activityMode: 'list', activityFilter: 'all' }
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
  constructor(private readonly ctx: ClientContext) {}
  get(sessionId?: string): Resource {
    const key = sessionId === undefined ? 'global' : `session:${sessionId}`
    let resource = this.resources.get(key)
    if (!resource) {
      const state = this.states.get(key) ?? new ToolsViewState('all', sessionId ? 'activity' : 'catalog')
      this.states.set(key, state)
      resource = { state, refs: 0, controller: createToolsHubController(sessionId ? sessionCatalogRemote(this.ctx, sessionId) : reconnectingToolHubRemote(this.ctx)) }
      this.resources.set(key, resource)
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
  dispose(): void { for (const resource of this.resources.values()) { clearInterval(resource.timer); resource.controller.dispose() }; this.resources.clear(); this.states.clear() }
}

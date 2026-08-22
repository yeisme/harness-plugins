/** Agent Context controller: snapshot + push, no polling, generation-safe dispose. */

import {
  highlightedSkills,
  projectAgentContext,
  type AgentContextProjectionV1,
  type AgentContextSource,
  type AgentContextTab,
} from './projection.js'

export interface AgentContextEnvironment {
  getSnapshot(): AgentContextSource
  subscribe(listener: () => void): () => void
}

export class AgentContextController {
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribe: () => void
  private tab: AgentContextTab = 'plan'
  private selectedStepId: string | undefined
  private disposed = false
  private cache: { readonly source: AgentContextSource; readonly projection: AgentContextProjectionV1 } | undefined

  constructor(private readonly env: AgentContextEnvironment) {
    this.unsubscribe = env.subscribe(() => this.invalidate())
  }

  getSnapshot(): AgentContextProjectionV1 {
    if (this.disposed) throw new Error('AgentContextController is disposed')
    const source = this.env.getSnapshot()
    if (this.cache !== undefined && this.cache.source === source && this.cache.projection.selectedStepId === this.selectedStepId) {
      return this.cache.projection
    }
    const projection = projectAgentContext(source, this.selectedStepId)
    this.cache = { source, projection }
    return projection
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get currentTab(): AgentContextTab {
    return this.tab
  }

  setTab(tab: AgentContextTab): void {
    if (this.tab === tab || this.disposed) return
    this.tab = tab
    this.emit()
  }

  selectStep(stepId: string | undefined): void {
    if (this.selectedStepId === stepId || this.disposed) return
    this.selectedStepId = stepId
    this.cache = undefined
    this.emit()
  }

  highlightedSkillIds(): ReadonlySet<string> {
    return highlightedSkills(this.getSnapshot())
  }

  switchSession(): void {
    this.selectedStepId = undefined
    this.tab = 'plan'
    this.cache = undefined
    this.emit()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribe()
    this.listeners.clear()
    this.cache = undefined
  }

  private invalidate(): void {
    this.cache = undefined
    this.emit()
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

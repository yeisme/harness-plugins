/**
 * Agent-first project context contracts.
 *
 * This state is presentation continuity only. It does not own Ordo tasks,
 * runs, approvals, artifacts, or domain documents.
 */

export const WORKBENCH_CONTEXTS = [
  'writing',
  'storyboard',
  'production',
  'review',
  'three-d',
  'assets',
  'delivery',
] as const
export type WorkbenchContextId = (typeof WORKBENCH_CONTEXTS)[number]

export const AGENT_ROLES = ['director', 'writer', 'producer', 'modeler', 'reviewer'] as const
export type AgentRoleId = (typeof AGENT_ROLES)[number]

export type WorkbenchFreshness = 'fresh' | 'stale' | 'unknown'

export interface WorkbenchProjectContextV1 {
  readonly projectRef: string
  readonly context: WorkbenchContextId
  readonly agentRole: AgentRoleId
  readonly selectedRef?: string
  readonly pendingAction?: string
  readonly freshness: WorkbenchFreshness
  readonly generation: number
}

export interface WorkbenchContextStorage {
  read(projectRef: string): WorkbenchProjectContextV1 | undefined
  write(projectRef: string, value: WorkbenchProjectContextV1): void
}

export interface WorkbenchContextControllerOptions {
  readonly projectRef: string
  readonly storage?: WorkbenchContextStorage
  readonly initial?: Partial<Omit<WorkbenchProjectContextV1, 'projectRef' | 'generation'>>
}

type WorkbenchContextPatch = Omit<Partial<WorkbenchProjectContextV1>, 'selectedRef' | 'pendingAction'> & {
  readonly selectedRef?: string | undefined
  readonly pendingAction?: string | undefined
}

const SAFE_REF = /^[a-z0-9][a-z0-9._:/-]{0,159}$/i

function safeRef(value: string): string {
  if (!SAFE_REF.test(value)) throw new TypeError(`Invalid project reference: ${value}`)
  return value
}

function contextOf(value: unknown): WorkbenchContextId {
  return (WORKBENCH_CONTEXTS as readonly unknown[]).includes(value) ? value as WorkbenchContextId : 'writing'
}

function roleOf(value: unknown): AgentRoleId {
  return (AGENT_ROLES as readonly unknown[]).includes(value) ? value as AgentRoleId : 'director'
}

function normalize(projectRef: string, input: WorkbenchContextPatch | undefined, generation: number): WorkbenchProjectContextV1 {
  return {
    projectRef,
    context: contextOf(input?.context),
    agentRole: roleOf(input?.agentRole),
    ...(typeof input?.selectedRef === 'string' && input.selectedRef.length <= 240 ? { selectedRef: input.selectedRef } : {}),
    ...(typeof input?.pendingAction === 'string' && input.pendingAction.length <= 240 ? { pendingAction: input.pendingAction } : {}),
    freshness: input?.freshness === 'fresh' || input?.freshness === 'stale' ? input.freshness : 'unknown',
    generation,
  }
}

export class WorkbenchContextController {
  private readonly listeners = new Set<() => void>()
  private readonly storage: WorkbenchContextStorage | undefined
  private snapshot: WorkbenchProjectContextV1
  private disposed = false

  constructor(options: WorkbenchContextControllerOptions) {
    const projectRef = safeRef(options.projectRef)
    this.storage = options.storage
    const stored = options.storage?.read(projectRef)
    this.snapshot = normalize(projectRef, stored ?? options.initial, 1)
  }

  getSnapshot(): WorkbenchProjectContextV1 {
    if (this.disposed) throw new Error('WorkbenchContextController is disposed')
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setContext(context: WorkbenchContextId): void {
    this.update({ context })
  }

  setAgentRole(agentRole: AgentRoleId): void {
    this.update({ agentRole })
  }

  setSelectedRef(selectedRef: string | undefined): void {
    this.update({ selectedRef })
  }

  setPendingAction(pendingAction: string | undefined): void {
    this.update({ pendingAction })
  }

  markFreshness(freshness: WorkbenchFreshness): void {
    this.update({ freshness })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.listeners.clear()
  }

  private update(patch: WorkbenchContextPatch): void {
    if (this.disposed) return
    this.snapshot = normalize(this.snapshot.projectRef, { ...this.snapshot, ...patch }, this.snapshot.generation + 1)
    this.storage?.write(this.snapshot.projectRef, this.snapshot)
    for (const listener of [...this.listeners]) listener()
  }
}

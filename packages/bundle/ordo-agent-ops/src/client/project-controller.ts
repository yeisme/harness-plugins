import { ProjectDraftSchema, ProjectEventsSchema, ProjectReceiptSchema, ProjectSnapshotSchema, type ProjectRemote, type ProjectSnapshot, type ProjectReceipt, type ProjectRequest } from '../project-contract.ts'

export interface ProjectViewState {
  projectRef: string; snapshot?: ProjectSnapshot; phase: 'loading' | 'ready' | 'offline';
  busy: boolean; receipt?: ProjectReceipt; error?: string | undefined;
}
/** Each controller is permanently bound to one project; no global current selection. */
export class ProjectController {
  private listeners = new Set<() => void>()
  private generation = 0
  private disposed = false
  private loading: Promise<void> | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: ProjectRequest | undefined
  private state: ProjectViewState
  constructor(private readonly remote: ProjectRemote, readonly projectRef: string) { this.state = { projectRef, phase: 'loading', busy: false } }
  getSnapshot = (): ProjectViewState => this.state
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(next: Partial<ProjectViewState>) {
    if (this.disposed) return
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener()
  }
  load(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    if (this.loading) return this.loading
    const generation = this.generation
    const operation: Promise<void> = this.remote.projectSnapshot(this.projectRef).then(raw => {
      if (this.disposed || generation !== this.generation) return
      const snapshot = ProjectSnapshotSchema.parse(raw)
      if (snapshot.projectRef !== this.projectRef) throw new Error('project_mismatch')
      this.update({ snapshot, phase: 'ready', error: this.pending ? 'action_result_unknown' : undefined })
    }).catch(() => { if (generation === this.generation) this.update({ phase: 'offline', error: 'owner_unavailable' }) }).finally(() => { if (this.loading === operation) this.loading = undefined })
    this.loading = operation
    return operation
  }
  reset() {
    if (this.disposed) return
    this.generation++; this.loading = undefined
    this.update({ phase: 'offline', busy: false, error: this.pending ? 'action_result_unknown' : 'owner_unavailable' })
    void this.load()
  }
  async poll(): Promise<void> {
    if (this.disposed) return
    if (!this.state.snapshot || this.state.phase === 'offline') { await this.load(); return }
    const generation = this.generation
    try {
      const page = ProjectEventsSchema.parse(await this.remote.projectEvents(this.projectRef, this.state.snapshot.version))
      if (this.disposed || generation !== this.generation) return
      if (page.projectRef !== this.projectRef) throw new Error('project_mismatch')
      if (page.refetch || page.cursor !== this.state.snapshot?.version) await this.load()
    } catch { if (generation === this.generation) this.update({ phase: 'offline', error: 'event_source_unavailable' }) }
  }
  start() {
    if (this.timer || this.disposed) return
    const tick = async (): Promise<void> => { await this.poll(); if (!this.disposed) this.timer = setTimeout(tick, 2_000) }
    this.timer = setTimeout(tick, 2_000)
    void this.load()
  }
  async draft(targetRef: string) {
    if (!this.remote.projectDraft) throw new Error('plan_edit_unavailable')
    return ProjectDraftSchema.parse(await this.remote.projectDraft(this.projectRef, targetRef))
  }
  async invoke(action: string, targetRef: string, confirmed: boolean, payload: ProjectRequest['payload'] = {}): Promise<void> {
    const snapshot = this.state.snapshot
    if (this.disposed || this.state.busy || this.state.phase !== 'ready' || !snapshot || snapshot.freshness !== 'fresh' || this.pending) return
    const descriptor = snapshot.actions.find(value => value.id === action && value.targetRef === targetRef)
    if (!descriptor || descriptor.disabledReason || (descriptor.confirmation && !confirmed)) return
    this.pending = { projectRef: this.projectRef, expectedVersion: snapshot.version, requestId: crypto.randomUUID(), action, targetRef, confirmed, payload }
    await this.settlePending()
  }
  /** Same exact request asks for its receipt; the owner never dispatches it twice. */
  async reconcilePending(): Promise<void> {
    if (this.state.busy || !this.pending) return
    if (this.remote.projectSettlement) await this.reconcileReceipt(this.pending.requestId)
    else await this.settlePending()
  }
  async reconcileReceipt(requestId: string): Promise<void> {
    if (this.disposed || this.state.busy || !this.remote.projectSettlement) return
    this.update({ busy: true })
    try {
      const receipt = ProjectReceiptSchema.parse(await this.remote.projectSettlement(this.projectRef, requestId))
      if (receipt.projectRef !== this.projectRef || receipt.requestId !== requestId) throw new Error('receipt_mismatch')
      if (this.pending?.requestId === requestId && receipt.state !== 'unknown') this.pending = undefined
      this.update({ receipt })
    } catch { this.update({ error: 'action_result_unknown' }) }
    finally { this.update({ busy: false }); await this.load() }
  }
  private async settlePending() {
    const request = this.pending!
    const generation = this.generation
    this.update({ busy: true, error: undefined })
    try {
      const receipt = ProjectReceiptSchema.parse(await this.remote.projectInvoke(request))
      if (this.disposed || generation !== this.generation) return
      if (receipt.projectRef !== this.projectRef || receipt.requestId !== request.requestId || receipt.action !== request.action || receipt.targetRef !== request.targetRef) throw new Error('receipt_mismatch')
      if (receipt.state !== 'unknown') this.pending = undefined
      this.update({ receipt })
    } catch { this.update({ error: 'action_result_unknown' }) }
    finally { if (generation === this.generation) { this.update({ busy: false }); await this.load() } }
  }
  dispose() { this.disposed = true; this.generation++; if (this.timer) clearTimeout(this.timer); this.listeners.clear() }
}

import { eikonaDraftSchema, type EikonaDraft, type EikonaDraftQuery, type EikonaDraftReadResult, type EikonaDraftSave, type EikonaDraftReconcile, type EikonaDraftSaveResult } from '@yeisme/dsh-creator-studio-host/contracts'

export interface EikonaDraftRuntime {
  readEikonaDraft(input: EikonaDraftQuery): Promise<EikonaDraftReadResult>
  saveEikonaDraft(input: EikonaDraftSave): Promise<EikonaDraftSaveResult>
  reconcileEikonaDraft(input: EikonaDraftReconcile): Promise<EikonaDraftSaveResult>
}
export type EikonaDraftSessionState = {
  phase: 'loading' | 'ready' | 'saving' | 'unknown' | 'conflict' | 'error'
  draft?: EikonaDraft
  dirty: boolean
}

/** Per-mounted-form coordination only; canonical revision remains in Host. */
export class EikonaDraftSession {
  private state: EikonaDraftSessionState = { phase: 'loading', dirty: false }
  private pending: EikonaDraftSave | undefined
  private disposed = false
  private reading = false
  private loading: Promise<void> | undefined
  private reconciling = false
  constructor(private runtime: EikonaDraftRuntime, private initial: EikonaDraft, private requestId: () => string) {
    this.initial = eikonaDraftSchema.parse(initial)
  }
  snapshot(): EikonaDraftSessionState { return structuredClone(this.state) }
  private query(): EikonaDraftQuery { return { scope: this.initial.scope, id: this.initial.id } }
  load(): Promise<void> {
    if (this.loading) return this.loading
    this.loading = this.loadOnce().finally(() => { this.loading = undefined })
    return this.loading
  }
  private async loadOnce(): Promise<void> {
    if (this.disposed || this.reading || this.state.draft !== undefined) return
    this.reading = true
    this.state = { phase: 'loading', dirty: false }
    try {
      const result = await this.runtime.readEikonaDraft(this.query())
      if (this.disposed) return
      if (result.status === 'missing') this.state = { phase: 'ready', draft: structuredClone(this.initial), dirty: false }
      else if (result.status === 'ready' && result.draft.id === this.initial.id && JSON.stringify(result.draft.scope) === JSON.stringify(this.initial.scope)) {
        this.state = { phase: 'ready', draft: eikonaDraftSchema.parse(result.draft), dirty: false }
      } else this.state = { phase: 'error', dirty: false }
    } catch { if (!this.disposed) this.state = { phase: 'error', dirty: false } }
    finally { this.reading = false }
  }
  edit(fields: EikonaDraft['fields'], checkpoint?: EikonaDraft['checkpoint']): boolean {
    if (this.disposed || this.state.phase !== 'ready' || !this.state.draft) return false
    const parsed = eikonaDraftSchema.safeParse({ ...this.state.draft, fields, checkpoint: checkpoint ?? this.state.draft.checkpoint })
    if (!parsed.success) return false
    this.state = { phase: 'ready', draft: parsed.data, dirty: true }
    return true
  }
  async save(): Promise<void> {
    if (this.disposed || this.state.phase !== 'ready' || !this.state.draft || !this.state.dirty) return
    this.pending = { requestId: this.requestId(), draft: structuredClone(this.state.draft) }
    this.state = { ...this.state, phase: 'saving' }
    try { this.accept(await this.runtime.saveEikonaDraft(this.pending)) }
    catch { if (!this.disposed) this.state = { ...this.state, phase: 'unknown' } }
  }
  private accept(result: EikonaDraftSaveResult) {
    if (this.disposed || !this.pending) return
    if (result.status === 'saved' && result.requestId === this.pending.requestId && result.revision === this.pending.draft.revision + 1) {
      this.state = { phase: 'ready', draft: { ...this.pending.draft, revision: result.revision }, dirty: false }
      this.pending = undefined
    } else this.state = { ...this.state, phase: result.status === 'conflict' ? 'conflict' : 'unknown', dirty: true }
  }
  async reconcile(): Promise<void> {
    if (this.disposed || this.state.phase !== 'unknown' || !this.pending || this.reconciling) return
    this.reconciling = true
    try { this.accept(await this.runtime.reconcileEikonaDraft({ ...this.query(), requestId: this.pending.requestId })) }
    catch { /* Keep the exact pending input and its uncertain save identity. */ }
    finally { this.reconciling = false }
  }
  dispose() { this.disposed = true }
}

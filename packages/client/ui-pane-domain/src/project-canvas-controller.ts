import {
  PROJECT_CANVAS_SCHEMA, ProjectCanvasReadResultSchema, ProjectCanvasSaveResultSchema,
  type ProjectCanvasReadRequest, type ProjectCanvasSaveRequest, type ProjectCanvasDocument,
} from '@yeisme/dsh-pane-protocol'
import { acknowledgeProjectCanvasSave, createProjectCanvasEditor, editProjectCanvas, type ProjectCanvasEdit, type ProjectCanvasEditor } from './project-canvas.js'

export interface ProjectCanvasRemote {
  canvasRead(input: ProjectCanvasReadRequest): Promise<unknown>
  canvasSave(input: ProjectCanvasSaveRequest): Promise<unknown>
  canvasReconcile(input: ProjectCanvasReadRequest & { requestId: string }): Promise<unknown>
}
export interface CanvasViewState {
  readonly status: 'loading' | 'ready' | 'missing' | 'unavailable' | 'forbidden' | 'invalid' | 'error'
  readonly saveStatus: 'clean' | 'dirty' | 'saving' | 'unknown' | 'conflict' | 'error'
  readonly dirty: boolean
  readonly editor?: ProjectCanvasEditor
  /** The owner-confirmed revision a conflicting writer committed; set only while saveStatus is conflict. */
  readonly conflictRevision?: number
}

/** One controller per project/document. React mount/unmount does not cancel owner work or discard drafts. */
export class ProjectCanvasController {
  private state: CanvasViewState = { status: 'loading', saveStatus: 'clean', dirty: false }
  private listeners = new Set<() => void>()
  private generation = 0
  private disposed = false
  private pending: { request: ProjectCanvasSaveRequest; editVersion: number } | undefined
  private gesture: ProjectCanvasEditor | undefined
  constructor(private readonly remote: ProjectCanvasRemote, readonly target: ProjectCanvasReadRequest,
    private readonly newId: () => string = () => `save-${crypto.randomUUID()}`) {}

  getSnapshot = (): CanvasViewState => this.state
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(state: CanvasViewState): void {
    if (this.disposed) return
    this.state = state
    for (const listener of this.listeners) listener()
  }

  async load(discardDraft = false): Promise<void> {
    if (this.disposed || this.pending !== undefined || (this.state.dirty && !discardDraft)) return
    this.gesture = undefined
    const generation = ++this.generation
    this.publish({ ...this.state, status: 'loading' })
    try {
      const result = ProjectCanvasReadResultSchema.parse(await this.remote.canvasRead(this.target))
      if (generation !== this.generation || this.disposed) return
      if (result.status !== 'ready' && result.status !== 'missing') {
        this.publish({ ...this.state, status: result.status, dirty: false, saveStatus: 'clean' }); return
      }
      const confirmed = result.status === 'ready' ? result.document : undefined
      if (confirmed !== undefined && (confirmed.id !== this.target.documentId
        || confirmed.scope.workspaceRef !== this.target.scope.workspaceRef || confirmed.scope.projectRef !== this.target.scope.projectRef)) {
        this.publish({ ...this.state, status: 'invalid' }); return
      }
      // A previous session left a journaled save whose commit never settled; reconcile it before showing anything.
      const draft = result.draft !== undefined && result.draft.baseRevision === (confirmed?.revision ?? 0) ? result.draft : undefined
      if (result.draft !== undefined && draft !== undefined) {
        let settled: 'saved' | 'not_applied' | 'unsettled' = 'unsettled'
        try {
          const raw = ProjectCanvasSaveResultSchema.safeParse(await this.remote.canvasReconcile({ ...this.target, requestId: result.draft.requestId }))
          if (generation !== this.generation || this.disposed) return
          if (raw.success && raw.data.status === 'saved') settled = 'saved'
          else if (raw.success && raw.data.status === 'not_applied') settled = 'not_applied'
        } catch { /* the journal stays; this session starts from confirmed facts only */ }
        if (settled === 'not_applied') {
          // The submitted draft never landed and the owner document did not move: recover the unsaved edits.
          this.publish({ status: 'ready', editor: createProjectCanvasEditor(draft.document), dirty: true, saveStatus: 'dirty' })
          return
        }
      }
      if (confirmed === undefined) this.publish({ status: 'missing', dirty: false, saveStatus: 'clean' })
      else this.publish({ status: 'ready', editor: createProjectCanvasEditor(confirmed), dirty: false, saveStatus: 'clean' })
    } catch {
      if (generation === this.generation) this.publish({ ...this.state, status: 'error' })
    }
  }

  createDraft(): void {
    if (this.state.status !== 'missing' || this.disposed) return
    const document: ProjectCanvasDocument = { schema: PROJECT_CANVAS_SCHEMA, id: this.target.documentId,
      scope: this.target.scope, revision: 0, camera: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] }
    this.publish({ status: 'ready', editor: createProjectCanvasEditor(document), dirty: true, saveStatus: 'dirty' })
  }

  beginGesture(): void { this.gesture = this.state.editor }
  endGesture(): void { this.gesture = undefined }

  edit(edit: ProjectCanvasEdit): boolean {
    const editor = this.state.editor
    if (editor === undefined || this.state.status !== 'ready' || this.disposed) return false
    const result = editProjectCanvas(editor, { ...this.target.scope, documentId: this.target.documentId }, editor.editVersion, edit)
    if (!result.ok) return false
    const changed = result.editor.document !== editor.document
    const next = changed && this.gesture !== undefined
      ? Object.freeze({ ...result.editor, past: Object.freeze([...this.gesture.past, this.gesture.document].slice(-50)) })
      : result.editor
    this.publish({ ...this.state, editor: next, dirty: this.state.dirty || changed,
      saveStatus: this.pending !== undefined ? this.state.saveStatus : changed ? 'dirty' : this.state.saveStatus })
    return true
  }

  async save(): Promise<void> {
    const editor = this.state.editor
    if (!this.state.dirty || editor === undefined || this.pending !== undefined || this.disposed) return
    const pending = { request: { requestId: this.newId(), document: editor.document }, editVersion: editor.editVersion }
    this.pending = pending
    this.publish({ ...this.state, saveStatus: 'saving' })
    try { this.acceptResult(await this.remote.canvasSave(pending.request), pending) }
    catch { if (this.pending === pending) this.publish({ ...this.state, saveStatus: 'unknown' }) }
  }

  async reconcile(): Promise<void> {
    const pending = this.pending
    if (pending === undefined || this.state.saveStatus === 'saving' || this.disposed) return
    this.publish({ ...this.state, saveStatus: 'saving' })
    try { this.acceptResult(await this.remote.canvasReconcile({ ...this.target, requestId: pending.request.requestId }), pending, true) }
    catch { this.publish({ ...this.state, saveStatus: 'unknown' }) }
  }

  private acceptResult(raw: unknown, pending: NonNullable<ProjectCanvasController['pending']>, reconciling = false): void {
    if (this.disposed || this.pending !== pending) return
    const result = ProjectCanvasSaveResultSchema.safeParse(raw)
    if (!result.success) { this.publish({ ...this.state, saveStatus: 'unknown' }); return }
    if (result.data.status === 'not_applied') {
      // The journaled commit never landed: local edits stay unconfirmed and retryable under a fresh request id.
      this.pending = undefined
      this.publish({ ...this.state, saveStatus: 'dirty' })
      return
    }
    if (result.data.status === 'saved') {
      const editor = this.state.editor!
      if (result.data.requestId !== pending.request.requestId || result.data.revision !== pending.request.document.revision + 1
        || editor.document.revision !== pending.request.document.revision) {
        this.publish({ ...this.state, saveStatus: 'unknown' }); return
      }
      const dirty = editor.document !== pending.request.document
      this.pending = undefined
      if (this.gesture !== undefined) this.gesture = acknowledgeProjectCanvasSave(this.gesture, result.data.revision)
      this.publish({ ...this.state, editor: acknowledgeProjectCanvasSave(editor, result.data.revision), dirty, saveStatus: dirty ? 'dirty' : 'clean' })
    } else if (result.data.status === 'unknown' || reconciling) this.publish({ ...this.state, saveStatus: 'unknown' })
    else {
      this.pending = undefined
      this.publish({ ...this.state, saveStatus: result.data.status === 'conflict' ? 'conflict' : 'error',
        conflictRevision: result.data.status === 'conflict' ? result.data.revision : undefined })
    }
  }

  /** Conflict resolution keeps the local draft by default: reapply rebases it onto the owner-confirmed revision, discard reloads. */
  resolveConflict(action: 'reapply' | 'discard'): void {
    if (this.disposed || this.state.saveStatus !== 'conflict') return
    if (action === 'discard') { void this.load(true); return }
    const editor = this.state.editor
    const base = this.state.conflictRevision
    if (editor === undefined || base === undefined) return
    this.publish({ ...this.state, editor: { ...editor, document: { ...editor.document, revision: base } },
      dirty: true, saveStatus: 'dirty', conflictRevision: undefined })
  }

  dispose(): void { this.disposed = true; this.generation++; this.listeners.clear() }
}

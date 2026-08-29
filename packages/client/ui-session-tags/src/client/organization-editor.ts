/** Observable quick editor for one Session organization assignment. */

import type { SessionOrganizationController } from './organization-controller.ts'
import type { FunctionTypeV1, SessionOrganizationRemoteFace } from './organization-wire.ts'

export type OrganizationEditorState =
  | { readonly open: false }
  | {
      readonly open: true
      readonly sessionId: string
      readonly workspaceRef: string
      readonly functionTypeId: string
      readonly functions: readonly FunctionTypeV1[]
      readonly phase: 'editing' | 'saving' | 'error'
      readonly message?: string | undefined
    }

export class OrganizationEditorController {
  private state: OrganizationEditorState = Object.freeze({ open: false })
  private readonly listeners = new Set<() => void>()
  private restoreFocusTo: HTMLElement | null = null

  constructor(
    private readonly remote: SessionOrganizationRemoteFace,
    private readonly organization: SessionOrganizationController,
  ) {}

  getSnapshot(): OrganizationEditorState { return this.state }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }

  open(sessionId: string, trigger?: HTMLElement | null): void {
    const current = this.organization.getSnapshot()
    if (current.status !== 'ready') return
    const assignment = current.snapshot.assignments.find(item => item.sessionId === sessionId)
    if (assignment === undefined) return
    const functions = current.snapshot.functionTypes.filter(item => item.active && (item.scope.kind === 'global' || item.scope.workspaceRef === assignment.workspaceRef))
    this.restoreFocusTo = trigger ?? (typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
    this.state = Object.freeze({
      open: true,
      sessionId,
      workspaceRef: assignment.workspaceRef,
      functionTypeId: assignment.functionTypeId ?? functions[0]?.id ?? '',
      functions: Object.freeze(functions),
      phase: 'editing',
    })
    this.emit()
  }

  select(functionTypeId: string): void {
    if (!this.state.open || this.state.phase === 'saving') return
    this.state = Object.freeze({ ...this.state, functionTypeId, phase: 'editing' })
    this.emit()
  }

  async save(): Promise<void> {
    if (!this.state.open || this.state.phase === 'saving' || this.state.functionTypeId === '') return
    const openState = this.state
    const before = this.organization.getSnapshot()
    const assignment = before.status === 'ready' ? before.snapshot.assignments.find(item => item.sessionId === openState.sessionId) : undefined
    if (assignment === undefined) return
    const saving = Object.freeze({ ...openState, phase: 'saving' as const })
    this.state = saving
    this.emit()
    const result = await this.remote.setAssignment({
      sessionId: assignment.sessionId,
      workspaceRef: assignment.workspaceRef,
      functionTypeId: saving.functionTypeId,
      functionLocked: true,
      tagsLocked: assignment.tagsLocked,
      ifVersion: assignment.version,
    })
    if (!result.ok) {
      this.state = Object.freeze({ ...saving, phase: 'error', message: result.message })
      this.emit()
      return
    }
    await this.organization.refresh()
    this.state = Object.freeze({ ...saving, phase: 'editing' })
    this.close()
  }

  close(): void {
    if (!this.state.open || this.state.phase === 'saving') return
    this.state = Object.freeze({ open: false })
    this.emit()
    this.restoreFocusTo?.focus()
    this.restoreFocusTo = null
  }

  private emit(): void { for (const listener of [...this.listeners]) listener() }
}

/**
 * Guided-compile pane controller (task 3.2): the state machine behind the
 * 引导编译 pane — contract form (fields {value, kind, confirmed} wire shape),
 * the explicit confirmation gate (decision_ref composed ONLY from the user
 * action, never auto), the result card (provider_calls = 0), and export with
 * digest-stale gating surfaced.
 *
 * The registry session stays in the owner's store; this controller only
 * sequences host RPCs and folds their safe projections. Compile performs zero
 * model calls — the host fails closed unless the owner answers
 * provider_calls = 0, and this pane surfaces that contract on the result card.
 *
 * @module @yeisme/dsh-client-ui-template-registry/compile-controller
 */

import { canCompile } from '@yeisme/dsh-template-registry'
import type {
  RegistryCompileResult,
  RegistryExportReceipt,
  RegistrySessionCreateInput,
  TemplateInspection,
  TemplateSession,
  TemplateSessionFailure,
  TemplateSessionOutcome,
} from '@yeisme/dsh-template-registry'
import type { TemplateRegistryHostFace } from './seam.js'

export type TemplateCompilePhase = 'empty' | 'loading' | 'form' | 'compiled' | 'exported' | 'error'

export type TemplateCompileBusy = 'inspect' | 'create' | 'update' | 'confirm' | 'compile' | 'export' | null

export interface TemplateCompileErrorState {
  /** Stable code: host guard code, owner error code, or seam fold. */
  readonly code: string
  readonly detail?: string
  readonly missing?: readonly string[]
}

export interface TemplateCompileState {
  readonly phase: TemplateCompilePhase
  readonly pinnedRef?: string | undefined
  readonly pinnedDigest?: string | undefined
  readonly inspection?: TemplateInspection | undefined
  /** Latest known template digest (from the freshness re-inspect). */
  readonly currentDigest?: string | undefined
  readonly goal: string
  readonly fields: Readonly<Record<string, string>>
  readonly session?: TemplateSession | undefined
  readonly compile?: { readonly compileId: string; readonly digest: string } | undefined
  readonly exportReceipt?: RegistryExportReceipt | undefined
  /** Digest drift detected: export stays disabled until an explicit re-pin. */
  readonly stale: boolean
  readonly busy: TemplateCompileBusy
  readonly error?: TemplateCompileErrorState | undefined
}

export type TemplateCompileListener = (state: TemplateCompileState) => void

export function createTemplateCompileState(): TemplateCompileState {
  return { phase: 'empty', goal: '', fields: {}, stale: false, busy: null }
}

/**
 * The decision-ref scheme for the pane's confirmation gate. Deterministic,
 * names the exact session and revision being confirmed, and is only ever
 * submitted by the explicit confirm action — the pane never self-approves.
 */
export function composeConfirmDecisionRef(sessionId: string, revision: number): string {
  return `dsh.template-registry.confirm.v1:${sessionId}:${revision}`
}

/** Required contract inputs that still have an empty pane draft (readable missing list). */
export function missingRequiredFields(inspection: TemplateInspection | undefined, fields: Readonly<Record<string, string>>): string[] {
  if (inspection === undefined) return []
  return inspection.contract.inputs
    .filter(input => input.required && (fields[input.name] ?? '').trim() === '')
    .map(input => input.name)
}

/** Pane-side arming fold: explicit confirmation + all required drafts non-empty + armed status. */
export function isCompileArmed(state: TemplateCompileState): boolean {
  if (state.session === undefined) return false
  if (state.busy !== null) return false
  if (!state.session.confirmed) return false
  if (missingRequiredFields(state.inspection, state.fields).length > 0) return false
  return canCompile(state.session, requiredFieldNames(state))
}

function requiredFieldNames(state: TemplateCompileState): string[] {
  return (state.inspection?.contract.inputs ?? []).filter(input => input.required).map(input => input.name)
}

/** Owner-relative export name suggestion derived from the pinned ref (never a path). */
export function suggestExportName(ref: string): string {
  const tail = ref.split('/').pop() ?? ref
  const safe = tail.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return safe === '' ? 'compiled-prompt-package' : safe
}

export function foldSessionFailure(failure: TemplateSessionFailure): TemplateCompileErrorState {
  if (failure.kind === 'guard') {
    return { code: failure.code, detail: failure.detail, ...(failure.missing === undefined ? {} : { missing: [...failure.missing] }) }
  }
  if (failure.kind === 'revision_conflict') return { code: 'revision_conflict' }
  if (failure.kind === 'disconnected') return { code: 'disconnected', detail: 'the template-registry MCP seam is not connected' }
  if (failure.kind === 'registry_error') return { code: failure.code }
  return { code: 'contract_mismatch' }
}

export interface TemplateCompileController {
  snapshot(): TemplateCompileState
  subscribe(listener: TemplateCompileListener): () => void
  pinTemplate(ref: string): Promise<void>
  setGoal(goal: string): void
  setField(name: string, value: string): void
  startSession(locale?: string): Promise<void>
  submitFields(): Promise<void>
  confirm(): Promise<void>
  compile(): Promise<void>
  export(output: string): Promise<void>
  checkFreshness(): Promise<void>
  /** Explicit reset (owner re-pin): unlocks stale/overlay states back to the form. */
  reset(): void
  dispose(): void
}

export function createTemplateCompileController(host: TemplateRegistryHostFace): TemplateCompileController {
  let state: TemplateCompileState = createTemplateCompileState()
  const listeners = new Set<TemplateCompileListener>()
  let disposed = false

  const emit = (): void => {
    for (const listener of [...listeners]) listener(state)
  }

  const update = (patch: Partial<TemplateCompileState>): void => {
    const next = { ...state, ...patch }
    if (Object.is(next, state)) return
    state = next
    emit()
  }

  const sessionContext = (): { ref: string; digest: string; contractDigest?: string; fields?: Record<string, unknown>; decisionRef?: string } => {
    const ref = state.pinnedRef ?? state.session?.ref ?? ''
    const digest = state.pinnedDigest ?? state.session?.digest ?? ''
    return {
      ref,
      digest,
      ...(state.inspection === undefined ? {} : { contractDigest: state.inspection.contract.digest }),
      ...(state.session === undefined ? {} : { fields: { ...state.session.fields } }),
      ...(state.session?.decisionRef === undefined ? {} : { decisionRef: state.session.decisionRef }),
    }
  }

  const settleOutcome = <T>(outcome: TemplateSessionOutcome<T>, onValue: (value: T) => Partial<TemplateCompileState>): void => {
    if (outcome.ok) {
      update({ busy: null, error: undefined, ...onValue(outcome.value) })
      return
    }
    // A CAS conflict folds the re-read latest session first (owner re-derive,
    // never overwrite, never retry the write).
    const conflictLatest = outcome.failure.kind === 'revision_conflict' ? outcome.failure.latest : undefined
    update({
      busy: null,
      error: foldSessionFailure(outcome.failure),
      ...(conflictLatest === undefined ? {} : { session: conflictLatest }),
    })
  }

  const controller: TemplateCompileController = {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    async pinTemplate(ref) {
      update({
        phase: 'loading',
        pinnedRef: ref,
        pinnedDigest: undefined,
        inspection: undefined,
        currentDigest: undefined,
        session: undefined,
        compile: undefined,
        exportReceipt: undefined,
        stale: false,
        busy: 'inspect',
        error: undefined,
        fields: {},
      })
      const outcome = await host.inspect(ref)
      if (disposed || state.pinnedRef !== ref) return
      if (outcome.ok) {
        update({
          phase: 'form',
          busy: null,
          inspection: outcome.inspection,
          pinnedDigest: outcome.inspection.template.digest,
          currentDigest: outcome.inspection.template.digest,
        })
        return
      }
      const code = outcome.failure.kind === 'not_found' ? 'not_found'
        : outcome.failure.kind === 'degraded' ? 'degraded'
          : outcome.failure.kind === 'registry_error' ? outcome.failure.code : 'contract_mismatch'
      update({ phase: 'error', busy: null, error: { code } })
    },

    setGoal(goal) {
      update({ goal, error: undefined })
    },

    setField(name, value) {
      update({ fields: { ...state.fields, [name]: value }, error: undefined })
    },

    async startSession(locale) {
      if (state.busy !== null || state.pinnedRef === undefined || state.inspection === undefined) return
      if (state.goal.trim() === '') {
        update({ error: { code: 'invalid_input', detail: 'goal is required' } })
        return
      }
      update({ busy: 'create' })
      const input: RegistrySessionCreateInput = { goal: state.goal.trim(), ref: state.pinnedRef, ...(locale === undefined ? {} : { locale }) }
      const outcome = await host.createSession(input, { ref: state.pinnedRef, digest: state.pinnedDigest ?? '', contractDigest: state.inspection.contract.digest })
      if (disposed) return
      settleOutcome(outcome, session => ({ session }))
    },

    async submitFields() {
      if (state.busy !== null || state.session === undefined) return
      const drafts = Object.fromEntries(Object.entries(state.fields).filter(([, value]) => value !== ''))
      if (Object.keys(drafts).length === 0) {
        update({ error: { code: 'invalid_input', detail: 'no fields to update' } })
        return
      }
      update({ busy: 'update' })
      // Wire shape {value, kind, confirmed} is built host-side; the pane only
      // supplies user values that are NOT yet confirmed (approval is the gate).
      const outcome = await host.updateSession(
        { sessionId: state.session.id, expectedRevision: state.session.revision, fields: Object.fromEntries(Object.entries(drafts).map(([name, value]) => [name, { value }])) },
        sessionContext(),
      )
      if (disposed) return
      settleOutcome(outcome, session => ({ session }))
    },

    async confirm() {
      if (state.busy !== null || state.session === undefined) return
      update({ busy: 'confirm' })
      // The decision ref is composed HERE — the explicit user action — and
      // passed through; it is never defaulted, cached, or re-derived silently.
      const decisionRef = composeConfirmDecisionRef(state.session.id, state.session.revision)
      const fieldNames = Object.keys(state.fields).filter(name => state.fields[name] !== '')
      const outcome = await host.confirmSession(
        { sessionId: state.session.id, expectedRevision: state.session.revision, decisionRef, goal: true, fields: fieldNames },
        sessionContext(),
      )
      if (disposed) return
      settleOutcome(outcome, session => ({ session }))
    },

    async compile() {
      if (state.busy !== null || state.session === undefined) return
      update({ busy: 'compile' })
      const outcome = await host.compileSession(
        { sessionId: state.session.id, expectedRevision: state.session.revision },
        { session: state.session, required: requiredFieldNames(state) },
        sessionContext(),
      )
      if (disposed) return
      settleOutcome(outcome, (value: RegistryCompileResult) => ({
        session: value.session,
        compile: { compileId: value.compileId, digest: value.digest },
        phase: 'compiled',
      }))
    },

    async export(output) {
      if (state.busy !== null || state.compile === undefined || state.session === undefined) return
      if (output.trim() === '') {
        update({ error: { code: 'invalid_input', detail: 'an export name is required' } })
        return
      }
      update({ busy: 'export' })
      const outcome = await host.exportSession(
        { compileId: state.compile.compileId, output: output.trim() },
        { session: state.session, ...(state.currentDigest === undefined ? {} : { currentDigest: state.currentDigest }) },
      )
      if (disposed) return
      if (outcome.ok) {
        update({ busy: null, error: undefined, exportReceipt: outcome.value, phase: 'exported' })
        return
      }
      if (outcome.failure.kind === 'guard' && outcome.failure.code === 'stale_digest') {
        update({ busy: null, stale: true, error: foldSessionFailure(outcome.failure) })
        return
      }
      update({ busy: null, error: foldSessionFailure(outcome.failure) })
    },

    async checkFreshness() {
      if (state.pinnedRef === undefined || state.session === undefined) return
      update({ busy: 'inspect' })
      const outcome = await host.inspect(state.pinnedRef)
      if (disposed) return
      update({ busy: null })
      if (!outcome.ok) return
      const currentDigest = outcome.inspection.template.digest
      const stale = currentDigest !== state.session.digest
      update({
        currentDigest,
        stale,
        // Stale gating is the dominant fact: export stays disabled until the
        // owner re-pins (explicit reset); progress is never destroyed.
        ...(stale ? { error: { code: 'stale_digest', detail: 'the template digest changed since the session pinned it' } } : {}),
      })
    },

    reset() {
      update({
        phase: state.inspection === undefined ? 'empty' : 'form',
        session: undefined,
        compile: undefined,
        exportReceipt: undefined,
        stale: false,
        error: undefined,
        busy: null,
      })
    },

    dispose() {
      if (disposed) return
      disposed = true
      listeners.clear()
    },
  }
  return controller
}

/**
 * Evidence question drafts bound to the current conversation session.
 *
 * The draft is local and editable; nothing is sent until the user explicitly
 * submits. The draft binds the exact signal revision, evidence refs and
 * policy revision it was prepared from, and the session id of the CURRENT
 * conversation. A session switch invalidates the binding — the user must
 * rebind explicitly — so late results or old drafts can never reach a new
 * session. Without the official sessions seam the evidence stays readable
 * and the question action stays disabled.
 */

import type { MarketSignalProjection } from '@yeisme/dsh-personal-radar'

/** Structural subset of the official sessions face (same shape as side-chat). */
export interface MarketQuestionSessionsFace {
  readonly list: {
    getSnapshot(): { readonly current: string | undefined }
    subscribe(listener: () => void): () => void
  }
  binding(sessionId: string): {
    readonly session: {
      prompt(content: ReadonlyArray<{ type: 'text'; text: string }>, mode: 'queue' | 'steer'): Promise<{ ok: boolean; error?: { message?: string } }>
    }
  } | undefined
}

export type MarketQuestionStatus =
  | 'idle'
  | 'draft'
  | 'evidence_insufficient'
  | 'composer_unavailable'
  | 'reference_stale'
  | 'session_changed'
  | 'sending'
  | 'sent'
  | 'failed'

export interface MarketQuestionDraft {
  readonly sessionId: string
  readonly signalRef: string
  readonly revision: number
  readonly policyRevision: string
  readonly title: string
  readonly evidenceRefs: readonly string[]
  /** User-editable question text; the citation prefix is fixed. */
  readonly question: string
}

export interface MarketQuestionState {
  readonly status: MarketQuestionStatus
  readonly draft: MarketQuestionDraft | null
  readonly reason: string
}

export interface MarketQuestionController {
  snapshot(): MarketQuestionState
  subscribe(listener: (state: MarketQuestionState) => void): () => void
  /** Build a draft from the exact loaded signal revision; never sends. */
  prepare(signal: MarketSignalProjection): void
  /** Edit the question text locally. */
  edit(question: string): void
  /** A different loaded revision invalidates the draft citation; user must re-prepare. */
  invalidateForSelection(selection: { signalRef: string; revision: number }): void
  /** Explicit user submit; validates binding, session and seam first. */
  send(): Promise<void>
  /** Explicit rebind after a session switch; user-initiated only. */
  rebind(): void
  clear(): void
  dispose(): void
}

export function marketQuestionCitation(input: { title: string; signalRef: string; revision: number; policyRevision: string; evidenceRefs: readonly string[] }): string {
  const evidence = input.evidenceRefs.length > 0 ? `\n证据: ${input.evidenceRefs.join(', ')}` : ''
  return `[Radar 市场] ${input.title} (${input.signalRef} 修订 ${input.revision}, 策略 ${input.policyRevision})${evidence}\n\n`
}

export function createMarketQuestionController(sessions: MarketQuestionSessionsFace | undefined): MarketQuestionController {
  const seamAvailable = sessions !== undefined && typeof sessions.list?.getSnapshot === 'function' && typeof sessions.binding === 'function'
  let state: MarketQuestionState = { status: 'idle', draft: null, reason: '' }
  let disposed = false
  const listeners = new Set<(state: MarketQuestionState) => void>()
  const emit = () => {
    for (const listener of [...listeners]) {
      try { listener(structuredClone(state)) } catch { listeners.delete(listener) }
    }
  }
  let unsubscribeSessions: (() => void) | undefined
  if (seamAvailable && sessions) {
    // A session switch never carries the old draft over: the binding goes
    // stale and only an explicit rebind() can target the new session.
    unsubscribeSessions = sessions.list.subscribe(() => {
      if (disposed) return
      const draft = state.draft
      if (draft === null || state.status === 'sent') return
      if (sessions.list.getSnapshot().current === draft.sessionId) return
      state = { status: 'session_changed', draft, reason: '会话已切换：旧草稿不会发送到新会话，需显式重新绑定。' }
      emit()
    })
  }
  const controller: MarketQuestionController = {
    snapshot: () => structuredClone(state),
    subscribe(listener) {
      if (disposed) throw new Error('market_question_disposed')
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    prepare(signal) {
      if (disposed) return
      if (signal.evidenceRefs.length === 0) {
        state = { status: 'evidence_insufficient', draft: null, reason: '该信号没有可引用的证据；证据阅读保持可用，问答保持禁用。' }
        emit()
        return
      }
      const current = seamAvailable && sessions ? sessions.list.getSnapshot().current : undefined
      if (current === undefined) {
        state = { status: 'composer_unavailable', draft: null, reason: '当前没有可绑定的会话 composer；证据阅读保持可用，问答保持禁用。' }
        emit()
        return
      }
      state = {
        status: 'draft',
        draft: { sessionId: current, signalRef: signal.signalRef, revision: signal.revision, policyRevision: signal.policyRevision,
          title: signal.title, evidenceRefs: [...signal.evidenceRefs], question: '' },
        reason: '',
      }
      emit()
    },
    edit(question) {
      if (disposed || state.draft === null) return
      if (typeof question !== 'string' || question.length > 4000) return
      state = { ...state, draft: { ...state.draft, question } }
      emit()
    },
    rebind() {
      if (disposed || !seamAvailable || sessions === undefined || state.draft === null) return
      const current = sessions.list.getSnapshot().current
      if (current === undefined) return
      state = { status: 'draft', draft: { ...state.draft!, sessionId: current }, reason: '' }
      emit()
    },
    invalidateForSelection(selection) {
      if (disposed) return
      const draft = state.draft
      if (draft === null || state.status === 'sent') return
      if (draft.signalRef === selection.signalRef && draft.revision === selection.revision) return
      state = { status: 'reference_stale', draft, reason: '所选修订已变化；请基于当前修订重新生成问题。' }
      emit()
    },
    async send() {
      if (disposed || state.draft === null) return
      const draft = state.draft
      if (state.status === 'reference_stale') return
      if (!seamAvailable || sessions === undefined) {
        state = { status: 'composer_unavailable', draft, reason: '宿主未提供会话 composer seam；不会发送。' }
        emit()
        return
      }
      const current = sessions.list.getSnapshot().current
      if (current !== draft.sessionId) {
        state = { status: 'session_changed', draft, reason: '草稿绑定的会话已不是当前会话；显式重新绑定后才能发送。' }
        emit()
        return
      }
      if (draft.question.trim().length === 0) return
      const binding = sessions.binding(draft.sessionId)
      if (binding === undefined) {
        state = { status: 'composer_unavailable', draft, reason: '当前会话 composer 不可用；不会发送。' }
        emit()
        return
      }
      state = { status: 'sending', draft, reason: '' }
      emit()
      try {
        const receipt = await binding.session.prompt([{ type: 'text', text: marketQuestionCitation(draft) + draft.question }], 'queue')
        if (disposed) return
        // Re-validate after the await: a switch during send must not report
        // success into a different session context.
        if (sessions.list.getSnapshot().current !== draft.sessionId) {
          state = { status: 'session_changed', draft, reason: '发送期间会话已切换；请核对目标会话。' }
          emit()
          return
        }
        if (!receipt.ok) {
          state = { status: 'failed', draft, reason: '发送失败：会话未接收该消息，草稿已保留。' }
          emit()
          return
        }
        state = { status: 'sent', draft: null, reason: '已发送到当前会话。' }
        emit()
      } catch {
        if (disposed) return
        state = { status: 'failed', draft, reason: '发送失败：会话未接收该消息，草稿已保留。' }
        emit()
      }
    },
    clear() {
      if (disposed) return
      state = { status: 'idle', draft: null, reason: '' }
      emit()
    },
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribeSessions?.()
      listeners.clear()
      state = { status: 'idle', draft: null, reason: '' }
    },
  }
  return controller
}

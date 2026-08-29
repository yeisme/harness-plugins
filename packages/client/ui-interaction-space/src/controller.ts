/**
 * Interaction space controller: the artifact-anchored state machine.
 *
 * 不变量（spec 级）：
 * 1. agent 只能经 `ingestDirective` 投影 typed directive；渲染真值在空间。
 * 2. 空间内 session 只经 `binding()`/`fork()`（可选 `create()`）；控制器不
 *    持有也不调用 `open()/openSubagent()/clear()` —— 主对话 current
 *    selection 全程不动（测试计数断言）。
 * 3. 一切预算（锚点/时间线/提案）在入口处强制；超限拒绝或滚动，不静默。
 * 4. 提案应用走 owner adapter（preview-before-mutate）；缺席即禁用并给出
 *    `owner-adapter-unavailable`，不伪造 receipt。
 *
 * @module @yeisme/dsh-client-ui-interaction-space/controller
 */

import type { SelectionAnchorV1 } from '@yeisme/dsh-selection-host'
import {
  ingestSpaceDirective,
  SPACE_PROTOCOL_LIMITS,
  type DirectiveRejection,
  type SpaceDirectiveKind,
  type SpaceProposalV1,
} from './contracts.ts'

// ---------------------------------------------------------------------------
// Session faces（官方 client runtime 的结构化子集，与 ISessions 对齐）
// ---------------------------------------------------------------------------

export interface SpaceSessionPromptContent {
  readonly type: 'text'
  readonly text: string
}

export interface SpaceSessionBindingFace {
  readonly sessionId: string
  prompt(content: ReadonlyArray<SpaceSessionPromptContent>, mode: 'queue' | 'steer'): Promise<{ ok: boolean; error?: { message?: string } }>
  cancel(): Promise<{ ok: boolean }>
  subscribe(listener: () => void): () => void
  getSnapshot(): { running: boolean; removed: boolean }
}

export interface SpaceSessionsFace {
  readonly list?: {
    getSnapshot(): { readonly ids: readonly string[]; readonly byId: Readonly<Record<string, { displayTitle: string; running: boolean }>> }
  }
  binding(sessionId: string): SpaceSessionBindingFace | undefined
  fork?(input: { sessionId: string; increaseTitle?: boolean }): Promise<string>
  create?(input?: { sessionId?: string }): Promise<string>
}

export interface ComposerAdapterFace {
  send(input: { intent: 'ask' | 'comment' | 'edit'; text: string; anchorIds: readonly string[]; approvalPolicy: 'preview-first' | 'auto-apply' }): Promise<{ ok: boolean; error?: { message?: string } }>
  modelLabel?(): string
}

export interface OwnerDispatchFace {
  /** preview-before-mutate：snapshot freshness → descriptor 匹配 → dispatch。 */
  dispatch(input: { proposal: SpaceProposalV1; decisions: Readonly<Record<string, 'approved' | 'rejected' | 'revision_requested' | 'deferred'>> }): Promise<
    | { readonly kind: 'applied'; readonly receiptRef: string; readonly nextVersion: string }
    | { readonly kind: 'rejected'; readonly reason: string }
    | { readonly kind: 'unknown' }
  >
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type TimelineEntryKind = SpaceDirectiveKind | 'receipt' | 'rejected' | 'drift'

export interface SpaceTimelineEntry {
  readonly id: string
  readonly kind: TimelineEntryKind
  readonly at: string
  readonly summary: string
  readonly rejection?: DirectiveRejection
}

export type ProposalLifecycle = 'review' | 'applying' | 'applied' | 'failed' | 'reconcile_required'

export interface SpaceProposalState {
  readonly proposal: SpaceProposalV1
  readonly lifecycle: ProposalLifecycle
  readonly decisions: Readonly<Record<string, 'approved' | 'rejected' | 'revision_requested' | 'deferred'>>
  readonly receiptRef?: string
  readonly appliedVersion?: string
  readonly error?: string
}

export type SpaceSessionPhase = 'empty' | 'attaching' | 'attached' | 'unresolvable'

export interface InteractionSpaceSnapshot {
  readonly resourceKey: string
  readonly owner: string
  readonly ref: string
  readonly version: string
  readonly title: string
  readonly mediaType: string
  readonly anchors: readonly SelectionAnchorV1[]
  readonly timeline: readonly SpaceTimelineEntry[]
  readonly proposals: readonly SpaceProposalState[]
  readonly sessionPhase: SpaceSessionPhase
  readonly sessionId?: string
  readonly sessionRunning: boolean
  readonly sessionError?: string
  readonly composerAvailable: boolean
  readonly dispatchAvailable: boolean
  readonly drifted: boolean
}

export interface InteractionSpaceDeps {
  readonly resource: { readonly owner: string; readonly ref: string; readonly version: string; readonly title: string; readonly mediaType: string }
  readonly sessions?: SpaceSessionsFace | undefined
  readonly composer?: ComposerAdapterFace | undefined
  readonly dispatch?: OwnerDispatchFace | undefined
  readonly now?: () => string
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class InteractionSpaceController {
  private readonly listeners = new Set<() => void>()
  private readonly anchors = new Map<string, SelectionAnchorV1>()
  private readonly seenDirectiveIds = new Set<string>()
  private readonly lastHighlightAt = new Map<string, number>()
  private timeline: SpaceTimelineEntry[] = []
  private proposals = new Map<string, SpaceProposalState>()
  private sessionPhase: SpaceSessionPhase = 'empty'
  private sessionId: string | undefined
  private sessionRunning = false
  private sessionError: string | undefined
  private disposeSession: (() => void) | undefined
  private driftVersion: string | undefined
  private disposed = false
  private epoch = 0

  constructor(private readonly deps: InteractionSpaceDeps) {}

  get resourceKey(): string {
    return `space:${this.deps.resource.owner}:${this.deps.resource.ref}@${this.deps.resource.version}`
  }

  getSnapshot(): InteractionSpaceSnapshot {
    return {
      resourceKey: this.resourceKey,
      owner: this.deps.resource.owner,
      ref: this.deps.resource.ref,
      version: this.driftVersion ?? this.deps.resource.version,
      title: this.deps.resource.title,
      mediaType: this.deps.resource.mediaType,
      anchors: [...this.anchors.values()],
      timeline: this.timeline,
      proposals: [...this.proposals.values()],
      sessionPhase: this.sessionPhase,
      ...this.sessionId === undefined ? {} : { sessionId: this.sessionId },
      sessionRunning: this.sessionRunning,
      ...this.sessionError === undefined ? {} : { sessionError: this.sessionError },
      composerAvailable: this.deps.composer !== undefined,
      dispatchAvailable: this.deps.dispatch !== undefined,
      drifted: this.driftVersion !== undefined && this.driftVersion !== this.deps.resource.version,
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  dispose(): void {
    this.disposed = true
    this.disposeSession?.()
    this.disposeSession = undefined
    this.listeners.clear()
  }

  private emit(): void {
    if (this.disposed) return
    for (const listener of [...this.listeners]) listener()
  }

  private now(): string {
    return this.deps.now?.() ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  }

  private pushTimeline(entry: Omit<SpaceTimelineEntry, 'id'>): void {
    this.epoch += 1
    this.timeline = [...this.timeline, { ...entry, id: `t-${this.epoch}` }]
    if (this.timeline.length > SPACE_PROTOCOL_LIMITS.timelineEntries) {
      this.timeline = this.timeline.slice(this.timeline.length - SPACE_PROTOCOL_LIMITS.timelineEntries)
    }
  }

  // --- anchors -----------------------------------------------------------

  addAnchor(anchor: SelectionAnchorV1): boolean {
    if (this.anchors.size >= SPACE_PROTOCOL_LIMITS.anchorsPerSpace) return false
    this.anchors.set(anchor.anchorId, anchor)
    this.emit()
    return true
  }

  removeAnchor(anchorId: string): void {
    this.anchors.delete(anchorId)
    this.emit()
  }

  /**
   * Version bump from the owner: anchors whose digest no longer matches go
   * `drifted`. `stillValid` lets the host re-check digests (re-read content);
   * the default marks source-mapped anchors stale pending reanchoring.
   */
  bumpVersion(nextVersion: string, stillValid?: (anchor: SelectionAnchorV1) => boolean): void {
    this.driftVersion = nextVersion
    let drifted = 0
    for (const [anchorId, anchor] of this.anchors) {
      if (stillValid?.(anchor) === true) continue
      this.anchors.set(anchorId, { ...anchor, freshness: 'stale' })
      drifted += 1
    }
    for (const [proposalId, state] of this.proposals) {
      if (state.proposal.baseVersion !== nextVersion && state.lifecycle === 'review') {
        this.proposals.set(proposalId, { ...state, lifecycle: 'reconcile_required' })
      }
    }
    this.pushTimeline({ kind: 'drift', at: this.now(), summary: `工件版本升至 ${nextVersion}${drifted > 0 ? `，${drifted} 个锚点待协调` : ''}` })
    this.emit()
  }

  // --- directives --------------------------------------------------------

  ingestDirective(input: unknown): DirectiveRejection | undefined {
    const activeProposalIds = new Set([...this.proposals.values()].filter(state => state.lifecycle === 'review').map(state => state.proposal.proposalId))
    const result = ingestSpaceDirective(input, {
      knownAnchorIds: new Set(this.anchors.keys()),
      activeProposalIds,
      seenDirectiveIds: this.seenDirectiveIds,
    })
    if (!result.ok) {
      this.pushTimeline({ kind: 'rejected', at: this.now(), summary: `directive 被拒绝（${result.rejection.code}）`, rejection: result.rejection })
      this.emit()
      return result.rejection
    }
    const directive = result.directive
    this.seenDirectiveIds.add(directive.directiveId)
    if (directive.kind === 'highlight') {
      const key = directive.anchorIds.join('|')
      const last = this.lastHighlightAt.get(key) ?? 0
      const at = Date.parse(directive.createdAt)
      if (Number.isFinite(at) && at - last < SPACE_PROTOCOL_LIMITS.directiveMergeWindowMs) {
        // 节流合并：窗口内同锚点组的高亮只记一次时间线。
        this.emit()
        return undefined
      }
      this.lastHighlightAt.set(key, Number.isFinite(at) ? at : Date.now())
    }
    switch (directive.kind) {
      case 'focus':
        this.pushTimeline({ kind: 'focus', at: directive.createdAt, summary: `agent 请求聚焦 ${directive.resourceKey}（需人工确认）` })
        break
      case 'highlight':
        this.pushTimeline({ kind: 'highlight', at: directive.createdAt, summary: `agent 高亮锚点 ${directive.anchorIds.join(', ')}` })
        break
      case 'propose':
        this.proposals.set(directive.proposal.proposalId, { proposal: directive.proposal, lifecycle: 'review', decisions: {} })
        this.pushTimeline({ kind: 'propose', at: directive.createdAt, summary: `提案 ${directive.proposal.safeSummary}` })
        break
      case 'request-input':
        this.pushTimeline({ kind: 'request-input', at: directive.createdAt, summary: directive.prompt })
        break
      case 'progress':
        this.pushTimeline({ kind: 'progress', at: directive.createdAt, summary: `${directive.runRef}: ${directive.stage}${directive.percent !== undefined ? ` ${Math.round(directive.percent)}%` : ''}` })
        break
    }
    this.emit()
    return undefined
  }

  // --- proposals ---------------------------------------------------------

  decideHunk(proposalId: string, hunkKey: string, decision: 'approved' | 'rejected' | 'revision_requested' | 'deferred'): void {
    const state = this.proposals.get(proposalId)
    if (state === undefined || state.lifecycle !== 'review' && state.lifecycle !== 'reconcile_required') return
    this.proposals.set(proposalId, { ...state, decisions: { ...state.decisions, [hunkKey]: decision } })
    this.emit()
  }

  async applyProposal(proposalId: string): Promise<void> {
    const dispatch = this.deps.dispatch
    const state = this.proposals.get(proposalId)
    if (dispatch === undefined || state === undefined || state.lifecycle !== 'review') {
      if (state !== undefined && dispatch === undefined) {
        this.proposals.set(proposalId, { ...state, error: 'owner-adapter-unavailable' })
        this.emit()
      }
      return
    }
    this.proposals.set(proposalId, { ...state, lifecycle: 'applying' })
    this.emit()
    try {
      const receipt = await dispatch.dispatch({ proposal: state.proposal, decisions: state.decisions })
      if (receipt.kind === 'applied') {
        this.proposals.set(proposalId, { ...state, lifecycle: 'applied', receiptRef: receipt.receiptRef, appliedVersion: receipt.nextVersion, decisions: state.decisions })
        this.pushTimeline({ kind: 'receipt', at: this.now(), summary: `提案已应用（receipt ${receipt.receiptRef}）` })
        this.bumpVersion(receipt.nextVersion)
      } else if (receipt.kind === 'rejected') {
        this.proposals.set(proposalId, { ...state, lifecycle: 'failed', error: receipt.reason, decisions: state.decisions })
        this.pushTimeline({ kind: 'receipt', at: this.now(), summary: `提案被 owner 拒绝：${receipt.reason}` })
      } else {
        this.proposals.set(proposalId, { ...state, lifecycle: 'reconcile_required', error: 'settlement-unknown', decisions: state.decisions })
        this.pushTimeline({ kind: 'receipt', at: this.now(), summary: '提案应用结果未知，需要 owner reconcile' })
      }
    } catch {
      this.proposals.set(proposalId, { ...state, lifecycle: 'failed', error: 'dispatch-transport-error', decisions: state.decisions })
      this.pushTimeline({ kind: 'receipt', at: this.now(), summary: '提案应用传输失败，不自动重试' })
    }
    this.emit()
  }

  /** 提案 hunk key 集合（per-format 派生），供逐位置审批。 */
  proposalHunkKeys(proposalId: string): readonly string[] {
    const state = this.proposals.get(proposalId)
    if (state === undefined) return []
    const { payload } = state.proposal
    if (payload.format === 'text-hunk') return payload.hunks.map((_, index) => `hunk-${index}`)
    if (payload.format === 'table-cells') return payload.cells.map((_, index) => `cell-${index}`)
    return ['whole']
  }

  // --- composer ----------------------------------------------------------

  async sendToAgent(input: { intent: 'ask' | 'comment' | 'edit'; text: string; anchorIds: readonly string[] }): Promise<{ ok: boolean; error?: string }> {
    const composer = this.deps.composer
    if (composer === undefined) return { ok: false, error: 'composer-adapter-unavailable' }
    for (const anchorId of input.anchorIds) {
      if (!this.anchors.has(anchorId)) return { ok: false, error: `unknown anchor ${anchorId}` }
    }
    const result = await composer.send({ ...input, approvalPolicy: 'preview-first' })
    if (result.ok && input.anchorIds.length > 0) {
      this.pushTimeline({ kind: 'progress', at: this.now(), summary: `已发送 ${input.intent}（锚点 ${input.anchorIds.join(', ')}）` })
      this.emit()
    }
    return result.ok ? { ok: true } : { ok: false, error: result.error?.message ?? 'send-failed' }
  }

  // --- session（主选择不变量：只 binding/fork/create） --------------------

  attachSession(sessionId: string): void {
    const sessions = this.deps.sessions
    if (sessions === undefined) {
      this.sessionPhase = 'unresolvable'
      this.sessionError = 'needs_contract'
      this.emit()
      return
    }
    this.sessionPhase = 'attaching'
    this.sessionError = undefined
    this.emit()
    const binding = sessions.binding(sessionId)
    if (binding === undefined) {
      this.sessionPhase = 'unresolvable'
      this.sessionError = 'session-unresolvable'
      this.emit()
      return
    }
    this.disposeSession?.()
    this.sessionId = sessionId
    this.sessionPhase = 'attached'
    this.sessionRunning = binding.getSnapshot().running
    this.disposeSession = binding.subscribe(() => {
      if (this.disposed) return
      const snapshot = binding.getSnapshot()
      this.sessionRunning = snapshot.running
      if (snapshot.removed) {
        this.sessionPhase = 'unresolvable'
        this.sessionError = 'session-removed'
        this.disposeSession = undefined
      }
      this.emit()
    })
    this.emit()
  }

  async forkSession(): Promise<boolean> {
    const sessions = this.deps.sessions
    const current = this.sessionId
    if (sessions?.fork === undefined || current === undefined) return false
    try {
      const forked = await sessions.fork({ sessionId: current, increaseTitle: true })
      this.attachSession(forked)
      return true
    } catch {
      this.sessionError = 'fork-failed'
      this.emit()
      return false
    }
  }

  async promptSession(text: string, mode: 'queue' | 'steer' = 'queue'): Promise<{ ok: boolean; error?: string }> {
    const sessions = this.deps.sessions
    if (this.sessionId === undefined || sessions === undefined) return { ok: false, error: 'not-attached' }
    const binding = sessions.binding(this.sessionId)
    if (binding === undefined) return { ok: false, error: 'session-unresolvable' }
    const result = await binding.prompt([{ type: 'text', text }], mode)
    return result.ok ? { ok: true } : { ok: false, error: result.error?.message ?? 'prompt-failed' }
  }

  async cancelSession(): Promise<void> {
    const sessions = this.deps.sessions
    if (this.sessionId === undefined || sessions === undefined) return
    sessions.binding(this.sessionId)?.cancel()
  }

  /** detach 只取消本地订阅；session 原样保留。 */
  detachSession(): void {
    this.disposeSession?.()
    this.disposeSession = undefined
    this.sessionId = undefined
    this.sessionPhase = 'empty'
    this.sessionRunning = false
    this.emit()
  }
}

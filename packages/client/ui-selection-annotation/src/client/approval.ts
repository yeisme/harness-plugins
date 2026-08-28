/**
 * 多位置审批面板控制器。按位置决策（批准/拒绝/要求修改/暂不处理），部分
 * 批准只应用已批准且依赖闭包完整的 hunks；应用动作只经 owner service，
 * 浏览器侧不接触 patch 文本。
 *
 * @module @yeisme/dsh-client-ui-selection-annotation/client
 */

import {
  canTransitionHunk,
  planPartialApply,
  type ApplyPlanV1,
  type ApplyReceiptV1,
  type HunkDecision,
  type HunkStatus,
  type ProposalHunkV1,
  type ProposalV1,
} from '@yeisme/dsh-selection-host'

export interface ApprovalServiceAdapter {
  getProposal(proposalId: string): Promise<ProposalV1 | undefined>
  decide(proposalId: string, hunkId: string, decision: Exclude<HunkDecision, 'pending'>): Promise<ApplyReceiptV1>
  applyApproved(proposalId: string): Promise<readonly ApplyReceiptV1[]>
  /** Current artifact version for pre-apply planning display. */
  currentVersion(artifactRef: string): string | undefined
  /** artifactRef for a hunk patch (owner-side mapping). */
  artifactRefFor(hunk: ProposalHunkV1): string | undefined
}

export interface ApprovalRow {
  readonly hunkId: string
  readonly anchorId: string
  readonly safeSummary: string
  readonly decision: HunkStatus
  readonly marker?: number
  readonly blockedReason?: string
  readonly versionConflict?: { expected: string; actual: string }
}

export interface ApprovalPanelState {
  readonly proposalId: string
  readonly title: string
  readonly rows: readonly ApprovalRow[]
  readonly plan: ApplyPlanV1 | undefined
  readonly selected: readonly string[]
  readonly focusIndex: number
  readonly lastReceipts: readonly ApplyReceiptV1[]
}

export type ApprovalHunkAction = Exclude<HunkDecision, 'pending'>

export interface ApprovalPanelEvents {
  onViewSource?(row: ApprovalRow): void
  onViewDiff?(row: ApprovalRow): void
  onOpenWorkbench?(row: ApprovalRow): void
}

export interface ApprovalPanelOptions {
  readonly proposalId: string
  readonly adapter: ApprovalServiceAdapter
  readonly events?: ApprovalPanelEvents
}

export class ApprovalPanelController {
  private readonly options: ApprovalPanelOptions
  private state: ApprovalPanelState
  private readonly listeners = new Set<(state: ApprovalPanelState) => void>()

  constructor(options: ApprovalPanelOptions) {
    this.options = options
    this.state = {
      proposalId: options.proposalId,
      title: '',
      rows: [],
      plan: undefined,
      selected: [],
      focusIndex: -1,
      lastReceipts: [],
    }
  }

  getState(): ApprovalPanelState {
    return this.state
  }

  subscribe(listener: (state: ApprovalPanelState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private patch(partial: Partial<ApprovalPanelState>): void {
    this.state = { ...this.state, ...partial }
    for (const listener of this.listeners) listener(this.state)
  }

  async refresh(): Promise<ApprovalPanelState> {
    const proposal = await this.options.adapter.getProposal(this.state.proposalId)
    if (proposal === undefined) {
      this.patch({ rows: [], plan: undefined, title: '' })
      return this.state
    }
    const versions = new Map<string, string>()
    for (const hunk of proposal.hunks) {
      const artifactRef = this.options.adapter.artifactRefFor(hunk)
      if (artifactRef !== undefined && !versions.has(artifactRef)) {
        const version = this.options.adapter.currentVersion(artifactRef)
        if (version !== undefined) versions.set(artifactRef, version)
      }
    }
    const plan = planPartialApply(proposal, versions, hunk => this.options.adapter.artifactRefFor(hunk))
    const rows = proposal.hunks.map(hunk => this.rowFor(proposal, hunk, plan, versions))
    this.patch({ title: proposal.title, rows, plan })
    return this.state
  }

  private rowFor(proposal: ProposalV1, hunk: ProposalHunkV1, plan: ApplyPlanV1, versions: ReadonlyMap<string, string>): ApprovalRow {
    const blocker = plan.blocked.find(entry => entry.hunkId === hunk.hunkId)
    const marker = proposal.hunks.findIndex(candidate => candidate.hunkId === hunk.hunkId) + 1
    // 版本漂移对所有未终态行可见（不只是 approved），UI 提示“需协调”。
    let conflict = plan.conflicts.find(entry => entry.hunkId === hunk.hunkId)
    if (conflict === undefined && hunk.decision !== 'applied' && hunk.decision !== 'rejected') {
      const artifactRef = this.options.adapter.artifactRefFor(hunk)
      const actual = artifactRef === undefined ? undefined : versions.get(artifactRef)
      if (actual !== undefined && actual !== hunk.baseVersion) {
        conflict = { hunkId: hunk.hunkId, artifactRef: artifactRef ?? '', expected: hunk.baseVersion, actual }
      }
    }
    return {
      hunkId: hunk.hunkId,
      anchorId: hunk.anchorId,
      safeSummary: hunk.safeSummary,
      decision: hunk.decision,
      marker,
      ...(blocker === undefined ? {} : { blockedReason: blocker.reason }),
      ...(conflict === undefined ? {} : { versionConflict: { expected: conflict.expected, actual: conflict.actual } }),
    }
  }

  toggleSelected(hunkId: string): void {
    const selected = this.state.selected.includes(hunkId)
      ? this.state.selected.filter(id => id !== hunkId)
      : [...this.state.selected, hunkId]
    this.patch({ selected })
  }

  selectAll(): void {
    this.patch({ selected: this.state.rows.map(row => row.hunkId) })
  }

  clearSelection(): void {
    this.patch({ selected: [] })
  }

  /** Keyboard focus walks rows, not buttons, so the flow is fully reachable. */
  moveFocus(delta: number): number {
    if (this.state.rows.length === 0) return -1
    const next = (this.state.focusIndex + delta + this.state.rows.length) % this.state.rows.length
    this.patch({ focusIndex: next })
    return next
  }

  /** Per-position decision; terminal states are rejected up front. */
  async decide(hunkId: string, action: ApprovalHunkAction): Promise<ApplyReceiptV1> {
    const row = this.state.rows.find(entry => entry.hunkId === hunkId)
    if (row === undefined) throw new Error(`unknown hunk ${hunkId}`)
    if (!canTransitionHunk(row.decision, action)) {
      throw new Error(`hunk ${hunkId} is ${row.decision}; ${action} is not allowed`)
    }
    const receipt = await this.options.adapter.decide(this.state.proposalId, hunkId, action)
    this.patch({ lastReceipts: [receipt] })
    await this.refresh()
    return receipt
  }

  async approveSelected(): Promise<readonly ApplyReceiptV1[]> {
    return this.decideMany(this.state.selected, 'approved')
  }

  async decideMany(hunkIds: readonly string[], action: ApprovalHunkAction): Promise<readonly ApplyReceiptV1[]> {
    const receipts: ApplyReceiptV1[] = []
    for (const hunkId of hunkIds) {
      try {
        receipts.push(await this.decide(hunkId, action))
      } catch {
        // Terminal rows are skipped; the panel keeps honest per-row states.
      }
    }
    return receipts
  }

  async apply(): Promise<readonly ApplyReceiptV1[]> {
    const receipts = await this.options.adapter.applyApproved(this.state.proposalId)
    this.patch({ lastReceipts: receipts })
    await this.refresh()
    return receipts
  }

  viewSource(hunkId: string): void {
    const row = this.state.rows.find(entry => entry.hunkId === hunkId)
    if (row !== undefined) this.options.events?.onViewSource?.(row)
  }

  viewDiff(hunkId: string): void {
    const row = this.state.rows.find(entry => entry.hunkId === hunkId)
    if (row !== undefined) this.options.events?.onViewDiff?.(row)
  }

  openWorkbench(hunkId: string): void {
    const row = this.state.rows.find(entry => entry.hunkId === hunkId)
    if (row !== undefined) this.options.events?.onOpenWorkbench?.(row)
  }
}

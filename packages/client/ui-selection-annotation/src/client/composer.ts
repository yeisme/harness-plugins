/**
 * Compact Agent Composer seam 控制器。紧凑密度下的询问/评论/修改三意图，
 * 展开到主输入框不丢草稿；`修改` 强制 preview-first，评论默认不调模型。
 * UI 无关：DOM overlay 与 React 面板共用同一个状态脑。
 *
 * @module @yeisme/dsh-client-ui-selection-annotation/client
 */

import type { AnchorDraft, ApprovalPolicy, ComposerIntent } from '@yeisme/dsh-selection-host'

export const COMPOSER_WIDTH_DEFAULT = 360
export const COMPOSER_WIDTH_MIN = 280
export const COMPOSER_WIDTH_MAX = 480
export const COMPOSER_ROWS_MIN = 1
export const COMPOSER_ROWS_MAX = 6
export const COMPOSER_HISTORY_LIMIT = 20

export interface ContextCard {
  readonly id: string
  /** 文件、行号、截图标记或页面区域描述。 */
  readonly label: string
  readonly anchorId?: string
}

export interface ComposerSendInput {
  readonly intent: ComposerIntent
  readonly text: string
  readonly anchorIds: readonly string[]
  readonly approvalPolicy: ApprovalPolicy
}

export interface ComposerAdapter {
  /** Conversation runtime seam; absent means the host composer is not mounted. */
  send?(input: ComposerSendInput): Promise<void>
  /** Streaming/state probes shown in the compact footer. */
  modelLabel?(): string | undefined
  permissionLabel?(): string | undefined
  /** Stop/retry hooks owned by the conversation runtime. */
  stop?(): void
  retry?(): void
}

export type ComposerStatus = 'idle' | 'sending' | 'streaming' | 'blocked'

export interface ComposerState {
  readonly intent: ComposerIntent
  readonly text: string
  readonly expanded: boolean
  readonly rows: number
  readonly width: number
  readonly cards: readonly ContextCard[]
  readonly history: readonly string[]
  readonly historyIndex: number
  readonly status: ComposerStatus
  readonly modelResponseForComment: boolean
  readonly anchorTitle: string | undefined
  readonly blockedReason: string | undefined
}

export interface SubmitResult {
  readonly status: 'sent' | 'blocked' | 'local'
  readonly reason?: string
}

export interface CompactComposerOptions {
  readonly adapter?: ComposerAdapter
  readonly anchorTitle?: string
  readonly width?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export class CompactComposerController {
  private readonly adapter: ComposerAdapter | undefined
  private readonly listeners = new Set<(state: ComposerState) => void>()
  private state: ComposerState

  constructor(options: CompactComposerOptions = {}) {
    this.adapter = options.adapter
    this.state = {
      intent: 'ask',
      text: '',
      expanded: false,
      rows: COMPOSER_ROWS_MIN,
      width: clamp(options.width ?? COMPOSER_WIDTH_DEFAULT, COMPOSER_WIDTH_MIN, COMPOSER_WIDTH_MAX),
      cards: [],
      history: [],
      historyIndex: -1,
      status: 'idle',
      modelResponseForComment: false,
      anchorTitle: options.anchorTitle,
      blockedReason: undefined,
    }
  }

  getState(): ComposerState {
    return this.state
  }

  subscribe(listener: (state: ComposerState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private patch(partial: Partial<ComposerState>): void {
    this.state = { ...this.state, ...partial }
    for (const listener of this.listeners) listener(this.state)
  }

  /** Intent switching; `edit` is always preview-first, `comment` never auto-calls the model. */
  setIntent(intent: ComposerIntent): void {
    if (intent === this.state.intent) return
    this.patch({
      intent,
      status: 'idle',
      blockedReason: undefined,
      ...(intent === 'comment' ? { modelResponseForComment: false } : {}),
    })
  }

  /** 用户可把评论切换为“请 Agent 回应”。 */
  setModelResponseForComment(enabled: boolean): void {
    this.patch({ modelResponseForComment: enabled })
  }

  update(text: string): void {
    const lineCount = text.split('\n').length
    this.patch({ text, rows: clamp(lineCount, COMPOSER_ROWS_MIN, COMPOSER_ROWS_MAX) })
  }

  setWidth(width: number): void {
    this.patch({ width: clamp(width, COMPOSER_WIDTH_MIN, COMPOSER_WIDTH_MAX) })
  }

  addContextCard(card: ContextCard): void {
    if (this.state.cards.some(existing => existing.id === card.id)) return
    this.patch({ cards: [...this.state.cards, card] })
  }

  removeContextCard(id: string): void {
    this.patch({ cards: this.state.cards.filter(card => card.id !== id) })
  }

  /** Expand to the full composer; draft, attachments and anchors are preserved. */
  expand(): void {
    this.patch({ expanded: true })
  }

  collapse(): void {
    this.patch({ expanded: false })
  }

  historyUp(): string | undefined {
    if (this.state.history.length === 0) return undefined
    const next = this.state.historyIndex < 0
      ? this.state.history.length - 1
      : Math.max(this.state.historyIndex - 1, 0)
    const entry = this.state.history[next]
    if (entry !== undefined) {
      this.patch({ historyIndex: next, text: entry })
      return entry
    }
    return undefined
  }

  historyDown(): string | undefined {
    if (this.state.historyIndex < 0) return undefined
    const next = this.state.historyIndex + 1
    if (next >= this.state.history.length) {
      this.patch({ historyIndex: -1, text: '' })
      return ''
    }
    const entry = this.state.history[next]
    if (entry !== undefined) {
      this.patch({ historyIndex: next, text: entry })
      return entry
    }
    return undefined
  }

  /**
   * Submit the current draft. `edit` refuses any policy other than
   * preview-first (the attempt is rejected and stays blocked, never silently
   * coerced-and-sent); comment stays local unless model response was enabled
   * and an adapter exists; ask degrades honestly without an adapter.
   */
  async submit(approvalPolicyOverride?: ApprovalPolicy): Promise<SubmitResult> {
    if (this.state.text.trim() === '') {
      return { status: 'blocked', reason: 'empty-draft' }
    }
    if (this.state.intent === 'edit' && approvalPolicyOverride !== undefined && approvalPolicyOverride !== 'preview-first') {
      this.patch({ status: 'blocked', blockedReason: 'preview-first-required' })
      return { status: 'blocked', reason: 'preview-first-required' }
    }
    const policy: ApprovalPolicy = this.state.intent === 'edit' ? 'preview-first' : approvalPolicyOverride ?? 'preview-first'

    const anchorIds = this.state.cards
      .map(card => card.anchorId)
      .filter((id): id is string => id !== undefined)
    const input: ComposerSendInput = {
      intent: this.state.intent,
      text: this.state.text,
      anchorIds,
      approvalPolicy: policy,
    }

    if (this.state.intent === 'comment' && !this.state.modelResponseForComment) {
      this.pushHistory()
      this.patch({ text: '', rows: COMPOSER_ROWS_MIN, status: 'idle' })
      return { status: 'local' }
    }

    if (this.adapter?.send === undefined) {
      this.patch({ status: 'blocked', blockedReason: 'composer-adapter-unavailable' })
      return { status: 'blocked', reason: 'composer-adapter-unavailable' }
    }

    this.patch({ status: 'sending', blockedReason: undefined })
    try {
      await this.adapter.send(input)
      this.pushHistory()
      this.patch({ text: '', rows: COMPOSER_ROWS_MIN, status: 'idle' })
      return { status: 'sent' }
    } catch (error) {
      this.patch({ status: 'blocked', blockedReason: 'send-failed' })
      return { status: 'blocked', reason: error instanceof Error ? error.message : 'send-failed' }
    }
  }

  private pushHistory(): void {
    const entry = this.state.text.trim()
    if (entry === '') return
    const history = [...this.state.history, entry].slice(-COMPOSER_HISTORY_LIMIT)
    this.patch({ history, historyIndex: -1 })
  }
}

/** Build the compact header label, e.g. `package.json · L18–24`. */
export function anchorTitleFor(anchor: AnchorDraft | undefined): string | undefined {
  if (anchor === undefined) return undefined
  if (anchor.kind === 'file-range') return `L${anchor.startLine}–${anchor.endLine}`
  if (anchor.kind === 'markdown-range') return `L${anchor.sourceStartLine}–${anchor.sourceEndLine}`
  return undefined
}

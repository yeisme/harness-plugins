/**
 * “管理标签”编辑器状态机（observable hub + 保存/CAS 冲突处理）。
 *
 * 状态机不变量（测试钉住）：
 * 1. 领域 mutation 只通过 `sessionTags.set`，且 payload 永远是“完整目标
 *    集合 + 已观察版本（ifVersion）”；不存在增量 add/remove 语义。
 * 2. 取消（Cancel/Escape）零写入：只关闭并还原焦点，不调用 Remote。
 * 3. `version-conflict`：展示冲突提示与权威标签（来自冲突应答内的权威行），
 *    绝不静默覆盖另一写入；用户必须显式再次保存（以新观察到的版本重试）。
 * 4. 冲突/成功后触发 controller 刷新（provider 重建分组），但编辑器状态
 *    不依赖刷新结果——权威值来自 Remote 应答本身。
 * 5. 打开时记录触发元素焦点，关闭时还原（可访问性：焦点回到动作触发器）。
 * 6. 本地输入规则只是 advisory（即时反馈）；Host 的 `tags-invalid` 是权威。
 *
 * @module @yeisme/dsh-client-ui-session-tags/client/editor
 */

import type { SessionTagsController } from './controller.ts'
import { normalizeTags } from './tag-input.ts'
import type { SessionTagsRemoteFace, SessionTagsSetAnswerV1 } from './wire.ts'

/** 编辑器 UI 状态（overlay 组件的唯一数据源）。 */
export interface TagEditorState {
  readonly open: boolean
  readonly sessionId: string
  /** 已确认的目标标签草稿（规范化后）。 */
  readonly draft: readonly string[]
  /** 自由输入框当前文本。 */
  readonly input: string
  readonly phase: 'editing' | 'saving' | 'conflict' | 'error'
  /** conflict：权威标签（null = 权威态为空）；error：提示文案。 */
  readonly message?: string
  readonly reasons?: readonly string[]
  readonly authoritative?: readonly string[] | null
}

/** 编辑器依赖。 */
export interface TagEditorDeps {
  readonly remote: SessionTagsRemoteFace
  readonly controller: SessionTagsController
  /** 既有标签建议（跨会话去重；缺省从 controller 行派生）。 */
  readonly suggestions?: () => readonly string[]
  /** 状态通知调度（缺省同步；测试可注入）。 */
  readonly notify?: () => void
}

const CLOSED_BASE: TagEditorState = Object.freeze({
  open: false,
  sessionId: '',
  draft: Object.freeze([]),
  input: '',
  phase: 'editing',
})

/** 编辑器 hub：单实例、最多一个打开的会话编辑器。 */
export class TagEditorController {
  private readonly remote: SessionTagsRemoteFace
  private readonly controller: SessionTagsController
  private readonly suggestionsOverride: (() => readonly string[]) | undefined
  private readonly notifyScheduled: () => void
  private state: TagEditorState = CLOSED_BASE
  private readonly listeners = new Set<() => void>()
  /** 打开时记录的触发元素（关闭还原焦点）。 */
  private restoreFocusTo: HTMLElement | null = null
  /** 本次打开会话已观察到的行版本（null = 观察到“无行”）。 */
  private observedVersion: string | null = null

  constructor(deps: TagEditorDeps) {
    this.remote = deps.remote
    this.controller = deps.controller
    this.suggestionsOverride = deps.suggestions
    // notify 只是宿主注入的额外调度钩子（如 React 批处理）；缺省无操作，
    // 监听者通知统一由 emit() 完成——不得在此回调 emit（会递归）。
    this.notifyScheduled = deps.notify ?? (() => {})
  }

  /** 当前状态（引用稳定，通知之间不变）。 */
  getSnapshot(): TagEditorState {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 既有标签建议（locale 无关；排序交给视图层）。 */
  suggestions(): readonly string[] {
    if (this.suggestionsOverride !== undefined) return this.suggestionsOverride()
    const state = this.controller.getSnapshot()
    if (state.status !== 'ready') return []
    const seen = new Set<string>()
    for (const entry of state.entries) {
      for (const tag of entry.row.tags) seen.add(tag)
    }
    return [...seen]
  }

  /**
   * 打开编辑器：草稿种子 = 该会话当前权威标签（controller ready 态），
   * 观察版本 = 行版本或 null。记录触发元素以在关闭时还原焦点。
   */
  open(sessionId: string, options?: { readonly trigger?: HTMLElement | null }): void {
    if (this.state.phase === 'saving') return // 保存中不允许重开换会话
    const entry = this.controller.rowOf(sessionId)
    this.observedVersion = entry !== undefined && entry.row.tags.length > 0 ? entry.row.version : null
    const draft = entry !== undefined && entry.row.tags.length > 0 ? [...entry.row.tags] : []
    this.restoreFocusTo = options?.trigger ?? captureActiveElement()
    this.state = Object.freeze({
      open: true,
      sessionId,
      draft: Object.freeze(draft),
      input: '',
      phase: 'editing',
    })
    this.emit()
  }

  /** 取消：零写入，关闭并还原焦点。 */
  cancel(): void {
    this.close()
  }

  /** 切换草稿中的一个标签。 */
  toggleTag(tag: string): void {
    if (!this.state.open || this.state.phase === 'saving') return
    const draft = this.state.draft.includes(tag)
      ? this.state.draft.filter(item => item !== tag)
      : normalizeTags([...this.state.draft, tag]).ok ? [...this.state.draft, tag] : this.state.draft
    this.patch({ draft: Object.freeze(draft), phase: 'editing' })
  }

  /** 自由输入提交（Enter/逗号/添加按钮）：规范化后追加，非法则进入 error 提示。 */
  addFreeInput(): void {
    if (!this.state.open || this.state.phase === 'saving') return
    const normalized = normalizeTags([this.state.input])
    if (!normalized.ok) {
      this.patch({ phase: 'error', reasons: normalized.reasons, message: 'invalid-tag-input' })
      return
    }
    const tag = normalized.tags[0]
    if (tag === undefined || this.state.draft.includes(tag)) {
      this.patch({ input: '', phase: 'editing' })
      return
    }
    const merged = normalizeTags([...this.state.draft, tag])
    if (!merged.ok) {
      this.patch({ phase: 'error', reasons: merged.reasons, message: 'invalid-tag-input' })
      return
    }
    this.patch({ draft: Object.freeze([...merged.tags]), input: '', phase: 'editing' })
  }

  /** 更新自由输入文本（不触发校验）。 */
  setInput(input: string): void {
    if (!this.state.open || this.state.phase === 'saving') return
    this.patch({ input, phase: 'editing' })
  }

  /** 保存：完整目标集合 + 已观察版本。 */
  async save(): Promise<void> {
    if (!this.state.open || this.state.phase === 'saving') return
    const target = normalizeTags([...this.state.draft])
    if (!target.ok) {
      this.patch({ phase: 'error', reasons: target.reasons, message: 'invalid-tag-input' })
      return
    }
    this.patch({ phase: 'saving' })
    let answer: SessionTagsSetAnswerV1
    try {
      answer = await this.remote.set({
        sessionId: this.state.sessionId,
        tags: [...target.tags],
        ifVersion: this.observedVersion,
      })
    } catch (error) {
      this.patch({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
      return
    }
    if (!this.state.open) return // 保存在途时用户已关闭（取消不撤回已提交写入）
    if (answer.ok) {
      // 成功：刷新权威投影并关闭（焦点还原）。
      void this.controller.afterOwnWrite()
      this.close()
      return
    }
    switch (answer.code) {
      case 'version-conflict': {
        // 权威值来自冲突应答；要求显式确认，绝不自动覆盖。
        const authoritative = answer.row === null ? [] : [...answer.row.tags]
        this.observedVersion = answer.row === null ? null : answer.row.version
        this.patch({
          phase: 'conflict',
          message: 'version-conflict',
          authoritative: Object.freeze(authoritative),
        })
        void this.controller.refresh()
        return
      }
      case 'tags-invalid':
        this.patch({ phase: 'error', message: answer.message, reasons: answer.reasons })
        return
      default:
        this.patch({ phase: 'error', message: answer.message })
    }
  }

  /** 关闭：清状态并还原焦点到触发元素。 */
  close(): void {
    const trigger = this.restoreFocusTo
    this.state = CLOSED_BASE
    this.restoreFocusTo = null
    this.observedVersion = null
    this.emit()
    trigger?.focus()
  }

  private patch(patch: Partial<TagEditorState>): void {
    this.state = Object.freeze({ ...this.state, ...patch })
    this.emit()
  }

  private emit(): void {
    this.notifyScheduled()
    for (const listener of [...this.listeners]) listener()
  }
}

/** 捕获当前焦点元素（非浏览器环境安全降级为 null）。 */
function captureActiveElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const active = document.activeElement
  return active instanceof HTMLElement ? active : null
}

/** 构造编辑器 hub。 */
export function createTagEditorController(deps: TagEditorDeps): TagEditorController {
  return new TagEditorController(deps)
}

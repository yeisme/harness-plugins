/**
 * Selection normalizer：DOM 选区 → `SelectionContextV2`。
 *
 * 纯事实层（DOM 探测）+ 纯推导层（context 组装/排除）分离：DOM 探测函数只
 * 读节点事实，推导函数不碰 DOM，两类都可独立测试。强制排除项：password/
 * token-like/private 字段、交互层与 Composer 自身、`data-dsh-selection-optout`
 * 祖先。stable 阈值与 viewport 检查由调用方供给事实（controller 管 debounce
 * 计时），normalizer 只做 fail-closed 判定。
 *
 * @module @yeisme/dsh-client-ui-interaction-space/selection
 */

import {
  SELECTION_STABLE_DEBOUNCE_MS,
  type SelectionContextKindV2,
  type SelectionContextSourceV2,
  type SelectionContextV2,
  validateSelectionContextV2,
} from './contracts.ts'

/** 宿主显式退出标记（编辑器根节点或任意祖先）。 */
export const SELECTION_OPT_OUT_ATTRIBUTE = 'data-dsh-selection-optout'
/** 交互层/Composer 自身标记（强制排除，防自触发）。 */
export const SELECTION_SELF_SURFACE_SELECTOR = '[data-dsh-selection-surface]'
/** 敏感输入标记（password/token-like/隐私字段）。 */
export const SENSITIVE_INPUT_PATTERN = /(?:password|passphrase|token|secret|api[-_]?key|credential|private)/i

export type SelectionExclusionReason =
  | 'no-selection'
  | 'empty-text'
  | 'unstable'
  | 'out-of-viewport'
  | 'sensitive-area'
  | 'host-opt-out'
  | 'self-surface'
  | 'unclassified'

export type NormalizedSelection =
  | { readonly status: 'context'; readonly context: SelectionContextV2 }
  | { readonly status: 'pending'; readonly reason: 'unstable' }
  | { readonly status: 'excluded'; readonly reason: SelectionExclusionReason }

// ---------------------------------------------------------------------------
// DOM 事实探测（只读，不修改 DOM）
// ---------------------------------------------------------------------------

export function hostOptOut(node: Node | null): boolean {
  return ancestorMatch(node, current => current instanceof Element && current.hasAttribute(SELECTION_OPT_OUT_ATTRIBUTE))
}

export function insideSelfSurface(node: Node | null): boolean {
  return ancestorMatch(node, current => current instanceof Element && current.matches(SELECTION_SELF_SURFACE_SELECTOR))
}

/** password 输入、token-like 命名或显式 private 标记的控件。 */
export function sensitiveControl(node: Node | null): boolean {
  // 只用 Element 面 + tagName/getAttribute：不依赖 HTMLElement/InputElement
  // 全局（Node 冒烟宿主可能只注入部分 DOM 接口）。
  return ancestorMatch(node, current => {
    if (!(current instanceof Element)) return false
    const tag = current.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (current.getAttribute('type') === 'password') return true
      const name = [
        current.getAttribute('name') ?? '',
        current.getAttribute('id') ?? '',
        current.getAttribute('autocomplete') ?? '',
        current.getAttribute('data-dsh-private') ?? '',
      ].join(' ')
      if (SENSITIVE_INPUT_PATTERN.test(name)) return true
    }
    return current.getAttribute('aria-private') === 'true'
  })
}

export interface Classification {
  readonly kind: SelectionContextKindV2
  readonly source: SelectionContextSourceV2
}

/**
 * 按 DOM 事实分类选区上下文。映射优先级：
 * editable control > 表格 > 源码提示容器 > 图片区域 > 普通文本。
 * 普通可承载文本的容器兜底为 `text/conversation`；只有脱离文档的节点
 * （startNode 无 Element 祖先链）才返回 null（不猜测）。
 */
export function classifySelection(startNode: Node | null): Classification | null {
  let current: Node | null = startNode
  while (current !== null) {
    if (current instanceof Element) {
      const editable = current.tagName === 'INPUT' || current.tagName === 'TEXTAREA'
        || ('isContentEditable' in current && (current as { isContentEditable?: unknown }).isContentEditable === true)
      if (editable) {
        return { kind: 'editable-control', source: 'editor' }
      }
      if (current.tagName === 'TD' || current.tagName === 'TH' || current.closest('table') !== null) {
        return { kind: 'table-range', source: 'table' }
      }
      if (current.hasAttribute('data-source-line') || current.hasAttribute('data-source-start') || current.hasAttribute('data-line')) {
        return { kind: 'source', source: current.hasAttribute('data-dsh-selection-markdown') ? 'markdown' : 'file' }
      }
      if (current.tagName === 'CODE' || current.tagName === 'PRE' || current.hasAttribute('data-dsh-source-block')) {
        return { kind: 'source', source: 'file' }
      }
      if (current.tagName === 'IMG' || current.hasAttribute('data-dsh-image-region')) {
        return { kind: 'image-region', source: 'image' }
      }
      if (current.tagName === 'P' || current.tagName === 'DIV' || current.tagName === 'SPAN' || current.tagName === 'ARTICLE' || current.tagName === 'SECTION' || current.tagName === 'LI' || current.tagName === 'BLOCKQUOTE') {
        return { kind: 'text', source: 'conversation' }
      }
    }
    current = current.parentNode
  }
  return null
}

function ancestorMatch(node: Node | null, predicate: (node: Node) => boolean): boolean {
  let current: Node | null = node
  while (current !== null) {
    if (predicate(current)) return true
    current = current.parentNode
  }
  return false
}

// ---------------------------------------------------------------------------
// 纯推导：observation → context / exclusion
// ---------------------------------------------------------------------------

export interface SelectionObservation {
  /** 选中纯文本（空串 = 无有效选区）。 */
  readonly text: string
  readonly startNode: Node | null
  /** 调用方计时事实：选区已保持稳定的毫秒数。 */
  readonly stableForMs: number
  /** 选区矩形是否仍在视口内（滚出视口 = 不再渲染完整 Actions）。 */
  readonly inViewport: boolean
  /** 当前页面可用的 capability 名（由宿主/registry 探测后注入）。 */
  readonly capabilities: readonly string[]
  /** contextId 由调用方生成（页面生命周期内唯一即可）。 */
  readonly contextId: string
}

/**
 * Normalize one observation. Fail-closed：任何一个强制排除/不稳定条件命中
 * 都不产出 context；产出前再过一遍 `validateSelectionContextV2`（防调用方
 * 伪造 stableForMs 或越界 capabilities）。
 */
export function normalizeSelection(observation: SelectionObservation): NormalizedSelection {
  if (observation.startNode === null) return { status: 'excluded', reason: 'no-selection' }
  if (observation.text.trim() === '') return { status: 'excluded', reason: 'empty-text' }
  if (hostOptOut(observation.startNode)) return { status: 'excluded', reason: 'host-opt-out' }
  if (insideSelfSurface(observation.startNode)) return { status: 'excluded', reason: 'self-surface' }
  if (sensitiveControl(observation.startNode)) return { status: 'excluded', reason: 'sensitive-area' }
  if (observation.stableForMs < SELECTION_STABLE_DEBOUNCE_MS) return { status: 'pending', reason: 'unstable' }
  if (!observation.inViewport) return { status: 'excluded', reason: 'out-of-viewport' }
  const classification = classifySelection(observation.startNode)
  if (classification === null) return { status: 'excluded', reason: 'unclassified' }

  const candidate = {
    contextId: observation.contextId,
    kind: classification.kind,
    source: classification.source,
    stableForMs: observation.stableForMs,
    capabilities: observation.capabilities,
    sensitive: false,
    anchor: observation.text.trim() === ''
      ? undefined
      : { quotePreview: observation.text.replace(/\s+/g, ' ').trim().slice(0, 512) },
  }
  const validated = validateSelectionContextV2(candidate)
  if (!validated.ok) {
    // validateSelectionContextV2 已把 hostOptOut/sensitive 归为排除；这里只可能
    // 剩 shape 问题——按诚实降级处理，不产出 context。
    return validated.reason === 'opt_out'
      ? { status: 'excluded', reason: 'host-opt-out' }
      : validated.reason === 'sensitive'
        ? { status: 'excluded', reason: 'sensitive-area' }
        : validated.reason === 'unstable'
          ? { status: 'pending', reason: 'unstable' }
          : { status: 'excluded', reason: 'unclassified' }
  }
  return { status: 'context', context: validated.context }
}

/**
 * Context invalidation 检查（controller 在 scroll/resize/DOM 变化后调用）：
 * 同一 contextId 的选区若已消失、变空或被强制排除区域吞没，则宣告失效。
 */
export function selectionStillValid(observation: SelectionObservation): boolean {
  const normalized = normalizeSelection(observation)
  return normalized.status === 'context'
}

/**
 * DOM 选区 → 锚点草稿。宿主渲染器携带源码位置提示（data-source-line 系）
 * 时把渲染选区映射回源码行范围并校验单调性；提示缺失时诚实降级为
 * DomRegion 锚点，绝不从渲染顺序伪造行号。
 *
 * @module @yeisme/dsh-client-ui-selection-annotation/client
 */

import {
  computeQuoteDigest,
  type AnchorDraft,
  type DomRegionDraftV1,
  type FileRangeDraftV1,
  type MarkdownRangeDraftV1,
  type ReanchorEvidenceV1,
} from '@yeisme/dsh-selection-host'

export const QUOTE_PREVIEW_LIMIT = 512

/** Host renderers may emit any of these source-position hint attributes. */
export const SOURCE_HINT_ATTRIBUTES = [
  'data-source-line',
  'data-source-start',
  'data-source-end',
  'data-line',
] as const

export interface SourceRange {
  readonly startLine: number
  readonly endLine: number
}

export interface SelectionCapture {
  /** Selected plain text. */
  readonly text: string
  /** Node the selection starts in; hints are collected from its ancestors. */
  readonly startNode: Node | null
  /** Node the selection ends in. */
  readonly endNode: Node | null
}

export interface SelectionAnchorContext {
  /** Opaque artifact ref of the rendered surface. */
  readonly artifactRef: string
  readonly artifactVersion: string
  /** When set, the rendered surface is a projection of this source artifact. */
  readonly sourceArtifactRef?: string
}

function readHint(element: Element, attribute: string): number | undefined {
  const raw = element.getAttribute(attribute)
  if (raw === null || raw.trim() === '') return undefined
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value >= 1 ? value : undefined
}

/**
 * Walk up from a node collecting source-position hints. Returns null when no
 * ancestor carries both a start and an end hint — the caller must then
 * downgrade honestly instead of guessing line numbers.
 */
export function resolveSourceRange(node: Node | null): SourceRange | null {
  let current: Node | null = node
  while (current !== null) {
    if (current instanceof Element) {
      const start = readHint(current, 'data-source-start') ?? readHint(current, 'data-source-line') ?? readHint(current, 'data-line')
      const end = readHint(current, 'data-source-end') ?? start
      if (start !== undefined && end !== undefined) {
        // Monotonicity guard: inverted hints are corrupt, not a mapping.
        if (end < start) return null
        return { startLine: start, endLine: end }
      }
    }
    current = current.parentNode
  }
  return null
}

/**
 * Resolve a selection that may span multiple hinted blocks: take the earliest
 * start and the latest end, then validate monotonicity across blocks.
 */
export function resolveSelectionSourceRange(capture: SelectionCapture): SourceRange | null {
  const head = resolveSourceRange(capture.startNode)
  const tail = resolveSourceRange(capture.endNode)
  if (head === null && tail === null) return null
  if (head === null) return tail
  if (tail === null) return head
  if (tail.endLine < head.startLine) return null
  return {
    startLine: Math.min(head.startLine, tail.startLine),
    endLine: Math.max(head.endLine, tail.endLine),
  }
}

function previewOf(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length <= QUOTE_PREVIEW_LIMIT ? collapsed : `${collapsed.slice(0, QUOTE_PREVIEW_LIMIT - 1)}…`
}

export function buildReanchorEvidence(range: SourceRange): ReanchorEvidenceV1 {
  return {
    method: 'source-line-hints',
    matched: true,
    detail: `mapped to lines ${range.startLine}-${range.endLine}`,
  }
}

/**
 * Build an anchor draft from a DOM selection. With usable hints this yields a
 * `markdown-range` (projection → source) or `file-range` anchor; without hints
 * it downgrades to an honestly unmapped `dom-region` anchor.
 */
export async function selectionToAnchorDraft(
  capture: SelectionCapture,
  context: SelectionAnchorContext,
): Promise<AnchorDraft> {
  const quoteDigest = await computeQuoteDigest(capture.text)
  const quotePreview = previewOf(capture.text)
  const base = {
    artifactRef: context.artifactRef,
    artifactVersion: context.artifactVersion,
    quotePreview,
    quoteDigest,
  }
  const range = resolveSelectionSourceRange(capture)

  if (range !== null && context.sourceArtifactRef !== undefined) {
    const draft: MarkdownRangeDraftV1 = {
      ...base,
      kind: 'markdown-range',
      sourceArtifactRef: context.sourceArtifactRef,
      sourceStartLine: range.startLine,
      sourceEndLine: range.endLine,
      freshness: 'fresh',
      reanchorEvidence: buildReanchorEvidence(range),
    }
    return draft
  }
  if (range !== null) {
    const draft: FileRangeDraftV1 = {
      ...base,
      kind: 'file-range',
      startLine: range.startLine,
      endLine: range.endLine,
      startColumn: 0,
      endColumn: 0,
      freshness: 'fresh',
      reanchorEvidence: buildReanchorEvidence(range),
    }
    return draft
  }

  // No source hints: never fabricate line numbers.
  const selectorDigest = await computeQuoteDigest(`${context.artifactRef}::${capture.text.slice(0, 128)}`)
  const draft: DomRegionDraftV1 = {
    ...base,
    kind: 'dom-region',
    selectorDigest,
    sourceMapped: false,
    unmappedReason: 'missing-source-line-hints',
    freshness: 'unmapped',
    reanchorEvidence: { method: 'none', matched: false, detail: 'no source-position hints on rendered DOM' },
  }
  return draft
}

/** Extract a SelectionCapture from a live DOM Selection (empty when collapsed). */
export function captureFromSelection(selection: Selection | null): SelectionCapture | null {
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  const text = selection.toString()
  if (text.trim() === '') return null
  return {
    text,
    startNode: range.startContainer,
    endNode: range.endContainer,
  }
}

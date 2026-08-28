// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  captureFromSelection,
  resolveSelectionSourceRange,
  resolveSourceRange,
  selectionToAnchorDraft,
} from '../../src/client/dom-anchors.ts'

function hintedBlock(start: number, end: number, text: string): HTMLElement {
  const block = document.createElement('p')
  block.setAttribute('data-source-start', String(start))
  block.setAttribute('data-source-end', String(end))
  block.textContent = text
  return block
}

describe('markdown source mapping', () => {
  it('resolves source ranges from host-provided hints', () => {
    const block = hintedBlock(18, 24, 'package.json 内容')
    document.body.append(block)
    expect(resolveSourceRange(block.firstChild)).toEqual({ startLine: 18, endLine: 24 })
    block.remove()
  })

  it('accepts single-line hints via data-source-line', () => {
    const block = document.createElement('h1')
    block.setAttribute('data-source-line', '3')
    block.textContent = '标题'
    document.body.append(block)
    expect(resolveSourceRange(block.firstChild)).toEqual({ startLine: 3, endLine: 3 })
    block.remove()
  })

  it('returns null without hints — never guesses line numbers', () => {
    const block = document.createElement('p')
    block.textContent = '无提示段落'
    document.body.append(block)
    expect(resolveSourceRange(block.firstChild)).toBeNull()
    block.remove()
  })

  it('rejects inverted (corrupt) hints', () => {
    const block = hintedBlock(30, 12, '坏提示')
    document.body.append(block)
    expect(resolveSourceRange(block.firstChild)).toBeNull()
    block.remove()
  })

  it('spans cross-block selections with the earliest start and latest end', () => {
    const first = hintedBlock(10, 12, '第一块')
    const second = hintedBlock(20, 25, '第二块')
    document.body.append(first, second)
    expect(resolveSelectionSourceRange({ text: '跨块', startNode: first.firstChild, endNode: second.firstChild }))
      .toEqual({ startLine: 10, endLine: 25 })
    first.remove()
    second.remove()
  })

  it('builds a markdown-range anchor when a source artifact is provided', async () => {
    const block = hintedBlock(3, 9, '渲染后的标题')
    document.body.append(block)
    const draft = await selectionToAnchorDraft(
      { text: '渲染后的标题', startNode: block.firstChild, endNode: block.firstChild },
      { artifactRef: 'projection:rendered', artifactVersion: 'pv1', sourceArtifactRef: 'file:README.md' },
    )
    expect(draft.kind).toBe('markdown-range')
    if (draft.kind === 'markdown-range') {
      expect(draft.sourceArtifactRef).toBe('file:README.md')
      expect(draft.sourceStartLine).toBe(3)
      expect(draft.sourceEndLine).toBe(9)
    }
    expect(draft.reanchorEvidence?.method).toBe('source-line-hints')
    expect(draft.reanchorEvidence?.matched).toBe(true)
    block.remove()
  })

  it('downgrades honestly to an unmapped dom-region without hints', async () => {
    const block = document.createElement('p')
    block.textContent = '没有源码提示的选区'
    document.body.append(block)
    const draft = await selectionToAnchorDraft(
      { text: '没有源码提示的选区', startNode: block.firstChild, endNode: block.firstChild },
      { artifactRef: 'projection:rendered', artifactVersion: 'pv1', sourceArtifactRef: 'file:README.md' },
    )
    expect(draft.kind).toBe('dom-region')
    if (draft.kind === 'dom-region') {
      expect(draft.sourceMapped).toBe(false)
      expect(draft.unmappedReason).toBe('missing-source-line-hints')
    }
    expect(draft.freshness).toBe('unmapped')
    expect(JSON.stringify(draft)).not.toMatch(/"startLine"|"sourceStartLine"/)
    block.remove()
  })

  it('captures live selections and skips collapsed ones', () => {
    const block = hintedBlock(1, 2, '可选择的文本内容')
    document.body.append(block)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    const range = document.createRange()
    range.selectNodeContents(block)
    selection?.addRange(range)
    const capture = captureFromSelection(selection)
    expect(capture?.text).toContain('可选择的文本内容')
    selection?.removeAllRanges()
    expect(captureFromSelection(window.getSelection())).toBeNull()
    block.remove()
  })
})

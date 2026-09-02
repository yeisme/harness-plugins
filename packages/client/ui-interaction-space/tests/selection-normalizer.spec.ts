// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { classifySelection, hostOptOut, normalizeSelection, sensitiveControl } from '../src/selection/normalizer.ts'
import { SELECTION_STABLE_DEBOUNCE_MS } from '../src/selection/contracts.ts'

function observation(startNode: Node | null, overrides: Record<string, unknown> = {}): Parameters<typeof normalizeSelection>[0] {
  return {
    text: 'selected text',
    startNode,
    stableForMs: SELECTION_STABLE_DEBOUNCE_MS + 20,
    inViewport: true,
    capabilities: ['conversation.composer'],
    contextId: 'sel-test',
    ...overrides,
  } as Parameters<typeof normalizeSelection>[0]
}

describe('DOM fact probes', () => {
  it('detects host opt-out ancestors', () => {
    const root = document.createElement('div')
    root.setAttribute('data-dsh-selection-optout', '')
    const child = document.createElement('span')
    root.append(child)
    expect(hostOptOut(child)).toBe(true)
    expect(hostOptOut(document.createElement('span'))).toBe(false)
  })

  it('detects password and token-like controls', () => {
    const password = document.createElement('input')
    password.type = 'password'
    expect(sensitiveControl(password)).toBe(true)
    const token = document.createElement('input')
    token.name = 'user_token'
    expect(sensitiveControl(token)).toBe(true)
    const plain = document.createElement('input')
    plain.name = 'search'
    expect(sensitiveControl(plain)).toBe(false)
  })

  it('classifies editable controls, tables, source blocks, images and text', () => {
    expect(classifySelection(document.createElement('textarea'))).toEqual({ kind: 'editable-control', source: 'editor' })
    const cell = document.createElement('td')
    expect(classifySelection(cell)?.kind).toBe('table-range')
    const sourceLine = document.createElement('div')
    sourceLine.setAttribute('data-source-line', '12')
    expect(classifySelection(sourceLine)).toEqual({ kind: 'source', source: 'file' })
    const code = document.createElement('pre')
    expect(classifySelection(code)?.kind).toBe('source')
    expect(classifySelection(document.createElement('img'))?.kind).toBe('image-region')
    const para = document.createElement('p')
    document.body.append(para)
    para.textContent = 'hello'
    expect(classifySelection(para.firstChild)).toEqual({ kind: 'text', source: 'conversation' })
  })
})

describe('normalizeSelection (fail-closed pipeline)', () => {
  it('produces a bounded context for a stable plain-text selection', () => {
    const para = document.createElement('p')
    para.textContent = 'hello world'
    document.body.append(para)
    const result = normalizeSelection(observation(para.firstChild, { text: 'hello world' }))
    expect(result.status).toBe('context')
    if (result.status === 'context') {
      expect(result.context.kind).toBe('text')
      expect(result.context.anchor?.quotePreview).toBe('hello world')
      expect(result.context.sensitive).toBe(false)
    }
  })

  it('keeps unstable selections pending (candidate phase never renders)', () => {
    const para = document.createElement('p')
    para.textContent = 'x'
    document.body.append(para)
    expect(normalizeSelection(observation(para.firstChild, { stableForMs: 50 }))).toEqual({ status: 'pending', reason: 'unstable' })
  })

  it('excludes sensitive areas, opt-out regions and out-of-viewport selections', () => {
    const password = document.createElement('input')
    password.type = 'password'
    document.body.append(password)
    expect(normalizeSelection(observation(password))).toEqual({ status: 'excluded', reason: 'sensitive-area' })
    const optout = document.createElement('div')
    optout.setAttribute('data-dsh-selection-optout', '')
    const child = document.createElement('span')
    optout.append(child)
    document.body.append(optout)
    expect(normalizeSelection(observation(child))).toEqual({ status: 'excluded', reason: 'host-opt-out' })
    const para = document.createElement('p')
    para.textContent = 'visible text'
    document.body.append(para)
    expect(normalizeSelection(observation(para.firstChild, { inViewport: false }))).toEqual({ status: 'excluded', reason: 'out-of-viewport' })
  })

  it('excludes the interaction layer itself (self-surface)', () => {
    const root = document.createElement('div')
    root.setAttribute('data-dsh-selection-surface', '')
    const span = document.createElement('span')
    root.append(span)
    document.body.append(root)
    expect(normalizeSelection(observation(span))).toEqual({ status: 'excluded', reason: 'self-surface' })
  })

  it('bounds the quote preview to 512 chars', () => {
    const para = document.createElement('p')
    para.textContent = 'y'.repeat(900)
    document.body.append(para)
    const result = normalizeSelection(observation(para.firstChild, { text: 'y'.repeat(900) }))
    expect(result.status).toBe('context')
    if (result.status === 'context') expect(result.context.anchor?.quotePreview?.length).toBeLessThanOrEqual(512)
  })
})

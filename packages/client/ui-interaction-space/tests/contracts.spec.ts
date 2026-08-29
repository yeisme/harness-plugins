import { describe, expect, it } from 'vitest'
import { ingestSpaceDirective, proposalPayloadBytes, SPACE_PROTOCOL_LIMITS, tableRangeAnchorDraft } from '../src/contracts.ts'

const AT = '2026-08-29T10:00:00Z'
const DIGEST = 'a'.repeat(64)

function validPropose(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    directiveId: 'dir-1',
    kind: 'propose',
    createdAt: AT,
    proposal: {
      proposalId: 'prop-1',
      anchorIds: ['anc-1'],
      baseVersion: 'v1',
      safeSummary: '修正表头拼写',
      payload: {
        format: 'table-cells',
        sheetId: 'sheet-1',
        cells: [{ row: 1, col: 2, before: 'Naem', after: 'Name' }],
      },
    },
    ...overrides,
  }
}

const CONTEXT = {
  knownAnchorIds: new Set(['anc-1']),
  activeProposalIds: new Set<string>(),
  seenDirectiveIds: new Set<string>(),
}

describe('space directive contracts', () => {
  it('accepts the five directive kinds', () => {
    expect(ingestSpaceDirective({ directiveId: 'd1', kind: 'focus', resourceKey: 'space:dsh:x@v1', createdAt: AT }, CONTEXT).ok).toBe(true)
    expect(ingestSpaceDirective({ directiveId: 'd2', kind: 'highlight', anchorIds: ['anc-1'], createdAt: AT }, CONTEXT).ok).toBe(true)
    expect(ingestSpaceDirective(validPropose(), CONTEXT).ok).toBe(true)
    expect(ingestSpaceDirective({ directiveId: 'd4', kind: 'request-input', prompt: '选哪个方案？', options: ['A', 'B'], createdAt: AT }, CONTEXT).ok).toBe(true)
    expect(ingestSpaceDirective({ directiveId: 'd5', kind: 'progress', runRef: 'ordo:run-1', stage: 'rendering', percent: 42, createdAt: AT }, CONTEXT).ok).toBe(true)
  })

  it('rejects unknown kinds and malformed shapes (fail-closed)', () => {
    expect(ingestSpaceDirective({ directiveId: 'x', kind: 'dominate', createdAt: AT }, CONTEXT).ok).toBe(false)
    expect(ingestSpaceDirective({ directiveId: 'x', kind: 'highlight', anchorIds: [], createdAt: AT }, CONTEXT).ok).toBe(false)
    expect(ingestSpaceDirective({ directiveId: 'x', kind: 'request-input', prompt: '', createdAt: AT }, CONTEXT).ok).toBe(false)
    expect(ingestSpaceDirective({ directiveId: 'x', kind: 'progress', runRef: '../escape', stage: 's', createdAt: AT }, CONTEXT).ok).toBe(false)
    expect(ingestSpaceDirective('not-an-object', CONTEXT).ok).toBe(false)
  })

  it('rejects directives referencing unknown anchors', () => {
    const result = ingestSpaceDirective({ directiveId: 'd', kind: 'highlight', anchorIds: ['anc-missing'], createdAt: AT }, CONTEXT)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.rejection.code).toBe('unknown_anchor')
  })

  it('rejects duplicate directive ids and active proposal ids', () => {
    const seen = { ...CONTEXT, seenDirectiveIds: new Set(['dir-1']) }
    expect(ingestSpaceDirective(validPropose(), seen).ok).toBe(false)
    const active = { ...CONTEXT, activeProposalIds: new Set(['prop-1']) }
    const result = ingestSpaceDirective(validPropose(), active)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.rejection.code).toBe('proposal_budget')
  })

  it('enforces the diff byte budget', () => {
    const big = validPropose()
    const proposal = big.proposal as Record<string, unknown>
    // 200 个 2KB 单元格 ≈ 800KB：通过 schema 边界但超过 256KB 字节预算。
    proposal.payload = {
      format: 'table-cells',
      sheetId: 'sheet-1',
      cells: Array.from({ length: 200 }, (_, index) => ({ row: index + 1, col: 1, before: 'x'.repeat(2000), after: 'y'.repeat(2000) })),
    }
    const result = ingestSpaceDirective(big, CONTEXT)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.rejection.code).toBe('diff_payload_too_large')
  })

  it('rejects inverted hunk/cell ranges', () => {
    const inverted = validPropose()
    const proposal = inverted.proposal as Record<string, unknown>
    proposal.payload = { format: 'text-hunk', hunks: [{ startLine: 9, endLine: 4, before: 'a', after: 'b' }] }
    expect(ingestSpaceDirective(inverted, CONTEXT).ok).toBe(false)
  })

  it('counts proposal payload bytes deterministically', () => {
    const parsed = ingestSpaceDirective(validPropose(), CONTEXT)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(proposalPayloadBytes(parsed.directive.kind === 'propose' ? parsed.directive.proposal : undefined as never)).toBeGreaterThan(0)
  })
})

describe('tableRangeAnchorDraft', () => {
  it('normalizes inverted ranges and clamps the quote preview', () => {
    const draft = tableRangeAnchorDraft({
      anchorId: 'anc-9',
      artifactRef: 'file:data.csv',
      artifactVersion: 'v1',
      sheetId: 'sheet-1',
      rowFrom: 7,
      rowTo: 3,
      colFrom: 4,
      colTo: 2,
      quotePreview: 'x'.repeat(999),
      quoteDigest: DIGEST,
      createdAt: AT,
    })
    expect(draft.kind).toBe('table-range')
    expect(draft.rowFrom).toBe(3)
    expect(draft.rowTo).toBe(7)
    expect(draft.colFrom).toBe(2)
    expect(draft.colTo).toBe(4)
    expect(draft.quotePreview.length).toBeLessThanOrEqual(512)
  })
})

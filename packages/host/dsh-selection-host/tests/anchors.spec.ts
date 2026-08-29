import { describe, expect, it } from 'vitest'
import {
  computeQuoteDigest,
  isMarkerLabel,
  isQuoteDigest,
  markerLabel,
  parseSelectionAnchor,
  probeDesktopCaptureOnWeb,
  probeWebCapture,
  redactUnsafeFields,
  safeParseSelectionAnchor,
  sha256Hex,
} from '../src/index.ts'

const BASE = {
  anchorId: 'anc-1',
  artifactRef: 'file:README.md',
  artifactVersion: 'v1',
  quotePreview: '# title',
  quoteDigest: 'a'.repeat(64),
  createdAt: '2026-08-28T10:00:00Z',
  freshness: 'fresh',
} as const

describe('selection anchor contracts', () => {
  it('accepts all five legacy anchor kinds', () => {
    expect(parseSelectionAnchor({ ...BASE, kind: 'file-range', startLine: 18, endLine: 24, startColumn: 0, endColumn: 12 }).kind).toBe('file-range')
    expect(parseSelectionAnchor({ ...BASE, kind: 'markdown-range', sourceArtifactRef: 'file:README.md', sourceStartLine: 3, sourceEndLine: 9 }).kind).toBe('markdown-range')
    expect(parseSelectionAnchor({ ...BASE, kind: 'dom-region', selectorDigest: 'b'.repeat(64), sourceMapped: false, unmappedReason: 'missing-source-line-hints' }).kind).toBe('dom-region')
    expect(parseSelectionAnchor({ ...BASE, kind: 'image-point', x: 0.5, y: 0.25 }).kind).toBe('image-point')
    expect(parseSelectionAnchor({ ...BASE, kind: 'image-region', x: 0.1, y: 0.1, width: 0.2, height: 0.2 }).kind).toBe('image-region')
  })

  it('accepts table-range anchors with monotonic data coordinates', () => {
    const anchor = parseSelectionAnchor({ ...BASE, kind: 'table-range', sheetId: 'sheet-1', rowFrom: 3, rowTo: 7, colFrom: 2, colTo: 4 })
    expect(anchor.kind).toBe('table-range')
    if (anchor.kind === 'table-range') {
      expect(anchor.sheetId).toBe('sheet-1')
      expect(anchor.rowFrom).toBe(3)
      expect(anchor.rowTo).toBe(7)
    }
  })

  it('rejects inverted or non-integer table ranges', () => {
    expect(safeParseSelectionAnchor({ ...BASE, kind: 'table-range', sheetId: 'sheet-1', rowFrom: 7, rowTo: 3, colFrom: 2, colTo: 4 }).success).toBe(false)
    expect(safeParseSelectionAnchor({ ...BASE, kind: 'table-range', sheetId: 'sheet-1', rowFrom: 3, rowTo: 7, colFrom: 4, colTo: 2 }).success).toBe(false)
    expect(safeParseSelectionAnchor({ ...BASE, kind: 'table-range', sheetId: 'sheet-1', rowFrom: 3.5, rowTo: 7, colFrom: 2, colTo: 4 }).success).toBe(false)
    expect(safeParseSelectionAnchor({ ...BASE, kind: 'table-range', sheetId: '', rowFrom: 3, rowTo: 7, colFrom: 2, colTo: 4 }).success).toBe(false)
  })

  it('rejects anchors without a quote digest (fail-closed)', () => {
    const result = safeParseSelectionAnchor({ ...BASE, kind: 'file-range', startLine: 1, endLine: 2, startColumn: 0, endColumn: 1, quoteDigest: 'nothex' })
    expect(result.success).toBe(false)
  })

  it('rejects unknown fields so the persisted shape is an allowlist', () => {
    const result = safeParseSelectionAnchor({
      ...BASE,
      kind: 'file-range',
      startLine: 1,
      endLine: 2,
      startColumn: 0,
      endColumn: 1,
      authorization: 'Bearer x',
    })
    expect(result.success).toBe(false)
  })

  it('rejects inverted line ranges and out-of-unit image coordinates', () => {
    expect(safeParseSelectionAnchor({ ...BASE, kind: 'file-range', startLine: 9, endLine: 4, startColumn: 0, endColumn: 1 }).success).toBe(false)
    expect(safeParseSelectionAnchor({ ...BASE, kind: 'image-region', x: 0.9, y: 0.1, width: 0.5, height: 0.2 }).success).toBe(false)
    expect(safeParseSelectionAnchor({ ...BASE, kind: 'image-point', x: 1.5, y: 0.5 }).success).toBe(false)
  })

  it('requires dom-region anchors to be honestly unmapped', () => {
    expect(safeParseSelectionAnchor({ ...BASE, kind: 'dom-region', selectorDigest: 'b'.repeat(64), sourceMapped: true }).success).toBe(false)
    expect(safeParseSelectionAnchor({ ...BASE, kind: 'dom-region', selectorDigest: 'b'.repeat(64), sourceMapped: false }).success).toBe(true)
  })

  it('computes deterministic sha-256 digests', async () => {
    const digest = await computeQuoteDigest('希望 Agent 如何处理这个位置？')
    expect(isQuoteDigest(digest)).toBe(true)
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('validates marker labels', () => {
    expect(markerLabel(3)).toBe('#3')
    expect(isMarkerLabel('#3')).toBe(true)
    expect(isMarkerLabel('#9999')).toBe(false)
    expect(isMarkerLabel('3')).toBe(false)
  })

  it('redacts unsafe keys deeply for logs and evidence', () => {
    const redacted = redactUnsafeFields({
      anchorId: 'anc-1',
      nested: { cookie: 'session=1', safe: 'ok' },
      items: [{ token: 't' }, { note: 'n' }],
    }) as Record<string, unknown>
    expect((redacted.nested as Record<string, unknown>).cookie).toBe('[REDACTED]')
    expect((redacted.nested as Record<string, unknown>).safe).toBe('ok')
    expect((redacted.items as Record<string, string>[])[0].token).toBe('[REDACTED]')
  })

  it('keeps desktop capture unavailable on web with an explicit owner reason', () => {
    const probe = probeDesktopCaptureOnWeb()
    expect(probe.available).toBe(false)
    expect(probe.reason).toContain('Desktop Client')
  })

  it('probes web capture by adapter presence', () => {
    expect(probeWebCapture(undefined).available).toBe(false)
    expect(probeWebCapture({
      capability: 'WebCaptureCapabilityV1',
      previewScope: () => ({ kind: 'viewport', redaction: { maskPasswordInputs: true, privateRegionCount: 0 }, requiresConfirmation: true }),
      capture: async () => { throw new Error('unused') },
      deleteArtifact: async () => {},
    }).available).toBe(true)
  })
})

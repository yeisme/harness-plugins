import { describe, expect, it } from 'vitest'
import {
  MAX_TAG_BYTES,
  MAX_TAGS_PER_SESSION,
  normalizeTagText,
  normalizeTags,
  tagUtf8Bytes,
  tagsMaterialEqual,
  validateNormalizedTag,
} from '../src/tags.ts'

describe('v1 tag model', () => {
  it('normalizes with NFKC then trim, preserving case', () => {
    expect(normalizeTagText('  UI  ')).toBe('UI')
    expect(normalizeTagText('Ç')).toBe('Ç') // combining sequence -> precomposed
    expect(normalizeTagText('ﬁles')).toBe('files') // NFKC folds ligature
    expect(normalizeTagText('UI')).not.toBe('ui')
  })

  it('accepts legal tag sets in first-seen order', () => {
    const result = normalizeTags([' 工作 ', 'research', 'UI', '工作'])
    expect(result).toEqual({ ok: true, tags: ['工作', 'research', 'UI'] })
  })

  it('dedupes after normalization', () => {
    const result = normalizeTags(['ui', ' ui ', 'UI'])
    expect(result).toEqual({ ok: true, tags: ['ui', 'UI'] })
  })

  it('rejects empty tags after normalization', () => {
    expect(normalizeTags(['   '])).toMatchObject({ ok: false, reasons: ['empty'] })
    expect(normalizeTags(['　'])).toMatchObject({ ok: false, reasons: ['empty'] })
  })

  it('rejects NUL and C0/C1 control characters', () => {
    const nul = String.fromCharCode(0)
    const bel = String.fromCharCode(7)
    const c1 = String.fromCharCode(0x85)
    expect(normalizeTags([`a${nul}b`])).toMatchObject({ ok: false, reasons: ['control-character'] })
    expect(normalizeTags([`x${bel}`])).toMatchObject({ ok: false, reasons: ['control-character'] })
    expect(normalizeTags([`y${c1}z`])).toMatchObject({ ok: false, reasons: ['control-character'] })
    expect(validateNormalizedTag('plain')).toBeUndefined()
  })

  it('enforces the 64-byte per-tag limit in UTF-8', () => {
    const sixtyFourAscii = 'a'.repeat(64)
    expect(tagUtf8Bytes(sixtyFourAscii)).toBe(64)
    expect(validateNormalizedTag(sixtyFourAscii)).toBeUndefined()
    expect(validateNormalizedTag('a'.repeat(65))).toBe('too-long')
    // 22 CJK chars = 66 bytes
    expect(validateNormalizedTag('工'.repeat(22))).toBe('too-long')
    expect(MAX_TAG_BYTES).toBe(64)
  })

  it('enforces the 12-tag limit on the deduped set', () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => `t${i}`)
    expect(normalizeTags(thirteen)).toMatchObject({ ok: false, reasons: ['too-many'] })
    const twelve = thirteen.slice(0, 12)
    expect(normalizeTags(twelve).ok).toBe(true)
    expect(MAX_TAGS_PER_SESSION).toBe(12)
  })

  it('reports every violation category at once', () => {
    const result = normalizeTags(['', String.fromCharCode(1), 'a'.repeat(65), ...Array.from({ length: 13 }, (_, i) => `t${i}`)])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons).toContain('empty')
      expect(result.reasons).toContain('control-character')
      expect(result.reasons).toContain('too-long')
      expect(result.reasons).toContain('too-many')
    }
  })

  it('compares material equality order-sensitively', () => {
    expect(tagsMaterialEqual(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(tagsMaterialEqual(['a', 'b'], ['b', 'a'])).toBe(false)
    expect(tagsMaterialEqual([], [])).toBe(true)
  })
})

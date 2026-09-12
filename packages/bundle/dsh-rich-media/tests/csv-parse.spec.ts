import { describe, expect, it } from 'vitest'
import { CSV_PARSE_BUDGET, delimiterOfMediaType, parseDelimitedTable } from '../src/client/preview/csv-parse.ts'

describe('parseDelimitedTable', () => {
  it.each([
    ['中文', 5, '中', true],
    ['中文', 6, '中文', false],
    ['a😀b', 4, 'a', true],
    ['a😀b', 5, 'a😀', true],
    ['a😀b', 6, 'a😀b', false],
  ])('enforces UTF-8 byte bounds for %s at %i bytes', (source, maxBytes, prefix, truncated) => {
    const result = parseDelimitedTable(source as string, ',', { ...CSV_PARSE_BUDGET, maxBytes: maxBytes as number })
    expect(result.rows).toEqual([[prefix]])
    expect(result.truncated).toBe(truncated)
    expect(new TextEncoder().encode(result.rows[0]![0]).length).toBeLessThanOrEqual(maxBytes as number)
  })
  it.each([0, -1, NaN, Infinity, 1.5])('rejects invalid budget %s', maxBytes => {
    expect(() => parseDelimitedTable('a', ',', { ...CSV_PARSE_BUDGET, maxBytes })).toThrow(RangeError)
  })

  it.each([
    ['a,"unfinished', 'unclosed_quote', 2],
    ['a,b"c', 'unexpected_quote', 3],
    ['"a"tail,b', 'trailing_quoted_field', 3],
  ])('reports a bounded first diagnostic for %s', (source, code, offset) => {
    expect(parseDelimitedTable(source as string).diagnostic).toEqual({ code, offset })
  })
  it('keeps legal multiline and escaped quotes diagnostic-free', () => {
    expect(parseDelimitedTable('name,note\n"a,b","line1\nline2 ""quoted"""').diagnostic).toBeUndefined()
  })

  it('parses plain rows and columns', () => {
    const result = parseDelimitedTable('a,b,c\n1,2,3')
    expect(result.rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
    expect(result.truncated).toBe(false)
    expect(result.reason).toBeUndefined()
  })

  it('parses quoted fields with delimiters inside', () => {
    const result = parseDelimitedTable('"a,b",c\n"x,y",z')
    expect(result.rows).toEqual([['a,b', 'c'], ['x,y', 'z']])
  })

  it('parses escaped quotes as literal quotes', () => {
    expect(parseDelimitedTable('"say ""hi""",b').rows).toEqual([['say "hi"', 'b']])
  })

  it('parses embedded newlines inside quoted fields', () => {
    const result = parseDelimitedTable('"line1\nline2",b\nnext,c')
    expect(result.rows).toEqual([['line1\nline2', 'b'], ['next', 'c']])
  })

  it('treats CRLF and lone CR as row separators', () => {
    expect(parseDelimitedTable('a,b\r\nc,d').rows).toEqual([['a', 'b'], ['c', 'd']])
    expect(parseDelimitedTable('a,b\rc,d').rows).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('supports tab delimiter for TSV', () => {
    expect(parseDelimitedTable('a\tb\nc\td', '\t').rows).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('does not emit a trailing empty row', () => {
    expect(parseDelimitedTable('a,b\n').rows).toEqual([['a', 'b']])
    expect(parseDelimitedTable('').rows).toEqual([])
  })

  it('keeps a quoted field cut by the byte clamp well-formed', () => {
    const clamped = parseDelimitedTable('"unclosed extra"', ',', { ...CSV_PARSE_BUDGET, maxBytes: 9 })
    expect(clamped.truncated).toBe(true)
    expect(clamped.reason).toBe('bytes')
    expect(clamped.rows).toEqual([['unclosed']])
  })

  it('marks row-budget truncation without losing the flag', () => {
    const budget = { ...CSV_PARSE_BUDGET, maxRows: 2, maxColumns: 8 }
    const result = parseDelimitedTable('1\n2\n3', ',', budget)
    expect(result.rows).toEqual([['1'], ['2']])
    expect(result.truncated).toBe(true)
    expect(result.reason).toBe('rows')
  })

  it('caps columns and marks column truncation', () => {
    const budget = { ...CSV_PARSE_BUDGET, maxRows: 8, maxColumns: 2 }
    const result = parseDelimitedTable('a,b,c,d', ',', budget)
    expect(result.rows).toEqual([['a', 'b']])
    expect(result.truncated).toBe(true)
    expect(result.reason).toBe('columns')
  })
})

describe('delimiterOfMediaType', () => {
  it('routes TSV to tabs and everything else to commas', () => {
    expect(delimiterOfMediaType('text/tab-separated-values')).toBe('\t')
    expect(delimiterOfMediaType('TEXT/TAB-SEPARATED-VALUES')).toBe('\t')
    expect(delimiterOfMediaType('text/csv')).toBe(',')
    expect(delimiterOfMediaType(undefined)).toBe(',')
  })
})

/**
 * Bounded RFC4180 CSV/TSV parser (file-preview-formats 1.1). Lenient on
 * stray quotes and mixed EOLs; hard budgets on bytes/rows/columns with a
 * truncated flag instead of unbounded memory. Zero dependencies.
 *
 * @module @yeisme/dsh-rich-media/client
 */

export interface CsvParseBudget {
  readonly maxBytes: number
  readonly maxRows: number
  readonly maxColumns: number
}

export const CSV_PARSE_BUDGET: CsvParseBudget = Object.freeze({
  maxBytes: 4 * 1024 * 1024,
  maxRows: 20_000,
  maxColumns: 256,
})

export type CsvTruncateReason = 'bytes' | 'rows' | 'columns'

export interface CsvParseResult {
  readonly rows: readonly (readonly string[])[]
  readonly truncated: boolean
  readonly reason: CsvTruncateReason | undefined
  /** First syntax diagnostic; rows retain the existing lenient interpretation. */
  readonly diagnostic?: { readonly code: 'unclosed_quote' | 'unexpected_quote' | 'trailing_quoted_field'; readonly offset: number }
}

/** `text/tab-separated-values` uses tabs; every other delimiter is a comma. */
export function delimiterOfMediaType(mediaType: string | undefined): ',' | '\t' {
  return mediaType?.toLowerCase() === 'text/tab-separated-values' ? '\t' : ','
}

/**
 * Parse delimited text into bounded rows. Handles quoted fields, escaped
 * quotes (`""`), embedded newlines, and CRLF/CR/LF line endings. The input is
 * pre-clamped to `maxBytes`; a quoted field cut by the clamp closes cleanly.
 */
export function parseDelimitedTable(
  input: string,
  delimiter: ',' | '\t' = ',',
  budget: CsvParseBudget = CSV_PARSE_BUDGET,
): CsvParseResult {
  for (const limit of [budget.maxBytes, budget.maxRows, budget.maxColumns]) {
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError('CSV budgets must be positive safe integers')
  }
  // Walk only the admissible prefix instead of allocating UTF-8 for an
  // arbitrarily large source. Surrogate pairs are never cut in half.
  let end = 0
  let byteLength = 0
  while (end < input.length) {
    const point = input.codePointAt(end)!
    const bytes = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4
    if (byteLength + bytes > budget.maxBytes) break
    byteLength += bytes
    end += point > 0xffff ? 2 : 1
  }
  const text = input.slice(0, end)
  let truncated = end < input.length
  let reason: CsvTruncateReason | undefined = truncated ? 'bytes' : undefined

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let fieldStarted = false
  let quoteStart = 0
  let quoteClosed = false
  let diagnostic: CsvParseResult['diagnostic']

  const endField = (): void => {
    if (row.length < budget.maxColumns) {
      row.push(field)
    } else if (!truncated) {
      truncated = true
      reason = 'columns'
    }
    field = ''
    fieldStarted = false
    quoteClosed = false
  }
  const endRow = (): void => {
    endField()
    if (rows.length < budget.maxRows) {
      rows.push(row)
    } else if (!truncated) {
      truncated = true
      reason = 'rows'
    }
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
          quoteClosed = true
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"' && !fieldStarted) {
      inQuotes = true
      fieldStarted = true
      quoteStart = index
      continue
    }
    if (char === delimiter) {
      endField()
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      endRow()
      continue
    }
    if (diagnostic === undefined && (quoteClosed || char === '"')) diagnostic = { code: quoteClosed ? 'trailing_quoted_field' : 'unexpected_quote', offset: index }
    field += char
    fieldStarted = true
  }
  if (fieldStarted || field.length > 0 || row.length > 0) endRow()

  if (inQuotes && !truncated && diagnostic === undefined) diagnostic = { code: 'unclosed_quote', offset: quoteStart }
  return { rows, truncated, reason, ...(diagnostic === undefined ? {} : { diagnostic }) }
}

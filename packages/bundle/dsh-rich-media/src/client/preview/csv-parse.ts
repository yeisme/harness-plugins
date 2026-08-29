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
  const text = input.length > budget.maxBytes ? input.slice(0, budget.maxBytes) : input
  let truncated = input.length > budget.maxBytes
  let reason: CsvTruncateReason | undefined = truncated ? 'bytes' : undefined

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let fieldStarted = false

  const endField = (): void => {
    if (row.length < budget.maxColumns) {
      row.push(field)
    } else if (!truncated) {
      truncated = true
      reason = 'columns'
    }
    field = ''
    fieldStarted = false
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
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"' && !fieldStarted) {
      inQuotes = true
      fieldStarted = true
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
    field += char
    fieldStarted = true
  }
  if (fieldStarted || field.length > 0 || row.length > 0) endRow()

  return { rows, truncated, reason }
}

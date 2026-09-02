/**
 * CSV/TSV preview renderer (file-preview-formats 1.1 client face). Reads at
 * most 4MB through the bounded source, parses with the dependency-free
 * RFC4180 parser, promotes the first row to column labels, and renders the
 * shared paged grid. Truncation is surfaced, never hidden.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useEffect, useState } from 'react'
import type { MediaRefV1 } from '../../host/types.ts'
import { CSV_PARSE_BUDGET, delimiterOfMediaType, parseDelimitedTable } from './csv-parse.ts'
import { columnsFromHeaderRow, LocalTableGrid } from './local-table.tsx'
import { isAbortError, type BoundedSource } from './sources.ts'

export interface MediaCsvLabels {
  readonly loading: string
  readonly unavailable: string
  readonly truncated: string
}

const DEFAULT_LABELS: MediaCsvLabels = {
  loading: '正在解析表格…',
  unavailable: '此表格无法内嵌预览，请使用打开或下载。',
  truncated: '表格超出预览预算，仅显示前若干行。',
}

export interface MediaCsvRendererProps {
  readonly media: MediaRefV1
  readonly source: BoundedSource
  readonly labels?: Partial<MediaCsvLabels> | undefined
}

type CsvPreviewState =
  | { readonly phase: 'loading'; readonly rows: readonly (readonly string[])[]; readonly truncated: false }
  | { readonly phase: 'ready'; readonly rows: readonly (readonly string[])[]; readonly truncated: boolean }
  | { readonly phase: 'unsupported'; readonly rows: readonly (readonly string[])[]; readonly truncated: false }

const LOADING_STATE: CsvPreviewState = { phase: 'loading', rows: [], truncated: false }
const UNSUPPORTED_STATE: CsvPreviewState = { phase: 'unsupported', rows: [], truncated: false }

/** Bounded CSV/TSV grid preview. */
export function MediaCsvRenderer({ media, source, labels }: MediaCsvRendererProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  // Phase, rows and truncation form one parse receipt. Keeping them atomic
  // prevents a transient `ready + empty rows` projection under a busy host.
  const [state, setState] = useState<CsvPreviewState>(LOADING_STATE)

  useEffect(() => {
    const controller = new AbortController()
    setState(LOADING_STATE)
    let cancelled = false
    void source.readText(CSV_PARSE_BUDGET.maxBytes, controller.signal).then(body => {
      if (cancelled || controller.signal.aborted) return
      if (body === undefined || body.length === 0) {
        setState(UNSUPPORTED_STATE)
        return
      }
      const parsed = parseDelimitedTable(body, delimiterOfMediaType(media.mediaType))
      if (parsed.rows.length === 0) {
        setState(UNSUPPORTED_STATE)
        return
      }
      setState({ phase: 'ready', rows: parsed.rows, truncated: parsed.truncated })
    }).catch(caught => {
      if (cancelled || isAbortError(caught)) return
      setState(UNSUPPORTED_STATE)
    })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [media, source])

  if (state.phase === 'loading') return <p role="status" data-dsh-csv-preview-state="loading">{text.loading}</p>
  if (state.phase === 'unsupported') return <p role="alert" data-dsh-csv-preview-state="unsupported">{text.unavailable}</p>

  return (
    <div data-dsh-csv-preview style={{ width: '100%', minHeight: 0, display: 'grid', gap: 8 }}>
      <LocalTableGrid
        media={media}
        rows={state.rows.slice(1)}
        columns={columnsFromHeaderRow(state.rows[0])}
        note={state.truncated ? text.truncated : undefined}
        sheetId="csv"
      />
    </div>
  )
}

export default MediaCsvRenderer

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

/** Bounded CSV/TSV grid preview. */
export function MediaCsvRenderer({ media, source, labels }: MediaCsvRendererProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported'>('loading')
  const [rows, setRows] = useState<readonly (readonly string[])[]>([])
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setRows([])
    setTruncated(false)
    let cancelled = false
    void source.readText(CSV_PARSE_BUDGET.maxBytes, controller.signal).then(body => {
      if (cancelled || controller.signal.aborted) return
      if (body === undefined || body.length === 0) {
        setState('unsupported')
        return
      }
      const parsed = parseDelimitedTable(body, delimiterOfMediaType(media.mediaType))
      if (parsed.rows.length === 0) {
        setState('unsupported')
        return
      }
      setRows(parsed.rows)
      setTruncated(parsed.truncated)
      setState('ready')
    }).catch(caught => {
      if (cancelled || isAbortError(caught)) return
      setState('unsupported')
    })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [media, source])

  if (state === 'loading') return <p role="status" data-dsh-csv-preview-state="loading">{text.loading}</p>
  if (state === 'unsupported') return <p role="alert" data-dsh-csv-preview-state="unsupported">{text.unavailable}</p>

  return (
    <div data-dsh-csv-preview style={{ width: '100%', minHeight: 0, display: 'grid', gap: 8 }}>
      <LocalTableGrid
        media={media}
        rows={rows.slice(1)}
        columns={columnsFromHeaderRow(rows[0])}
        note={truncated ? text.truncated : undefined}
        sheetId="csv"
      />
    </div>
  )
}

export default MediaCsvRenderer

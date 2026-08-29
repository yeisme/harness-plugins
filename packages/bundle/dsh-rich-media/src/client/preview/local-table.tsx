/**
 * Local bounded-table bridge (file-preview-formats). Parsed rows (CSV,
 * XLSX) enter the existing `PreviewTableRenderer` grid through a
 * `createPreviewAccessHandle` with additive column schema — one grid, one
 * paging contract, no second table UI. The grid module loads lazily so
 * TanStack stays out of first paint.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import type { MediaRefV1 } from '../../host/types.ts'
import { createPreviewAccessHandle } from './access.ts'
import type {
  PreviewRendererProps,
  PreviewResourceV1,
  PreviewTableColumnV1,
} from './types.ts'

const HANDLE_TTL_MS = 10 * 60 * 1000

export const LOCAL_TABLE_BUDGET = Object.freeze({ rows: 10_000, columns: 256, cell: 2_000 })

/** Build a table-family preview resource from a media ref. */
export function tableResourceOf(media: MediaRefV1): PreviewResourceV1 {
  return {
    key: `${media.owner}:${media.ref}`,
    sourceKind: 'media',
    ref: { owner: media.owner, ref: media.ref, version: media.version },
    title: media.title,
    mediaType: media.mediaType,
    family: 'table',
    ...media.size === undefined ? {} : { size: media.size },
    capabilities: [...media.capabilities],
  }
}

/** Promote the first row of a CSV parse to display column labels. */
export function columnsFromHeaderRow(header: readonly string[] | undefined): PreviewTableColumnV1[] | undefined {
  if (header === undefined || header.length === 0) return undefined
  return header.slice(0, LOCAL_TABLE_BUDGET.columns).map((label, index) => ({
    id: `col-${index}`,
    label: label.length > 0 ? label.slice(0, LOCAL_TABLE_BUDGET.cell) : `列 ${index + 1}`,
    type: 'text',
  }))
}

/** Clamp parsed rows to the local budget, bounding cell text length. */
export function clampRows(rows: readonly (readonly string[])[]): readonly (readonly string[])[] {
  const bounded = rows.length > LOCAL_TABLE_BUDGET.rows ? rows.slice(0, LOCAL_TABLE_BUDGET.rows) : rows
  return bounded.map(row =>
    row.length > LOCAL_TABLE_BUDGET.columns ? row.slice(0, LOCAL_TABLE_BUDGET.columns) : row)
    .map(row => row.map(cell => cell.length > LOCAL_TABLE_BUDGET.cell ? `${cell.slice(0, LOCAL_TABLE_BUDGET.cell)}…` : cell))
}

export interface LocalTableGridProps {
  readonly media: MediaRefV1
  readonly rows: readonly (readonly string[])[]
  readonly columns?: readonly PreviewTableColumnV1[] | undefined
  /** Optional truncation note rendered above the grid. */
  readonly note?: string | undefined
  /** Sheet id for `data-source-sheet` anchor hints (interaction space). */
  readonly sheetId?: string | undefined
}

/** Render parsed rows through the lazily imported paged grid. */
export function LocalTableGrid({ media, rows, columns, note, sheetId }: LocalTableGridProps) {
  const [Grid, setGrid] = useState<ComponentType<PreviewRendererProps> | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    void import('./table-renderer.tsx').then(module => {
      if (live) setGrid(() => module.PreviewTableRenderer)
    }).catch(() => {
      if (live) setFailed(true)
    })
    return () => { live = false }
  }, [])

  const access = useMemo(() => createPreviewAccessHandle({
    resource: tableResourceOf(media),
    table: clampRows(rows),
    ...columns === undefined ? {} : { columns },
    expiresAt: new Date(Date.now() + HANDLE_TTL_MS).toISOString(),
  }), [media, rows, columns])
  useEffect(() => () => { access.release('close') }, [access])

  // The grid speaks 0-based pages; the handle contract is 1-based. Translate.
  const pagedAccess = useMemo(() => {
    const readTablePage = access.readTablePage
    if (readTablePage === undefined) return access
    return {
      ...access,
      async readTablePage(request: { page: number; pageSize: number }, signal?: AbortSignal) {
        const result = await readTablePage({ page: request.page + 1, pageSize: request.pageSize }, signal)
        return { ...result, page: request.page }
      },
    }
  }, [access])

  if (failed) return <p role="alert">表格渲染器加载失败。</p>
  if (Grid === undefined) return <p role="status">正在加载表格渲染器…</p>
  return (
    <div data-dsh-local-table style={{ width: '100%', minHeight: 0, display: 'grid', gap: 8 }} {...sheetId === undefined ? {} : { 'data-source-sheet': sheetId }}>
      {note !== undefined && <p role="status" style={{ margin: 0, color: 'var(--dsw-alias-text-tertiary, #92929b)', fontSize: 11 }}>{note}</p>}
      <Grid resource={tableResourceOf(media)} access={pagedAccess} />
    </div>
  )
}

export default LocalTableGrid

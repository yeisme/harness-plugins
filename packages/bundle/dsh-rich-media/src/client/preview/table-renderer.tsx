import { useEffect, useMemo, useRef, useState } from 'react'
import {
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { StructuredContentFrame } from '@yeisme/dsh-client-ui-structured-content'
import type {
  PreviewRendererDescriptorV1,
  PreviewRendererProps,
  PreviewTableColumnV1,
  PreviewTablePageV1,
  PreviewTableSortV1,
} from './types.ts'

const FEATURES = tableFeatures({
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
})

interface TableRow {
  readonly key: string
  readonly cells: readonly string[]
  /** 1-based data coordinate inside the dataset (page offset + index). */
  readonly absoluteRow: number
}

const columnHelper = createColumnHelper<typeof FEATURES, TableRow>()

const TABLE_STYLES = `
[data-dsh-preview-table]{height:100%;min-height:280px}
[data-dsh-preview-table] .dsh-table-tools{display:flex;align-items:center;gap:6px;min-width:0}
[data-dsh-preview-table] .dsh-table-search{width:min(210px,30vw);min-height:28px;padding:0 8px;color:inherit;background:var(--dsw-alias-bg-layer-2,#242429);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:6px;font:inherit}
[data-dsh-preview-table] .dsh-table-scroll{height:100%;min-height:240px;overflow:auto;position:relative;overscroll-behavior:contain}
[data-dsh-preview-table] table{display:grid;min-width:100%;width:max-content;border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}
[data-dsh-preview-table] thead{display:grid;position:sticky;top:0;z-index:5;background:var(--dsw-alias-bg-layer-1,#1e1e21)}
[data-dsh-preview-table] tbody{display:grid;position:relative}
[data-dsh-preview-table] tr{display:flex;min-width:100%;width:max-content}
[data-dsh-preview-table] th,[data-dsh-preview-table] td{position:relative;display:flex;align-items:center;min-width:72px;min-height:32px;padding:6px 9px;border-right:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--dsw-alias-bg-base,#171719)}
[data-dsh-preview-table] th{background:var(--dsw-alias-bg-layer-1,#1e1e21);font-size:12px;font-weight:650}
[data-dsh-preview-table] td[data-selected='true']{outline:2px solid var(--dsw-alias-border-focus,#79b8ff);outline-offset:-2px;background:var(--dsw-alias-fill-selected,rgba(101,166,255,.18))}
[data-dsh-preview-table] [data-pinned='start']{position:sticky;z-index:3;box-shadow:1px 0 var(--dsw-alias-border-l2,rgba(255,255,255,.12))}
[data-dsh-preview-table] th[data-pinned='start']{z-index:7}
[data-dsh-preview-table] .dsh-table-sort{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;padding:0;color:inherit;background:transparent;border:0;font:inherit;text-align:left;cursor:pointer}
[data-dsh-preview-table] .dsh-table-sort:disabled{cursor:not-allowed;opacity:.7}
[data-dsh-preview-table] .dsh-table-resize{position:absolute;top:0;right:-4px;width:8px;height:100%;cursor:col-resize;touch-action:none}
[data-dsh-preview-table] .dsh-table-columns{position:relative}
[data-dsh-preview-table] .dsh-table-columns>summary{cursor:pointer;list-style:none}
[data-dsh-preview-table] .dsh-table-column-menu{position:absolute;right:0;top:calc(100% + 4px);z-index:20;display:grid;gap:5px;min-width:180px;max-height:240px;overflow:auto;padding:8px;background:var(--dsw-alias-bg-elevated,#2a2a2f);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.28)}
@media(max-width:719px){[data-dsh-preview-table] .dsh-table-search{width:120px}[data-dsh-preview-table] th,[data-dsh-preview-table] td{min-height:38px}}
`

function columnAlign(column: PreviewTableColumnV1): 'left' | 'center' | 'right' {
  return column.align === 'center' ? 'center' : column.align === 'end' ? 'right' : 'left'
}

/** 1-based data row coordinate: page offset plus the in-page index. */
export function tableDataRowOf(page: PreviewTablePageV1, index: number): number {
  const pageSize = page.pageSize > 0 ? page.pageSize : page.rows.length
  return (page.page ?? 0) * pageSize + index + 1
}

function tableRows(page: PreviewTablePageV1): readonly TableRow[] {
  return page.rows.map((cells, index) => ({
    key: page.rowKeys?.[index] ?? `${page.page}:${index}`,
    cells,
    absoluteRow: tableDataRowOf(page, index),
  }))
}

export interface PreviewTableRendererLabels {
  loading?: string
  unsupported?: string
  failed?: string
  search?: string
  columns?: string
  copyCell?: string
  copyRow?: string
  previous?: string
  next?: string
  globalUnavailable?: string
}

const DEFAULT_LABELS: Required<PreviewTableRendererLabels> = {
  loading: 'Loading table…',
  unsupported: 'The owner did not provide a table schema.',
  failed: 'Table preview failed',
  search: 'Search all rows',
  columns: 'Columns',
  copyCell: 'Copy cell',
  copyRow: 'Copy row',
  previous: 'Previous page',
  next: 'Next page',
  globalUnavailable: 'Global sort and search require owner query capability.',
}

/** Owner-paged CSV/TSV renderer. Global operations never silently target only loaded rows. */
export function PreviewTableRenderer({ resource, access, labels }: PreviewRendererProps) {
  const text = { ...DEFAULT_LABELS, ...labels } as Required<PreviewTableRendererLabels>
  const [pageIndex, setPageIndex] = useState(0)
  const [page, setPage] = useState<PreviewTablePageV1>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<PreviewTableSortV1>()
  const [selected, setSelected] = useState<{ row: number; column: number }>()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const querySupported = access?.queryTable !== undefined

  useEffect(() => {
    const controller = new AbortController()
    setError(undefined)
    if (access === undefined || (access.readTablePage === undefined && access.queryTable === undefined)) {
      setPage(undefined)
      setLoading(false)
      return () => { controller.abort() }
    }
    setLoading(true)
    const request = { page: pageIndex, pageSize: 200, ...(sort === undefined ? {} : { sort }), ...(search.trim() === '' ? {} : { search: search.trim() }) }
    const task = access.queryTable !== undefined
      ? access.queryTable(request, controller.signal)
      : access.readTablePage!({ page: pageIndex, pageSize: 200 }, controller.signal)
    void task.then(result => {
      if (!controller.signal.aborted) setPage(result)
    }, caught => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : String(caught))
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => { controller.abort() }
  }, [access, pageIndex, search, sort])

  const columns = page?.columns
  const columnsById = useMemo(() => new Map((columns ?? []).map(column => [column.id, column])), [columns])
  const rows = useMemo(() => page === undefined ? [] : tableRows(page), [page])
  const definitions = useMemo(() => (columns ?? []).map((column, index) => columnHelper.accessor(
    row => (row.cells[index] ?? '') as unknown,
    {
      id: column.id,
      header: column.label,
      size: column.width ?? 160,
      minSize: 72,
      maxSize: 520,
      enablePinning: true,
      enableResizing: true,
    },
  )), [columns])
  const table = useTable({
    features: FEATURES,
    data: rows,
    columns: definitions,
    columnResizeMode: 'onChange',
    initialState: {
      columnPinning: { start: columns?.[0] === undefined ? [] : [columns[0].id], end: [] },
    },
  })
  const visibleRows = table.getRowModel().rows
  const virtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 33,
    overscan: 8,
  })

  const copyValue = async (value: string): Promise<void> => {
    try { await navigator.clipboard?.writeText(value) } catch { /* optional capability */ }
  }
  const selectedRow = selected === undefined ? undefined : rows[selected.row]
  const selectedCell = selectedRow?.cells[selected?.column ?? -1]
  const statusText = error !== undefined ? `${text.failed}: ${error}`
    : columns === undefined && !loading ? text.unsupported
      : loading ? text.loading
        : page === undefined ? text.unsupported
          : `${page.loaded}${page.total === undefined ? '' : ` / ${page.total}`} rows${page.truncated ? ' · partial' : ''}`
  const state = error !== undefined ? 'error' as const
    : loading ? 'loading' as const
      : columns === undefined ? 'unsupported' as const
        : page?.truncated ? 'partial' as const
          : 'ready' as const

  const actions = <div className="dsh-table-tools">
    <input
      className="dsh-table-search"
      aria-label={text.search}
      placeholder={querySupported ? text.search : text.globalUnavailable}
      title={querySupported ? text.search : text.globalUnavailable}
      disabled={!querySupported}
      value={search}
      onChange={event => { setPageIndex(0); setSearch(event.currentTarget.value) }}
    />
    <button type="button" className="sc-action" disabled={selectedCell === undefined} onClick={() => { if (selectedCell !== undefined) void copyValue(selectedCell) }}>{text.copyCell}</button>
    <button type="button" className="sc-action" disabled={selectedRow === undefined} onClick={() => { if (selectedRow !== undefined) void copyValue(selectedRow.cells.join('\t')) }}>{text.copyRow}</button>
    <details className="dsh-table-columns">
      <summary className="sc-action">{text.columns}</summary>
      <div className="dsh-table-column-menu">
        {table.getAllLeafColumns().map((column, index) => <label key={column.id}>
          <input type="checkbox" checked={column.getIsVisible()} disabled={index === 0} onChange={column.getToggleVisibilityHandler()} /> {columns?.[index]?.label ?? column.id}
        </label>)}
      </div>
    </details>
    <button type="button" className="sc-action" disabled={pageIndex <= 0 || loading} onClick={() => { setPageIndex(value => Math.max(0, value - 1)) }}>{text.previous}</button>
    <button type="button" className="sc-action" disabled={loading || page === undefined || page.rows.length < page.pageSize || (page.total !== undefined && page.loaded >= page.total)} onClick={() => { setPageIndex(value => value + 1) }}>{text.next}</button>
  </div>

  return <div data-dsh-preview-table>
    <style data-dsh-preview-table-styles>{TABLE_STYLES}</style>
    <StructuredContentFrame kind="data-table" surface="pane" state={state} ariaLabel={resource.title} title={resource.title} actions={actions} statusText={statusText}>
      {columns !== undefined && <div ref={scrollRef} className="dsh-table-scroll" role="region" aria-label={`${resource.title} table`} tabIndex={0}>
        <table aria-rowcount={page?.total} aria-colcount={columns.length} style={{ width: table.getTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                const pinned = header.column.getIsPinned()
                const active = sort?.columnId === header.column.id ? sort.direction : undefined
                const schema = columnsById.get(header.column.id)
                return <th
                  key={header.id}
                  scope="col"
                  data-pinned={pinned || undefined}
                  style={{ width: header.getSize(), left: pinned === 'start' ? header.column.getStart('start') : undefined, textAlign: schema === undefined ? 'left' : columnAlign(schema) }}
                >
                  <button
                    type="button"
                    className="dsh-table-sort"
                    disabled={!querySupported}
                    title={querySupported ? undefined : text.globalUnavailable}
                    onClick={() => {
                      if (!querySupported) return
                      setPageIndex(0)
                      setSort(active === 'asc' ? { columnId: header.column.id, direction: 'desc' } : active === 'desc' ? undefined : { columnId: header.column.id, direction: 'asc' })
                    }}
                  >
                    <span>{schema?.label ?? header.column.id}</span><span aria-hidden="true">{active === 'asc' ? '↑' : active === 'desc' ? '↓' : ''}</span>
                  </button>
                  {header.column.getCanResize() && <div className="dsh-table-resize" role="separator" aria-orientation="vertical" onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} />}
                </th>
              })}
            </tr>)}
          </thead>
          <tbody style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map(item => {
              const row = visibleRows[item.index]!
              return <tr key={row.original.key} style={{ position: 'absolute', top: 0, transform: `translateY(${item.start}px)` }} data-index={item.index} ref={virtualizer.measureElement}>
                {row.getVisibleCells().map((cell, columnIndex) => {
                  const pinned = cell.column.getIsPinned()
                  const schema = columnsById.get(cell.column.id)
                  const chosen = selected?.row === item.index && selected.column === columnIndex
                  return <td
                    key={cell.id}
                    data-pinned={pinned || undefined}
                    data-selected={chosen || undefined}
                    data-source-row={row.original.absoluteRow}
                    data-source-col={columnIndex + 1}
                    style={{ width: cell.column.getSize(), left: pinned === 'start' ? cell.column.getStart('start') : undefined, textAlign: schema === undefined ? 'left' : columnAlign(schema) }}
                    onClick={() => { setSelected({ row: item.index, column: columnIndex }) }}
                  >
                    {String(cell.getValue() ?? '')}
                  </td>
                })}
              </tr>
            })}
          </tbody>
        </table>
      </div>}
    </StructuredContentFrame>
  </div>
}

export default PreviewTableRenderer

/** Lazy-compatible descriptor for the local preview registry. */
export const previewTableRendererDescriptor: PreviewRendererDescriptorV1 = {
  id: 'yeisme:table',
  families: ['table'],
  mediaTypes: ['text/csv', 'text/tab-separated-values'],
  priority: 100,
  load: async () => PreviewTableRenderer,
}

/**
 * XLSX/XLSM preview renderer (file-preview-formats 2.3). `@e965/xlsx`
 * loads behind a lazy factory — inlined but unevaluated until the first
 * sheet opens. Each sheet is bounded (rows/columns/cell text) and rendered
 * through the shared paged grid, so no second table UI exists.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useEffect, useState } from 'react'
import type { MediaRefV1 } from '../../host/types.ts'
import { isAbortError, type BoundedSource } from './sources.ts'
import { columnsFromHeaderRow, LOCAL_TABLE_BUDGET, LocalTableGrid } from './local-table.tsx'

export const SHEET_BYTES_MAX = 16 * 1024 * 1024

/** Structural API the renderer needs (interop-unwrapped SheetJS surface). */
export interface SheetParserApi {
  read(data: Uint8Array | ArrayBuffer, opts: { type: 'array' }): {
    SheetNames: string[]
    Sheets: Record<string, { [cell: string]: unknown } | undefined>
  }
  utils: {
    sheet_to_json(worksheet: unknown, opts?: Record<string, unknown>): unknown[][]
  }
}

let sheetApi: SheetParserApi | undefined

/** Lazy boundary: only the first sheet preview evaluates the parser. */
export const lazySheetParser = async (): Promise<SheetParserApi> => {
  if (sheetApi === undefined) {
    const mod = await import('@e965/xlsx')
    const candidate = mod as unknown as SheetParserApi & { default?: SheetParserApi }
    sheetApi = typeof candidate.read === 'function' ? candidate : candidate.default!
  }
  return sheetApi
}

export function resetSheetLazyModule(): void {
  sheetApi = undefined
}

export interface ParsedSheet {
  readonly name: string
  readonly rows: readonly (readonly string[])[]
  readonly truncated: boolean
}

/** Convert `sheet_to_json(header:1)` output into bounded string rows. */
export function rowsFromSheetJson(raw: readonly unknown[][]): { rows: readonly (readonly string[])[]; truncated: boolean } {
  const rows = raw.map(row => row.map(cell => String(cell ?? '')))
  const truncated = raw.length > LOCAL_TABLE_BUDGET.rows
  return { rows, truncated }
}

export interface MediaSheetLabels {
  readonly loading: string
  readonly unavailable: string
  readonly tooLarge: string
  readonly sheet: string
  readonly truncated: string
}

const DEFAULT_LABELS: MediaSheetLabels = {
  loading: '正在解析工作簿…',
  unavailable: '此工作簿无法内嵌预览，请使用打开或下载。',
  tooLarge: '工作簿超出预览预算，请使用打开或下载。',
  sheet: '工作表',
  truncated: '工作表超出预览行数预算，仅显示前若干行。',
}

export interface MediaSheetRendererProps {
  readonly media: MediaRefV1
  readonly source: BoundedSource
  readonly labels?: Partial<MediaSheetLabels> | undefined
}

/** Multi-sheet workbook preview with bounded paged grids. */
export function MediaSheetRenderer({ media, source, labels }: MediaSheetRendererProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported' | 'too-large'>('loading')
  const [sheets, setSheets] = useState<readonly ParsedSheet[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setSheets([])
    setActive(0)
    if (media.size !== undefined && media.size > SHEET_BYTES_MAX) {
      setState('too-large')
      return () => { controller.abort() }
    }
    let cancelled = false
    void (async () => {
      const bytes = await source.readBytes(SHEET_BYTES_MAX, controller.signal)
      if (cancelled || controller.signal.aborted) return
      if (bytes === undefined || bytes.byteLength === 0) {
        setState('unsupported')
        return
      }
      const parser = await lazySheetParser()
      if (cancelled || controller.signal.aborted) return
      const workbook = parser.read(bytes, { type: 'array' })
      const parsed = workbook.SheetNames.flatMap(name => {
        const worksheet = workbook.Sheets[name]
        if (worksheet === undefined) return []
        const raw = parser.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' })
        const parsedSheet = rowsFromSheetJson(raw)
        return [{ name, rows: parsedSheet.rows, truncated: parsedSheet.truncated }]
      })
      if (cancelled || controller.signal.aborted) return
      if (parsed.length === 0 || parsed.every(sheet => sheet.rows.length === 0)) {
        setState('unsupported')
        return
      }
      setSheets(parsed)
      setState('ready')
    })().catch(caught => {
      if (cancelled || isAbortError(caught)) return
      setState('unsupported')
    })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [media, source])

  if (state === 'loading') return <p role="status" data-dsh-sheet-preview-state="loading">{text.loading}</p>
  if (state === 'too-large') return <p role="alert" data-dsh-sheet-preview-state="too-large">{text.tooLarge}</p>
  if (state === 'unsupported') return <p role="alert" data-dsh-sheet-preview-state="unsupported">{text.unavailable}</p>

  const current = sheets[Math.min(active, sheets.length - 1)]
  return (
    <div data-dsh-sheet-preview style={{ width: '100%', minHeight: 0, display: 'grid', gap: 8 }}>
      {sheets.length > 1 && (
        <div role="tablist" aria-label={text.sheet} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => { setActive(index) }}
              style={{
                padding: '3px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                border: index === active ? '1px solid var(--dsw-alias-border-focus, #79b8ff)' : '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))',
                background: index === active ? 'var(--dsw-alias-fill-active, #343438)' : 'transparent', color: 'inherit',
              }}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}
      {current !== undefined && (
        <LocalTableGrid
          key={`${media.ref}:${current.name}`}
          media={media}
          rows={current.rows.slice(1)}
          columns={columnsFromHeaderRow(current.rows[0])}
          note={current.truncated ? text.truncated : undefined}
          sheetId={current.name}
        />
      )}
    </div>
  )
}

export default MediaSheetRenderer

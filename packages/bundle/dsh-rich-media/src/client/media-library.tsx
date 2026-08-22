/**
 * Media Library body: dependency-free windowed grid over owner-projected
 * media refs (V3 5.2, differentiation lane).
 *
 * The library never holds bytes or URLs — cards carry safe metadata only.
 * Virtualization is a pure windowing helper (custom, zero deps; swap to
 * @tanstack/react-virtual when the dependency becomes available offline).
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useState, type CSSProperties } from 'react'
import type { MediaRefV1 } from '../host/types.ts'
import { previewResourceKey, type PreviewIntentV1 } from './preview/types.ts'

export type MediaLibraryStatus = 'ready' | 'loading' | 'empty' | 'partial' | 'offline' | 'error'

export interface MediaLibraryLabels {
  title?: string
  retry?: string
  compare?: string
  download?: string
  attach?: string
  open?: string
  selected?: string
  empty?: string
  offline?: string
  error?: string
  partial?: string
  loading?: string
  search?: string
  loadedLocal?: string
  nextPage?: string
  previousPage?: string
}

export interface MediaLibraryBodyProps {
  items: readonly MediaRefV1[]
  status: MediaLibraryStatus
  onRetry?: (() => void) | undefined
  onIntent?: ((intent: PreviewIntentV1) => void) | undefined
  labels?: MediaLibraryLabels | undefined
  /** Fixed row height in px used by the windowing math. */
  rowHeight?: number | undefined
  /** Visible viewport height in px for the windowing math. */
  viewportHeight?: number | undefined
  overscan?: number | undefined
  /** Owner search query; filtering stays local until the owner page arrives. */
  query?: string | undefined
  onQueryChange?: ((query: string) => void) | undefined
  /** Restrict the window to keys the owner marked loaded-local. */
  loadedLocalOnly?: boolean | undefined
  loadedKeys?: readonly string[] | undefined
  onLoadedLocalOnlyChange?: ((value: boolean) => void) | undefined
  page?: number | undefined
  total?: number | undefined
  onPageChange?: ((page: number) => void) | undefined
}

const DEFAULT_LABELS: Required<MediaLibraryLabels> = {
  title: 'Media Library',
  retry: 'Retry',
  compare: 'Compare',
  download: 'Download',
  attach: 'Attach',
  open: 'Open',
  selected: 'selected',
  empty: 'No media yet.',
  offline: 'Media source offline.',
  error: 'Media library failed to load.',
  partial: 'Some media failed to load.',
  loading: 'Loading media…',
  search: 'Search',
  loadedLocal: 'Loaded locally',
  nextPage: 'Next page',
  previousPage: 'Previous page',
}

/** Pure windowing math: [start, end) indices for a fixed-row virtual list. */
export function windowRange(
  count: number,
  rowHeight: number,
  viewportHeight: number,
  scrollTop: number,
  overscan = 4,
): { start: number; end: number; totalHeight: number } {
  const safeRow = rowHeight > 0 ? rowHeight : 1
  const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / safeRow) - overscan)
  const visible = Math.ceil((viewportHeight > 0 ? viewportHeight : 0) / safeRow) + overscan * 2
  const end = Math.min(count, first + visible)
  return { start: first, end, totalHeight: count * safeRow }
}

/** Deterministic library intent for the current selection. */
export function libraryIntent(
  selection: readonly string[],
  items: readonly MediaRefV1[],
  action: 'compare' | 'download' | 'attach' | 'open',
): PreviewIntentV1 | null {
  if (selection.length === 0) return null
  const keys = new Set(selection)
  const resourceKeys = items.filter(item => keys.has(previewResourceKey({ owner: item.owner, ref: item.ref, version: item.version }))).map(item => previewResourceKey({ owner: item.owner, ref: item.ref, version: item.version }))
  if (resourceKeys.length === 0) return null
  if (action === 'compare' && resourceKeys.length !== 2) return null
  return { kind: action, resourceKeys }
}

function formatDuration(ms: number | undefined): string | undefined {
  if (ms === undefined) return undefined
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const styles: Record<'root' | 'header' | 'status' | 'spacer' | 'viewport' | 'row' | 'meta' | 'actions' | 'toolbar', CSSProperties> = {
  root: { display: 'grid', gap: 6, fontSize: 12 },
  header: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 },
  status: { opacity: 0.8 },
  spacer: { position: 'relative', width: '100%' },
  viewport: { position: 'absolute', inset: 0, overflow: 'auto' },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' },
  meta: { opacity: 0.72 },
  actions: { display: 'flex', gap: 6, marginLeft: 'auto' },
  toolbar: { display: 'flex', gap: 6, alignItems: 'center' },
}

/** Rendered media row: metadata only, never bytes or URLs. */
export function MediaLibraryRow({ media, selected, onToggle }: { media: MediaRefV1; selected: boolean; onToggle: () => void }) {
  const meta = [
    media.kind,
    media.width !== undefined && media.height !== undefined ? `${media.width}\u00d7${media.height}` : undefined,
    formatDuration(media.duration),
  ].filter((part): part is string => part !== undefined).join(' \u00b7 ')
  return (
    <div className="media-library-row" style={{ ...styles.row, height: '100%' }} data-media-key={previewResourceKey({ owner: media.owner, ref: media.ref, version: media.version })}>
      <input type="checkbox" checked={selected} onChange={onToggle} aria-label={media.title} />
      <span>{media.title}</span>
      <span style={styles.meta}>{meta}</span>
    </div>
  )
}

function mediaKeyOf(media: MediaRefV1): string {
  return previewResourceKey({ owner: media.owner, ref: media.ref, version: media.version })
}

/** Windowed media library with multi-select typed intents and inline recovery. */
export function MediaLibraryBody({
  items, status, onRetry, onIntent, labels, rowHeight = 28, viewportHeight = 320, overscan,
  query, onQueryChange, loadedLocalOnly = false, loadedKeys, onLoadedLocalOnlyChange, page, total, onPageChange,
}: MediaLibraryBodyProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [selection, setSelection] = useState<readonly string[]>([])
  const [scrollTop, setScrollTop] = useState(0)
  const loaded = loadedKeys === undefined ? undefined : new Set(loadedKeys)
  const filtered = items.filter(media => {
    const key = mediaKeyOf(media)
    if (loadedLocalOnly && loaded !== undefined && !loaded.has(key)) return false
    const needle = query?.trim().toLocaleLowerCase() ?? ''
    if (needle.length === 0) return true
    return `${media.title} ${media.kind} ${media.mediaType}`.toLocaleLowerCase().includes(needle)
  })
  const range = windowRange(filtered.length, rowHeight, viewportHeight, scrollTop, overscan)
  const visible = filtered.slice(range.start, range.end)
  const toggle = (key: string): void => {
    setSelection(current => current.includes(key) ? current.filter(k => k !== key) : [...current, key])
  }
  const emit = (action: 'compare' | 'download' | 'attach' | 'open'): void => {
    const intent = libraryIntent(selection, filtered, action)
    if (intent !== null) onIntent?.(intent)
  }
  const shownTotal = total ?? filtered.length
  return (
    <section aria-label={text.title} data-dsh-media-library data-status={status} style={styles.root}>
      <header style={styles.header}>
        <span>{text.title}</span>
        <span style={styles.status}>{status === 'ready' ? `${selection.length} ${text.selected}` : text[status]}</span>
      </header>
      {(onQueryChange !== undefined || onLoadedLocalOnlyChange !== undefined || onPageChange !== undefined) && (
        <div style={styles.toolbar} role="search">
          {onQueryChange !== undefined && (
            <label>
              <span className="sr-only">{text.search}</span>
              <input
                value={query ?? ''}
                aria-label={text.search}
                onChange={event => { onQueryChange(event.target.value) }}
              />
            </label>
          )}
          {onLoadedLocalOnlyChange !== undefined && (
            <label>
              <input
                type="checkbox"
                checked={loadedLocalOnly}
                onChange={event => { onLoadedLocalOnlyChange(event.target.checked) }}
              />
              {text.loadedLocal}
            </label>
          )}
          {onPageChange !== undefined && page !== undefined && (
            <>
              <button type="button" disabled={page <= 1} onClick={() => { onPageChange(page - 1) }}>{text.previousPage}</button>
              <span data-page={page}>{page} / {Math.max(1, Math.ceil(shownTotal / Math.max(filtered.length, 1)))}</span>
              <button type="button" disabled={filtered.length === 0 || (page * filtered.length >= shownTotal)} onClick={() => { onPageChange(page + 1) }}>{text.nextPage}</button>
            </>
          )}
        </div>
      )}
      {(status === 'error' || status === 'offline') && onRetry !== undefined && (
        <p role="alert">
          {status === 'error' ? text.error : text.offline}{' '}
          <button type="button" onClick={onRetry}>{text.retry}</button>
        </p>
      )}
      {status === 'empty' && <p>{text.empty}</p>}
      {status === 'partial' && <p role="status">{text.partial}</p>}
      {status === 'loading' && <p role="status">{text.loading}</p>}
      {items.length > 0 && (
        <>
          <div style={styles.toolbar} role="group" aria-label={text.title}>
            <button type="button" disabled={selection.length !== 2} onClick={() => { emit('compare') }}>{text.compare}</button>
            <button type="button" disabled={selection.length === 0} onClick={() => { emit('download') }}>{text.download}</button>
            <button type="button" disabled={selection.length === 0} onClick={() => { emit('attach') }}>{text.attach}</button>
            <button type="button" disabled={selection.length !== 1} onClick={() => { emit('open') }}>{text.open}</button>
          </div>
          <div style={{ ...styles.spacer, height: range.totalHeight }} data-filtered-count={filtered.length}>
            <div
              style={styles.viewport}
              onScroll={event => { setScrollTop(event.currentTarget.scrollTop) }}
              aria-rowcount={filtered.length}
            >
              {visible.map((media, index) => {
                const key = previewResourceKey({ owner: media.owner, ref: media.ref, version: media.version })
                return (
                  <div key={key} style={{ height: rowHeight, display: 'flex', alignItems: 'center' }} role="row" aria-rowindex={range.start + index + 1}>
                    <MediaLibraryRow media={media} selected={selection.includes(key)} onToggle={() => { toggle(key) }} />
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default MediaLibraryBody

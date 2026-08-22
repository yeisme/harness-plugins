/**
 * Dependency-free gallery extras for the Rich Media Workbench: side-by-side
 * compare for two selected items and a zoom overlay with explicit controls.
 *
 * These components stay separate from `workbench.tsx` so tests can exercise
 * them without importing the workbench-core client bundle.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import type { CSSProperties } from 'react'
import type { MediaRefV1 } from '../host/types.ts'
import { RichMediaCard, type RichMediaCardLabels } from './media-card.tsx'

/** One selectable gallery item keyed by owner and opaque ref. */
export interface MediaGalleryItem {
  key: string
  media: MediaRefV1
}

export function mediaGalleryKey(media: MediaRefV1): string {
  return `${media.owner}:${media.ref}`
}

const compareStyles: Record<'wrap' | 'grid' | 'cell' | 'label' | 'hint', CSSProperties> = {
  wrap: { display: 'grid', gap: 6 },
  grid: { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  cell: { display: 'grid', gap: 4, padding: 8, borderRadius: 8, border: '1px solid var(--dsh-color-border, #3d4550)' },
  label: { fontWeight: 600, fontSize: 12 },
  hint: { fontSize: 12, opacity: 0.72 },
}

/** Side-by-side compare surface for exactly two gallery items. */
export function MediaCompareView(props: {
  items: readonly MediaGalleryItem[]
  resolveUrl?: ((media: MediaRefV1) => Promise<string>) | undefined
  labels?: RichMediaCardLabels | undefined
  texts: { aria: string; empty: string }
}) {
  const { items, resolveUrl, labels, texts } = props
  if (items.length !== 2) {
    return <p style={compareStyles.hint} data-dsh-rich-media-compare="empty">{texts.empty}</p>
  }
  return (
    <section aria-label={texts.aria} data-dsh-rich-media-compare="ready" style={compareStyles.wrap}>
      <div style={compareStyles.grid}>
        {items.map(item => (
          <div key={item.key} style={compareStyles.cell}>
            <span style={compareStyles.label}>{item.media.title}</span>
            <RichMediaCard media={item.media} src={undefined} resolveUrl={resolveUrl} labels={labels} />
          </div>
        ))}
      </div>
    </section>
  )
}

/** Zoom overlay for one gallery item with explicit zoom controls. */
export function MediaZoomOverlay(props: {
  item: MediaGalleryItem
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onClose: () => void
  resolveUrl?: ((media: MediaRefV1) => Promise<string>) | undefined
  labels?: RichMediaCardLabels | undefined
  texts: { aria: string; zoomIn: string; zoomOut: string; close: string }
}) {
  const { item, scale, onZoomIn, onZoomOut, onClose, resolveUrl, labels, texts } = props
  const clamped = Math.max(1, Math.min(4, scale))
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={texts.aria}
      data-dsh-rich-media-zoom
      data-zoom-scale={clamped}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}
      style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 8, border: '1px solid var(--dsh-color-border, #3d4550)', background: 'var(--dsh-color-layer, #18202b)' }}
    >
      <div role="group" style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onZoomIn} aria-label={texts.zoomIn}>+</button>
        <button type="button" onClick={onZoomOut} aria-label={texts.zoomOut}>&#8722;</button>
        <button type="button" onClick={onClose} aria-label={texts.close}>&#10005;</button>
      </div>
      <div style={{ overflow: 'auto' }}>
        <div style={{ transform: `scale(${clamped})`, transformOrigin: 'top left' }}>
          <RichMediaCard media={item.media} src={undefined} resolveUrl={resolveUrl} labels={labels} />
        </div>
      </div>
    </div>
  )
}

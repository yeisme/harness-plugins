/**
 * Legacy Rich Media Workbench story face.
 *
 * Production uses `MediaPreviewPane` through the Desktop Workbench. This
 * component remains self-contained for stories and migration tests and does
 * not read a reference project's source, DOM, or private API. The media tab
 * additionally exposes the dependency-free gallery extras from
 * `media-gallery.tsx`: compare for two selected items and a zoom overlay.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useMemo, useState, type CSSProperties } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { WorkbenchShell } from '@yeisme/dsh-workbench-core/client'
import { WorkbenchRegistry } from '@yeisme/dsh-workbench-core'
import type { WorkbenchTabV1 } from '@yeisme/dsh-workbench-core'
import type { MediaRefV1 } from '../host/types.ts'
import { richMediaWorkbenchModule } from '../module.ts'
import { RichMediaCard, type RichMediaCardLabels } from './media-card.tsx'
import {
  MediaCompareView,
  MediaZoomOverlay,
  mediaGalleryKey,
  type MediaGalleryItem,
} from './media-gallery.tsx'

export {
  MediaCompareView,
  MediaZoomOverlay,
  mediaGalleryKey,
  type MediaGalleryItem,
}

export type RichMediaWorkbenchProps =
  PropsRuntime<'sidebar.footer.action'> & PropsLocale<'richMedia'>

export interface RichMediaWorkbenchExtraProps {
  /** Optional Host projection; absent renders the empty media library state. */
  media?: readonly MediaRefV1[] | undefined
  /** Optional Host-authorized resolver; absent renders metadata-only cards. */
  resolveUrl?: ((media: MediaRefV1) => Promise<string>) | undefined
}

const MEDIA_TAB_ID = 'media'

function createRichMediaRegistry(): WorkbenchRegistry {
  const registry = new WorkbenchRegistry()
  registry.register(richMediaWorkbenchModule)
  return registry
}

const styles: Record<'layer' | 'panel' | 'header' | 'body' | 'grid' | 'trigger' | 'placeholder' | 'placeholderTitle' | 'placeholderBody' | 'cardActions', CSSProperties> = {
  layer: { position: 'relative', display: 'grid', gap: 6, width: '100%', padding: 4 },
  panel: { display: 'grid', gap: 8, padding: 10, borderRadius: 8, border: '1px solid var(--dsh-color-border, #3d4550)', background: 'var(--dsh-color-layer, #18202b)' },
  header: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 },
  body: { display: 'grid', gap: 8, minHeight: 80, fontSize: 12 },
  grid: { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' },
  trigger: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', minHeight: 32 },
  placeholder: { display: 'grid', gap: 4, padding: 12, borderRadius: 8, border: '1px dashed var(--dsh-color-border, #3d4550)' },
  placeholderTitle: { fontWeight: 600 },
  placeholderBody: { opacity: 0.72 },
  cardActions: { display: 'flex', gap: 6, marginTop: 4 },
}

export function RichMediaWorkbench({ wide, t, media, resolveUrl }: RichMediaWorkbenchProps & RichMediaWorkbenchExtraProps) {
  const [open, setOpen] = useState(false)
  const [activeTabId, setActiveTabId] = useState(MEDIA_TAB_ID)
  const [compareKeys, setCompareKeys] = useState<readonly string[]>([])
  const [zoomKey, setZoomKey] = useState<string | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  const registry = useMemo(createRichMediaRegistry, [])
  const tabs = registry.snapshot().tabs

  const items: readonly MediaGalleryItem[] = useMemo(
    () => (media ?? []).map(item => ({ key: mediaGalleryKey(item), media: item })),
    [media],
  )
  const zoomItem = zoomKey === null ? undefined : items.find(item => item.key === zoomKey)

  const cardLabels: RichMediaCardLabels = {
    loading: t('workbench.loading'),
    failed: t('workbench.failed'),
    retry: t('workbench.retry'),
    open: t('workbench.card.open'),
    download: t('workbench.card.download'),
    pdfFallback: t('workbench.pdfFallback'),
  }

  const toggleCompare = (key: string): void => {
    setCompareKeys(selected => (
      selected.includes(key)
        ? selected.filter(entry => entry !== key)
        : [...selected.slice(-1), key]
    ))
  }

  const renderTab = (tab: WorkbenchTabV1) => {
    if (tab.id === MEDIA_TAB_ID) {
      if (items.length === 0) return <p>{t('workbench.empty')}</p>
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          {compareKeys.length === 2 && (
            <MediaCompareView
              items={items.filter(item => compareKeys.includes(item.key))}
              resolveUrl={resolveUrl}
              labels={cardLabels}
              texts={{ aria: t('workbench.compare.aria'), empty: t('workbench.compare.empty') }}
            />
          )}
          <div style={styles.grid}>
            {items.map(item => (
              <div key={item.key} style={{ display: 'grid', gap: 4 }}>
                <RichMediaCard media={item.media} src={undefined} resolveUrl={resolveUrl} labels={cardLabels} />
                <div style={styles.cardActions}>
                  <button
                    type="button"
                    aria-pressed={compareKeys.includes(item.key) || undefined}
                    aria-label={t('workbench.card.compare')}
                    onClick={() => { toggleCompare(item.key) }}
                  >
                    {t('workbench.card.compare')}
                  </button>
                  <button
                    type="button"
                    aria-label={t('workbench.card.zoom')}
                    onClick={() => { setZoomKey(item.key); setZoomScale(1) }}
                  >
                    {t('workbench.card.zoom')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div style={styles.placeholder}>
        <span style={styles.placeholderTitle}>{t('workbench.placeholder.title')}</span>
        <span style={styles.placeholderBody}>{t('workbench.placeholder.body')}</span>
      </div>
    )
  }

  return (
    <div style={styles.layer} data-dsh-rich-media-workbench>
      {open && (
        <section style={styles.panel} aria-label={t('workbench.aria')}>
          <header style={styles.header}>{t('workbench.aria')}</header>
          <div style={styles.body}>
            <WorkbenchShell
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={setActiveTabId}
              renderTab={renderTab}
              status={`${tabs.length} tabs · ${registry.snapshot().commands.length} commands`}
            />
          </div>
          {zoomItem !== undefined && (
            <MediaZoomOverlay
              item={zoomItem}
              scale={zoomScale}
              onZoomIn={() => { setZoomScale(value => Math.min(4, value + 0.5)) }}
              onZoomOut={() => { setZoomScale(value => Math.max(1, value - 0.5)) }}
              onClose={() => { setZoomKey(null); setZoomScale(1) }}
              resolveUrl={resolveUrl}
              labels={cardLabels}
              texts={{
                aria: t('workbench.zoom.aria'),
                zoomIn: t('workbench.zoom.in'),
                zoomOut: t('workbench.zoom.out'),
                close: t('workbench.zoom.close'),
              }}
            />
          )}
        </section>
      )}
      <button
        type="button"
        style={styles.trigger}
        data-active={open || undefined}
        aria-label={t('workbench.aria')}
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        <span>{t('workbench.trigger')}</span>
        {wide && <span aria-hidden="true">&#9638;</span>}
      </button>
    </div>
  )
}

export default RichMediaWorkbench

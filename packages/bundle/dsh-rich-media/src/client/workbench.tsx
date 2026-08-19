/**
 * Rich Media Workbench sidebar face.
 *
 * This is a reference-sidebar-inspired workbench re-created for the Rich
 * Media plugin. It consumes the Workbench Core (`WorkbenchRegistry` and
 * `WorkbenchShell`) and uses the official `sidebar.footer.action` slot. It
 * does not read the reference project's source, DOM, or private API.
 *
 * The current slice registers the Rich Media module into Workbench Core and
 * provides the media library tab; File/Terminal/Git/Browser tabs are
 * placeholders to be filled through official DSH seams in later phases.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useMemo, useState, type CSSProperties } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { WorkbenchShell } from '@yeisme/dsh-workbench-core/client'
import { WorkbenchRegistry } from '@yeisme/dsh-workbench-core'
import type { WorkbenchModuleDefinitionV1, WorkbenchTabV1 } from '@yeisme/dsh-workbench-core'
import type { MediaRefV1 } from '../host/types.ts'
import { RichMediaCard } from './media-card.tsx'

export type RichMediaWorkbenchProps =
  PropsRuntime<'sidebar.footer.action'> & PropsLocale<'richMedia'>

export interface RichMediaWorkbenchExtraProps {
  /** Optional Host projection; absent renders the empty media library state. */
  media?: readonly MediaRefV1[] | undefined
  /** Optional Host-authorized resolver; absent renders metadata-only cards. */
  resolveUrl?: ((media: MediaRefV1) => Promise<string>) | undefined
}

const MEDIA_TAB_ID = 'media'

const richMediaWorkbenchModule: WorkbenchModuleDefinitionV1 = {
  id: 'dsh-rich-media',
  version: '0.1.0-rc.1',
  title: 'Rich Media',
  description: 'DSH rich media library and preview workbench',
  requiredCapabilities: [],
  tabs: [
    { id: MEDIA_TAB_ID, moduleId: 'dsh-rich-media', title: '媒体库', order: 0, closable: false, scope: 'session-maybe' },
    { id: 'files', moduleId: 'dsh-rich-media', title: '文件', order: 10, closable: false, scope: 'session-maybe' },
    { id: 'terminal', moduleId: 'dsh-rich-media', title: '终端', order: 20, closable: false, scope: 'session-maybe' },
    { id: 'git', moduleId: 'dsh-rich-media', title: 'Git', order: 30, closable: false, scope: 'session-maybe' },
    { id: 'browser', moduleId: 'dsh-rich-media', title: '浏览器', order: 40, closable: false, scope: 'session-maybe' },
  ],
  commands: [
    { id: 'media.open', moduleId: 'dsh-rich-media', title: '打开媒体' },
    { id: 'media.download', moduleId: 'dsh-rich-media', title: '下载媒体' },
  ],
}

function createRichMediaRegistry(): WorkbenchRegistry {
  const registry = new WorkbenchRegistry()
  registry.register(richMediaWorkbenchModule)
  return registry
}

const styles: Record<'layer' | 'panel' | 'header' | 'body' | 'grid' | 'trigger' | 'placeholder' | 'placeholderTitle' | 'placeholderBody', CSSProperties> = {
  layer: { position: 'relative', display: 'grid', gap: 6, width: '100%', padding: 4 },
  panel: { display: 'grid', gap: 8, padding: 10, borderRadius: 8, border: '1px solid var(--dsh-color-border, #3d4550)', background: 'var(--dsh-color-layer, #18202b)' },
  header: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 },
  body: { display: 'grid', gap: 8, minHeight: 80, fontSize: 12 },
  grid: { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' },
  trigger: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', minHeight: 32 },
  placeholder: { display: 'grid', gap: 4, padding: 12, borderRadius: 8, border: '1px dashed var(--dsh-color-border, #3d4550)' },
  placeholderTitle: { fontWeight: 600 },
  placeholderBody: { opacity: 0.72 },
}

export function RichMediaWorkbench({ wide, t, media, resolveUrl }: RichMediaWorkbenchProps & RichMediaWorkbenchExtraProps) {
  const [open, setOpen] = useState(false)
  const [activeTabId, setActiveTabId] = useState(MEDIA_TAB_ID)
  const registry = useMemo(createRichMediaRegistry, [])
  const tabs = registry.snapshot().tabs

  const renderTab = (tab: WorkbenchTabV1) => {
    if (tab.id === MEDIA_TAB_ID) {
      if (media === undefined || media.length === 0) return <p>{t('workbench.empty')}</p>
      return (
        <div style={styles.grid}>
          {media.map(item => (
            <RichMediaCard
              key={`${item.owner}:${item.ref}`}
              media={item}
              src={undefined}
              resolveUrl={resolveUrl}
              labels={{
                loading: t('workbench.loading'),
                failed: t('workbench.failed'),
                retry: t('workbench.retry'),
                open: t('workbench.card.open'),
                download: t('workbench.card.download'),
                pdfFallback: t('workbench.pdfFallback'),
              }}
            />
          ))}
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
        {wide && <span aria-hidden="true">▦</span>}
      </button>
    </div>
  )
}

export default RichMediaWorkbench

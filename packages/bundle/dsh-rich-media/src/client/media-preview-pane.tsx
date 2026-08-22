import { useEffect, useMemo, useState } from 'react'
import type { MediaRefV1 } from '../host/types.ts'

export interface MediaPreviewPaneProps {
  /** Owner-issued media projections. The pane never infers refs from URLs. */
  readonly media?: readonly MediaRefV1[] | undefined
  /** Resolves one short-lived source URL for the active resource. */
  readonly resolveUrl?: ((media: MediaRefV1) => Promise<string>) | undefined
  readonly title?: string | undefined
}

const styles = {
  root: { display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: '100%', color: 'var(--dsw-alias-label-primary, #f2f2f4)', background: 'var(--dsw-alias-bg-base, #151517)' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '10px 12px', borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))', background: 'var(--dsw-alias-bg-layer-1, #1e1e20)' },
  title: { minWidth: 0, margin: 0, overflow: 'hidden', fontSize: 13, fontWeight: 700, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  search: { width: 150, minHeight: 30, marginLeft: 'auto', padding: '0 9px', color: 'inherit', background: 'var(--dsw-alias-bg-layer-2, #29292c)', border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))', borderRadius: 7 },
  body: { display: 'grid', gridTemplateColumns: 'minmax(150px, 0.32fr) minmax(0, 1fr)', minHeight: 0 },
  list: { minWidth: 0, minHeight: 0, overflow: 'auto', padding: 8, borderRight: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))' },
  item: { display: 'grid', gap: 3, width: '100%', minHeight: 52, padding: '8px 9px', color: 'inherit', textAlign: 'left' as const, background: 'transparent', border: '1px solid transparent', borderRadius: 7, cursor: 'pointer' },
  itemActive: { background: 'var(--dsw-alias-button-ghost-active-fill, #343438)', border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.14))' },
  itemTitle: { overflow: 'hidden', fontSize: 12, fontWeight: 650, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemMeta: { overflow: 'hidden', color: 'var(--dsw-alias-label-tertiary, #92929b)', fontSize: 10, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  viewer: { minWidth: 0, minHeight: 0, overflow: 'auto', padding: 18 },
  viewerToolbar: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 30, marginBottom: 12 },
  viewerTitle: { minWidth: 0, overflow: 'hidden', fontSize: 14, fontWeight: 700, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  link: { marginLeft: 'auto', color: 'var(--dsw-alias-text-link, #8fc5ff)', fontSize: 11 },
  stage: { display: 'grid', placeItems: 'center', minHeight: 280, padding: 14, background: 'var(--dsw-alias-bg-layer-1, #202022)', border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))', borderRadius: 10 },
  image: { display: 'block', maxWidth: '100%', maxHeight: 'min(64vh, 680px)', objectFit: 'contain' as const },
  frame: { width: '100%', height: 'min(68vh, 720px)', border: 0, background: '#101012' },
  audio: { width: '100%', maxWidth: 560 },
  video: { display: 'block', width: '100%', maxHeight: 'min(68vh, 720px)', background: '#09090a' },
  meta: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginTop: 10, color: 'var(--dsw-alias-label-tertiary, #92929b)', fontSize: 11 },
  empty: { display: 'grid', placeItems: 'center', gap: 8, minHeight: 260, padding: 24, color: 'var(--dsw-alias-label-tertiary, #92929b)', textAlign: 'center' as const },
} as const

function mediaMeta(item: MediaRefV1): string {
  const dimensions = item.width !== undefined && item.height !== undefined ? `${item.width}×${item.height}` : undefined
  const duration = item.duration !== undefined ? `${Math.round(item.duration / 1000)}s` : undefined
  return [item.kind, item.mediaType, dimensions, duration].filter((value): value is string => value !== undefined).join(' · ')
}

function formatBytes(size: number | undefined): string | undefined {
  if (size === undefined) return undefined
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function ActiveMedia({ item, url }: { readonly item: MediaRefV1; readonly url: string | undefined }) {
  if (url === undefined) return <p role="status">等待资源授权后预览。</p>
  if (item.kind === 'image') return <img src={url} alt={item.title} style={styles.image} />
  if (item.kind === 'audio') return <audio src={url} controls preload="metadata" aria-label={item.title} style={styles.audio} />
  if (item.kind === 'video') return <video src={url} controls preload="metadata" aria-label={item.title} style={styles.video} />
  if (item.kind === 'pdf') return <iframe src={url} title={item.title} sandbox="allow-same-origin" referrerPolicy="no-referrer" style={styles.frame} />
  return <p role="status">此资源暂不支持内嵌预览，请使用打开或下载。</p>
}

/** Compact media library and resource viewer for a normal Pane. */
export function MediaPreviewPane({ media = [], resolveUrl, title = '媒体库' }: MediaPreviewPaneProps) {
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | undefined>(media[0] === undefined ? undefined : `${media[0].owner}:${media[0].ref}:${media[0].version}`)
  const [url, setUrl] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (normalized.length === 0) return media
    return media.filter(item => `${item.title} ${item.mediaType} ${item.kind}`.toLocaleLowerCase().includes(normalized))
  }, [media, query])
  const selected = filtered.find(item => `${item.owner}:${item.ref}:${item.version}` === selectedKey) ?? filtered[0]
  const selectedIdentity = selected === undefined ? undefined : `${selected.owner}:${selected.ref}:${selected.version}`

  useEffect(() => {
    if (selectedIdentity !== undefined && selectedIdentity !== selectedKey) setSelectedKey(selectedIdentity)
  }, [selectedIdentity, selectedKey])

  useEffect(() => {
    let live = true
    setUrl(undefined)
    setError(undefined)
    if (selected === undefined || resolveUrl === undefined || !selected.capabilities.includes('preview')) {
      setLoading(false)
      return () => { live = false }
    }
    setLoading(true)
    void resolveUrl(selected).then(next => {
      if (live) setUrl(next)
    }).catch(caught => {
      if (live) setError(caught instanceof Error ? caught.message : '资源授权失败')
    }).finally(() => {
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [resolveUrl, selected])

  return (
    <section aria-label={title} data-dsh-media-preview-pane style={styles.root}>
      <header style={styles.toolbar}>
        <h2 style={styles.title}>{title}</h2>
        <span aria-label="媒体数量" style={{ color: 'var(--dsw-alias-label-tertiary, #92929b)', fontSize: 11 }}>{media.length} 项</span>
        <input aria-label="筛选媒体" placeholder="筛选" value={query} onChange={event => { setQuery(event.currentTarget.value) }} style={styles.search} />
      </header>
      <div style={styles.body}>
        <nav aria-label="媒体资源" role="listbox" style={styles.list}>
          {filtered.length === 0
            ? <div style={styles.empty}><strong>暂无媒体资源</strong><span>当前会话还没有可预览的图片、音频或视频。</span></div>
            : filtered.map(item => {
              const identity = `${item.owner}:${item.ref}:${item.version}`
              return <button
                key={identity}
                type="button"
                role="option"
                aria-selected={identity === selectedIdentity}
                onClick={() => { setSelectedKey(identity) }}
                onKeyDown={event => {
                  const index = filtered.findIndex(candidate => `${candidate.owner}:${candidate.ref}:${candidate.version}` === identity)
                  const nextIndex = event.key === 'ArrowDown' ? Math.min(filtered.length - 1, index + 1)
                    : event.key === 'ArrowUp' ? Math.max(0, index - 1)
                      : event.key === 'Home' ? 0
                        : event.key === 'End' ? filtered.length - 1
                          : -1
                  if (nextIndex < 0 || filtered[nextIndex] === undefined) return
                  event.preventDefault()
                  setSelectedKey(`${filtered[nextIndex].owner}:${filtered[nextIndex].ref}:${filtered[nextIndex].version}`)
                }}
                style={{ ...styles.item, ...(identity === selectedIdentity ? styles.itemActive : {}) }}
              >
                <span style={styles.itemTitle}>{item.title}</span>
                <span style={styles.itemMeta}>{mediaMeta(item)}</span>
              </button>
            })}
        </nav>
        <main aria-live="polite" style={styles.viewer}>
          {selected === undefined
            ? <div style={styles.empty}><strong>选择一个媒体</strong><span>右侧会显示安全预览和资源信息。</span></div>
            : <>
              <div style={styles.viewerToolbar}>
                <span style={styles.viewerTitle}>{selected.title}</span>
                {url !== undefined && selected.capabilities.includes('open') && <a href={url} target="_blank" rel="noreferrer" style={styles.link}>打开</a>}
                {url !== undefined && selected.capabilities.includes('download') && <a href={url} download={selected.title} style={styles.link}>下载</a>}
              </div>
              <div style={styles.stage}>
                {loading ? <p role="status">正在加载预览…</p> : error !== undefined ? <p role="alert">{error}</p> : <ActiveMedia item={selected} url={url} />}
              </div>
              <div style={styles.meta}>
                <span>{mediaMeta(selected)}</span>
                {formatBytes(selected.size) !== undefined && <span>{formatBytes(selected.size)}</span>}
                <span>版本 {selected.version}</span>
              </div>
            </>}
        </main>
      </div>
    </section>
  )
}

export default MediaPreviewPane

/**
 * Pure React media card for the DSH Rich Media client face.
 *
 * This component is intentionally dependency-free and reads no application
 * state. It renders a safe metadata card and, when the Host has provided a
 * short-lived `src` or `resolveUrl`, the matching native media element or a
 * safe preview. It never constructs URLs from raw paths or user-controlled
 * strings.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useEffect, useState, type ReactNode } from 'react'
import type { MediaRefV1 } from '../host/types.ts'

export interface RichMediaCardLabels {
  loading?: string
  failed?: string
  retry?: string
  open?: string
  download?: string
  pdfFallback?: string
}

export interface RichMediaCardProps {
  media: MediaRefV1
  /** Host-authorized short-lived URL; takes precedence over `resolveUrl`. */
  src?: string | undefined
  /** Host-authorized async URL resolver used when `src` is absent. */
  resolveUrl?: ((media: MediaRefV1) => Promise<string>) | undefined
  /** Localized action/status strings. */
  labels?: RichMediaCardLabels | undefined
}

const DEFAULT_LABELS: Required<RichMediaCardLabels> = {
  loading: 'Loading media…',
  failed: 'Media failed to load',
  retry: 'Retry',
  open: 'Open',
  download: 'Download',
  pdfFallback: 'Your browser cannot preview this PDF.',
}

function formatBytes(bytes: number | undefined): string | undefined {
  if (bytes === undefined) return undefined
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function useResolvedSrc(
  media: MediaRefV1,
  src: string | undefined,
  resolveUrl: ((media: MediaRefV1) => Promise<string>) | undefined,
): { url: string | undefined; failed: boolean; retry: () => void } {
  const [resolved, setResolved] = useState<string | undefined>(src)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    if (src !== undefined) {
      setResolved(src)
      setFailed(false)
      return () => { live = false }
    }
    if (resolveUrl === undefined) {
      setResolved(undefined)
      setFailed(false)
      return () => { live = false }
    }
    setResolved(undefined)
    setFailed(false)
    void resolveUrl(media).then((url) => {
      if (live) setResolved(url)
    }).catch(() => {
      if (live) setFailed(true)
    })
    return () => { live = false }
  }, [media, src, resolveUrl, attempt])

  return {
    url: resolved,
    failed,
    retry: () => { setAttempt(value => value + 1) },
  }
}

function MediaElement({ media, url }: { media: MediaRefV1; url: string }) {
  if (media.kind === 'image') {
    return <img src={url} alt={media.title} width={media.width} height={media.height} />
  }
  if (media.kind === 'audio') {
    return <audio src={url} controls preload="metadata" aria-label={media.title} />
  }
  if (media.kind === 'video') {
    return <video src={url} controls preload="metadata" aria-label={media.title} />
  }
  if (media.kind === 'pdf') {
    return (
      <iframe
        src={url}
        title={media.title}
        sandbox="allow-same-origin allow-scripts"
        referrerPolicy="no-referrer"
        style={{ width: '100%', minHeight: 240, border: 0 }}
      />
    )
  }
  return null
}

/** Compact safe media card used by chat, ToolView, and Pane renderers. */
export function RichMediaCard({ media, src, resolveUrl, labels }: RichMediaCardProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const { url, failed, retry } = useResolvedSrc(media, src, resolveUrl)
  const size = formatBytes(media.size)
  const detail = [media.mediaType, size, media.width !== undefined && media.height !== undefined ? `${media.width}×${media.height}` : undefined]
    .filter((part): part is string => part !== undefined)
    .join(' · ')
  const canOpen = media.capabilities.includes('open') || media.capabilities.includes('preview')
  const canDownload = media.capabilities.includes('download')

  const actions: ReactNode[] = []
  if (url !== undefined && canOpen && media.kind === 'pdf') {
    actions.push(
      <a key="open" href={url} target="_blank" rel="noreferrer">{text.open}</a>,
    )
  }
  if (url !== undefined && canDownload) {
    actions.push(
      <a key="download" href={url} download={media.title}>{text.download}</a>,
    )
  }

  return (
    <section
      aria-label={media.title}
      data-dsh-rich-media-kind={media.kind}
      data-dsh-rich-media-owner={media.owner}
      style={{ display: 'grid', gap: 8 }}
    >
      {url !== undefined && !failed && <MediaElement media={media} url={url} />}
      {failed && (
        <p role="alert">
          {text.failed}{' '}
          <button type="button" onClick={retry}>{text.retry}</button>
        </p>
      )}
      {url === undefined && !failed && (media.kind === 'pdf' || media.kind === 'document' || media.kind === 'text' || media.kind === 'file') && (
        <p>{text.pdfFallback}</p>
      )}
      <h3>{media.title}</h3>
      {media.summary !== undefined && <p>{media.summary}</p>}
      <p>{detail}</p>
      {actions.length > 0 && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </section>
  )
}

export default RichMediaCard

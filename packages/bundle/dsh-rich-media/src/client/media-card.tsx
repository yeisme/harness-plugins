/**
 * Pure React media card for the DSH Rich Media client face.
 *
 * This component is intentionally dependency-free and reads no application
 * state. It renders a safe metadata card and, when the Host has provided a
 * short-lived `src` or `resolveUrl`, the matching native media element or a
 * safe preview. It never constructs URLs from raw paths or user-controlled
 * strings.
 *
 * Playback enhancements are opt-in and dependency-free: waveform peaks and
 * subtitle URLs arrive as owner-authorized inputs, playback speed and picture
 * in picture only drive the native element, and every enhancement degrades to
 * the plain native player when its input is absent.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import type { MediaRefV1 } from '../host/types.ts'

/** Owner-authorized subtitle track for audio/video playback. */
export interface MediaSubtitleTrack {
  /** Host-authorized short-lived WebVTT URL. */
  src: string
  /** BCP-47 language tag. */
  lang: string
  /** Safe display label. */
  label: string
}

export interface RichMediaCardLabels {
  loading?: string
  failed?: string
  retry?: string
  open?: string
  download?: string
  pdfFallback?: string
  playbackSpeed?: string
  pictureInPicture?: string
  waveform?: string
}

export interface RichMediaCardProps {
  media: MediaRefV1
  /** Host-authorized short-lived URL; takes precedence over `resolveUrl`. */
  src?: string | undefined
  /** Host-authorized async URL resolver used when `src` is absent. */
  resolveUrl?: ((media: MediaRefV1) => Promise<string>) | undefined
  /** Localized action/status strings. */
  labels?: RichMediaCardLabels | undefined
  /** Owner-authorized subtitle tracks for audio/video playback. */
  subtitleTracks?: readonly MediaSubtitleTrack[] | undefined
  /** Owner-precomputed normalized waveform peaks (0..1) for audio/video. */
  waveformPeaks?: readonly number[] | undefined
  /** Playback rates offered by the speed control. */
  playbackRates?: readonly number[] | undefined
  /** Offer picture in picture for video when the runtime supports it. */
  allowPictureInPicture?: boolean | undefined
}

const DEFAULT_LABELS: Required<RichMediaCardLabels> = {
  loading: 'Loading media\u2026',
  failed: 'Media failed to load',
  retry: 'Retry',
  open: 'Open',
  download: 'Download',
  pdfFallback: 'Your browser cannot preview this PDF.',
  playbackSpeed: 'Speed',
  pictureInPicture: 'Picture in picture',
  waveform: 'Waveform',
}

const DEFAULT_PLAYBACK_RATES: readonly number[] = [0.5, 1, 1.25, 1.5, 2]

type PipCapableDocument = Document & { pictureInPictureEnabled?: boolean }
type PipCapableVideo = HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }

function pictureInPictureSupported(allow: boolean | undefined): boolean {
  if (allow === false) return false
  if (typeof document === 'undefined') return false
  return (document as PipCapableDocument).pictureInPictureEnabled === true
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

function WaveformBars({ peaks, progress, label }: { peaks: readonly number[]; progress: number; label: string }) {
  const total = peaks.length
  const playedRatio = Math.max(0, Math.min(1, progress))
  return (
    <div
      role="img"
      aria-label={label}
      data-dsh-rich-media-waveform
      style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 36, padding: '2px 4px', borderRadius: 4, background: 'rgba(127,127,127,0.14)' }}
    >
      {peaks.map((peak, index) => {
        const safePeak = Number.isFinite(peak) ? peak : 0
        const clamped = Math.max(0.04, Math.min(1, safePeak))
        const played = total <= 1 ? playedRatio >= 1 : index / total <= playedRatio
        return (
          <span
            key={index}
            aria-hidden="true"
            data-played={played || undefined}
            style={{ flex: 1, minWidth: 1, height: `${Math.round(clamped * 100)}%`, borderRadius: 1, background: played ? 'var(--dsh-color-accent, #4f8cff)' : 'rgba(127,127,127,0.45)' }}
          />
        )
      })}
    </div>
  )
}

function EnhancedMediaPlayer(props: {
  media: MediaRefV1
  url: string
  subtitleTracks: readonly MediaSubtitleTrack[]
  waveformPeaks: readonly number[] | undefined
  playbackRates: readonly number[]
  allowPictureInPicture: boolean | undefined
  labels: Required<RichMediaCardLabels>
}) {
  const { media, url, subtitleTracks, waveformPeaks, playbackRates, allowPictureInPicture, labels } = props
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [rate, setRate] = useState(1)
  const [progress, setProgress] = useState(0)

  const applyRate = (next: number): void => {
    setRate(next)
    const element = media.kind === 'video' ? videoRef.current : audioRef.current
    if (element !== null) element.playbackRate = next
  }

  const pipSupported = media.kind === 'video' && pictureInPictureSupported(allowPictureInPicture)

  const enterPictureInPicture = (): void => {
    const video = videoRef.current as PipCapableVideo | null
    if (video !== null && video.requestPictureInPicture !== undefined) {
      void video.requestPictureInPicture().catch(() => {})
    }
  }

  const onTimeUpdate = (event: SyntheticEvent<HTMLVideoElement | HTMLAudioElement>): void => {
    const element = event.currentTarget
    const duration = element.duration
    setProgress(Number.isFinite(duration) && duration > 0 ? element.currentTime / duration : 0)
  }

  return (
    <div data-dsh-rich-media-player={media.kind} style={{ display: 'grid', gap: 4 }}>
      {waveformPeaks !== undefined && waveformPeaks.length > 0 && (
        <WaveformBars peaks={waveformPeaks} progress={progress} label={labels.waveform} />
      )}
      {media.kind === 'video' ? (
        <video ref={videoRef} src={url} controls preload="metadata" aria-label={media.title} onTimeUpdate={onTimeUpdate}>
          {subtitleTracks.map(track => (
            <track key={`${track.src}:${track.lang}`} kind="subtitles" src={track.src} srcLang={track.lang} label={track.label} />
          ))}
        </video>
      ) : (
        <audio ref={audioRef} src={url} controls preload="metadata" aria-label={media.title} onTimeUpdate={onTimeUpdate} />
      )}
      <div role="group" aria-label={labels.playbackSpeed} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span aria-hidden="true">{labels.playbackSpeed}</span>
          <select value={rate} onChange={event => { applyRate(Number(event.target.value)) }}>
            {playbackRates.map(option => (
              <option key={option} value={option}>{option}\u00d7</option>
            ))}
          </select>
        </label>
        {pipSupported && (
          <button type="button" onClick={enterPictureInPicture}>{labels.pictureInPicture}</button>
        )}
      </div>
    </div>
  )
}

function MediaElement({ media, url }: { media: MediaRefV1; url: string }) {
  if (media.kind === 'image') {
    return <img src={url} alt={media.title} loading="lazy" style={{ maxWidth: '100%', height: 'auto' }} />
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
export function RichMediaCard({ media, src, resolveUrl, labels, subtitleTracks, waveformPeaks, playbackRates, allowPictureInPicture }: RichMediaCardProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const { url, failed, retry } = useResolvedSrc(media, src, resolveUrl)
  const size = formatBytes(media.size)
  const detail = [media.mediaType, size, media.width !== undefined && media.height !== undefined ? `${media.width}\u00d7${media.height}` : undefined]
    .filter((part): part is string => part !== undefined)
    .join(' \u00b7 ')
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

  const isPlayback = media.kind === 'audio' || media.kind === 'video'

  return (
    <section
      aria-label={media.title}
      data-dsh-rich-media-kind={media.kind}
      data-dsh-rich-media-owner={media.owner}
      style={{ display: 'grid', gap: 8 }}
    >
      {url !== undefined && !failed && isPlayback && (
        <EnhancedMediaPlayer
          media={media}
          url={url}
          subtitleTracks={subtitleTracks ?? []}
          waveformPeaks={waveformPeaks}
          playbackRates={playbackRates ?? DEFAULT_PLAYBACK_RATES}
          allowPictureInPicture={allowPictureInPicture}
          labels={text}
        />
      )}
      {url !== undefined && !failed && !isPlayback && <MediaElement media={media} url={url} />}
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

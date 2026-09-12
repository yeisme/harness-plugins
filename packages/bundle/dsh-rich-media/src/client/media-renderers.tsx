/**
 * Media resource renderers (V3 5.3-5.6, differentiation lane):
 * image tools (fit/fill/actual, zoom/pan, rotate, pixel budget,
 * reduced-motion animation pause), keyboard-driven compare views, and
 * native-first audio/video playback with an injected lazy-loader boundary
 * for heavy enhancers (WaveSurfer / hls.js). The core never imports those
 * packages; hosts inject loaders only when the dependencies are available.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useRef, useState, type PointerEvent } from 'react'
import type { MediaRefV1 } from '../host/types.ts'

/** Lazy-loader boundary for heavy enhancers (wavesurfer.js, hls.js). */
export type LazyEnhancerLoader<T> = () => Promise<T>

/** Decoding budget: refuse to decode rasters beyond ~36MP without a filter. */
export const IMAGE_PIXEL_BUDGET = 36_000_000

export function pixelsOf(media: MediaRefV1): number | undefined {
  if (media.width === undefined || media.height === undefined) return undefined
  return media.width * media.height
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export type ImageFitMode = 'fit' | 'fill' | 'actual'
export type ImageRotation = 0 | 90 | 180 | 270

export interface MediaImageRendererLabels {
  fit?: string
  fill?: string
  actual?: string
  zoomIn?: string
  zoomOut?: string
  rotate?: string
  tooLarge?: string
  playAnimation?: string
  noDescription?: string
  background?: string
  metadata?: string
  selection?: string
  cropPreview?: string
  inspectMode?: string
  selectMode?: string
  interactionMode?: string
  selectionHint?: string
  panLeft?: string
  panRight?: string
  backgroundDark?: string
  backgroundLight?: string
  backgroundChecker?: string
  zoom?: string
}

const DEFAULT_IMAGE_LABELS: Required<MediaImageRendererLabels> = {
  fit: 'Fit',
  fill: 'Fill',
  actual: 'Actual size',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  rotate: 'Rotate',
  tooLarge: 'Image exceeds the decode budget; open it to view at full resolution.',
  playAnimation: 'Play animation',
  noDescription: 'No description provided',
  background: 'Background',
  metadata: 'Metadata',
  selection: 'Selected image region',
  cropPreview: 'Crop preview',
  inspectMode: 'Inspect image',
  selectMode: 'Select region',
  interactionMode: 'Image interaction',
  selectionHint: 'Switch to image inspection to zoom, pan, or rotate.',
  panLeft: 'Pan left',
  panRight: 'Pan right',
  backgroundDark: 'dark',
  backgroundLight: 'light',
  backgroundChecker: 'checker',
  zoom: 'Zoom',
}

export interface MediaImageSelectionV1 {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Image renderer with fit/zoom/pan/rotate tools and a decode budget. */
export function MediaImageRenderer({
  media, url, labels, selection, onSelectionChange,
}: { media: MediaRefV1; url: string | undefined; labels?: MediaImageRendererLabels | undefined; selection?: MediaImageSelectionV1 | undefined; onSelectionChange?: ((selection: MediaImageSelectionV1) => void) | undefined }) {
  const text = { ...DEFAULT_IMAGE_LABELS, ...labels }
  const [mode, setMode] = useState<ImageFitMode>('fit')
  const [selectionMode, setSelectionMode] = useState(true)
  const [rotation, setRotation] = useState<ImageRotation>(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [animationAllowed, setAnimationAllowed] = useState(false)
  const [background, setBackground] = useState<'dark' | 'light' | 'checker'>('dark')
  const dragStart = useRef<{ readonly x: number; readonly y: number; readonly pointerId: number } | undefined>(undefined)
  const pixels = pixelsOf(media)
  const overBudget = pixels !== undefined && pixels > IMAGE_PIXEL_BUDGET
  const animated = media.mediaType === 'image/gif' || media.mediaType === 'image/apng'
  const holdAnimation = animated && prefersReducedMotion() && !animationAllowed
  const selecting = onSelectionChange !== undefined && selectionMode
  const objectFit = selecting ? 'contain' : mode === 'fill' ? 'cover' : mode === 'fit' ? 'contain' : 'none'
  const pointOf = (event: PointerEvent<HTMLDivElement>): { readonly x: number; readonly y: number } | undefined => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return undefined
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }
  const finishSelection = (event: PointerEvent<HTMLDivElement>): void => {
    const start = dragStart.current
    if (start === undefined || start.pointerId !== event.pointerId) return
    const end = pointOf(event)
    dragStart.current = undefined
    if (!selecting || start === undefined || end === undefined || onSelectionChange === undefined) return
    const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000
    const next = {
      x: round(Math.min(start.x, end.x)),
      y: round(Math.min(start.y, end.y)),
      width: round(Math.abs(start.x - end.x)),
      height: round(Math.abs(start.y - end.y)),
    }
    if (next.width <= 0 || next.height <= 0) return
    onSelectionChange(next)
  }
  return (
    <figure data-dsh-media-image data-interaction-mode={selecting ? 'select' : 'inspect'} data-zoom={selecting ? 1 : zoom} data-fit={mode} data-rotation={rotation} data-background={background} style={{ display: 'grid', gap: 6, margin: 0 }}>
      {onSelectionChange !== undefined && <div role="group" aria-label={text.interactionMode} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="vk-btn" type="button" aria-pressed={!selecting} onClick={() => { dragStart.current = undefined; setSelectionMode(false) }}>{text.inspectMode}</button>
        <button className="vk-btn" type="button" aria-pressed={selecting} onClick={() => { dragStart.current = undefined; setSelectionMode(true) }}>{text.selectMode}</button>
      </div>}
      {url !== undefined && !overBudget && (
        <div data-dsh-media-image-canvas style={{ overflow: 'hidden', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: background === 'light' ? '#f4f4f5' : background === 'checker' ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 16px 16px' : '#111' }}>
          <div
            tabIndex={selecting ? 0 : undefined}
            aria-label={selecting ? text.selection : undefined}
            data-dsh-media-image-selection-stage
            data-selection-transform-locked={selecting || undefined}
            onPointerDown={event => { if (!selecting || dragStart.current !== undefined || event.button > 0 || event.isPrimary === false) return; const point = pointOf(event); if (point !== undefined) { dragStart.current = { ...point, pointerId: event.pointerId }; event.currentTarget.setPointerCapture?.(event.pointerId) } }}
            onPointerUp={finishSelection}
            onPointerCancel={event => { if (dragStart.current?.pointerId === event.pointerId) dragStart.current = undefined }}
            onLostPointerCapture={event => { if (dragStart.current?.pointerId === event.pointerId) dragStart.current = undefined }}
            style={{ position: 'relative', display: selecting ? 'inline-block' : 'block', width: selecting ? 'fit-content' : '100%', maxWidth: '100%', lineHeight: 0, touchAction: selecting ? 'none' : undefined, cursor: selecting ? 'crosshair' : undefined }}
          >
            <img
              src={url}
              alt={media.title || text.noDescription}
              loading="lazy"
              decoding="async"
              draggable={selecting ? false : undefined}
              data-hold-animation={holdAnimation || undefined}
              style={selecting
                ? { display: 'block', width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: 520, objectFit, transform: 'none' }
                : { width: '100%', height: '100%', objectFit, transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg)`, transformOrigin: 'center' }}
            />
            {selecting && selection !== undefined && <div
              aria-hidden="true"
              data-dsh-media-image-selection
              data-selection-x={selection.x}
              data-selection-y={selection.y}
              data-selection-width={selection.width}
              data-selection-height={selection.height}
              style={{ position: 'absolute', left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%`, border: '2px solid var(--vk-accent)', background: 'color-mix(in srgb,var(--vk-accent) 14%,transparent)', boxShadow: '0 0 0 9999px rgba(0,0,0,.42)', pointerEvents: 'none' }}
            />}
            {holdAnimation && (
              <button className="vk-btn" type="button" onClick={() => { setAnimationAllowed(true) }} style={{ position: 'absolute', inset: 0 }}>
                {text.playAnimation}
              </button>
            )}
          </div>
        </div>
      )}
      {url !== undefined && selection !== undefined && <figure data-dsh-media-image-crop-preview style={{ display: 'grid', gap: 4, margin: 0 }}>
        <figcaption>{text.cropPreview}</figcaption>
        <div style={{ overflow: 'hidden', maxHeight: 220, border: '1px solid var(--vk-border-l2)', borderRadius: 'var(--vk-radius-sm)' }}>
          {media.width !== undefined && media.height !== undefined
            ? <svg role="img" aria-label={`${media.title} · ${text.cropPreview}`} viewBox={`${selection.x * media.width} ${selection.y * media.height} ${selection.width * media.width} ${selection.height * media.height}`} style={{ display: 'block', width: '100%', maxHeight: 220 }}><image href={url} width={media.width} height={media.height} /></svg>
            : <img src={url} alt={`${media.title} · ${text.cropPreview}`} style={{ display: 'block', width: '100%', clipPath: `inset(${selection.y * 100}% ${(1 - selection.x - selection.width) * 100}% ${(1 - selection.y - selection.height) * 100}% ${selection.x * 100}%)` }} />}
        </div>
      </figure>}
      {overBudget && <p role="status">{text.tooLarge}</p>}
      <div role="group" aria-label={text.fit} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button className="vk-btn" type="button" disabled={selecting} title={selecting ? text.selectionHint : undefined} aria-pressed={mode === 'fit' || undefined} onClick={() => { setMode('fit') }}>{text.fit}</button>
        <button className="vk-btn" type="button" disabled={selecting} title={selecting ? text.selectionHint : undefined} aria-pressed={mode === 'fill' || undefined} onClick={() => { setMode('fill') }}>{text.fill}</button>
        <button className="vk-btn" type="button" disabled={selecting} title={selecting ? text.selectionHint : undefined} aria-pressed={mode === 'actual' || undefined} onClick={() => { setMode('actual') }}>{text.actual}</button>
        <button className="vk-btn" type="button" disabled={selecting} title={selecting ? text.selectionHint : undefined} aria-label={text.zoomIn} onClick={() => { setZoom(value => Math.min(8, value * 1.5)) }}>+</button>
        <button className="vk-btn" type="button" disabled={selecting} title={selecting ? text.selectionHint : undefined} aria-label={text.zoomOut} onClick={() => { setZoom(value => Math.max(1, value / 1.5)) }}>&#8722;</button>
        <button className="vk-btn" type="button" disabled={selecting} title={selecting ? text.selectionHint : undefined} aria-label={text.rotate} onClick={() => { setRotation(value => ((value + 90) % 360) as ImageRotation) }}>&#8635;</button>
        <button className="vk-btn" type="button" disabled={selecting} title={selecting ? text.selectionHint : undefined} aria-label={text.panLeft} onClick={() => { setPan(value => ({ ...value, x: value.x - 24 })) }}>&#8592;</button>
        <button className="vk-btn" type="button" disabled={selecting} title={selecting ? text.selectionHint : undefined} aria-label={text.panRight} onClick={() => { setPan(value => ({ ...value, x: value.x + 24 })) }}>&#8594;</button>
        <button className="vk-btn" type="button" aria-pressed={background === 'dark' || undefined} onClick={() => { setBackground('dark') }}>{text.background} {text.backgroundDark}</button>
        <button className="vk-btn" type="button" aria-pressed={background === 'light' || undefined} onClick={() => { setBackground('light') }}>{text.background} {text.backgroundLight}</button>
        <button className="vk-btn" type="button" aria-pressed={background === 'checker' || undefined} onClick={() => { setBackground('checker') }}>{text.background} {text.backgroundChecker}</button>
      </div>
      <output aria-label={text.zoom}>{Math.round((selecting ? 1 : zoom) * 100)}%</output>
      <figcaption data-dsh-media-image-meta aria-label={text.metadata}>
        {[media.title, media.mediaType, media.width !== undefined && media.height !== undefined ? `${media.width}\u00d7${media.height}` : undefined, media.version].filter((part): part is string => part !== undefined && part.length > 0).join(' \u00b7 ')}
      </figcaption>
    </figure>
  )
}

export type CompareMode = 'side-by-side' | 'swipe' | 'opacity'

export interface CompareItem {
  url: string
  label: string
  /** Owner-side version token; displayed as text, never only as color. */
  version: string
}

/** Keyboard-adjustable compare view: swipe and opacity share one range control. */
export function MediaCompareRenderer({
  left, right, labels,
}: {
  left: CompareItem
  right: CompareItem
  labels?: { mode?: string; swipe?: string; opacity?: string; sideBySide?: string; position?: string } | undefined
}) {
  const text = { mode: 'Compare mode', swipe: 'Swipe', opacity: 'Opacity', sideBySide: 'Side by side', position: 'Compare position', ...labels }
  const [mode, setMode] = useState<CompareMode>('swipe')
  const [position, setPosition] = useState(50)
  return (
    <section data-dsh-media-compare data-mode={mode} data-left-version={left.version} data-right-version={right.version} aria-label={text.mode} style={{ display: 'grid', gap: 6 }}>
      <div role="group" aria-label={text.mode} style={{ display: 'flex', gap: 6 }}>
        <button className="vk-btn" type="button" aria-pressed={mode === 'side-by-side' || undefined} onClick={() => { setMode('side-by-side') }}>{text.sideBySide}</button>
        <button className="vk-btn" type="button" aria-pressed={mode === 'swipe' || undefined} onClick={() => { setMode('swipe') }}>{text.swipe}</button>
        <button className="vk-btn" type="button" aria-pressed={mode === 'opacity' || undefined} onClick={() => { setMode('opacity') }}>{text.opacity}</button>
      </div>
      <p data-compare-labels style={{ margin: 0 }}>{left.label} · {left.version} | {right.label} · {right.version}</p>
      <div style={{ position: 'relative', display: mode === 'side-by-side' ? 'flex' : 'block', gap: mode === 'side-by-side' ? 8 : 0 }}>
        <figure style={{ margin: 0, flex: 1, minWidth: 0 }}>
          <div data-compare-image-area style={{ position: 'relative' }}>
          <img src={left.url} alt={left.label} style={{ width: '100%', display: 'block' }} />
          {mode === 'swipe' && <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - position}% 0 0)` }}><img src={right.url} alt={right.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>}
          {mode === 'opacity' && <div style={{ position: 'absolute', inset: 0, opacity: position / 100 }}><img src={right.url} alt={right.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>}
          </div>
          <figcaption>{left.label} · {left.version}</figcaption>
        </figure>
        {mode === 'side-by-side' && (
          <figure style={{ margin: 0, flex: 1, minWidth: 0 }}>
            <img src={right.url} alt={right.label} style={{ width: '100%', display: 'block' }} />
            <figcaption>{right.label} · {right.version}</figcaption>
          </figure>
        )}
      </div>
      {mode !== 'side-by-side' && (
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span>{text.position}</span>
          <input
            type="range" min={0} max={100} step={1} value={position}
            aria-label={`${text.position}: ${position}%`}
            aria-valuetext={`${position}%`}
            onChange={event => { setPosition(Number(event.target.value)) }}
          />
          <output>{position}%</output>
        </label>
      )}
    </section>
  )
}

/** Native playback capability probe (SSR-safe: no document means native-only). */
export function canPlayNatively(mediaType: string): boolean {
  if (typeof document === 'undefined') return true
  const probe = document.createElement(mediaType.startsWith('audio/') ? 'audio' : 'video')
  const verdict = probe.canPlayType(mediaType)
  return verdict !== ''
}

const UNSAFE_PLAYBACK = /^(?:javascript|data|file):/i

/** Reject untrusted playback URLs and caption tracks before a renderer mounts. */
export function rejectUnsafePlayback(url: string | undefined, tracks: readonly { src?: string; kind?: string }[] = [], options: { readonly allowBlobUrl?: boolean } = {}): string | undefined {
  if (url !== undefined && (UNSAFE_PLAYBACK.test(url) || (url.startsWith('blob:') && options.allowBlobUrl !== true) || url.includes('javascript:'))) return 'unsafe source'
  for (const track of tracks) {
    if (track.src !== undefined && UNSAFE_PLAYBACK.test(track.src)) return 'unsafe track'
    if (track.kind !== undefined && !['captions', 'subtitles', 'descriptions', 'chapters', 'metadata'].includes(track.kind)) return 'unsafe track kind'
  }
  return undefined
}

/** Pure playback decision: native element, injected enhancer, or honest unavailable. */
export function playbackMode(
  mediaType: string,
  loadHls: LazyEnhancerLoader<unknown> | undefined,
  canPlay: (mediaType: string) => boolean = canPlayNatively,
): 'native' | 'enhancer' | 'unavailable' {
  const isHls = mediaType === 'application/vnd.apple.mpegurl' || mediaType === 'application/x-mpegurl'
  if (!isHls || canPlay(mediaType)) return 'native'
  return loadHls === undefined ? 'unavailable' : 'enhancer'
}

export interface MediaPlaybackRendererLabels {
  frameBack?: string
  frameForward?: string
  hlsUnavailable?: string
  unsafe?: string
  chapters?: string
  captions?: string
  speed?: string
  trackStatus?: string
  fit?: string
  playSelection?: string
}

const DEFAULT_PLAYBACK_LABELS: Required<MediaPlaybackRendererLabels> = {
  frameBack: 'Step back',
  frameForward: 'Step forward',
  hlsUnavailable: 'This stream needs an HLS enhancer that is not installed.',
  unsafe: 'This media source or track is not allowed.',
  chapters: 'Chapters',
  captions: 'Captions',
  speed: 'Speed',
  trackStatus: 'Track status',
  fit: 'Fit',
  playSelection: 'Play selected range',
}

export interface MediaTimeSelectionV1 {
  readonly startMs: number
  readonly endMs: number
}

export type MediaPlaybackFitMode = 'contain' | 'cover'

export interface MediaTextTrackV1 {
  readonly src?: string
  readonly kind?: string
  readonly label?: string
  readonly srclang?: string
}

export function selectSafeTextTracks(tracks: readonly MediaTextTrackV1[] = []): readonly Required<Pick<MediaTextTrackV1, 'src' | 'kind'>>[] {
  const allowed = new Set(['captions', 'subtitles', 'descriptions'])
  const selected: Array<Required<Pick<MediaTextTrackV1, 'src' | 'kind'>> & { label?: string; srclang?: string }> = []
  for (const track of tracks) {
    if (track.src === undefined || track.kind === undefined) continue
    if (!allowed.has(track.kind)) continue
    if (rejectUnsafePlayback(track.src, [track]) !== undefined) continue
    selected.push({
      src: track.src,
      kind: track.kind,
      ...(track.label === undefined ? {} : { label: track.label }),
      ...(track.srclang === undefined ? {} : { srclang: track.srclang }),
    })
  }
  return selected
}

export function playbackRateOptions(): readonly number[] {
  return [0.75, 1, 1.25, 1.5]
}

export interface MediaChapterCueV1 {
  readonly id?: string
  readonly label?: string
  readonly startMs?: number
  readonly kind?: string
  readonly src?: string
}

export interface MediaChapterV1 {
  readonly id: string
  readonly label: string
  readonly startMs: number
}

const CHAPTER_LABEL = /^[\p{L}\p{N} .,_:'-]{1,80}$/u

/**
 * Owner-authored chapter cues only. Unsafe src/kind and unlabeled times
 * stay out of the navigator. This is not a WaveSurfer or VTT parser.
 */
export function selectSafeChapters(cues: readonly MediaChapterCueV1[] = []): readonly MediaChapterV1[] {
  const chapters: MediaChapterV1[] = []
  for (const [index, cue] of cues.entries()) {
    if (cue.kind !== undefined && cue.kind !== 'chapters') continue
    if (cue.src !== undefined && rejectUnsafePlayback(cue.src, [cue]) !== undefined) continue
    if (typeof cue.startMs !== 'number' || !Number.isFinite(cue.startMs) || cue.startMs < 0) continue
    const label = cue.label?.trim() ?? ''
    if (!CHAPTER_LABEL.test(label)) continue
    const id = cue.id !== undefined && /^[A-Za-z0-9._:-]{1,64}$/.test(cue.id) ? cue.id : `chapter-${index + 1}`
    chapters.push({ id, label, startMs: Math.round(cue.startMs) })
  }
  return chapters.sort((left, right) => left.startMs - right.startMs)
}

export function seekChapterCurrentTime(startMs: number): number {
  return Math.max(0, startMs) / 1000
}

/**
 * Video/audio renderer wrapper: prefers the native element, steps frames on
 * video, and surfaces an honest unavailable state when a stream needs the
 * lazy HLS enhancer and no loader was injected. No autoplay, DRM, PiP, or
 * Fullscreen API.
 */
export function MediaPlaybackRenderer({
  media, url, labels, loadHls, tracks = [], chapters = [], selection, allowBlobUrl = false,
}: {
  media: MediaRefV1
  url: string | undefined
  labels?: MediaPlaybackRendererLabels | undefined
  loadHls?: LazyEnhancerLoader<unknown> | undefined
  tracks?: readonly { src?: string; kind?: string }[] | undefined
  chapters?: readonly MediaChapterCueV1[] | undefined
  selection?: MediaTimeSelectionV1 | undefined
  allowBlobUrl?: boolean | undefined
}) {
  const text = { ...DEFAULT_PLAYBACK_LABELS, ...labels }
  const mediaElement = useRef<HTMLMediaElement | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  const unsafe = rejectUnsafePlayback(url, tracks, { allowBlobUrl })
  if (unsafe !== undefined) {
    return <p role="alert" data-dsh-media-unsafe={unsafe}>{text.unsafe}</p>
  }
  const mode = playbackMode(media.mediaType, loadHls)
  if (mode === 'unavailable') {
    return <p role="alert">{text.hlsUnavailable}</p>
  }
  const safeChapters = selectSafeChapters(chapters)
  const captionTracks = selectSafeTextTracks(tracks)
  const rates = playbackRateOptions()
  const playSelection = (): void => {
    if (selection === undefined || mediaElement.current === null) return
    mediaElement.current.currentTime = selection.startMs / 1000
    void mediaElement.current.play().catch(() => {})
  }
  const stopAtSelectionEnd = (): void => {
    if (selection !== undefined && mediaElement.current !== null && mediaElement.current.currentTime * 1000 >= selection.endMs) mediaElement.current.pause()
  }
  const stepFrame = (direction: -1 | 1): void => {
    if (mediaElement.current === null) return
    const duration = Number.isFinite(mediaElement.current.duration) ? mediaElement.current.duration : Number.POSITIVE_INFINITY
    mediaElement.current.currentTime = Math.max(0, Math.min(duration, mediaElement.current.currentTime + direction / 30))
  }
  const changePlaybackRate = (next: number): void => {
    setPlaybackRate(next)
    if (mediaElement.current !== null) mediaElement.current.playbackRate = next
  }
  const seekChapter = (startMs: number): void => {
    if (mediaElement.current !== null) mediaElement.current.currentTime = seekChapterCurrentTime(startMs)
  }
  return (
    <div data-dsh-media-playback data-mode={mode} data-fit="contain" style={{ display: 'grid', gap: 4 }}>
      {media.kind === 'video' ? (
        <video ref={element => { mediaElement.current = element }} src={url} controls preload="metadata" aria-label={media.title} data-frame-step="1/30" data-object-fit="contain" onTimeUpdate={stopAtSelectionEnd}>
          {captionTracks.map(track => (
            <track key={`${track.kind}:${track.src}`} kind={track.kind} src={track.src} />
          ))}
        </video>
      ) : (
        <audio ref={element => { mediaElement.current = element }} src={url} controls preload="metadata" aria-label={media.title} onTimeUpdate={stopAtSelectionEnd} />
      )}
      {selection !== undefined && <button type="button" data-dsh-media-play-selection data-range-start-ms={selection.startMs} data-range-end-ms={selection.endMs} onClick={playSelection}>{text.playSelection}</button>}
      {media.kind === 'video' && (
        <div role="group" style={{ display: 'flex', gap: 6 }}>
          <button type="button" aria-label={text.frameBack} onClick={() => stepFrame(-1)}>&#8722;1f</button>
          <button type="button" aria-label={text.frameForward} onClick={() => stepFrame(1)}>+1f</button>
        </div>
      )}
      <label>
        {text.speed}
        <select aria-label={text.speed} value={String(playbackRate)} data-dsh-media-speed onChange={event => changePlaybackRate(Number(event.currentTarget.value))}>
          {rates.map(rate => (
            <option key={rate} value={String(rate)}>{`${rate}x`}</option>
          ))}
        </select>
      </label>
      <p data-dsh-media-track-status role="status">{`${text.trackStatus}: ${captionTracks.length} captions`}</p>
      {safeChapters.length > 0 && (
        <nav aria-label={text.chapters} data-dsh-media-chapters>
          <ol>
            {safeChapters.map(chapter => (
              <li key={chapter.id}>
                <button
                  type="button"
                  data-chapter-id={chapter.id}
                  data-chapter-start={String(seekChapterCurrentTime(chapter.startMs))}
                  onClick={() => seekChapter(chapter.startMs)}
                >
                  {chapter.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  )
}

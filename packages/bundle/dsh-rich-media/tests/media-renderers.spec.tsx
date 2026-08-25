import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  IMAGE_PIXEL_BUDGET,
  MediaCompareRenderer,
  MediaImageRenderer,
  MediaPlaybackRenderer,
  canPlayNatively,
  playbackMode,
  pixelsOf,
  rejectUnsafePlayback,
  seekChapterCurrentTime,
  selectSafeChapters,
  selectSafeTextTracks,
} from '../src/client/media-renderers.tsx'
import type { MediaRefV1 } from '../src/host/types.ts'

function image(width?: number, height?: number, mediaType = 'image/png'): MediaRefV1 {
  return { owner: 'dsh', kind: 'image', ref: 'img-1', version: 'v1', mediaType, ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }), title: 'Shot', capabilities: ['preview'] }
}

describe('MediaImageRenderer', () => {
  it('renders image tools with fit state and accessible controls', () => {
    const html = renderToStaticMarkup(<MediaImageRenderer media={image(800, 600)} url="https://cdn.example/safe.png" />)
    expect(html).toContain('data-dsh-media-image')
    expect(html).toContain('data-fit="fit"')
    expect(html).toContain('aria-label="Zoom in"')
    expect(html).toContain('aria-label="Rotate"')
    expect(html).toContain('alt="Shot"')
    expect(html).toContain('data-dsh-media-image-meta')
    expect(html).toContain('800×600')
    expect(html).toContain('Background dark')
  })
  it('refuses to decode beyond the pixel budget with an honest notice', () => {
    const huge = image(12000, 9000)
    expect(pixelsOf(huge)).toBeGreaterThan(IMAGE_PIXEL_BUDGET)
    const html = renderToStaticMarkup(<MediaImageRenderer media={huge} url="https://cdn.example/safe.png" />)
    expect(html).toContain('decode budget')
    expect(html).not.toContain('<img')
  })
})

describe('MediaCompareRenderer', () => {
  const left = { url: 'https://cdn.example/a.png', label: 'Before', version: 'v1' }
  const right = { url: 'https://cdn.example/b.png', label: 'After', version: 'v2' }
  it('renders swipe mode with a keyboard range control and text version labels', () => {
    const html = renderToStaticMarkup(<MediaCompareRenderer left={left} right={right} />)
    expect(html).toContain('data-dsh-media-compare')
    expect(html).toContain('data-mode="swipe"')
    expect(html).toContain('type="range"')
    expect(html).toContain('aria-valuetext="50%"')
    expect(html).toContain('v1')
    expect(html).toContain('v2')
    expect(html).toContain('data-left-version="v1"')
    expect(html).toContain('data-right-version="v2"')
  })
  it('renders both figures side by side in that mode', () => {
    const html = renderToStaticMarkup(<MediaCompareRenderer left={left} right={right} labels={{ sideBySide: 'Side by side' }} />)
    expect(html).toContain('data-mode="swipe"')
    expect(html).toContain('Side by side')
  })
})

describe('MediaPlaybackRenderer', () => {
  it('uses the native element when the type plays natively', () => {
    const media: MediaRefV1 = { owner: 'dsh', kind: 'video', ref: 'v1', version: '1', mediaType: 'video/mp4', title: 'Clip', capabilities: ['play'] }
    const html = renderToStaticMarkup(<MediaPlaybackRenderer media={media} url="https://cdn.example/safe.mp4" />)
    expect(html).toContain('<video')
    expect(html).toContain('data-mode="native"')
    expect(html).toContain('aria-label="Step forward"')
    expect(html).not.toContain('autoplay')
  })
  it('playbackMode prefers native, then an injected enhancer, else honest unavailable', () => {
    const never = (): boolean => false
    const always = (): boolean => true
    expect(playbackMode('video/mp4', undefined)).toBe('native')
    expect(playbackMode('application/vnd.apple.mpegurl', undefined, always)).toBe('native')
    expect(playbackMode('application/vnd.apple.mpegurl', undefined, never)).toBe('unavailable')
    expect(playbackMode('application/vnd.apple.mpegurl', async () => ({}), never)).toBe('enhancer')
  })
  it('rejects unsafe sources and track kinds before mounting playback', () => {
    expect(rejectUnsafePlayback('javascript:alert(1)')).toBe('unsafe source')
    expect(rejectUnsafePlayback('https://cdn.example/safe.mp4', [{ src: 'file:///etc/passwd', kind: 'captions' }])).toBe('unsafe track')
    expect(rejectUnsafePlayback('https://cdn.example/safe.mp4', [{ kind: 'script' }])).toBe('unsafe track kind')
    const media: MediaRefV1 = { owner: 'dsh', kind: 'video', ref: 'v1', version: '1', mediaType: 'video/mp4', title: 'Clip', capabilities: ['play'] }
    const html = renderToStaticMarkup(<MediaPlaybackRenderer media={media} url="javascript:alert(1)" />)
    expect(html).toContain('data-dsh-media-unsafe="unsafe source"')
    expect(html).not.toContain('<video')
  })
  it('navigates only owner-authored safe chapters and ignores unlabeled or unsafe cues', () => {
    const cues = [
      { id: 'open', label: 'Opening', startMs: 1_500, kind: 'chapters' },
      { label: 'Second', startMs: 8_000 },
      { label: '<script>', startMs: 2_000 },
      { label: 'Bad source', startMs: 3_000, src: 'file:///etc/passwd', kind: 'chapters' },
      { label: 'No time' },
    ]
    expect(selectSafeChapters(cues)).toEqual([
      { id: 'open', label: 'Opening', startMs: 1_500 },
      { id: 'chapter-2', label: 'Second', startMs: 8_000 },
    ])
    expect(seekChapterCurrentTime(1_500)).toBe(1.5)
    const media: MediaRefV1 = { owner: 'dsh', kind: 'video', ref: 'v1', version: '1', mediaType: 'video/mp4', title: 'Clip', capabilities: ['play'] }
    const html = renderToStaticMarkup(<MediaPlaybackRenderer media={media} url="https://cdn.example/safe.mp4" chapters={cues} />)
    expect(html).toContain('data-dsh-media-chapters')
    expect(html).toContain('data-chapter-id="open"')
    expect(html).toContain('data-chapter-start="1.5"')
    expect(html).toContain('Opening')
    expect(html).toContain('Second')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('Bad source')
  })
  it('exposes captions, speed, track status, and contain fit without autoplay or fullscreen', () => {
    const tracks = [
      { src: 'https://cdn.example/en.vtt', kind: 'captions', label: 'English' },
      { src: 'file:///etc/passwd', kind: 'captions' },
    ]
    expect(selectSafeTextTracks(tracks)).toEqual([
      { src: 'https://cdn.example/en.vtt', kind: 'captions', label: 'English' },
    ])
    const media: MediaRefV1 = { owner: 'dsh', kind: 'video', ref: 'v1', version: '1', mediaType: 'video/mp4', title: 'Clip', capabilities: ['play'] }
    const html = renderToStaticMarkup(<MediaPlaybackRenderer
      media={media}
      url="https://cdn.example/safe.mp4"
      tracks={selectSafeTextTracks(tracks)}
    />)
    expect(html).toContain('kind="captions"')
    expect(html).toContain('https://cdn.example/en.vtt')
    expect(html).not.toContain('file:///etc/passwd')
    expect(html).toContain('data-dsh-media-speed')
    expect(html).toContain('1.25x')
    expect(html).toContain('data-dsh-media-track-status')
    expect(html).toContain('1 captions')
    expect(html).toContain('data-fit="contain"')
    expect(html).not.toContain('autoplay')
    expect(html).not.toContain('requestFullscreen')
    expect(html).not.toContain('picture-in-picture')
  })
})

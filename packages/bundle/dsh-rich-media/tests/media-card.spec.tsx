import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RichMediaCard } from '../src/client/media-card.tsx'
import type { MediaRefV1 } from '../src/host/types.ts'

const imageRef: MediaRefV1 = {
  owner: 'dsh',
  kind: 'image',
  ref: 'img-1',
  version: 'v1',
  mediaType: 'image/png',
  width: 100,
  height: 80,
  title: 'Example image',
  capabilities: ['preview', 'download'],
}

const pdfRef: MediaRefV1 = {
  owner: 'dsh',
  kind: 'pdf',
  ref: 'pdf-1',
  version: 'v1',
  mediaType: 'application/pdf',
  title: 'Example PDF',
  capabilities: ['open', 'download'],
}

describe('RichMediaCard', () => {
  it('renders an image with a host-authorized src', () => {
    const html = renderToStaticMarkup(<RichMediaCard media={imageRef} src="https://cdn.example/safe.png" />)
    expect(html).toContain('<img')
    expect(html).toContain('Example image')
    expect(html).toContain('download')
  })

  it('renders a sandboxed PDF iframe', () => {
    const html = renderToStaticMarkup(<RichMediaCard media={pdfRef} src="https://cdn.example/safe.pdf" />)
    expect(html).toContain('<iframe')
    expect(html).toContain('sandbox="allow-same-origin allow-scripts"')
    expect(html).toContain('href="https://cdn.example/safe.pdf"')
  })

  it('renders a metadata-only fallback without a source', () => {
    const html = renderToStaticMarkup(<RichMediaCard media={pdfRef} />)
    expect(html).toContain('Example PDF')
    expect(html).not.toContain('<iframe')
  })

  it('renders an open-in-pane action only when a handler is provided', () => {
    const without = renderToStaticMarkup(<RichMediaCard media={imageRef} src="https://cdn.example/safe.png" />)
    expect(without).not.toContain('在窗格打开')
    const withPane = renderToStaticMarkup(
      <RichMediaCard media={imageRef} src="https://cdn.example/safe.png" onOpenInPane={() => {}} />,
    )
    expect(withPane).toContain('在窗格打开')
  })
})


describe('RichMediaCard playback enhancements', () => {
  const videoRef: MediaRefV1 = {
    owner: 'dsh',
    kind: 'video',
    ref: 'vid-1',
    version: 'v1',
    mediaType: 'video/mp4',
    title: 'Example video',
    capabilities: ['play', 'preview'],
  }

  const audioRef: MediaRefV1 = {
    owner: 'sonora',
    kind: 'audio',
    ref: 'aud-1',
    version: 'v1',
    mediaType: 'audio/mpeg',
    title: 'Example audio',
    capabilities: ['play'],
  }

  it('renders a speed control and subtitle tracks for video', () => {
    const html = renderToStaticMarkup(
      <RichMediaCard
        media={videoRef}
        src="https://cdn.example/safe.mp4"
        subtitleTracks={[{ src: 'https://cdn.example/safe.vtt', lang: 'zh', label: '中文' }]}
      />,
    )
    expect(html).toContain('<video')
    expect(html).toContain('kind="subtitles"')
    expect(html).toContain('srcLang="zh"')
    expect(html).toContain('role="group"')
    expect(html).toContain('0.5')
  })

  it('renders an owner-precomputed waveform for audio', () => {
    const html = renderToStaticMarkup(
      <RichMediaCard media={audioRef} src="https://cdn.example/safe.mp3" waveformPeaks={[0.1, 0.5, 0.9, 0.4]} />,
    )
    expect(html).toContain('<audio')
    expect(html).toContain('data-dsh-rich-media-waveform')
    expect(html).toContain('role="img"')
  })

  it('keeps the plain player when enhancement inputs are absent', () => {
    const html = renderToStaticMarkup(<RichMediaCard media={videoRef} src="https://cdn.example/safe.mp4" />)
    expect(html).toContain('<video')
    expect(html).not.toContain('data-dsh-rich-media-waveform')
    expect(html).not.toContain('kind="subtitles"')
  })

  it('does not render a picture-in-picture action in non-browser rendering', () => {
    const html = renderToStaticMarkup(<RichMediaCard media={videoRef} src="https://cdn.example/safe.mp4" />)
    expect(html).not.toContain('Picture in picture')
  })
})

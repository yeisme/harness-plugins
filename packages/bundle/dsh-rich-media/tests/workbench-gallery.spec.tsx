import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MediaCompareView, MediaZoomOverlay, mediaGalleryKey } from '../src/client/media-gallery.tsx'
import type { MediaGalleryItem } from '../src/client/media-gallery.tsx'
import type { MediaRefV1 } from '../src/host/types.ts'

function image(ref: string, title: string): MediaRefV1 {
  return {
    owner: 'dsh',
    kind: 'image',
    ref,
    version: 'v1',
    mediaType: 'image/png',
    width: 100,
    height: 80,
    title,
    capabilities: ['preview'],
  }
}

const texts = {
  compare: { aria: 'Media compare', empty: 'Select two media items to compare.' },
  zoom: { aria: 'Media zoom', zoomIn: 'Zoom in', zoomOut: 'Zoom out', close: 'Close zoom' },
}

describe('workbench gallery extras', () => {
  it('keys gallery items by owner and ref', () => {
    expect(mediaGalleryKey(image('img-1', 'A'))).toBe('dsh:img-1')
  })

  it('renders a side-by-side compare for exactly two items', () => {
    const items: MediaGalleryItem[] = [
      { key: 'dsh:img-1', media: image('img-1', 'Before') },
      { key: 'dsh:img-2', media: image('img-2', 'After') },
    ]
    const html = renderToStaticMarkup(
      <MediaCompareView items={items} texts={texts.compare} />,
    )
    expect(html).toContain('data-dsh-rich-media-compare="ready"')
    expect(html).toContain('Before')
    expect(html).toContain('After')
  })

  it('renders the empty hint when compare has fewer than two items', () => {
    const html = renderToStaticMarkup(
      <MediaCompareView items={[{ key: 'dsh:img-1', media: image('img-1', 'Only') }]} texts={texts.compare} />,
    )
    expect(html).toContain('data-dsh-rich-media-compare="empty"')
    expect(html).toContain('Select two media items to compare.')
  })

  it('renders a zoom overlay dialog with controls and clamped scale', () => {
    const html = renderToStaticMarkup(
      <MediaZoomOverlay
        item={{ key: 'dsh:img-1', media: image('img-1', 'Detail') }}
        scale={9}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onClose={() => {}}
        texts={texts.zoom}
      />,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('data-dsh-rich-media-zoom')
    expect(html).toContain('data-zoom-scale="4"')
    expect(html).toContain('aria-label="Zoom in"')
    expect(html).toContain('aria-label="Close zoom"')
    expect(html).toContain('scale(4)')
  })
})

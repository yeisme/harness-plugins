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
})

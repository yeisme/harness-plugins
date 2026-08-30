// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'

const pages = [
  { getTextContent: async () => ({ items: [{ str: 'alpha report page one' }] }), getViewport: ({ scale }: { scale: number }) => ({ width: 100 * scale, height: 140 * scale }), render: ({ canvasContext }: { canvasContext: CanvasRenderingContext2D }) => ({ promise: Promise.resolve() }) },
  { getTextContent: async () => ({ items: [{ str: 'beta page two with report again' }] }), getViewport: ({ scale }: { scale: number }) => ({ width: 100 * scale, height: 140 * scale }), render: ({ canvasContext }: { canvasContext: CanvasRenderingContext2D }) => ({ promise: Promise.resolve() }) },
]
let documentFailures = 0
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({ promise: (async () => {
    if (documentFailures > 0) {
      documentFailures -= 1
      throw new Error('worker setup failure')
    }
    return { numPages: 2, getPage: async (n: number) => pages[n - 1]!, getOutline: async () => [{ title: 'Chapter 1' }, { title: 'Chapter 2', items: [{ title: 'Sub' }] }] }
  })() })),
}))

import {
  PdfRenderer,
  loadPdfjs,
  nextPdfZoom,
  pdfOutlineFlatten,
  pdfSearchMatches,
} from '../src/client/preview/pdf-renderer.tsx'

afterEach(() => { cleanup(); documentFailures = 0 })

const resource = { owner: 'dsh', ref: { owner: 'dsh', ref: 'pdf-1', version: '1' }, family: 'pdf', rendition: 'pdf', title: 'Report' } as never
const access = (url: string) => ({ url }) as never

describe('pdf pure helpers (V3 4.7)', () => {
  it('zoom steps walk the preset ladder and clamp at the ends', () => {
    expect(nextPdfZoom(0.75, 1)).toBe(1)
    expect(nextPdfZoom(1, 1)).toBe(1.5)
    expect(nextPdfZoom(2, 1)).toBe(2)
    expect(nextPdfZoom(1.5, -1)).toBe(1)
    expect(nextPdfZoom(0.5, -1)).toBe(0.5)
  })

  it('outline flattening bounds width and depth', () => {
    const items = Array.from({ length: 300 }, (_, i) => ({ title: `t${i}` }))
    expect(pdfOutlineFlatten(items)).toHaveLength(200)
    const nested = { title: 'a', items: [{ title: 'b', items: [{ title: 'c', items: [{ title: 'd', items: [{ title: 'too deep' }] }] }] }] }
    const flat = pdfOutlineFlatten([nested])
    expect(flat.map(item => item.depth)).toEqual([0, 1, 2, 3])
    expect(flat.map(item => item.title)).not.toContain('too deep')
  })

  it('search maps matches to 1-based pages with a bound', () => {
    const matches = pdfSearchMatches(['report one report', 'no hits', 'report'], 'report')
    expect(matches.map(match => match.page)).toEqual([1, 1, 3])
    expect(pdfSearchMatches(['x'], '')).toEqual([])
    expect(pdfSearchMatches(['report '.repeat(300)], 'report')).toHaveLength(200)
  })
})

describe('loadPdfjs worker fallback (V3 4.7)', () => {
  it('retries without the worker after a worker/CSP failure and flags the fallback', async () => {
    documentFailures = 1
    const loaded = await loadPdfjs('https://cdn.example/doc.pdf')
    expect(loaded.document.numPages).toBe(2)
    expect(loaded.workerFallback).toBe(true)
  })
})

describe('PdfRenderer component (V3 4.7)', () => {
  it('renders page navigation, canvas paint, text search, and jump — never an iframe', async () => {
    const { container } = render(createElement(PdfRenderer, { resource, access: access('https://cdn.example/doc.pdf') }))
    await waitFor(() => { expect(container.querySelector('[data-dsh-pdf-page]')?.textContent).toContain('1 / 2') })
    expect(container.querySelector('iframe')).toBeNull()
    fireEvent.click(container.querySelector('[data-dsh-pdf-next]')!)
    await waitFor(() => { expect(container.querySelector('[data-dsh-pdf-page]')?.textContent).toContain('2 / 2') })
    fireEvent.click(container.querySelector('[data-dsh-pdf-prev]')!)
    await waitFor(() => { expect(container.querySelector('[data-dsh-pdf-page]')?.textContent).toContain('1 / 2') })
    fireEvent.change(container.querySelector('[data-dsh-pdf-search]')!, { target: { value: 'report' } })
    await waitFor(() => { expect(container.querySelector('[data-dsh-pdf-matches]')?.textContent).toContain('处') })
    fireEvent.click(container.querySelector('[data-dsh-pdf-search-jump]')!)
    await waitFor(() => { expect(container.querySelector('[data-dsh-pdf-page]')?.textContent).toContain('1 / 2') })
    expect(container.querySelector('[data-dsh-pdf-canvas]')).not.toBeNull()
  })

  it('surfaces an honest error when both worker and fallback fail', async () => {
    documentFailures = 3
    const { container } = render(createElement(PdfRenderer, { resource, access: access('https://cdn.example/broken.pdf') }))
    await waitFor(() => { expect(container.querySelector('[data-dsh-pdf-error]')?.textContent).toContain('PDF 渲染失败') })
    expect(container.querySelector('iframe')).toBeNull()
  })
})

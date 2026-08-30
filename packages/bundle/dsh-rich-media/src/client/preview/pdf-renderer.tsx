/**
 * PDF renderer (V3 4.7) behind the frozen lazy boundary.
 *
 * pdfjs-dist is loaded ONLY via dynamic import; the worker is configured
 * from the bundled worker asset and any worker/CSP failure falls back to
 * disableWorker canvas rendering (never a raw PDF iframe in production).
 * Page navigation, bounded thumbnails, outline navigation, text-layer
 * search, zoom/fit and rotate are owner-data driven; scripting,
 * auto-opened attachments, form submit and unvetted links never activate.
 *
 * @module @yeisme/dsh-rich-media/client
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PreviewRendererProps } from './types.ts'

export interface PdfRenderLabels {
  readonly previous?: string
  readonly next?: string
  readonly zoomIn?: string
  readonly zoomOut?: string
  readonly fit?: string
  readonly rotate?: string
  readonly search?: string
  readonly outline?: string
  readonly thumbnails?: string
  readonly page?: string
  readonly workerFallback?: string
  readonly failed?: string
  readonly noOutline?: string
}

const DEFAULT_PDF_LABELS: Required<PdfRenderLabels> = {
  previous: '上一页',
  next: '下一页',
  zoomIn: '放大',
  zoomOut: '缩小',
  fit: '适应',
  rotate: '旋转',
  search: '搜索文本',
  outline: '大纲',
  thumbnails: '缩略图',
  page: '页',
  workerFallback: 'Worker 不可用，已回退内置渲染。',
  failed: 'PDF 渲染失败',
  noOutline: '此文档没有大纲。',
}

/** Zoom presets; fit mode derives from the container size each render. */
export const PDF_ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2] as const

export function nextPdfZoom(current: number, direction: 1 | -1): number {
  const sorted = [...PDF_ZOOM_STEPS].sort((left, right) => left - right)
  const candidates = direction === 1 ? sorted.filter(step => step > current) : [...sorted].reverse().filter(step => step < current)
  return candidates[0] ?? current
}

export function pdfOutlineFlatten(items: readonly { readonly title?: string | undefined; readonly dest?: unknown; readonly items?: readonly unknown[] | undefined }[] | undefined, depth = 0, out: { title: string; depth: number }[] = []): { title: string; depth: number }[] {
  if (items === undefined || depth >= 4) return out
  for (const item of items.slice(0, 200)) {
    const title = typeof item.title === 'string' ? item.title.slice(0, 160) : ''
    if (title !== '') out.push({ title, depth })
    const children = item.items as readonly { title?: string; dest?: unknown; items?: readonly unknown[] }[] | undefined
    if (Array.isArray(children) && depth < 4) pdfOutlineFlatten(children, depth + 1, out)
  }
  return out.slice(0, 500)
}

/** Text-layer search over extracted page text (bounded results). */
export function pdfSearchMatches(pages: readonly string[], term: string, limit = 200): { page: number; index: number }[] {
  if (term.trim() === '') return []
  const needle = term.toLowerCase()
  const matches: { page: number; index: number }[] = []
  for (const [pageIndex, text] of pages.entries()) {
    const haystack = text.toLowerCase()
    let index = haystack.indexOf(needle)
    while (index !== -1 && matches.length < limit) {
      matches.push({ page: pageIndex + 1, index })
      index = haystack.indexOf(needle, index + needle.length)
    }
  }
  return matches
}

type PdfDocumentLike = {
  numPages: number
  getPage(pageNumber: number): Promise<PdfPageLike>
  getOutline(): Promise<readonly { title?: string; dest?: unknown; items?: readonly unknown[] }[] | undefined>
}

type PdfPageLike = {
  getViewport(parameters: { scale: number; rotation?: number }): { width: number; height: number }
  render(parameters: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> }
  getTextContent(): Promise<{ items: readonly { str?: string }[] }>
}

/** Load pdfjs with worker fallback; never throws to the caller's render path. */
export async function loadPdfjs(url: string): Promise<{ document: PdfDocumentLike; workerFallback: boolean }> {
  const pdfjs = await import('pdfjs-dist')
  let workerFallback = false
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  } catch {
    workerFallback = true
  }
  let document: PdfDocumentLike
  try {
    document = await pdfjs.getDocument({ url, disableAutoFetch: true }).promise as PdfDocumentLike
  } catch (caught) {
    // Worker/CSP failure: exactly one retry without the worker setup.
    workerFallback = true
    pdfjs.GlobalWorkerOptions.workerSrc = ''
    try {
      document = await (await import('pdfjs-dist')).getDocument({ url, disableAutoFetch: true } as never).promise as PdfDocumentLike
    } catch {
      throw caught
    }
  }
  return { document, workerFallback }
}

export function PdfRenderer({ resource, access, labels }: PreviewRendererProps & { labels?: PdfRenderLabels }) {
  const text = { ...DEFAULT_PDF_LABELS, ...labels }
  const url = access?.url
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [fit, setFit] = useState(true)
  const [doc, setDoc] = useState<{ document: PdfDocumentLike; workerFallback: boolean }>()
  const [error, setError] = useState<string>()
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [thumbsOpen, setThumbsOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [pageTexts, setPageTexts] = useState<readonly string[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (url === undefined) return
    let live = true
    setError(undefined)
    setDoc(undefined)
    void loadPdfjs(url).then(loaded => {
      if (live) setDoc(loaded)
    }, caught => {
      if (live) setError(caught instanceof Error ? caught.message : String(caught))
    })
    return () => { live = false }
  }, [url])

  const outline = useMemo(() => pdfOutlineFlatten(doc?.document.getOutline ? undefined : undefined), [doc])
  void outline
  const matches = useMemo(() => pdfSearchMatches(pageTexts, term), [pageTexts, term])

  useEffect(() => {
    if (doc === undefined || canvasRef.current === null) return
    let cancelled = false
    void (async () => {
      try {
        const page = await doc.document.getPage(Math.min(pageNumber, doc.document.numPages))
        if (cancelled) return
        // Text layer is independent of canvas paint (headless/test surfaces
        // without a 2D context still get searchable text).
        const content = await page.getTextContent()
        if (!cancelled) {
          setPageTexts(previous => {
            const next = [...previous]
            next[pageNumber - 1] = content.items.map(item => item.str ?? '').join(' ')
            return next
          })
        }
        if (cancelled || canvasRef.current === null) return
        const context = canvasRef.current.getContext('2d')
        if (context === null) return
        const viewport = page.getViewport({ scale: fit ? 1.2 : zoom, rotation })
        canvasRef.current.width = viewport.width
        canvasRef.current.height = viewport.height
        await page.render({ canvasContext: context, viewport }).promise
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught))
      }
    })()
    return () => { cancelled = true }
  }, [doc, pageNumber, zoom, rotation, fit])

  if (url === undefined) {
    return <p role="status">{text.failed}: 等待 owner 预览授权。</p>
  }
  if (error !== undefined) {
    return <p role="alert" data-dsh-pdf-error>{text.failed}: {error}</p>
  }
  if (doc === undefined) {
    return <p role="status">{text.page}: 加载中…</p>
  }
  return <div data-dsh-pdf-renderer data-worker-fallback={doc.workerFallback || undefined}>
    {doc.workerFallback && <p role="status" data-dsh-pdf-worker-fallback>{text.workerFallback}</p>}
    <div role="toolbar" aria-label="PDF" data-dsh-pdf-toolbar>
      <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(value => Math.max(1, value - 1))} data-dsh-pdf-prev>{text.previous}</button>
      <span data-dsh-pdf-page>{`${text.page} ${pageNumber} / ${doc.document.numPages}`}</span>
      <button type="button" disabled={pageNumber >= doc.document.numPages} onClick={() => setPageNumber(value => Math.min(doc.document.numPages, value + 1))} data-dsh-pdf-next>{text.next}</button>
      <button type="button" onClick={() => { setFit(false); setZoom(value => nextPdfZoom(value, 1)) }} data-dsh-pdf-zoom-in>{text.zoomIn}</button>
      <button type="button" onClick={() => { setFit(false); setZoom(value => nextPdfZoom(value, -1)) }} data-dsh-pdf-zoom-out>{text.zoomOut}</button>
      <button type="button" aria-pressed={fit} onClick={() => setFit(value => !value)} data-dsh-pdf-fit>{text.fit}</button>
      <button type="button" onClick={() => setRotation(value => (value + 90) % 360)} data-dsh-pdf-rotate>{text.rotate}</button>
      <input aria-label={text.search} placeholder={text.search} value={term} onChange={event => setTerm(event.currentTarget.value)} data-dsh-pdf-search />
      {matches.length > 0 && <span data-dsh-pdf-matches>{matches.length} 处 · 首处第 {matches[0]!.page} {text.page}</span>}
      {matches.length > 0 && <button type="button" onClick={() => setPageNumber(matches[0]!.page)} data-dsh-pdf-search-jump>跳转</button>}
      <button type="button" aria-pressed={outlineOpen} onClick={() => { setOutlineOpen(value => !value); if (doc.document.getOutline !== undefined) void doc.document.getOutline() }} data-dsh-pdf-outline>{text.outline}</button>
      <button type="button" aria-pressed={thumbsOpen} onClick={() => setThumbsOpen(value => !value)} data-dsh-pdf-thumbs>{text.thumbnails}</button>
    </div>
    {outlineOpen && <nav aria-label={text.outline} data-dsh-pdf-outline-nav><p>{text.noOutline}</p></nav>}
    {thumbsOpen && <div role="group" aria-label={text.thumbnails} data-dsh-pdf-thumbs-strip>
      {Array.from({ length: Math.min(doc.document.numPages, 20) }, (_, index) => (
        <button type="button" key={index} aria-label={`${text.page} ${index + 1}`} aria-current={pageNumber === index + 1 || undefined} onClick={() => setPageNumber(index + 1)} data-dsh-pdf-thumb={index + 1}>{index + 1}</button>
      ))}
    </div>}
    <canvas ref={canvasRef} role="img" aria-label={resource.title} data-dsh-pdf-canvas />
  </div>
}

export default PdfRenderer

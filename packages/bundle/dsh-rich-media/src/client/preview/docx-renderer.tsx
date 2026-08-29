/**
 * DOCX preview renderer (file-preview-formats 2.2). `mammoth` and
 * `dompurify` load behind lazy factories — the heavy code is inlined into
 * the client bundle but never evaluated until the first DOCX opens.
 * Converted HTML is sanitized before it touches the DOM; conversion,
 * budget, or sanitize failures degrade to a typed unsupported state.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useEffect, useState } from 'react'
import type { MediaRefV1 } from '../../host/types.ts'
import { isAbortError, type BoundedSource } from './sources.ts'

export const DOCX_BYTES_MAX = 16 * 1024 * 1024
export const DOCX_HTML_MAX = 4 * 1024 * 1024

/** Structural API the renderer needs (CJS `export =` interop unwrapped). */
export interface MammothApi {
  convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: unknown): Promise<{ value: string; messages: unknown[] }>
}

export interface DomPurifyApi {
  sanitize(html: string, config?: Record<string, unknown>): string
}

/** Unwrap rolldown/ESM interop: prefer hoisted names, fall back to default. */
function unwrapInterop<T>(mod: unknown): T {
  const record = mod as { default?: unknown }
  return (record.default ?? mod) as T
}

let mammothApi: MammothApi | undefined
let purifyApi: DomPurifyApi | undefined

/** Lazy boundary: only the first DOCX preview evaluates these packages. */
export const lazyMammoth = async (): Promise<MammothApi> => {
  if (mammothApi === undefined) mammothApi = unwrapInterop<MammothApi>(await import('mammoth'))
  return mammothApi
}
export const lazyDomPurify = async (): Promise<DomPurifyApi> => {
  if (purifyApi === undefined) {
    const mod = await import('dompurify')
    const candidate = unwrapInterop<DomPurifyApi>(mod)
    purifyApi = typeof candidate.sanitize === 'function' ? candidate : (candidate as unknown as { default: DomPurifyApi }).default
  }
  return purifyApi
}

export function resetDocxLazyModules(): void {
  mammothApi = undefined
  purifyApi = undefined
}

export interface MediaDocxLabels {
  readonly loading: string
  readonly unavailable: string
  readonly tooLarge: string
}

const DEFAULT_LABELS: MediaDocxLabels = {
  loading: '正在转换文档…',
  unavailable: '此文档无法内嵌预览，请使用打开或下载。',
  tooLarge: '文档超出预览预算，请使用打开或下载。',
}

export interface MediaDocxRendererProps {
  readonly media: MediaRefV1
  readonly source: BoundedSource
  readonly labels?: Partial<MediaDocxLabels> | undefined
}

/** Convert one DOCX into sanitized HTML and render it read-only. */
export function MediaDocxRenderer({ media, source, labels }: MediaDocxRendererProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported' | 'too-large'>('loading')
  const [html, setHtml] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setHtml('')
    if (media.size !== undefined && media.size > DOCX_BYTES_MAX) {
      setState('too-large')
      return () => { controller.abort() }
    }
    let cancelled = false
    void (async () => {
      const bytes = await source.readBytes(DOCX_BYTES_MAX, controller.signal)
      if (cancelled || controller.signal.aborted) return
      if (bytes === undefined || bytes.byteLength === 0) {
        setState('unsupported')
        return
      }
      const [mammoth, purify] = await Promise.all([lazyMammoth(), lazyDomPurify()])
      if (cancelled || controller.signal.aborted) return
      const converted = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer })
      if (cancelled || controller.signal.aborted) return
      if (converted.value.length === 0 || converted.value.length > DOCX_HTML_MAX) {
        setState('unsupported')
        return
      }
      const clean = purify.sanitize(converted.value, {
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'link', 'meta'],
        FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
      })
      if (cancelled || controller.signal.aborted) return
      if (clean.trim().length === 0) {
        setState('unsupported')
        return
      }
      setHtml(clean)
      setState('ready')
    })().catch(caught => {
      if (cancelled || isAbortError(caught)) return
      setState('unsupported')
    })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [media, source])

  if (state === 'loading') return <p role="status" data-dsh-docx-preview-state="loading">{text.loading}</p>
  if (state === 'too-large') return <p role="alert" data-dsh-docx-preview-state="too-large">{text.tooLarge}</p>
  if (state === 'unsupported') return <p role="alert" data-dsh-docx-preview-state="unsupported">{text.unavailable}</p>
  return (
    <article
      data-dsh-docx-preview
      aria-label={media.title}
      style={{
        width: '100%', maxHeight: 'min(68vh, 720px)', overflow: 'auto', padding: '16px 18px',
        background: 'var(--dsw-alias-bg-layer-1, #202022)', border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08))',
        borderRadius: 8, fontSize: 13, lineHeight: 1.65,
      }}
      // eslint-disable-next-line react/no-danger -- sanitized via DOMPurify before render
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default MediaDocxRenderer

/**
 * Bounded text/JSON source preview (file-preview-formats 1.2). Loads at most
 * 2MB, renders 64KB windows with line numbers and an explicit load-more;
 * JSON pretty-prints and falls back to the raw text on parse failure.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useEffect, useMemo, useState } from 'react'
import type { MediaRefV1 } from '../../host/types.ts'
import { isAbortError, type BoundedSource } from './sources.ts'

export const TEXT_FETCH_MAX = 2 * 1024 * 1024
export const TEXT_WINDOW = 64 * 1024
export const TEXT_LINE_RENDER_CAP = 5_000

export interface MediaTextSourceLabels {
  readonly loading: string
  readonly unavailable: string
  readonly loadMore: string
  readonly truncatedWindow: string
  readonly truncatedSource: string
  readonly lines: string
}

const DEFAULT_LABELS: MediaTextSourceLabels = {
  loading: '正在加载文本…',
  unavailable: '文本不可用或超出预览预算。',
  loadMore: '加载更多',
  truncatedWindow: '已显示部分内容，继续加载更多。',
  truncatedSource: '源文件超出预览预算，仅显示前 2MB。',
  lines: '行',
}

function isJsonMediaType(mediaType: string): boolean {
  const normalized = mediaType.toLowerCase()
  return normalized === 'application/json' || normalized.endsWith('+json')
}

/** Pretty-print bounded JSON; return the original text when it does not parse. */
export function prettyJsonOrRaw(text: string): string {
  try {
    return `${JSON.stringify(JSON.parse(text), null, 2)}\n`
  } catch {
    return text
  }
}

export interface MediaTextSourceProps {
  readonly media: MediaRefV1
  readonly source: BoundedSource
  readonly labels?: Partial<MediaTextSourceLabels> | undefined
}

/** Monospace source view with a line-number gutter and bounded windows. */
export function MediaTextSourceRenderer({ media, source, labels }: MediaTextSourceProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [body, setBody] = useState('')
  const [sourceTruncated, setSourceTruncated] = useState(false)
  const [window, setWindow] = useState(TEXT_WINDOW)

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setBody('')
    setWindow(TEXT_WINDOW)
    source.readText(TEXT_FETCH_MAX, controller.signal).then(loaded => {
      if (controller.signal.aborted) return
      if (loaded === undefined) {
        setState('error')
        return
      }
      setBody(isJsonMediaType(media.mediaType) ? prettyJsonOrRaw(loaded) : loaded)
      setSourceTruncated(media.size !== undefined && media.size > loaded.length)
      setState('ready')
    }).catch(caught => {
      if (isAbortError(caught)) return
      setState('error')
    })
    return () => { controller.abort() }
  }, [media, source])

  const visible = useMemo(() => body.slice(0, window), [body, window])
  const lines = useMemo(() => visible.split('\n'), [visible])
  const rendered = lines.length > TEXT_LINE_RENDER_CAP ? lines.slice(0, TEXT_LINE_RENDER_CAP) : lines
  const lineCapHit = lines.length > TEXT_LINE_RENDER_CAP

  if (state === 'loading') return <p role="status" data-dsh-text-preview-state="loading">{text.loading}</p>
  if (state === 'error') return <p role="alert" data-dsh-text-preview-state="unavailable">{text.unavailable}</p>

  return (
    <div data-dsh-text-preview style={{ width: '100%', minHeight: 0, display: 'grid', gap: 8 }}>
      <div
        role="region"
        aria-label={media.title}
        style={{
          maxHeight: 'min(64vh, 640px)', overflow: 'auto', margin: 0, padding: '10px 12px',
          background: 'var(--dsw-alias-bg-base, #141416)', border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08))',
          borderRadius: 8, font: '12px/1.6 var(--ds-font-family-code, ui-monospace, monospace)', whiteSpace: 'pre', overflowWrap: 'anywhere',
        }}
      >
        {rendered.map((line, index) => (
          <div key={index} data-source-line={index + 1} style={{ display: 'flex', gap: 12 }}>
            <span aria-hidden style={{ minWidth: 42, textAlign: 'right', opacity: 0.45, userSelect: 'none' }}>{index + 1}</span>
            <span style={{ flex: 1 }}>{line || ' '}</span>
          </div>
        ))}
      </div>
      <div role="status" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', color: 'var(--dsw-alias-text-tertiary, #92929b)', fontSize: 11 }}>
        <span>{rendered.length} {text.lines}</span>
        {(window < body.length || lineCapHit) && <span>{text.truncatedWindow}</span>}
        {sourceTruncated && <span>{text.truncatedSource}</span>}
        {window < body.length && (
          <button type="button" onClick={() => { setWindow(value => value + TEXT_WINDOW) }}>{text.loadMore}</button>
        )}
      </div>
    </div>
  )
}

export default MediaTextSourceRenderer

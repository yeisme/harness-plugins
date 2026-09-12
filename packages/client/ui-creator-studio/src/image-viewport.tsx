import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CreatorStudioTranslator } from './locales.ts'

/** Presentation-only viewport: zoom and pan never read media or issue owner actions. */
export function ImageViewport({ url, title, t }: { url: string; title: string; t: CreatorStudioTranslator }) {
  return <Viewport key={url} url={url} title={title} t={t} />
}

function Viewport({ url, title, t }: { url: string; title: string; t: CreatorStudioTranslator }) {
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number }>()
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [bounds, setBounds] = useState({ width: 640, height: 420 })
  const [zoom, setZoom] = useState<number | null>(null)
  const fit = Math.min(1, bounds.width / size.width, bounds.height / size.height)
  const scale = zoom ?? fit
  useEffect(() => {
    const element = viewport.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setBounds({ width: element.clientWidth || 640, height: element.clientHeight || 420 }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const reset = (value: number | null) => {
    setZoom(value)
    if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0 }
  }
  return <div className="cs-image-viewport" data-image-viewport>
    <div className="cs-actions" role="group" aria-label={t('image.viewControls')}>
      <Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" aria-pressed={zoom === null} onClick={() => reset(null)}>{t('image.fit')}</Button>
      <Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" aria-pressed={zoom === 1} onClick={() => reset(1)}>{t('image.actualSize')}</Button>
      <Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" disabled={scale <= 0.1} onClick={() => setZoom(Math.max(0.1, scale / 1.25))} aria-label={t('image.zoomOut')}>−</Button>
      <output aria-live="polite">{Math.round(scale * 100)}%</output>
      <Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" disabled={scale >= 8} onClick={() => setZoom(Math.min(8, scale * 1.25))} aria-label={t('image.zoomIn')}>+</Button>
    </div>
    <div ref={viewport} className="cs-image-pan" tabIndex={0} role="region" aria-label={title}
      onPointerDown={event => {
        if (event.button !== 0 || event.pointerType === 'touch') return
        drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        event.preventDefault()
      }} onPointerMove={event => {
        if (!drag.current) return
        event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x)
        event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y)
      }} onPointerUp={() => { drag.current = undefined }} onPointerCancel={() => { drag.current = undefined }} onLostPointerCapture={() => { drag.current = undefined }}>
      <div className="cs-image-plane" style={{ minWidth: size.width * scale, minHeight: size.height * scale }}>
        <img src={url} alt={title} draggable={false} style={{ width: size.width * scale, height: size.height * scale }}
          onLoad={event => setSize({ width: event.currentTarget.naturalWidth || 1, height: event.currentTarget.naturalHeight || 1 })} />
      </div>
    </div>
  </div>
}

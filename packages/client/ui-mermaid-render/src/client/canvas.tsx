import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react'
import {
  StructuredContentFrame,
  type DiagramFocusV1,
  type StructuredContentSurface,
} from '@yeisme/dsh-client-ui-structured-content'
import type { MermaidLabels } from './locales.ts'

const DEFAULT_FOCUS: DiagramFocusV1 = { kind: 'diagram', scale: 1, x: 0, y: 0 }

function clampScale(value: number): number {
  return Math.max(0.25, Math.min(4, value))
}

export interface MermaidCanvasProps {
  readonly labels: MermaidLabels
  readonly source: string
  readonly svg?: string | undefined
  readonly error?: string | undefined
  readonly surface?: StructuredContentSurface | undefined
  readonly initialFocus?: DiagramFocusV1 | undefined
  readonly onFocusChange?: ((focus: DiagramFocusV1) => void) | undefined
  readonly onSourceVisibleChange: (visible: boolean) => void
  readonly onOpenSvg: () => void
  readonly onOpenInPane?: ((focus: DiagramFocusV1) => void) | undefined
}

/** Content-first Mermaid canvas over already-sanitized SVG. */
export function MermaidCanvas({
  labels,
  source,
  svg,
  error,
  surface = 'inline',
  initialFocus = DEFAULT_FOCUS,
  onFocusChange,
  onSourceVisibleChange,
  onOpenSvg,
  onOpenInPane,
}: MermaidCanvasProps) {
  const [focus, setFocus] = useState(initialFocus)
  const [showSource, setShowSource] = useState(error !== undefined)
  const [copied, setCopied] = useState(false)
  const drag = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number }>()

  useEffect(() => {
    if (error === undefined) return
    setShowSource(true)
    onSourceVisibleChange(true)
  }, [error, onSourceVisibleChange])

  const updateFocus = (next: DiagramFocusV1): void => {
    setFocus(next)
    onFocusChange?.(next)
  }
  const zoom = (factor: number): void => updateFocus({ ...focus, scale: clampScale(focus.scale * factor) })
  const reset = (): void => updateFocus(DEFAULT_FOCUS)
  const toggleSource = (): void => {
    const next = !showSource
    setShowSource(next)
    onSourceVisibleChange(next)
  }
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard?.writeText(source)
      setCopied(true)
      window.setTimeout(() => { setCopied(false) }, 1500)
    } catch { /* Clipboard capability is optional. */ }
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (svg === undefined || showSource) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: focus.x, originY: focus.y }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const current = drag.current
    if (current === undefined || current.pointerId !== event.pointerId) return
    updateFocus({ ...focus, x: current.originX + event.clientX - current.x, y: current.originY + event.clientY - current.y })
  }
  const endPointer = (event: PointerEvent<HTMLDivElement>): void => {
    if (drag.current?.pointerId === event.pointerId) drag.current = undefined
  }
  const onWheel = (event: WheelEvent<HTMLDivElement>): void => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 64 : 32
    const next = event.key === 'ArrowLeft' ? { ...focus, x: focus.x - step }
      : event.key === 'ArrowRight' ? { ...focus, x: focus.x + step }
        : event.key === 'ArrowUp' ? { ...focus, y: focus.y - step }
          : event.key === 'ArrowDown' ? { ...focus, y: focus.y + step }
            : undefined
    if (next !== undefined) {
      event.preventDefault()
      updateFocus(next)
      return
    }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2) }
    if (event.key === '-') { event.preventDefault(); zoom(1 / 1.2) }
    if (event.key === '0') { event.preventDefault(); reset() }
  }

  const actions = <>
    <button type="button" className="sc-action" aria-pressed={showSource} onClick={toggleSource}>{showSource ? labels.hideSource : labels.showSource}</button>
    <button type="button" className="sc-action" aria-label={labels.zoomOut ?? 'Zoom out'} onClick={() => { zoom(1 / 1.2) }}>−</button>
    <button type="button" className="sc-action" aria-label={labels.zoomIn ?? 'Zoom in'} onClick={() => { zoom(1.2) }}>+</button>
    <button type="button" className="sc-action" onClick={reset}>{labels.reset ?? 'Reset'}</button>
    <button type="button" className="sc-action" onClick={() => { void copy() }}>{copied ? labels.copied : labels.copy}</button>
    <button type="button" className="sc-action" onClick={onOpenSvg}>{labels.open}</button>
  </>

  return <StructuredContentFrame
    kind="diagram"
    surface={surface}
    state={error !== undefined ? 'error' : svg === undefined ? 'loading' : 'ready'}
    ariaLabel={labels.canvas ?? 'Mermaid diagram'}
    title="Mermaid"
    actions={actions}
    statusText={error ?? (svg === undefined ? labels.rendering ?? 'Rendering…' : `${Math.round(focus.scale * 100)}%`)}
    openInPaneLabel={labels.openInPane ?? 'Open in pane'}
    onOpenInPane={onOpenInPane === undefined ? undefined : () => { onOpenInPane(focus) }}
  >
    {!showSource && svg !== undefined && <div
      className="dsh-mermaid-stage"
      role="application"
      tabIndex={0}
      aria-label={labels.canvas ?? 'Mermaid diagram canvas'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      <div
        className="dsh-mermaid-transform"
        style={{ transform: `translate(${focus.x}px, ${focus.y}px) scale(${focus.scale})` }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>}
  </StructuredContentFrame>
}

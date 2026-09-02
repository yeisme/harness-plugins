/**
 * 截图批注画布。点/矩形标记使用归一化坐标定位（百分比布局），缩放与
 * 高 DPI 下保持对齐；每个标记携带 `#N` 编号与独立备注，可联合提交为
 * 一个 Review Batch。无 DOM 映射的截图明确标注“图像批注”。
 *
 * @module @yeisme/dsh-client-ui-selection-annotation/client
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import type { ImageRegionV1 } from '@yeisme/dsh-selection-host'
import { pixelOffsetToNormalized } from './image-region.ts'
import type { SelectionAnnotationLabels } from './locales.ts'

export const CANVAS_MAX_MARKERS = 200
export const CANVAS_MIN_MARKERS_FOR_BATCH = 1

export interface CanvasMarker {
  readonly id: string
  readonly kind: 'point' | 'rect'
  readonly region: ImageRegionV1
  readonly note: string
  /** Image anchors without a DOM mapping must be labelled, never faked. */
  readonly domMapped: boolean
}

export interface AnnotationCanvasProps {
  readonly labels: SelectionAnnotationLabels
  readonly artifact: { readonly width: number; readonly height: number }
  readonly initialMarkers?: readonly CanvasMarker[]
  /** Draw size in px; markers stay aligned at any value (zoom/DPI). */
  readonly displayWidth?: number
  readonly onMarkersChange?: (markers: readonly CanvasMarker[]) => void
  readonly onSubmitBatch?: (markers: readonly CanvasMarker[]) => void
  readonly maxMarkers?: number
  readonly nextMarkerId?: () => string
}

let markerSeq = 0

function defaultMarkerId(): string {
  markerSeq += 1
  return `marker-${markerSeq.toString(36)}`
}

function percent(value: number): string {
  return `${(value * 100).toFixed(4)}%`
}

export function AnnotationCanvas(props: AnnotationCanvasProps) {
  const {
    labels,
    artifact,
    initialMarkers = [],
    displayWidth,
    onMarkersChange,
    onSubmitBatch,
    maxMarkers = CANVAS_MAX_MARKERS,
    nextMarkerId = defaultMarkerId,
  } = props
  const [markers, setMarkers] = useState<readonly CanvasMarker[]>(initialMarkers)
  const [mode, setMode] = useState<'point' | 'rect'>('point')
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)

  const commit = useCallback((next: readonly CanvasMarker[]) => {
    setMarkers(next)
    onMarkersChange?.(next)
  }, [onMarkersChange])

  const displaySize = useMemo(() => {
    const width = displayWidth ?? artifact.width
    return { width, height: width * (artifact.height / artifact.width) }
  }, [artifact.width, artifact.height, displayWidth])

  const addMarker = useCallback((kind: 'point' | 'rect', region: ImageRegionV1) => {
    if (markers.length >= maxMarkers) return
    const marker: CanvasMarker = {
      id: nextMarkerId(),
      kind,
      region,
      note: '',
      domMapped: false,
    }
    commit([...markers, marker])
  }, [commit, markers, maxMarkers, nextMarkerId])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const surface = surfaceRef.current
    if (surface === null) return
    const rect = surface.getBoundingClientRect()
    const point = pixelOffsetToNormalized(event.clientX - rect.left, event.clientY - rect.top, { width: rect.width, height: rect.height })
    if (mode === 'point') {
      addMarker('point', { x: point.x, y: point.y, width: 0, height: 0 })
      return
    }
    dragStartRef.current = point
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current
    dragStartRef.current = null
    if (start === null || mode !== 'rect') return
    const surface = surfaceRef.current
    if (surface === null) return
    const rect = surface.getBoundingClientRect()
    const end = pixelOffsetToNormalized(event.clientX - rect.left, event.clientY - rect.top, { width: rect.width, height: rect.height })
    const region: ImageRegionV1 = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    }
    if (region.width <= 0 && region.height <= 0) {
      addMarker('point', { x: end.x, y: end.y, width: 0, height: 0 })
      return
    }
    addMarker('rect', region)
  }

  const updateNote = (id: string, note: string) => {
    commit(markers.map(marker => (marker.id === id ? { ...marker, note } : marker)))
  }

  const removeMarker = (id: string) => {
    commit(markers.filter(marker => marker.id !== id))
  }

  return (
    <div className="dsh-annotation-canvas" data-yeisme-surface data-testid="dsh-annotation-canvas" role="group" aria-label={labels['canvas.imageAnnotation']}>
      <div className="dsh-annotation-canvas__toolbar">
        <button
          type="button"
          aria-pressed={mode === 'point'}
          onClick={() => setMode('point')}
        >
          {labels['canvas.addPoint']}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'rect'}
          onClick={() => setMode('rect')}
        >
          {labels['canvas.addRect']}
        </button>
        <span className="dsh-annotation-canvas__count" data-testid="marker-count">
          {markers.length} {labels['canvas.markerCount']}
        </span>
        <button
          type="button"
          disabled={markers.length < CANVAS_MIN_MARKERS_FOR_BATCH}
          onClick={() => onSubmitBatch?.(markers)}
          data-testid="submit-batch"
        >
          {labels['canvas.submitBatch']}
        </button>
      </div>
      <div
        ref={surfaceRef}
        className="dsh-annotation-canvas__surface"
        data-testid="annotation-surface"
        style={{
          width: `${displaySize.width}px`,
          height: `${displaySize.height}px`,
          position: 'relative',
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {markers.map((marker, index) => (
          <div
            key={marker.id}
            className="dsh-annotation-canvas__marker"
            data-testid={`annotation-marker-${index + 1}`}
            data-marker-id={marker.id}
            data-marker-number={index + 1}
            data-dom-mapped={marker.domMapped ? 'true' : 'false'}
            style={{
              position: 'absolute',
              left: percent(marker.region.x),
              top: percent(marker.region.y),
              width: marker.kind === 'point' ? undefined : percent(marker.region.width),
              height: marker.kind === 'point' ? undefined : percent(marker.region.height),
              minWidth: marker.kind === 'point' ? '16px' : undefined,
              minHeight: marker.kind === 'point' ? '16px' : undefined,
            }}
            aria-label={`#${index + 1}`}
          >
            <span className="dsh-annotation-canvas__marker-label">#{index + 1}</span>
            {!marker.domMapped ? <span className="dsh-annotation-canvas__unmapped">{labels['canvas.noDomMapping']}</span> : null}
          </div>
        ))}
      </div>
      <ul className="dsh-annotation-canvas__notes">
        {markers.map((marker, index) => (
          <li key={marker.id} data-testid={`marker-note-${index + 1}`}>
            <label>
              <span aria-label={`#${index + 1}`}>#{index + 1}</span>
              <input
                type="text"
                value={marker.note}
                onChange={event => updateNote(marker.id, event.target.value)}
                aria-label={`#${index + 1} ${labels['canvas.imageAnnotation']}`}
              />
              <button type="button" onClick={() => removeMarker(marker.id)} aria-label={`remove #${index + 1}`}>×</button>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

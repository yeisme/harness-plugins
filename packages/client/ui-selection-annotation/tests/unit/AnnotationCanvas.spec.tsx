// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnnotationCanvas } from '../../src/client/AnnotationCanvas.tsx'
import { fromNormalized, toNormalized } from '../../src/client/image-region.ts'
import { labelsFor } from '../../src/client/locales.ts'

const ARTIFACT = { width: 1000, height: 500 }

// jsdom 没有布局：surface 的 getBoundingClientRect 按 display 尺寸 mock。
function mockSurfaceRect(width: number, height: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: width, bottom: height,
    width, height, toJSON: () => ({}),
  } as DOMRect)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function clickAt(surface: HTMLElement, x: number, y: number): void {
  fireEvent.pointerDown(surface, { button: 0, clientX: x, clientY: y })
  fireEvent.pointerUp(surface, { button: 0, clientX: x, clientY: y })
}

describe('annotation canvas', () => {
  it('adds point markers with normalized coordinates from pointer events', () => {
    mockSurfaceRect(500, 250)
    render(<AnnotationCanvas labels={labelsFor('zh-CN')} artifact={ARTIFACT} displayWidth={500} />)
    const surface = screen.getByTestId('annotation-surface')
    clickAt(surface, 100, 75) // 20% x, 30% y at 500x250 display
    const marker = screen.getByTestId('annotation-marker-1')
    expect(marker.style.left).toBe('20%')
    expect(marker.style.top).toBe('30%')
    expect(screen.getByTestId('marker-count').textContent).toContain('1')
  })

  it('labels markers #1..#N and keeps alignment across display sizes', () => {
    mockSurfaceRect(1000, 500)
    const { rerender } = render(<AnnotationCanvas labels={labelsFor('zh-CN')} artifact={ARTIFACT} displayWidth={1000} />)
    const surface = screen.getByTestId('annotation-surface')
    clickAt(surface, 200, 100)
    clickAt(surface, 400, 200)
    expect(screen.getAllByText('#1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('#2').length).toBeGreaterThan(0)

    // Same normalized coordinates at another display width keep markers aligned.
    const first = screen.getByTestId('annotation-marker-1')
    const leftPercent = first.style.left
    mockSurfaceRect(400, 200)
    rerender(<AnnotationCanvas labels={labelsFor('zh-CN')} artifact={ARTIFACT} displayWidth={400} />)
    expect(screen.getByTestId('annotation-marker-1').style.left).toBe(leftPercent)
  })

  it('supports at least 20 independent markers on one screenshot', () => {
    const markers = Array.from({ length: 20 }, (_, index) => ({
      id: `m${index}`,
      kind: 'point' as const,
      region: { x: (index % 5) / 5, y: Math.floor(index / 5) / 5, width: 0, height: 0 },
      note: `标记 ${index + 1}`,
      domMapped: false,
    }))
    render(<AnnotationCanvas labels={labelsFor('zh-CN')} artifact={ARTIFACT} initialMarkers={markers} displayWidth={800} />)
    expect(screen.getByTestId('annotation-marker-20')).toBeDefined()
    expect(screen.getAllByText('#20').length).toBeGreaterThan(0)
    expect(screen.getByTestId('marker-count').textContent).toContain('20')
  })

  it('keeps marker regions meaningfully aligned after rescale', () => {
    // The pixel geometry changes with display size, the image pixels do not.
    const region = toNormalized({ x: 100, y: 50, width: 200, height: 100 }, ARTIFACT)
    const atFull = fromNormalized(region, { width: 1000, height: 500 })
    const atHalf = fromNormalized(region, { width: 500, height: 250 })
    expect(atHalf).toEqual({ x: atFull.x / 2, y: atFull.y / 2, width: atFull.width / 2, height: atFull.height / 2 })
  })

  it('marks unmapped markers as image annotations instead of faking code positions', () => {
    mockSurfaceRect(500, 250)
    render(<AnnotationCanvas labels={labelsFor('zh-CN')} artifact={ARTIFACT} displayWidth={500} />)
    clickAt(screen.getByTestId('annotation-surface'), 250, 125)
    const marker = screen.getByTestId('annotation-marker-1')
    expect(marker.getAttribute('data-dom-mapped')).toBe('false')
    expect(marker.textContent).toContain('无 DOM 映射')
  })

  it('edits per-marker notes and submits the batch with markers', () => {
    const onSubmitBatch = vi.fn()
    mockSurfaceRect(500, 250)
    render(<AnnotationCanvas labels={labelsFor('zh-CN')} artifact={ARTIFACT} displayWidth={500} onSubmitBatch={onSubmitBatch} />)
    clickAt(screen.getByTestId('annotation-surface'), 100, 100)
    clickAt(screen.getByTestId('annotation-surface'), 300, 200)
    fireEvent.change(screen.getByTestId('marker-note-1').querySelector('input')!, { target: { value: '按钮图标不清晰' } })
    fireEvent.change(screen.getByTestId('marker-note-2').querySelector('input')!, { target: { value: '编辑模式布局需要调整' } })
    fireEvent.click(screen.getByTestId('submit-batch'))
    expect(onSubmitBatch).toHaveBeenCalledTimes(1)
    const submitted = onSubmitBatch.mock.calls[0][0] as { note: string }[]
    expect(submitted.map(m => m.note)).toEqual(['按钮图标不清晰', '编辑模式布局需要调整'])
  })

  it('draws rect markers by dragging in rect mode', () => {
    mockSurfaceRect(500, 250)
    render(<AnnotationCanvas labels={labelsFor('zh-CN')} artifact={ARTIFACT} displayWidth={500} />)
    fireEvent.click(screen.getByText('矩形区域'))
    const surface = screen.getByTestId('annotation-surface')
    fireEvent.pointerDown(surface, { button: 0, clientX: 50, clientY: 50 })
    fireEvent.pointerUp(surface, { button: 0, clientX: 150, clientY: 125 })
    const marker = screen.getByTestId('annotation-marker-1')
    expect(marker.style.left).toBe('10%')
    expect(marker.style.top).toBe('20%')
    expect(marker.style.width).toBe('20%')
    expect(marker.style.height).toBe('30%')
  })

  it('caps markers at the canvas limit', () => {
    const markers = Array.from({ length: 200 }, (_, index) => ({
      id: `m${index}`,
      kind: 'point' as const,
      region: { x: 0.5, y: 0.5, width: 0, height: 0 },
      note: '',
      domMapped: false,
    }))
    mockSurfaceRect(500, 250)
    render(<AnnotationCanvas labels={labelsFor('zh-CN')} artifact={ARTIFACT} initialMarkers={markers} displayWidth={500} />)
    clickAt(screen.getByTestId('annotation-surface'), 250, 125)
    expect(screen.getByTestId('marker-count').textContent).toContain('200')
    expect(screen.queryByTestId('annotation-marker-201')).toBeNull()
  })
})

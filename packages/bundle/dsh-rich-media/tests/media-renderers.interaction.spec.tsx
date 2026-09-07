// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MediaImageRenderer, MediaPlaybackRenderer } from '../src/client/media-renderers.tsx'
import type { MediaRefV1 } from '../src/host/types.ts'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const image: MediaRefV1 = { owner: 'eikona', kind: 'image', ref: 'image:one', version: '1', mediaType: 'image/png', title: 'Frame', width: 1_000, height: 500, capabilities: ['preview'] }
const video: MediaRefV1 = { owner: 'eikona', kind: 'video', ref: 'video:one', version: '1', mediaType: 'video/mp4', title: 'Clip', capabilities: ['play'] }

describe('rich media interactions', () => {
  it('maps a drag against the rendered image rectangle and locks transforms while selecting', () => {
    const onSelectionChange = vi.fn()
    render(<MediaImageRenderer media={image} url="https://media.example/frame.png" selection={{ x: 0, y: 0, width: 1, height: 1 }} onSelectionChange={onSelectionChange} />)
    const stage = document.querySelector('[data-dsh-media-image-selection-stage]') as HTMLElement
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ x: 50, y: 25, left: 50, top: 25, right: 450, bottom: 225, width: 400, height: 200, toJSON: () => ({}) })
    fireEvent.pointerDown(stage, { clientX: 150, clientY: 75, pointerId: 1 })
    fireEvent.pointerUp(stage, { clientX: 350, clientY: 175, pointerId: 1 })
    expect(onSelectionChange).toHaveBeenCalledWith({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 })
    expect(stage.dataset.selectionTransformLocked).toBe('true')
    expect((screen.getByLabelText('Zoom in') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Rotate') as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[data-dsh-media-image-crop-preview] svg')?.getAttribute('viewBox')).toBe('0 0 1000 500')
  })

  it('allows an explicitly trusted blob source and wires frame, speed, chapter, and selected-range controls', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    render(<MediaPlaybackRenderer
      media={video}
      url="blob:https://owner.example/media-one"
      allowBlobUrl
      selection={{ startMs: 2_000, endMs: 4_000 }}
      chapters={[{ id: 'middle', label: 'Middle', startMs: 3_000, kind: 'chapters' }]}
    />)
    const element = screen.getByLabelText('Clip') as HTMLVideoElement
    Object.defineProperty(element, 'duration', { configurable: true, value: 10 })
    element.currentTime = 1
    fireEvent.click(screen.getByLabelText('Step forward'))
    expect(element.currentTime).toBeCloseTo(1 + 1 / 30)
    fireEvent.click(screen.getByLabelText('Step back'))
    expect(element.currentTime).toBeCloseTo(1)
    fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '1.5' } })
    expect(element.playbackRate).toBe(1.5)
    fireEvent.click(screen.getByRole('button', { name: 'Middle' }))
    expect(element.currentTime).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: 'Play selected range' }))
    expect(element.currentTime).toBe(2)
    expect(play).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-dsh-media-unsafe]')).toBeNull()
  })
})

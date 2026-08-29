// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  RichMediaCard,
  selectSafeTranscriptCues,
  type WaveformEnhancerHandleV1,
  type WaveformEnhancerModuleV1,
} from '../src/client/media-card.tsx'
import type { MediaRefV1 } from '../src/host/types.ts'

afterEach(cleanup)

const longAudio: MediaRefV1 = {
  owner: 'dsh',
  kind: 'audio',
  ref: 'audio-1',
  version: 'v1',
  mediaType: 'audio/mpeg',
  title: '第一幕录音',
  capabilities: ['preview', 'play'],
}

const PEAKS = [0.1, 0.5, 0.9, 0.4, 0.2]

describe('selectSafeTranscriptCues (V3 5.5 transcript navigation)', () => {
  it('keeps only labeled positively-timed owner cues, sorts by time, sanitizes ids', () => {
    expect(selectSafeTranscriptCues([
      { id: 'c2', label: '第二句', startMs: 9_000 },
      { id: 'c1', label: '第一句', startMs: 1_200 },
      { label: '   ', startMs: 3_000 },
      { label: '<img>', startMs: 4_000 },
      { label: 'negative', startMs: -1 },
      { label: 'no time' },
    ])).toEqual([
      { id: 'c1', label: '第一句', startMs: 1_200 },
      { id: 'c2', label: '第二句', startMs: 9_000 },
    ])
  })

  it('synthesizes stable ids when the owner omits them', () => {
    expect(selectSafeTranscriptCues([{ label: 'a', startMs: 0 }, { label: 'b', startMs: 1 }]).map(cue => cue.id))
      .toEqual(['cue-1', 'cue-2'])
  })
})

describe('long-audio honesty (V3 5.5 acceptance)', () => {
  it('renders the native player only when no owner peaks exist — no browser-side decode', () => {
    const { container } = render(<RichMediaCard media={longAudio} src="https://cdn.example/audio.mp3" />)
    expect(container.querySelector('audio[controls]')).not.toBeNull()
    expect(container.querySelector('[data-dsh-rich-media-waveform]')).toBeNull()
    expect(container.querySelector('[data-dsh-rich-media-waveform-enhanced]')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('falls back to dependency-free bars when the injected enhancer fails to load', async () => {
    const loader = vi.fn(() => Promise.reject(new Error('enhancer offline')))
    const { container } = render(
      <RichMediaCard media={longAudio} src="https://cdn.example/audio.mp3" waveformPeaks={PEAKS} loadWaveform={loader} />,
    )
    await waitFor(() => { expect(container.querySelector('[data-dsh-rich-media-waveform]')).not.toBeNull() })
    expect(container.querySelector('[data-dsh-rich-media-waveform-enhanced]')).toBeNull()
    expect(container.querySelector('audio[controls]')).not.toBeNull()
    expect(loader).toHaveBeenCalledOnce()
  })
})

describe('injected waveform enhancer lifecycle (V3 5.5 lazy boundary)', () => {
  function fakeModule(cues?: unknown): { module: WaveformEnhancerModuleV1; destroy: ReturnType<typeof vi.fn>; mount: ReturnType<typeof vi.fn> } {
    const destroy = vi.fn()
    const mount = vi.fn((): WaveformEnhancerHandleV1 => ({ destroy }))
    return { module: { create: mount }, destroy, mount }
  }

  it('mounts through the injected loader with owner peaks and cues, destroys on unmount', async () => {
    const { module, destroy, mount } = fakeModule()
    const loader = vi.fn(() => Promise.resolve(module))
    const { container, unmount } = render(
      <RichMediaCard
        media={longAudio}
        src="https://cdn.example/audio.mp3"
        waveformPeaks={PEAKS}
        loadWaveform={loader}
        transcriptCues={[{ id: 'c1', label: '第一句', startMs: 1_500 }]}
      />,
    )
    await waitFor(() => { expect(container.querySelector('[data-dsh-rich-media-waveform-enhanced="true"]')).not.toBeNull() })
    expect(loader).toHaveBeenCalledOnce()
    const mountArg = mount.mock.calls[0]![0]
    expect(mountArg.peaks).toEqual(PEAKS)
    expect(mountArg.cues).toEqual([{ id: 'c1', label: '第一句', startMs: 1_500 }])
    expect(mountArg.media).toBeInstanceOf(HTMLAudioElement)
    // native equivalent time controls stay reachable
    expect(container.querySelector('audio[controls]')).not.toBeNull()
    expect(container.querySelector('[data-dsh-rich-media-waveform]')).toBeNull()
    unmount()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('never mounts an enhancer for video or without peaks', () => {
    const { module, mount } = fakeModule()
    const loader = () => Promise.resolve(module)
    const { container } = render(
      <RichMediaCard
        media={{ ...longAudio, kind: 'video', mediaType: 'video/mp4' }}
        src="https://cdn.example/clip.mp4"
        waveformPeaks={PEAKS}
        loadWaveform={loader}
      />,
    )
    expect(container.querySelector('[data-dsh-rich-media-waveform-enhanced]')).toBeNull()
    expect(mount).not.toHaveBeenCalled()
    expect(container.querySelector('video[controls]')).not.toBeNull()
  })
})

describe('transcript cue navigation (V3 5.5/5.8)', () => {
  it('renders safe cue buttons that seek the native element', async () => {
    const { container } = render(
      <RichMediaCard
        media={longAudio}
        src="https://cdn.example/audio.mp3"
        transcriptCues={[
          { id: 'c1', label: '第一句', startMs: 1_500 },
          { label: 'skip me', startMs: -5 },
          { id: 'c2', label: '第二句', startMs: 9_000 },
        ]}
      />,
    )
    const nav = container.querySelector('[data-dsh-rich-media-transcript]')
    expect(nav).not.toBeNull()
    expect(screen.getAllByRole('button', { name: /句/ })).toHaveLength(2)
    const first = nav!.querySelector('[data-cue-id="c1"]') as HTMLButtonElement
    expect(first.getAttribute('data-cue-start')).toBe('1.5')
    const audio = container.querySelector('audio') as HTMLAudioElement
    audio.currentTime = 0
    fireEvent.click(first)
    expect(audio.currentTime).toBe(1.5)
  })
})

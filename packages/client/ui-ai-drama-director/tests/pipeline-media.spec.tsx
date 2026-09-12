// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  createMediaAccessResolver,
  pipelineMediaResolutionState,
  validatePipelineMediaEntry,
  type PipelineMediaEntry,
  type PipelineMediaResolution,
} from '../src/client/pipeline/media.js'
import { PipelineMediaPreview } from '../src/client/pipeline/media-preview.js'
import {
  createPipelineAssetNodeIntent,
  handlePipelineMediaDrop,
  PIPELINE_MEDIA_DRAG_MIME,
  PIPELINE_MEDIA_DRAG_SCHEMA,
  readPipelineMediaDragPayload,
  writePipelineMediaDragPayload,
} from '../src/client/pipeline/media-drag.js'

afterEach(cleanup)

const entry = (overrides: Partial<PipelineMediaEntry> = {}): PipelineMediaEntry => ({
  ref: 'asset:rain-keyframe',
  kind: 'image',
  title: 'Rain keyframe',
  version: 'v3',
  freshness: 'fresh',
  capabilities: ['preview', 'drag'],
  ...overrides,
})

const futureAccess = (url = 'https://media.example/signed/rain') => ({
  url,
  expiresAt: '2999-01-01T00:00:00Z',
})

function stubDataTransfer(initial?: Record<string, string>) {
  const store = new Map(Object.entries(initial ?? {}))
  return {
    get types() {
      return [...store.keys()]
    },
    setData(type: string, data: string) {
      store.set(type, data)
    },
    getData(type: string) {
      return store.get(type) ?? ''
    },
  }
}

describe('validatePipelineMediaEntry', () => {
  it('accepts a bounded safe entry', () => {
    const result = validatePipelineMediaEntry(entry())
    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(result.value.ref).toBe('asset:rain-keyframe')
  })

  it.each([
    ['/home/user/frames/rain.png'],
    ['C:\\renders\\rain.png'],
    ['\\\\nas\\share\\rain.png'],
    ['https://cdn.example/signed?token=abc'],
    ['data:image/png;base64,AAAA'],
    ['../outside/rain.png'],
    ['nested/rain.png'],
    ['rain frame.png'],
  ])('rejects path/URL-shaped ref %s', ref => {
    const result = validatePipelineMediaEntry(entry({ ref }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('media.private_path')
  })

  it('rejects credential-shaped and unknown fields fail-closed', () => {
    const sensitive = validatePipelineMediaEntry({ ...entry(), token: 'abc' })
    expect(sensitive).toMatchObject({ ok: false, code: 'media.sensitive_field' })
    const providerPayload = validatePipelineMediaEntry({ ...entry(), provider_payload: {} })
    expect(providerPayload).toMatchObject({ ok: false, code: 'media.sensitive_field' })
    const unknown = validatePipelineMediaEntry({ ...entry(), note: 'hello' })
    expect(unknown).toMatchObject({ ok: false, code: 'media.invalid_shape' })
  })

  it('rejects out-of-whitelist kind/capability and unbounded title', () => {
    expect(validatePipelineMediaEntry(entry({ kind: 'audio' as never }))).toMatchObject({ ok: false, code: 'media.unknown_enum' })
    expect(validatePipelineMediaEntry(entry({ capabilities: ['preview', 'execute' as never] }))).toMatchObject({ ok: false, code: 'media.unknown_enum' })
    expect(validatePipelineMediaEntry(entry({ title: 'x'.repeat(161) }))).toMatchObject({ ok: false, code: 'media.out_of_bounds' })
  })
})

describe('createMediaAccessResolver', () => {
  it('resolves owner-issued short-lived access with parsed expiry', async () => {
    const resolver = createMediaAccessResolver({ resolve: async () => futureAccess() })
    const resolution = await resolver.resolve(entry())
    expect(resolution.status).toBe('ready')
    if (resolution.status === 'ready') expect(resolution.expiresAtMs).toBe(Date.parse('2999-01-01T00:00:00Z'))
  })

  it('fails closed on unsafe URLs, missing expiry and expired access', async () => {
    const unsafe = createMediaAccessResolver({ resolve: async () => ({ url: 'file:///etc/passwd', expiresAt: '2999-01-01T00:00:00Z' }) })
    expect(await unsafe.resolve(entry())).toMatchObject({ status: 'unavailable' })
    const noExpiry = createMediaAccessResolver({ resolve: async () => ({ url: 'https://media.example/x', expiresAt: 'not-a-date' }) })
    expect(await noExpiry.resolve(entry())).toMatchObject({ status: 'unavailable' })
    const expired = createMediaAccessResolver({ resolve: async () => ({ url: 'https://media.example/x', expiresAt: '2000-01-01T00:00:00Z' }) })
    const expiredResolution = await expired.resolve(entry())
    expect(expiredResolution).toMatchObject({ status: 'unavailable' })
    if (expiredResolution.status === 'unavailable') expect(expiredResolution.reason).toContain('expired')
  })

  it('returns unavailable with a bounded reason when the owner declines or the entry is invalid', async () => {
    const declined = createMediaAccessResolver({ resolve: async () => undefined })
    expect(await declined.resolve(entry())).toMatchObject({ status: 'unavailable' })
    const resolver = createMediaAccessResolver({ resolve: async () => futureAccess() })
    const invalid = await resolver.resolve(entry({ ref: '/abs/path.png' }))
    expect(invalid.status).toBe('unavailable')
    if (invalid.status === 'unavailable') expect(invalid.reason).toContain('media.private_path')
  })

  it('marks expired resolutions as needing re-resolve', () => {
    const ready: PipelineMediaResolution = { status: 'ready', url: 'https://media.example/x', expiresAt: '2026-09-11T01:00:00Z', expiresAtMs: Date.parse('2026-09-11T01:00:00Z') }
    expect(pipelineMediaResolutionState(ready, Date.parse('2026-09-11T00:59:00Z'))).toBe('ready')
    expect(pipelineMediaResolutionState(ready, Date.parse('2026-09-11T01:00:01Z'))).toBe('needs_reresolve')
    expect(pipelineMediaResolutionState({ status: 'unavailable', reason: 'no' }, 0)).toBe('unavailable')
  })

  it('release revokes blob URLs exactly once and ignores http/unavailable', () => {
    const revokeObjectUrl = vi.fn()
    const resolver = createMediaAccessResolver({ resolve: async () => futureAccess(), revokeObjectUrl })
    const blobResolution: PipelineMediaResolution = { status: 'ready', url: 'blob:https://app/1', expiresAt: '2999-01-01T00:00:00Z', expiresAtMs: 1 }
    resolver.release(blobResolution)
    resolver.release(blobResolution)
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:https://app/1')
    resolver.release({ status: 'ready', url: 'https://media.example/x', expiresAt: '2999-01-01T00:00:00Z', expiresAtMs: 1 })
    resolver.release({ status: 'unavailable', reason: 'no' })
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1)
  })
})

describe('PipelineMediaPreview', () => {
  it('renders loading then an image once the owner grants access', async () => {
    const resolver = createMediaAccessResolver({ resolve: async () => futureAccess() })
    render(<PipelineMediaPreview entry={entry()} resolver={resolver} />)
    expect(screen.getByRole('status').textContent).toContain('正在加载媒体预览')
    const image = await screen.findByRole('img', { name: 'Rain keyframe' })
    expect(image.getAttribute('src')).toBe('https://media.example/signed/rain')
  })

  it('renders a paused-by-default video preview with metadata preload', async () => {
    const resolver = createMediaAccessResolver({ resolve: async () => futureAccess() })
    const { container } = render(<PipelineMediaPreview entry={entry({ kind: 'video', capabilities: ['preview', 'playback'] })} resolver={resolver} />)
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull())
    const video = container.querySelector('video')!
    expect(video.hasAttribute('autoplay')).toBe(false)
    expect(video.getAttribute('preload')).toBe('metadata')
    expect(video.getAttribute('aria-label')).toBe('Rain keyframe')
  })

  it('renders unavailable with the owner reason as text', async () => {
    const resolver = createMediaAccessResolver({ resolve: async () => undefined })
    render(<PipelineMediaPreview entry={entry()} resolver={resolver} />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('owner did not grant media access'))
  })

  it('fail-closes a throwing resolve into unavailable with a redacted reason', async () => {
    const resolver = createMediaAccessResolver({
      resolve: async () => {
        throw new Error('secret backend trace with token=abc')
      },
    })
    render(<PipelineMediaPreview entry={entry()} resolver={resolver} />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('media access resolve failed'))
    expect(screen.getByRole('status').textContent).not.toContain('token=abc')
  })

  it('releases the access on unmount and when the entry changes', async () => {
    const releases: PipelineMediaResolution[] = []
    const base = createMediaAccessResolver({ resolve: async () => futureAccess() })
    const resolver = {
      resolve: base.resolve,
      release: (resolution: PipelineMediaResolution) => {
        releases.push(resolution)
        base.release(resolution)
      },
    }
    const view = render(<PipelineMediaPreview entry={entry()} resolver={resolver} />)
    await screen.findByRole('img')
    view.rerender(<PipelineMediaPreview entry={entry({ ref: 'asset:other', version: 'v1' })} resolver={resolver} />)
    await screen.findByRole('img')
    expect(releases).toHaveLength(1)
    view.unmount()
    expect(releases).toHaveLength(2)
  })

  it('releases the access and shows an alert when the media element errors', async () => {
    const releases: PipelineMediaResolution[] = []
    const base = createMediaAccessResolver({ resolve: async () => futureAccess() })
    const resolver = { resolve: base.resolve, release: (resolution: PipelineMediaResolution) => releases.push(resolution) }
    render(<PipelineMediaPreview entry={entry()} resolver={resolver} />)
    const image = await screen.findByRole('img')
    fireEvent.error(image)
    await screen.findByRole('alert')
    expect(releases).toHaveLength(1)
  })

  it('loads only while visible when IntersectionObserver is available', async () => {
    let notify: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined
    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        notify = entries => callback(entries as never, this as never)
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    const original = globalThis.IntersectionObserver
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    try {
      const resolve = vi.fn(async () => futureAccess())
      const resolver = createMediaAccessResolver({ resolve })
      render(<PipelineMediaPreview entry={entry()} resolver={resolver} />)
      expect(resolve).not.toHaveBeenCalled()
      notify?.([{ isIntersecting: true }])
      await screen.findByRole('img')
      expect(resolve).toHaveBeenCalledTimes(1)
    } finally {
      vi.stubGlobal('IntersectionObserver', original)
    }
  })
})

describe('pipeline media drag handoff', () => {
  it('round-trips a payload carrying only opaque ref, kind and version', () => {
    const transfer = stubDataTransfer()
    expect(writePipelineMediaDragPayload(transfer, entry())).toBe(true)
    expect(transfer.getData(PIPELINE_MEDIA_DRAG_MIME)).not.toContain('https://')
    const parsed = readPipelineMediaDragPayload(transfer)
    expect(parsed).toMatchObject({ ok: true })
    if (parsed.ok) {
      expect(parsed.value).toEqual({ schema: PIPELINE_MEDIA_DRAG_SCHEMA, ref: 'asset:rain-keyframe', kind: 'image', version: 'v3' })
      expect(createPipelineAssetNodeIntent(parsed.value)).toEqual({
        intent: 'pipeline.create-asset-node',
        ref: 'asset:rain-keyframe',
        mediaKind: 'image',
        version: 'v3',
      })
    }
  })

  it('rejects invalid payloads with a bounded reason', () => {
    expect(readPipelineMediaDragPayload(stubDataTransfer())).toMatchObject({ ok: false, code: 'media.invalid_shape' })
    expect(readPipelineMediaDragPayload(stubDataTransfer({ [PIPELINE_MEDIA_DRAG_MIME]: '{broken' }))).toMatchObject({ ok: false, code: 'media.invalid_shape' })
    expect(readPipelineMediaDragPayload(stubDataTransfer({ [PIPELINE_MEDIA_DRAG_MIME]: JSON.stringify({ schema: 'other', ref: 'a', kind: 'image', version: 'v1' }) }))).toMatchObject({ ok: false })
    expect(readPipelineMediaDragPayload(stubDataTransfer({
      [PIPELINE_MEDIA_DRAG_MIME]: JSON.stringify({ schema: PIPELINE_MEDIA_DRAG_SCHEMA, ref: '/home/user/x.png', kind: 'image', version: 'v1' }),
    }))).toMatchObject({ ok: false, code: 'media.private_path' })
    expect(readPipelineMediaDragPayload(stubDataTransfer({
      [PIPELINE_MEDIA_DRAG_MIME]: JSON.stringify({ schema: PIPELINE_MEDIA_DRAG_SCHEMA, ref: 'a', kind: 'audio', version: 'v1' }),
    }))).toMatchObject({ ok: false, code: 'media.unknown_enum' })
  })

  it('drop produces a create-asset-node intent with position; invalid drops surface a visible reason', () => {
    const transfer = stubDataTransfer()
    writePipelineMediaDragPayload(transfer, entry({ kind: 'video' }))
    const onIntent = vi.fn()
    const onReject = vi.fn()
    const preventDefault = vi.fn()
    const handled = handlePipelineMediaDrop(
      { dataTransfer: transfer, clientX: 120, clientY: 48, preventDefault },
      { onIntent, onReject },
    )
    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalled()
    expect(onIntent).toHaveBeenCalledWith(
      { intent: 'pipeline.create-asset-node', ref: 'asset:rain-keyframe', mediaKind: 'video', version: 'v3' },
      { x: 120, y: 48 },
    )
    expect(onReject).not.toHaveBeenCalled()

    const bad = handlePipelineMediaDrop(
      { dataTransfer: stubDataTransfer({ [PIPELINE_MEDIA_DRAG_MIME]: 'not json' }), preventDefault },
      { onIntent, onReject },
    )
    expect(bad).toBe(true)
    expect(onReject).toHaveBeenCalledWith(expect.stringContaining('media.invalid_shape'))
    expect(onIntent).toHaveBeenCalledTimes(1)

    const foreign = handlePipelineMediaDrop(
      { dataTransfer: stubDataTransfer({ 'text/plain': 'hello' }), preventDefault },
      { onIntent, onReject },
    )
    expect(foreign).toBe(false)
  })
})

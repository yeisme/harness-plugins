import { describe, expect, it } from 'vitest'
import {
  parsePreviewResource,
  previewCacheKey,
  previewResourceKey,
  FORBIDDEN_RESOURCE_KEYS,
} from '../src/client/preview/types.ts'
import type { PreviewResourceV1 } from '../src/client/preview/types.ts'
import {
  BYTE_RANGE_MAX,
  LocalResourcePreviewHost,
  OFFICIAL_DSH_PREVIEW_SEAM_PROBE,
  PreviewAccessError,
  TABLE_PAGE_MAX,
  TEXT_WINDOW_MAX,
  createPreviewAccessHandle,
  isOfficialDshPreviewSeamEnabled,
  officialDshInspect,
  officialDshOpenRendition,
  paneStateContainsAccessSecrets,
  probeOfficialDshPreviewSeam,
  serializePreviewAccessForPane,
} from '../src/client/preview/access.ts'
import { PreviewRenditionCache, previewCachePersistenceProjection, previewStorageTargets } from '../src/client/preview/cache.ts'
import { PreviewSessionController } from '../src/client/preview/session.ts'
import { PreviewRendererRegistry } from '../src/client/preview/registry.ts'
import {
  authorizePreviewIntent,
  parsePreviewIntent,
  previewIntentAllowsActiveExecution,
} from '../src/client/preview/intents.ts'
import type { PreviewRendererDescriptorV1 } from '../src/client/preview/types.ts'

function resource(overrides: Partial<PreviewResourceV1> & { ref?: PreviewResourceV1['ref'] } = {}): PreviewResourceV1 {
  const parsed = parsePreviewResource({
    sourceKind: 'media',
    ref: overrides.ref ?? { owner: 'dsh', ref: 'img-1', version: 'v1' },
    title: overrides.title ?? 'Example',
    mediaType: overrides.mediaType ?? 'image/png',
    family: overrides.family ?? 'image',
    capabilities: overrides.capabilities ?? ['preview', 'open', 'download', 'attach'],
    ...overrides.size === undefined ? {} : { size: overrides.size },
  })
  if (!parsed.ok) throw new Error(parsed.error)
  return { ...parsed.value, ...overrides, ref: overrides.ref ?? parsed.value.ref, key: previewResourceKey(overrides.ref ?? parsed.value.ref) }
}

function textResource(ref = 'notes-1', version = 'v1'): PreviewResourceV1 {
  return resource({
    ref: { owner: 'dsh', ref, version },
    title: 'Notes',
    mediaType: 'text/plain',
    family: 'text',
    capabilities: ['preview', 'open'],
  })
}

describe('official DSH preview seam probe', () => {
  it('stays disabled and fail-closed from a real probe', async () => {
    const probe = probeOfficialDshPreviewSeam({})
    expect(probe).toEqual(OFFICIAL_DSH_PREVIEW_SEAM_PROBE)
    expect(isOfficialDshPreviewSeamEnabled(probe)).toBe(false)
    await expect(officialDshInspect({ owner: 'dsh', ref: 'x', version: 'v1' })).rejects.toMatchObject({ code: 'official_seam_disabled' })
    await expect(officialDshOpenRendition({ resource: resource() })).rejects.toMatchObject({ code: 'official_seam_disabled' })
  })
})

describe('PreviewAccessHandle', () => {
  it('grants abortable windows/ranges/playback and strips secrets from snapshots', async () => {
    const body = 'abcdefghijklmnopqrstuvwxyz'
    const rows = Array.from({ length: 5 }, (_, i) => [`r${i}`, `c${i}`])
    const bytes = Uint8Array.from({ length: 32 }, (_, i) => i)
    const released: string[] = []
    const handle = createPreviewAccessHandle({
      resource: textResource(),
      rendition: 'text',
      url: 'https://owner.example/tmp?sig=1',
      objectUrl: 'blob:preview-object',
      stream: { cancel() { released.push('stream') } },
      worker: { terminate() { released.push('worker') } },
      text: body,
      table: rows,
      bytes,
      playback: { kind: 'object-url', expiresAt: '2099-01-01T00:00:00.000Z' },
      onRelease(reason) { released.push(reason) },
    })

    expect(handle.url).toBe('https://owner.example/tmp?sig=1')
    expect(JSON.stringify(handle)).not.toContain('https://')
    expect(JSON.stringify(handle)).not.toContain('blob:')
    const snapshot = serializePreviewAccessForPane(handle)
    expect(snapshot).toMatchObject({ owner: 'dsh', ref: 'notes-1', version: 'v1', rendition: 'text', released: false })
    expect(paneStateContainsAccessSecrets(snapshot)).toBe(false)

    const window = await handle.readTextWindow!({ offset: 2, length: 4 })
    expect(window).toEqual({ text: 'cdef', offset: 2, loaded: 4, total: 26, truncated: true })
    const page = await handle.readTablePage!({ page: 2, pageSize: 2 })
    expect(page.rows).toEqual([['r2', 'c2'], ['r3', 'c3']])
    expect(page.truncated).toBe(true)
    const range = await handle.readByteRange!({ offset: 4, length: 3 })
    expect([...range]).toEqual([4, 5, 6])
    const playback = await handle.resolvePlaybackSource!()
    expect(playback.kind).toBe('object-url')
    expect(JSON.stringify(playback)).not.toContain('blob:')

    await expect(handle.readTextWindow!({ offset: 0, length: TEXT_WINDOW_MAX + 1 })).resolves.toMatchObject({ loaded: 26 })
    await expect(handle.readTablePage!({ page: 0, pageSize: TABLE_PAGE_MAX })).rejects.toMatchObject({ code: 'bounds' })
    await expect(handle.readByteRange!({ offset: -1, length: BYTE_RANGE_MAX })).rejects.toMatchObject({ code: 'bounds' })

    handle.abort?.('abort')
    expect(handle.getSnapshot().released).toBe(true)
    await expect(handle.readTextWindow!({ offset: 0, length: 4 })).rejects.toBeInstanceOf(PreviewAccessError)
    handle.release('close')
    expect(released).toContain('abort')
    expect(released).toContain('stream')
    expect(released).toContain('worker')
  })
})

describe('LocalResourcePreviewHost', () => {
  it('resolves owner access, fences sessions, and releases every live handle', async () => {
    const versions = new Map<string, Set<(version: string) => void>>()
    const host = new LocalResourcePreviewHost({
      owner: 'dsh',
      sessionId: 's1',
      providerId: 'media',
      source: {
        inspect: async ref => resource({ ref }),
        open: async request => ({
          resource: request.resource,
          rendition: request.rendition,
          url: `https://owner.example/${request.resource.ref.ref}`,
          text: 'hello world from owner',
          bytes: Uint8Array.from([1, 2, 3, 4]),
        }),
        subscribeVersion(ref, listener) {
          const key = previewResourceKey(ref)
          const bucket = versions.get(key) ?? new Set()
          bucket.add(listener)
          versions.set(key, bucket)
          return () => { bucket.delete(listener) }
        },
      },
    })

    const first = resource({ ref: { owner: 'dsh', ref: 'a', version: 'v1' } })
    const handle = await host.resolveAccess(first)
    expect(handle).toBeDefined()
    expect(host.liveHandleCount()).toBe(1)
    await expect(host.resolveAccess(resource({ ref: { owner: 'eikona', ref: 'x', version: 'v1' } }))).rejects.toMatchObject({ code: 'mismatch' })

    const notified: string[] = []
    const unsub = host.subscribeVersion(first.ref, version => { notified.push(version) })
    versions.get('dsh:a')?.forEach(listener => listener('v2'))
    expect(notified).toEqual(['v2'])
    unsub()

    host.switchSession('s2')
    expect(handle!.getSnapshot().released).toBe(true)
    expect(host.liveHandleCount()).toBe(0)
    const again = await host.resolveAccess(first)
    expect(again).toBeDefined()
    host.disposeProvider('media')
    expect(again!.getSnapshot().released).toBe(true)
    await expect(host.resolveAccess(first)).rejects.toMatchObject({ code: 'fenced' })
  })
})

describe('PreviewSessionController visible state and cache', () => {
  it('walks resolving/loading/ready/partial/stale/unsupported/error/offline without abort flashing error', async () => {
    const cache = new PreviewRenditionCache({ maxEntries: 2, maxBytes: 64 })
    const host = new LocalResourcePreviewHost({
      owner: 'dsh',
      source: {
        open: async request => {
          if (request.resource.ref.ref === 'deny') return undefined
          if (request.resource.ref.ref === 'offline') throw new PreviewAccessError('offline', 'offline')
          if (request.resource.ref.ref === 'boom') throw new Error('owner failed')
          const long = 'x'.repeat(5000)
          return {
            resource: request.resource,
            rendition: request.rendition,
            url: `https://owner.example/${request.resource.ref.ref}`,
            text: request.resource.family === 'text' ? long : undefined,
            bytes: Uint8Array.from([1, 2, 3]),
          }
        },
        subscribeVersion(_ref, listener) {
          return () => { listener }
        },
      },
    })
    const session = new PreviewSessionController({ host, cache })
    expect(session.state).toBe('resolving')

    const notes = textResource('doc-1', 'v1')
    const opened = await session.open(notes)
    expect(opened.state).toBe('partial')
    expect(opened.truncated).toBe(true)
    expect(opened.cacheKey).toBe(previewCacheKey(notes.ref, 'original'))
    expect(paneStateContainsAccessSecrets(session.paneProjection())).toBe(false)
    expect(JSON.stringify(session.paneProjection())).not.toContain('https://')

    session.markStale('v2')
    expect(session.state).toBe('stale')
    const refreshed = await session.refresh()
    expect(refreshed.state).toBe('partial')

    const v2 = textResource('doc-1', 'v2')
    const compared = await session.compare(v2)
    expect(compared.compareVersion).toBe('v1')
    expect(compared.keepOld).toBe(true)
    expect(cache.has(previewCacheKey(notes.ref, 'original'))).toBe(true)
    expect(cache.has(previewCacheKey(v2.ref, 'original'))).toBe(true)

    const unsupported = await session.switchTo(resource({ ref: { owner: 'dsh', ref: 'deny', version: 'v1' } }))
    expect(unsupported.state).toBe('unsupported')

    const failed = await session.switchTo(resource({ ref: { owner: 'dsh', ref: 'boom', version: 'v1' } }))
    expect(failed.state).toBe('error')

    const offline = await session.switchTo(resource({ ref: { owner: 'dsh', ref: 'offline', version: 'v1' } }))
    expect(offline.state).toBe('offline')

    let releaseAccess: (() => void) | undefined
    const slowHost = new LocalResourcePreviewHost({
      owner: 'dsh',
      source: {
        open: () => new Promise(resolve => {
          releaseAccess = () => resolve({
            resource: notes,
            url: 'https://owner.example/slow',
            text: 'later',
          })
        }),
      },
    })
    const aborting = new PreviewSessionController({ host: slowHost, cache: new PreviewRenditionCache() })
    const pending = aborting.open(notes)
    expect(aborting.state).toBe('loading')
    const aborted = aborting.abort()
    expect(aborted.state).not.toBe('error')
    releaseAccess?.()
    expect((await pending).state).not.toBe('error')
  })

  it('releases symmetrically on switch, close, evict, and unload', async () => {
    const released: string[] = []
    const host = new LocalResourcePreviewHost({
      owner: 'dsh',
      source: {
        open: async request => ({
          resource: request.resource,
          url: `https://owner.example/${request.resource.ref.ref}`,
          onRelease(reason) { released.push(`${request.resource.ref.ref}:${reason}`) },
        }),
      },
    })
    const cache = new PreviewRenditionCache()
    const session = new PreviewSessionController({ host, cache })
    await session.open(resource({ ref: { owner: 'dsh', ref: 'one', version: 'v1' } }))
    expect(host.liveHandleCount()).toBe(1)
    await session.switchTo(resource({ ref: { owner: 'dsh', ref: 'two', version: 'v1' } }))
    expect(released).toContain('one:switch')
    expect(session.liveHandle()).toBeDefined()
    expect(host.liveHandleCount()).toBe(1)
    session.close()
    expect(released.some(item => item.startsWith('two:'))).toBe(true)
    expect(session.liveHandle()).toBeUndefined()
    await session.open(resource({ ref: { owner: 'dsh', ref: 'three', version: 'v1' } }))
    session.evict()
    expect(released.some(item => item.startsWith('three:'))).toBe(true)
    await session.open(resource({ ref: { owner: 'dsh', ref: 'four', version: 'v1' } }))
    session.unload()
    expect(released.some(item => item.startsWith('four:'))).toBe(true)
    expect(cache.size()).toEqual({ count: 0, bytes: 0 })
  })

  it('evicts by count and bytes and never writes content to web storage', async () => {
    const cache = new PreviewRenditionCache({ maxEntries: 2, maxBytes: 8 })
    const make = (ref: string, bytes: number) => createPreviewAccessHandle({
      resource: resource({ ref: { owner: 'dsh', ref, version: 'v1' } }),
      bytes: Uint8Array.from({ length: bytes }, () => 1),
    })
    const a = make('a', 3)
    const b = make('b', 3)
    const c = make('c', 3)
    cache.set(a)
    cache.set(b)
    expect(cache.size().count).toBe(2)
    cache.set(c)
    expect(cache.has(previewCacheKey({ owner: 'dsh', ref: 'a', version: 'v1' }, 'original'))).toBe(false)
    expect(a.getSnapshot().released).toBe(true)
    expect(cache.size().count).toBe(2)
    const heavy = createPreviewAccessHandle({
      resource: resource({ ref: { owner: 'dsh', ref: 'heavy', version: 'v9' } }),
      rendition: 'thumbnail',
      bytes: Uint8Array.from({ length: 9 }, () => 2),
    })
    cache.set(heavy)
    expect(cache.has(previewCacheKey({ owner: 'dsh', ref: 'heavy', version: 'v9' }, 'thumbnail'))).toBe(true)
    expect(b.getSnapshot().released).toBe(true)
    expect(previewCachePersistenceProjection(cache)).toEqual([])
    expect(previewStorageTargets()).toEqual([])
    expect(previewCacheKey({ owner: 'dsh', ref: 'heavy', version: 'v9' }, 'thumbnail')).toBe('dsh:heavy:v9:thumbnail')
  })
})

describe('typed preview intents', () => {
  it('authorizes open/attach/compare/download/open-external fail-closed without execution', () => {
    const image = resource({ ref: { owner: 'dsh', ref: 'img-1', version: 'v1' } })
    const other = resource({ ref: { owner: 'dsh', ref: 'img-2', version: 'v1' } })
    const html = resource({
      ref: { owner: 'dsh', ref: 'page-1', version: 'v1' },
      mediaType: 'text/html',
      family: 'text',
      capabilities: ['preview'],
    })
    const svg = resource({
      ref: { owner: 'dsh', ref: 'icon-1', version: 'v1' },
      mediaType: 'image/svg+xml',
      family: 'image',
      capabilities: ['preview'],
    })
    const pdf = resource({
      ref: { owner: 'dsh', ref: 'doc-pdf', version: 'v1' },
      mediaType: 'application/pdf',
      family: 'pdf',
      capabilities: ['preview'],
    })

    expect(parsePreviewIntent({ kind: 'open', resourceKeys: [image.key], url: 'https://evil' }).ok).toBe(false)
    expect(authorizePreviewIntent({ kind: 'compare', resourceKeys: [image.key, other.key] }, [image, other]).ok).toBe(true)
    expect(authorizePreviewIntent({ kind: 'download', resourceKeys: [image.key] }, [image]).ok).toBe(true)
    expect(authorizePreviewIntent({ kind: 'attach', resourceKeys: [image.key] }, [image]).ok).toBe(true)
    expect(authorizePreviewIntent({ kind: 'open-external', resourceKeys: [image.key] }, [image]).ok).toBe(true)
    expect(authorizePreviewIntent({ kind: 'open', resourceKeys: ['missing'] }, [image]).ok).toBe(false)
    expect(authorizePreviewIntent({ kind: 'open', resourceKeys: [html.key] }, [html]).ok).toBe(false)
    expect(authorizePreviewIntent({ kind: 'open', resourceKeys: [svg.key] }, [svg]).ok).toBe(false)
    expect(authorizePreviewIntent({ kind: 'open', resourceKeys: [pdf.key] }, [pdf]).ok).toBe(false)
    expect(previewIntentAllowsActiveExecution({ kind: 'open', resourceKeys: [image.key] })).toBe(false)
  })
})

describe('preview platform focused 3.6 coverage', () => {
  it('falls back after a lazy import failure and keeps a single live registration after HMR dispose', async () => {
    const registry = new PreviewRendererRegistry()
    const loader = async () => (props: unknown) => props
    const fail: PreviewRendererDescriptorV1 = {
      id: 'pkg:broken',
      families: ['image'],
      mediaTypes: ['image/png'],
      priority: 10,
      load: async () => { throw new Error('chunk missing') },
    }
    const ok: PreviewRendererDescriptorV1 = {
      id: 'pkg:image',
      families: ['image'],
      load: loader,
    }
    const disposeBroken = registry.register(fail)
    registry.register(ok)
    const loaded = await registry.loadBest({ mediaType: 'image/png', family: 'image' })
    expect(loaded?.id).toBe('pkg:image')
    disposeBroken()
    const hmr = registry.register({ ...fail, load: loader })
    expect(registry.size()).toBe(2)
    hmr()
    expect(registry.has('pkg:broken')).toBe(false)
    expect(registry.resolve({ mediaType: 'image/png', family: 'image' })?.id).toBe('pkg:image')
  })

  it('keeps one live renderer handle and rejects forbidden adapter fields', async () => {
    for (const key of FORBIDDEN_RESOURCE_KEYS) {
      expect(parsePreviewResource({
        sourceKind: 'media',
        ref: { owner: 'dsh', ref: 'x', version: 'v1' },
        title: 'x',
        mediaType: 'image/png',
        family: 'image',
        capabilities: [],
        [key]: 'nope',
      }).ok).toBe(false)
    }
    const host = new LocalResourcePreviewHost({
      owner: 'dsh',
      source: {
        open: async request => ({ resource: request.resource, url: `https://owner.example/${request.resource.ref.ref}` }),
      },
    })
    const session = new PreviewSessionController({ host })
    await session.open(resource({ ref: { owner: 'dsh', ref: 'live-a', version: 'v1' } }))
    await session.switchTo(resource({ ref: { owner: 'dsh', ref: 'live-b', version: 'v1' } }))
    expect(host.liveHandleCount()).toBe(1)
    expect(session.liveHandle()?.getSnapshot().ref).toBe('live-b')
  })
})

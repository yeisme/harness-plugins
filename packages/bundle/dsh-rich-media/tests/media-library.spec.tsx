import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MediaLibraryBody, libraryIntent, windowRange } from '../src/client/media-library.tsx'
import { registerMediaPaneViews } from '../src/client/pane-views.tsx'
import type { MediaRefV1 } from '../src/host/types.ts'

function media(ref: string, kind: MediaRefV1['kind']): MediaRefV1 {
  return { owner: 'dsh', kind, ref, version: 'v1', mediaType: `${kind}/*`, title: `Item ${ref}`, capabilities: ['preview'] }
}

describe('windowRange', () => {
  it('windows a fixed-row list with overscan and clamped bounds', () => {
    expect(windowRange(1000, 10, 100, 0)).toEqual({ start: 0, end: 18, totalHeight: 10000 })
    expect(windowRange(1000, 10, 100, 500)).toEqual({ start: 46, end: 64, totalHeight: 10000 })
    expect(windowRange(3, 10, 100, 0)).toEqual({ start: 0, end: 3, totalHeight: 30 })
  })
})

describe('libraryIntent', () => {
  const items = [media('a', 'image'), media('b', 'image'), media('c', 'audio')]
  it('compare requires exactly two selected known items', () => {
    expect(libraryIntent(['dsh:a'], items, 'compare')).toBeNull()
    expect(libraryIntent(['dsh:a', 'dsh:b'], items, 'compare')).toEqual({ kind: 'compare', resourceKeys: ['dsh:a', 'dsh:b'] })
    expect(libraryIntent(['dsh:a', 'dsh:missing'], items, 'compare')).toBeNull()
  })
  it('open/download/attach accept any non-empty known selection', () => {
    expect(libraryIntent(['dsh:c'], items, 'open')).toEqual({ kind: 'open', resourceKeys: ['dsh:c'] })
    expect(libraryIntent([], items, 'download')).toBeNull()
  })
})

describe('MediaLibraryBody', () => {
  it('renders a ready windowed grid with metadata and no URLs', () => {
    const items = Array.from({ length: 40 }, (_, i) => media(`i${i}`, 'image'))
    const html = renderToStaticMarkup(<MediaLibraryBody items={items} status="ready" viewportHeight={140} rowHeight={28} />)
    expect(html).toContain('data-dsh-media-library')
    expect(html).toContain('Item i0')
    expect(html).not.toContain('Item i39')
    expect(html).not.toContain('http')
    expect(html).toContain('aria-rowcount="40"')
  })
  it('renders empty, error-with-retry, and partial states', () => {
    expect(renderToStaticMarkup(<MediaLibraryBody items={[]} status="empty" />)).toContain('No media yet.')
    const failed = renderToStaticMarkup(<MediaLibraryBody items={[]} status="error" onRetry={() => {}} />)
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('Retry')
    expect(renderToStaticMarkup(<MediaLibraryBody items={[media('a', 'image')]} status="partial" />)).toContain('Some media failed')
  })
  it('filters by query and loaded-local keys without holding URLs', () => {
    const items = [media('keep', 'image'), media('drop', 'audio')]
    const html = renderToStaticMarkup(
      <MediaLibraryBody
        items={items}
        status="ready"
        query="keep"
        onQueryChange={() => {}}
        loadedLocalOnly
        loadedKeys={['dsh:keep']}
        onLoadedLocalOnlyChange={() => {}}
        page={1}
        total={2}
        onPageChange={() => {}}
      />,
    )
    expect(html).toContain('aria-label="Search"')
    expect(html).toContain('Loaded locally')
    expect(html).toContain('Item keep')
    expect(html).not.toContain('Item drop')
    expect(html).toContain('data-filtered-count="1"')
    expect(html).not.toContain('http')
  })
})

describe('registerMediaPaneViews', () => {
  it('registers singleton library and per-resource media views with disposers', () => {
    const registered: unknown[] = []
    const dispose = registerMediaPaneViews({
      registerView(input) {
        registered.push(input)
        return () => { registered.pop() }
      },
    })
    const first = registered[0] as { descriptor: { kind: string; singleton: boolean; role: string } }
    const second = registered[1] as { descriptor: { kind: string; singleton: boolean; retention: string } }
    expect(first.descriptor.kind).toBe('workspace.media-library')
    expect(first.descriptor.singleton).toBe(true)
    expect(first.descriptor.role).toBe('navigator')
    expect(second.descriptor.kind).toBe('workspace.media')
    expect(second.descriptor.singleton).toBe(false)
    expect(second.descriptor.retention).toBe('snapshot')
    dispose()
    expect(registered.length).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import {
  parsePreviewResource,
  previewCacheKey,
  previewResourceKey,
  FORBIDDEN_RESOURCE_KEYS,
} from '../src/client/preview/types.ts'
import { artifactRefToPreviewResource, attachmentRefToPreviewResource, fileEntryToPreviewResource, mediaFamilyOf, mediaRefToPreviewResource } from '../src/client/preview/adapters.ts'
import { PreviewRendererRegistry } from '../src/client/preview/registry.ts'
import type { MediaRefV1 } from '../src/host/types.ts'
import type { PreviewRendererDescriptorV1 } from '../src/client/preview/types.ts'
import type { PreviewTablePageV1 } from '../src/client/preview/types.ts'
import { previewTableRendererDescriptor } from '../src/client/preview/table-renderer.tsx'

const validResource = {
  sourceKind: 'media',
  ref: { owner: 'dsh', ref: 'img-1', version: 'v1' },
  title: 'Example',
  mediaType: 'image/png',
  family: 'image',
  capabilities: ['preview'],
}

describe('parsePreviewResource', () => {
  it('accepts a valid safe projection', () => {
    const result = parsePreviewResource(validResource)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.key).toBe('dsh:img-1')
  })

  it('rejects every forbidden field', () => {
    for (const key of FORBIDDEN_RESOURCE_KEYS) {
      const result = parsePreviewResource({ ...validResource, [key]: 'x' })
      expect(result.ok).toBe(false)
    }
  })

  it('rejects refs carrying paths or URLs', () => {
    const pathRef = parsePreviewResource({ ...validResource, ref: { owner: 'dsh', ref: 'a/b', version: 'v1' } })
    expect(pathRef.ok).toBe(false)
    const urlRef = parsePreviewResource({ ...validResource, ref: { owner: 'dsh', ref: 'https://x', version: 'v1' } })
    expect(urlRef.ok).toBe(false)
  })

  it('key helper matches parsed key', () => {
    expect(previewResourceKey({ owner: 'dsh', ref: 'img-1', version: 'v1' })).toBe('dsh:img-1')
  })

  it('cache key includes owner, ref, version, and rendition', () => {
    expect(previewCacheKey({ owner: 'dsh', ref: 'img-1', version: 'v3' }, 'thumbnail')).toBe('dsh:img-1:v3:thumbnail')
  })
})

const media: MediaRefV1 = {
  owner: 'sonora', kind: 'audio', ref: 'aud-1', version: 'v2', mediaType: 'audio/mpeg',
  title: 'Track', summary: 'safe', capabilities: ['play'],
}

describe('mediaRefToPreviewResource', () => {
  it('maps a MediaRefV1 into an opaque preview resource', () => {
    const resource = mediaRefToPreviewResource(media)
    expect(resource.key).toBe('sonora:aud-1')
    expect(resource.family).toBe('audio')
    expect(resource.sourceKind).toBe('media')
    expect(JSON.stringify(resource)).not.toContain('poster')
  })

  it('family resolution is deterministic', () => {
    expect(mediaFamilyOf('image', 'image/png')).toBe('image')
    expect(mediaFamilyOf('document', 'text/csv')).toBe('table')
    expect(mediaFamilyOf('file', 'application/octet-stream')).toBe('binary')
    expect(mediaFamilyOf('file', 'application/pdf')).toBe('pdf')
  })
})

describe('file/attachment/artifact adapters', () => {
  it('maps a FileEntry-like projection without constructing paths', () => {
    const resource = fileEntryToPreviewResource({
      id: 'doc-1',
      name: 'notes.md',
      kind: 'text',
      mediaType: 'text/markdown',
      size: 12,
      capabilities: ['preview', 'open'],
    })
    expect(resource.sourceKind).toBe('file')
    expect(resource.ref.ref).toBe('doc-1')
    expect(resource.family).toBe('text')
    expect(resource.ref.ref).not.toContain('/')
    expect(resource.ref.owner).not.toContain('/')
  })
  it('maps attachment and artifact projections with independent source kinds', () => {
    const attachment = attachmentRefToPreviewResource({
      owner: 'dsh', ref: 'att-1', version: 'v3', title: 'Clip', mediaType: 'video/mp4', capabilities: ['preview'],
    })
    const artifact = artifactRefToPreviewResource({
      owner: 'eikona', ref: 'art-9', version: 'v1', title: 'Still', mediaType: 'image/png', capabilities: ['preview'],
    })
    expect(attachment.sourceKind).toBe('attachment')
    expect(artifact.sourceKind).toBe('artifact')
    expect(artifact.key).toBe('eikona:art-9')
  })
})

const loader = async () => (props: unknown) => props
function descriptor(id: string, families: string[], mediaTypes?: string[], priority?: number): PreviewRendererDescriptorV1 {
  return { id, families: families as PreviewRendererDescriptorV1['families'], ...(mediaTypes === undefined ? {} : { mediaTypes }), ...(priority === undefined ? {} : { priority }), load: loader }
}

describe('PreviewRendererRegistry', () => {
  it('resolves preference, then exact MIME, then suffix, then family, then binary fallback', () => {
    const registry = new PreviewRendererRegistry()
    const disposeImage = registry.register(descriptor('pkg:image', ['image'], ['image/png']))
    registry.register(descriptor('pkg:image-any', ['image'], ['image/*']))
    registry.register(descriptor('pkg:generic-image', ['image']))
    registry.register(descriptor('pkg:binary', ['binary']))
    const resolved = registry.resolve({ mediaType: 'image/png', family: 'image' })
    expect(resolved?.id).toBe('pkg:image')
    const bySuffix = registry.resolve({ mediaType: 'image/webp', family: 'image' })
    expect(bySuffix?.id).toBe('pkg:image-any')
    const byPreference = registry.resolve({ mediaType: 'image/webp', family: 'image', preference: 'pkg:generic-image' })
    expect(byPreference?.id).toBe('pkg:generic-image')
    const unknown = registry.resolve({ mediaType: 'application/x-unknown', family: 'binary' })
    expect(unknown?.id).toBe('pkg:binary')
    disposeImage()
    expect(registry.resolve({ mediaType: 'image/png', family: 'image' })?.id).toBe('pkg:image-any')
  })

  it('ignores a preference that does not accept the resource', () => {
    const registry = new PreviewRendererRegistry()
    registry.register(descriptor('pkg:audio', ['audio']))
    registry.register(descriptor('pkg:binary', ['binary']))
    const resolved = registry.resolve({ mediaType: 'audio/mpeg', family: 'audio', preference: 'pkg:audio' })
    expect(resolved?.id).toBe('pkg:audio')
    const ignored = registry.resolve({ mediaType: 'application/x-unknown', family: 'binary', preference: 'missing:id' })
    expect(ignored?.id).toBe('pkg:binary')
  })

  it('rejects malformed descriptors and supports openWith ordering', () => {
    const registry = new PreviewRendererRegistry()
    expect(() => registry.register({ id: 'nope', families: ['image'], load: loader })).toThrow()
    registry.register(descriptor('pkg:b-low', ['image'], undefined, 1))
    registry.register(descriptor('pkg:a-high', ['image'], undefined, 5))
    const list = registry.openWith({ mediaType: 'image/png', family: 'image' })
    expect(list.map(d => d.id)).toEqual(['pkg:a-high', 'pkg:b-low'])
  })
})

describe('PreviewTablePageV1 additive schema', () => {
  it('accepts owner columns and stable row keys without changing the page contract', () => {
    const page: PreviewTablePageV1 = {
      columns: [{ id: 'name', label: 'Name', type: 'text' }],
      rows: [['alpha']], rowKeys: ['row-a'], page: 0, pageSize: 200, loaded: 1, total: 1, truncated: false,
    }
    expect(page.columns?.[0]?.id).toBe('name')
    expect(page.rowKeys).toEqual(['row-a'])
  })

  it('registers the table renderer for CSV and TSV without a static registry singleton', () => {
    const registry = new PreviewRendererRegistry()
    registry.register(previewTableRendererDescriptor)
    expect(registry.resolve({ mediaType: 'text/csv', family: 'table' })?.id).toBe('yeisme:table')
    expect(registry.resolve({ mediaType: 'text/tab-separated-values', family: 'table' })?.id).toBe('yeisme:table')
  })
})

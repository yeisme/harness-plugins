import { describe, expect, it } from 'vitest'
import { createStaticHostProjection } from '../src/host-projection.ts'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { MediaRefV1 } from '@yeisme/dsh-rich-media'

const media: MediaRefV1 = {
  owner: 'dsh',
  kind: 'image',
  ref: 'img-1',
  version: 'v1',
  mediaType: 'image/png',
  title: 'Sample image',
  capabilities: ['preview'],
}

const file: FileEntryV1 = {
  id: 'file-1',
  name: 'notes.txt',
  kind: 'text',
  mediaType: 'text/plain',
  size: 12,
  capabilities: ['preview', 'open'],
}

describe('createStaticHostProjection', () => {
  it('returns the provided media and file entries', () => {
    const projection = createStaticHostProjection({ media: [media], fileEntries: [file] })
    expect(projection.listMedia()).toEqual([media])
    expect(projection.listFileEntries()).toEqual([file])
  })

  it('returns empty arrays when no data is provided', () => {
    const projection = createStaticHostProjection({})
    expect(projection.listMedia()).toEqual([])
    expect(projection.listFileEntries()).toEqual([])
  })
})

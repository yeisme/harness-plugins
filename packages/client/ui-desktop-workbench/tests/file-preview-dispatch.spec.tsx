// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { FileBinaryReadV1, FileHostV1 } from '@yeisme/dsh-file-host'
import { FilePreviewDispatchPane, previewResourceOfEntry } from '../src/client/file-preview-dispatch.tsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const enc = new TextEncoder()
const u16 = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff]
const u32 = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff]

function centralRecord(name: string, uncompressedSize: number): number[] {
  const nameBytes = [...enc.encode(name)]
  return [
    0x50, 0x4b, 0x01, 0x02,
    ...u16(20), ...u16(20), ...u16(0), ...u16(0),
    ...u16(0), ...u16(0), ...u32(0),
    ...u32(uncompressedSize), ...u32(uncompressedSize),
    ...u16(nameBytes.length), ...u16(0), ...u16(0),
    ...u16(0), ...u16(0), ...u32(0), ...u32(0),
    ...nameBytes,
  ]
}

function eocd(count: number, size: number, offset: number): number[] {
  return [0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(count), ...u16(count), ...u32(size), ...u32(offset), ...u16(0)]
}

function zipBytes(junkLength = 100): Uint8Array {
  const junk = Array.from({ length: junkLength }, (_, index) => index % 251)
  const central = [centralRecord('docs/readme.md', 1234)].flat()
  return new Uint8Array([...junk, ...central, ...eocd(1, central.length, junkLength)])
}

function hostOf(read: () => Promise<FileBinaryReadV1 | undefined>): FileHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'file-host',
    listEntries: async () => [],
    readBinary: vi.fn(read),
  }
}

function entryOf(name: string, kind: FileEntryV1['kind'] = 'file'): FileEntryV1 {
  return { id: `ref-${name}`, name, kind, capabilities: ['preview', 'open'] }
}

describe('previewResourceOfEntry', () => {
  it('fills media type and size from the owner read', () => {
    const resource = previewResourceOfEntry(entryOf('bundle.zip', 'archive'), 4096, 'rev-7')
    expect(resource.mediaType).toBe('application/zip')
    expect(resource.family).toBe('binary')
    expect(resource.size).toBe(4096)
    expect(resource.ref).toEqual({ owner: 'dsh', ref: 'ref-bundle.zip', version: 'rev-7' })
  })

  it('keeps the owner media type ahead of the extension hint and routes csv to table', () => {
    const resource = previewResourceOfEntry({ ...entryOf('export'), mediaType: 'text/csv' }, 12, undefined)
    expect(resource.mediaType).toBe('text/csv')
    expect(resource.family).toBe('table')
  })

  it('classifies generic file kinds through the extension table', () => {
    const resource = previewResourceOfEntry(entryOf('capture.mkv'), 2048, undefined)
    expect(resource.family).toBe('video')
  })
})

describe('FilePreviewDispatchPane', () => {
  it('renders a zip through the archive renderer with an object URL', async () => {
    const bytes = zipBytes()
    const createObjectURL = vi.fn(() => 'blob:preview-1')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    render(<FilePreviewDispatchPane host={hostOf(async () => ({ bytes, size: bytes.byteLength, truncated: false, mediaType: 'application/zip', version: 'v2' }))} entry={entryOf('bundle.zip', 'archive')} />)
    expect(await screen.findByText('docs/readme.md')).toBeDefined()
    expect(screen.getByText(/binary · application\/zip/)).toBeDefined()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('degrades honestly when the owner denies the read', async () => {
    render(<FilePreviewDispatchPane host={hostOf(async () => undefined)} entry={entryOf('voice.mp3')} />)
    expect(await screen.findByText('文件 owner 未授权该资源预览。')).toBeDefined()
  })

  it('degrades honestly when the binary read capability is absent', async () => {
    const host: FileHostV1 = { version: '0.1.0-rc.1', capability: 'file-host', listEntries: async () => [] }
    render(<FilePreviewDispatchPane host={host} entry={entryOf('clip.mp4')} />)
    expect(await screen.findByText('文件服务尚未提供二进制预览能力。')).toBeDefined()
  })

  it('reports oversized files with the size fact instead of loading them', async () => {
    render(<FilePreviewDispatchPane host={hostOf(async () => ({ bytes: new Uint8Array(), size: 30 * 1024 * 1024, truncated: true }))} entry={entryOf('movie.mkv')} />)
    expect(await screen.findByText(/30\.0 MB，超过预览安全上限/)).toBeDefined()
  })

  it('falls back to the bounded hex view when no dedicated renderer accepts the family', async () => {
    const bytes = enc.encode('x')
    render(<FilePreviewDispatchPane
      host={hostOf(async () => ({ bytes, size: bytes.byteLength, truncated: false, mediaType: 'image/png' }))}
      entry={entryOf('photo.png', 'image')}
    />)
    expect(await screen.findByText(/0x00000000/)).toBeDefined()
  })

  it('releases the object URL on unmount', async () => {
    const bytes = zipBytes()
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:preview-2', configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    const { unmount } = render(<FilePreviewDispatchPane host={hostOf(async () => ({ bytes, size: bytes.byteLength, truncated: false, mediaType: 'application/zip' }))} entry={entryOf('bundle.zip', 'archive')} />)
    await screen.findByText('docs/readme.md')
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-2')
  })
})

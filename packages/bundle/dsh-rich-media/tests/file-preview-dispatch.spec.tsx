// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import {
  CENTRAL_DIRECTORY_SCAN_MAX,
  locateZipEocd,
  parseZipCentralDirectory,
  parseZipEntryList,
} from '../src/client/preview/archive-listing.ts'
import { classifyFileEntry } from '../src/client/preview/format-kinds.ts'
import { createPreviewAccessHandle } from '../src/client/preview/access.ts'
import { MediaArchiveRenderer } from '../src/client/preview/archive-view.tsx'
import { MediaBinaryHexRenderer } from '../src/client/preview/binary-hex.tsx'
import type { PreviewResourceV1 } from '../src/client/preview/types.ts'

afterEach(() => cleanup())

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

function zipOf(records: number[][], junkLength = 70_000): Uint8Array {
  // Payload junk larger than the EOCD scan window proves ranged reads skip it.
  const junk = Array.from({ length: junkLength }, (_, index) => index % 251)
  const central = records.flat()
  return new Uint8Array([...junk, ...central, ...eocd(records.length, central.length, junkLength)])
}

function resourceOf(overrides: Partial<PreviewResourceV1> = {}): PreviewResourceV1 {
  return {
    key: 'dsh:bundle.zip',
    sourceKind: 'file',
    ref: { owner: 'dsh', ref: 'bundle.zip', version: 'v1' },
    title: 'bundle.zip',
    mediaType: 'application/zip',
    family: 'binary',
    capabilities: ['preview', 'open'],
    ...overrides,
  }
}

describe('format matrix additions (file-preview-dispatch)', () => {
  it('classifies audio and video extensions into media families', () => {
    expect(classifyFileEntry('mix.flac', undefined)).toEqual({ kind: 'audio', mediaType: 'audio/flac' })
    expect(classifyFileEntry('ring.opus', undefined)).toEqual({ kind: 'audio', mediaType: 'audio/opus' })
    expect(classifyFileEntry('capture.mkv', undefined)).toEqual({ kind: 'video', mediaType: 'video/x-matroska' })
    expect(classifyFileEntry('old.avi', undefined)).toEqual({ kind: 'video', mediaType: 'video/x-msvideo' })
  })

  it('classifies archive extensions with zip carrying the standard MIME', () => {
    expect(classifyFileEntry('bundle.zip', undefined)).toEqual({ kind: 'document', mediaType: 'application/zip' })
    expect(classifyFileEntry('app.jar', undefined)).toEqual({ kind: 'document', mediaType: 'application/java-archive' })
    expect(classifyFileEntry('backup.tar', undefined)).toEqual({ kind: 'document', mediaType: 'application/x-tar' })
    expect(classifyFileEntry('pack.7z', undefined)).toEqual({ kind: 'document', mediaType: 'application/x-7z-compressed' })
  })

  it('keeps text-family extensions on the desktop.file path', () => {
    expect(classifyFileEntry('dump.json', undefined)?.kind).toBe('text')
    expect(classifyFileEntry('notes.md', undefined)?.kind).toBe('text')
    expect(classifyFileEntry('main.ts', undefined)?.kind).toBe('text')
  })
})

describe('ranged zip parsing helpers', () => {
  it('locates the EOCD from a tail slice and parses the central directory chunk', () => {
    const bytes = zipOf([centralRecord('docs/', 0), centralRecord('docs/readme.md', 1234)])
    const tail = bytes.subarray(bytes.byteLength - 128)
    const located = locateZipEocd(tail)
    expect(located).toBeDefined()
    const chunk = bytes.subarray(located!.centralOffset, located!.centralOffset + located!.centralSize)
    const list = parseZipCentralDirectory(chunk, located!.declaredEntries)
    expect(list.entries.map(entry => entry.name)).toEqual(['docs/', 'docs/readme.md'])
    expect(list.totalEntries).toBe(2)
    expect(list.malformed).toBe(false)
    // Equivalent to the whole-buffer parser on the same archive.
    expect(list.entries).toEqual(parseZipEntryList(bytes)!.entries)
  })

  it('caps the central directory budget', () => {
    expect(CENTRAL_DIRECTORY_SCAN_MAX).toBe(4 * 1024 * 1024)
  })
})

describe('MediaBinaryHexRenderer', () => {
  it('renders bounded hex/ASCII rows with loaded/total facts', async () => {
    const bytes = enc.encode('DSH!')
    const handle = createPreviewAccessHandle({ resource: resourceOf({ mediaType: 'application/octet-stream', title: 'blob' }), bytes, objectUrl: undefined })
    render(<MediaBinaryHexRenderer resource={resourceOf({ mediaType: 'application/octet-stream', size: 4096 })} access={handle} />)
    expect(await screen.findByText(/0x00000000/)).toBeDefined()
    expect(screen.getByText(/已加载 4 \/ 4096 字节/)).toBeDefined()
    expect(screen.getByText(/仅显示前 4 字节/)).toBeDefined()
    handle.release('close')
  })

  it('degrades honestly when byte reads are unauthorized', async () => {
    const handle = createPreviewAccessHandle({ resource: resourceOf(), url: 'https://owner.example/short-lived' })
    render(<MediaBinaryHexRenderer resource={resourceOf()} access={handle} />)
    expect(await screen.findByRole('alert')).toBeDefined()
    handle.release('close')
  })
})

describe('MediaArchiveRenderer', () => {
  it('lists zip entries from ranged reads (payload never fetched)', async () => {
    const bytes = zipOf([centralRecord('docs/', 0), centralRecord('docs/readme.md', 1234), centralRecord('data.bin', 99)])
    const handle = createPreviewAccessHandle({ resource: resourceOf({ size: bytes.byteLength }), bytes })
    let fetchedBytes = 0
    const trackingHandle = {
      ...handle,
      readByteRange: async (request: { offset: number; length: number }) => {
        fetchedBytes += request.length
        return bytes.slice(request.offset, request.offset + request.length)
      },
    }
    render(<MediaArchiveRenderer resource={resourceOf({ size: bytes.byteLength })} access={trackingHandle} />)
    expect(await screen.findByText('docs/readme.md')).toBeDefined()
    expect(screen.getByText('data.bin')).toBeDefined()
    expect(screen.getByText(/条目 3/)).toBeDefined()
    // Total fetched stays within the EOCD tail window + central directory
    // budget — far below the 70,000-byte payload, which is never fetched.
    expect(fetchedBytes).toBeLessThan(70_000)
    handle.release('close')
  })

  it('falls back to the bounded hex view when no EOCD exists', async () => {
    const bytes = new Uint8Array(enc.encode('NOT A ZIP AT ALL'))
    const handle = createPreviewAccessHandle({
      resource: resourceOf({ mediaType: 'application/x-tar', title: 'backup.tar', size: bytes.byteLength }),
      bytes,
    })
    render(<MediaArchiveRenderer resource={resourceOf({ mediaType: 'application/x-tar', title: 'backup.tar', size: bytes.byteLength })} access={handle} />)
    expect(await screen.findByText(/未找到 zip 中央目录/)).toBeDefined()
    expect(screen.getByText(/0x00000000/)).toBeDefined()
    handle.release('close')
  })

  it('degrades to a bounded head view when the owner declares no size', async () => {
    const bytes = zipOf([centralRecord('a.txt', 1)])
    const handle = createPreviewAccessHandle({ resource: resourceOf(), bytes })
    render(<MediaArchiveRenderer resource={resourceOf()} access={handle} />)
    expect(await screen.findByText(/owner 未提供资源大小/)).toBeDefined()
    handle.release('close')
  })

  it('surfaces the owner typed error when byte ranges are not authorized', async () => {
    const handle = createPreviewAccessHandle({ resource: resourceOf(), url: 'https://owner.example/short-lived' })
    render(<MediaArchiveRenderer resource={resourceOf()} access={handle} />)
    expect(await screen.findByRole('alert')).toBeDefined()
    handle.release('close')
  })
})

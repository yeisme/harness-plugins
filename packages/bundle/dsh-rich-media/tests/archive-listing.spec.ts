import { describe, expect, it } from 'vitest'
import {
  ARCHIVE_ENTRY_LIST_MAX,
  ARCHIVE_ENTRY_NAME_MAX,
  isZipArchiveMediaType,
  parseZipEntryList,
} from '../src/client/preview/archive-listing.ts'

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

function zipOf(records: number[][], declaredCount?: number): Uint8Array {
  const junk = [...enc.encode('GARBAGE LOCAL PAYLOAD THAT MUST NEVER BE READ')]
  const central = records.flat()
  return new Uint8Array([...junk, ...central, ...eocd(declaredCount ?? records.length, central.length, junk.length)])
}

describe('parseZipEntryList (owner-side archive entry list, V3 4.8)', () => {
  it('lists entry names, sizes, directories and expanded total from the central directory', () => {
    const list = parseZipEntryList(zipOf([
      centralRecord('docs/', 0),
      centralRecord('docs/readme.md', 1234),
      centralRecord('data.bin', 99),
    ]))
    expect(list).toBeDefined()
    expect(list!.entries.map(entry => entry.name)).toEqual(['docs/', 'docs/readme.md', 'data.bin'])
    expect(list!.entries[0].isDirectory).toBe(true)
    expect(list!.entries[0].uncompressedSize).toBeUndefined()
    expect(list!.entries[1].uncompressedSize).toBe(1234)
    expect(list!.totalEntries).toBe(3)
    expect(list!.listedEntries).toBe(3)
    expect(list!.truncated).toBe(false)
    expect(list!.malformed).toBe(false)
    expect(list!.expandedBytesTotal).toBe(1333)
  })

  it('returns undefined for non-zip bytes (honest unknown, no guessing)', () => {
    expect(parseZipEntryList(new Uint8Array([1, 2, 3]))).toBeUndefined()
    expect(parseZipEntryList(new Uint8Array())).toBeUndefined()
  })

  it('never reads local file data — a hostile payload region cannot affect the list', () => {
    const records = [centralRecord('a.txt', 1)]
    const list = parseZipEntryList(zipOf(records))
    expect(list!.entries.map(entry => entry.name)).toEqual(['a.txt'])
    // Same central directory, completely different (hostile) payload bytes:
    // the listing must be identical because only the central directory is read.
    const junk = [...enc.encode('X'.repeat(37))]
    const central = records.flat()
    const hostile = new Uint8Array([...junk, ...central, ...eocd(1, central.length, junk.length)])
    expect(parseZipEntryList(hostile)!.entries.map(entry => entry.name)).toEqual(['a.txt'])
  })

  it('caps the listed entries and reports the honest unlisted remainder', () => {
    const records: number[][] = []
    for (let index = 0; index < ARCHIVE_ENTRY_LIST_MAX + 30; index += 1) records.push(centralRecord(`f${index}.txt`, 1))
    const list = parseZipEntryList(zipOf(records))
    expect(list!.listedEntries).toBe(ARCHIVE_ENTRY_LIST_MAX)
    expect(list!.totalEntries).toBe(ARCHIVE_ENTRY_LIST_MAX + 30)
    expect(list!.truncated).toBe(true)
    expect(list!.expandedBytesTotal).toBe(ARCHIVE_ENTRY_LIST_MAX)
  })

  it('marks malformed central-directory records honestly instead of guessing', () => {
    const first = centralRecord('docs/', 0)
    const zeros = Array<number>(46).fill(0)
    const central = [...first, ...zeros]
    const bytes = new Uint8Array([...central, ...eocd(2, central.length, 0)])
    const list = parseZipEntryList(bytes)
    expect(list!.listedEntries).toBe(1)
    expect(list!.malformed).toBe(true)
    expect(list!.truncated).toBe(true)
  })

  it('treats the zip64 count sentinel as a truncated lower bound', () => {
    const records = [centralRecord('a.txt', 1)]
    const central = records.flat()
    const bytes = new Uint8Array([...central, ...eocd(0xffff, central.length, 0)])
    const list = parseZipEntryList(bytes)
    expect(list!.totalEntries).toBe(0xffff)
    expect(list!.truncated).toBe(true)
  })

  it('sanitizes control characters and truncates over-long names honestly', () => {
    const controlName = `a${String.fromCharCode(3)}b`
    const control = parseZipEntryList(zipOf([centralRecord(controlName, 5)]))
    const sanitizedName = control!.entries[0].name
    expect(sanitizedName.startsWith('a')).toBe(true)
    expect(sanitizedName.endsWith('b')).toBe(true)
    expect([...sanitizedName].every(char => {
      const code = char.codePointAt(0) ?? 0
      return code >= 32 && code !== 127
    })).toBe(true)

    const long = parseZipEntryList(zipOf([centralRecord('x'.repeat(ARCHIVE_ENTRY_NAME_MAX + 50), 5)]))
    expect(long!.entries[0].name.length).toBe(ARCHIVE_ENTRY_NAME_MAX + 1)
    expect(long!.entries[0].nameTruncated).toBe(true)
  })

  it('survives a hostile oversized declared central-directory size within budget', () => {
    const records = [centralRecord('a.txt', 1)]
    const central = records.flat()
    const bytes = new Uint8Array([...central, ...eocd(1, 0xffffffff, 0)])
    const list = parseZipEntryList(bytes)
    expect(list!.listedEntries).toBe(1)
    expect(list!.malformed).toBe(false)
  })
})

describe('isZipArchiveMediaType', () => {
  it('matches the zip family case-insensitively and nothing else', () => {
    expect(isZipArchiveMediaType('application/zip')).toBe(true)
    expect(isZipArchiveMediaType('application/ZIP')).toBe(true)
    expect(isZipArchiveMediaType('application/java-archive')).toBe(true)
    expect(isZipArchiveMediaType('application/pdf')).toBe(false)
    expect(isZipArchiveMediaType(undefined)).toBe(false)
  })
})

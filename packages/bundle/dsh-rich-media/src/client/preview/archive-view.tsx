/**
 * Owner-bounded zip archive listing (file-preview-dispatch). Fetches only
 * the EOCD tail and the central directory through the access handle's byte
 * ranges — the compressed payload region is never read, never decompressed,
 * never executed. When the owner cannot produce a central directory (or the
 * archive is not a zip) the view degrades to the bounded hex preview with
 * the malformed fact instead of faking a listing.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useEffect, useState, type ReactElement } from 'react'
import type { PreviewRendererProps } from './types.ts'
import { isAbortError } from './sources.ts'
import {
  CENTRAL_DIRECTORY_SCAN_MAX,
  EOCD_SCAN_WINDOW,
  locateZipEocd,
  parseZipCentralDirectory,
  type ArchiveEntryListV1,
} from './archive-listing.ts'
import { BinaryHexTable } from './binary-hex.tsx'

/** Single-read cap enforced by the access handle (`BYTE_RANGE_MAX`). */
const RANGE_CHUNK = 256 * 1024

/** Join consecutive 256KiB ranged reads into one buffer within `total`. */
async function readRangeJoined(
  read: NonNullable<import('./types.ts').PreviewAccessHandleV1['readByteRange']>,
  offset: number,
  total: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let loaded = 0
  while (loaded < total) {
    const chunk = await read({ offset: offset + loaded, length: Math.min(RANGE_CHUNK, total - loaded) }, signal)
    chunks.push(chunk)
    loaded += chunk.byteLength
    if (chunk.byteLength === 0) break
  }
  const merged = new Uint8Array(Math.min(loaded, total))
  let cursor = 0
  for (const chunk of chunks) {
    if (cursor >= merged.byteLength) break
    merged.set(chunk.subarray(0, merged.byteLength - cursor), cursor)
    cursor += chunk.byteLength
  }
  return merged
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

type ArchiveViewState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'list'; readonly list: ArchiveEntryListV1 }
  | { readonly phase: 'hex'; readonly bytes: Uint8Array; readonly note: string }
  | { readonly phase: 'error'; readonly message: string }

/** Registry renderer: zip central-directory listing, hex fallback. */
export function MediaArchiveRenderer({ resource, access }: PreviewRendererProps): ReactElement {
  const [state, setState] = useState<ArchiveViewState>({ phase: 'loading' })
  useEffect(() => {
    if (access === undefined) {
      setState({ phase: 'error', message: '此归档未授权预览访问。' })
      return
    }
    const read = access.readByteRange
    if (read === undefined) {
      setState({ phase: 'error', message: '此归档不支持分段读取，无法安全列出内容。' })
      return
    }
    let live = true
    const controller = new AbortController()
    const fail = (message: string): void => { if (live) setState({ phase: 'error', message }) }
    void (async () => {
      const totalBytes = resource.size
      if (totalBytes === undefined) {
        // Owner 未给大小：无法定位尾部 EOCD，只给有界头部字节视图。
        const head = await read({ offset: 0, length: 256 }, controller.signal)
        if (!live) return
        setState({ phase: 'hex', bytes: head, note: 'owner 未提供资源大小，无法定位 zip 中央目录，显示有界二进制预览。' })
        return
      }
      // Ranged path: EOCD tail first, then only the central directory.
      const tailStart = Math.max(0, totalBytes - EOCD_SCAN_WINDOW)
      const tail = await readRangeJoined(read, tailStart, totalBytes - tailStart, controller.signal)
      if (!live) return
      const located = locateZipEocd(tail)
      if (located === undefined) {
        const head = await read({ offset: 0, length: Math.min(totalBytes, 256) }, controller.signal)
        if (!live) return
        setState({ phase: 'hex', bytes: head, note: '未找到 zip 中央目录（非 zip 归档或已损坏），显示有界二进制预览。' })
        return
      }
      const centralLength = Math.min(located.centralSize, CENTRAL_DIRECTORY_SCAN_MAX, Math.max(0, totalBytes - located.centralOffset))
      const chunk = await readRangeJoined(read, located.centralOffset, centralLength, controller.signal)
      if (!live) return
      setState({ phase: 'list', list: parseZipCentralDirectory(chunk, located.declaredEntries) })
    })().catch((caught: unknown) => {
      if (!live || isAbortError(caught)) return
      fail(caught instanceof Error ? caught.message : '归档读取失败。')
    })
    return () => {
      live = false
      controller.abort()
    }
  }, [access, resource.size])

  if (state.phase === 'loading') return <p role="status">正在读取归档目录…</p>
  if (state.phase === 'error') return <p role="alert" data-dsh-preview-state="error">{state.message}</p>
  if (state.phase === 'hex') {
    return (
      <section data-dsh-archive-preview data-dsh-archive-fallback="hex">
        <p role="status">{state.note}</p>
        <BinaryHexTable bytes={state.bytes} facts={{ loadedBytes: state.bytes.byteLength, totalBytes: resource.size, truncated: resource.size !== undefined && resource.size > state.bytes.byteLength }} />
      </section>
    )
  }
  const { list } = state
  const facts = [
    `条目 ${list.listedEntries}${list.totalEntries > list.listedEntries ? ` / ${list.totalEntries}` : ''}`,
    list.expandedBytesTotal > 0 ? `解压后约 ${formatBytes(list.expandedBytesTotal)}` : undefined,
    list.truncated ? '列表截断' : undefined,
    list.malformed ? '中央目录部分损坏' : undefined,
  ].filter((value): value is string => value !== undefined).join(' · ')
  return (
    <section data-dsh-archive-preview>
      {list.entries.length === 0
        ? <p role="status">归档内没有可列出的条目{list.malformed ? '（中央目录损坏）' : ''}。</p>
        : (
          <div data-dsh-archive-list-scroll>
            <table data-dsh-archive-entry-table aria-label="归档条目列表">
              <thead>
                <tr>
                  <th scope="col">名称</th>
                  <th scope="col">未压缩大小</th>
                </tr>
              </thead>
              <tbody>
                {list.entries.map((entry, index) => (
                  <tr key={`${index}:${entry.name}`} data-dsh-archive-entry-directory={entry.isDirectory || undefined}>
                    <td>{entry.name}</td>
                    <td>{entry.isDirectory ? '—' : entry.uncompressedSize === undefined ? '未知' : formatBytes(entry.uncompressedSize)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
      <p role="status" data-dsh-archive-facts>{facts}</p>
    </section>
  )
}

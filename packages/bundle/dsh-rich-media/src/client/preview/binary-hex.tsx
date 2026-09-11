/**
 * Bounded binary hex/ASCII preview (file-preview-dispatch). Mirrors the
 * 256-byte cap semantics of `dsh-file-document`'s `formatBinaryPreview`
 * (kept local here: the two bundle packages stay dependency-parallel).
 * Reads only the head of the resource through the owner access handle;
 * the fact bar always reports what was loaded versus the owner-declared
 * total so truncation is visible, never silent.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useEffect, useState, type ReactElement } from 'react'
import type { PreviewRendererProps } from './types.ts'
import { accessSource, isAbortError } from './sources.ts'

/** Head bytes rendered as hex/ASCII; the rest stays unlisted. */
export const BINARY_HEX_CAP = 256

const HEX_ROW_BYTES = 16

function hexByte(byte: number): string {
  return byte.toString(16).padStart(2, '0')
}

function asciiByte(byte: number): string {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '·'
}

export interface BinaryHexFactsV1 {
  readonly loadedBytes: number
  readonly totalBytes: number | undefined
  readonly truncated: boolean
}

/** Presentational hex/ASCII table; consumers own the byte fetch. */
export function BinaryHexTable({ bytes, facts }: {
  readonly bytes: Uint8Array
  readonly facts: BinaryHexFactsV1
}): ReactElement {
  const rows: Array<{ readonly offset: number; readonly bytes: readonly number[] }> = []
  for (let offset = 0; offset < bytes.byteLength; offset += HEX_ROW_BYTES) {
    rows.push({ offset, bytes: Array.from(bytes.subarray(offset, offset + HEX_ROW_BYTES)) })
  }
  const summary = facts.totalBytes === undefined
    ? `已加载 ${facts.loadedBytes} 字节`
    : `已加载 ${facts.loadedBytes} / ${facts.totalBytes} 字节`
  return (
    <div data-dsh-binary-hex-preview>
      <table data-dsh-binary-hex-table aria-label="二进制预览（前 256 字节）">
        <tbody>
          {rows.map(row => (
            <tr key={row.offset}>
              <th scope="row">{`0x${row.offset.toString(16).padStart(8, '0')}`}</th>
              <td>{row.bytes.map(hexByte).join(' ')}</td>
              <td aria-hidden="true">{row.bytes.map(asciiByte).join('')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p role="status" data-dsh-binary-hex-facts>
        {summary}
        {facts.truncated ? ` · 仅显示前 ${facts.loadedBytes} 字节，下载可查看完整内容` : ''}
      </p>
    </div>
  )
}

/** Registry renderer for the binary family without a dedicated viewer. */
export function MediaBinaryHexRenderer({ resource, access }: PreviewRendererProps): ReactElement {
  const [state, setState] = useState<
    | { readonly phase: 'loading' }
    | { readonly phase: 'ready'; readonly bytes: Uint8Array }
    | { readonly phase: 'error'; readonly message: string }
  >({ phase: 'loading' })
  useEffect(() => {
    if (access === undefined || access.readByteRange === undefined) {
      setState({ phase: 'error', message: '此二进制资源未授权字节读取。' })
      return
    }
    let live = true
    const controller = new AbortController()
    void accessSource(access).readBytes(BINARY_HEX_CAP, controller.signal).then(bytes => {
      if (!live) return
      if (bytes === undefined) {
        setState({ phase: 'error', message: '二进制内容不可用，请使用打开或下载。' })
        return
      }
      setState({ phase: 'ready', bytes })
    }).catch((caught: unknown) => {
      if (!live || isAbortError(caught)) return
      setState({ phase: 'error', message: caught instanceof Error ? caught.message : '二进制读取失败。' })
    })
    return () => {
      live = false
      controller.abort()
    }
  }, [access])
  if (state.phase === 'loading') return <p role="status">正在读取二进制内容…</p>
  if (state.phase === 'error') return <p role="alert" data-dsh-preview-state="error">{state.message}</p>
  const truncated = resource.size !== undefined && resource.size > state.bytes.byteLength
  return <BinaryHexTable bytes={state.bytes} facts={{ loadedBytes: state.bytes.byteLength, totalBytes: resource.size, truncated }} />
}

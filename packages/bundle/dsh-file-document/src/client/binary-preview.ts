/**
 * Bounded binary preview formatter (V3 4.8).
 *
 * Renders owner-provided bytes as aligned hex + printable-ASCII columns —
 * no archive extraction, no cloud viewer, no Office parsing, no execution.
 * Hard byte cap keeps oversized inputs honest; callers display the cap.
 *
 * @module @yeisme/dsh-file-document/client
 */

export const BINARY_PREVIEW_MAX_BYTES = 256

export interface BinaryPreviewV1 {
  readonly lines: readonly { readonly offset: string; readonly hex: string; readonly ascii: string }[]
  readonly truncated: boolean
  readonly totalBytes: number
}

const HEX = '0123456789abcdef'
const PRINTABLE = /^[\x20-\x7e]$/

function hexByte(value: number): string {
  return `${HEX[value >> 4]}${HEX[value & 0xf]}`
}

/** Aligned hex/ASCII preview capped at BINARY_PREVIEW_MAX_BYTES. */
export function formatBinaryPreview(bytes: Uint8Array, maxBytes: number = BINARY_PREVIEW_MAX_BYTES): BinaryPreviewV1 {
  const cap = Math.max(16, Math.min(4096, Math.floor(maxBytes)))
  const bounded = bytes.length > cap ? bytes.subarray(0, cap) : bytes
  const lines: Array<BinaryPreviewV1['lines'][number]> = []
  for (let offset = 0; offset < bounded.length; offset += 16) {
    const row = bounded.subarray(offset, offset + 16)
    const hex: string[] = []
    const ascii: string[] = []
    for (const byte of row) {
      hex.push(hexByte(byte))
      ascii.push(PRINTABLE.test(String.fromCharCode(byte)) ? String.fromCharCode(byte) : '.')
    }
    lines.push({
      offset: offset.toString(16).padStart(8, '0'),
      hex: hex.join(' ').padEnd(47, ' '),
      ascii: ascii.join(''),
    })
  }
  return { lines, truncated: bytes.length > cap, totalBytes: bytes.length }
}

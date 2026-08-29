/**
 * Bounded byte/text sources for format renderers (file-preview-formats).
 * One abstraction, two adapters: the pane path resolves a short-lived URL;
 * the registry path reads windows/ranges from a `PreviewAccessHandleV1`.
 * Every read is clamped and abortable; oversized reads resolve to
 * `undefined` so renderers degrade honestly instead of ballooning memory.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import type { PreviewAccessHandleV1 } from './types.ts'
import { BYTE_RANGE_MAX, isPreviewAccessAbort, TEXT_WINDOW_MAX } from './access.ts'

export interface BoundedSource {
  /** Read up to `cap` UTF-8 bytes of text. `undefined` when unavailable. */
  readText(cap: number, signal: AbortSignal): Promise<string | undefined>
  /** Read up to `cap` raw bytes. `undefined` when unavailable. */
  readBytes(cap: number, signal: AbortSignal): Promise<Uint8Array | undefined>
}

export function isAbortError(error: unknown): boolean {
  return isPreviewAccessAbort(error)
}

/** Decode bytes as UTF-8 with replacement, never throwing. */
export function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

/** URL-backed source: one bounded fetch per read. */
export function urlSource(url: string): BoundedSource {
  return {
    async readText(cap, signal) {
      const bytes = await readUrlBytes(url, cap, signal)
      return bytes === undefined ? undefined : decodeText(bytes)
    },
    async readBytes(cap, signal) {
      return readUrlBytes(url, cap, signal)
    },
  }
}

async function readUrlBytes(url: string, cap: number, signal: AbortSignal): Promise<Uint8Array | undefined> {
  const response = await fetch(url, { signal })
  if (!response.ok) return undefined
  const reader = response.body?.getReader()
  if (reader === undefined) {
    const buffer = new Uint8Array(await response.arrayBuffer())
    return buffer.byteLength > cap ? buffer.slice(0, cap) : buffer
  }
  const chunks: Uint8Array[] = []
  let loaded = 0
  while (loaded < cap) {
    const { done, value } = await reader.read()
    if (done || value === undefined) break
    chunks.push(value)
    loaded += value.byteLength
  }
  if (loaded > cap) void reader.cancel('budget')
  const merged = new Uint8Array(Math.min(loaded, cap))
  let offset = 0
  for (const chunk of chunks) {
    if (offset >= merged.byteLength) break
    const slice = chunk.subarray(0, merged.byteLength - offset)
    merged.set(slice, offset)
    offset += slice.byteLength
  }
  return merged
}

/** Handle-backed source: joins text windows / byte ranges within budget. */
export function accessSource(access: PreviewAccessHandleV1): BoundedSource {
  return {
    async readText(cap, signal) {
      if (access.readTextWindow === undefined) return undefined
      let text = ''
      try {
        while (text.length < cap) {
          const window = await access.readTextWindow({ offset: text.length, length: Math.min(TEXT_WINDOW_MAX, cap - text.length) }, signal)
          text += window.text
          if (!window.truncated) break
        }
      } catch (error) {
        if (isAbortError(error)) throw error
        return undefined
      }
      return text.length > cap ? text.slice(0, cap) : text
    },
    async readBytes(cap, signal) {
      if (access.readByteRange === undefined) return undefined
      const chunks: Uint8Array[] = []
      let loaded = 0
      try {
        while (loaded < cap) {
          const chunk = await access.readByteRange({ offset: loaded, length: Math.min(BYTE_RANGE_MAX, cap - loaded) }, signal)
          chunks.push(chunk)
          loaded += chunk.byteLength
          if (chunk.byteLength === 0) break
        }
      } catch (error) {
        if (isAbortError(error)) throw error
        return undefined
      }
      const merged = new Uint8Array(Math.min(loaded, cap))
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk.subarray(0, merged.byteLength - offset), offset)
        offset += chunk.byteLength
      }
      return merged
    },
  }
}

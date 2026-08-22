/**
 * Workbench Host projection contract.
 *
 * A Host projection supplies safe media/file entries and short-lived URLs to
 * the composed workbench. It never exposes raw paths, credentials, or
 * unbounded payloads.
 *
 * @module @yeisme/dsh-workbench-compose
 */

import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { MediaRefV1 } from '@yeisme/dsh-rich-media'

export interface WorkbenchHostProjection {
  listMedia(): readonly MediaRefV1[]
  listFileEntries(): readonly FileEntryV1[]
  resolveMediaUrl(media: MediaRefV1): Promise<string> | undefined
  resolveFilePreviewUrl(entry: FileEntryV1): string | undefined
}

export const emptyHostProjection: WorkbenchHostProjection = {
  listMedia: () => [],
  listFileEntries: () => [],
  resolveMediaUrl: () => undefined,
  resolveFilePreviewUrl: () => undefined,
}

export interface StaticHostProjectionInput {
  media?: readonly MediaRefV1[] | undefined
  fileEntries?: readonly FileEntryV1[] | undefined
  resolveMediaUrl?: ((media: MediaRefV1) => Promise<string>) | undefined
  resolveFilePreviewUrl?: ((entry: FileEntryV1) => string | undefined) | undefined
}

/** Build a static Host projection from safe in-memory data. */
export function createStaticHostProjection(input: StaticHostProjectionInput): WorkbenchHostProjection {
  const media = [...(input.media ?? [])]
  const fileEntries = [...(input.fileEntries ?? [])]
  return {
    listMedia: () => media,
    listFileEntries: () => fileEntries,
    resolveMediaUrl: input.resolveMediaUrl ?? (() => undefined),
    resolveFilePreviewUrl: input.resolveFilePreviewUrl ?? (() => undefined),
  }
}

/**
 * DSH Host projection adapter.
 *
 * This adapter is the bridge between real DSH fs/media/terminal seams and the
 * composed workbench. It accepts seam callbacks and returns a
 * `WorkbenchHostProjection`. The actual DSH seam implementations remain with
 * DSH/domain owners.
 *
 * @module @yeisme/dsh-workbench-compose
 */

import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { MediaRefV1 } from '@yeisme/dsh-rich-media'
import type { WorkbenchHostProjection } from './host-projection.ts'

export interface DshHostProjectionSeams {
  listMedia(): readonly MediaRefV1[]
  listFileEntries(): readonly FileEntryV1[]
  resolveMediaUrl(media: MediaRefV1): Promise<string> | undefined
  resolveFilePreviewUrl(entry: FileEntryV1): string | undefined
}

/** Wrap real DSH seam callbacks as a Workbench Host projection. */
export function createDshHostProjection(seams: DshHostProjectionSeams): WorkbenchHostProjection {
  return {
    listMedia: seams.listMedia,
    listFileEntries: seams.listFileEntries,
    resolveMediaUrl: seams.resolveMediaUrl,
    resolveFilePreviewUrl: seams.resolveFilePreviewUrl,
  }
}

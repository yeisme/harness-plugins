/**
 * Compatibility adapters into the Resource Preview platform (V3 3.1, media
 * path). Each adapter maps one owner projection to a `PreviewResourceV1`
 * without ever constructing paths or URLs: the opaque ref stays opaque and
 * only the issuing owner host can resolve access.
 *
 * @module @yeisme/dsh-rich-media/preview
 */

import type { MediaKind, MediaRefV1 } from '../../host/types.ts'
import type { PreviewFamily, PreviewResourceV1 } from './types.ts'
import { previewResourceKey } from './types.ts'

/** Deterministic kind+mediaType to family resolution. */
export function mediaFamilyOf(kind: MediaKind, mediaType: string): PreviewFamily {
  switch (kind) {
    case 'image': return 'image'
    case 'audio': return 'audio'
    case 'video': return 'video'
    case 'pdf': return 'pdf'
    case 'text': return 'text'
    case 'document': {
      const normalized = mediaType.toLowerCase()
      if (normalized === 'text/csv' || normalized === 'text/tab-separated-values') return 'table'
      return 'text'
    }
    case 'file': {
      const normalized = mediaType.toLowerCase()
      if (normalized.startsWith('image/')) return 'image'
      if (normalized.startsWith('audio/')) return 'audio'
      if (normalized.startsWith('video/')) return 'video'
      if (normalized === 'application/pdf') return 'pdf'
      if (normalized.startsWith('text/')) return 'text'
      if (normalized === 'text/csv' || normalized === 'text/tab-separated-values') return 'table'
      return 'binary'
    }
    default: return 'binary'
  }
}

/** Structural file entry from `@yeisme/dsh-file-document`; kept local to avoid a new runtime dependency. */
export interface FileEntryLike {
  id: string
  name: string
  kind: string
  mediaType?: string | undefined
  size?: number | undefined
  summary?: string | undefined
  capabilities: readonly string[]
}

/** Owner-issued attachment or artifact projection. Opaque ref only. */
export interface OwnedResourceLike {
  owner: string
  ref: string
  version: string
  title: string
  mediaType: string
  size?: number | undefined
  summary?: string | undefined
  capabilities: readonly string[]
}

function fileKindToMediaKind(kind: string, mediaType: string): MediaKind {
  if (kind === 'image' || kind === 'audio' || kind === 'video' || kind === 'pdf' || kind === 'text') return kind
  if (kind === 'document') return 'document'
  if (mediaType.startsWith('image/')) return 'image'
  if (mediaType.startsWith('audio/')) return 'audio'
  if (mediaType.startsWith('video/')) return 'video'
  if (mediaType === 'application/pdf') return 'pdf'
  if (mediaType.startsWith('text/')) return 'text'
  return 'file'
}

/** Map one validated `FileEntryV1`-shaped projection into the preview platform. */
export function fileEntryToPreviewResource(entry: FileEntryLike, owner = 'dsh', version = 'v1'): PreviewResourceV1 {
  const mediaType = entry.mediaType ?? 'application/octet-stream'
  const kind = fileKindToMediaKind(entry.kind, mediaType)
  return {
    key: previewResourceKey({ owner, ref: entry.id, version }),
    sourceKind: 'file',
    ref: { owner, ref: entry.id, version },
    title: entry.name,
    mediaType,
    family: mediaFamilyOf(kind, mediaType),
    ...entry.size === undefined ? {} : { size: entry.size },
    ...entry.summary === undefined ? {} : { summary: entry.summary },
    capabilities: [...entry.capabilities],
  }
}

/** Map an owner attachment projection. The opaque ref stays opaque. */
export function attachmentRefToPreviewResource(attachment: OwnedResourceLike): PreviewResourceV1 {
  const kind = fileKindToMediaKind('file', attachment.mediaType)
  return {
    key: previewResourceKey({ owner: attachment.owner, ref: attachment.ref, version: attachment.version }),
    sourceKind: 'attachment',
    ref: { owner: attachment.owner, ref: attachment.ref, version: attachment.version },
    title: attachment.title,
    mediaType: attachment.mediaType,
    family: mediaFamilyOf(kind, attachment.mediaType),
    ...attachment.size === undefined ? {} : { size: attachment.size },
    ...attachment.summary === undefined ? {} : { summary: attachment.summary },
    capabilities: [...attachment.capabilities],
  }
}

/** Map an owner artifact projection. Resolution stays with the issuing owner. */
export function artifactRefToPreviewResource(artifact: OwnedResourceLike): PreviewResourceV1 {
  const kind = fileKindToMediaKind('file', artifact.mediaType)
  return {
    key: previewResourceKey({ owner: artifact.owner, ref: artifact.ref, version: artifact.version }),
    sourceKind: 'artifact',
    ref: { owner: artifact.owner, ref: artifact.ref, version: artifact.version },
    title: artifact.title,
    mediaType: artifact.mediaType,
    family: mediaFamilyOf(kind, artifact.mediaType),
    ...artifact.size === undefined ? {} : { size: artifact.size },
    ...artifact.summary === undefined ? {} : { summary: artifact.summary },
    capabilities: [...artifact.capabilities],
  }
}

/** Map one validated `MediaRefV1` into the preview platform. */
export function mediaRefToPreviewResource(media: MediaRefV1): PreviewResourceV1 {
  const ref = { owner: media.owner, ref: media.ref, version: media.version }
  return {
    key: previewResourceKey(ref),
    sourceKind: 'media',
    ref,
    title: media.title,
    mediaType: media.mediaType,
    family: mediaFamilyOf(media.kind, media.mediaType),
    ...media.size === undefined ? {} : { size: media.size },
    ...media.width === undefined ? {} : { width: media.width },
    ...media.height === undefined ? {} : { height: media.height },
    ...media.duration === undefined ? {} : { duration: media.duration },
    ...media.summary === undefined ? {} : { summary: media.summary },
    capabilities: [...media.capabilities],
  }
}

/**
 * Format renderer descriptors for the local preview registry
 * (file-preview-formats 3.1). Each descriptor adapts the registry's
 * `PreviewRendererProps` (resource + access handle) onto the shared format
 * renderers; the pane path reaches the same components through a URL
 * source. Exact-MIME descriptors outrank family fallbacks so CSV/XLSX/DOCX
 * never degrade into the generic binary notice.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import type { ReactElement } from 'react'
import type { MediaCapability, MediaKind, MediaRefV1 } from '../../host/types.ts'
import { accessSource } from './sources.ts'
import { MediaCsvRenderer } from './csv-renderer.tsx'
import { DOCX_MEDIA_TYPE, documentPreviewKindOf, XLSSM_MEDIA_TYPE, XLSX_MEDIA_TYPE } from './format-kinds.ts'
import { MediaDocxRenderer } from './docx-renderer.tsx'
import { MediaSheetRenderer } from './sheet-renderer.tsx'
import { MediaTextSourceRenderer } from './text-source.tsx'
import type {
  PreviewFamily,
  PreviewRendererDescriptorV1,
  PreviewRendererProps,
  PreviewResourceV1,
} from './types.ts'

function familyToMediaKind(family: PreviewFamily): MediaKind {
  return family === 'image' || family === 'audio' || family === 'video' || family === 'pdf' || family === 'text'
    ? family
    : 'document'
}

/** Minimal `MediaRefV1` view of one registry resource for the shared renderers. */
export function mediaRefOfResource(resource: PreviewResourceV1): MediaRefV1 {
  const capabilities = resource.capabilities.filter((value): value is MediaCapability =>
    value === 'play' || value === 'download' || value === 'extract_text' || value === 'open' || value === 'preview')
  return {
    owner: resource.ref.owner,
    kind: familyToMediaKind(resource.family),
    ref: resource.ref.ref,
    version: resource.ref.version,
    mediaType: resource.mediaType,
    title: resource.title,
    ...resource.size === undefined ? {} : { size: resource.size },
    capabilities,
  }
}

function unsupported(message: string): ReactElement {
  return <p role="status" data-dsh-preview-state="unsupported">{message}</p>
}

const textPreview = ({ resource, access }: PreviewRendererProps): ReactElement => {
  if (access === undefined) return unsupported('此文件类型暂不支持内嵌预览。')
  return <MediaTextSourceRenderer media={mediaRefOfResource(resource)} source={accessSource(access)} />
}

const csvPreview = ({ resource, access }: PreviewRendererProps): ReactElement => {
  if (access === undefined) return unsupported('此表格暂不支持内嵌预览。')
  return <MediaCsvRenderer media={mediaRefOfResource(resource)} source={accessSource(access)} />
}

const sheetPreview = ({ resource, access }: PreviewRendererProps): ReactElement => {
  if (access === undefined) return unsupported('此工作簿暂不支持内嵌预览。')
  return <MediaSheetRenderer media={mediaRefOfResource(resource)} source={accessSource(access)} />
}

const docxPreview = ({ resource, access }: PreviewRendererProps): ReactElement => {
  if (access === undefined) return unsupported('此文档暂不支持内嵌预览。')
  return <MediaDocxRenderer media={mediaRefOfResource(resource)} source={accessSource(access)} />
}

/** Honest degrade for document/binary families without a format renderer. */
const binaryNotice = (): ReactElement => unsupported('此文件类型暂不支持内嵌预览。')

/** Native browser PDF embed on the owner-granted short-lived URL. */
const pdfPreview = ({ resource, access }: PreviewRendererProps): ReactElement => {
  if (access === undefined || access.url === undefined) return unsupported('PDF 授权不可用，请使用打开或下载。')
  return (
    <iframe
      src={access.url}
      title={resource.title}
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      style={{ width: '100%', height: 'min(68vh, 720px)', border: 0, background: '#101012' }}
    />
  )
}

export const previewTextRendererDescriptor: PreviewRendererDescriptorV1 = {
  id: 'yeisme:text',
  families: ['text'],
  priority: 90,
  load: async () => textPreview,
}

export const previewCsvRendererDescriptor: PreviewRendererDescriptorV1 = {
  id: 'yeisme:csv',
  families: ['table'],
  mediaTypes: ['text/csv', 'text/tab-separated-values'],
  priority: 110,
  load: async () => csvPreview,
}

export const previewSheetRendererDescriptor: PreviewRendererDescriptorV1 = {
  id: 'yeisme:sheet',
  families: ['table'],
  mediaTypes: [XLSX_MEDIA_TYPE, XLSSM_MEDIA_TYPE],
  priority: 110,
  load: async () => sheetPreview,
}

export const previewDocxRendererDescriptor: PreviewRendererDescriptorV1 = {
  id: 'yeisme:docx',
  families: ['document'],
  mediaTypes: [DOCX_MEDIA_TYPE],
  priority: 110,
  load: async () => docxPreview,
}

export const previewPdfRendererDescriptor: PreviewRendererDescriptorV1 = {
  id: 'yeisme:pdf',
  families: ['pdf'],
  priority: 100,
  load: async () => pdfPreview,
}

export const previewBinaryNoticeDescriptor: PreviewRendererDescriptorV1 = {
  id: 'yeisme:binary-notice',
  families: ['document', 'binary'],
  priority: 110,
  load: async () => binaryNotice,
}

/** All format descriptors in registration order. */
export const FILE_PREVIEW_DESCRIPTORS: readonly PreviewRendererDescriptorV1[] = Object.freeze([
  previewTextRendererDescriptor,
  previewCsvRendererDescriptor,
  previewSheetRendererDescriptor,
  previewDocxRendererDescriptor,
  previewPdfRendererDescriptor,
  previewBinaryNoticeDescriptor,
])

/** Register every format descriptor on a registry; returns one disposer. */
export function registerFilePreviewRenderers(
  register: (descriptor: PreviewRendererDescriptorV1) => () => void,
): () => void {
  const disposers = FILE_PREVIEW_DESCRIPTORS.map(descriptor => register(descriptor))
  return () => { for (const dispose of disposers) dispose() }
}

export { documentPreviewKindOf }

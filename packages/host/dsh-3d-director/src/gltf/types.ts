import type {
  GltfCapabilityGapV1,
  GltfCapabilityReportV1,
  ProjectCanvasScope,
  SceneDocumentV1,
} from '@yeisme/dsh-pane-protocol'

/**
 * Hard input ceiling for both GLB containers and .gltf JSON text. Anything
 * larger is rejected before parsing so a hostile or accidental blob can never
 * reach the glTF reader.
 */
export const MAX_GLB_BYTES = 64 * 1024 * 1024

export type Scene3DScope = ProjectCanvasScope

export interface GltfImportOptions {
  /** Workbench scope stamped onto the projected document; defaults to a generic import scope. */
  scope?: Scene3DScope
  /** Document id override; defaults to a deterministic content digest. */
  documentId?: string
  /** Workbench scene graph revision; fresh imports default to 0 (the store bumps on save). */
  version?: number
}

export type GltfImportFailureCode =
  | 'too_large'
  | 'unsupported_container'
  | 'unsupported_version'
  | 'external_resources'
  | 'unknown_required_extension'
  | 'invalid_extension'
  | 'too_complex'
  | 'parse_failed'
  | 'invalid_document'

export type GltfImportResult =
  | { ok: true; document: SceneDocumentV1; capabilityReport: GltfCapabilityReportV1; warnings: string[] }
  | { ok: false; code: GltfImportFailureCode; reason: string }

export type GltfExportFailureCode = 'invalid_document' | 'capability_blocked' | 'write_failed'

export type GltfExportResult =
  | { ok: true; bytes: Uint8Array; capabilityReport: GltfCapabilityReportV1; warnings: string[] }
  | { ok: false; code: GltfExportFailureCode; reason: string; gaps: GltfCapabilityGapV1[] }

/** Strips control characters and bounds length; never echoes byte content, paths, or prompts. */
export function boundedReason(message: unknown, max = 240): string {
  const text = String(message)
    .replace(/[\x00-\x1f\x7f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

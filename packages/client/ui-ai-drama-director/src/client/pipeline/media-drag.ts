/**
 * 拖入画布 handoff（dsh-creative-pipeline-visual-workbench-v1 D3/M2）。
 *
 * HTML5 DnD 的 DataTransfer 只携带 opaque ref + kind + version 的 JSON
 * （自有 mime type application/x-dsh-media-ref），绝不携带 URL、路径、
 * 凭据或媒体正文。drop 时 fail-closed 解析，产出“创建 asset 节点”意图
 * 回调；非法 payload 一律拒绝并给出可见原因，不落任何节点。
 */
import {
  validatePipelineMediaRef,
  type PipelineMediaEntry,
  type PipelineMediaKind,
  type PipelineMediaValidationCode,
  type PipelineMediaValidationResult,
} from './media.js'

export const PIPELINE_MEDIA_DRAG_MIME = 'application/x-dsh-media-ref' as const
export const PIPELINE_MEDIA_DRAG_SCHEMA = 'dsh.pipeline-media-ref.v1' as const

export interface PipelineMediaDragPayloadV1 {
  readonly schema: typeof PIPELINE_MEDIA_DRAG_SCHEMA
  readonly ref: string
  readonly kind: PipelineMediaKind
  readonly version: string
}

/** 拖放产生的画布意图：由画布 owner 决定是否在 drop 位置创建 asset 节点。 */
export interface PipelineAssetNodeIntentV1 {
  readonly intent: 'pipeline.create-asset-node'
  readonly ref: string
  readonly mediaKind: PipelineMediaKind
  readonly version: string
}

export interface PipelineMediaDragPosition {
  readonly x: number
  readonly y: number
}

/** DataTransfer 的最小结构，便于 jsdom/ stub 环境下测试。 */
export interface PipelineMediaDataTransferLike {
  readonly types?: readonly string[]
  setData?(type: string, data: string): void
  getData?(type: string): string
}

export interface PipelineMediaDropEventLike {
  readonly dataTransfer: PipelineMediaDataTransferLike | null
  readonly clientX?: number
  readonly clientY?: number
  preventDefault(): void
}

export function writePipelineMediaDragPayload(dataTransfer: PipelineMediaDataTransferLike, entry: PipelineMediaEntry): boolean {
  if (typeof dataTransfer.setData !== 'function') return false
  const payload: PipelineMediaDragPayloadV1 = {
    schema: PIPELINE_MEDIA_DRAG_SCHEMA,
    ref: entry.ref,
    kind: entry.kind,
    version: entry.version,
  }
  dataTransfer.setData(PIPELINE_MEDIA_DRAG_MIME, JSON.stringify(payload))
  return true
}

export function hasPipelineMediaDragPayload(dataTransfer: PipelineMediaDataTransferLike | null): boolean {
  if (dataTransfer === null) return false
  const types = dataTransfer.types
  if (types === undefined) return typeof dataTransfer.getData === 'function'
  return [...types].some(type => type.toLowerCase() === PIPELINE_MEDIA_DRAG_MIME)
}

export function readPipelineMediaDragPayload(dataTransfer: PipelineMediaDataTransferLike | null): PipelineMediaValidationResult<PipelineMediaDragPayloadV1> {
  const invalid = (code: PipelineMediaValidationCode, reason: string): PipelineMediaValidationResult<PipelineMediaDragPayloadV1> => ({ ok: false, code, reason })
  if (dataTransfer === null || typeof dataTransfer.getData !== 'function') {
    return invalid('media.invalid_shape', 'drop carries no readable data transfer')
  }
  const raw = dataTransfer.getData(PIPELINE_MEDIA_DRAG_MIME)
  if (raw === '') return invalid('media.invalid_shape', 'drop carries no pipeline media payload')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return invalid('media.invalid_shape', 'pipeline media payload is not valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return invalid('media.invalid_shape', 'pipeline media payload must be an object')
  }
  const value = parsed as Record<string, unknown>
  for (const key of Object.keys(value)) {
    if (!['schema', 'ref', 'kind', 'version'].includes(key)) return invalid('media.invalid_shape', `payload.${key} is not allowed`)
  }
  if (value.schema !== PIPELINE_MEDIA_DRAG_SCHEMA) return invalid('media.invalid_shape', 'pipeline media payload schema is not supported')
  let ref: string
  try {
    ref = validatePipelineMediaRef(value.ref, 'payload.ref')
  } catch (error) {
    return invalid('media.private_path', error instanceof Error ? error.message : 'payload.ref is not a safe opaque ref')
  }
  if (value.kind !== 'image' && value.kind !== 'video') return invalid('media.unknown_enum', 'payload.kind is not supported')
  if (typeof value.version !== 'string' || value.version.length === 0 || value.version.length > 160) {
    return invalid('media.invalid_shape', 'payload.version must be a bounded non-empty string')
  }
  return { ok: true, value: { schema: PIPELINE_MEDIA_DRAG_SCHEMA, ref, kind: value.kind, version: value.version } }
}

export function createPipelineAssetNodeIntent(payload: PipelineMediaDragPayloadV1): PipelineAssetNodeIntentV1 {
  return { intent: 'pipeline.create-asset-node', ref: payload.ref, mediaKind: payload.kind, version: payload.version }
}

/**
 * drop 处理：非本 mime 的拖拽返回 false（不交给你）；本 mime 一律 preventDefault，
 * 合法载荷产出创建 asset 节点意图，非法载荷调用 onReject 给出有界可见原因。
 */
export function handlePipelineMediaDrop(
  event: PipelineMediaDropEventLike,
  callbacks: {
    readonly onIntent: (intent: PipelineAssetNodeIntentV1, position: PipelineMediaDragPosition) => void
    readonly onReject?: (reason: string) => void
  },
): boolean {
  if (!hasPipelineMediaDragPayload(event.dataTransfer)) return false
  event.preventDefault()
  const parsed = readPipelineMediaDragPayload(event.dataTransfer)
  if (!parsed.ok) {
    callbacks.onReject?.(`${parsed.code}: ${parsed.reason}`)
    return true
  }
  callbacks.onIntent(createPipelineAssetNodeIntent(parsed.value), {
    x: event.clientX ?? 0,
    y: event.clientY ?? 0,
  })
  return true
}

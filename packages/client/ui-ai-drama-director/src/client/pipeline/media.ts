/**
 * 媒体安全引用适配层（dsh-creative-pipeline-visual-workbench-v1 D3/M2）。
 *
 * PipelineMediaEntry 只携带 owner 签发的 opaque ref、kind、有界标题、
 * version、freshness 与能力白名单；绝不携带凭据、raw prompt、provider
 * payload、绝对路径或持久 URL。校验器 fail-closed，拒绝规则与
 * @yeisme/dsh-pane-protocol 的 OpaqueRefSchema 及
 * @yeisme/dsh-plugin-contracts creative-pipeline decoder 保持一致
 * （OpaqueRefSchema 未从 pane-protocol 导出，此处按同一正则集合实现：
 * 绝对路径、UNC、unsafe protocol、路径分隔符、相对遍历、空白与控制字符）。
 *
 * createMediaAccessResolver 抽象 owner 单方签发的短时 URL + expiresAt：
 * 组件只拿到带过期时间的访问句柄，永不持有 raw path 或持久 URL；
 * 过期句柄由 pipelineMediaResolutionState 标记为 needs_reresolve，
 * blob/object URL 经 release 对称释放。
 */
import type { ProjectionFreshness } from '@yeisme/dsh-plugin-contracts'
import { redactCreativePipelineText } from '@yeisme/dsh-plugin-contracts'

export type PipelineMediaKind = 'image' | 'video'
export type PipelineMediaCapability = 'preview' | 'playback' | 'drag'

export const PIPELINE_MEDIA_KINDS: readonly PipelineMediaKind[] = ['image', 'video']
export const PIPELINE_MEDIA_CAPABILITIES: readonly PipelineMediaCapability[] = ['preview', 'playback', 'drag']

/** 浏览器安全的媒体条目投影：opaque ref + 有界元数据，无任何访问凭据。 */
export interface PipelineMediaEntry {
  readonly ref: string
  readonly kind: PipelineMediaKind
  /** 有界标题（≤160 字符，已过 redaction） */
  readonly title: string
  readonly version: string
  readonly freshness: ProjectionFreshness
  /** 能力白名单子集；未声明的能力不得由 UI 假定 */
  readonly capabilities: readonly PipelineMediaCapability[]
}

export type PipelineMediaValidationCode =
  | 'media.invalid_shape'
  | 'media.unknown_enum'
  | 'media.out_of_bounds'
  | 'media.sensitive_field'
  | 'media.private_path'

export type PipelineMediaValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: PipelineMediaValidationCode; readonly reason: string }

const KINDS = new Set<PipelineMediaKind>(PIPELINE_MEDIA_KINDS)
const CAPABILITIES = new Set<PipelineMediaCapability>(PIPELINE_MEDIA_CAPABILITIES)
const FRESHNESS = new Set<ProjectionFreshness>(['fresh', 'stale', 'unknown'])
const SENSITIVE_KEY = /(?:authorization|cookie|credential|password|provider_payload|raw_argv|raw_prompt|secret|system_prompt|token)/i
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/
const UNC_PATH = /^\\\\/
const UNSAFE_PROTOCOL = /^(?:https?|file|javascript|data|blob):/i
const UNSAFE_REF_CHARS = /[\\/]|\.\.|\s|[\u0000-\u001F\u007F]/
const MAX_REF = 512
const MAX_TITLE = 160
const MAX_VERSION = 160
const MAX_CAPABILITIES = 8

class MediaValidationFailure extends Error {
  constructor(readonly code: PipelineMediaValidationCode, message: string) {
    super(message)
  }
}

function fail(code: PipelineMediaValidationCode, message: string): never {
  throw new MediaValidationFailure(code, message)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('media.invalid_shape', `${path} must be an object`)
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (SENSITIVE_KEY.test(key)) fail('media.sensitive_field', `${path}.${key} is sensitive`)
    if (!allowedSet.has(key)) fail('media.invalid_shape', `${path}.${key} is not allowed`)
  }
}

function boundedString(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string' || value.length === 0) fail('media.invalid_shape', `${path} must be a non-empty string`)
  if (value.length > max) fail('media.out_of_bounds', `${path} exceeds ${max} characters`)
  return value
}

/** opaque ref 拒绝绝对路径、UNC、URL/协议形态、路径分隔符、遍历、空白与控制字符。 */
export function validatePipelineMediaRef(value: unknown, path = 'ref'): string {
  const ref = boundedString(value, path, MAX_REF)
  if (ref.startsWith('/') || WINDOWS_ABSOLUTE_PATH.test(ref) || UNC_PATH.test(ref)) {
    fail('media.private_path', `${path} is an absolute path, not an opaque ref`)
  }
  if (UNSAFE_PROTOCOL.test(ref)) fail('media.private_path', `${path} is a URL, not an opaque ref`)
  if (UNSAFE_REF_CHARS.test(ref)) fail('media.private_path', `${path} is not a safe opaque ref`)
  return ref
}

function enumValue<T extends string>(value: unknown, values: ReadonlySet<T>, path: string): T {
  if (typeof value !== 'string' || !values.has(value as T)) fail('media.unknown_enum', `${path} is not supported`)
  return value as T
}

export function validatePipelineMediaEntry(input: unknown): PipelineMediaValidationResult<PipelineMediaEntry> {
  try {
    const value = record(input, 'media')
    exactKeys(value, ['ref', 'kind', 'title', 'version', 'freshness', 'capabilities'], 'media')
    if (!Array.isArray(value.capabilities)) fail('media.invalid_shape', 'media.capabilities must be an array')
    if (value.capabilities.length > MAX_CAPABILITIES) fail('media.out_of_bounds', `media.capabilities exceeds ${MAX_CAPABILITIES} items`)
    const capabilities = [...new Set(value.capabilities.map((item, index) => enumValue(item, CAPABILITIES, `media.capabilities[${index}`)))]
    return {
      ok: true,
      value: {
        ref: validatePipelineMediaRef(value.ref, 'media.ref'),
        kind: enumValue(value.kind, KINDS, 'media.kind'),
        title: redactCreativePipelineText(boundedString(value.title, 'media.title', MAX_TITLE)),
        version: boundedString(value.version, 'media.version', MAX_VERSION),
        freshness: enumValue(value.freshness, FRESHNESS, 'media.freshness'),
        capabilities,
      },
    }
  } catch (error) {
    if (error instanceof MediaValidationFailure) return { ok: false, code: error.code, reason: error.message }
    return { ok: false, code: 'media.invalid_shape', reason: 'media entry validation failed' }
  }
}

/** owner 单方签发的短时访问：URL + expiresAt，组件不得持久化。 */
export interface PipelineMediaAccessV1 {
  readonly url: string
  readonly expiresAt: string
}

export type PipelineMediaResolution =
  | { readonly status: 'ready'; readonly url: string; readonly expiresAt: string; readonly expiresAtMs: number }
  | { readonly status: 'unavailable'; readonly reason: string }

/** 注入式 owner 解析函数；返回 undefined 表示 owner 当前不提供访问。 */
export type PipelineMediaResolveFn = (entry: PipelineMediaEntry) => Promise<PipelineMediaAccessV1 | undefined>

export interface PipelineMediaAccessResolver {
  /** fail-closed：条目非法、URL 形态不安全或已过期都解析为 unavailable 并给出有界原因。 */
  resolve(entry: PipelineMediaEntry): Promise<PipelineMediaResolution>
  /** 对称释放 blob/object URL 与解码缓存；对同一 resolution 幂等。 */
  release(resolution: PipelineMediaResolution): void
}

export type PipelineMediaResolutionState = 'ready' | 'needs_reresolve' | 'unavailable'

/** 过期自动标记：ready 句柄超过 expiresAt 后必须重新解析，不得继续渲染旧 URL。 */
export function pipelineMediaResolutionState(resolution: PipelineMediaResolution, nowMs: number): PipelineMediaResolutionState {
  if (resolution.status !== 'ready') return 'unavailable'
  return nowMs < resolution.expiresAtMs ? 'ready' : 'needs_reresolve'
}

const SAFE_RESOLVED_URL = /^(?:https?:|blob:)/i

export function createMediaAccessResolver(deps: {
  readonly resolve: PipelineMediaResolveFn
  readonly now?: () => number
  readonly revokeObjectUrl?: (url: string) => void
}): PipelineMediaAccessResolver {
  const now = deps.now ?? (() => Date.now())
  const revoke = deps.revokeObjectUrl ?? ((url: string) => {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
  })
  const released = new WeakSet<object>()
  return {
    async resolve(entry) {
      const validated = validatePipelineMediaEntry(entry)
      if (!validated.ok) return { status: 'unavailable', reason: `${validated.code}: ${validated.reason}` }
      let access: PipelineMediaAccessV1 | undefined
      try {
        access = await deps.resolve(validated.value)
      } catch {
        return { status: 'unavailable', reason: 'media access resolve failed' }
      }
      if (access === undefined) return { status: 'unavailable', reason: 'owner did not grant media access' }
      if (typeof access.url !== 'string' || !SAFE_RESOLVED_URL.test(access.url)) {
        return { status: 'unavailable', reason: 'resolved media URL is not a safe http(s)/blob URL' }
      }
      const expiresAtMs = Date.parse(access.expiresAt)
      if (!Number.isFinite(expiresAtMs)) return { status: 'unavailable', reason: 'resolved media access has no valid expiry' }
      if (expiresAtMs - now() <= 0) return { status: 'unavailable', reason: 'resolved media access is already expired; resolve again' }
      return { status: 'ready', url: access.url, expiresAt: access.expiresAt, expiresAtMs }
    },
    release(resolution) {
      if (resolution.status !== 'ready' || released.has(resolution)) return
      released.add(resolution)
      if (/^blob:/i.test(resolution.url)) revoke(resolution.url)
    },
  }
}

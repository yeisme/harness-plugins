/**
 * Sonora provider 能力矩阵消费（dsh-sonora-audio-studio-v1 §2.2）。
 *
 * owner 描述是唯一真源：语音/声音 provider 来自 `GET /api/v1/providers`
 * （provider_kind/配置状态/clone/费用模型），音乐 provider 来自
 * `GET /api/v1/music/providers`（readiness/terms），转写来自既有
 * transcription catalog（fixture/时间码精度）。矩阵逐项标注
 * supported | unverified | missing；缺失/未验证保留禁用入口与稳定原因码，
 * 不把 fixture、preview、probe 或未配置 provider 升级为可用，不合成费用。
 * 字幕导出能力来自 1.1 owner 合同核对（digest 记录），入口标注来源，
 * 不冒充实时探测。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import type { CreatorStudioContextV1 } from './types.ts'
import type { SonoraTranscriptionCatalog } from './sonora-transcription-catalog.ts'

const identifier = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)

/** owner ProviderItem（GET /api/v1/providers；路径/凭据摘要不进浏览器投影）。 */
export const sonoraProviderItemSchema = z.object({
  provider_id: identifier,
  provider_kind: identifier.optional(),
  capability_tier: identifier.optional(),
  requires_network: z.boolean(),
  requires_credentials: z.boolean(),
  configured: z.boolean(),
  credential_source: identifier.optional(),
  status: z.string().min(1).max(64),
  supported_locales: z.array(identifier).max(64).optional(),
  supported_formats: z.array(identifier).max(64).optional(),
  supports_voice_clone: z.boolean(),
  cost_model: identifier.optional(),
}).strict()
export type SonoraProviderItem = z.infer<typeof sonoraProviderItemSchema>

export const sonoraProvidersResponseSchema = z.object({
  providers: z.array(sonoraProviderItemSchema).max(128),
}).strict()

/** owner MusicProviderProfile（GET /api/v1/music/providers）。artifact_hosts 等主机信息不进浏览器投影。 */
export const sonoraMusicProviderSchema = z.object({
  provider_id: identifier,
  provider_kind: identifier,
  readiness: z.string().min(1).max(64),
  capabilities: z.record(z.string(), z.string().max(400)).refine(value => Object.keys(value).length <= 32, 'too many capabilities').optional(),
  supported_formats: z.array(identifier).max(64).optional(),
  requires_network: z.boolean(),
  requires_credentials: z.boolean(),
  cost_model: identifier,
  terms_revision: identifier.optional(),
  safety_notes: z.array(z.string().min(1).max(300)).max(8).optional(),
}).strict()
export type SonoraMusicProvider = z.infer<typeof sonoraMusicProviderSchema>

export const sonoraMusicProvidersResponseSchema = z.object({
  providers: z.array(sonoraMusicProviderSchema).max(64),
}).strict()

export const SONORA_CAPABILITY_FAMILIES = ['speech', 'voice_clone', 'music', 'sfx', 'transcription', 'word_alignment', 'subtitle_export'] as const
export type SonoraCapabilityFamily = (typeof SONORA_CAPABILITY_FAMILIES)[number]

export type SonoraCapabilityState = 'supported' | 'unverified' | 'missing'

/** 浏览器安全矩阵条目：family + 状态 + 稳定原因码 + 有界 provider 标识 + 来源。 */
export interface SonoraCapabilityMatrixEntry {
  readonly family: SonoraCapabilityFamily
  readonly state: SonoraCapabilityState
  readonly reasonCode: string
  /** 有界补充事实（如 readiness 值、时间码精度），不含主机/凭据/报价数值。 */
  readonly detail?: string | undefined
  readonly providers: readonly { readonly id: string; readonly kind?: string | undefined; readonly status: string }[]
  readonly source: 'providers' | 'music_providers' | 'transcription_catalog' | 'contract_audit'
}

export interface SonoraCapabilityMatrix {
  readonly schemaVersion: 'sonora.capability_matrix.v1'
  readonly entries: readonly SonoraCapabilityMatrixEntry[]
}

export type SonoraCapabilityMatrixResult =
  | { readonly status: 'ready'; readonly resource: SonoraCapabilityMatrix }
  | { readonly status: 'rejected' | 'unknown'; readonly reason: 'invalid_input' | 'unavailable' | 'permission_denied' | 'not_found' | 'owner_rejected' | 'unconfirmed' }

/** Host-only authorized connection（与字幕导出客户端同一连接语义）。 */
export interface SonoraCapabilityConnection {
  readonly baseURL: string
  readonly headers: Readonly<Record<string, string>>
  readonly context: CreatorStudioContextV1
}

const CONTEXT_KEYS = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const

/** music readiness 值域为 owner 自由字符串：production 系列才视为 supported，
 * 明确禁用系列视为 missing，其余（preview/first-support/…）保持 unverified。 */
function musicState(readiness: string): SonoraCapabilityState {
  const value = readiness.toLowerCase()
  if (['production', 'ga', 'stable'].includes(value)) return 'supported'
  if (value.includes('disabled') || value.includes('retired')) return 'missing'
  return 'unverified'
}

/** 由 owner 描述推导矩阵；只做逐项映射，不推断 owner 未声明的事实。 */
export function deriveSonoraCapabilityMatrix(input: {
  providers?: readonly SonoraProviderItem[]
  musicProviders?: readonly SonoraMusicProvider[]
  transcription?: SonoraTranscriptionCatalog
}): SonoraCapabilityMatrix {
  const providers = input.providers ?? []
  const music = input.musicProviders ?? []
  const speech = providers.filter(provider => provider.provider_kind === undefined || provider.provider_kind === 'tts')
  const sfx = providers.filter(provider => provider.provider_kind === 'sfx')
  const configured = speech.filter(provider => provider.configured)
  const cloneCapable = speech.filter(provider => provider.supports_voice_clone)
  const cloneReady = cloneCapable.filter(provider => provider.configured)
  const musicStates = music.map(provider => musicState(provider.readiness))
  const transcription = input.transcription
  const profiles = transcription?.profiles ?? []
  const realProfiles = profiles.filter(profile => !profile.fixture)
  const wordProfiles = profiles.filter(profile => profile.timestamp_modes.includes('word'))
  const realWordProfiles = wordProfiles.filter(profile => !profile.fixture)
  const entries: SonoraCapabilityMatrixEntry[] = [
    {
      family: 'speech',
      state: configured.length > 0 ? 'supported' : speech.length > 0 ? 'unverified' : 'missing',
      reasonCode: configured.length > 0 ? 'owner_declared_configured' : speech.length > 0 ? 'provider_not_configured' : 'owner_declared_no_providers',
      detail: configured.length > 0 ? undefined : speech.map(provider => `${provider.provider_id}:${provider.status}`).join(', ') || undefined,
      providers: speech.slice(0, 16).map(provider => ({ id: provider.provider_id, kind: provider.provider_kind, status: provider.status })),
      source: 'providers',
    },
    {
      family: 'voice_clone',
      state: cloneReady.length > 0 ? 'supported' : cloneCapable.length > 0 ? 'unverified' : 'missing',
      reasonCode: cloneReady.length > 0 ? 'owner_declared_configured' : cloneCapable.length > 0 ? 'clone_provider_not_configured' : 'owner_declared_no_voice_clone',
      providers: cloneCapable.slice(0, 16).map(provider => ({ id: provider.provider_id, kind: provider.provider_kind, status: provider.status })),
      source: 'providers',
    },
    {
      family: 'music',
      state: music.length === 0 ? 'missing' : musicStates.includes('supported') ? 'supported' : musicStates.includes('unverified') ? 'unverified' : 'missing',
      reasonCode: music.length === 0 ? 'owner_declared_no_providers' : musicStates.includes('supported') ? 'owner_declared_production' : musicStates.includes('unverified') ? 'music_readiness_not_production' : 'music_providers_disabled',
      // readiness 原值保留（preview/first-support 等），不把 preview 升级为 production ready。
      detail: music.length === 0 ? undefined : music.map(provider => `${provider.provider_id}:${provider.readiness}`).join(', ').slice(0, 400),
      providers: music.slice(0, 16).map(provider => ({ id: provider.provider_id, kind: provider.provider_kind, status: provider.readiness })),
      source: 'music_providers',
    },
    {
      // owner 的授权 HTTP provider 描述面（GET /api/v1/providers）当前只投影
      // TTS registry；SFX provider 描述仅存在于 CLI envelope，无 HTTP 合同。
      // 描述缺席时保留禁用入口与原因；owner 若未来在该响应中描述 sfx
      // provider，则按同一 owner 事实推导，不在插件内编造 SFX 能力。
      family: 'sfx',
      state: sfx.length === 0 ? 'missing' : sfx.some(provider => provider.configured) ? 'supported' : 'unverified',
      reasonCode: sfx.length === 0 ? 'owner_http_provider_description_absent' : sfx.some(provider => provider.configured) ? 'owner_declared_configured' : 'provider_not_configured',
      detail: sfx.length === 0 ? undefined : sfx.map(provider => `${provider.provider_id}:${provider.status}`).join(', ').slice(0, 400),
      providers: sfx.slice(0, 16).map(provider => ({ id: provider.provider_id, kind: provider.provider_kind, status: provider.status })),
      source: 'providers',
    },
    {
      family: 'transcription',
      state: profiles.length === 0 ? 'missing' : realProfiles.length > 0 ? 'supported' : 'unverified',
      reasonCode: profiles.length === 0 ? 'no_transcription_profiles' : realProfiles.length > 0 ? 'owner_declared_configured' : 'fixture_only_catalog',
      detail: transcription?.diagnostics_available === true ? undefined : 'diagnostics_unavailable',
      providers: profiles.slice(0, 16).map(profile => ({ id: profile.provider_id, status: profile.fixture ? 'fixture' : profile.readiness })),
      source: 'transcription_catalog',
    },
    {
      family: 'word_alignment',
      state: realWordProfiles.length > 0 ? 'supported' : wordProfiles.length > 0 ? 'unverified' : 'missing',
      reasonCode: realWordProfiles.length > 0 ? 'owner_declared_word_timestamps' : wordProfiles.length > 0 ? 'fixture_word_timestamps_only' : 'segment_to_cue_only',
      // segment-to-cue 不等于 word-level：无词级声明时显式标注边界，不均分伪造。
      detail: realWordProfiles.length > 0 || wordProfiles.length > 0 ? undefined : 'segment_to_cue_boundary',
      providers: wordProfiles.slice(0, 16).map(profile => ({ id: profile.provider_id, status: profile.fixture ? 'fixture' : profile.readiness })),
      source: 'transcription_catalog',
    },
    {
      // 1.1 owner 合同核对（2026-09-11，subtitle.go digest b1ebf7651f74ffa7）：
      // SRT/VTT 导出已交付。标注来源为合同核对而非实时探测。
      family: 'subtitle_export',
      state: 'supported',
      reasonCode: 'owner_contract_srt_vtt',
      detail: 'formats:srt,vtt',
      providers: [],
      source: 'contract_audit',
    },
  ]
  return { schemaVersion: 'sonora.capability_matrix.v1', entries }
}

/** 读取 owner provider/music 描述端点并推导矩阵；转写目录由调用方注入（复用既有读取）。 */
export class SonoraCapabilityMatrixClient {
  constructor(
    private readonly connection: (context: CreatorStudioContextV1) => Promise<SonoraCapabilityConnection | undefined>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async read(context: CreatorStudioContextV1, transcription: SonoraTranscriptionCatalog | undefined): Promise<SonoraCapabilityMatrixResult> {
    const providers = await this.fetchJson(context, '/api/v1/providers', sonoraProvidersResponseSchema)
    if (providers.status === 'ready') {
      const music = await this.fetchJson(context, '/api/v1/music/providers', sonoraMusicProvidersResponseSchema)
      if (music.status === 'ready') {
        return { status: 'ready', resource: deriveSonoraCapabilityMatrix({ providers: providers.resource.providers, musicProviders: music.resource.providers, ...(transcription === undefined ? {} : { transcription }) }) }
      }
      // music 描述读取失败时保留 speech/转写事实并让 music 家族走缺失路径？不：
      // 矩阵整体保持一次一致读取——失败即诚实 unknown，避免半新半旧矩阵。
      return { status: music.status, reason: music.reason }
    }
    return { status: providers.status, reason: providers.reason }
  }

  private async fetchJson<T>(context: CreatorStudioContextV1, path: string, schema: z.ZodType<T>): Promise<{ status: 'ready'; resource: T } | { status: 'rejected' | 'unknown'; reason: 'invalid_input' | 'unavailable' | 'permission_denied' | 'not_found' | 'owner_rejected' | 'unconfirmed' }> {
    const scope = { ...context }
    try {
      const binding = await this.connection(scope)
      if (binding === undefined) return { status: 'rejected', reason: 'unavailable' }
      if (CONTEXT_KEYS.some(key => binding.context[key] !== scope[key]) || scope.projectRef === undefined) return { status: 'rejected', reason: 'permission_denied' }
      const url = new URL(binding.baseURL)
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['https:', 'http:'].includes(url.protocol)) return { status: 'rejected', reason: 'unavailable' }
      if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return { status: 'rejected', reason: 'unavailable' }
      const headers = new Headers(binding.headers)
      headers.set('Accept', 'application/json')
      const response = await this.fetcher(new URL(path, url), { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(15_000) })
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => {})
        if (response.status === 401 || response.status === 403) return { status: 'rejected', reason: 'permission_denied' }
        if (response.status === 404) return { status: 'rejected', reason: 'not_found' }
        if (response.status === 400 || response.status === 422) return { status: 'rejected', reason: 'owner_rejected' }
        return { status: 'unknown', reason: 'unconfirmed' }
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength > 256 * 1024) return { status: 'unknown', reason: 'unconfirmed' }
      const parsed = schema.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
      return parsed.success ? { status: 'ready', resource: parsed.data } : { status: 'unknown', reason: 'unconfirmed' }
    } catch {
      return { status: 'unknown', reason: 'unconfirmed' }
    }
  }
}

export function validateSonoraCapabilityMatrix(value: unknown): SonoraCapabilityMatrix | undefined {
  const schema = z.object({
    schemaVersion: z.literal('sonora.capability_matrix.v1'),
    entries: z.array(z.object({
      family: z.enum(SONORA_CAPABILITY_FAMILIES),
      state: z.enum(['supported', 'unverified', 'missing']),
      reasonCode: z.string().min(1).max(120),
      detail: z.string().max(400).optional(),
      providers: z.array(z.object({ id: identifier, kind: identifier.optional(), status: z.string().min(1).max(64) }).strict()).max(16),
      source: z.enum(['providers', 'music_providers', 'transcription_catalog', 'contract_audit']),
    }).strict()).length(SONORA_CAPABILITY_FAMILIES.length),
  }).strict()
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

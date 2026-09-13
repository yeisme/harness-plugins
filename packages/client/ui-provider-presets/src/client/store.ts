/**
 * 渠道目录快照 store：一次 load 折叠 `settings.describe`（user 层 + revision）、
 * `llm.listProviders`/`llm.listConfigurableProviders` 与逐 route 的凭证状态，
 * 供渠道市场总览与 route 冲突检测消费。快照只读、替换式更新；
 * `useSyncExternalStore` 直接订阅。
 *
 * 投影纪律：凭证状态只有 `CredentialInfo` 事实（configured/writable/source），
 * 永不含值；模型目录来自 user 层 profile（declared route），catalog route 的
 * 模型枚举归上游 Models 页。
 *
 * @module @yeisme/dsh-client-ui-provider-presets/client/store
 */

import type { CredentialInfoView } from './wire.ts'
import type { ProviderPresetsOperations } from './operations.ts'
import { DEFAULT_MODEL_NS, LLM_SETTINGS_NS } from './operations.ts'

/** 总览一行：一个 route 的目录 + live + 默认 + 凭证事实。 */
export interface DirectoryRow {
  readonly provider: string
  readonly displayName: string
  readonly settingsNs: string
  readonly live: boolean
  /** 适配器声明该 route 只因配置存在（用户添加的网关），区别于 catalog route。 */
  readonly declared: boolean
  readonly isDefault: boolean
  /** 该 route user 层 profile 列出的模型 id（catalog route 恒为空）。 */
  readonly models: readonly string[]
  readonly credentialRef?: string
  readonly credentialConfigured?: boolean
}

/** 快照状态。 */
export interface ProviderPresetsSnapshot {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly message?: string
  readonly rows: readonly DirectoryRow[]
  /** user 层已存在的 route key（冲突检测用）。 */
  readonly routeKeys: ReadonlySet<string>
  /** `agent-default-model` user 层当前值（未设置则 undefined）。 */
  readonly defaultSelection: { readonly provider: string; readonly model: string } | undefined
  /** 按 namespace 记住的 revision（写入围栏用）。 */
  readonly revisions: Readonly<Record<string, number>>
}

const EMPTY_SNAPSHOT: ProviderPresetsSnapshot = {
  status: 'idle',
  rows: [],
  routeKeys: new Set<string>(),
  defaultSelection: undefined,
  revisions: {},
}

/** user 层 profile 的最小读取面（llm-pi-ai.providers.<route>）。 */
interface UserProfile {
  readonly displayName?: unknown
  readonly apiKeyEnv?: unknown
  readonly models?: readonly unknown[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 读取 namespace user 层的 providers 字典（缺省空字典）。 */
export function readUserProviders(userSection: unknown): Readonly<Record<string, UserProfile>> {
  if (!isRecord(userSection)) return {}
  const providers = userSection.providers
  if (!isRecord(providers)) return {}
  const out: Record<string, UserProfile> = {}
  for (const [route, profile] of Object.entries(providers)) {
    if (!isRecord(profile)) continue
    out[route] = {
      displayName: profile.displayName,
      apiKeyEnv: profile.apiKeyEnv,
      models: Array.isArray(profile.models) ? profile.models : [],
    }
  }
  return out
}

/** 读取 `agent-default-model` user 层。 */
export function readDefaultSelection(userSection: unknown): { provider: string; model: string } | undefined {
  if (!isRecord(userSection)) return undefined
  const { provider, model } = userSection
  if (typeof provider !== 'string' || provider.length === 0) return undefined
  if (typeof model !== 'string' || model.length === 0) return undefined
  return { provider, model }
}

/**
 * 目录快照控制器。
 */
export class ProviderPresetsStore {
  private snapshot: ProviderPresetsSnapshot = EMPTY_SNAPSHOT
  private readonly listeners = new Set<() => void>()
  private loadSeq = 0

  constructor(private readonly operations: ProviderPresetsOperations) {}

  getSnapshot = (): ProviderPresetsSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private publish(next: ProviderPresetsSnapshot): void {
    this.snapshot = next
    for (const listener of [...this.listeners]) listener()
  }

  /** 已加载过才响应失效事件（未打开的面不后台拉取）。 */
  refreshIfLoaded(): void {
    if (this.snapshot.status === 'idle') return
    void this.load()
  }

  /** 全量刷新目录快照。 */
  async load(): Promise<void> {
    const seq = ++this.loadSeq
    this.publish({ ...EMPTY_SNAPSHOT, status: 'loading' })
    const described = await this.operations.describeSettings()
    const directory = await this.operations.listDirectory()
    if (seq !== this.loadSeq) return
    if (described.kind === 'refused') {
      this.publish({ ...EMPTY_SNAPSHOT, status: 'error', message: described.message })
      return
    }
    if (directory.kind === 'refused') {
      this.publish({ ...EMPTY_SNAPSHOT, status: 'error', message: directory.message })
      return
    }
    const revisions: Record<string, number> = {}
    let piAiUser: unknown
    let defaultUser: unknown
    for (const namespace of described.value.namespaces) {
      revisions[namespace.ns] = namespace.revision
      if (namespace.ns === LLM_SETTINGS_NS) piAiUser = namespace.user
      if (namespace.ns === DEFAULT_MODEL_NS) defaultUser = namespace.user
    }
    const profiles = readUserProviders(piAiUser)
    const defaultSelection = readDefaultSelection(defaultUser)
    const refs = [...new Set(Object.values(profiles).map(profile =>
      typeof profile.apiKeyEnv === 'string' ? profile.apiKeyEnv : undefined,
    ).filter((ref): ref is string => ref !== undefined))]
    const credentials = refs.length > 0 ? await this.describeCredentials(refs) : {}
    const liveIds = new Set(directory.value.live.map(provider => provider.id))
    const modelsOf = (profile: UserProfile | undefined): string[] => (profile?.models ?? [])
      .map(model => isRecord(model) && typeof model.id === 'string' ? model.id : undefined)
      .filter((id): id is string => id !== undefined)
    const credentialsOf = (profile: UserProfile | undefined): { credentialRef: string; credentialConfigured: boolean } | undefined => {
      if (profile === undefined || typeof profile.apiKeyEnv !== 'string') return undefined
      const info = credentials[profile.apiKeyEnv]
      return info === undefined
        ? { credentialRef: profile.apiKeyEnv, credentialConfigured: false }
        : { credentialRef: profile.apiKeyEnv, credentialConfigured: info.configured }
    }
    const rows: DirectoryRow[] = directory.value.directory.map(entry => {
      const profile = profiles[entry.provider]
      return {
        provider: entry.provider,
        displayName: entry.displayName,
        settingsNs: entry.settingsNs,
        live: liveIds.has(entry.provider),
        declared: entry.declared === true || profile !== undefined,
        isDefault: defaultSelection?.provider === entry.provider,
        models: modelsOf(profile),
        ...credentialsOf(profile) ?? {},
      }
    })
    // user 层有、目录尚未列出的 route（快照与目录的短暂错位以 user 层为准补齐）。
    for (const [route, profile] of Object.entries(profiles)) {
      if (rows.some(row => row.provider === route)) continue
      const displayName = typeof profile.displayName === 'string' && profile.displayName.length > 0
        ? profile.displayName
        : route
      rows.push({
        provider: route,
        displayName,
        settingsNs: LLM_SETTINGS_NS,
        live: liveIds.has(route),
        declared: true,
        isDefault: defaultSelection?.provider === route,
        models: modelsOf(profile),
        ...credentialsOf(profile) ?? {},
      })
    }
    rows.sort((a, b) => a.provider.localeCompare(b.provider))
    this.publish({
      status: 'ready',
      rows,
      routeKeys: new Set(rows.map(row => row.provider)),
      defaultSelection,
      revisions,
    })
  }

  private async describeCredentials(refs: readonly string[]): Promise<Readonly<Record<string, CredentialInfoView | undefined>>> {
    // 逐个 describe（远程面按单 ref 批量形状不承诺，v1 逐次调用足够小）。
    const out: Record<string, CredentialInfoView | undefined> = {}
    for (const ref of refs) {
      out[ref] = await this.operations.describeCredential(ref)
    }
    return out
  }
}

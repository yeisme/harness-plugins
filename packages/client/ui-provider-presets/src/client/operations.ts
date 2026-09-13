/**
 * Host 操作回调：把 `remote.settings` / `remote.credentials` / `remote.llm`
 * 三个命名空间的调用收拢为组件可注入的纯回调面（仿上游
 * ui-settings-models 的 createModelsOperations 模式——卡片收回调，不收 ctx）。
 *
 * 失败码分流在这里完成：`settings/conflict` 单独成 conflict 态（保草稿重试），
 * 其余 refusal 原样携带 host 诊断文案。
 *
 * @module @yeisme/dsh-client-ui-provider-presets/client/operations
 */

import type {
  ConfigurableProviderView,
  CredentialInfoView,
  DiscoveredModelView,
  ModelDiscoveryRequestView,
  ProviderInfoView,
  RemoteRootFace,
  SettingsDescribeSubset,
  SettingsPathOpView,
} from './wire.ts'

/** 一次 settings 写入的结果。 */
export type SettingsWriteOutcome =
  | { readonly kind: 'written'; readonly revision: number }
  | { readonly kind: 'conflict'; readonly message: string }
  | { readonly kind: 'refused'; readonly message: string }

/** 一次模型拉取的结果（含端点耗时，兼作连通性反馈）。 */
export type DiscoveryOutcome =
  | { readonly kind: 'found'; readonly models: readonly DiscoveredModelView[]; readonly elapsedMs: number }
  | { readonly kind: 'refused'; readonly message: string }

/** 一次目录/设置读取的结果。 */
export type ReadOutcome<T> =
  | { readonly kind: 'ready'; readonly value: T }
  | { readonly kind: 'refused'; readonly message: string }

/** 组件消费的 Host 操作面。 */
export interface ProviderPresetsOperations {
  /** 读取全部 namespace 视图（含 user 层与 revision）。 */
  describeSettings(): Promise<ReadOutcome<SettingsDescribeSubset>>
  /** 读取 live routes 与可配置目录。 */
  listDirectory(): Promise<ReadOutcome<{ readonly live: readonly ProviderInfoView[]; readonly directory: readonly ConfigurableProviderView[] }>>
  /** 读取一个凭证引用的状态（永不含值）。 */
  describeCredential(ref: string): Promise<CredentialInfoView | undefined>
  /** 存入一个凭证字面量（明文只进 host）。 */
  storeCredential(ref: string, value: string): Promise<string | undefined>
  /** 应用路径编辑到一个 namespace。 */
  writeSettings(ns: string, ops: readonly SettingsPathOpView[], expectedRevision: number | undefined): Promise<SettingsWriteOutcome>
  /** 向端点询问模型列表（连通性 + 候选）。 */
  discoverModels(request: ModelDiscoveryRequestView): Promise<DiscoveryOutcome>
}

/** 目标 settings namespace：pi-ai 适配器家族。 */
export const LLM_SETTINGS_NS = 'llm-pi-ai'
/** 默认模型选择 namespace。 */
export const DEFAULT_MODEL_NS = 'agent-default-model'

/**
 * 由 remote 根面绑定操作回调。三个子命名空间任一缺失时返回 undefined——
 * 调用方（注册面）据此走诚实降级，不构造半残操作面。
 * @param remote - 探针已确认可用的 remote 根面。
 * @returns 完整操作面，或缺失时 undefined。
 */
export function createProviderPresetsOperations(remote: RemoteRootFace): ProviderPresetsOperations | undefined {
  const { settings, credentials, llm } = remote
  if (settings === undefined || credentials === undefined || llm === undefined) return undefined
  return {
    describeSettings: async () => {
      const response = await settings.describe()
      return response.ok ? { kind: 'ready', value: response.value } : { kind: 'refused', message: response.error.message }
    },
    listDirectory: async () => {
      const live = await llm.listProviders()
      const directory = await llm.listConfigurableProviders()
      if (!live.ok) return { kind: 'refused', message: live.error.message }
      if (!directory.ok) return { kind: 'refused', message: directory.error.message }
      return { kind: 'ready', value: { live: live.value, directory: directory.value } }
    },
    describeCredential: async ref => {
      const response = await credentials.describe([ref])
      return response.ok ? response.value[ref] : undefined
    },
    storeCredential: async (ref, value) => {
      const response = await credentials.set(ref, value)
      return response.ok ? undefined : response.error.message
    },
    writeSettings: async (ns, ops, expectedRevision) => {
      const response = await settings.mutate(ns, ops, expectedRevision)
      if (response.ok) return { kind: 'written', revision: response.value.revision }
      const { code, message } = response.error
      return code === 'settings/conflict' ? { kind: 'conflict', message } : { kind: 'refused', message }
    },
    discoverModels: async request => {
      const startedAt = Date.now()
      const response = await llm.discoverModels(LLM_SETTINGS_NS, request)
      const elapsedMs = Date.now() - startedAt
      return response.ok
        ? { kind: 'found', models: response.value, elapsedMs }
        : { kind: 'refused', message: response.error.message }
    },
  }
}

/**
 * 本地结构化 wire 类型：镜像 0.1.2-rc.1 `@deepseek-ai/dsh-api-remotes/client`
 * 暴露面中本插件消费的子集（字段名一一对应，见 openspec
 * dsh-provider-presets-v1 design.md §2）。
 *
 * 仓内 devDep 面 pin 在发布版 0.1.0-rc.6，而 `remote.settings.mutate`、
 * `remote.credentials.set`、`remote.llm.discoverModels` 与
 * `settings.models.footer` slot 只在 0.1.2-rc.1 出现；直接依赖新版类型包会与
 * rc.6 runtime 的 Context 合并冲突，因此以本地类型镜像 + 运行时结构访问，
 * 不引入上游类型依赖。类型失配表现为运行时拒绝，UI 如实展示 host 诊断。
 *
 * @module @yeisme/dsh-client-ui-provider-presets/client/wire
 */

/** `RemoteResult<T>`（dsh-typert-protocol）：成功携带值，失败携带错误码与诊断。 */
export type RemoteResultView<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code?: string; readonly message: string } }

/** `CredentialInfo`（dsh-credentials/types）：引用的来源与可写事实，永不含值。 */
export interface CredentialInfoView {
  readonly configured: boolean
  readonly source?: string
  readonly writable: boolean
}

/** `LlmDiscoveredModel`（dsh-llm/types）：一次模型列表拉取的候选。 */
export interface DiscoveredModelView {
  readonly id: string
  readonly name?: string
  readonly contextWindow?: number
  readonly maxTokens?: number
}

/** `LlmModelDiscoveryRequest`（dsh-llm/types）：草稿态的端点事实。 */
export interface ModelDiscoveryRequestView {
  readonly provider?: string
  readonly baseURL?: string
  readonly api?: string
  readonly apiKey?: string
}

/** `LlmProviderInfo`（dsh-llm/types）：已注册的 live route。 */
export interface ProviderInfoView {
  readonly id: string
  readonly name: string
}

/** `LlmConfigurableProvider`（dsh-llm/types）：目录中可配置的 route（含未激活）。 */
export interface ConfigurableProviderView {
  readonly provider: string
  readonly displayName: string
  readonly settingsNs: string
  readonly settingsPath: readonly string[]
  readonly declared?: boolean
}

/** `SettingsNamespaceView`（dsh-settings/types）中本插件读取的子集。 */
export interface NamespaceViewSubset {
  readonly ns: string
  readonly user?: unknown
  readonly revision: number
}

/** `SettingsDescribeValue`（dsh-settings/types）中本插件读取的子集。 */
export interface SettingsDescribeSubset {
  readonly writable: boolean
  readonly hasDocument: boolean
  readonly namespaces: readonly NamespaceViewSubset[]
}

/** `SettingsPathOpView`（dsh-settings/types）：一条路径寻址的编辑。 */
export type SettingsPathOpView =
  | { readonly op: 'set'; readonly path: readonly string[]; readonly value: unknown }
  | { readonly op: 'unset'; readonly path: readonly string[] }

/** 本插件消费的 `remote.settings` 命名空间面（0.1.2-rc.1）。 */
export interface SettingsRemoteFace {
  describe(): Promise<RemoteResultView<SettingsDescribeSubset>>
  mutate(ns: string, ops: readonly SettingsPathOpView[], expectedRevision: number | undefined): Promise<RemoteResultView<NamespaceViewSubset>>
}

/** 本插件消费的 `remote.credentials` 命名空间面（0.1.2-rc.1）。 */
export interface CredentialsRemoteFace {
  describe(refs: readonly string[]): Promise<RemoteResultView<Readonly<Record<string, CredentialInfoView | undefined>>>>
  set(ref: string, value: string): Promise<RemoteResultView<unknown>>
  unset(ref: string): Promise<RemoteResultView<unknown>>
}

/** 本插件消费的 `remote.llm` 命名空间面（0.1.2-rc.1）。 */
export interface LlmRemoteFace {
  discoverModels(settingsNs: string, request: ModelDiscoveryRequestView): Promise<RemoteResultView<readonly DiscoveredModelView[]>>
  listProviders(): Promise<RemoteResultView<readonly ProviderInfoView[]>>
  listConfigurableProviders(): Promise<RemoteResultView<readonly ConfigurableProviderView[]>>
}

/** `remote` 根面上本插件使用的成员：事件订阅与子命名空间访问。 */
export interface RemoteRootFace {
  readonly settings?: SettingsRemoteFace
  readonly credentials?: CredentialsRemoteFace
  readonly llm?: LlmRemoteFace
  $on(event: 'settings/document-updated' | 'credentials/reference-updated' | 'llm/adapters-updated', listener: () => void): () => void
}

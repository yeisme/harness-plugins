/**
 * 引导添加的草稿校验与写入载荷生成（纯函数，组件与测试共用）。
 *
 * profile 字段省略规则：模型容量（contextWindow/maxTokens）未披露即整个省略，
 * 由 route 级 `defaultContextWindow`/`defaultMaxTokens` 兜底（llm-pi-ai
 * config.ts 的显式 resolve 语义）；`name` 仅在存在时写入。
 *
 * @module @yeisme/dsh-client-ui-provider-presets/client/draft
 */

import type { DiscoveredModelView, SettingsPathOpView } from './wire.ts'
import { LLM_SETTINGS_NS, DEFAULT_MODEL_NS } from './operations.ts'
import { isPosixEnvName, isRouteKey } from './presets.ts'

/** 引导表单的草稿态（不含 API key——key 只在提交时单程传递）。 */
export interface ProviderDraft {
  readonly displayName: string
  readonly route: string
  readonly apiProtocol: string
  readonly baseURL: string
  readonly credentialRef: string
  readonly defaultInput?: readonly string[]
}

/** 草稿校验失败的字段码（组件映射为文案）。 */
export type DraftFieldError =
  | 'routeInvalid'
  | 'routeConflict'
  | 'refInvalid'
  | 'baseURLRequired'
  | 'noneSelected'

/** 逐项校验；返回首个失败（表单逐字段提示足够）。 */
export function validateDraft(draft: ProviderDraft, existingRoutes: ReadonlySet<string>): DraftFieldError | undefined {
  if (!isRouteKey(draft.route)) return 'routeInvalid'
  if (existingRoutes.has(draft.route)) return 'routeConflict'
  if (!isPosixEnvName(draft.credentialRef)) return 'refInvalid'
  if (draft.baseURL.trim().length === 0) return 'baseURLRequired'
  return undefined
}

/** 生成 `llm-pi-ai.providers.<route>` 的 profile 值（省略空字段）。 */
export function buildProviderProfile(
  draft: ProviderDraft,
  models: readonly DiscoveredModelView[],
): Record<string, unknown> {
  const profile: Record<string, unknown> = {
    displayName: draft.displayName.trim().length > 0 ? draft.displayName.trim() : draft.route,
    apiKeyEnv: draft.credentialRef,
    api: draft.apiProtocol,
    baseURL: draft.baseURL.trim(),
  }
  if (draft.defaultInput !== undefined && draft.defaultInput.length > 0) {
    profile.defaultInput = [...draft.defaultInput]
  }
  profile.models = models.map(model => ({
    id: model.id,
    ...model.name === undefined ? {} : { name: model.name },
    ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
    ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
  }))
  return profile
}

/** 渠道保存的 path ops（一条 set，经 `assertServiceable` 校验）。 */
export function buildSaveOps(route: string, profile: Record<string, unknown>): readonly SettingsPathOpView[] {
  return [{ op: 'set', path: ['providers', route], value: profile }]
}

/** 设为默认的 path ops（空 path 寻址 section 根，整段替换）。 */
export function buildSetDefaultOps(provider: string, model: string): readonly SettingsPathOpView[] {
  return [{ op: 'set', path: [], value: { provider, model } }]
}

/** 保存流涉及的 namespace 常量重导出（组件引用单点）。 */
export { DEFAULT_MODEL_NS, LLM_SETTINGS_NS }

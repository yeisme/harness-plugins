/**
 * 渠道预设目录：cc-switch 式「30 秒接入一个渠道」的静态数据与契约校验。
 *
 * 每条预设是用户可选的任务入口（官方端点 + 协议 + 建议 route key/credential
 * ref 名），不是 host→client 投影；端点字面量经 safe-projection 观测门
 * owner 复核豁免登记（dsh-provider-presets-v1 design.md §4）。
 *
 * 建议 route key 刻意避开 pi-ai 内置 catalog 目录名（deepseek、openrouter、
 * moonshotai、zai、qwen-token-plan…），避免与目录 route 的配置路径混淆——
 * 本插件的添加流只创建 declared route，目录 route 的配置归上游 Models 页。
 *
 * @module @yeisme/dsh-client-ui-provider-presets/client/presets
 */

import type { DiscoveredModelView } from './wire.ts'

/** pi-ai 配置面可命名的协议全集（llm-pi-ai provider.ts PROTOCOLS）。 */
export const CONFIGURABLE_PROTOCOLS: readonly string[] = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
]

/** `discoverModels` 能读模型列表的协议（llm-pi-ai discovery.ts LISTABLE_PROTOCOLS）。 */
export const LISTABLE_PROTOCOLS: readonly string[] = ['openai-completions', 'openai-responses']

/** 双语文案值。 */
export interface Bilingual {
  readonly zh: string
  readonly en: string
}

/** 一条渠道预设。 */
export interface ProviderPreset {
  /** 稳定 id（目录内唯一，kebab-case）。 */
  readonly id: string
  readonly displayName: Bilingual
  /** 该渠道端点说的协议（`CONFIGURABLE_PROTOCOLS` 之一）。 */
  readonly apiProtocol: string
  /** 渠道官方端点；自定义卡为空串，由用户填写。 */
  readonly baseURL: string
  /** 建议 route key（`llm-pi-ai.providers` 字典键）。 */
  readonly suggestedRoute: string
  /** 建议凭证引用名（POSIX 环境变量名）。 */
  readonly suggestedCredentialRef: string
  /** 非 listable 协议（anthropic-messages）的种子模型，可被手填增改。 */
  readonly modelsSeed?: readonly DiscoveredModelView[]
  /** 请求模态声明（如 GLM 多模态渠道 `[text, image]`）；缺省走 route 默认 text-only。 */
  readonly defaultInput?: readonly string[]
  readonly note?: Bilingual
}

/** v1 渠道目录（顺序即展示顺序）。 */
export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: 'zhipu-glm-claude',
    displayName: { zh: '智谱 GLM（Anthropic 协议）', en: 'Zhipu GLM (Anthropic protocol)' },
    apiProtocol: 'anthropic-messages',
    baseURL: 'https://open.bigmodel.cn/api/anthropic',
    suggestedRoute: 'zhipu-glm-claude',
    suggestedCredentialRef: 'GLM_API_KEY',
    defaultInput: ['text', 'image'],
    modelsSeed: [
      { id: 'glm-5.3', name: 'GLM-5.3 (1M)', contextWindow: 1_000_000, maxTokens: 131_072 },
      { id: 'glm-5.3-flash', name: 'GLM-5.3 Flash (1M)', contextWindow: 1_000_000, maxTokens: 131_072 },
    ],
    note: {
      zh: '该协议无自动模型列表，已预置常用模型，可手填增改。',
      en: 'This protocol has no auto model listing; common models are seeded and editable by hand.',
    },
  },
  {
    id: 'zhipu-glm-openai',
    displayName: { zh: '智谱 GLM（OpenAI 协议）', en: 'Zhipu GLM (OpenAI protocol)' },
    apiProtocol: 'openai-completions',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    suggestedRoute: 'zhipu-glm-openai',
    suggestedCredentialRef: 'GLM_API_KEY',
  },
  {
    id: 'moonshot-kimi',
    displayName: { zh: 'Moonshot Kimi', en: 'Moonshot Kimi' },
    apiProtocol: 'openai-completions',
    baseURL: 'https://api.moonshot.cn/v1',
    suggestedRoute: 'moonshot-kimi',
    suggestedCredentialRef: 'KIMI_API_KEY',
  },
  {
    id: 'siliconflow',
    displayName: { zh: '硅基流动 SiliconFlow', en: 'SiliconFlow' },
    apiProtocol: 'openai-completions',
    baseURL: 'https://api.siliconflow.cn/v1',
    suggestedRoute: 'siliconflow',
    suggestedCredentialRef: 'SILICONFLOW_API_KEY',
  },
  {
    id: 'openrouter-api',
    displayName: { zh: 'OpenRouter', en: 'OpenRouter' },
    apiProtocol: 'openai-completions',
    baseURL: 'https://openrouter.ai/api/v1',
    suggestedRoute: 'openrouter-api',
    suggestedCredentialRef: 'OPENROUTER_API_KEY',
  },
  {
    id: 'qwen-dashscope',
    displayName: { zh: '阿里云百炼 Qwen', en: 'Alibaba DashScope Qwen' },
    apiProtocol: 'openai-completions',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    suggestedRoute: 'qwen-dashscope',
    suggestedCredentialRef: 'DASHSCOPE_API_KEY',
  },
  {
    id: 'modelscope',
    displayName: { zh: '魔搭 ModelScope', en: 'ModelScope' },
    apiProtocol: 'openai-completions',
    baseURL: 'https://api-inference.modelscope.cn/v1',
    suggestedRoute: 'modelscope',
    suggestedCredentialRef: 'MODELSCOPE_API_KEY',
  },
  {
    id: 'ark-volcengine',
    displayName: { zh: '火山方舟 Volcengine Ark', en: 'Volcengine Ark' },
    apiProtocol: 'openai-completions',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    suggestedRoute: 'ark-volcengine',
    suggestedCredentialRef: 'ARK_API_KEY',
  },
  {
    id: 'deepseek-api',
    displayName: { zh: 'DeepSeek 官方（OpenAI 协议）', en: 'DeepSeek official (OpenAI protocol)' },
    apiProtocol: 'openai-completions',
    baseURL: 'https://api.deepseek.com/v1',
    suggestedRoute: 'deepseek-api',
    suggestedCredentialRef: 'DEEPSEEK_API_KEY',
    note: {
      zh: '与原生 DeepSeek 渠道共用同一把官方 key；原生渠道的编辑在上方 DeepSeek 卡片。',
      en: 'Shares the official key with the native DeepSeek channel; the native channel edits in the DeepSeek card above.',
    },
  },
  {
    id: 'custom-openai',
    displayName: { zh: '自定义 OpenAI 兼容', en: 'Custom OpenAI-compatible' },
    apiProtocol: 'openai-completions',
    baseURL: '',
    suggestedRoute: 'custom-openai',
    suggestedCredentialRef: 'CUSTOM_API_KEY',
  },
]

/** POSIX 环境变量名（credential ref 名）校验。 */
export function isPosixEnvName(value: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(value)
}

/** route key 校验：非空 kebab-case（与 pi-ai providers 字典键约束一致的非空、非空白）。 */
export function isRouteKey(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(value)
}

/** 预设目录契约校验：id/route 唯一、协议合法、ref 名 POSIX、种子容量齐全。返回违规清单。 */
export function presetCatalogViolations(presets: readonly ProviderPreset[]): readonly string[] {
  const violations: string[] = []
  const ids = new Set<string>()
  const routes = new Set<string>()
  for (const preset of presets) {
    if (ids.has(preset.id)) violations.push(`duplicate preset id "${preset.id}"`)
    ids.add(preset.id)
    if (routes.has(preset.suggestedRoute)) violations.push(`duplicate suggested route "${preset.suggestedRoute}"`)
    routes.add(preset.suggestedRoute)
    if (!CONFIGURABLE_PROTOCOLS.includes(preset.apiProtocol)) {
      violations.push(`preset "${preset.id}" names unknown protocol "${preset.apiProtocol}"`)
    }
    if (preset.id === 'custom-openai') continue
    if (preset.baseURL.length === 0) violations.push(`preset "${preset.id}" has an empty baseURL`)
    if (!/^https:\/\/[\w.-]+\/[\w./-]*$/.test(preset.baseURL)) {
      violations.push(`preset "${preset.id}" baseURL is not an https endpoint`)
    }
    if (!isPosixEnvName(preset.suggestedCredentialRef)) {
      violations.push(`preset "${preset.id}" credential ref "${preset.suggestedCredentialRef}" is not a POSIX name`)
    }
    for (const model of preset.modelsSeed ?? []) {
      if (model.contextWindow === undefined || model.maxTokens === undefined) {
        violations.push(`preset "${preset.id}" seed model "${model.id}" lacks capacities`)
      }
    }
  }
  return violations
}

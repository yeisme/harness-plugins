import { describe, expect, it } from 'vitest'
import {
  CONFIGURABLE_PROTOCOLS,
  LISTABLE_PROTOCOLS,
  PROVIDER_PRESETS,
  isPosixEnvName,
  isRouteKey,
  presetCatalogViolations,
} from '../src/client/presets.ts'

/** pi-ai 0.84.x 内置 catalog route（建议 route key 必须避开，见 presets.ts 注释）。 */
const PI_AI_CATALOG_ROS = [
  'amazon-bedrock', 'ant-ling', 'anthropic', 'azure-openai-responses', 'baseten', 'cerebras',
  'cloudflare-ai-gateway', 'cloudflare-workers-ai', 'deepseek', 'fireworks', 'github-copilot',
  'google', 'google-vertex', 'groq', 'huggingface', 'kimi-coding', 'minimax', 'minimax-cn',
  'mistral', 'moonshotai', 'moonshotai-cn', 'nvidia', 'openai', 'openai-codex', 'opencode',
  'opencode-go', 'openrouter', 'qwen-token-plan', 'together', 'vercel-ai-gateway', 'xai',
  'xiaomi', 'zai', 'zai-coding-cn',
] as const

describe('provider preset catalog contract', () => {
  it('目录契约零违规', () => {
    expect(presetCatalogViolations(PROVIDER_PRESETS)).toEqual([])
  })

  it('建议 route key 避开 pi-ai 内置 catalog 目录名', () => {
    const catalog = new Set<string>(PI_AI_CATALOG_ROS)
    for (const preset of PROVIDER_PRESETS) {
      expect(catalog.has(preset.suggestedRoute), preset.suggestedRoute).toBe(false)
    }
  })

  it('listable 协议预设不带种子（拉取路径可用），非 listable 协议必须带种子', () => {
    for (const preset of PROVIDER_PRESETS) {
      if (preset.id === 'custom-openai') continue
      if (LISTABLE_PROTOCOLS.includes(preset.apiProtocol)) {
        expect(preset.modelsSeed, preset.id).toBeUndefined()
      } else {
        expect(preset.modelsSeed?.length ?? 0, preset.id).toBeGreaterThan(0)
      }
    }
  })

  it('defaultInput 只声明合法模态', () => {
    for (const preset of PROVIDER_PRESETS) {
      for (const modality of preset.defaultInput ?? []) {
        expect(['text', 'image']).toContain(modality)
      }
    }
  })

  it('自定义空白卡存在且无端点', () => {
    const custom = PROVIDER_PRESETS.find(preset => preset.id === 'custom-openai')
    expect(custom).toBeDefined()
    expect(custom?.baseURL).toBe('')
  })
})

describe('命名校验纯函数', () => {
  it('POSIX 环境变量名', () => {
    expect(isPosixEnvName('GLM_API_KEY')).toBe(true)
    expect(isPosixEnvName('A')).toBe(true)
    expect(isPosixEnvName('_X')).toBe(true)
    expect(isPosixEnvName('3API_KEY')).toBe(false)
    expect(isPosixEnvName('glm-api')).toBe(false)
    expect(isPosixEnvName('')).toBe(false)
  })

  it('route key 为 kebab-case', () => {
    expect(isRouteKey('zhipu-glm-claude')).toBe(true)
    expect(isRouteKey('a')).toBe(true)
    expect(isRouteKey('Bad-Route')).toBe(false)
    expect(isRouteKey('-lead')).toBe(false)
    expect(isRouteKey('')).toBe(false)
  })

  it('CONFIGURABLE_PROTOCOLS 与上游 llm-pi-ai PROTOCOLS 一致', () => {
    expect(CONFIGURABLE_PROTOCOLS).toEqual(['openai-completions', 'openai-responses', 'anthropic-messages'])
  })
})

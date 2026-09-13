import { describe, expect, it } from 'vitest'
import { buildProviderProfile, buildSaveOps, buildSetDefaultOps, validateDraft } from '../src/client/draft.ts'
import type { ProviderDraft } from '../src/client/draft.ts'

const draft: ProviderDraft = {
  displayName: 'GLM',
  route: 'zhipu-glm-claude',
  apiProtocol: 'anthropic-messages',
  baseURL: 'https://open.bigmodel.cn/api/anthropic',
  credentialRef: 'GLM_API_KEY',
}

describe('validateDraft', () => {
  const empty: ReadonlySet<string> = new Set()

  it('合法草稿通过', () => {
    expect(validateDraft(draft, empty)).toBeUndefined()
  })

  it('route key 非法 / 冲突分别报 routeInvalid / routeConflict', () => {
    expect(validateDraft({ ...draft, route: 'Bad' }, empty)).toBe('routeInvalid')
    expect(validateDraft({ ...draft, route: 'zhipu-glm-claude' }, new Set(['zhipu-glm-claude']))).toBe('routeConflict')
  })

  it('ref 名与 baseURL 各自报错', () => {
    expect(validateDraft({ ...draft, credentialRef: 'glm-key' }, empty)).toBe('refInvalid')
    expect(validateDraft({ ...draft, baseURL: '  ' }, empty)).toBe('baseURLRequired')
  })
})

describe('buildProviderProfile', () => {
  it('容量与名称缺省时整体省略字段，defaultInput 仅在声明时写入', () => {
    const withDefault = { ...draft, defaultInput: ['text', 'image'] as const }
    const profile = buildProviderProfile(withDefault, [
      { id: 'glm-5.3', contextWindow: 1_000_000, maxTokens: 131_072 },
      { id: 'glm-5.3-flash', name: 'Flash', contextWindow: 1_000_000, maxTokens: 131_072 },
      { id: 'unknown-model' },
    ])
    expect(profile).toEqual({
      displayName: 'GLM',
      apiKeyEnv: 'GLM_API_KEY',
      api: 'anthropic-messages',
      baseURL: 'https://open.bigmodel.cn/api/anthropic',
      defaultInput: ['text', 'image'],
      models: [
        { id: 'glm-5.3', contextWindow: 1_000_000, maxTokens: 131_072 },
        { id: 'glm-5.3-flash', name: 'Flash', contextWindow: 1_000_000, maxTokens: 131_072 },
        { id: 'unknown-model' },
      ],
    })
  })

  it('displayName 空白时回退 route key（trim 语义）', () => {
    const profile = buildProviderProfile({ ...draft, displayName: '  ' }, [{ id: 'm' }])
    expect(profile.displayName).toBe('zhipu-glm-claude')
  })
})

describe('path ops', () => {
  it('渠道保存寻址 providers.<route>', () => {
    expect(buildSaveOps('kimi', { displayName: 'Kimi' })).toEqual([
      { op: 'set', path: ['providers', 'kimi'], value: { displayName: 'Kimi' } },
    ])
  })

  it('设为默认寻址 section 根（整段替换）', () => {
    expect(buildSetDefaultOps('kimi', 'kimi-k2')).toEqual([
      { op: 'set', path: [], value: { provider: 'kimi', model: 'kimi-k2' } },
    ])
  })
})

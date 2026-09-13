import { describe, expect, it } from 'vitest'
import { ProviderPresetsStore, readDefaultSelection, readUserProviders } from '../src/client/store.ts'
import type { ProviderPresetsOperations } from '../src/client/operations.ts'
import type { RemoteRootFace } from '../src/client/wire.ts'

describe('user 层读取纯函数', () => {
  it('readUserProviders 只收 record 形状的 profile', () => {
    const providers = readUserProviders({
      providers: {
        'zhipu-glm-claude': { displayName: 'GLM', apiKeyEnv: 'GLM_API_KEY', models: [{ id: 'glm-5.3' }, 'bad'] },
        broken: 'not-a-record',
        empty: {},
      },
    })
    expect(Object.keys(providers).sort()).toEqual(['empty', 'zhipu-glm-claude'])
    expect(providers['zhipu-glm-claude']?.displayName).toBe('GLM')
    expect(providers['zhipu-glm-claude']?.models).toEqual([{ id: 'glm-5.3' }, 'bad'])
  })

  it('readUserProviders 对缺省/畸形输入返回空字典', () => {
    expect(readUserProviders(undefined)).toEqual({})
    expect(readUserProviders('str')).toEqual({})
    expect(readUserProviders({ providers: [1, 2] })).toEqual({})
  })

  it('readDefaultSelection 要求 provider/model 均为非空字符串', () => {
    expect(readDefaultSelection({ provider: 'kimi', model: 'kimi-k2' })).toEqual({ provider: 'kimi', model: 'kimi-k2' })
    expect(readDefaultSelection({ provider: 'kimi' })).toBeUndefined()
    expect(readDefaultSelection({ provider: 'kimi', model: '' })).toBeUndefined()
    expect(readDefaultSelection(undefined)).toBeUndefined()
  })
})

function makeOperations(overrides: Partial<ProviderPresetsOperations> = {}): ProviderPresetsOperations {
  return {
    describeSettings: async () => ({
      kind: 'ready',
      value: {
        writable: true,
        hasDocument: true,
        namespaces: [
          {
            ns: 'llm-pi-ai',
            revision: 11,
            user: {
              providers: {
                'zhipu-glm-claude': { displayName: 'GLM', apiKeyEnv: 'GLM_API_KEY', models: [{ id: 'glm-5.3' }] },
                'user-only-route': { apiKeyEnv: 'OTHER_KEY' },
              },
            },
          },
          { ns: 'agent-default-model', revision: 3, user: { provider: 'zhipu-glm-claude', model: 'glm-5.3' } },
        ],
      },
    }),
    listDirectory: async () => ({
      kind: 'ready',
      value: {
        live: [{ id: 'zhipu-glm-claude', name: 'GLM' }],
        directory: [
          { provider: 'zhipu-glm-claude', displayName: 'GLM', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'zhipu-glm-claude'] },
          { provider: 'openrouter', displayName: 'OpenRouter', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'openrouter'], declared: false },
        ],
      },
    }),
    describeCredential: async ref => (
      ref === 'GLM_API_KEY' ? { configured: true, writable: true, source: 'file' } : { configured: false, writable: true }
    ),
    storeCredential: async () => undefined,
    writeSettings: async () => ({ kind: 'written', revision: 1 }),
    discoverModels: async () => ({ kind: 'found', models: [], elapsedMs: 0 }),
    ...overrides,
  }
}

describe('ProviderPresetsStore', () => {
  it('load 折叠目录、live、默认标记、凭证事实与 user 层补齐 route', async () => {
    const store = new ProviderPresetsStore(makeOperations())
    await store.load()
    const snapshot = store.getSnapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.rows.map(row => row.provider).sort()).toEqual(['openrouter', 'user-only-route', 'zhipu-glm-claude'])
    const glm = snapshot.rows.find(row => row.provider === 'zhipu-glm-claude')
    expect(glm).toMatchObject({ live: true, declared: true, isDefault: true, models: ['glm-5.3'], credentialConfigured: true })
    const openrouter = snapshot.rows.find(row => row.provider === 'openrouter')
    expect(openrouter).toMatchObject({ live: false, declared: false, isDefault: false, models: [] })
    const userOnly = snapshot.rows.find(row => row.provider === 'user-only-route')
    expect(userOnly).toMatchObject({ displayName: 'user-only-route', declared: true, credentialConfigured: false })
    expect(snapshot.routeKeys.has('user-only-route')).toBe(true)
    expect(snapshot.defaultSelection).toEqual({ provider: 'zhipu-glm-claude', model: 'glm-5.3' })
    expect(snapshot.revisions['llm-pi-ai']).toBe(11)
    expect(snapshot.revisions['agent-default-model']).toBe(3)
  })

  it('describe 拒绝时进入 error 态并保留 host 诊断', async () => {
    const store = new ProviderPresetsStore(makeOperations({
      describeSettings: async () => ({ kind: 'refused', message: 'no settings provider mounted' }),
    }))
    await store.load()
    const snapshot = store.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.message).toBe('no settings provider mounted')
  })

  it('listDirectory 拒绝同样进入 error 态', async () => {
    const store = new ProviderPresetsStore(makeOperations({
      listDirectory: async () => ({ kind: 'refused', message: 'llm namespace absent' }),
    }))
    await store.load()
    expect(store.getSnapshot().status).toBe('error')
  })

  it('refreshIfLoaded 未加载时不触发读取；加载后触发', async () => {
    let loads = 0
    const operations = makeOperations()
    const original = operations.describeSettings.bind(operations)
    operations.describeSettings = async () => { loads += 1; return original() }
    const store = new ProviderPresetsStore(operations)
    store.refreshIfLoaded()
    expect(loads).toBe(0)
    await store.load()
    store.refreshIfLoaded()
    // load 内部已读一次；refresh 再读一次（未 await，轮询等价断言计数 ≥2）
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(loads).toBeGreaterThanOrEqual(2)
  })

  it('订阅者收到快照变更通知', async () => {
    const store = new ProviderPresetsStore(makeOperations())
    let notified = 0
    store.subscribe(() => { notified += 1 })
    await store.load()
    expect(notified).toBeGreaterThan(0)
  })
})

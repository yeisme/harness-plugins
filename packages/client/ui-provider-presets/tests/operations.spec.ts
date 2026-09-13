import { describe, expect, it, vi } from 'vitest'
import { createProviderPresetsOperations, DEFAULT_MODEL_NS, LLM_SETTINGS_NS } from '../src/client/operations.ts'
import type { RemoteRootFace, RemoteResultView, SettingsPathOpView } from '../src/client/wire.ts'

function ok<T>(value: T): RemoteResultView<T> { return { ok: true, value } }
function refused<T>(message: string, code?: string): RemoteResultView<T> { return { ok: false, error: { code, message } } }

function remoteRoot(partial: Partial<RemoteRootFace>): RemoteRootFace {
  return {
    $on: () => () => {},
    ...partial,
  } as RemoteRootFace
}

describe('createProviderPresetsOperations', () => {
  it('任一子命名空间缺失返回 undefined（诚实降级）', () => {
    expect(createProviderPresetsOperations(remoteRoot({}))).toBeUndefined()
    expect(createProviderPresetsOperations(remoteRoot({
      settings: {} as RemoteRootFace['settings'],
      credentials: {} as RemoteRootFace['credentials'],
    }))).toBeUndefined()
  })

  it('discoverModels 成功携带端点耗时', async () => {
    let calls = 0
    const operations = createProviderPresetsOperations(remoteRoot({
      settings: { describe: async () => ok({ writable: true, hasDocument: true, namespaces: [] }), mutate: async () => refused('x') },
      credentials: { describe: async () => ok({}), set: async () => ok(undefined), unset: async () => ok(undefined) },
      llm: {
        discoverModels: async (_ns, request) => {
          calls += 1
          expect(_ns).toBe(LLM_SETTINGS_NS)
          expect(request).toEqual({ baseURL: 'https://api.example.com/v1', api: 'openai-completions', apiKey: 'k' })
          return ok([{ id: 'm1' }])
        },
        listProviders: async () => ok([]),
        listConfigurableProviders: async () => ok([]),
      },
    }))!
    const outcome = await operations.discoverModels({ baseURL: 'https://api.example.com/v1', api: 'openai-completions', apiKey: 'k' })
    expect(calls).toBe(1)
    expect(outcome.kind).toBe('found')
    if (outcome.kind === 'found') {
      expect(outcome.models).toEqual([{ id: 'm1' }])
      expect(outcome.elapsedMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('settings/conflict 单独分流为 conflict', async () => {
    const operations = createProviderPresetsOperations(remoteRoot({
      settings: {
        describe: async () => ok({ writable: true, hasDocument: true, namespaces: [] }),
        mutate: async () => refused('revision moved', 'settings/conflict'),
      },
      credentials: { describe: async () => ok({}), set: async () => ok(undefined), unset: async () => ok(undefined) },
      llm: { discoverModels: async () => ok([]), listProviders: async () => ok([]), listConfigurableProviders: async () => ok([]) },
    }))!
    const outcome = await operations.writeSettings(LLM_SETTINGS_NS, [], undefined)
    expect(outcome).toEqual({ kind: 'conflict', message: 'revision moved' })
  })

  it('写入成功携带新 revision；其它拒绝保持 host 诊断', async () => {
    const operations = createProviderPresetsOperations(remoteRoot({
      settings: {
        describe: async () => ok({ writable: true, hasDocument: true, namespaces: [] }),
        mutate: async (ns: string, _ops: readonly SettingsPathOpView[], revision: number | undefined) => {
          if (ns === DEFAULT_MODEL_NS) return ok({ ns, revision: (revision ?? 0) + 1 })
          return refused('assertServiceable refused')
        },
      },
      credentials: { describe: async () => ok({}), set: async () => ok(undefined), unset: async () => ok(undefined) },
      llm: { discoverModels: async () => ok([]), listProviders: async () => ok([]), listConfigurableProviders: async () => ok([]) },
    }))!
    expect(await operations.writeSettings(DEFAULT_MODEL_NS, [], 7)).toEqual({ kind: 'written', revision: 8 })
    expect(await operations.writeSettings(LLM_SETTINGS_NS, [], undefined)).toEqual({ kind: 'refused', message: 'assertServiceable refused' })
  })

  it('credentials.set 失败返回 host 诊断，成功返回 undefined', async () => {
    const set = vi.fn(async (_ref: string, _value: string) => ok(undefined))
    const succeeding = createProviderPresetsOperations(remoteRoot({
      settings: { describe: async () => ok({ writable: true, hasDocument: true, namespaces: [] }), mutate: async () => ok({ ns: 'x', revision: 1 }) },
      credentials: { describe: async () => ok({}), set, unset: async () => ok(undefined) },
      llm: { discoverModels: async () => ok([]), listProviders: async () => ok([]), listConfigurableProviders: async () => ok([]) },
    }))!
    expect(await succeeding.storeCredential('KIMI_API_KEY', 'v')).toBeUndefined()
    expect(set).toHaveBeenCalledWith('KIMI_API_KEY', 'v')

    const refused2 = createProviderPresetsOperations(remoteRoot({
      settings: { describe: async () => ok({ writable: true, hasDocument: true, namespaces: [] }), mutate: async () => ok({ ns: 'x', revision: 1 }) },
      credentials: { describe: async () => ok({}), set: async () => refused('not writable'), unset: async () => ok(undefined) },
      llm: { discoverModels: async () => ok([]), listProviders: async () => ok([]), listConfigurableProviders: async () => ok([]) },
    }))!
    expect(await refused2.storeCredential('KIMI_API_KEY', 'v')).toBe('not writable')
  })
})

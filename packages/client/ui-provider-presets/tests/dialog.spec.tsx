// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PresetAddDialog } from '../src/client/PresetAddDialog.tsx'
import { ProviderPresetsStore } from '../src/client/store.ts'
import type { ProviderPresetsOperations } from '../src/client/operations.ts'
import { PROVIDER_PRESETS } from '../src/client/presets.ts'
import { en, interpolate } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en, params?: Readonly<Record<string, string | number>>): string =>
  params === undefined ? en[key] : interpolate(en[key], params)

function operations(): ProviderPresetsOperations & {
  readonly log: {
    lastCredentialWrite?: [string, string]
    lastWriteNs?: string
    writeCalls: Array<[string, unknown]>
  }
} {
  const log: {
    lastCredentialWrite?: [string, string]
    lastWriteNs?: string
    writeCalls: Array<[string, unknown]>
  } = { writeCalls: [] }
  const base: ProviderPresetsOperations = {
    describeSettings: async () => ({
      kind: 'ready',
      value: {
        writable: true,
        hasDocument: true,
        namespaces: [
          { ns: 'llm-pi-ai', revision: 1, user: { providers: {} } },
          { ns: 'agent-default-model', revision: 2, user: { provider: 'kimi', model: 'kimi-k2' } },
        ],
      },
    }),
    listDirectory: async () => ({ kind: 'ready', value: { live: [], directory: [] } }),
    describeCredential: async () => ({ configured: false, writable: true }),
    storeCredential: async (ref, value) => {
      log.lastCredentialWrite = [ref, value]
      return undefined
    },
    writeSettings: async (ns, writeOps) => {
      log.writeCalls.push([ns, writeOps])
      log.lastWriteNs = ns
      return { kind: 'written', revision: 3 }
    },
    discoverModels: async () => ({ kind: 'found', models: [{ id: 'kimi-k2' }, { id: 'kimi-latest', contextWindow: 256_000, maxTokens: 8_192 }], elapsedMs: 240 }),
  }
  return Object.assign(base, { log })
}

async function harness(presetId: string, ops?: ReturnType<typeof operations>) {
  const operations0 = ops ?? operations()
  const controller = new ProviderPresetsStore(operations0)
  await controller.load()
  const preset = PROVIDER_PRESETS.find(candidate => candidate.id === presetId)!
  const saved: Array<[string, string, boolean]> = []
  const closed: boolean[] = []
  render(
    <PresetAddDialog
      preset={preset}
      operations={operations0}
      controller={controller}
      t={t}
      locale="en"
      onClose={() => { closed.push(true) }}
      onSaved={(name, route, becameDefault) => { saved.push([name, route, becameDefault]) }}
    />,
  )
  return { operations: operations0, controller, preset, saved, closed }
}

describe('PresetAddDialog', () => {
  it('listable 预设：拉取成功→勾选→保存（凭证先写、settings 后写、可选默认）', async () => {
    const { operations, saved, closed } = await harness('moonshot-kimi')
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'k-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fetch models' }))
    expect(await screen.findByText('Fetched 2 models (240ms)')).toBeDefined()
    expect(screen.getByText('kimi-k2')).toBeDefined()

    fireEvent.click(screen.getByLabelText('Set as default after saving'))
    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }))
    await waitFor(() => expect(saved).toEqual([['Moonshot Kimi', 'moonshot-kimi', true]]))
    expect(closed).toEqual([true])
    expect(operations.log.lastCredentialWrite).toEqual(['KIMI_API_KEY', 'k-123'])
    expect(operations.log.lastWriteNs).toEqual('agent-default-model')
  })

  it('401 拒绝展示 host 诊断（key 错误反馈），草稿保留', async () => {
    const ops = operations()
    ops.discoverModels = async () => ({ kind: 'refused', message: 'https://api.moonshot.cn/v1/models answered 401; check the API key' })
    const { saved } = await harness('moonshot-kimi', ops)
    fireEvent.click(screen.getByRole('button', { name: 'Fetch models' }))
    expect(await screen.findByRole('alert')).toBeDefined()
    expect(screen.getByRole('alert').textContent).toContain('answered 401')
    expect(saved).toEqual([])
  })

  it('非 listable 预设：种子模型预填并提示无自动列表', async () => {
    await harness('zhipu-glm-claude')
    expect(screen.getByText('This protocol has no auto listing; preset seed models are filled in and editable.')).toBeDefined()
    expect(screen.getByTitle('glm-5.3')).toBeDefined()
  })

  it('route 冲突时校验拒绝并提示改名', async () => {
    const ops = operations()
    ops.describeSettings = async () => ({
      kind: 'ready',
      value: {
        writable: true,
        hasDocument: true,
        namespaces: [
          { ns: 'llm-pi-ai', revision: 1, user: { providers: { 'moonshot-kimi': { apiKeyEnv: 'X' } } } },
          { ns: 'agent-default-model', revision: 2, user: undefined },
        ],
      },
    })
    await harness('moonshot-kimi', ops)
    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }))
    expect(await screen.findByText('Route key "moonshot-kimi" already exists; pick another name.')).toBeDefined()
  })

  it('settings/conflict 冲突提示重读重试，不自动覆盖', async () => {
    const ops = operations()
    ops.writeSettings = async () => ({ kind: 'conflict', message: 'revision moved' })
    const { saved, closed } = await harness('moonshot-kimi', ops)
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'k' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fetch models' }))
    await screen.findByText('kimi-k2')
    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }))
    await waitFor(() => expect(screen.getByText('Settings changed elsewhere; the directory is being reloaded — retry the save.')).toBeDefined())
    expect(saved).toEqual([])
    expect(closed).toEqual([])
  })

  it('凭证写入失败时停止保存并展示原因', async () => {
    const ops = operations()
    ops.storeCredential = async () => 'credentials provider is read-only'
    const { saved, closed } = await harness('moonshot-kimi', ops)
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'k' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fetch models' }))
    await screen.findByText('kimi-k2')
    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }))
    await waitFor(() => expect(screen.getByText(/credentials provider is read-only/)).toBeDefined())
    expect(saved).toEqual([])
    expect(closed).toEqual([])
  })

  it('手填模型：回车追加候选并选中', async () => {
    await harness('moonshot-kimi')
    fireEvent.change(screen.getByLabelText('Type a model id and press Enter to add'), { target: { value: 'custom-model' } })
    fireEvent.keyDown(screen.getByLabelText('Type a model id and press Enter to add'), { key: 'Enter' })
    expect(screen.getByTitle('custom-model')).toBeDefined()
    // checkbox 勾选态
    const item = screen.getByTitle('custom-model').closest('label')!.querySelector('input') as HTMLInputElement
    expect(item.checked).toBe(true)
  })
})

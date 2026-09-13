// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProviderPresetsSection } from '../src/client/ProviderPresetsSection.tsx'
import type { ProviderPresetsInjected } from '../src/client/ProviderPresetsSection.tsx'
import { ProviderPresetsStore } from '../src/client/store.ts'
import type { ProviderPresetsOperations } from '../src/client/operations.ts'
import type { ProviderPreset } from '../src/client/presets.ts'
import { PROVIDER_PRESETS } from '../src/client/presets.ts'
import { en, interpolate } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en, params?: Readonly<Record<string, string | number>>): string =>
  params === undefined ? en[key] : interpolate(en[key], params)

function operations(): ProviderPresetsOperations {
  return {
    describeSettings: async () => ({
      kind: 'ready',
      value: {
        writable: true,
        hasDocument: true,
        namespaces: [
          { ns: 'llm-pi-ai', revision: 1, user: { providers: { kimi: { displayName: 'Kimi', apiKeyEnv: 'KIMI_API_KEY', models: [{ id: 'kimi-k2' }] } } } },
          { ns: 'agent-default-model', revision: 2, user: { provider: 'kimi', model: 'kimi-k2' } },
        ],
      },
    }),
    listDirectory: async () => ({
      kind: 'ready',
      value: {
        live: [{ id: 'kimi', name: 'Kimi' }],
        directory: [{ provider: 'kimi', displayName: 'Kimi', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'kimi'], declared: true }],
      },
    }),
    describeCredential: async () => ({ configured: true, writable: true, source: 'file' }),
    storeCredential: async () => undefined,
    writeSettings: async () => ({ kind: 'written', revision: 3 }),
    discoverModels: async () => ({ kind: 'found', models: [], elapsedMs: 12 }),
  }
}

async function harness(injected?: Partial<ProviderPresetsInjected>) {
  const ops = operations()
  const controller = new ProviderPresetsStore(ops)
  await controller.load()
  const face: ProviderPresetsInjected = { controller, operations: ops, t, locale: 'en', ...injected }
  const view = render(<ProviderPresetsSection {...face} />)
  return { view, controller, ops }
}

describe('ProviderPresetsSection', () => {
  it('未注入完成时渲染 null（slot 先行窗口）', () => {
    const { container } = render(<ProviderPresetsSection />)
    expect(container.innerHTML).toBe('')
  })

  it('ready 态渲染总览行（默认标记、密钥事实）与预设卡片网格', async () => {
    await harness()
    expect(screen.getByText('Provider presets')).toBeDefined()
    expect(screen.getByText('Kimi')).toBeDefined()
    expect(screen.getByText('default')).toBeDefined()
    expect(screen.getByText('key configured')).toBeDefined()
    for (const preset of PROVIDER_PRESETS) {
      expect(screen.getByText(preset.displayName.en)).toBeDefined()
    }
  })

  it('点预设卡打开引导对话框（预填 route/baseURL）', async () => {
    await harness()
    fireEvent.click(screen.getByText('Moonshot Kimi'))
    expect(await screen.findByDisplayValue('moonshot-kimi')).toBeDefined()
    expect(screen.getByDisplayValue('https://api.moonshot.cn/v1')).toBeDefined()
  })

  it('错误态展示 host 诊断并提供重试', async () => {
    const ops = operations()
    ops.describeSettings = async () => ({ kind: 'refused', message: 'no settings provider mounted' })
    const controller = new ProviderPresetsStore(ops)
    await controller.load()
    render(<ProviderPresetsSection controller={controller} operations={ops} t={t} locale="en" />)
    expect(screen.getByRole('alert').textContent).toContain('no settings provider mounted')
    const reloaded = vi.fn()
    ops.describeSettings = async () => { reloaded(); return { kind: 'refused', message: 'still failing' } }
    fireEvent.click(screen.getByText('Retry', { selector: 'button' }))
    await waitFor(() => expect(reloaded).toHaveBeenCalled())
  })

  it('「Set as default」写入 agent-default-model；无模型 route 禁用并给原因', async () => {
    const ops = operations()
    ops.describeSettings = async () => ({
      kind: 'ready',
      value: {
        writable: true,
        hasDocument: true,
        namespaces: [
          {
            ns: 'llm-pi-ai',
            revision: 1,
            user: {
              providers: {
                kimi: { displayName: 'Kimi', apiKeyEnv: 'KIMI_API_KEY', models: [{ id: 'kimi-k2' }] },
                bare: { displayName: 'Bare', apiKeyEnv: 'BARE_KEY' },
                ready: { displayName: 'Ready', apiKeyEnv: 'READY_KEY', models: [{ id: 'ready-m' }, { id: 'ready-m2' }] },
              },
            },
          },
          { ns: 'agent-default-model', revision: 2, user: { provider: 'kimi', model: 'kimi-k2' } },
        ],
      },
    })
    ops.listDirectory = async () => ({
      kind: 'ready',
      value: {
        live: [{ id: 'kimi', name: 'Kimi' }],
        directory: ['kimi', 'bare', 'ready'].map(provider => ({
          provider,
          displayName: provider,
          settingsNs: 'llm-pi-ai',
          settingsPath: ['providers', provider],
          declared: true,
        })),
      },
    })
    const controller = new ProviderPresetsStore(ops)
    await controller.load()
    const writes: Array<[string, unknown]> = []
    ops.writeSettings = async (ns, writeOps) => {
      writes.push([ns, writeOps])
      return { kind: 'written', revision: 4 }
    }
    render(<ProviderPresetsSection controller={controller} operations={ops} t={t} locale="en" />)
    const buttons = screen.getAllByRole('button', { name: /Set as default/ })
    expect(buttons.length).toBe(2)
    const disabled = buttons.find(button => (button as HTMLButtonElement).disabled)
    expect(disabled?.title).toBe('no models on this route')
    const enabled = buttons.find(button => !(button as HTMLButtonElement).disabled)
    expect(enabled).toBeDefined()
    fireEvent.click(enabled!)
    await waitFor(() => expect(writes).toEqual([['agent-default-model', [{ op: 'set', path: [], value: { provider: 'ready', model: 'ready-m' } }]]]))
  })
})

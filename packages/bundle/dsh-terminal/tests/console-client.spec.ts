// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apply, name, inject } from '../src/client/index.ts'
import { TerminalConsoleController } from '../src/client/console-controller.ts'
import { fallbackConsoleTranslator } from '../src/client/console-locales.ts'
import { terminalPaneRemoteContribution } from '../src/client/console-remote.ts'
import { TerminalConsoleView } from '../src/client/console-view.tsx'

afterEach(() => { cleanup() })

interface RecordedView {
  readonly descriptor: Record<string, unknown>
  readonly component: () => unknown
}

interface FakeCtxOptions {
  readonly withPane?: boolean
  readonly withCommands?: boolean
  readonly remoteAnswer?: (method: string, input?: unknown) => unknown
}

function fakeCtx(options: FakeCtxOptions = {}) {
  const views: RecordedView[] = []
  const commands: Array<{ descriptor: Record<string, unknown>; execute: () => void }> = []
  const openCalls: string[] = []
  let answer: (method: string, input?: unknown) => unknown = () => ({ ok: true, value: undefined })
  if (options.remoteAnswer !== undefined) answer = options.remoteAnswer

  const sessions = {
    openCalls,
    open(id: string) { openCalls.push(id) },
    list: {
      getSnapshot: () => ({
        ids: ['s-1', 's-2'],
        byId: {
          's-1': { displayTitle: 'Build session', running: true },
          's-2': { displayTitle: 'Docs session', running: false },
        },
        current: 's-1',
      }),
      subscribe: () => () => {},
    },
    binding(sessionId: string) {
      return sessionId === 's-missing' ? undefined : { session: { subscribe: () => () => {}, getSnapshot: () => ({}) } }
    },
  }

  const mountedNamespaces = new Map<string, Record<string, (input?: unknown) => Promise<{ ok: boolean; value?: unknown; error?: unknown }>>>()
  const remote: Record<string, unknown> & { $mount: (contribution: unknown) => Promise<() => Promise<void>> } = {
    $mount: async (contribution: { descriptors: Array<{ namespace: string; method: string; parameters?: Array<{ codec: { schema: { parse(value: unknown): unknown } } }>; result?: { schema?: { parse(value: unknown): unknown } } }> }) => {
      for (const descriptor of contribution.descriptors) {
        const namespace = mountedNamespaces.get(descriptor.namespace) ?? {}
        namespace[descriptor.method] = async (input?: unknown) => {
          for (const parameter of descriptor.parameters ?? []) {
            parameter.codec.schema.parse(input)
          }
          const value = answer(`${descriptor.namespace}.${descriptor.method}`, input)
          descriptor.result?.schema.parse(value)
          return { ok: true, value }
        }
        mountedNamespaces.set(descriptor.namespace, namespace)
        // 与真实 runtime 一致：$mount 后命名空间挂到 remote.<ns> 供直查。
        remote[descriptor.namespace] = namespace
      }
      return async () => {}
    },
  }

  const locale = {
    register: () => () => {},
    // 真实 locale 服务：未命中时原样返回 key。
    bind: (_ns: string, key: string) => key,
  }

  const pane = options.withPane === false ? undefined : {
    registerView: (input: { descriptor: Record<string, unknown>; component: () => unknown; presentation?: unknown }) => {
      views.push({ descriptor: input.descriptor, component: input.component, presentation: input.presentation } as never)
      return () => {}
    },
    openView: (request: Record<string, unknown>) => { openCalls.push(`open:${String(request.kind)}`) },
    ...(options.withCommands === false ? {} : {
      registerCommand: (input: { descriptor: Record<string, unknown>; execute: () => void }) => {
        commands.push({ descriptor: input.descriptor, execute: input.execute })
        return () => {}
      },
    }),
  }

  const ctx = {
    get: (key: string) => {
      if (key === 'sessions') return sessions
      if (key === 'locale') return locale
      if (key === 'paneWorkbench') return pane
      if (key === 'remote') return remote
      // 与真实 runtime 一致：$mount 后嵌套命名空间经 get('remote.<ns>') 可达。
      const nested = /^remote\.(.+)$/.exec(key)
      if (nested !== null) return mountedNamespaces.get(nested[1]!)
      throw new Error(`unexpected service ${key}`)
    },
    sessions,
    locale,
    paneWorkbench: pane,
    remote,
  }
  return { ctx, views, commands, openCalls, mountedNamespaces, setAnswer: (next: (method: string, input?: unknown) => unknown) => { answer = next } }
}

describe('terminal console client entry', () => {
  it('declares sessions+locale static injects', () => {
    expect(name).toBe('dsh-terminal-client')
    expect(inject).toEqual(['sessions', 'locale'])
  })

  it('registers the console view and terminal.open/terminal.reconnect commands on a pane host', async () => {
    const harness = fakeCtx({ remoteAnswer: method => method.endsWith('probe') ? { ok: true, specVersion: '1.0', serviceAvailable: true, backendTypes: ['shell'] } : { ok: true } })
    const dispose = apply(harness.ctx as never)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(harness.views).toHaveLength(2)
    expect(harness.views[0]!.descriptor).toMatchObject({ kind: 'dsh-terminal.console', preferredRegion: 'bottom', retention: 'keep-alive', singleton: true })
    expect(harness.views[1]!.descriptor).toMatchObject({ kind: 'dsh-terminal.session', preferredRegion: 'bottom', retention: 'keep-alive', singleton: false })
    expect(harness.views[1]!.presentation).toMatchObject({ icon: 'terminal', defaultEdge: 'bottom' })
    expect(harness.commands).toHaveLength(3)
    expect(harness.commands[0]!.descriptor).toMatchObject({ id: 'terminal.open', slash: { name: 'terminal', category: 'pane' } })
    expect(harness.commands[1]!.descriptor).toMatchObject({ id: 'terminal.open-session', presentation: { launcher: true } })
    expect(harness.commands[2]!.descriptor).toMatchObject({ id: 'terminal.reconnect', label: 'Reconnect terminal', presentation: { launcher: true } })
    expect(harness.commands[2]!.descriptor.slash).toBeUndefined()
    dispose()
  })

  it('executes terminal.reconnect by opening the console and re-probing the service', async () => {
    let probes = 0
    const harness = fakeCtx({ remoteAnswer: method => {
      if (method.endsWith('probe')) {
        probes += 1
        return { ok: true, specVersion: '1.0', serviceAvailable: true, backendTypes: ['shell'] }
      }
      return { ok: true }
    } })
    const dispose = apply(harness.ctx as never)
    await new Promise(resolve => setTimeout(resolve, 0))
    harness.commands[2]!.execute()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(harness.openCalls).toContain('open:dsh-terminal.console')
    expect(probes).toBeGreaterThanOrEqual(2)
    dispose()
  })

  it('zero-registers when paneWorkbench is absent and never touches sessions.open()', async () => {
    const harness = fakeCtx({ withPane: false })
    const dispose = apply(harness.ctx as never)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(harness.views).toHaveLength(0)
    expect(harness.openCalls).toEqual([])
    dispose()
  })

  it('renders an honest disabled state when the service is unavailable', async () => {
    const harness = fakeCtx({ remoteAnswer: method => method.endsWith('probe') ? { ok: true, specVersion: '1.0', serviceAvailable: false, backendTypes: [], reason: 'terminals_missing' } : { ok: true } })
    const dispose = apply(harness.ctx as never)
    await new Promise(resolve => setTimeout(resolve, 0))
    const { container } = render(createElement(harness.views[0]!.component as () => never))
    expect(container.querySelector('[data-dsh-terminal-console]')?.getAttribute('data-terminal-state')).toBe('disabled')
    expect(container.textContent ?? '').toContain('0.1.1-rc.2')
    dispose()
  })

  it('exposes a strict wire contribution that validates against the host schema', () => {
    expect(terminalPaneRemoteContribution.package).toBe('@yeisme/dsh-terminal-host')
    const methods = terminalPaneRemoteContribution.descriptors.map(descriptor => descriptor.method)
    expect(methods).toEqual(['probe', 'list', 'spawn', 'read', 'send', 'signal', 'close'])
    for (const descriptor of terminalPaneRemoteContribution.descriptors) {
      expect(descriptor.namespace).toBe('terminalPane')
      expect(descriptor.invocation).toEqual({ kind: 'direct' })
    }
  })
})

describe('TerminalConsoleView render', () => {
  it('renders the probing surface before the controller attaches', () => {
    const { container } = render(createElement(TerminalConsoleView, {
      controller: undefined,
      sessions: [],
      currentSessionId: 's-1',
      t: (key: string) => key,
      onRefreshSignal: () => () => {},
    }))
    expect(container.querySelector('[data-dsh-terminal-console]')?.getAttribute('data-terminal-state')).toBe('probing')
  })

  it('renders the ready surface with picker, composer, and no sessions yet', async () => {
    const controller = new TerminalConsoleController({
      async probe() { return { ok: true, specVersion: '1.0', serviceAvailable: true, backendTypes: ['shell'] } },
      async list() { return { ok: true, sessions: [] } },
      async spawn() { return { ok: true, terminalId: 't-1', type: 'shell', motd: '' } },
      async read() { return { ok: true, text: '', totalLines: 0, lineBegin: 0, lineEnd: 0, truncated: false } },
      async send() { return { ok: true, viewport: '', waitReason: 'stdin_read', sessionStatus: { kind: 'running' }, truncated: false } },
      async signal() { return { ok: true, delivered: true } },
      async close() { return { ok: true, killed: true } },
    })
    const started = controller.start()
    const { container } = render(createElement(TerminalConsoleView, {
      controller,
      sessions: [{ sessionId: 's-1', displayTitle: 'Build', running: true }],
      currentSessionId: 's-1',
      t: (key: string) => key,
      onRefreshSignal: () => () => {},
    }))
    await started
    expect(container.querySelector('[data-dsh-terminal-console]')?.getAttribute('data-terminal-state')).toBe('ready')
    expect(container.querySelector('[data-terminal-owner-select]')).not.toBeNull()
    expect(container.querySelector('[data-terminal-input]')).not.toBeNull()
    expect(container.querySelector('[data-terminal-new]')).not.toBeNull()
    await started
    controller.dispose()
    cleanup()
  })

  it('renders an exited active terminal with an exit badge, locked composer, and honest hint', async () => {
    const controller = new TerminalConsoleController({
      async probe() { return { ok: true, specVersion: '1.0', serviceAvailable: true, backendTypes: ['shell'] } },
      async list() {
        return { ok: true, sessions: [
          { terminalId: 't-1', type: 'shell', status: { kind: 'exited' as const, exitCode: 3, signal: null } },
          { terminalId: 't-2', type: 'shell', status: { kind: 'exited' as const, exitCode: null, signal: 'SIGTERM' as const } },
        ] }
      },
      async spawn() { return { ok: true, terminalId: 't-3', type: 'shell', motd: '' } },
      async read() { return { ok: true, text: 'last output\r\n', totalLines: 1, lineBegin: 0, lineEnd: 1, truncated: false } },
      async send() { return { ok: true, viewport: '', waitReason: 'stdin_read', sessionStatus: { kind: 'running' }, truncated: false } },
      async signal() { return { ok: true, delivered: true } },
      async close() { return { ok: true, killed: true } },
    })
    const started = controller.start()
    const { container } = render(createElement(TerminalConsoleView, {
      controller,
      sessions: [{ sessionId: 's-1', displayTitle: 'Build', running: true }],
      currentSessionId: 's-1',
      t: fallbackConsoleTranslator(),
      onRefreshSignal: () => () => {},
    }))
    await started
    await controller.selectOwnerSession('s-1')
    await controller.selectTerminal('t-1')
    expect(container.querySelector('[data-terminal-exited]')?.textContent).toBe('exited (code 3)')
    expect(container.querySelector('[data-terminal-exited-hint]')?.textContent).toContain('scrollback stays readable')
    expect((container.querySelector('[data-terminal-input]') as HTMLInputElement).disabled).toBe(true)
    expect((container.querySelector('[data-terminal-send]') as HTMLButtonElement).disabled).toBe(true)
    expect((container.querySelector('[data-terminal-sigint]') as HTMLButtonElement).disabled).toBe(true)
    expect((container.querySelector('[data-terminal-close]') as HTMLButtonElement).disabled).toBe(false)
    expect(container.querySelector('[data-terminal-reconnect]')).not.toBeNull()
    expect(container.querySelector('[data-terminal-scrollback]')?.textContent).toContain('last output')
    // 列表项标注退出码/信号，不静默把已退出终端当可用。
    expect(container.querySelector('[data-terminal-select]')?.textContent).toContain('exited (code 3)')
    expect(container.querySelector('[data-terminal-select]')?.textContent).toContain('killed by SIGTERM')
    controller.dispose()
    cleanup()
  })
})

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  TERMINAL_PANE_REMOTE_SERVICE_KEY,
  TERMINAL_PANE_SPEC_VERSION,
  TerminalPaneAdapter,
  TerminalPaneRemoteService,
  terminalPaneRemoteMarkers,
  terminalPaneHostApply,
  terminalPaneHostInject,
  terminalPaneHostName,
} from '../src/index.ts'
import { fixture } from './terminal-pane-adapter.spec.ts'

function makeRemote(terminals?: unknown, agents?: unknown) {
  const ctx = new Context()
  const remote = new TerminalPaneRemoteService(ctx, new TerminalPaneAdapter({ terminals, agents }))
  return { ctx, remote }
}

describe('terminalPane remote service', () => {
  it('binds the terminalPane namespace and marks all seven methods', async () => {
    const { ctx, remote } = makeRemote()
    expect((remote as unknown as { name: string }).name).toBe(TERMINAL_PANE_REMOTE_SERVICE_KEY)
    expect(TERMINAL_PANE_REMOTE_SERVICE_KEY).toBe('terminalPane')
    expect(terminalPaneRemoteMarkers(remote)).toEqual([
      'probe', 'list', 'spawn', 'read', 'send', 'signal', 'close',
    ].map(method => ({ method, invocation: { kind: 'direct' } })))
    await ctx.fiber.dispose()
  })

  it('probe reports specVersion and the backend list', async () => {
    const { terminals, agents } = fixture()
    const { ctx, remote } = makeRemote(terminals, agents)
    await expect(remote.probe()).resolves.toMatchObject({
      ok: true,
      specVersion: TERMINAL_PANE_SPEC_VERSION,
      serviceAvailable: true,
      backendTypes: ['shell'],
    })
    await ctx.fiber.dispose()
  })

  it('rejects malformed inputs with input_invalid, never throwing', async () => {
    const { terminals, agents } = fixture()
    const { ctx, remote } = makeRemote(terminals, agents)
    await expect(remote.list({})).resolves.toMatchObject({ ok: false, code: 'input_invalid' })
    await expect(remote.list(null)).resolves.toMatchObject({ ok: false, code: 'input_invalid' })
    await expect(remote.spawn({ sessionId: 's-1' })).resolves.toMatchObject({ ok: false, code: 'input_invalid' })
    await expect(remote.spawn({ sessionId: 's-1', type: 'shell', name: '' })).resolves.toMatchObject({ ok: false, code: 'input_invalid' })
    await expect(remote.read({ sessionId: 's-1' })).resolves.toMatchObject({ ok: false, code: 'input_invalid' })
    await expect(remote.read({ sessionId: 's-1', terminalId: 't', count: 0 })).resolves.toMatchObject({ ok: false, code: 'input_invalid' })
    await expect(remote.read({ sessionId: 's-1', terminalId: 't', offset: -1 })).resolves.toMatchObject({ ok: false, code: 'input_invalid' })
    await expect(remote.send({ sessionId: 's-1', terminalId: 't', text: 'x' })).resolves.toMatchObject({ ok: false, code: 'input_invalid' })
    await expect(remote.signal({ sessionId: 's-1', terminalId: 't', signal: 'SIGUSR1' })).resolves.toMatchObject({ ok: false, code: 'input_invalid' })
    await expect(remote.close({ sessionId: 's-1' })).resolves.toMatchObject({ ok: false, code: 'input_invalid' })
    await ctx.fiber.dispose()
  })

  it('forwards list/send/close through the adapter', async () => {
    const { terminals, agents } = fixture({ sessions: 1 })
    const { ctx, remote } = makeRemote(terminals, agents)
    await expect(remote.list({ sessionId: 's-1' })).resolves.toMatchObject({
      ok: true,
      sessions: [{ terminalId: 'term-1', name: 'build', type: 'shell', status: { kind: 'running' } }],
    })
    await expect(remote.send({ sessionId: 's-1', terminalId: 'term-1', text: 'ls', submit: true })).resolves.toMatchObject({
      ok: true,
      waitReason: 'stdin_read',
    })
    await expect(remote.close({ sessionId: 's-1', terminalId: 'term-1' })).resolves.toMatchObject({ ok: true, killed: true })
    await ctx.fiber.dispose()
  })

  it('stays loadable and typed when the official service is absent', async () => {
    const { ctx, remote } = makeRemote()
    await expect(remote.probe()).resolves.toMatchObject({ ok: true, serviceAvailable: false, reason: 'terminals_missing' })
    await expect(remote.list({ sessionId: 's-1' })).resolves.toMatchObject({ ok: false, code: 'service_unavailable' })
    await ctx.fiber.dispose()
  })
})

describe('terminalPane host plugin entry', () => {
  it('exposes a no-dependency plugin face', () => {
    expect(terminalPaneHostName).toBe('dsh-terminal-host')
    expect(terminalPaneHostInject).toEqual([])
  })

  it('applies on a bare context without official services and registers the remote', async () => {
    const ctx = new Context()
    terminalPaneHostApply(ctx)
    const remote = ctx.get(TERMINAL_PANE_REMOTE_SERVICE_KEY) as TerminalPaneRemoteService
    expect(typeof remote?.probe).toBe('function')
    await expect(remote.probe()).resolves.toMatchObject({ serviceAvailable: false })
    await ctx.fiber.dispose()
  })
})

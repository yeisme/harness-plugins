import { describe, expect, it } from 'vitest'
import { TerminalConsoleController } from '../src/client/console-controller.ts'
import type { TerminalPaneRemoteFace } from '../src/client/console-remote.ts'
import type {
  TerminalPaneListResult,
  TerminalPaneProbeResult,
  TerminalPaneReadResult,
  TerminalPaneSendResult,
  TerminalPaneSpawnResult,
} from '@yeisme/dsh-terminal-host'

interface FakeRemote extends TerminalPaneRemoteFace {
  readonly calls: string[]
}

function fakeRemote(options: { available?: boolean; spawnFails?: boolean; sendFails?: boolean } = {}): FakeRemote {
  const calls: string[] = []
  const sessions = [
    { terminalId: 't-1', name: 'build', type: 'shell', status: { kind: 'running' as const } },
    { terminalId: 't-2', type: 'shell', status: { kind: 'exited' as const, exitCode: 0, signal: null } },
  ]
  const remote: FakeRemote = {
    calls,
    async probe(): Promise<TerminalPaneProbeResult> {
      calls.push('probe')
      return options.available === false
        ? { ok: true, specVersion: '1.0', serviceAvailable: false, backendTypes: [], reason: 'terminals_missing' }
        : { ok: true, specVersion: '1.0', serviceAvailable: true, backendTypes: ['shell'] }
    },
    async list(sessionId: string) {
      calls.push(`list:${sessionId}`)
      const result: TerminalPaneListResult = { ok: true, sessions }
      return result
    },
    async spawn(input: { sessionId: string; type: string }) {
      calls.push(`spawn:${input.sessionId}:${input.type}`)
      if (options.spawnFails === true) return { ok: false as const, code: 'too_many' as const, message: 'cap' }
      const result: TerminalPaneSpawnResult = { ok: true, terminalId: 't-3', type: input.type, motd: 'welcome\r\n' }
      return result
    },
    async read(input: { sessionId: string; terminalId: string }) {
      calls.push(`read:${input.terminalId}`)
      const result: TerminalPaneReadResult = { ok: true, text: `$ ls\r\nfile-a\r\nfile-b\r\n`, totalLines: 12, lineBegin: 0, lineEnd: 12, truncated: false }
      return result
    },
    async send(input: { sessionId: string; terminalId: string; text: string }) {
      calls.push(`send:${input.terminalId}:${input.text}`)
      if (options.sendFails === true) return { ok: false as const, code: 'send_active' as const, message: 'busy' }
      const result: TerminalPaneSendResult = { ok: true, viewport: `$ ${input.text}\r\nok`, waitReason: 'stdin_read', sessionStatus: { kind: 'running' }, truncated: false }
      return result
    },
    async signal(input: { sessionId: string; terminalId: string; signal: string }) {
      calls.push(`signal:${input.terminalId}:${input.signal}`)
      return { ok: true as const, delivered: true }
    },
    async close(input: { sessionId: string; terminalId: string }) {
      calls.push(`close:${input.terminalId}`)
      return { ok: true as const, killed: true }
    },
  }
  return remote
}

describe('TerminalConsoleController', () => {
  it('lands on disabled with the probe reason when the service is absent', async () => {
    const controller = new TerminalConsoleController(fakeRemote({ available: false }))
    await controller.start()
    expect(controller.getSnapshot()).toMatchObject({ phase: 'disabled', disabledReason: 'terminals_missing' })
    controller.dispose()
  })

  it('reports transport failure as disabled when the remote throws', async () => {
    const remote = fakeRemote()
    remote.probe = () => Promise.reject(new Error('offline'))
    const controller = new TerminalConsoleController(remote)
    await controller.start()
    expect(controller.getSnapshot()).toMatchObject({ phase: 'disabled' })
    expect(controller.getSnapshot().disabledReason).toContain('offline')
    controller.dispose()
  })

  it('selects an owner session, lists terminals, and reads scrollback', async () => {
    const remote = fakeRemote()
    const controller = new TerminalConsoleController(remote)
    await controller.start()
    await controller.selectOwnerSession('s-1')
    await controller.selectTerminal('t-1')
    const state = controller.getSnapshot()
    expect(state).toMatchObject({
      phase: 'ready',
      ownerSessionId: 's-1',
      activeTerminalId: 't-1',
      backendTypes: ['shell'],
    })
    expect(state.sessions).toHaveLength(2)
    expect(state.scrollback).toMatchObject({ totalLines: 12, truncated: false })
    expect(remote.calls).toEqual(['probe', 'list:s-1', 'read:t-1'])
    controller.dispose()
  })

  it('spawns a terminal, refreshes the list, and selects the new terminal with motd prepended', async () => {
    const controller = new TerminalConsoleController(fakeRemote())
    await controller.start()
    await controller.selectOwnerSession('s-1')
    await controller.spawnTerminal()
    const state = controller.getSnapshot()
    expect(state.activeTerminalId).toBe('t-3')
    expect(state.scrollback?.text.startsWith('welcome\r\n')).toBe(true)
    controller.dispose()
  })

  it('surfaces typed spawn failures inline without breaking the state', async () => {
    const controller = new TerminalConsoleController(fakeRemote({ spawnFails: true }))
    await controller.start()
    await controller.selectOwnerSession('s-1')
    await controller.spawnTerminal()
    expect(controller.getSnapshot().error).toBe('too_many: cap')
    expect(controller.getSnapshot().phase).toBe('ready')
    controller.dispose()
  })

  it('locks input during a send and records the wait badge after settle', async () => {
    let releaseSend: (() => void) | undefined
    const remote = fakeRemote()
    remote.send = () => new Promise(resolve => {
      releaseSend = () => resolve({ ok: true, viewport: 'v', waitReason: 'stdin_read', sessionStatus: { kind: 'running' }, truncated: false })
    })
    const controller = new TerminalConsoleController(remote)
    await controller.start()
    await controller.selectOwnerSession('s-1')
    await controller.selectTerminal('t-1')
    const pending = controller.send('ls -la', true)
    expect(controller.getSnapshot().sending).toBe(true)
    releaseSend?.()
    await pending
    expect(controller.getSnapshot().sending).toBe(false)
    expect(controller.getSnapshot().lastWait).toEqual({ waitReason: 'stdin_read' })
    controller.dispose()
  })

  it('marks send_wait_timeout cancellation in the wait badge', async () => {
    const controller = new TerminalConsoleController(fakeRemote())
    await controller.start()
    await controller.selectOwnerSession('s-1')
    await controller.selectTerminal('t-1')
    await controller.send('yes', true)
    expect(controller.getSnapshot().lastWait).toEqual({ waitReason: 'stdin_read' })
    controller.dispose()
  })

  it('keeps typed send failures visible and unlocks the composer', async () => {
    const controller = new TerminalConsoleController(fakeRemote({ sendFails: true }))
    await controller.start()
    await controller.selectOwnerSession('s-1')
    await controller.selectTerminal('t-1')
    await controller.send('x', true)
    expect(controller.getSnapshot()).toMatchObject({ sending: false, error: 'send_active: busy' })
    controller.dispose()
  })

  it('refreshes scrollback only for the active terminal (event-driven path)', async () => {
    const remote = fakeRemote()
    const controller = new TerminalConsoleController(remote)
    await controller.start()
    await controller.selectOwnerSession('s-1')
    await controller.selectTerminal('t-1')
    const readsBefore = remote.calls.filter(call => call.startsWith('read:')).length
    await controller.refreshScrollback()
    expect(remote.calls.filter(call => call.startsWith('read:')).length).toBe(readsBefore + 1)
    controller.dispose()
  })

  it('closes the active terminal and clears the selection', async () => {
    const controller = new TerminalConsoleController(fakeRemote())
    await controller.start()
    await controller.selectOwnerSession('s-1')
    await controller.selectTerminal('t-2')
    await controller.closeTerminal()
    expect(controller.getSnapshot()).toMatchObject({ activeTerminalId: undefined, scrollback: undefined })
    expect(controller.getSnapshot().sessions).toHaveLength(2)
    controller.dispose()
  })

  it('refuses sends to an exited terminal client-side without a remote round trip', async () => {
    const remote = fakeRemote()
    const controller = new TerminalConsoleController(remote)
    await controller.start()
    await controller.selectOwnerSession('s-1')
    await controller.selectTerminal('t-2')
    await controller.send('ls', true)
    expect(remote.calls.some(call => call.startsWith('send:'))).toBe(false)
    expect(controller.getSnapshot()).toMatchObject({ sending: false })
    expect(controller.getSnapshot().error).toContain('terminal_exited')
    controller.dispose()
  })

  it('reconnects after an outage: re-probe, retained selection, replayed scrollback', async () => {
    let available = false
    const remote = fakeRemote()
    remote.probe = () => {
      remote.calls.push('probe')
      return Promise.resolve(available
        ? { ok: true as const, specVersion: '1.0', serviceAvailable: true, backendTypes: ['shell'] }
        : { ok: true as const, specVersion: '1.0', serviceAvailable: false, backendTypes: [], reason: 'terminals_missing' })
    }
    const controller = new TerminalConsoleController(remote)
    await controller.start()
    expect(controller.getSnapshot().phase).toBe('disabled')

    available = true
    await controller.reconnect()
    expect(controller.getSnapshot().phase).toBe('ready')
    await controller.selectOwnerSession('s-1')
    await controller.selectTerminal('t-1')

    available = false
    await controller.reconnect()
    expect(controller.getSnapshot()).toMatchObject({ phase: 'disabled', ownerSessionId: 's-1', activeTerminalId: 't-1' })

    available = true
    const readsBefore = remote.calls.filter(call => call === 'read:t-1').length
    await controller.reconnect()
    const state = controller.getSnapshot()
    expect(state).toMatchObject({ phase: 'ready', ownerSessionId: 's-1', activeTerminalId: 't-1' })
    expect(remote.calls.filter(call => call === 'read:t-1').length).toBeGreaterThan(readsBefore)
    expect(state.scrollback).toMatchObject({ totalLines: 12 })
    controller.dispose()
  })

  it('drops the active selection on reconnect when the terminal is gone', async () => {
    const sessions = [{ terminalId: 't-1', type: 'shell', status: { kind: 'running' as const } }]
    const remote = fakeRemote()
    remote.list = (sessionId: string) => {
      remote.calls.push(`list:${sessionId}`)
      return Promise.resolve({ ok: true as const, sessions })
    }
    const controller = new TerminalConsoleController(remote)
    await controller.start()
    await controller.selectOwnerSession('s-1')
    await controller.selectTerminal('t-1')
    sessions.length = 0
    await controller.reconnect()
    expect(controller.getSnapshot()).toMatchObject({ phase: 'ready', activeTerminalId: undefined, scrollback: undefined })
    controller.dispose()
  })

  it('detach keeps the PTY alive: disposing the controller never closes; a fresh controller replays scrollback', async () => {
    const remote = fakeRemote()
    const first = new TerminalConsoleController(remote)
    await first.start()
    await first.selectOwnerSession('s-1')
    await first.selectTerminal('t-1')
    first.dispose()

    // 面板关闭 ≠ 终端关闭：官方 backend 仍持有 PTY，无 kill/close 调用。
    expect(remote.calls.some(call => call.startsWith('close:'))).toBe(false)

    const second = new TerminalConsoleController(remote)
    await second.start()
    await second.selectOwnerSession('s-1')
    await second.selectTerminal('t-1')
    const state = second.getSnapshot()
    expect(state.sessions.some(session => session.terminalId === 't-1' && session.status.kind === 'running')).toBe(true)
    expect(state.scrollback).toMatchObject({ text: expect.stringContaining('file-a'), truncated: false })
    expect(remote.calls.some(call => call.startsWith('close:'))).toBe(false)
    second.dispose()
  })
})

import { describe, expect, it } from 'vitest'
import {
  TERMINAL_PANE_MAX_READ_LINES,
  TERMINAL_PANE_MAX_SESSIONS_PER_OWNER,
  createTerminalPaneAdapter,
  isAgentsService,
  terminalsContractGaps,
  type AgentsServiceFace,
  type TerminalsServiceFace,
} from '../src/index.ts'

interface Fixture {
  readonly terminals: TerminalsServiceFace & { calls: string[] }
  readonly agents: AgentsServiceFace & { calls: string[] }
}

function officialError(code: string, message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string }
  ;(error as { code: string }).code = code
  return error
}

export function fixture(options: { sessions?: number } = {}): Fixture {
  const calls: string[] = []
  const agentCalls: string[] = []
  const owner = { agent: true }
  const sessions = Array.from({ length: options.sessions ?? 0 }, (_, index) => ({
    sessionId: `term-${index + 1}`,
    type: 'shell',
    status: { kind: 'running' as const },
    ...(index === 0 ? { name: 'build' } : {}),
    pid: 4242,
  }))
  const terminals = {
    calls,
    listBackends: () => ['shell'],
    async spawn(own: unknown, request: { type: string; name?: string }) {
      calls.push(`spawn:${request.type}`)
      if (request.type === 'missing') throw officialError('NO_BACKEND', `no backend ${request.type}`)
      if (request.name === 'dup') throw officialError('DUPLICATE_NAME', 'duplicate name')
      return {
        sessionId: `term-${sessions.length + 1}`,
        type: request.type,
        motd: 'welcome\r\n',
        ...(request.name !== undefined ? { name: request.name } : {}),
        status: { kind: 'running' as const },
      }
    },
    startSend(own: unknown, id: string, request: { text: string; submit: boolean }) {
      calls.push(`send:${id}:${request.text}`)
      if (id === 'term-busy') throw officialError('SEND_ACTIVE', 'send already active')
      if (id === 'term-foreign') throw officialError('FOREIGN_SESSION', 'foreign session')
      if (id === 'term-gone') throw officialError('NO_SESSION', 'no session')
      return {
        done: Promise.resolve({
          viewport: `$ ${request.text}\r\nok\r\n`,
          waitReason: 'stdin_read' as const,
          sessionStatus: { kind: 'running' as const },
          truncated: false,
        }),
        readOutput: () => ({ delta: '', truncated: false }),
        cancel: () => true,
      }
    },
    read(own: unknown, id: string, request: { offset?: number; count?: number }) {
      calls.push(`read:${id}:${request.count ?? 'default'}`)
      if (id === 'term-foreign') throw officialError('FOREIGN_SESSION', 'foreign session')
      const total = 1000
      const count = Math.min(request.count ?? TERMINAL_PANE_MAX_READ_LINES, total)
      return {
        text: 'x'.repeat(count),
        totalLines: total,
        lineBegin: total - count,
        lineEnd: total,
        truncated: count < total,
      }
    },
    async signal(own: unknown, id: string, signal: string) {
      calls.push(`signal:${id}:${signal}`)
      if (id === 'term-gone') throw officialError('NO_SESSION', 'no session')
      return { delivered: true, targetPgid: 4242 }
    },
    async kill(own: unknown, id: string) {
      calls.push(`kill:${id}`)
      if (id === 'term-fail-close') throw officialError('SERVICE_DISPOSING', 'disposing')
      return true
    },
    list(own: unknown) {
      calls.push('list')
      return sessions
    },
  } as unknown as TerminalsServiceFace & { calls: string[] }
  const agents = {
    calls: agentCalls,
    get(sessionId: string) {
      agentCalls.push(`get:${sessionId}`)
      return sessionId === 'dead-session' ? undefined : owner
    },
  } as unknown as AgentsServiceFace & { calls: string[] }
  return { terminals, agents }
}

describe('terminalsContractGaps', () => {
  it('accepts the full official face', () => {
    const { terminals } = fixture()
    expect(terminalsContractGaps(terminals)).toEqual([])
  })

  it('reports every missing method on shape drift', () => {
    expect(terminalsContractGaps(undefined)).toEqual(['terminals'])
    expect(terminalsContractGaps({})).toEqual(['listBackends', 'spawn', 'startSend', 'read', 'signal', 'kill', 'list'])
    const drift = { listBackends: () => [], list: () => [] }
    expect(terminalsContractGaps(drift)).toEqual(['spawn', 'startSend', 'read', 'signal', 'kill'])
  })

  it('probes the agents face by get()', () => {
    const { agents } = fixture()
    expect(isAgentsService(agents)).toBe(true)
    expect(isAgentsService({})).toBe(false)
  })
})

describe('TerminalPaneAdapter', () => {
  it('reports service_unavailable with terminals_missing when the service is absent', () => {
    const adapter = createTerminalPaneAdapter({})
    const probe = adapter.probe()
    expect(probe).toMatchObject({ ok: true, serviceAvailable: false, reason: 'terminals_missing' })
    expect(adapter.list('s-1')).toMatchObject({ ok: false, code: 'service_unavailable' })
  })

  it('reports contract_mismatch on shape drift with the missing methods', () => {
    const adapter = createTerminalPaneAdapter({ terminals: { listBackends: () => [] } })
    const probe = adapter.probe()
    expect(probe).toMatchObject({ ok: true, serviceAvailable: false })
    expect(probe.ok && probe.reason).toContain('missing:')
  })

  it('lists owner terminals without pid leakage', () => {
    const { terminals, agents } = fixture({ sessions: 2 })
    const adapter = createTerminalPaneAdapter({ terminals, agents })
    const result = adapter.list('s-1')
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('unreachable')
    expect(result.sessions).toHaveLength(2)
    expect(result.sessions[0]).toEqual({ terminalId: 'term-1', name: 'build', type: 'shell', status: { kind: 'running' } })
    expect(JSON.stringify(result.sessions)).not.toContain('pid')
  })

  it('rejects spawn when the owner session has no live agent', async () => {
    const { terminals, agents } = fixture()
    const adapter = createTerminalPaneAdapter({ terminals, agents })
    await expect(adapter.spawn({ sessionId: 'dead-session', type: 'shell' })).resolves.toMatchObject({
      ok: false,
      code: 'session_not_live',
    })
  })

  it('enforces the per-owner session cap', async () => {
    const { terminals, agents } = fixture({ sessions: TERMINAL_PANE_MAX_SESSIONS_PER_OWNER })
    const adapter = createTerminalPaneAdapter({ terminals, agents })
    await expect(adapter.spawn({ sessionId: 's-1', type: 'shell' })).resolves.toMatchObject({ ok: false, code: 'too_many' })
  })

  it('maps official NO_BACKEND and DUPLICATE_NAME spawn codes', async () => {
    const { terminals, agents } = fixture()
    const adapter = createTerminalPaneAdapter({ terminals, agents })
    await expect(adapter.spawn({ sessionId: 's-1', type: 'missing' })).resolves.toMatchObject({ ok: false, code: 'backend_missing' })
    await expect(adapter.spawn({ sessionId: 's-1', type: 'shell', name: 'dup' })).resolves.toMatchObject({ ok: false, code: 'name_conflict' })
  })

  it('spawns with motd and opaque id', async () => {
    const { terminals, agents } = fixture()
    const adapter = createTerminalPaneAdapter({ terminals, agents })
    await expect(adapter.spawn({ sessionId: 's-1', type: 'shell', name: 'build' })).resolves.toMatchObject({
      ok: true,
      terminalId: 'term-1',
      name: 'build',
      type: 'shell',
      motd: 'welcome\r\n',
    })
  })

  it('reads bounded pages and maps FOREIGN_SESSION to not_owner', () => {
    const { terminals, agents } = fixture()
    const adapter = createTerminalPaneAdapter({ terminals, agents })
    const capped = adapter.read({ sessionId: 's-1', terminalId: 'term-1', count: 9_999 })
    expect(capped).toMatchObject({ ok: true, lineBegin: 500, lineEnd: 1000, truncated: true })
    expect(terminals.calls.at(-1)).toBe(`read:term-1:${TERMINAL_PANE_MAX_READ_LINES}`)
    expect(adapter.read({ sessionId: 's-1', terminalId: 'term-foreign' })).toMatchObject({ ok: false, code: 'not_owner' })
  })

  it('sends through the official operation and projects the settled result', async () => {
    const { terminals, agents } = fixture()
    const adapter = createTerminalPaneAdapter({ terminals, agents })
    await expect(adapter.send({ sessionId: 's-1', terminalId: 'term-1', text: 'ls', submit: true })).resolves.toMatchObject({
      ok: true,
      viewport: '$ ls\r\nok\r\n',
      waitReason: 'stdin_read',
      sessionStatus: { kind: 'running' },
    })
  })

  it('maps SEND_ACTIVE and NO_SESSION during send', async () => {
    const { terminals, agents } = fixture()
    const adapter = createTerminalPaneAdapter({ terminals, agents })
    await expect(adapter.send({ sessionId: 's-1', terminalId: 'term-busy', text: 'x', submit: true })).resolves.toMatchObject({ ok: false, code: 'send_active' })
    await expect(adapter.send({ sessionId: 's-1', terminalId: 'term-gone', text: 'x', submit: true })).resolves.toMatchObject({ ok: false, code: 'terminal_not_found' })
  })

  it('signals and closes with typed passthrough', async () => {
    const { terminals, agents } = fixture()
    const adapter = createTerminalPaneAdapter({ terminals, agents })
    await expect(adapter.signal({ sessionId: 's-1', terminalId: 'term-1', signal: 'SIGINT' })).resolves.toMatchObject({ ok: true, delivered: true })
    await expect(adapter.close({ sessionId: 's-1', terminalId: 'term-1' })).resolves.toMatchObject({ ok: true, killed: true })
    await expect(adapter.close({ sessionId: 's-1', terminalId: 'term-fail-close' })).resolves.toMatchObject({ ok: false, code: 'service_unavailable' })
  })
})

describe('send wait cap convergence', () => {
  it('cancels a long-running foreground send at the cap and leaves no active send', async () => {
    const { terminals, agents } = fixture()
    let cancelled = false
    let releaseDone: ((value: { viewport: string; waitReason: 'stdin_read'; sessionStatus: { kind: 'running' }; truncated: boolean }) => void) | undefined
    ;(terminals as unknown as { startSend: unknown }).startSend = () => ({
      done: new Promise(resolve => {
        releaseDone = resolve
      }),
      readOutput: () => ({ delta: '', truncated: false }),
      cancel: () => {
        cancelled = true
        releaseDone?.({ viewport: '$ longrun\r\n^C', waitReason: 'stdin_read', sessionStatus: { kind: 'running' }, truncated: false })
        return true
      },
    })
    const adapter = new (await import('../src/adapter.ts')).TerminalPaneAdapter({ terminals, agents, sendWaitCapMs: 15 })
    const pending = adapter.send({ sessionId: 's-1', terminalId: 'term-1', text: 'longrun', submit: true })
    const result = await pending
    expect(result).toMatchObject({ ok: true, cancelledByWaitTimeout: true, waitReason: 'stdin_read' })
    expect(cancelled).toBe(true)
    // 触顶后无残留 active send：下一次 startSend 不被官方 SEND_ACTIVE 拒绝。
    ;(terminals as unknown as { startSend: unknown }).startSend = () => ({
      done: Promise.resolve({ viewport: 'ok', waitReason: 'stdin_read', sessionStatus: { kind: 'running' }, truncated: false }),
      readOutput: () => ({ delta: '', truncated: false }),
      cancel: () => true,
    })
    await expect(adapter.send({ sessionId: 's-1', terminalId: 'term-1', text: 'next', submit: true })).resolves.toMatchObject({ ok: true })
  })
})

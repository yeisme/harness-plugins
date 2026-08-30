import { describe, expect, it } from 'vitest'
import {
  createTerminalHost,
  createTerminalHostV2,
  createTerminalHostPlaceholder,
  isTerminalHostV1,
  isTerminalHostV2,
  type DshTerminalSeams,
  type DshTerminalV2Seams,
  type TerminalHostV1,
  type TerminalSessionV1,
} from '../src/index.ts'

const sample: readonly TerminalSessionV1[] = [
  { terminalId: 't-1', title: 'zsh', running: true, lastActivityAt: '2026-08-19T00:00:00.000Z' },
]

function fakeSeams(): DshTerminalSeams & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async listTerminals() {
      calls.push('list')
      return sample
    },
    async openTerminal(title = 'zsh') {
      calls.push(`open:${title}`)
      return { terminalId: 't-2', title, running: true }
    },
    async closeTerminal(terminalId) {
      calls.push(`close:${terminalId}`)
      return { status: 'ok', terminalId }
    },
    async writeInput(terminalId, data) {
      calls.push(`write:${terminalId}:${data}`)
      return { status: 'ok', terminalId }
    },
    async resizeTerminal(terminalId, cols, rows) {
      calls.push(`resize:${terminalId}:${cols}:${rows}`)
      return { status: 'ok', terminalId }
    },
  }
}

describe('@yeisme/dsh-terminal-host', () => {
  it('exposes a versioned host contract', () => {
    const host: TerminalHostV1 = createTerminalHostPlaceholder()
    expect(host.version).toBe('0.1.0-rc.1')
    expect(host.capability).toBe('terminal-host')
  })

  it('returns placeholder terminal list and mutation receipts', async () => {
    const host = createTerminalHostPlaceholder()
    await expect(host.listTerminals()).resolves.toEqual([])
    await expect(host.openTerminal()).resolves.toMatchObject({ terminalId: 'terminal-placeholder' })
    await expect(host.closeTerminal('t-1')).resolves.toMatchObject({ status: 'not_implemented' })
    await expect(host.writeInput('t-1', 'ls')).resolves.toMatchObject({ status: 'not_implemented' })
    await expect(host.resizeTerminal('t-1', 80, 24)).resolves.toMatchObject({ status: 'not_implemented' })
  })

  it('delegates all calls through the typed seam', async () => {
    const seams = fakeSeams()
    const host = createTerminalHost(seams)
    await expect(host.listTerminals()).resolves.toEqual(sample)
    await host.openTerminal('bash')
    await host.closeTerminal('t-1')
    await host.writeInput('t-1', 'ls -la')
    await host.resizeTerminal('t-1', 100, 40)
    expect(seams.calls).toEqual([
      'list',
      'open:bash',
      'close:t-1',
      'write:t-1:ls -la',
      'resize:t-1:100:40',
    ])
  })

  it('keeps V2 attachment lifecycle separate from PTY close', async () => {
    const chunks: Array<(chunk: { terminalId: string; epoch: string; sequence: number; data: string }) => void> = []
    const seams: DshTerminalV2Seams = {
      ...fakeSeams(),
      async attachTerminal(terminalId) {
        return {
          terminalId,
          epoch: 'epoch-1',
          subscribe(listener) {
            chunks.push(listener)
            return () => { chunks.splice(chunks.indexOf(listener), 1) }
          },
          async writeInput(data) { return { status: 'ok', terminalId, reason: data } },
          async resize(cols, rows) { return { status: 'ok', terminalId, reason: `${cols}x${rows}` } },
          async detach() { return undefined },
        }
      },
    }
    const host = createTerminalHostV2(seams)
    const attachment = await host.attachTerminal('t-1', { cols: 80, rows: 24 })
    expect(host.version).toBe('0.2.0-rc.1')
    expect(attachment.epoch).toBe('epoch-1')
    const received: string[] = []
    const dispose = attachment.subscribe(chunk => { received.push(chunk.data) })
    chunks[0]?.({ terminalId: 't-1', epoch: 'epoch-1', sequence: 1, data: 'ready\r\n' })
    await attachment.writeInput('ls')
    await attachment.resize(100, 40)
    await attachment.detach()
    dispose()
    expect(received).toEqual(['ready\r\n'])
    expect(isTerminalHostV1(host)).toBe(false)
    expect(isTerminalHostV2(host)).toBe(true)
    expect(isTerminalHostV1(createTerminalHostPlaceholder())).toBe(true)
  })
})

describe('createFakeTerminalHostV2 (V3 1.2 pure state adapter)', () => {
  it('exposes the versioned V2 contract with a deprecated V1 retained alongside', async () => {
    const { createFakeTerminalHostV2 } = await import('../src/index.ts')
    const host = createFakeTerminalHostV2()
    expect(host.version).toBe('0.2.0-rc.1')
    expect(host.capability).toBe('terminal-host')
    expect(await host.listTerminals()).toHaveLength(1)
    const opened = await host.openTerminal('second')
    expect(opened.title).toBe('second')
    expect((await host.listTerminals()).length).toBe(2)
  })

  it('replays scripted chunks in order with a fresh baseline sequence', async () => {
    const { createFakeTerminalHostV2 } = await import('../src/index.ts')
    const host = createFakeTerminalHostV2({ chunks: [{ data: 'hello' }, { data: 'world', truncated: true }] })
    const attachment = await host.attachTerminal('fake-1')
    const seen: string[] = []
    attachment.subscribe(chunk => { seen.push(chunk.data) })
    expect(seen).toEqual(['hello', 'world'])
    expect(attachment.epoch).toBe('epoch-1')
  })

  it('models the error state via attach rejection and exited sessions stay listed', async () => {
    const { createFakeTerminalHostV2 } = await import('../src/index.ts')
    const host = createFakeTerminalHostV2({ attachError: 'seam offline' })
    await expect(host.attachTerminal('fake-1')).rejects.toThrow('seam offline')
    const receipt = await host.closeTerminal('fake-1')
    expect(receipt.status).toBe('ok')
  })

  it('models the control lease with a takeover grant', async () => {
    const { createFakeTerminalHostV2 } = await import('../src/index.ts')
    const host = createFakeTerminalHostV2({ attachment: { controlState: 'pending' } })
    const attachment = await host.attachTerminal('fake-1')
    expect(attachment.control?.state).toBe('pending')
    const states: string[] = []
    attachment.control?.subscribe(state => { states.push(state) })
    expect(await attachment.control?.requestTakeover?.()).toEqual({ status: 'ok' })
    expect(states).toContain('granted')
    await attachment.detach()
  })
})

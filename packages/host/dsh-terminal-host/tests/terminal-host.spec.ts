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

import { describe, expect, it } from 'vitest'
import { probeTerminalCapability, TERMINAL_INTERACTIVE_CAPABILITY } from '../src/terminal-probe.js'

describe('probeTerminalCapability', () => {
  it('fails closed without the interactive PTY capability', () => {
    const projection = probeTerminalCapability({
      available: true,
      capabilities: ['TerminalHostV1'],
      sessions: [{ id: 'term:1', status: 'exited' }],
    })
    expect(projection.status).toBe('contract_mismatch')
    expect(projection.missingCapability).toBe(TERMINAL_INTERACTIVE_CAPABILITY)
    expect(projection.inputEnabled).toBe(false)
    expect(projection.sessions).toEqual([{ id: 'term:1', status: 'exited' }])
  })

  it('does not invent a stream when the owner is offline', () => {
    const projection = probeTerminalCapability(undefined)
    expect(projection.status).toBe('offline')
    expect(projection.inputEnabled).toBe(false)
    expect(projection.sessions).toEqual([])
  })

  it('enables input only when the interactive capability is present', () => {
    const projection = probeTerminalCapability({
      available: true,
      capabilities: [TERMINAL_INTERACTIVE_CAPABILITY],
      sessions: [{ id: 'term:2', status: 'running' }],
    })
    expect(projection.status).toBe('ready')
    expect(projection.inputEnabled).toBe(true)
  })
})

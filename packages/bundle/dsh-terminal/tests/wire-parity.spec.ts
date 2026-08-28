import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { TerminalPaneAdapter, TerminalPaneRemoteService, terminalPaneRemoteMarkers } from '@yeisme/dsh-terminal-host'
import { terminalPaneRemoteContribution } from '../src/client/console-remote.ts'
import type { TerminalPaneProbeResult } from '@yeisme/dsh-terminal-host'

describe('terminalPane wire parity (host ↔ client contribution)', () => {
  it('mirrors the host remote markers method-for-method', async () => {
    const ctx = new Context()
    const remote = new TerminalPaneRemoteService(ctx, new TerminalPaneAdapter({}))
    const hostMethods = terminalPaneRemoteMarkers(remote).map(marker => marker.method).sort()
    const clientMethods = terminalPaneRemoteContribution.descriptors.map(descriptor => descriptor.method).sort()
    expect(clientMethods).toEqual(hostMethods)
    expect(clientMethods).toEqual(['close', 'list', 'probe', 'read', 'send', 'signal', 'spawn'])
    await ctx.fiber.dispose()
  })

  it('host probe answer passes the client contribution result codec', async () => {
    const ctx = new Context()
    const remote = new TerminalPaneRemoteService(ctx, new TerminalPaneAdapter({}))
    const answer = await remote.probe() as TerminalPaneProbeResult
    const probeDescriptor = terminalPaneRemoteContribution.descriptors.find(descriptor => descriptor.method === 'probe')!
    expect(() => probeDescriptor.result.schema.parse(answer)).not.toThrow()
    const sessionDescriptor = terminalPaneRemoteContribution.descriptors.find(descriptor => descriptor.method === 'list')!
    expect(() => sessionDescriptor.result.schema.parse({ ok: false, code: 'service_unavailable', message: 'x' })).not.toThrow()
    expect(() => sessionDescriptor.result.schema.parse({ ok: false, code: 'not_a_code', message: 'x' })).toThrow()
    await ctx.fiber.dispose()
  })

  it('input codecs reject malformed session scope the same way the host does', async () => {
    const ctx = new Context()
    const remote = new TerminalPaneRemoteService(ctx, new TerminalPaneAdapter({}))
    const listDescriptor = terminalPaneRemoteContribution.descriptors.find(descriptor => descriptor.method === 'list')!
    expect(() => listDescriptor.parameters[0]!.codec.schema.parse({ sessionId: 's-1' })).not.toThrow()
    expect(() => listDescriptor.parameters[0]!.codec.schema.parse({})).toThrow()
    const hostAnswer = await remote.list({})
    expect(hostAnswer).toMatchObject({ ok: false, code: 'input_invalid' })
    await ctx.fiber.dispose()
  })
})

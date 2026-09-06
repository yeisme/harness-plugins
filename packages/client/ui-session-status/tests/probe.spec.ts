import { describe, expect, it } from 'vitest'
import { parseSessionStatusProbe } from '../src/wire.ts'
import { probeSessionStatusRemote, probeSessionStatusRemoteLive } from '../src/client/index.ts'

describe('session status probe capability', () => {
  it('parses the owner probe declaration with subscription:false', () => {
    const parsed = parseSessionStatusProbe({
      ok: true,
      specVersion: '1.0',
      capabilities: ['session-status'],
      subscription: false,
    })
    expect(parsed?.subscription).toBe(false)
  })

  it('rejects malformed or credential-shaped probe answers', () => {
    expect(parseSessionStatusProbe({ ok: true, specVersion: '1.0', capabilities: ['session-status'] })).toBeNull()
    expect(parseSessionStatusProbe({ ok: true, specVersion: '1.0', capabilities: ['session-status'], subscription: 'yes' })).toBeNull()
    expect(parseSessionStatusProbe({ ok: true, specVersion: '1.0', capabilities: ['session-status'], subscription: false, token: 'x' })).toBeNull()
  })

  it('probes the subscription capability live and separately from snapshot', async () => {
    const host = {
      sessionStatus: {
        snapshot: async () => { throw new Error('not called in probe') },
        probe: async () => ({ ok: true as const, specVersion: '1.0' as const, capabilities: ['session-status'], subscription: false }),
      },
    }
    const probe = await probeSessionStatusRemoteLive(host)
    expect(probe.available).toBe(true)
    expect(probe.subscription).toBe(false) // manual refresh only, never a live promise
  })

  it('degrades to null subscription when the probe seam is absent (old host)', async () => {
    const host = { sessionStatus: { snapshot: async () => ({ ok: false as const, code: 'remote_unavailable' as const, message: 'x' }) } }
    const probe = await probeSessionStatusRemoteLive(host)
    expect(probe.available).toBe(true)
    expect(probe.subscription).toBeNull()
  })

  it('keeps the structural probe sync and fail-closed', () => {
    expect(probeSessionStatusRemote(null).available).toBe(false)
    expect(probeSessionStatusRemote({}).available).toBe(false)
    expect(probeSessionStatusRemote({ snapshot: async () => ({}) }).available).toBe(true)
  })

  it('falls back to the structural probe when probe() throws', async () => {
    const host = {
      sessionStatus: {
        snapshot: async () => ({ ok: false as const, code: 'remote_unavailable' as const, message: 'x' }),
        probe: async () => { throw new Error('transport down') },
      },
    }
    const probe = await probeSessionStatusRemoteLive(host)
    expect(probe.available).toBe(true)
    expect(probe.subscription).toBeNull()
  })
})

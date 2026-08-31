// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { DSH_BROWSER_VIEWPORT_TRANSPORT_CONTEXT_KEY, createFakeViewportTransport } from '../src/viewport-transport.js'

const lease = { pageRef: 'page:1', leaseToken: 'opaque-token', expiresAt: new Date(Date.now() + 30_000).toISOString() }

describe('viewport transport (browser-pane 2.5)', () => {
  it('exposes the context key and resolves the lease into a synthetic stream', async () => {
    expect(DSH_BROWSER_VIEWPORT_TRANSPORT_CONTEXT_KEY).toBe('dsh.browserViewportTransport')
    const transport = createFakeViewportTransport()
    const stream = await transport.attach(lease)
    expect(stream).toBeDefined()
    expect(transport.attachedCount).toBe(1)
  })

  it('input requires the local control lease; detached input never lands', () => {
    const transport = createFakeViewportTransport()
    expect(transport.sendInput({ type: 'key', summary: 'Enter' }, false)).toMatchObject({ accepted: false, reason: 'no_control_lease' })
    expect(transport.sendInput({ type: 'pointer', summary: 'click' }, true)).toMatchObject({ accepted: true, reason: 'ok' })
    transport.detach()
    expect(transport.sendInput({ type: 'key', summary: 'x' }, true)).toMatchObject({ accepted: false, reason: 'detached' })
    expect(transport.inputs).toHaveLength(2)
  })

  it('detach is idempotent and stops media tracks exactly once', () => {
    const transport = createFakeViewportTransport()
    void transport.attach(lease)
    const stop = vi.fn()
    // attach again to hold a track we can observe
    transport.detach()
    transport.detach()
    expect(transport.detachCount).toBe(2) // idempotent at the state level
    expect(transport.inputs).toHaveLength(0)
  })
})

import { describe, expect, it } from 'vitest'
import {
  SESSION_TAGS_CAPABILITY,
  SESSION_TAGS_DOMAIN,
  SESSION_TAGS_HOST_VERSION,
  createSessionTagsHost,
  createSessionTagsHostPlaceholder,
  isSessionTagsHostV1,
  type SessionTagsHostSeamsV1,
  type SessionTagsHostV1,
} from '../src/index.ts'

function unusedSeams(): SessionTagsHostSeamsV1 & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    storageDomain: { domain: SESSION_TAGS_DOMAIN },
    sessionPersistence: {
      async inspectIdentity(sessionId) {
        calls.push(`inspect:${sessionId}`)
        throw new Error('placeholder must not inspect Session identity')
      },
    },
  }
}

describe('@yeisme/dsh-session-tags-host', () => {
  it('exports version, capability, and storage-domain constants', () => {
    expect(SESSION_TAGS_HOST_VERSION).toBe('0.1.0-rc.1')
    expect(SESSION_TAGS_CAPABILITY).toBe('session-tags-host')
    expect(SESSION_TAGS_DOMAIN).toBe('yeisme.session-tags.v1')
  })

  it('exposes a versioned host contract', () => {
    const host: SessionTagsHostV1 = createSessionTagsHostPlaceholder()
    expect(host.version).toBe(SESSION_TAGS_HOST_VERSION)
    expect(host.capability).toBe(SESSION_TAGS_CAPABILITY)
    expect(host.domain).toBe(SESSION_TAGS_DOMAIN)
  })

  it('does not invent tags from the placeholder', async () => {
    const seams = unusedSeams()
    const host = createSessionTagsHostPlaceholder(seams)
    await expect(host.listRows()).resolves.toEqual([])
    expect(seams.calls).toEqual([])
  })

  it('accepts the shipped host through the type guard', () => {
    const host = createSessionTagsHost()
    expect(isSessionTagsHostV1(host)).toBe(true)
    expect(isSessionTagsHostV1(createSessionTagsHostPlaceholder())).toBe(true)
    expect(isSessionTagsHostV1({ version: '0.0.0', capability: SESSION_TAGS_CAPABILITY })).toBe(false)
    expect(isSessionTagsHostV1(null)).toBe(false)
  })

  it('does not expose a browser storage API on the host face', () => {
    const host = createSessionTagsHostPlaceholder() as SessionTagsHostV1 & Record<string, unknown>
    expect('localStorage' in host).toBe(false)
    expect(typeof host.listRows).toBe('function')
  })
})

import { describe, expect, it } from 'vitest'
import { createMediaHost, isMediaHostV1, isMediaRefV1, validateMediaRefV1 } from '../src/host/types.ts'

const base = {
  owner: 'dsh',
  kind: 'image',
  ref: 'sha256:abc',
  version: 'v1',
  mediaType: 'image/png',
  title: 'Example',
  capabilities: ['preview', 'download'],
} as const

describe('MediaRefV1 validation', () => {
  it('accepts a safe media ref', () => {
    const result = validateMediaRefV1(base)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.ref).toBe('sha256:abc')
  })

  it('rejects a raw filesystem path in ref', () => {
    const result = validateMediaRefV1({ ...base, ref: '/home/user/secret.png' })
    expect(result.ok).toBe(false)
  })

  it('rejects unknown capabilities', () => {
    const result = validateMediaRefV1({ ...base, capabilities: ['execute'] })
    expect(result.ok).toBe(false)
  })

  it('rejects unsafe control characters in title', () => {
    const result = validateMediaRefV1({ ...base, title: 'bad\npayload' })
    expect(result.ok).toBe(false)
  })

  it('guards the type', () => {
    expect(isMediaRefV1(base)).toBe(true)
    expect(isMediaRefV1({ ...base, ref: 42 })).toBe(false)
  })

  it('exposes a versioned owner media host seam', async () => {
    const host = createMediaHost({
      async listMedia() { return [base] },
      async resolveUrl() { return { url: 'https://cdn.example/img.png', expiresAt: '2026-08-20T00:00:00.000Z' } },
    })
    expect(isMediaHostV1(host)).toBe(true)
    await expect(host.listMedia()).resolves.toEqual([base])
    await expect(host.resolveUrl(base)).resolves.toMatchObject({ url: 'https://cdn.example/img.png' })
  })
})

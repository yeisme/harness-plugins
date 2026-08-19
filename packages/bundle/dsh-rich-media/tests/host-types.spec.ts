import { describe, expect, it } from 'vitest'
import { isMediaRefV1, validateMediaRefV1 } from '../src/host/types.ts'

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
})

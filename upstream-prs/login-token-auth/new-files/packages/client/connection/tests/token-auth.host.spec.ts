/** Built-in token gate behavior without any provider dependency. */

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  DshTokenGate,
  type DshTokenAuthRequest,
} from '../src/token-auth.ts'

function request(headers: Record<string, string | undefined>): DshTokenAuthRequest {
  return { headers }
}

const CONFIG = {
  tokens: [
    { token: 'admin-token', scopes: ['admin' as const] },
    { token: 'tui-token', scopes: ['tui' as const] },
    { token: 'web-token', scopes: ['web' as const] },
  ],
}

describe('DshTokenGate', () => {
  it('accepts a bearer token', async () => {
    const gate = new DshTokenGate(CONFIG)
    await expect(gate.authorizeHttp(request({ authorization: 'Bearer admin-token' }))).resolves.toBe(true)
    await expect(gate.authorizeAdmin(request({ authorization: 'Bearer admin-token' }))).resolves.toBe(true)
  })

  it('accepts the custom header and exchanges an opaque browser session', async () => {
    const gate = new DshTokenGate(CONFIG)
    await expect(gate.authorizeHttp(request({ 'x-dsh-access-token': 'tui-token' }))).resolves.toBe(true)
    const exchanged = await gate.exchangeToken('web-token')
    expect(exchanged?.session).not.toContain('web-token')
    await expect(gate.authorizeHttp(request({ cookie: `dsh-session=${exchanged?.session}` }))).resolves.toBe(true)
    await expect(gate.authenticateToken('admin-token')).resolves.toMatchObject({ scopes: new Set(['admin']) })
    await expect(gate.authenticateToken('wrong')).resolves.toBeUndefined()
  })

  it('rejects missing, wrong, and malformed tokens', async () => {
    const gate = new DshTokenGate(CONFIG)
    await expect(gate.authorizeHttp(request({}))).resolves.toBe(false)
    await expect(gate.authorizeHttp(request({ authorization: 'Bearer wrong' }))).resolves.toBe(false)
    await expect(gate.authorizeHttp(request({ authorization: 'Basic abc' }))).resolves.toBe(false)
    await expect(gate.authorizeWebSocket(request({ cookie: 'dsh-session=wrong' }))).resolves.toBe(false)
  })

  it('grants admin only to admin-scoped tokens', async () => {
    const gate = new DshTokenGate(CONFIG)
    await expect(gate.authorizeAdmin(request({ authorization: 'Bearer admin-token' }))).resolves.toBe(true)
    await expect(gate.authorizeAdmin(request({ authorization: 'Bearer tui-token' }))).resolves.toBe(false)
    await expect(gate.authorizeAdmin(request({ authorization: 'Bearer web-token' }))).resolves.toBe(false)
  })

  it('defaults unspecified scopes to admin', async () => {
    const gate = new DshTokenGate({ tokens: [{ token: 'default-token' }] })
    await expect(gate.authorizeAdmin(request({ authorization: 'Bearer default-token' }))).resolves.toBe(true)
  })

  it('rejects empty token configuration at construction', () => {
    expect(() => new DshTokenGate({ tokens: [] })).toThrow(/at least one token/)
    expect(() => new DshTokenGate({ tokens: [{ token: '' }] })).toThrow(/non-empty/)
  })

  it('reloads a digest-only store so revoke invalidates existing browser sessions', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-token-gate-'))
    const storePath = join(dir, 'auth.json')
    const tokenId = 'a'.repeat(32)
    const token = `dshw_${tokenId}_secret`
    const record = {
      id: tokenId,
      name: 'remote',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      scopes: ['web'],
      createdAt: new Date().toISOString(),
    }
    writeFileSync(storePath, JSON.stringify({ version: 1, tokens: [record] }))
    const gate = new DshTokenGate({ storePath })
    const exchanged = await gate.exchangeToken(token)
    await expect(gate.authorizeHttp(request({ cookie: `dsh-session=${exchanged?.session}` }))).resolves.toBe(true)
    writeFileSync(storePath, JSON.stringify({ version: 1, tokens: [{ ...record, revokedAt: new Date().toISOString() }] }))
    await expect(gate.authorizeHttp(request({ cookie: `dsh-session=${exchanged?.session}` }))).resolves.toBe(false)
  })
})

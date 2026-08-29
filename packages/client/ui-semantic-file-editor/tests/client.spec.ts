import { describe, expect, it, vi } from 'vitest'
import { createRemoteLanguageIntelligenceHost } from '../src/client.js'

describe('remote language intelligence host', () => {
  it('sends only opaque document ownership fields', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => new Response(JSON.stringify({
      ok: true,
      value: { capability: 'LanguageIntelligenceHostV1', engine: 'ast-only', languageId: 'json', features: ['structure'], reason: 'ready' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const host = createRemoteLanguageIntelligenceHost({ fetcher: fetcher as typeof fetch })
    await host.probe({ sessionId: 'session-safe', ref: 'file-safe' })
    const request = fetcher.mock.calls[0]
    expect(String(request?.[0])).toBe('/yeisme-language/api/probe')
    const body = String(request?.[1]?.body)
    expect(JSON.parse(body)).toEqual({ sessionId: 'session-safe', ref: 'file-safe' })
    expect(body).not.toContain('cwd')
    expect(body).not.toContain('path')
  })
})

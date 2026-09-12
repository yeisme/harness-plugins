import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { SonoraSubtitleExportClient } from '../src/sonora-subtitle-export.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = {
  tenantRef: 'tenant:one', workspaceRef: 'workspace:one', projectRef: 'project:one', sessionRef: 'session:one',
  principalRef: 'principal:one', membershipRevision: '1', installationRef: 'installation:one', pluginDigest: 'digest:one', policyRevision: '1', runtimeGeneration: '1', revision: '1',
}
const input = { track_ref: 'sonora://subtitle-track/t', track_digest: 'track-digest', review_digest: 'review-digest', format: 'vtt' as const }
const resource = { schema: 'sonora.subtitle_export.v1', ref: 'sonora://subtitle-export/e', ...input, media_type: 'text/vtt', content_digest: 'a'.repeat(64), size_bytes: 40, created_at: '2026-09-08T00:00:00Z' }
const binding = { context, baseURL: 'http://127.0.0.1:8740', headers: { Authorization: 'Bearer fixture-workload' } }

const catalog = { validation_level: 'capability_probe', diagnostics_available: true, profiles: [{
  provider_id: 'fixture', model_ref: 'sonora://asr-model/fixture-v1', revision: 'fixture-asr.v1', readiness: 'first-support', fixture: true,
  supported_locales: ['zh-CN'], supported_formats: ['wav'], timestamp_modes: ['segment'], supports_speaker_labels: false,
  requires_network: false, requires_credentials: false, cost_model: 'free_fixture', max_duration_ms: 3000, max_segments: 10,
}], unavailable: [{ provider_id: 'command-asr', code: 'transcription_capability_unavailable', fixture: false }] }

describe('Sonora subtitle export public HTTP consumer', () => {
  it('reads capability probes and failed providers without turning them into execution evidence', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(catalog))
    const result = await new SonoraSubtitleExportClient(async () => binding, fetcher).readTranscriptionCatalog(context)
    expect(result).toEqual({ status: 'ready', resource: catalog })
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('http://127.0.0.1:8740/api/v1/transcription-providers')
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it('keeps legacy diagnostics unknown and preserves external runtime cost semantics', async () => {
    const legacy = { validation_level: 'capability_probe', profiles: [{ ...catalog.profiles[0], provider_id: 'command-asr', fixture: false,
      model_ref: 'sonora://asr-model/local', cost_model: 'external_runtime' }] }
    const result = await new SonoraSubtitleExportClient(async () => binding, async () => Response.json(legacy)).readTranscriptionCatalog(context)
    expect(result).toEqual({ status: 'ready', resource: legacy })
    if (result.status === 'ready') {
      expect(result.resource.diagnostics_available).toBeUndefined()
      expect(result.resource.profiles[0]).not.toHaveProperty('amount')
    }
  })

  it.each(['fixture', 'duplicate', 'diagnostics', 'unsafe-model', 'over-budget'])('rejects conflicting capability catalog: %s', async kind => {
    const invalid = structuredClone(catalog)
    if (kind === 'fixture') invalid.profiles[0]!.fixture = false
    if (kind === 'duplicate') invalid.profiles.push(invalid.profiles[0]!)
    if (kind === 'diagnostics') invalid.diagnostics_available = false
    if (kind === 'unsafe-model') invalid.profiles[0]!.model_ref = 'https://private.invalid/model'
    if (kind === 'over-budget') invalid.profiles = Array.from({ length: 65 }, () => invalid.profiles[0]!)
    expect(await new SonoraSubtitleExportClient(async () => binding, async () => Response.json(invalid)).readTranscriptionCatalog(context)).toEqual({ status: 'unknown', reason: 'unconfirmed' })
  })
  it('returns only authorized, digest-verified UTF-8 subtitle content', async () => {
    const content = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n字幕内容\n'
    const expected = { ...resource, schema: 'sonora.subtitle_export.v1' as const, format: 'vtt' as const, media_type: 'text/vtt' as const,
      size_bytes: new TextEncoder().encode(content).byteLength, content_digest: createHash('sha256').update(content).digest('hex') }
    const fetcher = vi.fn<typeof fetch>(async () => new Response(content, { headers: { 'Content-Type': 'text/vtt; charset=utf-8' } }))
    const client = new SonoraSubtitleExportClient(async () => binding, fetcher)
    expect(await client.readContent(context, expected)).toBe(content)
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('http://127.0.0.1:8740/api/v1/subtitle-exports/e/content')
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Accept')).toBe('text/vtt')
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it.each(['digest', 'short', 'long', 'mime', 'forbidden', 'utf8'])('releases no content after %s failure', async kind => {
    const bytes = kind === 'utf8' ? new Uint8Array([0xff]) : new TextEncoder().encode('WEBVTT\n')
    const expected = { ...resource, schema: 'sonora.subtitle_export.v1' as const, format: 'vtt' as const, media_type: 'text/vtt' as const,
      size_bytes: bytes.byteLength + (kind === 'short' ? 1 : kind === 'long' ? -1 : 0),
      content_digest: kind === 'digest' ? 'f'.repeat(64) : createHash('sha256').update(bytes).digest('hex') }
    const fetcher = vi.fn<typeof fetch>(async () => new Response(bytes, { status: kind === 'forbidden' ? 403 : 200,
      headers: { 'Content-Type': kind === 'mime' ? 'text/html' : 'text/vtt' } }))
    expect(await new SonoraSubtitleExportClient(async () => binding, fetcher).readContent(context, expected)).toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('recovers a lost POST response only by reading the original key', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
      if (options?.method === 'POST') throw new Error('response lost after commit')
      return Response.json(resource)
    })
    const client = new SonoraSubtitleExportClient(async () => binding, fetcher)
    expect((await client.create(context, input, 'original-key')).status).toBe('unknown')
    expect(await client.lookup(context, input, 'original-key')).toEqual({ status: 'ready', resource })
    const [url, options] = fetcher.mock.calls[1]!
    expect(String(url)).toBe('http://127.0.0.1:8740/api/v1/subtitle-exports/by-idempotency-key')
    expect(options?.method).toBe('GET')
    expect(options?.body).toBeUndefined()
    expect(new Headers(options?.headers).get('Idempotency-Key')).toBe('original-key')
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })

  it.each([401, 404, 409, 503])('does not treat lookup %s as permission to execute again', async status => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('', { status }))
    const result = await new SonoraSubtitleExportClient(async () => binding, fetcher).lookup(context, input, 'original-key')
    expect(result.status).toBe('unknown')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET')
  })
  it('pins owner versions and idempotency without exposing transport credentials', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(resource, { status: 201 }))
    const client = new SonoraSubtitleExportClient(async () => binding, fetcher)
    const result = await client.create(context, input, 'export-key')
    expect(result).toEqual({ status: 'ready', resource })
    const [url, options] = fetcher.mock.calls[0]!
    expect(String(url)).toBe('http://127.0.0.1:8740/api/v1/subtitle-exports')
    expect(options?.redirect).toBe('error')
    expect(options?.method).toBe('POST')
    expect(JSON.parse(options?.body as string)).toEqual(input)
    expect(new Headers(options?.headers).get('Idempotency-Key')).toBe('export-key')
    expect(JSON.stringify(result)).not.toMatch(/fixture-workload|127\.0\.0\.1/u)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each([401, 403, 404, 409, 400, 422])('treats owner rejection %s as terminal for this request', async status => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('private error sentinel', { status }))
    const result = await new SonoraSubtitleExportClient(async () => binding, fetcher).create(context, input, 'export-key')
    expect(result.status).toBe('rejected')
    expect(JSON.stringify(result)).not.toContain('private error')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each(['network', 'server', 'malformed', 'oversized', 'wrong-version', 'wrong-format'])('keeps %s observation unknown without resubmission', async kind => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      if (kind === 'network') throw new Error('private transport sentinel')
      if (kind === 'server') return new Response('private provider response', { status: 500 })
      if (kind === 'malformed') return new Response('{', { status: 201 })
      if (kind === 'oversized') return new Response('x'.repeat(16_385), { status: 201 })
      return Response.json({ ...resource, ...(kind === 'wrong-version' ? { track_digest: 'other' } : { format: 'srt' }) }, { status: 201 })
    })
    expect(await new SonoraSubtitleExportClient(async () => binding, fetcher).create(context, input, 'export-key')).toEqual({ status: 'unknown', reason: 'unconfirmed' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not cross a project or permission revision during credential lookup', async () => {
    const fetcher = vi.fn<typeof fetch>()
    for (const field of ['projectRef', 'principalRef', 'membershipRevision', 'sessionRef', 'runtimeGeneration'] as const) {
      const client = new SonoraSubtitleExportClient(async () => ({ ...binding, context: { ...context, [field]: 'other' } }), fetcher)
      expect(await client.create(context, input, 'key')).toEqual({ status: 'rejected', reason: 'permission_denied' })
    }
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each(['http://remote.invalid', 'https://service.invalid/path', 'https://user:pass@service.invalid', 'file:///tmp/exports'])('rejects unsafe base %s without fetching', async baseURL => {
    const fetcher = vi.fn<typeof fetch>()
    expect((await new SonoraSubtitleExportClient(async () => ({ ...binding, baseURL }), fetcher).create(context, input, 'key')).status).toBe('rejected')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('reads only the exact resource and never converts lookup into execution', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(resource))
    const client = new SonoraSubtitleExportClient(async () => binding, fetcher)
    expect(await client.read(context, resource.ref)).toEqual({ status: 'ready', resource })
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET')
    expect((await client.read(context, 'sonora://subtitle-export/other')).status).toBe('unknown')
    expect((await client.read(context, 'https://remote.invalid')).status).toBe('rejected')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

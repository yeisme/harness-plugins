import { describe, expect, it, vi } from 'vitest'
import { SonoraAuditionClient, sonoraAudioMediaType, validateSonoraArtifactAccessGrant, validateSonoraAudioAsset, validateSonoraAudioJob, type SonoraAuditionConnection } from '../src/sonora-audition.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = {
  tenantRef: 't1', workspaceRef: 'w1', projectRef: 'p1', sessionRef: 's1', principalRef: 'u1',
  membershipRevision: 'm1', installationRef: 'i1', pluginDigest: 'd1', policyRevision: 'pol1',
  runtimeGeneration: 1, revision: 'r1',
} as never

function binding(overrides: Partial<SonoraAuditionConnection> = {}): SonoraAuditionConnection {
  return { baseURL: 'http://127.0.0.1:8923/', headers: { authorization: 'Bearer x' }, context, ...overrides }
}

function jobBody(overrides: Record<string, unknown> = {}): unknown {
  return { job_id: 'job-1', state: 'succeeded', voice_plan_ref: 'sonora://voice-plan/p1', provider_id: 'fixture',
    output_asset_refs: ['sonora://audio-asset/asset-1'], updated_at: '2026-09-14T12:00:00.000Z', ...overrides }
}

function assetBody(overrides: Record<string, unknown> = {}): unknown {
  return { asset_ref: 'sonora://audio-asset/asset-1', role: 'dialogue', media_format: 'wav', digest: 'sha256:aa',
    duration_ms: 2400, permission: 'licensed', review_status: 'pending', ...overrides }
}

function grantBody(overrides: Record<string, unknown> = {}): unknown {
  return { grant_ref: 'sonora://artifact-access/grant-1', artifact_ref: 'sonora://audio-asset/asset-1', artifact_digest: 'sha256:aa',
    content_policy: 'quarantine', authorized_url: 'http://127.0.0.1:8923/api/v1/artifact-access/grant-1?t=secret-token',
    issued_at: '2026-09-14T12:00:00.000Z', expires_at: '2099-01-01T00:00:00.000Z', ...overrides }
}

describe('sonora audition schemas (§2.4)', () => {
  it('validates owner job and asset projections and rejects foreign fields', () => {
    expect(validateSonoraAudioJob(jobBody())).toMatchObject({ state: 'succeeded' })
    expect(validateSonoraAudioJob(jobBody({ state: 'maybe' }))).toBeUndefined()
    expect(validateSonoraAudioJob(jobBody({ local_path: '/tmp/x.wav' }))).toBeUndefined()
    expect(validateSonoraAudioAsset(assetBody())).toMatchObject({ digest: 'sha256:aa' })
    expect(validateSonoraAudioAsset(assetBody({ digest: '' }))).toBeUndefined()
  })

  it('keeps the access grant projection free of tokens beyond the authorized URL field', () => {
    const grant = validateSonoraArtifactAccessGrant(grantBody())
    expect(grant?.artifact_digest).toBe('sha256:aa')
    // access_token/revocation 字段不允许进入该投影（严格 schema 拒绝）。
    expect(validateSonoraArtifactAccessGrant(grantBody({ access_token: 'raw-secret' }))).toBeUndefined()
  })

  it('maps owner media formats to browser media types without transcoding claims', () => {
    expect(sonoraAudioMediaType('wav')).toBe('audio/wav')
    expect(sonoraAudioMediaType('mp3')).toBe('audio/mpeg')
    expect(sonoraAudioMediaType('future-codec')).toBe('audio/future-codec')
  })
})

describe('SonoraAuditionClient (§2.4 authorized rendition only)', () => {
  it('reads jobs and assets through the authorized connection', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const path = new URL(String(input)).pathname
      if (path === '/api/v1/audio-jobs/job-1') return Response.json(jobBody())
      if (path === '/api/v1/assets/asset-1') return Response.json(assetBody())
      return new Response('', { status: 404 })
    })
    const client = new SonoraAuditionClient(async () => binding(), fetcher as never)
    expect(await client.readJob(context, 'job-1')).toMatchObject({ status: 'ready', resource: { state: 'succeeded' } })
    expect(await client.readAsset(context, 'asset-1')).toMatchObject({ status: 'ready', resource: { digest: 'sha256:aa' } })
  })

  it('issues a per-use grant with the idempotent POST contract', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo, options?: RequestInit) => {
      expect(new URL(String(input)).pathname).toBe('/api/v1/artifacts/asset-1/access-grants')
      expect(options?.method).toBe('POST')
      return Response.json(grantBody(), { status: 201 })
    })
    const client = new SonoraAuditionClient(async () => binding(), fetcher as never)
    expect(await client.issueGrant(context, 'asset-1')).toMatchObject({ status: 'ready', resource: { artifact_digest: 'sha256:aa' } })
  })

  it('maps owner failures to typed honest reasons and keeps a lost grant POST unconfirmed', async () => {
    for (const [status, reason] of [[403, 'permission_denied'], [404, 'not_found'], [422, 'owner_rejected'], [500, 'unconfirmed']] as const) {
      const client = new SonoraAuditionClient(async () => binding(), (async () => new Response('x', { status })) as never)
      expect(await client.issueGrant(context, 'asset-1')).toEqual({ status: status === 500 ? 'unknown' : 'rejected', reason })
    }
  })

  it('requires a loopback http or https base with a matching project scope', async () => {
    const fetcher = vi.fn()
    expect(await new SonoraAuditionClient(async () => undefined, fetcher as never).readJob(context, 'job-1')).toEqual({ status: 'rejected', reason: 'unavailable' })
    expect(await new SonoraAuditionClient(async () => binding({ baseURL: 'http://example.com/' }), fetcher as never).readJob(context, 'job-1')).toEqual({ status: 'rejected', reason: 'unavailable' })
    const wrongProject = new SonoraAuditionClient(async scope => binding({ context: { ...scope, projectRef: 'p2' } as never }), fetcher as never)
    expect(await wrongProject.readJob(context, 'job-1')).toEqual({ status: 'rejected', reason: 'permission_denied' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})

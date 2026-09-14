import { describe, expect, it, vi } from 'vitest'
import { SonoraSubtitleHandoffClient, validateSonoraSubtitleHandoff, type SonoraSubtitleHandoffConnection } from '../src/sonora-subtitle-handoff.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = {
  tenantRef: 't1', workspaceRef: 'w1', projectRef: 'p1', sessionRef: 's1', principalRef: 'u1',
  membershipRevision: 'm1', installationRef: 'i1', pluginDigest: 'd1', policyRevision: 'pol1',
  runtimeGeneration: 1, revision: 'r1',
} as never

function binding(overrides: Partial<SonoraSubtitleHandoffConnection> = {}): SonoraSubtitleHandoffConnection {
  return { baseURL: 'http://127.0.0.1:8925/', headers: {}, context, ...overrides }
}

function handoffBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    ref: 'sonora://subtitle-handoff/h-1', track_ref: 'sonora://subtitle-track/t-1',
    source_transcription_ref: 'sonora://transcription/x-1', review_packet_ref: 'sonora://review-packet/r-1',
    request_digest: 'rd1', track_digest: 'td1', review_digest: 'vd1', locale: 'zh-CN', cue_count: 3,
    consumer: 'scaena', handoff_ready: true, production_acceptance: 'pending',
    created_at: '2026-09-14T12:00:00.000Z', updated_at: '2026-09-14T12:00:00.000Z', ...overrides,
  }
}

describe('sonora subtitle handoff schema (§2.5)', () => {
  it('accepts the owner handoff and keeps receipt/version/scope as separate facts', () => {
    const handoff = validateSonoraSubtitleHandoff(handoffBody())
    expect(handoff?.ref).toBe('sonora://subtitle-handoff/h-1')
    expect(handoff?.track_digest).toBe('td1')
    expect(handoff?.consumer).toBe('scaena')
    expect(handoff?.handoff_ready).toBe(true)
    expect(handoff?.production_acceptance).toBe('pending')
  })

  it('fail-closes on a foreign production acceptance value', () => {
    expect(validateSonoraSubtitleHandoff(handoffBody({ production_acceptance: 'accepted' }))).toBeUndefined()
    expect(validateSonoraSubtitleHandoff(handoffBody({ consumer: 'Scaena' }))).toBeUndefined()
  })

  it('keeps blocked handoffs as first-class resources with blockers preserved', () => {
    const blocked = validateSonoraSubtitleHandoff(handoffBody({ handoff_ready: false, blockers: ['readability_blocked'] }))
    expect(blocked?.handoff_ready).toBe(false)
    expect(blocked?.blockers).toEqual(['readability_blocked'])
  })
})

describe('SonoraSubtitleHandoffClient (§2.5)', () => {
  it('creates with the idempotency header and replays the original handoff', async () => {
    const posts: unknown[] = []
    const fetcher = vi.fn(async (input: URL | RequestInfo, options?: RequestInit) => {
      const path = new URL(String(input)).pathname
      if (path === '/api/v1/subtitle-handoffs' && options?.method === 'POST') {
        expect(new Headers(options?.headers).get('Idempotency-Key')).toBe('handoff-key-1')
        expect(JSON.parse(String(options?.body))).toEqual({ track_ref: 'sonora://subtitle-track/t-1', consumer: 'scaena' })
        posts.push(JSON.parse(String(options?.body)))
        return Response.json(handoffBody(posts.length > 1 ? { replay: true } : {}), { status: 201 })
      }
      if (path === '/api/v1/subtitle-handoffs/h-1') return Response.json(handoffBody())
      return new Response('', { status: 404 })
    })
    const client = new SonoraSubtitleHandoffClient(async () => binding(), fetcher as never)
    const first = await client.create(context, { track_ref: 'sonora://subtitle-track/t-1', consumer: 'scaena' }, 'handoff-key-1')
    expect(first).toMatchObject({ status: 'ready' })
    const replay = await client.create(context, { track_ref: 'sonora://subtitle-track/t-1', consumer: 'scaena' }, 'handoff-key-1')
    expect(replay).toMatchObject({ status: 'ready', resource: { replay: true } })
    const read = await client.read(context, 'sonora://subtitle-handoff/h-1')
    expect(read).toMatchObject({ status: 'ready', resource: { consumer: 'scaena' } })
  })

  it('maps stale review (409) and owner rejections to typed reasons without hiding them', async () => {
    for (const [status, reason] of [[409, 'conflict'], [403, 'permission_denied'], [422, 'owner_rejected'], [500, 'unconfirmed']] as const) {
      const client = new SonoraSubtitleHandoffClient(async () => binding(), (async () => new Response('x', { status })) as never)
      expect(await client.create(context, { track_ref: 'sonora://subtitle-track/t-1', consumer: 'scaena' }, 'k')).toEqual({ status: status === 500 ? 'unknown' : 'rejected', reason })
    }
  })

  it('validates input before any network call and fences the project scope', async () => {
    const fetcher = vi.fn()
    const client = new SonoraSubtitleHandoffClient(async () => binding(), fetcher as never)
    expect(await client.create(context, { track_ref: 'not-a-ref', consumer: 'scaena' }, 'k')).toEqual({ status: 'rejected', reason: 'invalid_input' })
    expect(await client.create(context, { track_ref: 'sonora://subtitle-track/t-1', consumer: 'scaena' }, 'bad key')).toEqual({ status: 'rejected', reason: 'invalid_input' })
    expect(await client.read(context, '../escape')).toEqual({ status: 'rejected', reason: 'invalid_input' })
    const wrongProject = new SonoraSubtitleHandoffClient(async scope => binding({ context: { ...scope, projectRef: 'p2' } as never }), fetcher as never)
    expect(await wrongProject.read(context, 'sonora://subtitle-handoff/h-1')).toEqual({ status: 'rejected', reason: 'permission_denied' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})

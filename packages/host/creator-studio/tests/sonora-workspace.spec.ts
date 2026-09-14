import { describe, expect, it, vi } from 'vitest'
import { SonoraWorkspaceClient, validateSonoraWorkspaceBoard, validateSonoraWorkspaceActionReceipt, type SonoraWorkspaceConnection } from '../src/sonora-workspace.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = {
  tenantRef: 't1', workspaceRef: 'w1', projectRef: 'p1', sessionRef: 's1', principalRef: 'u1',
  membershipRevision: 'm1', installationRef: 'i1', pluginDigest: 'd1', policyRevision: 'pol1',
  runtimeGeneration: 1, revision: 'r1',
} as never

function binding(overrides: Partial<SonoraWorkspaceConnection> = {}): SonoraWorkspaceConnection {
  return { baseURL: 'http://127.0.0.1:8919/', headers: { authorization: 'Bearer x' }, context, ...overrides }
}

function boardBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    spec_version: 'sonora.audio_workspace_projection.v1',
    projection_kind: 'board',
    projection_ref: 'sonora://workspace-projection/board-1',
    source: { resource_ref: 'sonora://audio-job/job-1', resource_type: 'audio-job', revision: 'rev9', digest: 'dg9' },
    generated_at: '2026-09-14T12:00:00.000Z',
    freshness: { state: 'fresh', observed_at: '2026-09-14T12:00:00.000Z', expires_at: '2099-01-01T00:00:00.000Z' },
    actions: [{
      action_id: 'act_0123456789abcdef0123', action_type: 'cancel_job', target_ref: 'sonora://audio-job/job-1',
      permission: { required_scopes: ['sonora.write'], state: 'granted' },
      expected_revision: 'rev9', input_schema_ref: 'sonora://schema/workspace-action.cancel.v1',
      idempotency: { required: true, key_scope: 'action-target' },
      confirmation: { required: true, reason_code: 'provider_cancellation_may_not_be_guaranteed' },
      availability: 'enabled',
    }],
    fallback: { mode: 'read_only', reason_code: 'none', safe_summary: 'Audio job board summary.' },
    data: { lanes: [{ lane_id: 'running', title: 'running', cards: [{ card_ref: 'sonora://workspace-card/job-1', resource_ref: 'sonora://audio-job/job-1', revision: 'rev9', title: 'Audio job', summary: 'State: running' }] }] },
    ...overrides,
  }
}

function receiptBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    spec_version: 'sonora.audio_workspace_action_receipt.v1',
    receipt_ref: 'sonora://action-receipt/abc123',
    action_id: 'act_0123456789abcdef0123', action_type: 'cancel_job', target_ref: 'sonora://audio-job/job-1',
    outcome: 'accepted', target_revision: 'rev10', findings: [], retry_classification: 'terminal',
    ...overrides,
  }
}

describe('workspace board schema (live wire)', () => {
  it('accepts the owner envelope and keeps permission/confirmation facts verbatim', () => {
    const board = validateSonoraWorkspaceBoard(boardBody())
    expect(board?.actions[0]).toMatchObject({ action_type: 'cancel_job', availability: 'enabled' })
    expect(board?.actions[0]?.permission.state).toBe('granted')
    expect(board?.actions[0]?.confirmation.reason_code).toBe('provider_cancellation_may_not_be_guaranteed')
  })

  it('rejects unknown availability, foreign spec literals, and unsafe refs', () => {
    expect(validateSonoraWorkspaceBoard(boardBody({ actions: [{ ...boardBody().actions?.[0] as object, availability: 'maybe' }] } as never))).toBeUndefined()
    expect(validateSonoraWorkspaceBoard(boardBody({ spec_version: 'sonora.audio_workspace.v0' }))).toBeUndefined()
    expect(validateSonoraWorkspaceBoard(boardBody({ data: { lanes: [{ lane_id: 'l', title: 'l', cards: [{ card_ref: 'https://evil/x', resource_ref: 'sonora://audio-job/job-1', revision: 'r', title: 't' }] }] } }))).toBeUndefined()
  })

  it('rejects receipts with a foreign production acceptance or outcome vocabulary', () => {
    expect(validateSonoraWorkspaceActionReceipt(receiptBody({ outcome: 'cancelled_locally' }))).toBeUndefined()
    expect(validateSonoraWorkspaceActionReceipt(receiptBody())).toMatchObject({ outcome: 'accepted' })
  })
})

describe('SonoraWorkspaceClient (§2.3)', () => {
  it('reads a board and maps submit outcomes without inventing a local cancel', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo, options?: RequestInit) => {
      const path = new URL(String(input)).pathname
      if (path === '/api/v1/workspace-projections/board/job-1') return Response.json(boardBody())
      if (path === '/api/v1/workspace-actions') {
        expect(options?.method).toBe('POST')
        expect(new Headers(options?.headers).get('Idempotency-Key')).toBe('cancel-key-1')
        expect(JSON.parse(String(options?.body))).toEqual({ action_id: 'act_0123456789abcdef0123', target_ref: 'sonora://audio-job/job-1', expected_revision: 'rev9', idempotency_key: 'cancel-key-1', confirmed: true })
        return Response.json(receiptBody(), { status: 201 })
      }
      return new Response('', { status: 404 })
    })
    const client = new SonoraWorkspaceClient(async () => binding(), fetcher as never)
    const board = await client.readBoard(context, 'job-1')
    expect(board).toMatchObject({ status: 'ready' })
    const receipt = await client.submitAction(context, { action_id: 'act_0123456789abcdef0123', target_ref: 'sonora://audio-job/job-1', expected_revision: 'rev9' }, 'cancel-key-1')
    expect(receipt).toMatchObject({ status: 'ready', resource: { outcome: 'accepted' } })
  })

  it('keeps a lost POST unconfirmed instead of rejected', async () => {
    const client = new SonoraWorkspaceClient(async () => binding(), (async () => { throw new Error('network lost') }) as never)
    expect(await client.submitAction(context, { action_id: 'act_x', target_ref: 'sonora://audio-job/job-1', expected_revision: 'rev9' }, 'k')).toEqual({ status: 'unknown', reason: 'unconfirmed' })
  })

  it('maps owner rejections and 409 idempotency conflicts to typed reasons', async () => {
    for (const [status, reason] of [[403, 'permission_denied'], [409, 'conflict'], [422, 'owner_rejected'], [500, 'unconfirmed']] as const) {
      const client = new SonoraWorkspaceClient(async () => binding(), (async () => new Response('x', { status })) as never)
      expect(await client.submitAction(context, { action_id: 'act_x', target_ref: 'sonora://audio-job/job-1', expected_revision: 'rev9' }, 'k')).toEqual({ status: status === 500 ? 'unknown' : 'rejected', reason })
    }
  })

  it('is honestly unavailable without a binding, a project scope, or a loopback http base', async () => {
    expect(await new SonoraWorkspaceClient(async () => undefined).readBoard(context, 'job-1')).toEqual({ status: 'rejected', reason: 'unavailable' })
    const noProject = { ...context, projectRef: undefined } as never
    expect(await new SonoraWorkspaceClient(async scope => binding({ context: scope })).readBoard(noProject, 'job-1')).toEqual({ status: 'rejected', reason: 'permission_denied' })
    expect(await new SonoraWorkspaceClient(async () => binding({ baseURL: 'http://example.com/' })).readBoard(context, 'job-1')).toEqual({ status: 'rejected', reason: 'unavailable' })
  })

  it('reads a receipt by owner receipt ref for reconcile observation', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      expect(new URL(String(input)).pathname).toBe('/api/v1/workspace-action-receipts/abc123')
      return Response.json(receiptBody())
    })
    const client = new SonoraWorkspaceClient(async () => binding(), fetcher as never)
    expect(await client.readReceipt(context, 'abc123')).toMatchObject({ status: 'ready' })
    expect(await client.readReceipt(context, '../escape')).toEqual({ status: 'rejected', reason: 'invalid_input' })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { SonoraWorksTableClient, validateSonoraWorksTable, type SonoraWorksConnection } from '../src/sonora-works-table.ts'
import { createSonoraSubtitleExportAdapter } from '../src/sonora-subtitle-adapter.ts'
import { SonoraSubtitleExportClient } from '../src/sonora-subtitle-export.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = {
  tenantRef: 't1', workspaceRef: 'w1', projectRef: 'p1', sessionRef: 's1', principalRef: 'u1',
  membershipRevision: 'm1', installationRef: 'i1', pluginDigest: 'd1', policyRevision: 'pol1',
  runtimeGeneration: 1, revision: 'r1',
} as never

function binding(overrides: Partial<SonoraWorksConnection> = {}): SonoraWorksConnection {
  return { baseURL: 'http://127.0.0.1:8917/', headers: { authorization: 'Bearer x' }, context, ...overrides }
}

/** Live-wire table envelope（internal/workspace ProjectionEnvelope + data.*）。 */
function tableBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    spec_version: 'sonora.audio_workspace_projection.v1',
    projection_kind: 'table',
    projection_ref: 'sonora://workspace-projection/abc123',
    source: { resource_ref: 'sonora://project/main', resource_type: 'project', revision: 'rev1', digest: 'd0' },
    generated_at: '2026-09-14T12:00:00.000Z',
    freshness: { state: 'fresh', observed_at: '2026-09-14T12:00:00.000Z', expires_at: '2026-09-14T12:05:00.000Z' },
    actions: [],
    fallback: { mode: 'read_only', reason_code: 'none', safe_summary: 'Audio job table summary.' },
    data: {
      columns: [
        { column_id: 'state', label: 'State', kind: 'string' },
        { column_id: 'updated_at', label: 'Updated', kind: 'timestamp' },
        { column_id: 'estimated_cost_usd', label: 'Estimated Cost', kind: 'number' },
      ],
      rows: [
        { row_ref: 'sonora://audio-job/1', revision: 'r1', cells: [
          { column_id: 'state', value: 'running', state: 'available' },
          { column_id: 'updated_at', value: '2026-09-14T11:00:00Z', state: 'available' },
          { column_id: 'estimated_cost_usd', state: 'unavailable' },
        ] },
        { row_ref: 'sonora://audio-job/2', revision: 'r2', cells: [
          { column_id: 'state', value: 'succeeded', state: 'available' },
          { column_id: 'updated_at', value: null, state: 'stale' },
        ] },
      ],
      page_cursor: 'page_2',
    },
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('validateSonoraWorksTable (live wire)', () => {
  it('accepts a well-formed envelope and preserves unknown-value cells as absent values', () => {
    const parsed = validateSonoraWorksTable(tableBody())
    expect(parsed?.data.rows).toHaveLength(2)
    // owner 对未知值（如未结算费用）省略 value：保持缺失，不伪造零值。
    expect(parsed?.data.rows[0]?.cells[2]?.value).toBeUndefined()
    expect(parsed?.data.rows[1]?.cells[1]?.value).toBeNull()
    expect(parsed?.data.page_cursor).toBe('page_2')
  })

  it('rejects rows that reference unknown columns', () => {
    expect(validateSonoraWorksTable(tableBody({ data: { columns: [{ column_id: 'state', label: 'State', kind: 'string' }], rows: [{ row_ref: 'sonora://audio-job/3', revision: 'r3', cells: [{ column_id: 'nope', value: 'x', state: 'available' }] }] } }))).toBeUndefined()
  })

  it('rejects duplicate columns and wrong spec literals', () => {
    expect(validateSonoraWorksTable(tableBody({ data: { columns: [{ column_id: 'a', label: 'A', kind: 'string' }, { column_id: 'a', label: 'A2', kind: 'string' }], rows: [] } }))).toBeUndefined()
    expect(validateSonoraWorksTable(tableBody({ spec_version: 'other.v1' }))).toBeUndefined()
    expect(validateSonoraWorksTable(tableBody({ projection_kind: 'board' }))).toBeUndefined()
  })

  it('keeps stale/expired/denied freshness honest instead of dropping the page', () => {
    expect(validateSonoraWorksTable(tableBody({ freshness: { state: 'stale', observed_at: '2026-09-14T12:00:00.000Z', expires_at: '2026-09-14T12:05:00.000Z', reason_code: 'projection_stale' } }))?.freshness.state).toBe('stale')
    const denied = validateSonoraWorksTable(tableBody({ freshness: { state: 'denied', observed_at: '2026-09-14T12:00:00.000Z', expires_at: '2026-09-14T12:05:00.000Z' } }))
    expect(denied?.freshness.state).toBe('denied')
    expect(denied?.fallback.mode).toBe('read_only')
  })

  it('bounds the owner page cursor namespace', () => {
    expect(validateSonoraWorksTable(tableBody({ data: { columns: [{ column_id: 'state', label: 'State', kind: 'string' }], rows: [], page_cursor: 'not-a-page-cursor' } }))).toBeUndefined()
    expect(validateSonoraWorksTable(tableBody({ data: { columns: [{ column_id: 'state', label: 'State', kind: 'string' }], rows: [], page_cursor: 'page_12' } }))?.data.page_cursor).toBe('page_12')
  })
})

describe('SonoraWorksTableClient (§2.1 adapter, live wire)', () => {
  it('reads the first page and passes the owner cursor on the next call', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input)
      if (!url.includes('page_cursor=')) return jsonResponse(tableBody())
      expect(url).toContain('page_cursor=page_2')
      return jsonResponse(tableBody({ data: { columns: [{ column_id: 'state', label: 'State', kind: 'string' }], rows: [] } }))
    })
    const client = new SonoraWorksTableClient(async () => binding(), fetcher as never)
    const first = await client.read(context)
    expect(first).toMatchObject({ status: 'ready' })
    const second = await client.read(context, 'page_2')
    expect(second).toMatchObject({ status: 'ready' })
  })

  it('rejects a malformed cursor before any network call', async () => {
    const fetcher = vi.fn()
    const client = new SonoraWorksTableClient(async () => binding(), fetcher as never)
    expect(await client.read(context, '../escape')).toEqual({ status: 'rejected', reason: 'invalid_input' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('is honestly unavailable without a binding or with a context mismatch', async () => {
    const client = new SonoraWorksTableClient(async () => undefined)
    expect(await client.read(context)).toEqual({ status: 'rejected', reason: 'unavailable' })
    const other = new SonoraWorksTableClient(async () => binding({ context: { ...context, projectRef: 'p2' } as never }))
    expect(await other.read(context)).toMatchObject({ status: 'rejected', reason: 'permission_denied' })
  })

  it('maps owner status codes to typed honest reasons', async () => {
    for (const [status, reason] of [[403, 'permission_denied'], [404, 'not_found'], [422, 'owner_rejected'], [500, 'unconfirmed']] as const) {
      const client = new SonoraWorksTableClient(async () => binding(), (async () => new Response('x', { status })) as never)
      expect(await client.read(context)).toEqual({ status: status === 500 ? 'unknown' : 'rejected', reason })
    }
  })

  it('rejects non-loopback plain http bindings', async () => {
    const client = new SonoraWorksTableClient(async () => binding({ baseURL: 'http://example.com/' }))
    expect(await client.read(context)).toEqual({ status: 'rejected', reason: 'unavailable' })
  })
})

describe('creator adapter readWorksTable face', () => {
  it('delegates to the works client and degrades honestly when absent', async () => {
    const exportClient = {} as SonoraSubtitleExportClient
    const without = createSonoraSubtitleExportAdapter(exportClient, async () => undefined)
    expect(await without.readWorksTable?.(context)).toEqual({ status: 'rejected', reason: 'unavailable' })
    const works = new SonoraWorksTableClient(async () => binding(), (async () => jsonResponse(tableBody())) as never)
    const withWorks = createSonoraSubtitleExportAdapter(exportClient, async () => undefined, works)
    const result = await withWorks.readWorksTable?.(context)
    expect(result).toMatchObject({ status: 'ready' })
  })
})

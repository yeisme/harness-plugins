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

function tableBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    schema: 'sonora.audio_workspace_projection.v1',
    projection_id: 'sonora://workspace-projection/table-1',
    kind: 'table',
    source: { ref: 'sonora://audio-table/main', type: 'table', revision: 'rev1', digest: 'd0' },
    freshness: 'fresh',
    fallback: 'read_only',
    columns: [{ key: 'title', label: '工作' }, { key: 'status', label: '状态' }],
    rows: [
      { row_ref: 'sonora://workspace-row/1', revision: 'r1', cells: { title: '配音-EP01', status: 'ready' } },
      { row_ref: 'sonora://workspace-row/2', revision: 'r2', cells: { title: '音效-脚步', status: null } },
    ],
    generated_at: '2026-09-11T12:00:00.000Z',
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('validateSonoraWorksTable', () => {
  it('accepts a well-formed envelope and preserves null cells', () => {
    const parsed = validateSonoraWorksTable(tableBody())
    expect(parsed?.rows).toHaveLength(2)
    expect(parsed?.rows[1]?.cells.status).toBeNull()
  })

  it('rejects rows that reference unknown columns', () => {
    expect(validateSonoraWorksTable(tableBody({ rows: [{ row_ref: 'sonora://workspace-row/3', revision: 'r3', cells: { nope: 'x' } }] }))).toBeUndefined()
  })

  it('rejects duplicate columns and wrong schema literals', () => {
    expect(validateSonoraWorksTable(tableBody({ columns: [{ key: 'a', label: 'A' }, { key: 'a', label: 'A2' }] }))).toBeUndefined()
    expect(validateSonoraWorksTable(tableBody({ schema: 'other.v1' }))).toBeUndefined()
  })

  it('keeps stale/expired/denied freshness honest instead of dropping the page', () => {
    expect(validateSonoraWorksTable(tableBody({ freshness: 'stale' }))?.freshness).toBe('stale')
    expect(validateSonoraWorksTable(tableBody({ freshness: 'denied' }))?.fallback).toBe('read_only')
  })

  it('bounds the page cursor namespace', () => {
    expect(validateSonoraWorksTable(tableBody({ next_cursor: 'not-a-sonora-cursor' }))).toBeUndefined()
    expect(validateSonoraWorksTable(tableBody({ next_cursor: 'sonora.audio_workspace.table.page.0001' }))?.next_cursor).toBe('sonora.audio_workspace.table.page.0001')
  })
})

describe('SonoraWorksTableClient (§2.1 adapter)', () => {
  it('reads the first page and passes the owner cursor on the next call', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input)
      if (!url.includes('page_cursor=')) return jsonResponse(tableBody({ next_cursor: 'sonora.audio_workspace.table.page.0001' }))
      expect(url).toContain('page_cursor=sonora.audio_workspace.table.page.0001')
      return jsonResponse(tableBody())
    })
    const client = new SonoraWorksTableClient(async () => binding(), fetcher as never)
    const first = await client.read(context)
    expect(first).toMatchObject({ status: 'ready' })
    const second = await client.read(context, 'sonora.audio_workspace.table.page.0001')
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
    expect(await client ? await other.read(context) : undefined).toMatchObject({ status: 'rejected', reason: 'permission_denied' })
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

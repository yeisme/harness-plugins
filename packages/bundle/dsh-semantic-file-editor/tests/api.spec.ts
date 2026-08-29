import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createOpaqueFileRefRegistry, FILE_OPAQUE_REF_HOST_CONTEXT_KEY } from '@yeisme/dsh-file-host/node'
import { apply } from '../lib/index.mjs'

interface CapturedRoute {
  readonly handler: (req: unknown, res: unknown) => Promise<void> | void
}

class MemoryResponse {
  status = 0
  headers: Record<string, string> = {}
  body = ''
  writeHead(status: number, headers: Record<string, string>): void { this.status = status; this.headers = headers }
  end(body?: string | Uint8Array): void { this.body = typeof body === 'string' ? body : body === undefined ? '' : Buffer.from(body).toString('utf8') }
}

function request(url: string, body: unknown = {}, method = 'POST') {
  const encoded = Buffer.from(JSON.stringify(body))
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() { if (method === 'POST') yield encoded },
  }
}

const temporary: string[] = []
afterEach(async () => {
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('semantic file editor host bundle', () => {
  it('serves opaque AST projections and same-origin Monaco assets', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'dsh-semantic-file-'))
    temporary.push(cwd)
    await writeFile(join(cwd, 'example.json'), '{"name":"semantic"}\n')
    const refs = createOpaqueFileRefRegistry()
    const entry = (await refs.list(cwd)).find(row => row.name === 'example.json')
    expect(entry).toBeDefined()

    let route: CapturedRoute | undefined
    const dispose = apply({
      webServer: { register(next) { route = next; return () => { route = undefined } } },
      sessions: { get: sessionId => sessionId === 'session-1' ? { header: { cwd } } : undefined },
      get: key => key === FILE_OPAQUE_REF_HOST_CONTEXT_KEY ? refs : undefined,
    })
    expect(route).toBeDefined()

    const openResponse = new MemoryResponse()
    await route!.handler(request('/yeisme-language/api/open', { sessionId: 'session-1', ref: entry!.id }), openResponse)
    expect(openResponse.status).toBe(200)
    const opened = JSON.parse(openResponse.body) as { ok: boolean; value: { handleId: string; documentVersion: number; modelUri: string; fileVersion: string } }
    expect(opened.ok).toBe(true)
    expect(opened.value.modelUri).toMatch(/^dsh-resource:\/\/model\//)
    expect(openResponse.body).not.toContain(cwd)

    const queryResponse = new MemoryResponse()
    await route!.handler(request('/yeisme-language/api/query', {
      handleId: opened.value.handleId,
      documentVersion: opened.value.documentVersion,
      query: { kind: 'structure' },
    }), queryResponse)
    const queried = JSON.parse(queryResponse.body) as { value: { kind: string; value: { engine: string; nodes: unknown[] } } }
    expect(queried.value.kind).toBe('structure')
    expect(queried.value.value.engine).toBe('jsonc-parser')
    expect(queried.value.value.nodes.length).toBeGreaterThan(0)
    expect(queryResponse.body).not.toContain(cwd)

    const previewResponse = new MemoryResponse()
    await route!.handler(request('/yeisme-language/api/workspaceEditPreview', {
      sessionId: 'session-1',
      draft: { title: 'Rename value', kind: 'rename', files: [{ ref: entry!.id, expectedVersion: opened.value.fileVersion, edits: [{ range: { start: { line: 0, character: 9 }, end: { line: 0, character: 17 } }, newText: 'edited' }] }] },
    }), previewResponse)
    expect(previewResponse.status).toBe(200)
    const previewed = JSON.parse(previewResponse.body) as { value: { previewId: string; files: Array<{ diff?: string }> } }
    expect(previewed.value.files[0]?.diff).toContain('edited')
    expect(previewResponse.body).not.toContain(cwd)
    const applyResponse = new MemoryResponse()
    await route!.handler(request('/yeisme-language/api/workspaceEditApply', { sessionId: 'session-1', previewId: previewed.value.previewId }), applyResponse)
    expect(JSON.parse(applyResponse.body)).toMatchObject({ ok: true, value: { status: 'ok' } })

    const assetResponse = new MemoryResponse()
    await route!.handler(request('/yeisme-language/assets/vs/loader.js', {}, 'HEAD'), assetResponse)
    expect(assetResponse.status).toBe(200)
    expect(assetResponse.headers['content-type']).toContain('javascript')
    expect(Number(assetResponse.headers['content-length'])).toBeGreaterThan(0)
    dispose()
  })

  it('returns a redacted rejection for an invalid session owner', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'dsh-semantic-file-'))
    temporary.push(cwd)
    await writeFile(join(cwd, 'private.ts'), 'export const secret = 1\n')
    const refs = createOpaqueFileRefRegistry()
    const entry = (await refs.list(cwd))[0]!
    let route: CapturedRoute | undefined
    const dispose = apply({
      webServer: { register(next) { route = next; return () => { route = undefined } } },
      sessions: { get: () => undefined },
      get: key => key === FILE_OPAQUE_REF_HOST_CONTEXT_KEY ? refs : undefined,
    })
    const response = new MemoryResponse()
    await route!.handler(request('/yeisme-language/api/open', { sessionId: 'missing', ref: entry.id }), response)
    expect(response.status).toBe(400)
    expect(response.body).toContain('semantic request was rejected')
    expect(response.body).not.toContain(cwd)
    dispose()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createExplorerFileHost, type FileTreeNodeV2, type FileTreePageV2, type FileHostV1 } from '@yeisme/dsh-file-host'
import { createOpaqueFileRefRegistry, handleYeismeFilesApi } from '@yeisme/dsh-file-host/node'
import { createFileSearchSource } from '../src/client/file-search-source.ts'

const node = (ref: string, extra: Partial<FileTreeNodeV2> = {}): FileTreeNodeV2 => ({ ref, name: `${ref}.txt`, kind: 'file', version: 'stat:1', hasChildren: false,
  sensitive: false, hidden: false, ignored: false, freshness: 'fresh', availability: { inspect: { state: 'available' }, preview: { state: 'available' }, download: { state: 'available' }, mutate: { state: 'disabled' } }, ...extra })
const page = (nodes: FileTreeNodeV2[], extra: Partial<FileTreePageV2> = {}): FileTreePageV2 => ({ workspaceRef: 'workspace:a', generation: 'owner:1', revision: 'query:1', loaded: nodes.length, truncated: false, nodes, ...extra })
const request = { query: 'report', scope: { kind: 'profile' as const }, kinds: ['file' as const, 'folder' as const], filters: {}, sort: 'relevance' as const, limit: 20 }
const signal = () => new AbortController().signal
function fixture(openFolder?: (node: FileTreeNodeV2, signal?: AbortSignal) => Promise<boolean>) {
  let result = page([node('file-a')]), context = 'session:a'
  const search = vi.fn(async () => result), reveal = vi.fn(async () => ({ workspaceRef: result.workspaceRef, generation: result.generation, revision: 'parent-tree:1', breadcrumbs: [], target: result.nodes[0] }))
  const inspect = vi.fn(async () => ({ owner: 'dsh.local', ref: 'file-a', version: 'content:hash', usable: true, sensitive: false, state: 'ready' as const }))
  const host = { treeV2: { capability: 'FileTreeProjectionCapabilityV2' as const, roots: search, listChildren: search, search, reveal }, inspect: { capability: 'FileInspectCapabilityV1' as const, inspect } }
  const open = vi.fn(async () => true)
  const source = createFileSearchSource({ host, context: () => context, open, openFolder })
  return { source, search, reveal, inspect, open, setPage: (value: FileTreePageV2) => { result = value }, setContext: (value: string) => { context = value } }
}

describe('file owner search source', () => {
  it('filters sensitive and unsafe entries, keeps folders read-only and does not inspect on search', async () => {
    const f = fixture()
    f.setPage(page([node('file-a'), node('folder', { kind: 'directory' }), node('secret', { sensitive: true }), node('hidden', { hidden: true }), node('ignored', { ignored: true }), node('link', { kind: 'symlink' })]))
    const result = await f.source.source.search(request, signal())
    expect(result.status).toBe('partial')
    expect(result.resources.map(item => [item.kind, item.availability])).toEqual([['file', 'available'], ['folder', 'unavailable']])
    expect(result.total).toBeUndefined()
    expect(f.inspect).not.toHaveBeenCalled(); expect(f.open).not.toHaveBeenCalled()
    expect(await f.source.source.search({ ...request, scope: { kind: 'workspace', ref: 'workspace:b' } }, signal())).toMatchObject({ status: 'denied', resources: [] })
    f.source.dispose()
  })
  it('binds owner cursors to scope, query and revision without claiming complete global coverage', async () => {
    const f = fixture()
    f.setPage(page([node('file-a')], { nextCursor: 'owner-next', truncated: true }))
    const first = await f.source.source.search(request, signal())
    expect(first.nextCursor).toBeTruthy(); expect(first.nextCursor).not.toBe('owner-next')
    expect(await f.source.source.search({ ...request, query: 'different', cursor: first.nextCursor }, signal())).toMatchObject({ status: 'error', resources: [] })
    expect(f.search).toHaveBeenCalledTimes(1)
    f.setPage(page([node('file-b')], { revision: 'query:2' }))
    expect(await f.source.source.search({ ...request, cursor: first.nextCursor }, signal())).toMatchObject({ status: 'error', resources: [] })
    f.source.dispose()
  })
  it('keeps metadata stat versions distinct from admitted content versions and rejects changed files', async () => {
    const f = fixture()
    const result = await f.source.source.search(request, signal())
    expect(await f.source.source.open!(result.resources[0]!, request.scope)).toEqual({ status: 'opened' })
    expect(f.open).toHaveBeenCalledWith(expect.objectContaining({ version: 'stat:1' }), expect.objectContaining({ version: 'content:hash' }))
    f.open.mockClear()
    f.setPage(page([node('file-a', { version: 'stat:2' })]))
    expect(await f.source.source.open!(result.resources[0]!, request.scope)).toEqual({ status: 'unavailable' })
    expect(f.open).not.toHaveBeenCalled()
    f.source.dispose()
  })
  it('withholds late pages after owner context changes and revokes old openings', async () => {
    const f = fixture()
    const first = await f.source.source.search(request, signal())
    let finish!: (value: FileTreePageV2) => void
    f.search.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = f.source.source.search(request, signal())
    f.setContext('session:b')
    finish(page([node('old-owner')]))
    expect(await pending).toMatchObject({ resources: [] })
    expect(await f.source.source.open!(first.resources[0]!, request.scope)).toEqual({ status: 'unavailable' })
    expect(f.open).not.toHaveBeenCalled()
    f.source.dispose()
  })
  it('revokes cached results once on permission failure without generating a retry-notification loop', async () => {
    const f = fixture()
    const first = await f.source.source.search(request, signal())
    const changed = vi.fn(); f.source.source.subscribe!(changed)
    f.search.mockRejectedValue({ status: 403 })
    expect(await f.source.source.search(request, signal())).toMatchObject({ status: 'denied', resources: [] })
    expect(await f.source.source.search(request, signal())).toMatchObject({ status: 'denied', resources: [] })
    expect(changed).toHaveBeenCalledOnce()
    expect(await f.source.source.open!(first.resources[0]!, request.scope)).toEqual({ status: 'unavailable' })
    expect(f.open).not.toHaveBeenCalled()
    f.source.dispose()
  })

  it.each([
    [{ code: 'not-found' }, 'disabled'],
    [{ code: 'bad-request' }, 'error'],
    [{ code: 'forbidden' }, 'denied'],
    [{ code: 'internal' }, 'error'],
    [{ name: 'SyntaxError' }, 'error'],
    [{ code: 'ETIMEDOUT' }, 'offline'],
  ] as const)('classifies owner failure %j as %s', async (error, status) => {
    const f = fixture(); f.search.mockRejectedValue(error)
    expect(await f.source.source.search(request, signal())).toEqual({ status, resources: [] })
    f.source.dispose()
  })

  it('preserves HTTP permission status through the original FileHost transport', async () => {
    const host = createExplorerFileHost({ sessionId: () => 'a', fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: { code: 'owner-policy', message: 'Denied by owner' } }), { status: 403 }) })
    const open = vi.fn(async () => true)
    const source = createFileSearchSource({ host, context: () => 'a', open })
    expect(await source.source.search(request, signal())).toEqual({ status: 'denied', resources: [] })
    expect(open).not.toHaveBeenCalled()
    source.dispose()
  })

  it('opens directories through the owner handoff without inspect and rejects cancellation before dispatch', async () => {
    const openFolder = vi.fn(async () => true), f = fixture(openFolder)
    const target = node('folder', { kind: 'directory' })
    f.setPage(page([target]))
    const result = await f.source.source.search(request, signal())
    expect(result.resources[0]?.availability).toBe('available')
    expect(await f.source.source.open!(result.resources[0]!, request.scope)).toEqual({ status: 'opened' })
    expect(f.inspect).not.toHaveBeenCalled()
    expect(openFolder).toHaveBeenCalledOnce()
    let finish!: (value: Awaited<ReturnType<typeof f.reveal>>) => void
    f.reveal.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const cancel = new AbortController()
    const opening = f.source.source.open!(result.resources[0]!, request.scope, cancel.signal)
    cancel.abort()
    finish({ workspaceRef: 'workspace:a', generation: 'owner:1', revision: 'parent:1', breadcrumbs: [], target })
    expect(await opening).toEqual({ status: 'unavailable' })
    expect(openFolder).toHaveBeenCalledOnce()
    f.source.dispose()
  })

  it('queries and admits an actual disposable filesystem through the original API and browser FileHost', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-search-files-'))
    const methods: string[] = []
    try {
      await writeFile(join(root, 'report-中文.txt'), 'Owned test document\n')
      await mkdir(join(root, 'report-folder'))
      await Promise.all(Array.from({ length: 501 }, (_, index) => writeFile(join(root, `entry-${String(index).padStart(3, '0')}.txt`), 'fixture')))
      const refs = createOpaqueFileRefRegistry()
      const host: FileHostV1 = createExplorerFileHost({ sessionId: () => 'file-search-session', fetchImpl: async (url, init) => {
        methods.push(url)
        let body = '', status = 200
        const req = { method: 'POST', url, async *[Symbol.asyncIterator]() { yield Buffer.from(String(init?.body ?? '')) } }
        const res = { writeHead(code: number) { status = code }, end(value: string) { body = value } }
        await handleYeismeFilesApi(req, res, { sessionCwd: () => root, opaqueRefs: refs })
        return new Response(body, { status, headers: { 'content-type': 'application/json' } })
      } })
      const open = vi.fn(async () => true)
      const source = createFileSearchSource({ host, context: () => 'file-search-session', open })
      const first = await source.source.search({ ...request, limit: 1 }, signal())
      expect(first.nextCursor).toBeTruthy()
      const second = await source.source.search({ ...request, limit: 1, cursor: first.nextCursor }, signal())
      const result = { resources: [...first.resources, ...second.resources] }
      expect(result.resources.map(item => item.title).sort()).toEqual(['report-folder', 'report-中文.txt'])
      expect((await source.source.search({ ...request, query: '中文' }, signal())).resources.map(item => item.title)).toEqual(['report-中文.txt'])
      expect(methods.every(method => method.endsWith('fs.treePageV2'))).toBe(true)
      const file = result.resources.find(item => item.kind === 'file')!
      expect(file.ref).not.toContain(root)
      expect((await host.treeV2!.reveal(file.ref)).target?.ref).toBe(file.ref)
      expect(await source.source.open!(file, request.scope)).toEqual({ status: 'opened' })
      expect(methods.some(method => method.endsWith('fs.inspectV2'))).toBe(true)
      expect(methods.every(method => !/write|mutat|upload/.test(method))).toBe(true)
      await writeFile(join(root, 'report-中文.txt'), 'Changed disposable document after search and admission\n')
      expect(await source.source.open!(file, request.scope)).toEqual({ status: 'unavailable' })
      expect(open).toHaveBeenCalledTimes(1)
      source.dispose()
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})

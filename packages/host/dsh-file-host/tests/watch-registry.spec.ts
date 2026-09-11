import { mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createOpaqueFileRefRegistry, handleYeismeFilesApi } from '../src/node.ts'
import { createWorkspaceWatchRegistry, type WorkspaceWatchHandleV1 } from '../src/watch-registry.ts'
import type { FileWatchEventV1 } from '../src/index.ts'

async function waitFor(predicate: () => boolean, timeoutMs = 4_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 40))
  }
  throw new Error('watch condition not reached in time')
}

function collect(handle: WorkspaceWatchHandleV1): { readonly events: FileWatchEventV1[]; readonly unsubscribe: () => void } {
  const events: FileWatchEventV1[] = []
  return { events, unsubscribe: handle.subscribe(event => { events.push(event) }) }
}

describe('createWorkspaceWatchRegistry (dsh-explorer-live-watch)', () => {
  const registries: ReturnType<typeof createWorkspaceWatchRegistry>[] = []
  afterEach(() => { for (const registry of registries.splice(0)) registry.dispose() })

  it('emits opaque-ref events for real create/change/delete', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-watch-'))
    const refs = createOpaqueFileRefRegistry()
    const registry = createWorkspaceWatchRegistry((workspace, target, directory) => refs.mint(workspace, target, directory))
    registries.push(registry)
    const handle = await registry.acquire(root)
    const { events, unsubscribe } = collect(handle)
    try {
      await writeFile(join(root, 'notes.md'), 'one')
      await waitFor(() => events.some(event => event.op === 'created'))
      await writeFile(join(root, 'notes.md'), 'two')
      await waitFor(() => events.some(event => event.op === 'changed'))
      await rm(join(root, 'notes.md'))
      await waitFor(() => events.some(event => event.op === 'deleted'))
      const created = events.find(event => event.op === 'created')!
      // Ref matches the deterministic minting space: same path mints the same ref.
      const { realpath } = await import('node:fs/promises')
      expect(created.entryRef).toBe(refs.mint(await realpath(root), join(await realpath(root), 'notes.md'), false).ref)
      expect(created.parentRef).toBe(refs.mint(await realpath(root), await realpath(root), true).ref)
      expect(created.sequence).toBeGreaterThan(0)
      expect(created.cursor).toBe(`g1:s${created.sequence}`)
      expect(created.occurredAt).toBeTruthy()
    } finally {
      unsubscribe()
      handle.release()
    }
  })

  it('maps a rename to deleted + created with the same parent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-watch-'))
    await writeFile(join(root, 'old.md'), 'x')
    const refs = createOpaqueFileRefRegistry()
    const registry = createWorkspaceWatchRegistry((workspace, target, directory) => refs.mint(workspace, target, directory))
    registries.push(registry)
    const handle = await registry.acquire(root)
    const { events, unsubscribe } = collect(handle)
    try {
      await rename(join(root, 'old.md'), join(root, 'new.md'))
      await waitFor(() => events.some(event => event.op === 'deleted') && events.some(event => event.op === 'created'))
      const deleted = events.find(event => event.op === 'deleted')!
      const created = events.find(event => event.op === 'created' && event.entryRef !== deleted.entryRef)!
      expect(created.parentRef).toBe(deleted.parentRef)
    } finally {
      unsubscribe()
      handle.release()
    }
  })

  it('ignores .git internals', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-watch-'))
    const refs = createOpaqueFileRefRegistry()
    const registry = createWorkspaceWatchRegistry((workspace, target, directory) => refs.mint(workspace, target, directory))
    registries.push(registry)
    const handle = await registry.acquire(root)
    const { events, unsubscribe } = collect(handle)
    try {
      await mkdir(join(root, '.git'))
      await writeFile(join(root, '.git', 'HEAD'), 'ref: refs/heads/main')
      await writeFile(join(root, 'visible.md'), 'seen')
      await waitFor(() => events.some(event => event.op === 'created'))
      expect(events.every(event => !event.entryRef.includes('git'))).toBe(true)
      await new Promise(resolve => setTimeout(resolve, 300))
      expect(events.filter(event => event.op === 'created')).toHaveLength(1)
    } finally {
      unsubscribe()
      handle.release()
    }
  })

  it('replays buffered events beyond a cursor and keeps sequences monotonic across restarts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-watch-'))
    const refs = createOpaqueFileRefRegistry()
    const registry = createWorkspaceWatchRegistry((workspace, target, directory) => refs.mint(workspace, target, directory))
    registries.push(registry)
    const first = await registry.acquire(root)
    const firstCollector = collect(first)
    await writeFile(join(root, 'a.md'), 'a')
    await writeFile(join(root, 'b.md'), 'b')
    await waitFor(() => firstCollector.events.length >= 2)
    const afterFirst = firstCollector.events[0]!
    const firstHandleCursor = first.snapshotCursor()
    firstCollector.unsubscribe()
    first.release()

    const second = await registry.acquire(root)
    const secondCollector = collect(second)
    await writeFile(join(root, 'c.md'), 'c')
    await waitFor(() => secondCollector.events.length >= 1)
    // Replay covers only the current watcher generation's buffer: the
    // restart dropped seq 2, so a g1:s1 cursor replays just seq 3 and the
    // missing seq 2 becomes a client-side gap (one-shot reconcile). A
    // fresh/garbage cursor replays nothing at all.
    expect(second.eventsSince(afterFirst.cursor).map(event => event.sequence)).toEqual([secondCollector.events[0]!.sequence])
    expect(second.eventsSince('garbage')).toEqual([])
    expect(secondCollector.events[0]!.sequence).toBeGreaterThan(firstHandleCursor === 'g1:s0' ? 0 : Number(/s(\d+)/.exec(firstHandleCursor)![1]))
    secondCollector.unsubscribe()
    second.release()
    expect(registry.activeWorkspaces()).toBe(0)
  })

  it('keeps the watcher while any subscriber remains (refcount)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-watch-'))
    const refs = createOpaqueFileRefRegistry()
    const registry = createWorkspaceWatchRegistry((workspace, target, directory) => refs.mint(workspace, target, directory))
    registries.push(registry)
    const one = await registry.acquire(root)
    const two = await registry.acquire(root)
    one.release()
    expect(registry.activeWorkspaces()).toBe(1)
    const collector = collect(two)
    await writeFile(join(root, 'still-watched.md'), 'x')
    await waitFor(() => collector.events.some(event => event.op === 'created'))
    collector.unsubscribe()
    two.release()
    expect(registry.activeWorkspaces()).toBe(0)
  })
})

describe('fs.watch.streamV1 SSE endpoint', () => {
  const servers: Server[] = []
  afterEach(() => { for (const server of servers.splice(0)) server.close() })

  function startStream(root: string): Promise<{ server: Server; body: string; close: () => void }> {
    const refs = createOpaqueFileRefRegistry()
    const registry = createWorkspaceWatchRegistry((workspace, target, directory) => refs.mint(workspace, target, directory))
    const server = createServer((req, res) => {
      void handleYeismeFilesApi(req as never, res as never, {
        sessionCwd: sessionId => sessionId === 'sess-ok' ? root : undefined,
        opaqueRefs: refs,
        watchRegistry: registry,
      })
    })
    servers.push(server)
    return new Promise(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as { readonly port: number }
        const chunks: string[] = []
        void fetch(`http://127.0.0.1:${address.port}/yeisme-files/api/fs.watch.streamV1?sessionId=sess-ok`)
          .then(response => {
            if (response.body === null) throw new Error('no stream body')
            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            const pump = (): void => {
              void reader.read().then(({ done, value }) => {
                if (value !== undefined) chunks.push(decoder.decode(value, { stream: true }))
                if (!done) pump()
              })
            }
            pump()
          })
        resolve({
          server,
          get body() { return chunks.join('') },
          close: () => registry.dispose(),
        })
      })
    })
  }

  it('streams cursor then live events over SSE', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-sse-'))
    const stream = await startStream(root)
    try {
      await waitFor(() => stream.body.includes('event: cursor'))
      await writeFile(join(root, 'hello.md'), 'hi')
      await waitFor(() => stream.body.includes('event: fs'))
      expect(stream.body).toContain('retry: 3000')
      expect(stream.body).toContain('"op":"created"')
      expect(stream.body).toContain('"entryRef":"file-')
    } finally {
      stream.close()
    }
  })

  it('rejects unknown sessions with 403 and no stream', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-sse-'))
    const refs = createOpaqueFileRefRegistry()
    const server = createServer((req, res) => {
      void handleYeismeFilesApi(req as never, res as never, {
        sessionCwd: () => undefined,
        opaqueRefs: refs,
        watchRegistry: createWorkspaceWatchRegistry((workspace, target, directory) => refs.mint(workspace, target, directory)),
      })
    })
    servers.push(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { readonly port: number }
    const response = await fetch(`http://127.0.0.1:${address.port}/yeisme-files/api/fs.watch.streamV1?sessionId=ghost`)
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'forbidden' } })
  })
})

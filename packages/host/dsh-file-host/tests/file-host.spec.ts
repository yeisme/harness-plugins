import { describe, expect, it } from 'vitest'
import {
  createExplorerFileHost,
  createFileHostFromWorkspaces,
  createFileHostFromWorkspaceTree,
  createFileHostPlaceholder,
  FILE_OPAQUE_REF_CAPABILITY,
  FILE_TREE_PROJECTION_CAPABILITY,
  FILE_TREE_PROJECTION_CAPABILITY_V2,
  FILE_WATCH_CAPABILITY,
  isFileHostV1,
  isSafeFileWatchEvent,
  probeFileTreeProjection,
  probeFileOpaqueRefs,
  probeFileWatch,
  validateFileTreeBreadcrumb,
  validateFileTreeNode,
  type FileHostV1,
} from '../src/index.ts'

describe('@yeisme/dsh-file-host', () => {
  it('exposes a versioned host contract', () => {
    const host: FileHostV1 = createFileHostPlaceholder()
    expect(host.version).toBe('0.1.0-rc.1')
    expect(host.capability).toBe('file-host')
    expect(isFileHostV1(host)).toBe(true)
  })

  it('returns an empty entry list from the placeholder', async () => {
    const host = createFileHostPlaceholder()
    await expect(host.listEntries()).resolves.toEqual([])
    await expect(host.listEntries('root')).resolves.toEqual([])
  })

  it('does not claim live watch without FileWatchCapabilityV1', () => {
    const probe = probeFileWatch(createFileHostPlaceholder())
    expect(probe.live).toBe(false)
    expect(probe.freshness).toBe('contract_mismatch')
    expect(probe.missingCapability).toBe(FILE_WATCH_CAPABILITY)
    expect(probeFileWatch(undefined).freshness).toBe('offline')
  })

  it('rejects watch events that carry host paths', () => {
    expect(isSafeFileWatchEvent({
      cursor: 'c1',
      sequence: 1,
      op: 'changed',
      entryRef: 'entry:readme',
      occurredAt: '2026-08-21T00:00:00Z',
    })).toBe(true)
    expect(isSafeFileWatchEvent({
      cursor: 'c1',
      sequence: 1,
      op: 'changed',
      entryRef: '/etc/passwd',
      occurredAt: '2026-08-21T00:00:00Z',
    })).toBe(false)
  })

  it('maps workspaces.listDirectory rows to opaque directory entries', async () => {
    const listDirectory = async (path?: string) => {
      if (path === undefined || path === '/workspace') {
        return {
          path: '/workspace',
          entries: [
            { name: 'src', path: '/workspace/src', hidden: false },
            { name: '.git', path: '/workspace/.git', hidden: true },
            { name: 'bad/name', path: '/workspace/bad/name', hidden: false },
          ],
        }
      }
      if (path === '/workspace/src') {
        return {
          path: '/workspace/src',
          entries: [{ name: 'client', path: '/workspace/src/client', hidden: false }],
        }
      }
      return { path: path ?? '/', entries: [] }
    }
    const host = createFileHostFromWorkspaces(listDirectory, () => '/workspace')
    expect(isFileHostV1(host)).toBe(true)
    expect(host.watch).toBeUndefined()
    expect(host.capabilities).toBeUndefined()
    const roots = await host.listEntries()
    expect(roots).toHaveLength(1)
    expect(roots[0]).toMatchObject({ name: 'src', kind: 'directory', capabilities: ['open'] })
    expect(JSON.stringify(roots)).not.toContain('/workspace')
    const children = await host.listEntries(roots[0]!.id)
    expect(children).toHaveLength(1)
    expect(children[0]).toMatchObject({ name: 'client', parentId: roots[0]!.id, kind: 'directory' })
    expect(JSON.stringify(children)).not.toContain('/workspace')
    await expect(host.listEntries('dir-unknown')).resolves.toEqual([])
    expect(probeFileWatch(host)).toMatchObject({
      live: false,
      freshness: 'contract_mismatch',
      missingCapability: FILE_WATCH_CAPABILITY,
    })
  })

  it('maps workspace tree rows to files and directories without raw paths', async () => {
    const host = createFileHostFromWorkspaceTree(async () => ({
      path: '/workspace',
      entries: [
        { name: 'src', path: '/workspace/src', isDir: true, hidden: false },
        { name: 'README.md', path: '/workspace/README.md', isDir: false, hidden: false },
        { name: '.env', path: '/workspace/.env', isDir: false, hidden: true },
      ],
    }), {
      readText: async () => ({ content: '# hello', truncated: false, binary: false }),
    })
    const roots = await host.listEntries()
    expect(roots.map(entry => entry.name).sort()).toEqual(['README.md', 'src'])
    expect(roots.find(entry => entry.name === 'src')).toMatchObject({ kind: 'directory' })
    expect(roots.find(entry => entry.name === 'README.md')).toMatchObject({ kind: 'text', mediaType: 'text/markdown' })
    expect(JSON.stringify(roots)).not.toContain('/workspace')
    const text = await host.readText?.(roots.find(entry => entry.name === 'README.md')!)
    expect(text).toMatchObject({ content: '# hello', truncated: false, binary: false })
  })

  it('adds edit only when a version-fenced writer is present', async () => {
    const writes: string[] = []
    const host = createFileHostFromWorkspaceTree(async () => ({
      path: '/workspace',
      entries: [{ name: 'README.md', path: '/workspace/README.md', isDir: false }],
    }), {
      readText: async () => ({ content: 'old', truncated: false, binary: false, version: 'v1' }),
      writeText: async (_path, content, expectedVersion) => {
        writes.push(`${expectedVersion}:${content}`)
        return { status: 'ok', version: 'v2' }
      },
    })
    const [editable] = await host.listEntries()
    expect(editable?.capabilities).toContain('edit')
    await expect(host.writeText?.(editable!, 'new', 'v1')).resolves.toEqual({ status: 'ok', version: 'v2' })
    expect(writes).toEqual(['v1:new'])
  })

  it('projects DOCX and media files with bounded binary preview capability', async () => {
    const host = createFileHostFromWorkspaceTree(async () => ({
      path: '/workspace',
      entries: [
        { name: 'draft.docx', path: '/workspace/draft.docx', isDir: false },
        { name: 'take.mp3', path: '/workspace/take.mp3', isDir: false },
      ],
    }), {
      readBinary: async path => ({ bytes: new Uint8Array(path.endsWith('.docx') ? [80, 75] : [1, 2, 3]), size: 3, truncated: false }),
    })
    const entries = await host.listEntries()
    const docx = entries.find(entry => entry.name === 'draft.docx')!
    const audio = entries.find(entry => entry.name === 'take.mp3')!
    expect(docx).toMatchObject({ kind: 'document', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', capabilities: ['preview', 'open'] })
    expect(audio).toMatchObject({ kind: 'file', mediaType: 'audio/mpeg', capabilities: ['preview', 'open'] })
    await expect(host.readBinary?.(docx)).resolves.toMatchObject({ bytes: new Uint8Array([80, 75]), mediaType: docx.mediaType })
    expect(JSON.stringify(entries)).not.toContain('/workspace')
  })

  it('calls the explorer API for tree listings', async () => {
    const fetchImpl = async () => ({
      json: async () => ({
        ok: true,
        value: { path: '/workspace', entries: [{ name: 'app.ts', path: '/workspace/app.ts', isDir: false }] },
      }),
    }) as unknown as typeof fetch
    const host = createExplorerFileHost({ fetchImpl, cwd: () => '/workspace' })
    const entries = await host.listEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ name: 'app.ts', kind: 'text' })
  })

  it('prefers opaque V2 entries and keeps raw paths out of client requests', async () => {
    const requests: Array<{ input: string; body: Record<string, unknown> }> = []
    const fetchImpl = async (input: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      requests.push({ input, body })
      if (input.endsWith('/fs.treeV2')) {
        return { json: async () => ({ ok: true, value: [{ id: 'file-safe123', name: 'app.ts', kind: 'text', mediaType: 'text/typescript', capabilities: ['preview', 'open', 'edit'] }] }) } as unknown as Response
      }
      if (input.endsWith('/fs.readV2')) {
        return { json: async () => ({ ok: true, value: { content: 'export {}', truncated: false, binary: false, version: 'v1' } }) } as unknown as Response
      }
      throw new Error(`unexpected request: ${input}`)
    }
    const host = createExplorerFileHost({ fetchImpl, sessionId: () => 'session-1', cwd: () => '/must-not-leak' })
    const [entry] = await host.listEntries()
    expect(entry?.id).toBe('file-safe123')
    expect(host.capabilities).toContain(FILE_OPAQUE_REF_CAPABILITY)
    expect(probeFileOpaqueRefs(host).available).toBe(true)
    await expect(host.readText?.(entry!)).resolves.toMatchObject({ content: 'export {}', version: 'v1' })
    expect(requests.every(request => !('cwd' in request.body) && !('path' in request.body))).toBe(true)
    expect(requests.at(-1)?.body).toMatchObject({ sessionId: 'session-1', ref: 'file-safe123' })
  })

  it('loads and inspects paginated V2 nodes without sending cwd', async () => {
    const requests: Array<{ input: string; body: Record<string, unknown> }> = []
    const fetchImpl = async (input: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      requests.push({ input, body })
      if (input.endsWith('/fs.treePageV2')) return { json: async () => ({ ok: true, value: { workspaceRef: 'workspace:abcd', generation: 'g1', revision: 'r1', truncated: false, loaded: 1, total: 1, nodes: [{ ref: 'file-safe', name: '.env', kind: 'file', version: 'v1', hasChildren: false, hidden: true, ignored: false, sensitive: true, availability: { inspect: { state: 'available' }, preview: { state: 'available' }, download: { state: 'available' }, mutate: { state: 'disabled' } }, freshness: 'fresh' }] } }) } as unknown as Response
      if (input.endsWith('/fs.inspectV2')) return { json: async () => ({ ok: true, value: { owner: 'dsh.local', ref: 'file-safe', version: 'v1', usable: false, state: 'unsupported', sensitive: true, reason: 'sensitive reveal confirmation required', resource: { name: '.env', kind: 'text' } } }) } as unknown as Response
      throw new Error(`unexpected request ${input}`)
    }
    const host = createExplorerFileHost({ fetchImpl, sessionId: () => 's1', cwd: () => '/must-not-leak' })
    const page = await host.treeV2?.roots()
    expect(page?.nodes[0]).toMatchObject({ name: '.env', hidden: true, sensitive: true })
    expect(host.capabilities).toContain(FILE_TREE_PROJECTION_CAPABILITY_V2)
    await expect(host.inspect?.inspect('file-safe')).resolves.toMatchObject({ usable: false, sensitive: true })
    expect(requests.every(item => item.body.sessionId === 's1' && !('cwd' in item.body) && !('path' in item.body))).toBe(true)
  })

  it('decodes owner-provided binary responses without exposing the path on entries', async () => {
    const fetchImpl = async (input: string) => ({
      json: async () => input.endsWith('/fs.tree')
        ? { ok: true, value: { path: '/workspace', entries: [{ name: 'draft.docx', path: '/workspace/draft.docx', isDir: false }] } }
        : { ok: true, value: { base64: 'UEs=', size: 2, truncated: false, version: 'v1' } },
    }) as unknown as typeof fetch
    const host = createExplorerFileHost({ fetchImpl, cwd: () => '/workspace' })
    const [entry] = await host.listEntries()
    const binary = await host.readBinary?.(entry!)
    expect([...binary!.bytes]).toEqual([80, 75])
    expect(binary).toMatchObject({ size: 2, truncated: false, version: 'v1' })
    expect(JSON.stringify(entry)).not.toContain('/workspace')
  })

  it('probes FileTreeProjectionCapabilityV1 independently of watch and rejects absolute paths', () => {
    expect(probeFileTreeProjection(createFileHostPlaceholder())).toMatchObject({
      available: false,
      missingCapability: FILE_TREE_PROJECTION_CAPABILITY,
    })
    const host: FileHostV1 = {
      ...createFileHostPlaceholder(),
      capabilities: [FILE_TREE_PROJECTION_CAPABILITY],
      tree: {
        capability: FILE_TREE_PROJECTION_CAPABILITY,
        async roots() { return [] },
        async listChildren() { return [] },
      },
    }
    expect(probeFileTreeProjection(host)).toMatchObject({ available: true, freshness: 'fresh' })
    expect(validateFileTreeNode({
      ref: 'node:src',
      name: 'src',
      kind: 'directory',
      version: 'v1',
      hasChildren: true,
      capabilities: ['open'],
      freshness: 'fresh',
    }).ok).toBe(true)
    expect(validateFileTreeNode({
      ref: '/workspace/src',
      name: 'src',
      kind: 'directory',
      version: 'v1',
      hasChildren: true,
      capabilities: ['open'],
      freshness: 'fresh',
    }).ok).toBe(false)
    expect(validateFileTreeBreadcrumb([{ ref: 'node:src', name: 'src' }])).toBe(true)
    expect(validateFileTreeBreadcrumb([{ ref: '/etc/passwd', name: 'passwd' }])).toBe(false)
    expect(probeFileWatch(host).live).toBe(false)
  })

  it('enables live watch only when capability and watch() are both present', () => {
    const host: FileHostV1 = {
      ...createFileHostPlaceholder(),
      capabilities: [FILE_WATCH_CAPABILITY],
      watch() {
        return {
          capability: FILE_WATCH_CAPABILITY,
          subscribe() { return () => {} },
          snapshotCursor() { return 'c0' },
        }
      },
    }
    expect(probeFileWatch(host)).toMatchObject({ live: true, freshness: 'fresh' })
  })
})

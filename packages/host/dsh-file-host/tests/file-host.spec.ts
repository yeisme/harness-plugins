import { describe, expect, it } from 'vitest'
import {
  createExplorerFileHost,
  createFileHostFromWorkspaces,
  createFileHostFromWorkspaceTree,
  createFileHostPlaceholder,
  FILE_TREE_PROJECTION_CAPABILITY,
  FILE_WATCH_CAPABILITY,
  isFileHostV1,
  isSafeFileWatchEvent,
  probeFileTreeProjection,
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
    expect(text).toEqual({ content: '# hello', truncated: false, binary: false })
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

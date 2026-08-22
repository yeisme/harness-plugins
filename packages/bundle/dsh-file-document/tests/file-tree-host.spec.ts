import { describe, expect, it, vi } from 'vitest'
import { createFileTreeHostAdapter, type FileTreeDirectoryListingLike } from '../src/file-tree-host.ts'

describe('createFileTreeHostAdapter', () => {
  it('maps directory rows to safe FileEntryV1 projections without raw paths', async () => {
    const listing: FileTreeDirectoryListingLike = {
      path: '/workspace',
      entries: [
        { name: 'src', path: '/workspace/src', hidden: false },
        { name: 'docs', path: '/workspace/docs', hidden: false },
      ],
    }
    const listDirectory = vi.fn(async () => listing)
    const adapter = createFileTreeHostAdapter(listDirectory)
    const entries = await adapter.listEntries()
    expect(listDirectory).toHaveBeenCalledWith(undefined, undefined)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ name: 'src', kind: 'directory', capabilities: ['open'] })
    expect(entries[0]!.parentId).toBeUndefined()
    expect(JSON.stringify(entries)).not.toContain('/workspace')
    expect(adapter.resolvePath(entries[0]!.id)).toBe('/workspace/src')
  })

  it('attaches parentId and filters hidden rows', async () => {
    const listing: FileTreeDirectoryListingLike = {
      path: '/workspace/src',
      entries: [
        { name: 'client', path: '/workspace/src/client', hidden: false },
        { name: '.hidden', path: '/workspace/src/.hidden', hidden: true },
      ],
    }
    const adapter = createFileTreeHostAdapter(async () => listing)
    const parentId = 'dir-abc'
    const entries = await adapter.listEntries({ path: '/workspace/src', parentId })
    expect(entries).toHaveLength(1)
    expect(entries[0]!.parentId).toBe(parentId)
    expect(entries[0]!.name).toBe('client')
  })

  it('propagates listing errors for retry surfaces', async () => {
    const adapter = createFileTreeHostAdapter(async () => { throw new Error('directory-unreadable') })
    await expect(adapter.listEntries()).rejects.toThrow('directory-unreadable')
  })
})

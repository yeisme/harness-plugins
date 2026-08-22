/**
 * File tree Host adapter.
 *
 * This adapter turns an on-demand directory listing (for example DSH's
 * `ctx.workspaces.listDirectory`) into safe `FileEntryV1` projections. It
 * keeps the absolute host path inside an internal map and never puts it into
 * the browser-visible entry.
 *
 * @module @yeisme/dsh-file-document/file-tree-host
 */

import type { FileEntryV1 } from './types.ts'

/** Minimal structural shape of one directory row. */
export interface FileTreeDirectoryEntryLike {
  readonly name: string
  readonly path: string
  readonly hidden?: boolean
}

/** Minimal structural shape of a directory listing response. */
export interface FileTreeDirectoryListingLike {
  readonly path: string
  readonly entries: readonly FileTreeDirectoryEntryLike[]
}

export interface FileTreeListRequest {
  /** Absolute host path to list; absent lists the host/workspace root. */
  readonly path?: string
  /** Opaque parent entry id to attach children to. */
  readonly parentId?: string
}

export interface FileTreeHostAdapter {
  listEntries(request?: FileTreeListRequest, signal?: AbortSignal): Promise<readonly FileEntryV1[]>
  resolvePath(entryId: string): string | undefined
}

type ListDirectory = (path?: string, signal?: AbortSignal) => Promise<FileTreeDirectoryListingLike>

const ID_PREFIX = 'dir-'
const ID_RE = /^[A-Za-z0-9._~-]{1,128}$/

function hashPath(path: string): string {
  let hash = 2166136261
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function safeId(id: string): boolean {
  return ID_RE.test(id) && id.length <= 128
}

/**
 * Create an adapter over a directory listing function. The returned entries
 * are directories only; file/document kinds remain a future DSH fs seam.
 */
export function createFileTreeHostAdapter(listDirectory: ListDirectory): FileTreeHostAdapter {
  const paths = new Map<string, string>()

  const entryId = (path: string): string => {
    const id = `${ID_PREFIX}${hashPath(path)}`
    paths.set(id, path)
    return id
  }

  return {
    async listEntries(request, signal) {
      const listing = await listDirectory(request?.path, signal)
      const parentId = request?.parentId
      return listing.entries
        .filter(entry => entry.hidden !== true)
        .map(entry => {
          const id = entryId(entry.path)
          if (!safeId(id)) throw new Error(`file tree generated unsafe entry id for ${entry.name}`)
          return {
            id,
            ...(parentId === undefined ? {} : { parentId }),
            name: entry.name,
            kind: 'directory' as const,
            capabilities: ['open'] as const,
          }
        })
    },
    resolvePath(entryId) {
      return paths.get(entryId)
    },
  }
}

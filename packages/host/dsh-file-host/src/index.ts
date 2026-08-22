/**
 * @yeisme/dsh-file-host.
 *
 * This package adapts DSH fs/attachment services into safe `FileEntryV1`
 * projections for the desktop workbench file tree and preview. It does not
 * own filesystem state or document parsing.
 *
 * @module @yeisme/dsh-file-host
 */

import type { FileEntryV1 } from '@yeisme/dsh-file-document'

export const FILE_WATCH_CAPABILITY = 'FileWatchCapabilityV1'

export type FileWatchFreshness = 'unknown' | 'stale' | 'offline' | 'contract_mismatch' | 'fresh'
export type FileWatchOp = 'created' | 'changed' | 'deleted' | 'renamed'

export interface FileWatchEventV1 {
  readonly cursor: string
  readonly sequence: number
  readonly op: FileWatchOp
  readonly entryRef: string
  readonly parentRef?: string
  readonly occurredAt: string
}

export interface FileWatchHandle {
  readonly capability: typeof FILE_WATCH_CAPABILITY
  subscribe(listener: (event: FileWatchEventV1) => void): () => void
  snapshotCursor(): string
}

export interface FileTextReadV1 {
  readonly content: string
  readonly truncated: boolean
  readonly binary: boolean
}

export interface FileHostV1 {
  readonly version: '0.1.0-rc.1'
  readonly capability: 'file-host'
  /** Lists child entries for an opaque parent ref; undefined means roots. */
  listEntries(parentRef?: string): Promise<readonly FileEntryV1[]>
  /** Optional owner-authorized short-lived preview source for one entry. */
  resolvePreviewUrl?(entry: FileEntryV1): string | undefined
  /** Optional on-demand text read for one opaque entry. Absent for directory-only browse. */
  readText?(entry: FileEntryV1): Promise<FileTextReadV1 | undefined>
  /** Optional capability names advertised by the file owner. */
  readonly capabilities?: readonly string[]
  /** Optional live watch handle. Absent unless FileWatchCapabilityV1 is present. */
  watch?(parentRef?: string): FileWatchHandle
}

export interface FileWatchProbe {
  readonly live: boolean
  readonly freshness: FileWatchFreshness
  readonly missingCapability?: string
  readonly reason: string
}

/** Optional Cordis context key used by Desktop Workbench when a real file owner is mounted. */
export const FILE_HOST_CONTEXT_KEY = 'dsh.fileHost' as const

/** Runtime guard for an owner-provided safe file projection service. */
export function isFileHostV1(value: unknown): value is FileHostV1 {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<FileHostV1>
  return candidate.version === '0.1.0-rc.1'
    && candidate.capability === 'file-host'
    && typeof candidate.listEntries === 'function'
    && (candidate.resolvePreviewUrl === undefined || typeof candidate.resolvePreviewUrl === 'function')
    && (candidate.readText === undefined || typeof candidate.readText === 'function')
    && (candidate.watch === undefined || typeof candidate.watch === 'function')
}

const UNSAFE_WATCH = /(?:^|[:/\\])(?:etc|home|usr|var|tmp)|file:\/\/|authorization|cookie|token/i

export function isSafeFileWatchEvent(event: FileWatchEventV1): boolean {
  const blob = `${event.cursor}|${event.entryRef}|${event.parentRef ?? ''}|${event.occurredAt}`
  return event.entryRef.length > 0
    && event.entryRef.length <= 160
    && event.cursor.length > 0
    && !UNSAFE_WATCH.test(blob)
}

/** Probe live watch. Missing capability is not live and must not be polled. */
export function probeFileWatch(host: FileHostV1 | undefined): FileWatchProbe {
  if (host === undefined) {
    return { live: false, freshness: 'offline', reason: 'file owner is offline' }
  }
  const capabilities = host.capabilities ?? []
  if (!capabilities.includes(FILE_WATCH_CAPABILITY) || typeof host.watch !== 'function') {
    return {
      live: false,
      freshness: 'contract_mismatch',
      missingCapability: FILE_WATCH_CAPABILITY,
      reason: `missing ${FILE_WATCH_CAPABILITY}`,
    }
  }
  return { live: true, freshness: 'fresh', reason: 'file watch available' }
}

/** Placeholder host adapter used until real DSH fs/attachment seams are wired. */
export function createFileHostPlaceholder(): FileHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'file-host',
    async listEntries() {
      return []
    },
  }
}

/** Minimal structural shape of one DSH `listDirectory` row. */
export interface WorkspaceDirectoryEntryLike {
  readonly name: string
  readonly path: string
  readonly hidden?: boolean
}

/** Minimal structural shape of a DSH `listDirectory` response. */
export interface WorkspaceDirectoryListingLike {
  readonly path: string
  readonly entries: readonly WorkspaceDirectoryEntryLike[]
}

export type ListWorkspaceDirectory = (
  path?: string,
  signal?: AbortSignal,
) => Promise<WorkspaceDirectoryListingLike>

/** One explorer row from a host-side directory listing (files and directories). */
export interface WorkspaceTreeEntryLike {
  readonly name: string
  readonly path: string
  readonly isDir: boolean
  readonly hidden?: boolean
}

export interface WorkspaceTreeListingLike {
  readonly path: string
  readonly entries: readonly WorkspaceTreeEntryLike[]
  readonly truncated?: boolean
}

export type ListWorkspaceTree = (
  path?: string,
  signal?: AbortSignal,
) => Promise<WorkspaceTreeListingLike>

export type ReadWorkspaceText = (
  path: string,
  signal?: AbortSignal,
) => Promise<FileTextReadV1>

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

/**
 * On-demand FileHostV1 over DSH `ctx.workspaces.listDirectory`.
 *
 * Host paths stay in an internal map. Projections are opaque directory
 * entries only. This adapter never claims FileWatchCapabilityV1.
 */
export function createFileHostFromWorkspaces(
  listDirectory: ListWorkspaceDirectory,
  resolveRootPath?: () => string | undefined,
): FileHostV1 {
  const paths = new Map<string, string>()

  const entryIdFor = (path: string): string => {
    const id = `${ID_PREFIX}${hashPath(path)}`
    paths.set(id, path)
    return id
  }

  const mapListing = (
    listing: WorkspaceDirectoryListingLike,
    parentId?: string,
  ): readonly FileEntryV1[] => listing.entries
    .filter(entry => entry.hidden !== true)
    .flatMap(entry => {
      if (entry.name.length === 0 || entry.name.length > 200 || /[\\/\r\n]/.test(entry.name)) {
        return []
      }
      const id = entryIdFor(entry.path)
      if (!ID_RE.test(id)) return []
      const projected: FileEntryV1 = {
        id,
        ...(parentId === undefined ? {} : { parentId }),
        name: entry.name,
        kind: 'directory',
        capabilities: ['open'],
      }
      return [projected]
    })

  return {
    version: '0.1.0-rc.1',
    capability: 'file-host',
    async listEntries(parentRef) {
      if (parentRef === undefined) {
        const listing = await listDirectory(resolveRootPath?.())
        return mapListing(listing)
      }
      const path = paths.get(parentRef)
      if (path === undefined) return []
      const listing = await listDirectory(path)
      return mapListing(listing, parentRef)
    },
  }
}

const TEXT_EXT = new Set([
  '.md', '.txt', '.json', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.html', '.htm',
  '.yml', '.yaml', '.toml', '.xml', '.sh', '.go', '.rs', '.py', '.svg',
])
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif', '.ico'])
const ARCHIVE_EXT = new Set(['.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z'])

function extensionOf(name: string): string {
  const at = name.lastIndexOf('.')
  return at <= 0 ? '' : name.slice(at).toLowerCase()
}

function kindFromEntry(name: string, isDir: boolean): FileEntryV1['kind'] {
  if (isDir) return 'directory'
  const ext = extensionOf(name)
  if (TEXT_EXT.has(ext)) return 'text'
  if (IMAGE_EXT.has(ext)) return 'image'
  if (ext === '.pdf') return 'pdf'
  if (ARCHIVE_EXT.has(ext)) return 'archive'
  return 'file'
}

function mediaTypeOf(kind: FileEntryV1['kind'], name: string): string | undefined {
  const ext = extensionOf(name)
  if (kind === 'text') {
    if (ext === '.json') return 'application/json'
    if (ext === '.md') return 'text/markdown'
    if (ext === '.html' || ext === '.htm') return 'text/html'
    return 'text/plain'
  }
  if (kind === 'pdf') return 'application/pdf'
  if (kind === 'image') {
    if (ext === '.png') return 'image/png'
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
    if (ext === '.gif') return 'image/gif'
    if (ext === '.webp') return 'image/webp'
    if (ext === '.svg') return 'image/svg+xml'
    return 'image/*'
  }
  return undefined
}

function capabilitiesOf(kind: FileEntryV1['kind']): FileEntryV1['capabilities'] {
  if (kind === 'directory') return ['open']
  if (kind === 'text' || kind === 'pdf' || kind === 'image' || kind === 'document') return ['preview', 'open']
  return ['open']
}

/**
 * On-demand FileHostV1 over a host explorer listing that includes files.
 *
 * Adapted from the DSH-better-sidebar explorer contract (`fs.tree` / `fs.read`):
 * list one workspace level with file rows, keep host paths off the projection,
 * and optionally read text for preview. Does not claim FileWatchCapabilityV1.
 */
export function createFileHostFromWorkspaceTree(
  listTree: ListWorkspaceTree,
  options?: {
    resolveRootPath?: () => string | undefined
    readText?: ReadWorkspaceText
  },
): FileHostV1 {
  const paths = new Map<string, string>()

  const entryIdFor = (path: string, isDir: boolean): string => {
    const id = `${isDir ? 'dir' : 'file'}-${hashPath(path)}`
    paths.set(id, path)
    return id
  }

  const mapListing = (
    listing: WorkspaceTreeListingLike,
    parentId?: string,
  ): readonly FileEntryV1[] => listing.entries
    .filter(entry => entry.hidden !== true)
    .flatMap(entry => {
      if (entry.name.length === 0 || entry.name.length > 200 || /[\\/\r\n]/.test(entry.name)) {
        return []
      }
      const kind = kindFromEntry(entry.name, entry.isDir)
      const id = entryIdFor(entry.path, entry.isDir)
      if (!ID_RE.test(id)) return []
      const mediaType = mediaTypeOf(kind, entry.name)
      const projected: FileEntryV1 = {
        id,
        ...(parentId === undefined ? {} : { parentId }),
        name: entry.name,
        kind,
        ...(mediaType === undefined ? {} : { mediaType }),
        capabilities: capabilitiesOf(kind),
      }
      return [projected]
    })

  const host: FileHostV1 = {
    version: '0.1.0-rc.1',
    capability: 'file-host',
    async listEntries(parentRef) {
      if (parentRef === undefined) {
        const listing = await listTree(options?.resolveRootPath?.())
        return mapListing(listing)
      }
      const path = paths.get(parentRef)
      if (path === undefined) return []
      const listing = await listTree(path)
      return mapListing(listing, parentRef)
    },
  }
  if (options?.readText === undefined) return host
  return {
    ...host,
    async readText(entry) {
      if (entry.kind === 'directory') return undefined
      const path = paths.get(entry.id)
      if (path === undefined) return undefined
      return options.readText!(path)
    },
  }
}

export interface ExplorerFileHostOptions {
  sessionId?: () => string | undefined
  cwd?: () => string | undefined
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
}

export interface GitStatusFileV1 {
  readonly path: string
  readonly index: string
  readonly worktree: string
}

export interface GitStatusV1 {
  readonly branch: string
  readonly files: readonly GitStatusFileV1[]
}

export interface GitDiffV1 {
  readonly path: string
  readonly patch: string
  readonly truncated: boolean
}

export interface GitMutationReceiptV1 {
  readonly status: 'ok' | 'rejected'
  readonly actionId: string
  readonly reason?: string
}

export interface GitExplorerHostV1 {
  readonly capabilities: readonly string[]
  status(): Promise<GitStatusV1>
  diff(path: string): Promise<GitDiffV1>
  stage(path: string): Promise<GitMutationReceiptV1>
  unstage(path: string): Promise<GitMutationReceiptV1>
  commit(message: string): Promise<GitMutationReceiptV1>
}

/**
 * Browser FileHostV1 over `/yeisme-files/api` (`fs.tree` / `fs.read`).
 * Same explorer contract as DSH-better-sidebar, different route prefix.
 */
export function createExplorerFileHost(options: ExplorerFileHostOptions = {}): FileHostV1 {
  const fetchFn = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined)
  if (fetchFn === undefined) {
    return createFileHostPlaceholder()
  }
  const call = async (method: string, extra: Record<string, unknown>): Promise<unknown> => {
    const sessionId = options.sessionId?.()
    const cwd = options.cwd?.()
    const response = await fetchFn(`/yeisme-files/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(sessionId === undefined || sessionId === '' ? {} : { sessionId }),
        ...(cwd === undefined || cwd === '' ? {} : { cwd }),
        ...extra,
      }),
    })
    const parsed = await response.json() as { ok?: boolean; value?: unknown; error?: { message?: string } }
    if (parsed.ok !== true) {
      throw new Error(parsed.error?.message ?? `HTTP ${response.status}`)
    }
    return parsed.value
  }
  return createFileHostFromWorkspaceTree(
    async path => call('fs.tree', path === undefined ? {} : { path }) as Promise<WorkspaceTreeListingLike>,
    {
      readText: async path => call('fs.read', { path }) as Promise<FileTextReadV1>,
    },
  )
}

/** Browser Git host over `/yeisme-files/api/git.*` typed methods. */
export function createExplorerGitHost(options: ExplorerFileHostOptions = {}): GitExplorerHostV1 | undefined {
  const fetchFn = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined)
  if (fetchFn === undefined) return undefined
  const call = async (method: string, extra: Record<string, unknown> = {}): Promise<unknown> => {
    const sessionId = options.sessionId?.()
    const cwd = options.cwd?.()
    const response = await fetchFn(`/yeisme-files/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(sessionId === undefined || sessionId === '' ? {} : { sessionId }),
        ...(cwd === undefined || cwd === '' ? {} : { cwd }),
        ...extra,
      }),
    })
    const parsed = await response.json() as { ok?: boolean; value?: unknown; error?: { message?: string } }
    if (parsed.ok !== true) {
      throw new Error(parsed.error?.message ?? `HTTP ${response.status}`)
    }
    return parsed.value
  }
  return {
    capabilities: ['GitTypedActionsCapabilityV1'],
    status: async () => call('git.status') as Promise<GitStatusV1>,
    diff: async path => call('git.diff', { path }) as Promise<GitDiffV1>,
    stage: async path => call('git.stage', { path }) as Promise<GitMutationReceiptV1>,
    unstage: async path => call('git.unstage', { path }) as Promise<GitMutationReceiptV1>,
    commit: async message => call('git.commit', { message }) as Promise<GitMutationReceiptV1>,
  }
}

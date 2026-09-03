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
import type {
  GitCompareSessionCapabilityV1,
  GitDiffWindowCapabilityV2,
  GitHistoryWindowCapabilityV1,
  GitMutationActionsCapabilityV2,
  GitStatusWindowCapabilityV1,
} from '@yeisme/dsh-git-host'

export const FILE_WATCH_CAPABILITY = 'FileWatchCapabilityV1'
export const FILE_TREE_PROJECTION_CAPABILITY = 'FileTreeProjectionCapabilityV1'
export const FILE_TREE_PROJECTION_CAPABILITY_V2 = 'FileTreeProjectionCapabilityV2'
export const FILE_INSPECT_CAPABILITY = 'FileInspectCapabilityV1'
export const FILE_TEXT_WRITE_CAPABILITY = 'FileTextWriteCapabilityV1'
export const FILE_OPAQUE_REF_CAPABILITY = 'FileOpaqueRefCapabilityV1'
export const FILE_WORKSPACE_EDIT_CAPABILITY = 'FileWorkspaceEditCapabilityV1'

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
  /** Owner-issued version fence required before editing. */
  readonly version?: string
}

/** Bounded binary payload resolved by the file owner. Raw paths never cross this contract. */
export interface FileBinaryReadV1 {
  readonly bytes: Uint8Array
  /** Full encoded file size, even when the payload is omitted because it exceeds the limit. */
  readonly size: number
  readonly truncated: boolean
  readonly mediaType?: string
  readonly version?: string
}

export interface FileTextWriteReceiptV1 {
  readonly status: 'ok' | 'conflict' | 'rejected'
  readonly version?: string
  readonly reason?: string
}

export interface FileWorkspaceTextEditV1 {
  readonly start: number
  readonly end: number
  readonly newText: string
}

export interface FileWorkspaceEditTargetV1 {
  readonly ref: string
  readonly expectedVersion: string
  readonly edits: readonly FileWorkspaceTextEditV1[]
}

export interface FileWorkspaceEditDraftV1 {
  readonly targets: readonly FileWorkspaceEditTargetV1[]
}

export interface FileWorkspaceEditPreviewFileV1 {
  readonly ref: string
  readonly editCount: number
  readonly beforeBytes: number
  readonly afterBytes: number
  /** Bounded owner-generated preview; never contains a filesystem path. */
  readonly diff?: string
}

export interface FileWorkspaceEditPreviewV1 {
  readonly previewId: string
  readonly expiresAt: string
  readonly files: readonly FileWorkspaceEditPreviewFileV1[]
}

export interface FileWorkspaceEditReceiptV1 {
  readonly status: 'ok' | 'conflict' | 'rejected' | 'rolled-back' | 'partial'
  readonly previewId: string
  readonly files: readonly {
    readonly ref: string
    readonly status: 'ok' | 'conflict' | 'rejected' | 'rolled-back' | 'failed'
    readonly version?: string
    readonly reason?: string
  }[]
  readonly reason?: string
}

/** Additive multi-file text mutation surface. It never accepts paths or resource operations. */
export interface FileWorkspaceEditHostV1 {
  readonly version: '0.1.0-rc.1'
  readonly capability: typeof FILE_WORKSPACE_EDIT_CAPABILITY
  preview(draft: FileWorkspaceEditDraftV1): Promise<FileWorkspaceEditPreviewV1>
  apply(previewId: string): Promise<FileWorkspaceEditReceiptV1>
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
  /** Optional bounded binary read for document/media preview. */
  readBinary?(entry: FileEntryV1): Promise<FileBinaryReadV1 | undefined>
  /** Optional version-fenced text write. Browser callers never submit a path. */
  writeText?(entry: FileEntryV1, content: string, expectedVersion: string): Promise<FileTextWriteReceiptV1>
  /** Optional capability names advertised by the file owner. */
  readonly capabilities?: readonly string[]
  /** Optional live watch handle. Absent unless FileWatchCapabilityV1 is present. */
  watch?(parentRef?: string): FileWatchHandle
  /** Optional owner-issued tree projection. Absent unless FileTreeProjectionCapabilityV1 is present. */
  tree?: FileTreeProjectionCapabilityV1
  /** Additive paginated owner projection. */
  treeV2?: FileTreeProjectionCapabilityV2
  /** Additive metadata/preview admission proof. */
  inspect?: FileInspectCapabilityV1
  mutations?: FileResourceMutationCapabilityV1
  transfer?: FileTransferCapabilityV1
}

export interface FileOpaqueRefProbeV1 {
  readonly available: boolean
  readonly capability: typeof FILE_OPAQUE_REF_CAPABILITY
  readonly reason: string
}

export function probeFileOpaqueRefs(host: FileHostV1 | undefined): FileOpaqueRefProbeV1 {
  const available = host?.capabilities?.includes(FILE_OPAQUE_REF_CAPABILITY) === true
  return {
    available,
    capability: FILE_OPAQUE_REF_CAPABILITY,
    reason: available ? 'opaque file refs available' : `missing ${FILE_OPAQUE_REF_CAPABILITY}`,
  }
}

export type FileTreeNodeKindV1 = 'file' | 'directory' | 'symlink'
export type FileTreeFreshnessV1 = FileWatchFreshness

export interface FileTreeBreadcrumbSegmentV1 {
  readonly ref: string
  readonly name: string
}

export interface FileTreeNodeV1 {
  readonly ref: string
  readonly parentRef?: string
  readonly name: string
  readonly kind: FileTreeNodeKindV1
  readonly version: string
  readonly hasChildren: boolean
  readonly capabilities: readonly string[]
  readonly gitDecoration?: string
  readonly symlinkKind?: 'file' | 'directory' | 'unknown'
  readonly freshness: FileTreeFreshnessV1
}

export interface FileTreeProjectionCapabilityV1 {
  readonly capability: typeof FILE_TREE_PROJECTION_CAPABILITY
  roots(): Promise<readonly FileTreeNodeV1[]>
  listChildren(ref: string): Promise<readonly FileTreeNodeV1[]>
  reveal?(ref: string): Promise<readonly FileTreeBreadcrumbSegmentV1[]>
  search?(query: string): Promise<readonly FileTreeNodeV1[]>
  subscribe?(listener: (nodes: readonly FileTreeNodeV1[]) => void): () => void
}

export type FileAvailabilityStateV1 = 'available' | 'disabled' | 'unavailable' | 'stale'

export interface FileTypedAvailabilityV1 {
  readonly state: FileAvailabilityStateV1
  readonly reason?: string
}

export interface FileTreeNodeV2 {
  readonly ref: string
  readonly parentRef?: string
  readonly name: string
  readonly kind: FileTreeNodeKindV1
  readonly version: string
  readonly hasChildren: boolean
  readonly hidden: boolean
  readonly ignored: boolean
  readonly sensitive: boolean
  readonly symlink?: { readonly kind: 'file' | 'directory' | 'unknown'; readonly broken: boolean; readonly outOfScope: boolean; readonly targetRef?: string }
  readonly availability: { readonly inspect: FileTypedAvailabilityV1; readonly preview: FileTypedAvailabilityV1; readonly download: FileTypedAvailabilityV1; readonly mutate: FileTypedAvailabilityV1 }
  readonly freshness: FileTreeFreshnessV1
}

export interface FileTreePageV2 {
  readonly workspaceRef: string
  readonly rootRef?: string
  readonly ownerCapabilities?: readonly string[]
  readonly generation: string
  readonly revision: string
  readonly cursor?: string
  readonly nextCursor?: string
  readonly truncated: boolean
  readonly loaded: number
  readonly total?: number
  readonly nodes: readonly FileTreeNodeV2[]
}

export interface FileTreePageRequestV2 {
  readonly parentRef?: string
  readonly cursor?: string
  readonly limit?: number
}

export interface FileTreeSearchRequestV2 {
  readonly query: string
  readonly cursor?: string
  readonly limit?: number
}

export interface FileTreeRevealV2 {
  readonly workspaceRef: string
  readonly generation: string
  readonly revision: string
  readonly breadcrumbs: readonly FileTreeBreadcrumbSegmentV1[]
  readonly target?: FileTreeNodeV2
}

export interface FileTreeProjectionCapabilityV2 {
  readonly capability: typeof FILE_TREE_PROJECTION_CAPABILITY_V2
  roots(request?: Omit<FileTreePageRequestV2, 'parentRef'>): Promise<FileTreePageV2>
  listChildren(parentRef: string, request?: Omit<FileTreePageRequestV2, 'parentRef'>): Promise<FileTreePageV2>
  search(request: FileTreeSearchRequestV2): Promise<FileTreePageV2>
  reveal(ref: string): Promise<FileTreeRevealV2>
}

export interface FileInspectProofV1 {
  readonly owner: string
  readonly ref: string
  readonly version: string
  readonly usable: boolean
  readonly state: 'ready' | 'partial' | 'unsupported' | 'stale'
  readonly sensitive: boolean
  readonly reason?: string
  readonly inspectedWindow?: { readonly start: number; readonly end: number; readonly digest: string }
  readonly resource?: { readonly name: string; readonly kind: FileEntryV1['kind']; readonly mediaType?: string; readonly size?: number }
}

export interface FileInspectCapabilityV1 {
  readonly capability: typeof FILE_INSPECT_CAPABILITY
  inspect(ref: string): Promise<FileInspectProofV1>
  reveal?(ref: string, version: string): Promise<{ readonly token: string; readonly expiresAt: string }>
}

export function isSafeFileTreeNodeV2(node: FileTreeNodeV2): boolean {
  if (!isSafeFileTreeRef(node.ref) || (node.parentRef !== undefined && !isSafeFileTreeRef(node.parentRef))) return false
  if (!SAFE_NAME.test(node.name) || looksLikeAbsolutePath(node.name) || node.version.length === 0 || node.version.length > 120) return false
  if (node.kind !== 'file' && node.kind !== 'directory' && node.kind !== 'symlink') return false
  if (typeof node.hidden !== 'boolean' || typeof node.ignored !== 'boolean' || typeof node.sensitive !== 'boolean') return false
  if (node.symlink !== undefined && node.kind !== 'symlink') return false
  return !UNSAFE_TREE.test(`${node.ref}|${node.parentRef ?? ''}|${node.name}|${node.version}`)
}

export function validateFileTreePageV2(value: unknown): { readonly ok: true; readonly value: FileTreePageV2 } | { readonly ok: false; readonly reason: string } {
  if (typeof value !== 'object' || value === null) return { ok: false, reason: 'page must be an object' }
  const candidate = value as Partial<FileTreePageV2>
  if (typeof candidate.workspaceRef !== 'string' || !isSafeFileTreeRef(candidate.workspaceRef.replace(/^workspace:/, 'w:'))) return { ok: false, reason: 'unsafe workspaceRef' }
  if (typeof candidate.generation !== 'string' || candidate.generation.length === 0 || candidate.generation.length > 120) return { ok: false, reason: 'invalid generation' }
  if (typeof candidate.revision !== 'string' || candidate.revision.length === 0 || candidate.revision.length > 120) return { ok: false, reason: 'invalid revision' }
  if (typeof candidate.truncated !== 'boolean' || typeof candidate.loaded !== 'number' || !Array.isArray(candidate.nodes) || candidate.nodes.some(node => !isSafeFileTreeNodeV2(node as FileTreeNodeV2))) return { ok: false, reason: 'invalid nodes' }
  return { ok: true, value: candidate as FileTreePageV2 }
}

export const FILE_RESOURCE_MUTATION_CAPABILITY_V1 = 'FileResourceMutationCapabilityV1' as const
export const FILE_TRANSFER_CAPABILITY_V1 = 'FileTransferCapabilityV1' as const

export type FileResourceMutationActionV1 = 'create-file' | 'create-directory' | 'rename' | 'move' | 'copy' | 'trash' | 'restore' | 'import-commit'
export type FileMutationReceiptStatusV1 = 'success' | 'rejected' | 'revision_drift' | 'lease_lost' | 'unknown' | 'reconcile_required' | 'rolled_back' | 'degraded'
export type FileConflictDecisionV1 = 'cancel' | 'keep-both' | 'replace'

export interface FileResourceMutationIntentV1 {
  readonly action: FileResourceMutationActionV1
  readonly workspaceRef: string
  readonly principalRef: string
  readonly generation: string
  readonly leaseRef: string
  readonly expectedRevision: string
  readonly targetRefs?: readonly string[]
  readonly destinationRef?: string
  readonly name?: string
  readonly conflict?: FileConflictDecisionV1
  readonly importRef?: string
  readonly undoRef?: string
  readonly previewDigest?: string
  readonly idempotencyKey: string
}

export interface FileResourceMutationPreflightV1 {
  readonly proposalRef: string
  readonly action: FileResourceMutationActionV1
  readonly workspaceRef: string
  readonly generation: string
  readonly revision: string
  readonly previewDigest: string
  readonly expiresAt: string
  readonly targetSummary: readonly { readonly ref: string; readonly name: string; readonly kind: 'file' | 'directory' | 'unknown' }[]
  readonly conflicts: readonly { readonly ref?: string; readonly name: string; readonly choices: readonly FileConflictDecisionV1[] }[]
  readonly risks: readonly string[]
  readonly reversible: boolean
  readonly allowed: boolean
  readonly reason?: string
}

export interface FileResourceMutationReceiptV1 {
  readonly status: FileMutationReceiptStatusV1
  readonly action: FileResourceMutationActionV1
  readonly idempotencyKey: string
  readonly receiptRef: string
  readonly revision?: string
  readonly reason?: string
  readonly proposalRef?: string
  readonly redirects?: readonly { readonly oldRef: string; readonly newRef: string }[]
  readonly items?: readonly { readonly ref: string; readonly status: FileMutationReceiptStatusV1; readonly reason?: string }[]
  readonly undoRef?: string
  readonly undoExpiresAt?: string
}

export interface FileResourceMutationCapabilityV1 {
  readonly capability: typeof FILE_RESOURCE_MUTATION_CAPABILITY_V1
  readonly enabled: boolean
  readonly disabledReason?: string
  preflight(intent: FileResourceMutationIntentV1): Promise<FileResourceMutationPreflightV1>
  execute(proposalRef: string, intent: FileResourceMutationIntentV1): Promise<FileResourceMutationReceiptV1>
  reconcile(idempotencyKey: string): Promise<FileResourceMutationReceiptV1 | undefined>
  undo(receiptRef: string): Promise<FileResourceMutationReceiptV1>
}

export interface FileTransferUploadSessionV1 {
  readonly sessionRef: string
  readonly workspaceRef: string
  readonly generation: string
  readonly expiresAt: string
  readonly chunkSize: number
  readonly maxBytes: number
}

export interface FileTransferCapabilityV1 {
  readonly capability: typeof FILE_TRANSFER_CAPABILITY_V1
  readonly enabled: boolean
  readonly disabledReason?: string
  createUpload(input: { readonly workspaceRef: string; readonly generation: string; readonly name: string; readonly size: number; readonly digest?: string }): Promise<FileTransferUploadSessionV1>
  uploadChunk(sessionRef: string, offset: number, chunk: Uint8Array, digest?: string): Promise<{ readonly received: number; readonly complete: boolean }>
  cancelUpload(sessionRef: string): Promise<void>
  commitUpload(sessionRef: string): Promise<{ readonly importRef: string; readonly size: number; readonly digest: string }>
  issueDownloadTicket(ref: string, version: string, disposition?: 'inline' | 'attachment'): Promise<{ readonly ticket: string; readonly expiresAt: string }>
  download?(ticket: string): Promise<Uint8Array>
}

export interface FileTreeProjectionProbe {
  readonly available: boolean
  readonly freshness: FileTreeFreshnessV1
  readonly missingCapability?: string
  readonly reason: string
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
    && (candidate.readBinary === undefined || typeof candidate.readBinary === 'function')
    && (candidate.writeText === undefined || typeof candidate.writeText === 'function')
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

const UNSAFE_TREE = /(?:^|[:/\\])(?:etc|home|usr|var|tmp)|file:\/\/|authorization|cookie|token/i
const OPAQUE_REF = /^[A-Za-z0-9._~:-]{1,160}$/
const SAFE_NAME = /^[^\\/\r\n]{1,200}$/

function looksLikeAbsolutePath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\') || value.startsWith('file:')
}

export function isSafeFileTreeRef(value: string): boolean {
  return OPAQUE_REF.test(value) && !looksLikeAbsolutePath(value) && !UNSAFE_TREE.test(value)
}

export function isSafeFileTreeNode(node: FileTreeNodeV1): boolean {
  if (!isSafeFileTreeRef(node.ref)) return false
  if (node.parentRef !== undefined && !isSafeFileTreeRef(node.parentRef)) return false
  if (!SAFE_NAME.test(node.name) || looksLikeAbsolutePath(node.name)) return false
  if (node.version.length === 0 || node.version.length > 80 || looksLikeAbsolutePath(node.version)) return false
  const blob = `${node.ref}|${node.parentRef ?? ''}|${node.name}|${node.version}|${node.gitDecoration ?? ''}`
  return !UNSAFE_TREE.test(blob) && !looksLikeAbsolutePath(blob)
}

export function validateFileTreeNode(value: unknown): { readonly ok: true; readonly value: FileTreeNodeV1 } | { readonly ok: false; readonly reason: string } {
  if (typeof value !== 'object' || value === null) return { ok: false, reason: 'node must be an object' }
  const candidate = value as Partial<FileTreeNodeV1>
  if (typeof candidate.ref !== 'string' || !isSafeFileTreeRef(candidate.ref)) return { ok: false, reason: 'unsafe ref' }
  if (candidate.parentRef !== undefined && (typeof candidate.parentRef !== 'string' || !isSafeFileTreeRef(candidate.parentRef))) {
    return { ok: false, reason: 'unsafe parentRef' }
  }
  if (typeof candidate.name !== 'string' || !SAFE_NAME.test(candidate.name) || looksLikeAbsolutePath(candidate.name)) {
    return { ok: false, reason: 'unsafe name' }
  }
  if (candidate.kind !== 'file' && candidate.kind !== 'directory' && candidate.kind !== 'symlink') {
    return { ok: false, reason: 'invalid kind' }
  }
  if (typeof candidate.version !== 'string' || candidate.version.length === 0) return { ok: false, reason: 'missing version' }
  if (typeof candidate.hasChildren !== 'boolean') return { ok: false, reason: 'hasChildren required' }
  if (!Array.isArray(candidate.capabilities) || candidate.capabilities.some(item => typeof item !== 'string')) {
    return { ok: false, reason: 'capabilities invalid' }
  }
  const node: FileTreeNodeV1 = {
    ref: candidate.ref,
    ...(candidate.parentRef === undefined ? {} : { parentRef: candidate.parentRef }),
    name: candidate.name,
    kind: candidate.kind,
    version: candidate.version,
    hasChildren: candidate.hasChildren,
    capabilities: [...candidate.capabilities],
    ...(typeof candidate.gitDecoration === 'string' ? { gitDecoration: candidate.gitDecoration } : {}),
    ...(candidate.symlinkKind === 'file' || candidate.symlinkKind === 'directory' || candidate.symlinkKind === 'unknown'
      ? { symlinkKind: candidate.symlinkKind }
      : {}),
    freshness: candidate.freshness === 'fresh' || candidate.freshness === 'stale' || candidate.freshness === 'offline' || candidate.freshness === 'unknown' || candidate.freshness === 'contract_mismatch'
      ? candidate.freshness
      : 'unknown',
  }
  if (!isSafeFileTreeNode(node)) return { ok: false, reason: 'contract_mismatch' }
  return { ok: true, value: node }
}

export function validateFileTreeBreadcrumb(segments: readonly FileTreeBreadcrumbSegmentV1[]): boolean {
  return segments.every(segment => isSafeFileTreeRef(segment.ref) && SAFE_NAME.test(segment.name) && !looksLikeAbsolutePath(segment.name))
}

export function probeFileTreeProjection(host: FileHostV1 | undefined): FileTreeProjectionProbe {
  if (host === undefined) {
    return { available: false, freshness: 'offline', reason: 'file owner is offline' }
  }
  const capabilities = host.capabilities ?? []
  if (!capabilities.includes(FILE_TREE_PROJECTION_CAPABILITY) || host.tree === undefined) {
    return {
      available: false,
      freshness: 'contract_mismatch',
      missingCapability: FILE_TREE_PROJECTION_CAPABILITY,
      reason: `missing ${FILE_TREE_PROJECTION_CAPABILITY}`,
    }
  }
  return { available: true, freshness: 'fresh', reason: 'file tree projection available' }
}

export function probeFileTreeProjectionV2(host: FileHostV1 | undefined): FileTreeProjectionProbe {
  if (host === undefined) return { available: false, freshness: 'offline', reason: 'file owner is offline' }
  if (!host.capabilities?.includes(FILE_TREE_PROJECTION_CAPABILITY_V2) || host.treeV2 === undefined) return { available: false, freshness: 'contract_mismatch', missingCapability: FILE_TREE_PROJECTION_CAPABILITY_V2, reason: `missing ${FILE_TREE_PROJECTION_CAPABILITY_V2}` }
  return { available: true, freshness: 'fresh', reason: 'file tree projection v2 available' }
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
  readonly isSymlink?: boolean
  readonly broken?: boolean
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

export type WriteWorkspaceText = (
  path: string,
  content: string,
  expectedVersion: string,
  signal?: AbortSignal,
) => Promise<FileTextWriteReceiptV1>

export type ReadWorkspaceBinary = (
  path: string,
  signal?: AbortSignal,
) => Promise<FileBinaryReadV1>

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
const DOCUMENT_EXT = new Set(['.docx'])
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
  if (DOCUMENT_EXT.has(ext)) return 'document'
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
  if (kind === 'document' && ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (kind === 'image') {
    if (ext === '.png') return 'image/png'
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
    if (ext === '.gif') return 'image/gif'
    if (ext === '.webp') return 'image/webp'
    if (ext === '.svg') return 'image/svg+xml'
    return 'image/*'
  }
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.ogg') return 'audio/ogg'
  if (ext === '.m4a') return 'audio/mp4'
  if (ext === '.flac') return 'audio/flac'
  if (ext === '.aac') return 'audio/aac'
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.ogv') return 'video/ogg'
  if (ext === '.mov') return 'video/quicktime'
  return undefined
}

function capabilitiesOf(kind: FileEntryV1['kind'], mediaType: string | undefined, editable = false): FileEntryV1['capabilities'] {
  if (kind === 'directory') return ['open']
  if (kind === 'text') return editable ? ['preview', 'open', 'edit'] : ['preview', 'open']
  if (kind === 'pdf' || kind === 'image' || kind === 'document') return ['preview', 'open']
  if (mediaType?.startsWith('audio/') || mediaType?.startsWith('video/')) return ['preview', 'open']
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
    readBinary?: ReadWorkspaceBinary
    writeText?: WriteWorkspaceText
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
        capabilities: capabilitiesOf(kind, mediaType, options?.writeText !== undefined),
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
  if (options?.readText === undefined && options?.readBinary === undefined && options?.writeText === undefined) return host
  return {
    ...host,
    ...(options?.readText === undefined ? {} : { async readText(entry: FileEntryV1) {
      if (entry.kind === 'directory') return undefined
      const path = paths.get(entry.id)
      if (path === undefined) return undefined
      return options.readText!(path)
    } }),
    ...(options?.readBinary === undefined ? {} : { async readBinary(entry: FileEntryV1) {
      if (entry.kind === 'directory' || !entry.capabilities.includes('preview')) return undefined
      const path = paths.get(entry.id)
      if (path === undefined) return undefined
      const result = await options.readBinary!(path)
      return entry.mediaType === undefined ? result : { ...result, mediaType: entry.mediaType }
    } }),
    ...(options?.writeText === undefined ? {} : { async writeText(entry: FileEntryV1, content: string, expectedVersion: string) {
      if (entry.kind !== 'text' || !entry.capabilities.includes('edit')) return { status: 'rejected' as const, reason: 'file is read-only' }
      const path = paths.get(entry.id)
      if (path === undefined) return { status: 'rejected' as const, reason: 'file is unavailable' }
      return options.writeText!(path, content, expectedVersion)
    } }),
    capabilities: options?.writeText === undefined ? host.capabilities : [FILE_TEXT_WRITE_CAPABILITY],
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
  readonly statusWindow?: GitStatusWindowCapabilityV1
  readonly diffWindowV2?: GitDiffWindowCapabilityV2
  readonly mutationActionsV2?: GitMutationActionsCapabilityV2
  readonly historyWindow?: GitHistoryWindowCapabilityV1
  readonly compareSession?: GitCompareSessionCapabilityV1
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
  const request = async (method: string, extra: Record<string, unknown>, includeClientCwd: boolean): Promise<unknown> => {
    const sessionId = options.sessionId?.()
    const cwd = options.cwd?.()
    const response = await fetchFn(`/yeisme-files/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(sessionId === undefined || sessionId === '' ? {} : { sessionId }),
        ...(!includeClientCwd || cwd === undefined || cwd === '' ? {} : { cwd }),
        ...extra,
      }),
    })
    const parsed = await response.json() as { ok?: boolean; value?: unknown; error?: { message?: string } }
    if (parsed.ok !== true) {
      throw new Error(parsed.error?.message ?? `HTTP ${response.status}`)
    }
    return parsed.value
  }
  const call = (method: string, extra: Record<string, unknown>): Promise<unknown> => request(method, extra, true)
  const callOpaque = (method: string, extra: Record<string, unknown>): Promise<unknown> => request(method, extra, false)
  const readBinary = async (path: string): Promise<FileBinaryReadV1> => {
    const value = await call('fs.binary', { path }) as {
      base64?: unknown
      size?: unknown
      truncated?: unknown
      version?: unknown
    }
    if (typeof value.base64 !== 'string' || typeof value.size !== 'number' || typeof value.truncated !== 'boolean') {
      throw new Error('invalid binary file response')
    }
    const decoded = atob(value.base64)
    const bytes = new Uint8Array(decoded.length)
    for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index)
    return {
      bytes,
      size: value.size,
      truncated: value.truncated,
      ...(typeof value.version === 'string' ? { version: value.version } : {}),
    }
  }
  const legacyHost = createFileHostFromWorkspaceTree(
    async path => call('fs.tree', path === undefined ? {} : { path }) as Promise<WorkspaceTreeListingLike>,
    {
      readText: async path => call('fs.read', { path }) as Promise<FileTextReadV1>,
      readBinary,
      writeText: async (path, content, expectedVersion) => call('fs.write', { path, content, expectedVersion }) as Promise<FileTextWriteReceiptV1>,
    },
  )
  let opaqueRefsAvailable = false
  let ownerCapabilities = new Set<string>()
  const revealTokens = new Map<string, { readonly version: string; readonly token: string }>()

  const isOpaqueEntry = (entry: unknown): entry is FileEntryV1 => {
    if (typeof entry !== 'object' || entry === null) return false
    const candidate = entry as Partial<FileEntryV1>
    return typeof candidate.id === 'string'
      && ID_RE.test(candidate.id)
      && typeof candidate.name === 'string'
      && candidate.name.length > 0
      && candidate.name.length <= 200
      && !/[\\/\r\n]/.test(candidate.name)
      && typeof candidate.kind === 'string'
      && ['file', 'directory', 'document', 'pdf', 'text', 'image', 'archive', 'binary'].includes(candidate.kind)
      && Array.isArray(candidate.capabilities)
      && candidate.capabilities.every(capability => ['preview', 'open', 'download', 'edit'].includes(capability))
  }
  const parseEntries = (value: unknown): readonly FileEntryV1[] | undefined => {
    if (!Array.isArray(value) || value.some(entry => !isOpaqueEntry(entry))) return undefined
    return value as readonly FileEntryV1[]
  }

  const opaqueHost: FileHostV1 = {
    version: '0.1.0-rc.1',
    capability: 'file-host',
    get capabilities() {
      const legacy = legacyHost.capabilities ?? []
      return opaqueRefsAvailable
        ? [...new Set([...legacy, FILE_OPAQUE_REF_CAPABILITY, FILE_TREE_PROJECTION_CAPABILITY_V2, ...ownerCapabilities])]
        : legacy
    },
    async listEntries(parentRef) {
      try {
        const entries = parseEntries(await callOpaque('fs.treeV2', parentRef === undefined ? {} : { parentRef }))
        if (entries !== undefined) {
          opaqueRefsAvailable = true
          return entries
        }
      } catch {
        // Additive compatibility: old hosts keep the existing path-backed adapter.
      }
      opaqueRefsAvailable = false
      return legacyHost.listEntries(parentRef)
    },
    async readText(entry) {
      if (opaqueRefsAvailable) {
        const reveal = revealTokens.get(entry.id)
        return callOpaque('fs.readV2', { ref: entry.id, ...(reveal === undefined ? {} : { revealToken: reveal.token }) }) as Promise<FileTextReadV1 | undefined>
      }
      return legacyHost.readText?.(entry)
    },
    async readBinary(entry) {
      if (opaqueRefsAvailable) {
        const reveal = revealTokens.get(entry.id)
        const value = await callOpaque('fs.binaryV2', { ref: entry.id, ...(reveal === undefined ? {} : { revealToken: reveal.token }) }) as {
          base64?: unknown
          size?: unknown
          truncated?: unknown
          version?: unknown
          mediaType?: unknown
        }
        if (typeof value.base64 !== 'string' || typeof value.size !== 'number' || typeof value.truncated !== 'boolean') {
          throw new Error('invalid opaque binary file response')
        }
        const decoded = atob(value.base64)
        const bytes = new Uint8Array(decoded.length)
        for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index)
        return {
          bytes,
          size: value.size,
          truncated: value.truncated,
          ...(typeof value.version === 'string' ? { version: value.version } : {}),
          ...(typeof value.mediaType === 'string' ? { mediaType: value.mediaType } : {}),
        }
      }
      return legacyHost.readBinary?.(entry)
    },
    async writeText(entry, content, expectedVersion) {
      if (opaqueRefsAvailable) {
        return callOpaque('fs.writeV2', { ref: entry.id, content, expectedVersion }) as Promise<FileTextWriteReceiptV1>
      }
      return legacyHost.writeText?.(entry, content, expectedVersion) ?? { status: 'rejected', reason: 'file is read-only' }
    },
    treeV2: {
      capability: FILE_TREE_PROJECTION_CAPABILITY_V2,
      async roots(request = {}) {
        try {
          const value = await callOpaque('fs.treePageV2', { ...(request.cursor === undefined ? {} : { cursor: request.cursor }), ...(request.limit === undefined ? {} : { limit: request.limit }) })
          const page = parseTreePage(value); opaqueRefsAvailable = true; ownerCapabilities = new Set(page.ownerCapabilities ?? []); return page
        } catch { opaqueRefsAvailable = false; return legacyTreePage(await legacyHost.listEntries()) }
      },
      async listChildren(parentRef, request = {}) {
        try {
          const value = await callOpaque('fs.treePageV2', { parentRef, ...(request.cursor === undefined ? {} : { cursor: request.cursor }), ...(request.limit === undefined ? {} : { limit: request.limit }) })
          const page = parseTreePage(value); opaqueRefsAvailable = true; ownerCapabilities = new Set(page.ownerCapabilities ?? []); return page
        } catch { opaqueRefsAvailable = false; return legacyTreePage(await legacyHost.listEntries(parentRef), parentRef) }
      },
      async search(request) {
        const value = await callOpaque('fs.treePageV2', { query: request.query, ...(request.cursor === undefined ? {} : { cursor: request.cursor }), ...(request.limit === undefined ? {} : { limit: request.limit }) })
        return parseTreePage(value)
      },
      async reveal(ref) {
        const value = await callOpaque('fs.revealV2', { ref })
        return parseReveal(value)
      },
    },
    inspect: {
      capability: FILE_INSPECT_CAPABILITY,
      async inspect(ref) {
        const reveal = revealTokens.get(ref)
        const value = await callOpaque('fs.inspectV2', { ref, ...(reveal === undefined ? {} : { revealToken: reveal.token }) })
        return parseInspect(value)
      },
      async reveal(ref, version) {
        const value = await callOpaque('fs.sensitiveRevealV1', { ref, version }) as { token?: unknown; expiresAt?: unknown }
        if (typeof value.token !== 'string' || typeof value.expiresAt !== 'string') throw new Error('invalid sensitive reveal response')
        revealTokens.set(ref, { version, token: value.token })
        return { token: value.token, expiresAt: value.expiresAt }
      },
    },
    mutations: {
      capability: FILE_RESOURCE_MUTATION_CAPABILITY_V1,
      get enabled() { return opaqueRefsAvailable && ownerCapabilities.has(FILE_RESOURCE_MUTATION_CAPABILITY_V1) },
      get disabledReason() { return this.enabled ? undefined : 'owner mutation capability has not been negotiated' },
      preflight: intent => callOpaque('fs.mutation.preflightV1', { intent }) as Promise<FileResourceMutationPreflightV1>,
      execute: (proposalRef, intent) => callOpaque('fs.mutation.executeV1', { proposalRef, intent }) as Promise<FileResourceMutationReceiptV1>,
      reconcile: idempotencyKey => callOpaque('fs.mutation.reconcileV1', { idempotencyKey }) as Promise<FileResourceMutationReceiptV1 | undefined>,
      undo: receiptRef => callOpaque('fs.mutation.undoV1', { receiptRef }) as Promise<FileResourceMutationReceiptV1>,
    },
    transfer: {
      capability: FILE_TRANSFER_CAPABILITY_V1,
      get enabled() { return opaqueRefsAvailable && ownerCapabilities.has(FILE_TRANSFER_CAPABILITY_V1) },
      get disabledReason() { return this.enabled ? undefined : 'owner transfer capability has not been negotiated' },
      createUpload: input => callOpaque('fs.upload.createV1', { input }) as Promise<FileTransferUploadSessionV1>,
      async uploadChunk(sessionRef, offset, chunk, digest) {
        const sessionId = options.sessionId?.()
        if (sessionId === undefined || sessionId === '') throw new Error('file transfer requires a session owner')
        const query = new URLSearchParams({ sessionId, sessionRef, offset: String(offset), ...(digest === undefined ? {} : { digest }) })
        const response = await fetchFn(`/yeisme-files/api/fs.upload.chunkV1?${query.toString()}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(chunk) })
        const parsed = await response.json() as { ok?: boolean; value?: { received?: unknown; complete?: unknown }; error?: { message?: string } }
        if (parsed.ok !== true || typeof parsed.value?.received !== 'number' || typeof parsed.value.complete !== 'boolean') throw new Error(parsed.error?.message ?? 'invalid upload chunk response')
        return { received: parsed.value.received, complete: parsed.value.complete }
      },
      cancelUpload: sessionRef => callOpaque('fs.upload.cancelV1', { sessionRef }).then(() => undefined),
      commitUpload: sessionRef => callOpaque('fs.upload.commitV1', { sessionRef }) as Promise<{ readonly importRef: string; readonly size: number; readonly digest: string }>,
      issueDownloadTicket: (ref, version) => callOpaque('fs.download.ticketV1', { ref, version }) as Promise<{ readonly ticket: string; readonly expiresAt: string }>,
      async download(ticket) {
        const sessionId = options.sessionId?.()
        if (sessionId === undefined || sessionId === '') throw new Error('file transfer requires a session owner')
        const response = await fetchFn('/yeisme-files/api/fs.download.consumeV1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, ticket }) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return new Uint8Array(await response.arrayBuffer())
      },
    },
  }
  return opaqueHost
}

function parseTreePage(value: unknown): FileTreePageV2 {
  const parsed = validateFileTreePageV2(value)
  if (!parsed.ok) throw new Error(`invalid file tree page: ${parsed.reason}`)
  return parsed.value
}

function legacyTreePage(entries: readonly FileEntryV1[], parentRef?: string): FileTreePageV2 {
  return {
    workspaceRef: 'workspace:legacy', generation: 'legacy', revision: 'legacy', truncated: false, loaded: entries.length, total: entries.length,
    nodes: entries.map(entry => ({ ref: entry.id, ...(parentRef === undefined ? {} : { parentRef }), name: entry.name, kind: entry.kind === 'directory' ? 'directory' : 'file', version: 'legacy', hasChildren: entry.kind === 'directory', hidden: false, ignored: false, sensitive: false, availability: { inspect: { state: 'unavailable', reason: 'legacy owner has no inspect proof' }, preview: { state: 'unavailable', reason: 'legacy owner has no inspect proof' }, download: { state: entry.capabilities.includes('download') ? 'available' : 'unavailable' }, mutate: { state: 'disabled', reason: 'legacy owner has no mutation capability' } }, freshness: 'contract_mismatch' })),
  }
}

function parseReveal(value: unknown): FileTreeRevealV2 {
  if (typeof value !== 'object' || value === null) throw new Error('invalid file reveal')
  const candidate = value as Partial<FileTreeRevealV2>
  if (typeof candidate.workspaceRef !== 'string' || typeof candidate.generation !== 'string' || typeof candidate.revision !== 'string' || !Array.isArray(candidate.breadcrumbs)) throw new Error('invalid file reveal')
  return candidate as FileTreeRevealV2
}

function parseInspect(value: unknown): FileInspectProofV1 {
  if (typeof value !== 'object' || value === null) throw new Error('invalid file inspect proof')
  const candidate = value as Partial<FileInspectProofV1>
  if (typeof candidate.owner !== 'string' || typeof candidate.ref !== 'string' || typeof candidate.version !== 'string' || typeof candidate.usable !== 'boolean') throw new Error('invalid file inspect proof')
  return candidate as FileInspectProofV1
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
    capabilities: [
      'GitTypedActionsCapabilityV1',
      'GitStatusWindowCapabilityV1',
      'GitDiffWindowCapabilityV2',
      'GitMutationActionsCapabilityV2',
      'GitHistoryWindowCapabilityV1',
      'GitCompareSessionCapabilityV1',
    ],
    status: async () => call('git.status') as Promise<GitStatusV1>,
    diff: async path => call('git.diff', { path }) as Promise<GitDiffV1>,
    stage: async path => call('git.stage', { path }) as Promise<GitMutationReceiptV1>,
    unstage: async path => call('git.unstage', { path }) as Promise<GitMutationReceiptV1>,
    commit: async message => call('git.commit', { message }) as Promise<GitMutationReceiptV1>,
    statusWindow: {
      capability: 'GitStatusWindowCapabilityV1',
      repositories: async () => call('git.repositories') as ReturnType<NonNullable<GitStatusWindowCapabilityV1['repositories']>>,
      snapshot: async request => call('git.statusWindow', { ...request }) as ReturnType<GitStatusWindowCapabilityV1['snapshot']>,
    },
    diffWindowV2: {
      capability: 'GitDiffWindowCapabilityV2',
      window: async request => call('git.diffWindowV2', { ...request }) as ReturnType<GitDiffWindowCapabilityV2['window']>,
    },
    mutationActionsV2: {
      capability: 'GitMutationActionsCapabilityV2',
      actions: ['stage.all', 'unstage.all', 'discard.preflight', 'discard.execute', 'discard.undo', 'commit.preflight', 'commit.execute'],
      preflight: async intent => call('git.mutation.preflight', { intent }) as ReturnType<GitMutationActionsCapabilityV2['preflight']>,
      execute: async intent => call('git.mutation.execute', { intent }) as ReturnType<GitMutationActionsCapabilityV2['execute']>,
      reconcile: async idempotencyKey => call('git.mutation.reconcile', { idempotencyKey }) as ReturnType<GitMutationActionsCapabilityV2['reconcile']>,
    },
    historyWindow: {
      capability: 'GitHistoryWindowCapabilityV1',
      window: async request => call('git.historyWindow', { ...request }) as ReturnType<GitHistoryWindowCapabilityV1['window']>,
    },
    compareSession: {
      capability: 'GitCompareSessionCapabilityV1',
      create: async input => call('git.compareSession', { input }) as ReturnType<GitCompareSessionCapabilityV1['create']>,
    },
  }
}

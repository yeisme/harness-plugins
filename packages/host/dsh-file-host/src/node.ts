/**
 * Node-only workspace explorer listing.
 *
 * Adapted from the MIT-licensed DSH-better-sidebar `fs.tree` / `fs.read`
 * host contract: one-level `opendir`, directories first, symlink target
 * probe, and a bounded text read. Paths stay on this host half.
 *
 * @module @yeisme/dsh-file-host/node
 */

import { execFile } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, opendir, open, readFile, readdir, realpath, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import type {
  GitCompareSessionV1,
  GitDiffWindowRequestV2,
  GitDiffWindowV2,
  GitHistoryWindowRequestV1,
  GitHistoryWindowV1,
  GitMutationIntentV2,
  GitMutationPreflightV2,
  GitMutationReceiptV3,
  GitStatusFileWindowItemV1,
  GitStatusWindowRequestV1,
  GitStatusWindowV1,
} from '@yeisme/dsh-git-host'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import {
  FILE_WORKSPACE_EDIT_CAPABILITY,
  type FileBinaryReadV1,
  type FileTextReadV1,
  type FileTextWriteReceiptV1,
  type FileWorkspaceEditDraftV1,
  type FileWorkspaceEditHostV1,
  type FileWorkspaceEditPreviewV1,
  type FileWorkspaceEditReceiptV1,
  type GitStatusV1,
  type WorkspaceTreeEntryLike,
  type WorkspaceTreeListingLike,
} from './index.js'

const execFileAsync = promisify(execFile)

const DEFAULT_LIST_LIMIT = 1000
const DEFAULT_READ_LIMIT = 256 * 1024
const DEFAULT_BINARY_READ_LIMIT = 24 * 1024 * 1024
const DEFAULT_WRITE_LIMIT = 1024 * 1024
const SYMLINK_PROBE_CONCURRENCY = 32

export interface OpaqueFileRecord {
  readonly ref: string
  readonly workspace: string
  readonly target: string
  readonly directory: boolean
}

const OPAQUE_TEXT_EXT = new Set([
  '.md', '.mdx', '.txt', '.json', '.jsonc', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.htm',
  '.yml', '.yaml', '.toml', '.xml', '.sh', '.bash', '.zsh', '.go', '.rs', '.py', '.svg',
])

function opaqueExtension(name: string): string {
  const index = name.lastIndexOf('.')
  return index <= 0 ? '' : name.slice(index).toLowerCase()
}

function opaqueEntryKind(name: string, directory: boolean): FileEntryV1['kind'] {
  if (directory) return 'directory'
  const ext = opaqueExtension(name)
  if (OPAQUE_TEXT_EXT.has(ext)) return 'text'
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif', '.ico'].includes(ext)) return 'image'
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx') return 'document'
  if (['.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z'].includes(ext)) return 'archive'
  return 'file'
}

function opaqueMediaType(name: string, kind: FileEntryV1['kind']): string | undefined {
  const ext = opaqueExtension(name)
  const exact: Record<string, string> = {
    '.md': 'text/markdown', '.mdx': 'text/markdown', '.json': 'application/json', '.jsonc': 'application/json',
    '.yaml': 'application/yaml', '.yml': 'application/yaml', '.toml': 'application/toml', '.ts': 'text/typescript',
    '.tsx': 'text/typescript', '.js': 'text/javascript', '.jsx': 'text/javascript', '.mjs': 'text/javascript',
    '.cjs': 'text/javascript', '.go': 'text/x-go', '.rs': 'text/x-rust', '.py': 'text/x-python', '.sh': 'text/x-shellscript',
    '.bash': 'text/x-shellscript', '.zsh': 'text/x-shellscript', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4',
    '.webm': 'video/webm', '.mov': 'video/quicktime',
  }
  return exact[ext] ?? (kind === 'text' ? 'text/plain' : undefined)
}

/** Process-local registry. Refs are scoped to one canonical workspace and never encode paths. */
export class OpaqueFileRefRegistry {
  private readonly secret = randomBytes(32)
  private readonly byRef = new Map<string, OpaqueFileRecord>()
  private readonly byTarget = new Map<string, OpaqueFileRecord>()

  private issue(workspace: string, target: string, directory: boolean): OpaqueFileRecord {
    const key = `${workspace}\0${target}`
    const existing = this.byTarget.get(key)
    if (existing !== undefined) return existing
    const digest = createHash('sha256').update(this.secret).update(key).digest('base64url').slice(0, 28)
    const record: OpaqueFileRecord = { ref: `${directory ? 'dir' : 'file'}-${digest}`, workspace, target, directory }
    this.byTarget.set(key, record)
    this.byRef.set(record.ref, record)
    return record
  }

  async list(cwd: string, parentRef?: string): Promise<readonly FileEntryV1[]> {
    const workspace = await realpath(requireAbsolute(cwd))
    const parent = parentRef === undefined ? undefined : await this.resolve(cwd, parentRef, true)
    const target = parent?.target ?? workspace
    const listing = await listWorkspaceTree(target)
    const entries = await Promise.all(listing.entries.map(async entry => {
      const canonical = await realpath(entry.path).catch(() => undefined)
      if (canonical === undefined || !isWithin(workspace, canonical)) return undefined
      const kind = opaqueEntryKind(entry.name, entry.isDir)
      const mediaType = opaqueMediaType(entry.name, kind)
      const record = this.issue(workspace, canonical, entry.isDir)
      const projected: FileEntryV1 = {
        id: record.ref,
        ...(parentRef === undefined ? {} : { parentId: parentRef }),
        name: entry.name,
        kind,
        ...(mediaType === undefined ? {} : { mediaType }),
        capabilities: kind === 'directory'
          ? ['open']
          : kind === 'text'
            ? ['preview', 'open', 'edit']
            : ['preview', 'open'],
      }
      return projected
    }))
    return entries.filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
  }

  async resolve(cwd: string, ref: string, requireDirectory?: boolean): Promise<OpaqueFileRecord> {
    const workspace = await realpath(requireAbsolute(cwd))
    const record = this.byRef.get(ref)
    if (record === undefined || record.workspace !== workspace) {
      throw new YeismeFilesError('not-found', 'opaque file reference is unavailable', 404)
    }
    const canonical = await realpath(record.target).catch(() => undefined)
    if (canonical === undefined || canonical !== record.target || !isWithin(workspace, canonical)) {
      throw new YeismeFilesError('forbidden', 'opaque file reference is outside the workspace', 403)
    }
    if (requireDirectory === true && !record.directory) throw new YeismeFilesError('bad-request', 'opaque reference is not a directory')
    return record
  }

  /** Issue or recover an opaque ref for a canonical target inside one workspace. */
  async refForPath(cwd: string, path: string): Promise<OpaqueFileRecord> {
    const workspace = await realpath(requireAbsolute(cwd))
    const canonical = await realpath(requireAbsolute(path)).catch(() => undefined)
    if (canonical === undefined || !isWithin(workspace, canonical)) {
      throw new YeismeFilesError('forbidden', 'target is outside the workspace', 403)
    }
    const info = await stat(canonical).catch(() => undefined)
    if (info === undefined) throw new YeismeFilesError('not-found', 'target is unavailable', 404)
    return this.issue(workspace, canonical, info.isDirectory())
  }
}

export function createOpaqueFileRefRegistry(): OpaqueFileRefRegistry {
  return new OpaqueFileRefRegistry()
}

export const FILE_OPAQUE_REF_HOST_CONTEXT_KEY = 'dsh.fileOpaqueRefHost' as const

interface PendingWorkspaceEditFile {
  readonly ref: string
  readonly target: string
  readonly expectedVersion: string
  readonly before: string
  readonly after: string
  readonly editCount: number
}

interface PendingWorkspaceEdit {
  readonly expiresAtMs: number
  readonly files: readonly PendingWorkspaceEditFile[]
}

function applyOffsetEdits(source: string, edits: FileWorkspaceEditDraftV1['targets'][number]['edits']): string {
  if (edits.length > 5_000) throw new YeismeFilesError('bad-request', 'workspace edit exceeds the edit budget')
  const ordered = [...edits].sort((left, right) => left.start - right.start || left.end - right.end)
  let previousEnd = 0
  for (const edit of ordered) {
    if (!Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.end) || edit.start < previousEnd || edit.start > edit.end || edit.end > source.length) {
      throw new YeismeFilesError('bad-request', 'workspace edit contains an invalid or overlapping range')
    }
    previousEnd = edit.end
  }
  let output = source
  for (const edit of ordered.reverse()) output = `${output.slice(0, edit.start)}${edit.newText}${output.slice(edit.end)}`
  return output
}

function boundedDiff(before: string, after: string): string | undefined {
  if (before === after) return undefined
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1
  let suffix = 0
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1
  const beforeSlice = before.slice(Math.max(0, prefix - 80), Math.min(before.length, before.length - suffix + 80)).slice(0, 2_000)
  const afterSlice = after.slice(Math.max(0, prefix - 80), Math.min(after.length, after.length - suffix + 80)).slice(0, 2_000)
  return `- ${beforeSlice}\n+ ${afterSlice}`
}

/** Session-scoped multi-file mutation owner with preflight, expiry and rollback. */
export class NodeFileWorkspaceEditHost implements FileWorkspaceEditHostV1 {
  readonly version = '0.1.0-rc.1' as const
  readonly capability = FILE_WORKSPACE_EDIT_CAPABILITY
  private readonly previews = new Map<string, PendingWorkspaceEdit>()

  constructor(private readonly cwd: string, private readonly refs: OpaqueFileRefRegistry, private readonly ttlMs = 60_000) {}

  async preview(draft: FileWorkspaceEditDraftV1): Promise<FileWorkspaceEditPreviewV1> {
    if (draft.targets.length === 0 || draft.targets.length > 50) throw new YeismeFilesError('bad-request', 'workspace edit target count is invalid')
    const unique = new Set<string>()
    const files: PendingWorkspaceEditFile[] = []
    let totalBytes = 0
    for (const target of draft.targets) {
      if (unique.has(target.ref)) throw new YeismeFilesError('bad-request', 'workspace edit contains a duplicate target')
      unique.add(target.ref)
      const record = await this.refs.resolve(this.cwd, target.ref)
      if (record.directory) throw new YeismeFilesError('bad-request', 'workspace edit targets a directory')
      const read = await readWorkspaceText(record.target, DEFAULT_WRITE_LIMIT)
      if (read.binary || read.truncated || read.version === undefined) throw new YeismeFilesError('bad-request', 'workspace edit target is not editable text')
      if (read.version !== target.expectedVersion) throw new YeismeFilesError('bad-request', 'workspace edit base version is stale', 409)
      const after = applyOffsetEdits(read.content, target.edits)
      totalBytes += Buffer.byteLength(after, 'utf8')
      if (totalBytes > 5 * DEFAULT_WRITE_LIMIT) throw new YeismeFilesError('bad-request', 'workspace edit exceeds the total byte budget')
      files.push({ ref: target.ref, target: record.target, expectedVersion: target.expectedVersion, before: read.content, after, editCount: target.edits.length })
    }
    const previewId = `edit-${randomBytes(18).toString('base64url')}`
    const expiresAtMs = Date.now() + Math.max(1_000, Math.min(5 * 60_000, this.ttlMs))
    this.previews.set(previewId, { expiresAtMs, files })
    return {
      previewId,
      expiresAt: new Date(expiresAtMs).toISOString(),
      files: files.map(file => ({
        ref: file.ref,
        editCount: file.editCount,
        beforeBytes: Buffer.byteLength(file.before, 'utf8'),
        afterBytes: Buffer.byteLength(file.after, 'utf8'),
        ...(boundedDiff(file.before, file.after) === undefined ? {} : { diff: boundedDiff(file.before, file.after) }),
      })),
    }
  }

  async apply(previewId: string): Promise<FileWorkspaceEditReceiptV1> {
    const preview = this.previews.get(previewId)
    this.previews.delete(previewId)
    if (preview === undefined || preview.expiresAtMs < Date.now()) return { status: 'rejected', previewId, files: [], reason: 'workspace edit preview is unavailable or expired' }
    for (const file of preview.files) {
      const current = await readWorkspaceText(file.target, DEFAULT_WRITE_LIMIT)
      if (current.version !== file.expectedVersion) {
        return {
          status: 'conflict', previewId, reason: 'workspace edit changed after preview',
          files: preview.files.map(item => ({ ref: item.ref, status: item.ref === file.ref ? 'conflict' : 'rejected', reason: item.ref === file.ref ? 'base version changed' : 'atomic preflight failed' })),
        }
      }
    }
    const receipts: Array<{ ref: string; status: 'ok' | 'conflict' | 'rejected' | 'rolled-back' | 'failed'; version?: string; reason?: string }> = []
    const applied: Array<{ file: PendingWorkspaceEditFile; version: string; receiptIndex: number }> = []
    for (const file of preview.files) {
      try {
        const receipt = await writeWorkspaceText(file.target, file.after, file.expectedVersion)
        if (receipt.status !== 'ok' || receipt.version === undefined) {
          receipts.push({ ref: file.ref, status: receipt.status, ...(receipt.version === undefined ? {} : { version: receipt.version }), ...(receipt.reason === undefined ? {} : { reason: receipt.reason }) })
          break
        }
        const receiptIndex = receipts.push({ ref: file.ref, status: 'ok', version: receipt.version }) - 1
        applied.push({ file, version: receipt.version, receiptIndex })
      } catch {
        receipts.push({ ref: file.ref, status: 'failed', reason: 'workspace edit write failed' })
        break
      }
    }
    if (receipts.length === preview.files.length && receipts.every(receipt => receipt.status === 'ok')) return { status: 'ok', previewId, files: receipts }
    let rollbackFailed = false
    for (const item of applied.reverse()) {
      const rollback = await writeWorkspaceText(item.file.target, item.file.before, item.version).catch(() => ({ status: 'rejected' as const, reason: 'rollback failed' }))
      if (rollback.status === 'ok') receipts[item.receiptIndex] = { ref: item.file.ref, status: 'rolled-back', ...(rollback.version === undefined ? {} : { version: rollback.version }) }
      else {
        rollbackFailed = true
        receipts[item.receiptIndex] = { ref: item.file.ref, status: 'failed', reason: rollback.reason ?? 'rollback failed' }
      }
    }
    for (const file of preview.files.slice(receipts.length)) receipts.push({ ref: file.ref, status: 'rejected', reason: 'workspace edit stopped after a failed target' })
    return { status: rollbackFailed ? 'partial' : 'rolled-back', previewId, files: receipts, reason: rollbackFailed ? 'workspace edit rollback was incomplete' : 'workspace edit was rolled back' }
  }
}

export function createFileWorkspaceEditHost(cwd: string, refs: OpaqueFileRefRegistry, ttlMs?: number): NodeFileWorkspaceEditHost {
  return new NodeFileWorkspaceEditHost(cwd, refs, ttlMs)
}

function textVersion(size: number, mtimeMs: number, bytes: Uint8Array): string {
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
  return `${size}:${mtimeMs}:${digest}`
}

export class YeismeFilesError extends Error {
  constructor(
    readonly code: 'bad-request' | 'forbidden' | 'fs-error' | 'not-found' | 'method-error',
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export function requireAbsolute(path: string): string {
  if (!isAbsolute(path)) {
    throw new YeismeFilesError('fs-error', `"${path}" is not an absolute path`, 400)
  }
  return resolve(path)
}

export function isWithin(base: string, target: string, platform: NodeJS.Platform = process.platform): boolean {
  const norm = (value: string): string => value.replace(/[\\/]+/g, '/').replace(/\/$/, '')
  const b = norm(base)
  const t = norm(target)
  if (platform === 'win32') {
    const lb = b.toLowerCase()
    const lt = t.toLowerCase()
    return lt === lb || lt.startsWith(`${lb}/`)
  }
  return t === b || t.startsWith(`${b}/`)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface MutableTreeEntry {
  name: string
  path: string
  isDir: boolean
  hidden?: boolean
  isSymlink?: boolean
  broken?: boolean
}

function compareEntries(left: WorkspaceTreeEntryLike, right: WorkspaceTreeEntryLike): number {
  if (left.isDir !== right.isDir) return left.isDir ? -1 : 1
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
}

async function probeSymlinkTargets(rows: MutableTreeEntry[]): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(SYMLINK_PROBE_CONCURRENCY, rows.length) }, async () => {
    for (;;) {
      const index = next
      next += 1
      if (index >= rows.length) return
      const row = rows[index]!
      if (row.isSymlink !== true) continue
      const info = await stat(row.path).catch(() => undefined)
      row.isDir = info !== undefined ? info.isDirectory() : row.isDir
      row.broken = info === undefined
    }
  })
  await Promise.all(workers)
}

/** List one directory level, files and directories, directories first. */
export async function listWorkspaceTree(path: string, maxEntries = DEFAULT_LIST_LIMIT): Promise<WorkspaceTreeListingLike> {
  const target = requireAbsolute(path)
  let level
  try {
    level = await opendir(target)
  } catch (error) {
    throw new YeismeFilesError('fs-error', `cannot list "${target}": ${messageOf(error)}`, 400)
  }
  const rows: MutableTreeEntry[] = []
  let overflow = 0
  try {
    for await (const dirent of level) {
      if (rows.length >= maxEntries) {
        overflow += 1
        continue
      }
      rows.push({
        name: dirent.name,
        path: join(target, dirent.name),
        isDir: dirent.isDirectory(),
        isSymlink: dirent.isSymbolicLink(),
        broken: false,
        hidden: dirent.name.startsWith('.'),
      })
    }
  } catch (error) {
    throw new YeismeFilesError('fs-error', `cannot list "${target}": ${messageOf(error)}`, 400)
  }
  await probeSymlinkTargets(rows)
  rows.sort(compareEntries)
  return { path: target, entries: rows, truncated: overflow > 0 }
}

/** Bounded UTF-8 read. Binary files return empty content with binary=true. */
export async function readWorkspaceText(path: string, readLimit = DEFAULT_READ_LIMIT): Promise<FileTextReadV1> {
  const target = requireAbsolute(path)
  const info = await stat(target).catch((error: unknown) => {
    throw new YeismeFilesError('fs-error', `cannot read "${target}": ${messageOf(error)}`, 400)
  })
  if (info.isDirectory()) {
    throw new YeismeFilesError('fs-error', `"${target}" is a directory`, 400)
  }
  const truncated = info.size > readLimit
  const handle = await open(target, 'r').catch((error: unknown) => {
    throw new YeismeFilesError('fs-error', `cannot read "${target}": ${messageOf(error)}`, 400)
  })
  try {
    const buffer = Buffer.alloc(Math.min(info.size, readLimit))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const slice = buffer.subarray(0, bytesRead)
    const binary = slice.includes(0)
    return { content: binary ? '' : slice.toString('utf8'), truncated, binary, version: textVersion(info.size, info.mtimeMs, slice) }
  } finally {
    await handle.close()
  }
}

/** Bounded binary read for safe browser-side document and media preview. */
export async function readWorkspaceBinary(path: string, readLimit = DEFAULT_BINARY_READ_LIMIT): Promise<FileBinaryReadV1> {
  const target = requireAbsolute(path)
  const info = await stat(target).catch((error: unknown) => {
    throw new YeismeFilesError('fs-error', `cannot read "${target}": ${messageOf(error)}`, 400)
  })
  if (info.isDirectory()) throw new YeismeFilesError('fs-error', `"${target}" is a directory`, 400)
  if (info.size > readLimit) {
    return {
      bytes: new Uint8Array(),
      size: info.size,
      truncated: true,
      version: textVersion(info.size, info.mtimeMs, new Uint8Array()),
    }
  }
  const bytes = await readFile(target).catch((error: unknown) => {
    throw new YeismeFilesError('fs-error', `cannot read "${target}": ${messageOf(error)}`, 400)
  })
  return {
    bytes,
    size: info.size,
    truncated: false,
    version: textVersion(info.size, info.mtimeMs, bytes),
  }
}

/** Version-fenced UTF-8 write. A stale editor never overwrites newer content. */
export async function writeWorkspaceText(path: string, content: string, expectedVersion: string, writeLimit = DEFAULT_WRITE_LIMIT): Promise<FileTextWriteReceiptV1> {
  const target = requireAbsolute(path)
  if (Buffer.byteLength(content, 'utf8') > writeLimit) return { status: 'rejected', reason: 'file exceeds the editable text limit' }
  const info = await stat(target).catch((error: unknown) => {
    throw new YeismeFilesError('fs-error', `cannot write "${target}": ${messageOf(error)}`, 400)
  })
  if (info.isDirectory()) return { status: 'rejected', reason: 'directories are read-only' }
  if (info.size > writeLimit) return { status: 'rejected', reason: 'file exceeds the editable text limit' }
  const currentBytes = await readFile(target)
  const currentVersion = textVersion(info.size, info.mtimeMs, currentBytes)
  if (currentVersion !== expectedVersion) return { status: 'conflict', version: currentVersion, reason: 'file changed after it was opened' }
  await writeFile(target, content, { encoding: 'utf8', flag: 'w' }).catch((error: unknown) => {
    throw new YeismeFilesError('fs-error', `cannot write "${target}": ${messageOf(error)}`, 400)
  })
  const next = await stat(target)
  return { status: 'ok', version: textVersion(next.size, next.mtimeMs, Buffer.from(content, 'utf8')) }
}

export function rootLabel(path: string): string {
  const base = basename(path)
  return base !== '' ? base : path
}

export function parentOf(path: string): string | undefined {
  const parent = dirname(path)
  return parent === path ? undefined : parent
}

function parsePorcelain(stdout: string): GitStatusV1 {
  const lines = stdout.split('\n').filter(line => line.length > 0)
  let branch = 'HEAD'
  const files: Array<{ path: string; index: string; worktree: string }> = []
  for (const line of lines) {
    if (line.startsWith('## ')) {
      branch = line.slice(3).split('...')[0] ?? 'HEAD'
      continue
    }
    files.push({
      index: line.slice(0, 1),
      worktree: line.slice(1, 2),
      path: line.slice(3),
    })
  }
  return { branch, files }
}

function gitExecOptions(cwd: string, maxBuffer = 256 * 1024): { cwd: string; timeout: number; maxBuffer: number } {
  return { cwd, timeout: 8_000, maxBuffer }
}

async function runGit(cwd: string, args: readonly string[], maxBuffer?: number): Promise<string> {
  const target = requireAbsolute(cwd)
  try {
    const { stdout } = await execFileAsync('git', [...args], gitExecOptions(target, maxBuffer))
    return stdout
  } catch (error) {
    throw new YeismeFilesError('fs-error', `git ${args[0] ?? 'command'} failed: ${messageOf(error)}`, 400)
  }
}

async function runGitOptional(cwd: string, args: readonly string[]): Promise<string | undefined> {
  try { return (await runGit(cwd, args)).trim() || undefined } catch { return undefined }
}

function requireWorkspaceRelativePath(cwd: string, path: string): string {
  if (path.length === 0 || path.length > 400) {
    throw new YeismeFilesError('bad-request', 'invalid git path', 400)
  }
  if (path.startsWith('/') || path.includes('\0') || path.includes('..') || /[\r\n]/.test(path)) {
    throw new YeismeFilesError('forbidden', 'git path escapes the session workspace', 403)
  }
  const target = resolve(cwd, path)
  if (!isWithin(cwd, target)) {
    throw new YeismeFilesError('forbidden', 'git path escapes the session workspace', 403)
  }
  return path
}

/** Read-only `git status --porcelain=v1 -b` inside the session workspace. */
export async function readGitStatus(cwd: string): Promise<GitStatusV1> {
  const stdout = await runGit(cwd, ['status', '--porcelain=v1', '-b'], 8 * 1024 * 1024)
  return parsePorcelain(stdout)
}

export interface GitDiffResultV1 {
  readonly path: string
  readonly patch: string
  readonly truncated: boolean
}

export interface GitMutationResultV1 {
  readonly status: 'ok' | 'rejected'
  readonly actionId: string
  readonly reason?: string
}

const DIFF_LIMIT = 64 * 1024

/** Bounded `git diff -- path` inside the session workspace. */
export async function readGitDiff(cwd: string, path: string): Promise<GitDiffResultV1> {
  const relative = requireWorkspaceRelativePath(cwd, path)
  const stdout = await runGit(cwd, ['diff', '--', relative])
  const truncated = stdout.length > DIFF_LIMIT
  return { path: relative, patch: truncated ? stdout.slice(0, DIFF_LIMIT) : stdout, truncated }
}

/** Typed `git add -- path`. */
export async function gitStage(cwd: string, path: string): Promise<GitMutationResultV1> {
  const relative = requireWorkspaceRelativePath(cwd, path)
  await runGit(cwd, ['add', '--', relative])
  return { status: 'ok', actionId: 'stage' }
}

/** Typed `git restore --staged -- path`. */
export async function gitUnstage(cwd: string, path: string): Promise<GitMutationResultV1> {
  const relative = requireWorkspaceRelativePath(cwd, path)
  await runGit(cwd, ['restore', '--staged', '--', relative])
  return { status: 'ok', actionId: 'unstage' }
}

/** Typed `git commit -m message`. Timeout is not treated as success. */
export async function gitCommit(cwd: string, message: string): Promise<GitMutationResultV1> {
  const trimmed = message.trim()
  if (trimmed.length === 0 || trimmed.length > 400) {
    throw new YeismeFilesError('bad-request', 'commit message is required and must be at most 400 characters', 400)
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new YeismeFilesError('bad-request', 'commit message must be a single line', 400)
  }
  await runGit(cwd, ['commit', '-m', trimmed])
  return { status: 'ok', actionId: 'commit' }
}

const GIT_WINDOW_LIMIT = 500
const GIT_HISTORY_BUFFER = 8 * 1024 * 1024
const DISCARD_UNDO_MS = 24 * 60 * 60 * 1000
const DISCARD_BACKUP_DIR = join(tmpdir(), 'yeisme-git-discard-backups')
const mutationReceipts = new Map<string, GitMutationReceiptV3>()

function digestRef(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex').slice(0, 24)}`
}

async function gitOwnerRefs(cwd: string): Promise<{ repositoryRef: string; worktreeRef: string }> {
  const canonical = await realpath(requireAbsolute(cwd))
  const common = await runGitOptional(canonical, ['rev-parse', '--git-common-dir']) ?? '.git'
  return { repositoryRef: digestRef('repo', resolve(canonical, common)), worktreeRef: digestRef('wt', canonical) }
}

export async function readGitRepositoryContexts(cwd: string): Promise<readonly [{ repositoryRef: string; worktreeRef: string; label: string; branch: string; agentWorktree: false }]> {
  const refs = await gitOwnerRefs(cwd)
  const status = await readGitStatus(cwd)
  return [{ ...refs, label: `${rootLabel(cwd)} · ${status.branch}`, branch: status.branch, agentWorktree: false }]
}

async function gitRevision(cwd: string, status?: GitStatusV1): Promise<string> {
  const head = await runGitOptional(cwd, ['rev-parse', 'HEAD']) ?? 'unborn'
  const current = status ?? await readGitStatus(cwd)
  return digestRef('rev', `${head}\0${JSON.stringify(current)}`)
}

function statusCode(index: string, worktree: string): GitStatusFileWindowItemV1['status'] {
  const code = `${index}${worktree}`
  if (CONFLICT_CODES.has(code)) return 'conflict'
  const token = index !== ' ' && index !== '' ? index : worktree
  return token === 'A' ? 'added' : token === 'D' ? 'deleted' : token === 'R' || token === 'C' ? 'renamed' : code === '??' ? 'untracked' : 'modified'
}

const CONFLICT_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

function statusWindowItems(status: GitStatusV1, revision: string): GitStatusFileWindowItemV1[] {
  const items: GitStatusFileWindowItemV1[] = []
  for (const file of status.files) {
    const code = `${file.index}${file.worktree}`
    if (CONFLICT_CODES.has(code)) {
      items.push({ fileRef: digestRef('file', `${revision}\0merge\0${file.path}`), pathLabel: file.path, status: 'conflict', group: 'merge', generated: false, lowSignal: false })
      continue
    }
    if (code === '??') {
      items.push({ fileRef: digestRef('file', `${revision}\0untracked\0${file.path}`), pathLabel: file.path, status: 'untracked', group: 'untracked', generated: false, lowSignal: false })
      continue
    }
    if (file.index !== ' ' && file.index !== '') items.push({ fileRef: digestRef('file', `${revision}\0staged\0${file.path}`), pathLabel: file.path, status: statusCode(file.index, ' '), group: 'staged', generated: false, lowSignal: false })
    if (file.worktree !== ' ' && file.worktree !== '') items.push({ fileRef: digestRef('file', `${revision}\0changes\0${file.path}`), pathLabel: file.path, status: statusCode(' ', file.worktree), group: 'changes', generated: false, lowSignal: false })
  }
  return items.sort((left, right) => left.pathLabel.localeCompare(right.pathLabel, undefined, { numeric: true, sensitivity: 'base' }))
}

function parseWindowCursor(cursor: string | undefined, revision: string): number {
  if (cursor === undefined) return 0
  const match = /^cursor:(\d+):([a-f0-9]{8})$/.exec(cursor)
  if (match === null || match[2] !== revision.slice(-8)) throw new YeismeFilesError('bad-request', 'git cursor is stale or invalid', 409)
  return Number(match[1])
}

function nextWindowCursor(offset: number, revision: string): string {
  return `cursor:${offset}:${revision.slice(-8)}`
}

export async function readGitStatusWindow(cwd: string, request: GitStatusWindowRequestV1): Promise<GitStatusWindowV1> {
  if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > GIT_WINDOW_LIMIT) throw new YeismeFilesError('bad-request', 'git window limit is invalid')
  const refs = await gitOwnerRefs(cwd)
  if (request.repositoryRef !== refs.repositoryRef || request.worktreeRef !== refs.worktreeRef) throw new YeismeFilesError('forbidden', 'git owner refs do not match this workspace', 403)
  const status = await readGitStatus(cwd)
  const revision = await gitRevision(cwd, status)
  const items = statusWindowItems(status, revision)
  const offset = parseWindowCursor(request.cursor, revision)
  const files = items.slice(offset, offset + request.limit)
  const count = (group: GitStatusFileWindowItemV1['group']): number => items.filter(item => item.group === group).length
  return {
    ...refs,
    branch: status.branch,
    revision,
    cursor: nextWindowCursor(offset, revision),
    sequence: 1,
    freshness: 'fresh',
    counts: { merge: count('merge'), staged: count('staged'), changes: count('changes'), untracked: count('untracked'), lowSignal: count('low_signal') },
    files,
    loaded: files.length,
    total: items.length,
    ...(offset + files.length < items.length ? { nextCursor: nextWindowCursor(offset + files.length, revision) } : {}),
  }
}

async function resolveWindowFile(cwd: string, repositoryRef: string, worktreeRef: string, fileRef: string): Promise<{ item: GitStatusFileWindowItemV1; revision: string }> {
  const status = await readGitStatus(cwd)
  const revision = await gitRevision(cwd, status)
  const refs = await gitOwnerRefs(cwd)
  if (repositoryRef !== refs.repositoryRef || worktreeRef !== refs.worktreeRef) throw new YeismeFilesError('forbidden', 'git owner refs do not match this workspace', 403)
  const item = statusWindowItems(status, revision).find(candidate => candidate.fileRef === fileRef)
  if (item === undefined) throw new YeismeFilesError('not-found', 'git file ref is stale or unknown', 404)
  return { item, revision }
}

function secretRisk(patch: string): GitDiffWindowV2['secretRisk'] {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|(?:token|password|secret)\s*[:=]/i.test(patch) ? 'secret_suspected' : 'none'
}

function diffHunks(fileRef: string, patch: string): GitDiffWindowV2['hunks'] {
  const hunks: Array<{ hunkRef: string; header: string; lines: string[]; loaded: true }> = []
  let current: { hunkRef: string; header: string; lines: string[]; loaded: true } | undefined
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) {
      current = { hunkRef: digestRef('hunk', `${fileRef}\0${line}\0${hunks.length}`), header: line, lines: [], loaded: true }
      hunks.push(current)
    } else if (current !== undefined) current.lines.push(line)
  }
  if (hunks.length === 0 && patch !== '') hunks.push({ hunkRef: digestRef('hunk', `${fileRef}\0meta`), header: '文件元数据', lines: patch.split('\n'), loaded: true })
  return hunks
}

export async function readGitDiffWindowV2(cwd: string, request: GitDiffWindowRequestV2): Promise<GitDiffWindowV2> {
  if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > GIT_WINDOW_LIMIT) throw new YeismeFilesError('bad-request', 'git diff window limit is invalid')
  const resolved = await resolveWindowFile(cwd, request.repositoryRef, request.worktreeRef, request.fileRef)
  const relative = requireWorkspaceRelativePath(cwd, resolved.item.pathLabel)
  if (resolved.item.group === 'untracked') throw new YeismeFilesError('bad-request', 'untracked files do not have a Git diff window')
  const args = resolved.item.group === 'staged' ? ['diff', '--cached', '--', relative] : ['diff', '--', relative]
  const stdout = await runGit(cwd, args, 8 * 1024 * 1024)
  const hunks = diffHunks(request.fileRef, stdout).slice(0, request.limit)
  const risk = secretRisk(stdout)
  return {
    repositoryRef: request.repositoryRef,
    worktreeRef: request.worktreeRef,
    fileRef: request.fileRef,
    layout: request.layout,
    baseRevision: digestRef('base', `${resolved.revision}\0${resolved.item.group}`),
    targetRevision: resolved.revision,
    currentRevision: resolved.revision,
    cursor: nextWindowCursor(0, resolved.revision),
    freshness: 'fresh',
    hunks,
    loaded: hunks.length,
    total: diffHunks(request.fileRef, stdout).length,
    generated: resolved.item.generated,
    binary: /Binary files .* differ/.test(stdout),
    secretRisk: risk,
    allowedActions: risk === 'secret_suspected' ? ['review', 'feedback', 'stage', 'unstage'] : ['review', 'feedback', 'stage', 'unstage', 'share', 'export'],
  }
}

export async function readGitHistoryWindow(cwd: string, request: GitHistoryWindowRequestV1): Promise<GitHistoryWindowV1> {
  if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > GIT_WINDOW_LIMIT) throw new YeismeFilesError('bad-request', 'git history limit is invalid')
  const refs = await gitOwnerRefs(cwd)
  if (request.repositoryRef !== refs.repositoryRef || request.worktreeRef !== refs.worktreeRef) throw new YeismeFilesError('forbidden', 'git owner refs do not match this workspace', 403)
  const revision = await gitRevision(cwd)
  const offset = parseWindowCursor(request.cursor, revision)
  const ref = request.ref ?? 'HEAD'
  if (!/^[A-Za-z0-9._~:/-]{1,160}$/.test(ref) || ref.includes('..') || ref.startsWith('-')) throw new YeismeFilesError('bad-request', 'history ref is invalid')
  const format = '%H%x1f%P%x1f%s%x1f%D%x1f%an%x1f%aI'
  if (request.query !== undefined && (request.query.length > 120 || /authorization|cookie|token/i.test(request.query))) throw new YeismeFilesError('bad-request', 'history query is invalid')
  const queryArgs = request.query === undefined ? [] : [`--grep=${request.query}`, '--regexp-ignore-case']
  const stdout = await runGit(cwd, ['log', ref, `--skip=${offset}`, `-n${request.limit}`, `--format=${format}`, ...queryArgs], GIT_HISTORY_BUFFER)
  const commits = stdout.split('\n').filter(Boolean).map(line => {
    const [commitRef = '', parents = '', message = '', refsText = '', author = '', authoredAt = ''] = line.split('\x1f')
    return { commitRef, parentRefs: parents === '' ? [] : parents.split(' '), graph: '●', message, refs: refsText === '' ? [] : refsText.split(', ').filter(Boolean), author, authoredAt, additions: 0, deletions: 0, changedFiles: 0 }
  })
  const totalText = await runGit(cwd, ['rev-list', '--count', ref])
  const total = Number(totalText.trim())
  return { ...refs, revision, cursor: nextWindowCursor(offset, revision), freshness: 'fresh', commits, loaded: commits.length, total, ...(offset + commits.length < total ? { nextCursor: nextWindowCursor(offset + commits.length, revision) } : {}) }
}

async function mutationPreflight(cwd: string, intent: GitMutationIntentV2): Promise<GitMutationPreflightV2> {
  if (!['stage.all', 'unstage.all', 'discard.preflight', 'discard.execute', 'discard.undo', 'commit.preflight', 'commit.execute'].includes(intent.action)) throw new YeismeFilesError('bad-request', 'git mutation action is not published')
  const refs = await gitOwnerRefs(cwd)
  if (intent.repositoryRef !== refs.repositoryRef || intent.worktreeRef !== refs.worktreeRef) throw new YeismeFilesError('forbidden', 'git owner refs do not match this workspace', 403)
  const status = await readGitStatus(cwd)
  const revision = await gitRevision(cwd, status)
  const items = statusWindowItems(status, revision)
  const action = intent.action === 'commit.execute' ? 'commit.preflight' : intent.action === 'discard.execute' ? 'discard.preflight' : intent.action
  const targetItems = intent.fileRefs?.map(ref => items.find(item => item.fileRef === ref)).filter((item): item is GitStatusFileWindowItemV1 => item !== undefined) ?? []
  if (action === 'discard.preflight' && (intent.fileRefs === undefined || targetItems.length !== intent.fileRefs.length || targetItems.some(item => item.group === 'untracked'))) {
    throw new YeismeFilesError('bad-request', 'discard requires current tracked file refs')
  }
  let undoAvailable = false
  if (action === 'discard.undo' && intent.backupRef !== undefined) undoAvailable = await discardBackupAvailable(intent.backupRef)
  const targetCount = action === 'stage.all' ? items.filter(item => item.group === 'changes' || item.group === 'untracked').length
    : action === 'discard.preflight' ? targetItems.length
      : action === 'discard.undo' ? (undoAvailable ? 1 : 0)
        : items.filter(item => item.group === 'staged').length
  const authorName = await runGitOptional(cwd, ['config', 'user.name'])
  const authorEmail = await runGitOptional(cwd, ['config', 'user.email'])
  const signing = (await runGitOptional(cwd, ['config', '--bool', 'commit.gpgsign'])) === 'true' ? 'enabled' : 'disabled'
  const previewDigest = digestRef('digest', `${action}\0${revision}\0${targetCount}\0${intent.message ?? ''}\0${intent.fileRefs?.join(',') ?? ''}\0${intent.backupRef ?? ''}`)
  return {
    action,
    ...refs,
    revision,
    previewDigest,
    targetCount,
    branch: status.branch,
    ...(authorName === undefined && authorEmail === undefined ? {} : { author: [authorName, authorEmail].filter(Boolean).join(' <').replace(/ <([^>]*)$/, ' <$1>') }),
    signing,
    hooks: 'unknown',
    verification: 'not_required',
    risks: [...(revision !== intent.expectedRevision ? ['revision_drift'] : []), ...(action === 'discard.preflight' ? ['working_tree_data_loss', 'owner_backup_required'] : [])],
    allowed: revision === intent.expectedRevision && targetCount > 0,
    ...(revision !== intent.expectedRevision ? { reason: 'expected revision no longer matches owner projection' } : targetCount === 0 ? { reason: 'mutation target is empty' } : {}),
  }
}

function discardBackupParts(backupRef: string): { createdAt: number; digest: string } | undefined {
  const match = /^backup:(\d{13}):([a-f0-9]{24})$/.exec(backupRef)
  if (match === null) return undefined
  return { createdAt: Number(match[1]), digest: match[2]! }
}

function discardBackupPath(backupRef: string): string | undefined {
  const parts = discardBackupParts(backupRef)
  return parts === undefined ? undefined : join(DISCARD_BACKUP_DIR, `${parts.createdAt}-${parts.digest}.patch`)
}

async function discardBackupAvailable(backupRef: string): Promise<boolean> {
  const parts = discardBackupParts(backupRef)
  const path = discardBackupPath(backupRef)
  if (parts === undefined || path === undefined || Date.now() - parts.createdAt > DISCARD_UNDO_MS) return false
  return (await stat(path).catch(() => undefined))?.isFile() === true
}

async function createDiscardBackup(cwd: string, paths: readonly string[]): Promise<{ backupRef: string; undoExpiresAt: string }> {
  const patch = await runGit(cwd, ['diff', '--binary', '--', ...paths], 16 * 1024 * 1024)
  if (patch === '') throw new YeismeFilesError('bad-request', 'discard target has no recoverable diff')
  const createdAt = Date.now()
  const digest = createHash('sha256').update(`${cwd}\0${createdAt}\0${patch}`).digest('hex').slice(0, 24)
  const backupRef = `backup:${createdAt}:${digest}`
  await mkdir(DISCARD_BACKUP_DIR, { recursive: true, mode: 0o700 })
  const entries = await readdir(DISCARD_BACKUP_DIR).catch(() => [])
  await Promise.all(entries.map(async entry => {
    const match = /^(\d{13})-[a-f0-9]{24}\.patch$/.exec(entry)
    if (match !== null && Date.now() - Number(match[1]) > DISCARD_UNDO_MS) await unlink(join(DISCARD_BACKUP_DIR, entry)).catch(() => undefined)
  }))
  await writeFile(join(DISCARD_BACKUP_DIR, `${createdAt}-${digest}.patch`), patch, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  return { backupRef, undoExpiresAt: new Date(createdAt + DISCARD_UNDO_MS).toISOString() }
}

async function executeGitMutation(cwd: string, intent: GitMutationIntentV2): Promise<GitMutationReceiptV3> {
  const receiptKey = `${cwd}\0${intent.idempotencyKey}`
  const existing = mutationReceipts.get(receiptKey)
  if (existing !== undefined) return existing
  const preflight = await mutationPreflight(cwd, intent)
  if (!preflight.allowed || intent.previewDigest !== preflight.previewDigest) {
    return { status: preflight.revision !== intent.expectedRevision ? 'revision_drift' : 'rejected', action: intent.action, idempotencyKey: intent.idempotencyKey, reason: preflight.reason ?? 'preview digest is missing or stale' }
  }
  let backup: { backupRef: string; undoExpiresAt: string } | undefined
  if (intent.action === 'stage.all') await runGit(cwd, ['add', '-A'])
  else if (intent.action === 'unstage.all') await runGit(cwd, ['reset', '--', '.'])
  else if (intent.action === 'discard.execute') {
    const current = statusWindowItems(await readGitStatus(cwd), preflight.revision)
    const targets = intent.fileRefs?.map(ref => current.find(item => item.fileRef === ref)).filter((item): item is GitStatusFileWindowItemV1 => item !== undefined) ?? []
    if (targets.length === 0 || targets.length !== intent.fileRefs?.length) throw new YeismeFilesError('bad-request', 'discard target refs are stale')
    const paths = targets.map(item => requireWorkspaceRelativePath(cwd, item.pathLabel))
    backup = await createDiscardBackup(cwd, paths)
    await runGit(cwd, ['restore', '--worktree', '--', ...paths])
  }
  else if (intent.action === 'discard.undo') {
    const path = intent.backupRef === undefined ? undefined : discardBackupPath(intent.backupRef)
    if (path === undefined || !await discardBackupAvailable(intent.backupRef!)) throw new YeismeFilesError('not-found', 'discard backup is unavailable or expired', 404)
    await runGit(cwd, ['apply', '--whitespace=nowarn', path], 16 * 1024 * 1024)
  }
  else if (intent.action === 'commit.execute') await gitCommit(cwd, intent.message ?? '')
  else throw new YeismeFilesError('bad-request', 'preflight actions cannot execute directly')
  const receipt: GitMutationReceiptV3 = { status: 'ok', action: intent.action, idempotencyKey: intent.idempotencyKey, revision: await gitRevision(cwd), receiptRef: digestRef('receipt', receiptKey), ...(backup === undefined ? {} : backup) }
  mutationReceipts.set(receiptKey, receipt)
  if (mutationReceipts.size > 1000) mutationReceipts.delete(mutationReceipts.keys().next().value as string)
  return receipt
}

export async function createGitCompareSession(cwd: string, input: Omit<GitCompareSessionV1, 'sessionRef'>): Promise<GitCompareSessionV1> {
  const refs = await gitOwnerRefs(cwd)
  if (input.repositoryRef !== refs.repositoryRef || input.worktreeRef !== refs.worktreeRef) throw new YeismeFilesError('forbidden', 'git owner refs do not match this workspace', 403)
  const revision = await gitRevision(cwd)
  if (input.revision !== revision) throw new YeismeFilesError('bad-request', 'compare revision is stale', 409)
  for (const ref of [input.baseRef, input.targetRef]) {
    if (!/^[A-Fa-f0-9]{7,64}$/.test(ref)) throw new YeismeFilesError('bad-request', 'compare ref is invalid')
    await runGit(cwd, ['cat-file', '-e', `${ref}^{commit}`])
  }
  return { ...input, sessionRef: digestRef('compare', `${input.repositoryRef}\0${input.baseRef}\0${input.targetRef}\0${input.revision}`) }
}

export interface FilesApiRequest {
  readonly method?: string
  readonly url?: string
  [Symbol.asyncIterator](): AsyncIterableIterator<string | Uint8Array>
}

export interface FilesApiResponse {
  writeHead(status: number, headers: Record<string, string>): void
  end(body: string): void
}

const MAX_BODY_BYTES = 1 << 20

async function readJsonBody(req: FilesApiRequest): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new YeismeFilesError('bad-request', 'request body too large')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new YeismeFilesError('bad-request', 'request body is not valid JSON')
  }
}

function writeJson(res: FilesApiResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function requireString(payload: unknown, key: string): string {
  const record = payload as Record<string, unknown> | null
  const value = record?.[key]
  if (typeof value !== 'string' || value === '') {
    throw new YeismeFilesError('bad-request', `missing or invalid "${key}"`)
  }
  return value
}

export interface YeismeFilesApiOptions {
  sessionCwd(sessionId?: string, clientCwd?: string): string
  opaqueRefs?: OpaqueFileRefRegistry
}

/**
 * POST /yeisme-files/api/fs.tree and /yeisme-files/api/fs.read.
 * Same JSON envelope as the community sidebar API, different prefix.
 */
export async function handleYeismeFilesApi(
  req: FilesApiRequest,
  res: FilesApiResponse,
  options: YeismeFilesApiOptions,
): Promise<void> {
  if (req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
    return
  }
  const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
  const method = pathname.startsWith('/yeisme-files/api/') ? pathname.slice('/yeisme-files/api/'.length) : undefined
  if (method === undefined || method.includes('/')) {
    writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'unknown files API method' } })
    return
  }
  try {
    const payload = await readJsonBody(req)
    const record = payload as { sessionId?: unknown; cwd?: unknown; path?: unknown; parentRef?: unknown; ref?: unknown; content?: unknown; expectedVersion?: unknown; intent?: unknown; input?: unknown; idempotencyKey?: unknown }
    const sessionId = typeof record.sessionId === 'string' ? record.sessionId : undefined
    const clientCwd = typeof record.cwd === 'string' && record.cwd !== '' ? record.cwd : undefined
    const opaqueMethod = method === 'fs.treeV2' || method === 'fs.readV2' || method === 'fs.binaryV2' || method === 'fs.writeV2'
    if (opaqueMethod && (sessionId === undefined || clientCwd !== undefined)) {
      throw new YeismeFilesError('forbidden', 'opaque file API requires a session owner and forbids client cwd', 403)
    }
    const cwd = requireAbsolute(options.sessionCwd(sessionId, opaqueMethod ? undefined : clientCwd))
    const opaqueRefs = options.opaqueRefs
    if (method === 'fs.treeV2') {
      if (opaqueRefs === undefined) throw new YeismeFilesError('not-found', 'opaque file capability is unavailable', 404)
      const parentRef = typeof record.parentRef === 'string' ? record.parentRef : undefined
      writeJson(res, 200, { ok: true, value: await opaqueRefs.list(cwd, parentRef) })
      return
    }
    if (method === 'fs.readV2') {
      if (opaqueRefs === undefined) throw new YeismeFilesError('not-found', 'opaque file capability is unavailable', 404)
      const target = await opaqueRefs.resolve(cwd, requireString(payload, 'ref'))
      if (target.directory) throw new YeismeFilesError('bad-request', 'directories are read-only')
      writeJson(res, 200, { ok: true, value: await readWorkspaceText(target.target) })
      return
    }
    if (method === 'fs.binaryV2') {
      if (opaqueRefs === undefined) throw new YeismeFilesError('not-found', 'opaque file capability is unavailable', 404)
      const target = await opaqueRefs.resolve(cwd, requireString(payload, 'ref'))
      if (target.directory) throw new YeismeFilesError('bad-request', 'directories are read-only')
      const binary = await readWorkspaceBinary(target.target)
      writeJson(res, 200, {
        ok: true,
        value: {
          base64: Buffer.from(binary.bytes).toString('base64'),
          size: binary.size,
          truncated: binary.truncated,
          version: binary.version,
        },
      })
      return
    }
    if (method === 'fs.writeV2') {
      if (opaqueRefs === undefined) throw new YeismeFilesError('not-found', 'opaque file capability is unavailable', 404)
      const target = await opaqueRefs.resolve(cwd, requireString(payload, 'ref'))
      if (target.directory) throw new YeismeFilesError('bad-request', 'directories are read-only')
      if (typeof record.content !== 'string') throw new YeismeFilesError('bad-request', 'missing or invalid "content"')
      writeJson(res, 200, { ok: true, value: await writeWorkspaceText(target.target, record.content, requireString(payload, 'expectedVersion')) })
      return
    }
    if (method === 'fs.tree') {
      const target = record.path === undefined || record.path === '' ? cwd : requireAbsolute(requireString(payload, 'path'))
      if (!isWithin(cwd, target)) throw new YeismeFilesError('forbidden', 'path escapes the session workspace', 403)
      writeJson(res, 200, { ok: true, value: await listWorkspaceTree(target) })
      return
    }
    if (method === 'fs.read') {
      const target = requireAbsolute(requireString(payload, 'path'))
      if (!isWithin(cwd, target)) throw new YeismeFilesError('forbidden', 'path escapes the session workspace', 403)
      writeJson(res, 200, { ok: true, value: await readWorkspaceText(target) })
      return
    }
    if (method === 'fs.binary') {
      const target = requireAbsolute(requireString(payload, 'path'))
      if (!isWithin(cwd, target)) throw new YeismeFilesError('forbidden', 'path escapes the session workspace', 403)
      const canonicalTarget = await realpath(target)
      const canonicalWorkspace = await realpath(cwd)
      if (!isWithin(canonicalWorkspace, canonicalTarget)) throw new YeismeFilesError('forbidden', 'file link escapes the session workspace', 403)
      const binary = await readWorkspaceBinary(canonicalTarget)
      writeJson(res, 200, {
        ok: true,
        value: {
          base64: Buffer.from(binary.bytes).toString('base64'),
          size: binary.size,
          truncated: binary.truncated,
          version: binary.version,
        },
      })
      return
    }
    if (method === 'fs.write') {
      const target = requireAbsolute(requireString(payload, 'path'))
      if (!isWithin(cwd, target)) throw new YeismeFilesError('forbidden', 'path escapes the session workspace', 403)
      const canonicalTarget = await realpath(target)
      const canonicalWorkspace = await realpath(cwd)
      if (!isWithin(canonicalWorkspace, canonicalTarget)) throw new YeismeFilesError('forbidden', 'file link escapes the session workspace', 403)
      if (typeof record.content !== 'string') throw new YeismeFilesError('bad-request', 'missing or invalid "content"')
      writeJson(res, 200, { ok: true, value: await writeWorkspaceText(canonicalTarget, record.content, requireString(payload, 'expectedVersion')) })
      return
    }
    if (method === 'git.status') {
      writeJson(res, 200, { ok: true, value: await readGitStatus(cwd) })
      return
    }
    if (method === 'git.repositories') {
      writeJson(res, 200, { ok: true, value: await readGitRepositoryContexts(cwd) })
      return
    }
    if (method === 'git.statusWindow') {
      writeJson(res, 200, { ok: true, value: await readGitStatusWindow(cwd, payload as GitStatusWindowRequestV1) })
      return
    }
    if (method === 'git.diff') {
      writeJson(res, 200, { ok: true, value: await readGitDiff(cwd, requireString(payload, 'path')) })
      return
    }
    if (method === 'git.diffWindowV2') {
      writeJson(res, 200, { ok: true, value: await readGitDiffWindowV2(cwd, payload as GitDiffWindowRequestV2) })
      return
    }
    if (method === 'git.historyWindow') {
      writeJson(res, 200, { ok: true, value: await readGitHistoryWindow(cwd, payload as GitHistoryWindowRequestV1) })
      return
    }
    if (method === 'git.compareSession') {
      if (typeof record.input !== 'object' || record.input === null) throw new YeismeFilesError('bad-request', 'missing or invalid "input"')
      writeJson(res, 200, { ok: true, value: await createGitCompareSession(cwd, record.input as Omit<GitCompareSessionV1, 'sessionRef'>) })
      return
    }
    if (method === 'git.mutation.preflight') {
      if (typeof record.intent !== 'object' || record.intent === null) throw new YeismeFilesError('bad-request', 'missing or invalid "intent"')
      writeJson(res, 200, { ok: true, value: await mutationPreflight(cwd, record.intent as GitMutationIntentV2) })
      return
    }
    if (method === 'git.mutation.execute') {
      if (typeof record.intent !== 'object' || record.intent === null) throw new YeismeFilesError('bad-request', 'missing or invalid "intent"')
      writeJson(res, 200, { ok: true, value: await executeGitMutation(cwd, record.intent as GitMutationIntentV2) })
      return
    }
    if (method === 'git.mutation.reconcile') {
      const idempotencyKey = requireString(payload, 'idempotencyKey')
      writeJson(res, 200, { ok: true, value: mutationReceipts.get(`${cwd}\0${idempotencyKey}`) })
      return
    }
    if (method === 'git.stage') {
      writeJson(res, 200, { ok: true, value: await gitStage(cwd, requireString(payload, 'path')) })
      return
    }
    if (method === 'git.unstage') {
      writeJson(res, 200, { ok: true, value: await gitUnstage(cwd, requireString(payload, 'path')) })
      return
    }
    if (method === 'git.commit') {
      writeJson(res, 200, { ok: true, value: await gitCommit(cwd, requireString(payload, 'message')) })
      return
    }
    writeJson(res, 404, { ok: false, error: { code: 'not-found', message: `unknown files API method "${method}"` } })
  } catch (error) {
    if (error instanceof YeismeFilesError) {
      writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
      return
    }
    writeJson(res, 500, { ok: false, error: { code: 'internal', message: messageOf(error) } })
  }
}

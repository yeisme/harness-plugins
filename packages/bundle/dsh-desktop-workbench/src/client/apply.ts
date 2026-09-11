/** Desktop Workbench Pane view-provider assembly. */
import { createElement, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  FileOpenPane,
  FILE_IMAGE_REGION_REFERENCE_EVENT,
  FILE_IMAGE_REGION_REFERENCE_RESULT_EVENT,
  FilePane,
  FilePreviewDispatchPane,
  GitPane,
  ConversationManager,
  TerminalPane,
  type ConversationManagerSession,
  type FileImageRegionReferenceDetailV1,
  type GitPaneProps,
} from '@yeisme/dsh-client-ui-desktop-workbench/client'
import {
  resolveSessionOrganizationRemote,
  type SessionOrganizationRemoteFace,
} from '@yeisme/dsh-client-ui-session-tags/client'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import { classifyFileEntry, MEDIA_HOST_CONTEXT_KEY, isMediaHostV1, listSeededMedia, MediaPreviewPane, subscribeSeededMedia, type MediaHostV1, type MediaRefV1 } from '@yeisme/dsh-rich-media/client'
import { createExplorerFileHost, createExplorerGitHost, createFileHostFromWorkspaces, FILE_HOST_CONTEXT_KEY, isFileHostV1, type FileHostV1, type FileResourceMutationIntentV1, type FileTreeNodeV2, type FileTreePageV2 } from '@yeisme/dsh-file-host'
import { isTerminalHostV2, TERMINAL_HOST_CONTEXT_KEY, type TerminalHostV2 } from '@yeisme/dsh-terminal-host'
import { resolveTerminalPaneRemote } from '@yeisme/dsh-terminal'
import {
  apply as applyPaneWorkbench,
  bindExplorerRuntime,
  COMPOSER_REFERENCE_ADD_TO_MAIN_EVENT,
  COMPOSER_REFERENCE_ADD_TO_MAIN_RESULT_EVENT,
  COMPOSER_REFERENCE_BRIDGE_CONTEXT_KEY,
  COMPOSER_REFERENCE_CATALOG_CONTEXT_KEY,
  COMPOSER_REFERENCE_HOST_INSERT_EVENT,
  COMPOSER_REFERENCE_HOST_INSERT_RESULT_EVENT,
  COMPOSER_REFERENCE_HOST_REMOVE_EVENT,
  COMPOSER_REFERENCE_HOST_REMOVE_RESULT_EVENT,
  COMPOSER_REFERENCE_HOST_PROBE_EVENT,
  COMPOSER_REFERENCE_PROTOCOL_VERSION,
  COMPOSER_REFERENCE_REMOVE_FROM_MAIN_EVENT,
  COMPOSER_REFERENCE_REMOVE_FROM_MAIN_RESULT_EVENT,
  ComposerReferenceDock,
  ComposerReferenceDraftDockV2,
  getComposerReferenceController,
  getComposerReferenceDraftControllerV2,
  type ComposerReferenceAddToMainDetailV1,
  type ComposerReferenceAddToMainResultV1,
  type ComposerReferenceCatalogCandidateV1,
  type ComposerReferenceCatalogV1,
  type ComposerReferenceBridgeV1,
  type ComposerReferenceV2,
  type ComposerReferenceHostInsertResultV1,
  type ComposerReferenceHostRemoveResultV1,
  type ComposerReferenceRemoveFromMainDetailV1,
  type ComposerReferenceRemoveFromMainResultV1,
  type ExplorerRuntimeV2,
} from '@yeisme/dsh-client-ui-pane-workbench/client'
import { apply as applySubagentMonitor } from '@yeisme/dsh-client-ui-pane-subagent/client'
import { ComposedDesktopWorkbench } from './composed-workbench.tsx'

export const inject = ['slots', 'workspaces']

const LEGACY_WINDOW_REFERENCE_OWNERS = new Set([
  'dsh.local', 'dsh.terminal', 'dsh.message', 'dsh.agent-presets', 'dsh.skills', 'dsh.tools',
])

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  registerExplorerRuntime?(runtime: ExplorerRuntimeV2): () => void
  openView(request: unknown): void
}

interface UnifiedWorkspaceLayoutFace {
  readonly version: 'workspace.unified.v1'
}

type DesktopLauncherIcon = 'files' | 'git' | 'media' | 'terminal' | 'sessions'

function DesktopIcon({ name }: { readonly name: DesktopLauncherIcon }): ReactNode {
  const path = name === 'files' ? 'M3 5.5h5l1.5 2H17v8H3z'
    : name === 'git' ? 'M5 3v8a3 3 0 0 0 3 3h4M5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm9 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'
      : name === 'media' ? 'M3 4h14v12H3zM6 13l3-3 2 2 2-3 2 4'
        : name === 'terminal' ? 'm4 5 4 4-4 4M10 13h6'
          : 'M4 5h12M4 10h12M4 15h8'
  return createElement('svg', { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.55, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, createElement('path', { d: path }))
}

function DesktopSidebarAction({ wide = true, label, title, icon, onClick }: { readonly wide?: boolean; readonly label: string; readonly title: string; readonly icon: DesktopLauncherIcon; readonly onClick: () => void }): ReactNode {
  return createElement(Button, {
    ...{ 'data-desktop-workbench-launcher': icon }, type: 'button', size: 'sm', variant: 'toolbar', onClick, title, 'aria-label': label,
  }, createElement(DesktopIcon, { name: icon }), wide ? createElement('span', null, label) : null)
}

/** @deprecated One-RC story component only; production apply never registers it. */
export function DesktopWorkbenchOverlay(): ReactNode {
  const [open, setOpen] = useState(true)
  if (open) return createElement(ComposedDesktopWorkbench, { onClose: () => { setOpen(false) } })
  return createElement(Button, { ...{ 'data-dsh-desktop-workbench-launcher': true }, type: 'button', size: 'sm', variant: 'primary', 'aria-label': '打开桌面工作台', onClick: () => { setOpen(true) } }, createElement('span', { 'aria-hidden': true }, '▦'), '打开工作台')
}

/** FileEntry kind resolution; exported for contract tests (file-preview-formats). */
export function mediaKindOf(entry: FileEntryV1): MediaRefV1['kind'] | undefined {
  if (entry.kind === 'image') return 'image'
  if (entry.kind === 'pdf' || entry.mediaType === 'application/pdf') return 'pdf'
  if (entry.mediaType?.startsWith('audio/')) return 'audio'
  if (entry.mediaType?.startsWith('video/')) return 'video'
  if (/\.(?:mp3|wav|ogg|m4a|flac|aac)$/i.test(entry.name)) return 'audio'
  if (/\.(?:mp4|webm|ogv|mov|m4v)$/i.test(entry.name)) return 'video'
  // 文件预览格式（file-preview-formats）：扩展名/声明 MIME 统一走
  // rich-media 的分类表。文本类保留既有 desktop.file 视图（语义编辑器），
  // 只有表格/Office 文档进媒体预览 pane。
  const classified = classifyFileEntry(entry.name, entry.mediaType)
  if (classified === undefined || classified.kind === 'text') return undefined
  return classified.kind
}

function fallbackMediaType(kind: MediaRefV1['kind']): string {
  if (kind === 'image') return 'image/png'
  if (kind === 'audio') return 'audio/mpeg'
  if (kind === 'video') return 'video/mp4'
  if (kind === 'pdf') return 'application/pdf'
  return 'application/octet-stream'
}

/**
 * file-preview-dispatch routing: text-family and image entries keep the
 * `desktop.file` editor path; everything else (audio/video/pdf/table/document/
 * archive/binary, including unknown binaries) opens the per-file
 * `desktop.preview` dispatch view so nothing lands on a dead-end error.
 * Exported for contract tests.
 */
export function routesToPreviewDispatch(entry: FileEntryV1): boolean {
  if (entry.kind === 'image') return false
  if (entry.kind === 'text') return false
  return classifyFileEntry(entry.name, entry.mediaType)?.kind !== 'text'
}

/** FileEntry to MediaRef projection; exported for contract tests. */
export function fileEntryToMediaRef(entry: FileEntryV1): MediaRefV1 | undefined {
  const kind = mediaKindOf(entry)
  if (kind === undefined) return undefined
  // Prefer the classified MIME (extension table) over a raw octet-stream guess.
  const classified = classifyFileEntry(entry.name, entry.mediaType)
  return {
    owner: 'dsh',
    kind,
    ref: entry.id,
    version: '1',
    mediaType: classified?.mediaType ?? entry.mediaType ?? fallbackMediaType(kind),
    title: entry.name,
    capabilities: ['preview', 'open'],
    ...entry.size === undefined ? {} : { size: entry.size },
  }
}

function MediaPane({
  host,
  seeded,
  selectedKey,
  resolveSeededUrl,
}: {
  readonly host: MediaHostV1 | undefined
  readonly seeded: ReadonlyMap<string, MediaRefV1>
  readonly selectedKey: string | undefined
  readonly resolveSeededUrl?: ((media: MediaRefV1) => Promise<string | undefined> | string | undefined) | undefined
}): ReactNode {
  const [listed, setListed] = useState<readonly MediaRefV1[]>([])
  const [chatSeeded, setChatSeeded] = useState<readonly MediaRefV1[]>(() => listSeededMedia())
  const [error, setError] = useState<string>()
  useEffect(() => subscribeSeededMedia(() => { setChatSeeded(listSeededMedia()) }), [])
  useEffect(() => {
    let live = true
    if (host === undefined) {
      setListed([])
      setError(undefined)
      return () => { live = false }
    }
    setError(undefined)
    void host.listMedia().then(next => {
      if (live) setListed(next)
    }).catch(caught => {
      if (live) setError(caught instanceof Error ? caught.message : '媒体资源加载失败')
    })
    return () => { live = false }
  }, [host])
  const media = useMemo(() => {
    const byKey = new Map<string, MediaRefV1>()
    for (const item of listed) byKey.set(item.ref, item)
    for (const item of chatSeeded) byKey.set(item.ref, item)
    for (const item of seeded.values()) byKey.set(item.ref, item)
    const selected = selectedKey === undefined ? undefined : seeded.get(selectedKey) ?? byKey.get(selectedKey)
    if (selected !== undefined) return [selected, ...[...byKey.values()].filter(item => item.ref !== selected.ref)]
    return [...byKey.values()]
  }, [listed, chatSeeded, seeded, selectedKey])
  const resolveUrl = useCallback(async (item: MediaRefV1): Promise<string> => {
    if (host !== undefined) {
      const resolved = await host.resolveUrl(item)
      if (resolved !== undefined) return resolved.url
    }
    const seededUrl = await resolveSeededUrl?.(item)
    if (seededUrl !== undefined) return seededUrl
    throw new Error('资源授权失败或已过期')
  }, [host, resolveSeededUrl])
  if (media.length === 0) {
    return createElement(SurfaceState, { phase: 'empty', title: '当前会话没有可预览媒体投影。', 'data-dsh-media-empty': true })
  }
  return createElement(Surface, { kind: 'workspace', 'data-dsh-media-host-pane': true },
    createElement(MediaPreviewPane, { title: '媒体库', media, resolveUrl }),
    error === undefined ? null : createElement(SurfaceState, { phase: 'error', title: error }),
  )
}

function resolveTerminalHost(ctx: ClientContext): TerminalHostV2 | undefined {
  try {
    const candidate = ctx.get(TERMINAL_HOST_CONTEXT_KEY as never)
    if (isTerminalHostV2(candidate)) return candidate
  } catch {
    // Optional context service. Missing V2 capability means no terminal provider is registered.
  }
  return undefined
}

interface WorkspaceBrowseFace {
  listDirectory(path?: string, signal?: AbortSignal): Promise<{
    readonly path: string
    readonly entries: readonly { readonly name: string; readonly path: string; readonly hidden?: boolean }[]
  }>
  readonly list?: { getSnapshot(): { readonly items: readonly { readonly path: string; readonly sessionIds: readonly string[] }[] } }
}

interface SessionListFace {
  readonly list?: {
    getSnapshot(): {
      readonly current?: string
      readonly ids?: readonly string[]
      readonly byId?: Readonly<Record<string, {
        readonly id: string
        readonly displayTitle: string
        readonly cwd?: string
        readonly running: boolean
        readonly pendingInteraction?: unknown
        readonly completed?: boolean
        readonly updatedAt: number
      }>>
    }
    subscribe?(listener: () => void): () => void
  }
  open?(sessionId: string): void
  search?(query: string): Promise<{ readonly items?: readonly { readonly sessionId?: string; readonly id?: string }[] }>
}

function ConversationManagerPane({ ctx }: { readonly ctx: ClientContext }): ReactNode {
  const [organization, setOrganization] = useState<SessionOrganizationRemoteFace>()
  const [rows, setRows] = useState<readonly ConversationManagerSession[]>([])
  const [reason, setReason] = useState('正在连接 sessionOrganization…')

  useEffect(() => {
    let live = true
    void resolveSessionOrganizationRemote(ctx).then(remote => {
      if (!live) return
      if (remote === undefined) setReason('未安装或未挂载 sessionOrganization Host；旧 tags 与 Workspace 侧栏仍可使用。')
      else setOrganization(remote)
    })
    return () => { live = false }
  }, [ctx])

  useEffect(() => {
    let sessions: SessionListFace | undefined
    try { sessions = ctx.get('sessions' as never) as SessionListFace | undefined } catch { sessions = undefined }
    const refresh = (): void => {
      const snapshot = sessions?.list?.getSnapshot()
      const ids = snapshot?.ids ?? Object.keys(snapshot?.byId ?? {})
      setRows(ids.flatMap(id => {
        const row = snapshot?.byId?.[id]
        if (row === undefined) return []
        const workspaceRef = row.cwd ?? 'ungrouped'
        return [{
          sessionId: id,
          title: row.displayTitle,
          workspaceRef,
          workspaceName: workspaceRef.split(/[\\/]/).filter(Boolean).at(-1) ?? workspaceRef,
          tags: [],
          status: row.running ? 'running' as const : row.pendingInteraction !== undefined ? 'attention' as const : row.completed === true ? 'completed' as const : 'idle' as const,
          archived: false,
          updatedAt: new Date(row.updatedAt).toLocaleString(),
        }]
      }))
    }
    refresh()
    return sessions?.list?.subscribe?.(refresh)
  }, [ctx])

  if (organization === undefined) {
    return createElement('section', { 'data-dsh-conversation-manager': true }, createElement('div', { role: 'status', 'data-dsh-panel-empty': true }, createElement('strong', null, '对话管理能力不可用'), createElement('span', null, reason)))
  }
  let sessions: SessionListFace | undefined
  try { sessions = ctx.get('sessions' as never) as SessionListFace | undefined } catch { sessions = undefined }
  return createElement(ConversationManager, {
    sessions: rows,
    organization,
    onOpenSession: (sessionId: string) => { sessions?.open?.(sessionId) },
    ...(typeof sessions?.search === 'function' ? {
      searchHistory: async (query: string) => {
        const result = await sessions?.search?.(query)
        return (result?.items ?? []).flatMap(item => {
          const id = item.sessionId ?? item.id
          return id === undefined ? [] : [{ sessionId: id }]
        })
      },
    } : {}),
  })
}

function currentSessionId(ctx: ClientContext): string | undefined {
  try {
    const sessions = ctx.get('sessions' as never) as SessionListFace | undefined
    return sessions?.list?.getSnapshot()?.current
  } catch {
    return undefined
  }
}

function currentWorkspacePath(ctx: ClientContext): string | undefined {
  try {
    const workspaces = ctx.get('workspaces' as never) as WorkspaceBrowseFace | undefined
    const current = currentSessionId(ctx)
    const items = workspaces?.list?.getSnapshot()?.items
    if (current === undefined || items === undefined) return undefined
    return items.find(workspace => workspace.sessionIds.includes(current))?.path
  } catch {
    return undefined
  }
}

function resolveWorkspacesBrowse(ctx: ClientContext): WorkspaceBrowseFace | undefined {
  try {
    const candidate = ctx.get('workspaces' as never) as WorkspaceBrowseFace | undefined
    if (candidate !== undefined && typeof candidate.listDirectory === 'function') return candidate
  } catch {
    // Optional official DSH browse seam.
  }
  return undefined
}

function resolveFileHost(ctx: ClientContext, ownerSignal?: () => AbortSignal | undefined): FileHostV1 | undefined {
  try {
    const candidate = ctx.get(FILE_HOST_CONTEXT_KEY as never)
    if (isFileHostV1(candidate)) return candidate
  } catch {
    // Optional context service.
  }
  if (typeof fetch === 'function') {
    return createExplorerFileHost({
      sessionId: () => currentSessionId(ctx),
      cwd: () => currentWorkspacePath(ctx),
      ...(ownerSignal === undefined ? {} : { signal: ownerSignal }),
    })
  }
  const workspaces = resolveWorkspacesBrowse(ctx)
  if (workspaces === undefined) return undefined
  return createFileHostFromWorkspaces(
    (path, signal) => workspaces.listDirectory(path, signal),
    () => currentWorkspacePath(ctx),
  )
}

function mapExplorerNode(node: FileTreeNodeV2): import('@yeisme/dsh-client-ui-pane-workbench/client').ExplorerTreeNodeV1 {
  return {
    ref: node.ref,
    ...(node.parentRef === undefined ? {} : { parentRef: node.parentRef }),
    name: node.name,
    kind: node.kind,
    version: node.version,
    hasChildren: node.hasChildren,
    capabilities: [
      ...(node.availability.preview.state === 'available' ? ['preview', 'open'] : []),
      ...(node.availability.download.state === 'available' ? ['download'] : []),
      ...(node.availability.mutate.state === 'available' ? ['mutate'] : []),
    ],
    freshness: node.freshness,
    hidden: node.hidden,
    ignored: node.ignored,
    sensitive: node.sensitive,
    ...(node.symlink === undefined ? {} : { symlink: { broken: node.symlink.broken, outOfScope: node.symlink.outOfScope, ...(node.symlink.targetRef === undefined ? {} : { targetRef: node.symlink.targetRef }) } }),
    availability: {
      inspect: node.availability.inspect.state,
      preview: node.availability.preview.state,
      download: node.availability.download.state,
      mutate: node.availability.mutate.state,
      ...(node.availability.preview.reason === undefined ? {} : { reason: node.availability.preview.reason }),
    },
  }
}

function referenceId(prefix: string, ref: string, version: string): string {
  let hash = 2166136261
  for (const char of `${ref}\0${version}`) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619) }
  return `${prefix}:${(hash >>> 0).toString(36)}`
}

async function sha256(value: Uint8Array | string): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const owned = Uint8Array.from(bytes)
  const digest = await crypto.subtle.digest('SHA-256', owned.buffer)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function fileReferenceDigest(bytes: Uint8Array, window: { readonly start: number; readonly end: number }): Promise<string> {
  const suffix = new TextEncoder().encode(`:${window.start}:${window.end}`)
  const combined = new Uint8Array(bytes.byteLength + suffix.byteLength)
  combined.set(bytes)
  combined.set(suffix, bytes.byteLength)
  return sha256(combined)
}

/** Keep a byte-bounded capture valid UTF-8; never create a replacement rune. */
function utf8Capture(bytes: Uint8Array, maxBytes: number): { readonly body: string; readonly end: number } {
  const limit = Math.min(bytes.byteLength, maxBytes)
  for (let end = limit; end >= Math.max(0, limit - 3); end -= 1) {
    try { return { body: new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, end)), end } } catch { /* try the preceding code point boundary */ }
  }
  return { body: '', end: 0 }
}

async function imageRegionDigest(bytes: Uint8Array, region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): Promise<string> {
  const suffix = new TextEncoder().encode(`\0image-region\0${JSON.stringify(region)}`)
  const combined = new Uint8Array(bytes.byteLength + suffix.byteLength)
  combined.set(bytes)
  combined.set(suffix, bytes.byteLength)
  return sha256(combined)
}

export async function terminalReferenceProof(row: { readonly terminalId: string; readonly type: string; readonly status: unknown }, read: { readonly text: string; readonly totalLines: number; readonly lineBegin: number; readonly lineEnd: number; readonly truncated: boolean }): Promise<Pick<ComposerReferenceV2, 'version' | 'digest'>> {
  const value = JSON.stringify({ id: row.terminalId, type: row.type, status: row.status, totalLines: read.totalLines, lineBegin: read.lineBegin, lineEnd: read.lineEnd, truncated: read.truncated, text: read.text })
  const digest = await sha256(value)
  return { version: `sha256:${digest}`, digest }
}

const REFERENCE_OWNER_MATRIX: Readonly<Record<string, Readonly<Record<string, ComposerReferenceV2['intent']>>>> = {
  'dsh.local': { file: 'content', directory: 'content', selection: 'content', image: 'content', 'image-region': 'content' },
  'dsh.terminal': { terminal: 'content' },
  'dsh.message': { message: 'content' },
  'dsh.agent-presets': { agent: 'collaborator' },
  'dsh.skills': { skill: 'guidance' },
  'dsh.tools': { tool: 'capability' },
}
const REFERENCE_SCOPE_MATRIX: Readonly<Record<string, RegExp>> = {
  file: /^file\/(?:full|prefix)$/u,
  directory: /^directory\/children$/u,
  selection: /^file\/raw$/u,
  terminal: /^terminal\/scrollback$/u,
  message: /^message\/(?:user|assistant)$/u,
  image: /^image\/full$/u,
  'image-region': /^image\/region$/u,
  agent: /^agent\/preset$/u,
  skill: /^skill\/catalog$/u,
  tool: /^tool\/available$/u,
}

function canonicalReference(value: unknown): ComposerReferenceV2 | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const row = value as Partial<ComposerReferenceV2>
  if (typeof row.kind !== 'string' || typeof row.intent !== 'string' || typeof row.owner !== 'string') return undefined
  if (REFERENCE_OWNER_MATRIX[row.owner]?.[row.kind] !== row.intent) return undefined
  if (typeof row.id !== 'string' || row.id === '' || typeof row.ref !== 'string' || row.ref === ''
    || typeof row.version !== 'string' || row.version === '' || typeof row.label !== 'string' || row.label === ''
    || typeof row.scope !== 'string' || REFERENCE_SCOPE_MATRIX[row.kind]?.test(row.scope) !== true
    || typeof row.digest !== 'string' || row.digest === '') return undefined
  const window = row.window
  if (window !== undefined && (typeof window !== 'object' || window === null)) return undefined
  if (window !== undefined && (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end) || window.start < 0 || window.end <= window.start)) return undefined
  const region = row.region
  if (region !== undefined && (typeof region !== 'object' || region === null)) return undefined
  if (region !== undefined && !validImageRegion(region)) return undefined
  if ((row.kind === 'selection') !== (window !== undefined)) return undefined
  if ((row.kind === 'image-region') !== (region !== undefined)) return undefined
  if (row.kind !== 'selection' && row.kind !== 'file' && window !== undefined) return undefined
  const prompt = row.prompt
  if (prompt !== undefined && (typeof prompt !== 'object' || prompt === null || prompt.version !== 1
    || typeof prompt.body !== 'string' || typeof prompt.originalBody !== 'string'
    || typeof prompt.source !== 'object' || prompt.source === null
    || prompt.source.owner !== row.owner || prompt.source.ref !== row.ref || prompt.source.version !== row.version
    || prompt.source.scope !== row.scope || prompt.source.digest !== row.digest)) return undefined
  if (row.projection !== undefined && row.projection !== 'editable-prompt') return undefined
  if (row.editableGrant !== undefined && (typeof row.editableGrant !== 'string'
    || row.editableGrant === '' || row.editableGrant.length > 256)) return undefined
  if ((prompt !== undefined) !== (row.projection === 'editable-prompt')
    || (row.projection === 'editable-prompt') !== (row.editableGrant !== undefined)) return undefined
  return {
    id: row.id,
    kind: row.kind,
    intent: row.intent,
    owner: row.owner,
    ref: row.ref,
    version: row.version,
    label: row.label,
    scope: row.scope,
    digest: row.digest,
    freshness: row.freshness === 'stale' || row.freshness === 'frozen' || row.freshness === 'unavailable' ? row.freshness : 'fresh',
    ...(typeof row.unavailableReason === 'string' ? { unavailableReason: row.unavailableReason } : {}),
    ...(typeof row.preview === 'string' ? { preview: row.preview.slice(0, 240) } : {}),
    ...(prompt === undefined ? {} : { prompt: {
      version: 1 as const, body: prompt.body, originalBody: prompt.originalBody,
      source: { owner: row.owner, ref: row.ref, version: row.version, scope: row.scope, digest: row.digest },
      ...(prompt.edited === true ? { edited: true } : {}),
    } }),
    ...(prompt === undefined ? {} : { projection: 'editable-prompt' as const }),
    ...(row.editableGrant === undefined ? {} : { editableGrant: row.editableGrant }),
    ...(window === undefined ? {} : { window: { start: window.start, end: window.end } }),
    ...(region === undefined ? {} : { region: { x: region.x, y: region.y, width: region.width, height: region.height } }),
  }
}

interface TerminalReferenceRemote {
  list(sessionId: string): Promise<{ readonly ok: boolean; readonly sessions?: readonly { readonly terminalId: string; readonly name?: string; readonly type: string; readonly status: { readonly kind: string } }[] }>
  read(input: { readonly sessionId: string; readonly terminalId: string; readonly offset: number; readonly count: number }): Promise<{ readonly ok: boolean; readonly text?: string; readonly totalLines?: number; readonly lineBegin?: number; readonly lineEnd?: number; readonly truncated?: boolean }>
}

interface TerminalReferenceCatalogRemote {
  list(input: { readonly sessionId: string }, signal: AbortSignal): Promise<{
    readonly ok: boolean
    readonly value?: {
      readonly terminals: readonly {
        readonly terminalId: string
        readonly name?: string
        readonly type: string
        readonly status: string
        readonly version: string
        readonly digest: string
        readonly scope: 'terminal/scrollback'
        readonly preview: string
      }[]
    }
  }>
}

function terminalReferenceCatalog(ctx: ClientContext): TerminalReferenceCatalogRemote | undefined {
  try {
    return ctx.get('remote.referenceTerminals' as never) as TerminalReferenceCatalogRemote | undefined
  } catch {
    return undefined
  }
}

async function terminalReferenceRemote(ctx: ClientContext): Promise<TerminalReferenceRemote | undefined> {
  return await resolveTerminalPaneRemote(ctx as never) as TerminalReferenceRemote | undefined
}

function provideOptionalContext(ctx: ClientContext, key: string, value: unknown): () => void {
  const reflectProvide = (ctx as ClientContext & { readonly reflect?: { provide?(name: string, service: unknown): unknown } }).reflect?.provide
  if (typeof reflectProvide === 'function') {
    const dispose = reflectProvide.call((ctx as ClientContext & { readonly reflect: object }).reflect, key, value)
    return typeof dispose === 'function' ? dispose as () => void : () => {}
  }
  const provide = (ctx as ClientContext & { readonly provide?: (name: string, service: unknown) => unknown }).provide
  if (typeof provide !== 'function') return () => {}
  const dispose = provide.call(ctx, key, value)
  return typeof dispose === 'function' ? dispose as () => void : () => {}
}

function composerReferenceBridge(ctx: ClientContext): ComposerReferenceBridgeV1 | undefined {
  try {
    const bridge = ctx.get(COMPOSER_REFERENCE_BRIDGE_CONTEXT_KEY as never) as ComposerReferenceBridgeV1 | undefined
    return bridge !== undefined && typeof bridge.snapshot === 'function' ? bridge : undefined
  } catch {
    return undefined
  }
}

function referenceRequestId(prefix: string): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function referenceHandoffIdentity(detail: ComposerReferenceAddToMainDetailV1): string {
  return JSON.stringify({
    target: detail.target,
    reference: detail.reference,
    activation: detail.activation?.focus === 'composer' ? 'composer' : null,
  })
}

function validImageRegion(region: FileImageRegionReferenceDetailV1['region']): boolean {
  return [region.x, region.y, region.width, region.height].every(Number.isFinite)
    && region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0
    && region.x + region.width <= 1 && region.y + region.height <= 1
}

function requestReferenceInsertion(ctx: ClientContext, detail: ComposerReferenceAddToMainDetailV1, signal: AbortSignal): Promise<{ readonly ok: boolean; readonly reason?: string }> {
  const bridge = composerReferenceBridge(ctx)
  if (bridge?.insertReference !== undefined) {
    return bridge.insertReference(detail, signal).then(result => ({ ok: result.ok, ...(result.reason === undefined ? {} : { reason: result.reason }) }))
  }
  return requestReferenceInsertionThroughEvents(detail, signal)
}

/** Compatibility transport when the Host exposes only the V1 Window event seam. */
function requestReferenceInsertionThroughEvents(detail: ComposerReferenceAddToMainDetailV1, signal: AbortSignal): Promise<{ readonly ok: boolean; readonly reason?: string }> {
  if (detail.reference.prompt !== undefined || detail.reference.projection !== undefined || detail.reference.editableGrant !== undefined) {
    return Promise.resolve({ ok: false, reason: 'editable reference insertion requires the private Host bridge' })
  }
  if (!LEGACY_WINDOW_REFERENCE_OWNERS.has(detail.reference.owner)) {
    return Promise.resolve({ ok: false, reason: 'reference owner requires the private Host bridge' })
  }
  if (typeof window === 'undefined') return Promise.resolve({ ok: false, reason: 'browser reference bridge is unavailable' })
  let hostAvailable = false
  let hostReason = 'structured conversation insert capability is unavailable'
  window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_HOST_PROBE_EVENT, {
    detail: {
      version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
      report(available: boolean, reason?: string) {
        hostAvailable = available
        if (reason !== undefined) hostReason = reason
      },
    },
  }))
  if (!hostAvailable) return Promise.resolve({ ok: false, reason: hostReason })
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => finish({ ok: false, reason: 'structured conversation insert did not return a receipt' }), 5_000)
    const finish = (result: { readonly ok: boolean; readonly reason?: string }): void => {
      window.clearTimeout(timeout)
      window.removeEventListener(COMPOSER_REFERENCE_ADD_TO_MAIN_RESULT_EVENT, onResult)
      signal.removeEventListener('abort', onAbort)
      resolve(result)
    }
    const onResult = (event: Event): void => {
      const result = (event as CustomEvent<ComposerReferenceAddToMainResultV1>).detail
      if (result?.version !== COMPOSER_REFERENCE_PROTOCOL_VERSION || result.requestId !== detail.requestId) return
      if (result.target.workspaceId !== detail.target.workspaceId || result.target.conversationId !== detail.target.conversationId) return
      finish({ ok: result.ok, ...(result.reason === undefined ? {} : { reason: result.reason }) })
    }
    const onAbort = (): void => finish({ ok: false, reason: 'reference request was cancelled' })
    window.addEventListener(COMPOSER_REFERENCE_ADD_TO_MAIN_RESULT_EVENT, onResult)
    signal.addEventListener('abort', onAbort, { once: true })
    window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_ADD_TO_MAIN_EVENT, { detail }))
  })
}

function resolveMediaHost(ctx: ClientContext): MediaHostV1 | undefined {
  try {
    const candidate = ctx.get(MEDIA_HOST_CONTEXT_KEY as never)
    if (isMediaHostV1(candidate)) return candidate
  } catch {
    // Optional context service.
  }
  return undefined
}

function resolveGitReviewEvidence(ctx: ClientContext): GitPaneProps['review'] {
  try {
    const candidate = ctx.get('ordo.gitReviewEvidence' as never) as GitPaneProps['review']
    if (candidate?.capability === 'GitReviewEvidenceCapabilityV1' && typeof candidate.snapshot === 'function') return candidate
  } catch {
    // Optional until the Ordo owner mounts the additive review evidence seam.
  }
  return undefined
}

function resolvePaneWorkbench(ctx: ClientContext): PaneWorkbenchFace | undefined {
  try {
    const candidate = ctx.get('paneWorkbench' as never) as unknown as PaneWorkbenchFace | undefined
    if (candidate !== undefined && typeof candidate.registerView === 'function' && typeof candidate.openView === 'function') {
      return candidate
    }
  } catch {
    // Optional until this bundle bootstraps the pane shell.
  }
  return undefined
}

export function apply(ctx: ClientContext): () => void {
  // The imperative bootstrap is also called without Loader inject ordering.
  // Wait here so optional-provider changes cannot select a legacy overlay early.
  if (ctx.get('layout' as never) === undefined && typeof ctx.inject === 'function') {
    const binding = ctx.inject(['layout'] as never, (scope: ClientContext) => {
      scope.effect(() => apply(scope))
    })
    return () => { void binding.dispose() }
  }
  const unified = ctx.get('workspaceLayout' as never) as UnifiedWorkspaceLayoutFace | undefined
  const disposers: Array<() => void> = []
  // Owner-scope request cancellation（dsh-file-resource-mutation 4.5）：
  // workspace owner（当前会话）切换时 abort 全部在途浏览器请求并换新 controller。
  let ownerRequests = new AbortController()
  const ownerSignal = (): AbortSignal => ownerRequests.signal
  let pane = resolvePaneWorkbench(ctx)
  if (pane === undefined && unified?.version === 'workspace.unified.v1' && typeof ctx.inject === 'function') {
    const binding = ctx.inject(['paneWorkbench'] as never, (scope: ClientContext) => {
      scope.effect(() => apply(scope))
    })
    return () => { ownerRequests.abort(); void binding.dispose() }
  }
  if (pane === undefined) {
    try {
      disposers.push(applyPaneWorkbench(ctx))
      pane = resolvePaneWorkbench(ctx)
    } catch {
      // Official overlay bootstrap needs ctx.provide. Missing it is fail-closed.
    }
  }
  if (pane === undefined) {
    return () => {
      for (const dispose of disposers.reverse()) dispose()
    }
  }
  const workbench = pane
  let referenceBridgeContext = ctx
  let terminalReferenceContext = ctx
  let terminalReferenceCatalogContext = ctx
  if (typeof ctx.inject === 'function') {
    const catalogBinding = ctx.inject(['remote.referenceTerminals'] as never, (sub: ClientContext) => {
      terminalReferenceCatalogContext = sub
      return () => { if (terminalReferenceCatalogContext === sub) terminalReferenceCatalogContext = ctx }
    })
    disposers.push(() => { void catalogBinding.dispose() })
    const binding = ctx.inject(['remote.terminalPane'] as never, (sub: ClientContext) => {
      terminalReferenceContext = sub
      return () => { if (terminalReferenceContext === sub) terminalReferenceContext = ctx }
    })
    disposers.push(() => { void binding.dispose() })
  }

  const fileHost = resolveFileHost(ctx, ownerSignal)
  const gitHost = createExplorerGitHost({
    sessionId: () => currentSessionId(ctx),
    cwd: () => currentWorkspacePath(ctx),
  })
  const gitReview = resolveGitReviewEvidence(ctx)
  const terminalHost = resolveTerminalHost(ctx)
  const mediaHost = resolveMediaHost(ctx)
  const openFilesById = new Map<string, { readonly entry: FileEntryV1; readonly sessionId?: string }>()
  const seededMedia = new Map<string, MediaRefV1>()
  const seededMediaEntries = new Map<string, FileEntryV1>()
  const views: Array<{ descriptor: Record<string, unknown>; component: (props?: { view?: { resourceKey?: string } }) => ReactNode; showInPicker?: boolean }> = []
  disposers.push(provideOptionalContext(ctx, 'composerReferenceSourceResolver', {
    async resolve(input: {
      readonly anchor: { readonly quoteDigest: string }
      readonly context: { readonly kind: string; readonly source: string }
      readonly quote: string
      readonly sourceDescriptor: { readonly owner: string; readonly ref: string; readonly version: string; readonly scope: string; readonly window: { readonly start: number; readonly end: number } }
    }): Promise<{ readonly status: 'available'; readonly reference: ComposerReferenceV2 } | { readonly status: 'unavailable'; readonly reason: string }> {
      const source = input.sourceDescriptor
      if (source.owner !== 'dsh.local' || fileHost === undefined || fileHost.inspect === undefined) {
        return { status: 'unavailable', reason: 'selected source owner is unavailable' }
      }
      const opened = openFilesById.get(source.ref)?.entry ?? seededMediaEntries.get(source.ref)
      if (opened === undefined) return { status: 'unavailable', reason: 'selected source is no longer open' }
      const proof = await fileHost.inspect.inspect(source.ref)
      if (!proof.usable || proof.state !== 'ready' || proof.version !== source.version) {
        return { status: 'unavailable', reason: 'selected source version changed; reopen it before referencing' }
      }
      if (input.context.kind === 'image-region') {
        const binary = await fileHost.readBinary?.(opened)
        if (binary === undefined || binary.truncated || binary.version !== source.version || source.window.start !== 0 || source.window.end !== binary.bytes.byteLength) {
          return { status: 'unavailable', reason: 'selected image proof is unavailable' }
        }
        const region = { x: 0, y: 0, width: 1, height: 1 }
        const digest = await imageRegionDigest(binary.bytes, region)
        return { status: 'available', reference: { id: referenceId('image', source.ref, `${source.version}:${digest}`), kind: 'image-region', intent: 'content', owner: source.owner, ref: source.ref, version: source.version, label: opened.name, scope: source.scope, digest, freshness: 'fresh', preview: opened.name, region } }
      }
      const read = await fileHost.readText?.(opened)
      if (read === undefined || read.binary || read.truncated || read.version !== source.version) {
        return { status: 'unavailable', reason: 'selected text proof is unavailable' }
      }
      const bytes = new TextEncoder().encode(read.content)
      if (source.window.start < 0 || source.window.end <= source.window.start || source.window.end > bytes.byteLength || source.window.end - source.window.start > 16_384) {
        return { status: 'unavailable', reason: 'selected text range is outside the owner window' }
      }
      const selected = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(source.window.start, source.window.end))
      if (selected !== input.quote) return { status: 'unavailable', reason: 'selected text no longer matches the owner source' }
      const digest = await fileReferenceDigest(bytes, source.window)
      return { status: 'available', reference: { id: referenceId('selection', source.ref, `${source.version}:${source.window.start}:${source.window.end}:${digest}`), kind: 'selection', intent: 'content', owner: source.owner, ref: source.ref, version: source.version, label: opened.name, scope: source.scope, digest, freshness: 'fresh', preview: input.quote.replace(/\s+/gu, ' ').trim().slice(0, 240), window: source.window } }
    },
  }))
  const prepareCatalogReference = async (
    target: Parameters<ComposerReferenceCatalogV1['list']>[0],
    reference: ComposerReferenceV2,
    signal: AbortSignal,
  ): Promise<ComposerReferenceV2 | undefined> => {
    const bridge = composerReferenceBridge(ctx)
    if (bridge?.prepareReference === undefined) return undefined
    const prepared = await bridge.prepareReference({ target, reference }, signal)
    return prepared.status === 'available' ? prepared.reference : undefined
  }
  const referenceCatalog: ComposerReferenceCatalogV1 = {
    async list(target, query, signal) {
      if (target.conversationId !== currentSessionId(ctx)) return []
      const candidates: ComposerReferenceCatalogCandidateV1[] = []
      if (fileHost?.treeV2 !== undefined && fileHost.inspect !== undefined) {
        const page = query.trim() === ''
          ? await fileHost.treeV2.roots({ limit: 20 })
          : await fileHost.treeV2.search({ query: query.trim(), limit: 20 })
        for (const node of page.nodes) {
          signal.throwIfAborted()
          if (node.kind === 'symlink' || node.sensitive) continue
          if (node.kind === 'directory') {
            const listing = await fileHost.treeV2.listChildren(node.ref, { limit: 200 })
            const entries = listing.nodes.map(item => ({ name: item.name, kind: item.kind === 'directory' ? 'directory' as const : 'file' as const }))
            const digest = await sha256(JSON.stringify({ ref: node.ref, revision: listing.revision, entries, truncated: listing.truncated }))
            const reference = await prepareCatalogReference(target, { id: referenceId('directory', node.ref, `${listing.revision}:${digest}`), kind: 'directory', intent: 'content', owner: 'dsh.local', ref: node.ref, version: listing.revision, label: node.name, scope: 'directory/children', digest, freshness: 'fresh', preview: entries.slice(0, 8).map(item => item.name).join('\n') }, signal)
            if (reference !== undefined) candidates.push({
              name: `${node.name}/`, description: entries.slice(0, 4).map(item => item.name).join(', '), section: 'Files & folders',
              reference,
            })
            continue
          }
          if (node.availability.inspect.state !== 'available') continue
          const proof = await fileHost.inspect.inspect(node.ref)
          if (!proof.usable) continue
          const classified = classifyFileEntry(node.name, proof.resource?.mediaType)
          const inferredKind = proof.resource?.kind ?? classified?.kind ?? 'file'
          const entryKind: FileEntryV1['kind'] = inferredKind === 'audio' || inferredKind === 'video' ? 'file' : inferredKind
          const entry: FileEntryV1 = { id: node.ref, name: node.name, kind: entryKind, ...(proof.resource?.mediaType === undefined ? {} : { mediaType: proof.resource.mediaType }), capabilities: ['preview', 'open'] }
          if (entry.kind === 'image') {
            const binary = await fileHost.readBinary?.(entry)
            if (binary === undefined || binary.truncated || binary.version !== proof.version) continue
            const digest = await sha256(binary.bytes)
            const description = binary.mediaType ?? entry.mediaType
            candidates.push({
              name: node.name, ...(description === undefined ? {} : { description }), section: 'Images',
              reference: { id: referenceId('image', node.ref, `${proof.version}:${digest}`), kind: 'image', intent: 'content', owner: 'dsh.local', ref: node.ref, version: proof.version, label: node.name, scope: 'image/full', digest, freshness: 'fresh' },
            })
            continue
          }
          if (proof.state !== 'ready') continue
          const read = await fileHost.readText?.(entry)
          if (read === undefined || read.binary || read.truncated || read.version !== proof.version) continue
          const bytes = new TextEncoder().encode(read.content)
          if (bytes.byteLength === 0) continue
          const capture = utf8Capture(bytes, 16_384)
          if (capture.end === 0) continue
          const window = { start: 0, end: capture.end }
          const scope = bytes.byteLength > window.end ? 'file/prefix' as const : 'file/full' as const
          const digest = await fileReferenceDigest(bytes, window)
          const reference = await prepareCatalogReference(target, { id: referenceId('file', node.ref, proof.version), kind: 'file', intent: 'content', owner: 'dsh.local', ref: node.ref, version: proof.version, label: node.name, scope, digest, freshness: 'fresh', preview: capture.body.replace(/\s+/gu, ' ').trim().slice(0, 240), window }, signal)
          if (reference !== undefined) candidates.push({
            name: node.name, ...(proof.resource?.mediaType === undefined ? {} : { description: proof.resource.mediaType }), section: 'Files & folders',
            reference,
          })
        }
      }
      const terminalCatalog = terminalReferenceCatalog(terminalReferenceCatalogContext)
      if (terminalCatalog !== undefined) {
        const result = await terminalCatalog.list({ sessionId: target.conversationId }, signal)
        if (!result.ok || result.value === undefined) throw new Error('terminal reference owner catalog rejected the request')
        for (const row of result.value.terminals) {
          if (query !== '' && !(row.name ?? row.terminalId).toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue
          const reference = await prepareCatalogReference(target, { id: referenceId('terminal', row.terminalId, row.version), kind: 'terminal', intent: 'content', owner: 'dsh.terminal', ref: row.terminalId, version: row.version, label: row.name ?? row.terminalId, scope: row.scope, digest: row.digest, freshness: 'fresh', preview: row.preview }, signal)
          if (reference !== undefined) candidates.push({
            name: row.name ?? row.terminalId, description: row.status, section: 'Terminals',
            reference,
          })
        }
      } else {
        const terminalRemote = await terminalReferenceRemote(terminalReferenceContext)
        if (terminalRemote === undefined) return candidates
        const listed = await terminalRemote.list(target.conversationId)
        if (listed.ok && Array.isArray(listed.sessions)) {
          for (const row of listed.sessions.slice(0, 8)) {
            if (query !== '' && !(row.name ?? row.terminalId).toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue
            const read = await terminalRemote.read({ sessionId: target.conversationId, terminalId: row.terminalId, offset: 0, count: 200 })
            if (!read.ok || typeof read.text !== 'string' || typeof read.totalLines !== 'number' || typeof read.lineBegin !== 'number' || typeof read.lineEnd !== 'number' || typeof read.truncated !== 'boolean') continue
            const proof = await terminalReferenceProof(row, read as Required<Pick<typeof read, 'text' | 'totalLines' | 'lineBegin' | 'lineEnd' | 'truncated'>>)
            const reference = await prepareCatalogReference(target, { id: referenceId('terminal', row.terminalId, proof.version), kind: 'terminal', intent: 'content', owner: 'dsh.terminal', ref: row.terminalId, version: proof.version, label: row.name ?? row.terminalId, scope: 'terminal/scrollback', digest: proof.digest, freshness: 'fresh', preview: read.text.replace(/\s+/gu, ' ').trim().slice(0, 240) }, signal)
            if (reference !== undefined) candidates.push({
              name: row.name ?? row.terminalId, description: row.status.kind, section: 'Terminals',
              reference,
            })
          }
        }
      }
      return candidates
    },
  }
  disposers.push(provideOptionalContext(ctx, COMPOSER_REFERENCE_CATALOG_CONTEXT_KEY, referenceCatalog))
  const resolveSeededUrl = async (media: MediaRefV1): Promise<string | undefined> => {
    const entry = seededMediaEntries.get(media.ref)
    if (entry === undefined || fileHost === undefined) return undefined
    const direct = fileHost.resolvePreviewUrl?.(entry)
    if (direct !== undefined) return direct
    const binary = await fileHost.readBinary?.(entry)
    if (binary === undefined || binary.truncated || binary.bytes.byteLength === 0 || typeof URL.createObjectURL !== 'function') return undefined
    return URL.createObjectURL(new Blob([new Uint8Array(binary.bytes)], { type: binary.mediaType ?? media.mediaType }))
  }
  // file-preview-dispatch: one Tab per opened resource, never a singleton takeover.
  const openPreviewDispatch = (entry: FileEntryV1, preview: boolean): void => {
    const sessionId = currentSessionId(ctx)
    openFilesById.set(entry.id, { entry, ...(sessionId === undefined ? {} : { sessionId }) })
    workbench.openView({
      kind: 'desktop.preview',
      resourceKey: entry.id,
      role: 'content',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: false,
      preview,
      pinned: !preview,
      title: entry.name,
    })
  }
  const openFile = (entry: FileEntryV1, preview: boolean): void => {
    if (entry.kind === 'directory') return
    if (routesToPreviewDispatch(entry)) {
      openPreviewDispatch(entry, preview)
      return
    }
    const sessionId = currentSessionId(ctx)
    openFilesById.set(entry.id, { entry, ...(sessionId === undefined ? {} : { sessionId }) })
    workbench.openView({
      kind: 'desktop.file',
      resourceKey: entry.id,
      role: 'content',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: false,
      preview,
      pinned: !preview,
      title: entry.name,
    })
  }
  const LegacyDesktopFilesShim = (): ReactNode => {
    useEffect(() => { workbench.openView({ kind: 'dsh.explorer', resourceKey: 'navigator:dsh.explorer', role: 'navigator', preferredRegion: 'right', retention: 'keep-alive', singleton: true, pinned: true, title: 'Explorer' }) }, [])
    return createElement('p', { role: 'status', 'data-explorer-legacy-shim': 'desktop.files' }, '文件导航已迁移到 dsh.explorer。')
  }
  if (fileHost?.treeV2 !== undefined) {
    let ownerFence: Pick<FileTreePageV2, 'workspaceRef' | 'generation' | 'revision'> | undefined
    let rootRef: string | undefined
    const rememberPage = (page: FileTreePageV2): import('@yeisme/dsh-client-ui-pane-workbench/client').ExplorerTreeNodeV1[] => {
      ownerFence = { workspaceRef: page.workspaceRef, generation: page.generation, revision: page.revision }
      rootRef = page.rootRef ?? rootRef
      return page.nodes.map(mapExplorerNode)
    }
    const openExplorerFile = async (node: import('@yeisme/dsh-client-ui-pane-workbench/client').ExplorerTreeNodeV1, mode: 'preview' | 'pin'): Promise<{ readonly ok: boolean; readonly reason?: string }> => {
      if (node.kind === 'directory') return { ok: false, reason: 'directory is not a preview resource' }
      if (node.availability?.preview !== undefined && node.availability.preview !== 'available') return { ok: false, reason: node.availability.reason ?? 'owner preview is unavailable' }
      if (fileHost.inspect === undefined) return { ok: false, reason: 'owner inspect capability is unavailable' }
      const proof = await fileHost.inspect.inspect(node.ref)
      if (!proof.usable || (proof.state !== 'ready' && proof.state !== 'partial')) return { ok: false, reason: proof.reason ?? 'owner preview proof is not usable' }
      const proofKind = proof.resource?.kind
      const entry: FileEntryV1 = {
        id: node.ref,
        ...(node.parentRef === undefined ? {} : { parentId: node.parentRef }),
        name: proof.resource?.name ?? node.name,
        kind: proofKind === 'image' || proofKind === 'pdf' || proofKind === 'directory' ? proofKind : node.kind === 'symlink' ? 'file' : node.kind,
        ...(proof.resource?.mediaType === undefined ? {} : { mediaType: proof.resource.mediaType }),
        capabilities: node.capabilities.filter((capability): capability is 'preview' | 'open' | 'download' | 'edit' => capability === 'preview' || capability === 'open' || capability === 'download' || capability === 'edit'),
      }
      if (!getComposerReferenceDraftControllerV2().snapshot().hostAvailable) {
        getComposerReferenceController().dispatch({ type: 'mark_stale', ref: proof.ref, version: proof.version })
        getComposerReferenceController().dispatch({ type: 'replace_active', reference: {
          id: referenceId('file', proof.ref, proof.version), kind: 'file-preview', owner: proof.owner, ref: proof.ref, version: proof.version,
          label: proof.resource?.name ?? node.name, scope: 'workspace', digest: proof.inspectedWindow?.digest ?? referenceId('digest', proof.ref, proof.version), freshness: 'fresh',
          ...(proof.inspectedWindow === undefined ? {} : { window: { start: proof.inspectedWindow.start, end: proof.inspectedWindow.end } }),
        } })
      }
      openFile(entry, mode === 'preview')
      return { ok: true }
    }
    const runtime: ExplorerRuntimeV2 = {
      getRootRef: () => rootRef,
      roots: async () => rememberPage(await fileHost.treeV2!.roots({ limit: 200 })),
      listChildren: async ref => rememberPage(await fileHost.treeV2!.listChildren(ref, { limit: 200 })),
      search: async query => rememberPage(await fileHost.treeV2!.search({ query, limit: 200 })),
      inspectMetadata: async node => {
        if (fileHost.inspect === undefined) return { ref: node.ref, version: node.version, state: 'unsupported', label: node.name, detail: 'owner inspect capability is unavailable' }
        const proof = await fileHost.inspect.inspect(node.ref)
        return { ref: node.ref, version: proof.version, state: proof.state, label: proof.resource?.name ?? node.name, ...(proof.reason === undefined ? {} : { detail: proof.reason }), sensitive: proof.sensitive }
      },
      revealSensitive: async node => {
        if (fileHost.inspect?.reveal === undefined) return { ok: false, reason: 'owner sensitive reveal capability is unavailable' }
        try { await fileHost.inspect.reveal(node.ref, node.version); return { ok: true } } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : 'sensitive reveal failed' } }
      },
      openResource: openExplorerFile,
      addReference: async node => {
        const bridge = composerReferenceBridge(referenceBridgeContext)
        const snapshot = bridge?.snapshot()
        const target = snapshot?.target
        if (snapshot?.available !== true || target === undefined) {
          return { ok: false, reason: snapshot?.reason ?? 'current conversation reference target is unavailable' }
        }
        const candidates = await referenceCatalog.list(target, node.name, ownerSignal())
        const candidate = candidates.find(item => item.reference.ref === node.ref
          && (item.reference.kind === 'file' || item.reference.kind === 'directory' || item.reference.kind === 'image'))
        if (candidate === undefined) return { ok: false, reason: 'file owner could not produce a current reference proof' }
        const requestId = referenceRequestId('explorer-reference')
        return requestReferenceInsertion(ctx, {
          version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
          requestId,
          target,
          reference: candidate.reference,
        }, ownerSignal())
      },
      ...(fileHost.mutations === undefined ? {} : { mutation: {
        get enabled() { return fileHost.mutations!.enabled },
        get disabledReason() { return fileHost.mutations!.disabledReason },
        propose: async input => {
          if (ownerFence === undefined) throw new Error('Explorer owner fence is unavailable')
          const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
          const base: FileResourceMutationIntentV1 = { action: input.action, workspaceRef: ownerFence.workspaceRef, principalRef: 'local', generation: ownerFence.generation, leaseRef: 'local', expectedRevision: ownerFence.revision, idempotencyKey, ...(input.targetRefs === undefined ? {} : { targetRefs: input.targetRefs }), ...(input.destinationRef === undefined ? {} : { destinationRef: input.destinationRef }), ...(input.name === undefined ? {} : { name: input.name }), ...(input.importRef === undefined ? {} : { importRef: input.importRef }), ...(input.undoRef === undefined ? {} : { undoRef: input.undoRef }) }
          let preflight = await fileHost.mutations!.preflight(base)
          return {
            proposalRef: preflight.proposalRef, action: input.action,
            summary: `${input.action}: ${preflight.targetSummary.map(item => item.name).join(', ') || input.name || 'workspace resource'}`,
            risks: preflight.risks, conflicts: preflight.conflicts.map(item => item.name), reversible: preflight.reversible, expiresAt: preflight.expiresAt,
            execute: async choice => {
              let intent = base
              if (preflight.conflicts.length > 0) {
                if (choice === undefined || choice === 'cancel') return { ok: false, reason: 'conflict decision is required' }
                intent = { ...base, conflict: choice }
                preflight = await fileHost.mutations!.preflight(intent)
              }
              let receipt
              try {
                receipt = await fileHost.mutations!.execute(preflight.proposalRef, { ...intent, previewDigest: preflight.previewDigest })
              } catch (error) {
                // owner 切换中止的在途 execute：结果未知，走 owner reconcile（幂等键），
                // 不伪造成功也不静默重试。
                if (error instanceof DOMException && error.name === 'AbortError') return { ok: false, reason: 'owner-switched' }
                throw error
              }
              if (receipt.status !== 'success') return { ok: false, reason: receipt.reason ?? receipt.status }
              for (const redirect of receipt.redirects ?? []) getComposerReferenceController().dispatch({ type: 'redirect', oldRef: redirect.oldRef, newRef: redirect.newRef })
              if (receipt.revision !== undefined && ownerFence !== undefined) ownerFence = { ...ownerFence, revision: receipt.revision }
              return { ok: true, ...(receipt.undoRef === undefined ? {} : { undo: async () => { const undone = await fileHost.mutations!.undo(receipt.receiptRef); return { ok: undone.status === 'rolled_back', ...(undone.reason === undefined ? {} : { reason: undone.reason }) } } }) }
            },
          }
        },
      } }),
      ...(fileHost.transfer === undefined ? {} : { transfer: {
        get enabled() { return fileHost.transfer!.enabled },
        get disabledReason() { return fileHost.transfer!.disabledReason },
        importFile: async file => {
          if (ownerFence === undefined) throw new Error('Explorer owner fence is unavailable')
          const upload = await fileHost.transfer!.createUpload({ workspaceRef: ownerFence.workspaceRef, generation: ownerFence.generation, name: file.name, size: file.size })
          let offset = 0
          try {
            while (offset < file.size) { const bytes = new Uint8Array(await file.slice(offset, offset + upload.chunkSize).arrayBuffer()); await fileHost.transfer!.uploadChunk(upload.sessionRef, offset, bytes); offset += bytes.byteLength }
          } catch (error) {
            // owner 切换中止上传：尽力取消 upload session 后如实失败。
            if (error instanceof DOMException && error.name === 'AbortError') {
              try { await fileHost.transfer!.cancelUpload(upload.sessionRef) } catch { /* owner 已失效，取消尽力而为 */ }
              throw new Error('owner-switched')
            }
            throw error
          }
          const committed = await fileHost.transfer!.commitUpload(upload.sessionRef)
          return { importRef: committed.importRef, name: file.name, size: committed.size }
        },
        download: async (ref, version) => { const ticket = await fileHost.transfer!.issueDownloadTicket(ref, version, 'attachment'); if (fileHost.transfer!.download === undefined) throw new Error('download stream is unavailable'); return fileHost.transfer!.download(ticket.ticket) },
      } }),
    }
    disposers.push(workbench.registerExplorerRuntime?.(runtime) ?? bindExplorerRuntime(runtime))
    try {
      const sessions = ctx.get('sessions' as never) as SessionListFace | undefined
      let ownerSession = currentSessionId(ctx)
      const unsubscribe = sessions?.list?.subscribe?.(() => {
        const nextSession = currentSessionId(ctx)
        if (nextSession === ownerSession) return
        ownerSession = nextSession
        // 4.5：owner 切换 → 立即取消在途浏览器请求，再作废本地 fence/引用。
        ownerRequests.abort('workspace-owner-switched')
        ownerRequests = new AbortController()
        ownerFence = undefined
        rootRef = undefined
        getComposerReferenceController().dispatch({ type: 'mark_all_stale' })
      })
      if (unsubscribe !== undefined) disposers.push(unsubscribe)
    } catch {
      // Optional session subscription; request-time resolution remains authoritative.
    }
  }
  if (fileHost !== undefined) views.push(
    {
      descriptor: { kind: 'desktop.files', label: '文件（兼容别名）', componentKey: 'desktop-files-alias', role: 'navigator', preferredRegion: 'right', retention: 'recreate', singleton: true, presentation: { description: '已迁移到 dsh.explorer；保留用于旧布局恢复。' } },
      showInPicker: false,
      component: LegacyDesktopFilesShim,
    },
    {
      descriptor: { kind: 'desktop.file', label: '文件内容', componentKey: 'desktop-file', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, presentation: { description: '在窗格中查看单个文件的内容。' } },
      component: props => {
        const resourceKey = props?.view?.resourceKey
        const opened = resourceKey === undefined ? undefined : openFilesById.get(resourceKey)
        if (opened === undefined) return createElement('p', { role: 'status' }, '文件不可用。')
        return createElement(FileOpenPane, { host: fileHost, entry: opened.entry, ...(opened.sessionId === undefined ? {} : { semanticSessionId: opened.sessionId }) })
      },
    },
    {
      descriptor: { kind: 'desktop.preview', label: '文件预览', componentKey: 'desktop-preview', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, presentation: { description: '按类型分派的单文件预览：音视频、PDF、表格、文档、归档与二进制。' } },
      component: props => {
        const resourceKey = props?.view?.resourceKey
        const opened = resourceKey === undefined ? undefined : openFilesById.get(resourceKey)
        if (opened === undefined) return createElement('p', { role: 'status' }, '文件不可用。')
        return createElement(FilePreviewDispatchPane, { host: fileHost, entry: opened.entry })
      },
    },
    {
      descriptor: { kind: 'desktop.documents', label: '文档', componentKey: 'desktop-documents', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { description: '文档库：浏览并打开文档类文件。' } },
      component: () => createElement(FilePane, { host: fileHost, tabId: 'documents', showPreviewPanel: false, compact: true, onOpenEntry: entry => openFile(entry, true) }),
    },
  )
  if (gitHost !== undefined) views.push({
    descriptor: { kind: 'desktop.git', label: 'Git', componentKey: 'desktop-git', role: 'utility', preferredRegion: 'right', retention: 'recreate', singleton: true, presentation: { description: '查看仓库变更状态并发起安全的 Git 操作。' } },
    component: () => createElement(GitPane, { host: gitHost, ...(gitReview === undefined ? {} : { review: gitReview }) }),
  })
  if (terminalHost !== undefined) views.push(
    {
      descriptor: { kind: 'desktop.terminal', label: '终端', componentKey: 'desktop-terminal', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: true, presentation: { description: '在底部停靠的终端窗格中运行命令。' } },
      component: () => createElement(TerminalPane, { host: terminalHost }),
    },
  )
  views.push({
    descriptor: { kind: 'desktop.media', label: '媒体', componentKey: 'desktop-media', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { description: '媒体库：浏览会话媒体投影与聊天媒体；单文件预览在文件预览 Tab 打开。' } },
    component: props => createElement(MediaPane, {
      host: mediaHost,
      seeded: seededMedia,
      selectedKey: props?.view?.resourceKey,
      resolveSeededUrl,
    }),
  })
  views.push({
    descriptor: { kind: 'desktop.sessions', label: '对话管理', componentKey: 'desktop-sessions', role: 'navigator', preferredRegion: 'right', retention: 'keep-alive', singleton: true, presentation: { description: '跨工作区查找、恢复与归档历史会话。' } },
    component: () => createElement(ConversationManagerPane, { ctx }),
  })
  for (const view of views) disposers.push(workbench.registerView(view))

  const openFiles = (): void => workbench.openView({
    kind: 'dsh.explorer', resourceKey: 'navigator:dsh.explorer', role: 'navigator', preferredRegion: 'right',
    retention: 'keep-alive', singleton: true, pinned: true, title: 'Explorer',
  })
  const openGit = (): void => workbench.openView({
    kind: 'desktop.git', resourceKey: 'desktop:git', role: 'utility', preferredRegion: 'right',
    retention: 'recreate', singleton: true, pinned: true, title: 'Git',
  })
  const openTerminal = (): void => workbench.openView({
    kind: 'desktop.terminal', resourceKey: 'desktop:terminal', role: 'utility', preferredRegion: 'bottom',
    retention: 'keep-alive', singleton: true, pinned: true, title: '终端',
  })
  const openSessions = (): void => workbench.openView({
    kind: 'desktop.sessions', resourceKey: 'desktop:sessions', role: 'navigator', preferredRegion: 'right',
    retention: 'keep-alive', singleton: true, pinned: true, title: '对话管理',
  })
  let hasCorePaneHost = false
  try {
    hasCorePaneHost = ctx.get('workspaceLayout' as never) !== undefined
  } catch {
    hasCorePaneHost = false
  }
  if (fileHost !== undefined && hasCorePaneHost && unified?.version !== 'workspace.unified.v1') openFiles()
  const slots = ctx.get('slots') as unknown as {
    inject(name: string, setup: () => () => void): () => void
    register(input: unknown, component: (props?: { wide?: boolean }) => ReactNode): () => void
  }
  if (typeof window !== 'undefined') {
    const referenceDrafts = getComposerReferenceDraftControllerV2()
    // Additive feature probe passthrough：bridge 本体仍属宿主，这里只叠加
    // features 投影。activation 以本 bundle 的 host-insert seam 握手为准；
    // chooseTarget 无宿主 seam（upstream patch 材料），缺席即禁用入口。
    let hostInsertSeamAvailable = false
    let hostActivationAvailable = false
    let underlyingReferenceBridge = composerReferenceBridge(referenceBridgeContext)
    let disposeUnderlyingForward = () => {}
    const decoratedListeners = new Set<() => void>()
    const notifyDecorated = (): void => { for (const listener of decoratedListeners) listener() }
    const decoratedBridge: ComposerReferenceBridgeV1 = {
      snapshot: () => {
        const base = underlyingReferenceBridge?.snapshot() ?? { available: false, reason: 'structured conversation insert capability is unavailable' }
        const chooseTarget = base.features?.chooseTarget === true && typeof underlyingReferenceBridge?.chooseTarget === 'function'
        return {
          ...base,
          features: {
            ...(base.features ?? {}),
            activation: hostInsertSeamAvailable && hostActivationAvailable,
            ...(chooseTarget ? { chooseTarget: true } : {}),
          },
        }
      },
      subscribe: listener => {
        decoratedListeners.add(listener)
        return () => { decoratedListeners.delete(listener) }
      },
      resolveSelection: input => underlyingReferenceBridge?.resolveSelection(input)
        ?? Promise.resolve({ status: 'unavailable' as const, reason: 'structured conversation reference bridge is unavailable' }),
      chooseTarget: signal => underlyingReferenceBridge?.chooseTarget?.(signal)
        ?? Promise.resolve({ status: 'unavailable' as const, reason: 'conversation target chooser is unavailable' }),
      prepareReference: (input, signal) => underlyingReferenceBridge?.prepareReference?.(input, signal)
        ?? Promise.resolve({ status: 'unavailable' as const, reason: 'editable reference preparation is unavailable' }),
      insertReference: (detail, signal) => underlyingReferenceBridge?.insertReference?.(detail, signal)
        ?? requestReferenceInsertionThroughEvents(detail, signal ?? new AbortController().signal).then(result => ({
          version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
          ...(detail.requestId === undefined ? {} : { requestId: detail.requestId }),
          target: detail.target,
          ...result,
        })),
      referenceInsertion: input => underlyingReferenceBridge?.referenceInsertion?.(input) ?? { status: 'unknown' },
    }
    const resolveUnderlyingBridge = (): ComposerReferenceBridgeV1 | undefined => {
      const resolved = composerReferenceBridge(referenceBridgeContext)
      // 自身提供的 decorated 投影不得递归成为 underlying。
      return resolved === decoratedBridge ? underlyingReferenceBridge : resolved
    }
    let disposeReferenceBridgeSubscription = () => {}
    const syncReferenceDrafts = (): void => {
      const snapshot = resolveUnderlyingBridge()?.snapshot()
      if (snapshot?.available !== true || snapshot.target === undefined || snapshot.references === undefined) {
        referenceDrafts.setHostAvailability(false, snapshot?.reason ?? 'structured conversation insert capability is unavailable')
        return
      }
      referenceDrafts.setHostAvailability(true)
      referenceDrafts.replace(snapshot.target, snapshot.references.flatMap(value => {
        const reference = canonicalReference(value)
        return reference === undefined ? [] : [reference]
      }))
    }
    const bindReferenceBridge = (): void => {
      disposeReferenceBridgeSubscription()
      disposeReferenceBridgeSubscription = () => {}
      disposeUnderlyingForward()
      disposeUnderlyingForward = () => {}
      const bridge = resolveUnderlyingBridge()
      underlyingReferenceBridge = bridge
      if (bridge === undefined) {
        referenceDrafts.setHostAvailability(false, 'structured conversation insert capability is unavailable')
        notifyDecorated()
        return
      }
      syncReferenceDrafts()
      disposeReferenceBridgeSubscription = bridge.subscribe(syncReferenceDrafts)
      disposeUnderlyingForward = bridge.subscribe(notifyDecorated)
      notifyDecorated()
    }
    // 宿主已占用该 context key 时 provide 会抛错：fail-closed，保留宿主
    // 原桥（features 缺席 → 插件诚实降级），不中断整个 bundle apply。
    try {
      disposers.push(provideOptionalContext(ctx, COMPOSER_REFERENCE_BRIDGE_CONTEXT_KEY, decoratedBridge))
    } catch {
      // Host owns the bridge key; the undecorated bridge keeps features absent.
    }
    bindReferenceBridge()
    if (typeof ctx.inject === 'function') {
      ctx.inject([COMPOSER_REFERENCE_BRIDGE_CONTEXT_KEY] as never, (sub: ClientContext) => {
        referenceBridgeContext = sub
        bindReferenceBridge()
        return () => {
          if (referenceBridgeContext !== sub) return
          referenceBridgeContext = ctx
          bindReferenceBridge()
        }
      })
    }
    disposers.push(() => { disposeReferenceBridgeSubscription(); disposeReferenceBridgeSubscription = () => {} })
    disposers.push(() => { disposeUnderlyingForward(); disposeUnderlyingForward = () => {} })
    let handoffSeq = 0
    const pendingReferenceHandoffs = new Map<string, { readonly identity: string; readonly request: ComposerReferenceAddToMainDetailV1 }>()
    const settledReferenceHandoffs = new Map<string, { readonly identity: string; readonly result: ComposerReferenceAddToMainResultV1 }>()
    const pendingReferenceRemovals = new Map<string, { readonly request: ComposerReferenceRemoveFromMainDetailV1; readonly hostTarget: ComposerReferenceRemoveFromMainDetailV1['target'] }>()
    const emitReferenceResult = (detail: ComposerReferenceAddToMainResultV1): void => {
      window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_ADD_TO_MAIN_RESULT_EVENT, { detail }))
    }
    const emitReferenceRemovalResult = (detail: ComposerReferenceRemoveFromMainResultV1): void => {
      window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_REMOVE_FROM_MAIN_RESULT_EVENT, { detail }))
    }
    const parseReferenceHandoff = (value: unknown): ComposerReferenceAddToMainDetailV1 | undefined => {
      if (typeof value !== 'object' || value === null) return undefined
      const detail = value as Partial<ComposerReferenceAddToMainDetailV1>
      const target = detail.target
      const reference = canonicalReference(detail.reference)
      if (detail.version !== COMPOSER_REFERENCE_PROTOCOL_VERSION || target === undefined || reference === undefined
        || reference.prompt !== undefined || reference.projection !== undefined || reference.editableGrant !== undefined
        || typeof target.workspaceId !== 'string' || target.workspaceId === ''
        || typeof target.conversationId !== 'string' || target.conversationId === '') return undefined
      const caret = target.caret
      const canonicalTarget = {
        workspaceId: target.workspaceId,
        conversationId: target.conversationId,
        ...(Number.isSafeInteger(target.draftRevision) ? { draftRevision: target.draftRevision } : {}),
        ...(typeof target.title === 'string' ? { title: target.title } : {}),
        ...(caret !== undefined && Number.isSafeInteger(caret.start) && Number.isSafeInteger(caret.end) && caret.start >= 0 && caret.end >= caret.start
          ? { caret: { start: caret.start, end: caret.end } }
          : {}),
      }
      return {
        version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
        ...(typeof detail.requestId === 'string' ? { requestId: detail.requestId } : {}),
        target: canonicalTarget,
        reference,
        // Additive activation passthrough：只转发合法形状，缺席/非法即省略。
        ...(detail.activation !== undefined && detail.activation !== null && detail.activation.focus === 'composer'
          ? { activation: { focus: 'composer' as const } }
          : {}),
      }
    }
    const onReferenceHandoff = (event: Event): void => {
      const detail = parseReferenceHandoff((event as CustomEvent<unknown>).detail)
      if (detail === undefined) return
      const accepted = referenceDrafts.admit(detail.reference)
      if (!accepted.ok) {
        emitReferenceResult({
          version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
          ...(detail.requestId === undefined ? {} : { requestId: detail.requestId }),
          target: detail.target,
          ok: false,
          ...(accepted.reason === undefined ? {} : { reason: accepted.reason }),
        })
        return
      }
      handoffSeq += 1
      const requestId = detail.requestId ?? `workbench-reference-${handoffSeq}`
      const identity = referenceHandoffIdentity(detail)
      const settled = settledReferenceHandoffs.get(requestId)
      if (settled !== undefined) {
        emitReferenceResult(settled.identity === identity
          ? settled.result
          : {
              version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
              ...(detail.requestId === undefined ? {} : { requestId: detail.requestId }),
              target: detail.target,
              ok: false,
              reason: 'reference request id was reused with different content',
            })
        return
      }
      const pending = pendingReferenceHandoffs.get(requestId)
      if (pending !== undefined) {
        if (pending.identity !== identity) {
          emitReferenceResult({
            version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
            ...(detail.requestId === undefined ? {} : { requestId: detail.requestId }),
            target: detail.target,
            ok: false,
            reason: 'reference request id was reused with different content',
          })
        }
        return
      }
      pendingReferenceHandoffs.set(requestId, { identity, request: detail })
      window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_HOST_INSERT_EVENT, {
        detail: {
          version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
          requestId,
          target: detail.target,
          reference: detail.reference,
          ...(detail.activation === undefined ? {} : { activation: detail.activation }),
        },
      }))
    }
    const onReferenceInsertResult = (event: Event): void => {
      const result = (event as CustomEvent<ComposerReferenceHostInsertResultV1>).detail
      if (result?.version !== COMPOSER_REFERENCE_PROTOCOL_VERSION || typeof result.requestId !== 'string') return
      const pending = pendingReferenceHandoffs.get(result.requestId)
      if (pending === undefined) return
      const request = pending.request
      if (result.target.workspaceId !== request.target.workspaceId || result.target.conversationId !== request.target.conversationId) return
      pendingReferenceHandoffs.delete(result.requestId)
      if (result.ok) syncReferenceDrafts()
      const handoffResult = {
        version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
        ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
        target: request.target,
        ok: result.ok,
        ...(result.ok || result.reason === undefined ? {} : { reason: result.reason }),
        // 宿主未回 activated 字段时省略，插件按未确认处理（不伪造已聚焦）。
        ...(typeof result.activated === 'boolean' ? { activated: result.activated } : {}),
      }
      settledReferenceHandoffs.set(result.requestId, { identity: pending.identity, result: handoffResult })
      if (settledReferenceHandoffs.size > 256) settledReferenceHandoffs.delete(settledReferenceHandoffs.keys().next().value as string)
      emitReferenceResult(handoffResult)
    }
    const onReferenceRemoval = (event: Event): void => {
      const detail = (event as CustomEvent<ComposerReferenceRemoveFromMainDetailV1>).detail
      if (detail?.version !== COMPOSER_REFERENCE_PROTOCOL_VERSION || typeof detail.requestId !== 'string' || detail.requestId === ''
        || typeof detail.referenceId !== 'string' || detail.referenceId === ''
        || typeof detail.target?.workspaceId !== 'string' || typeof detail.target.conversationId !== 'string') return
      const snapshot = composerReferenceBridge(referenceBridgeContext)?.snapshot()
      const hostTarget = snapshot?.target
      if (snapshot?.available !== true || hostTarget === undefined
        || hostTarget.workspaceId !== detail.target.workspaceId || hostTarget.conversationId !== detail.target.conversationId) {
        emitReferenceRemovalResult({ ...detail, ok: false, reason: snapshot?.reason ?? 'target conversation is unavailable' })
        return
      }
      pendingReferenceRemovals.set(detail.requestId, { request: detail, hostTarget })
      window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_HOST_REMOVE_EVENT, { detail: { ...detail, target: hostTarget } }))
    }
    const onReferenceHostRemovalResult = (event: Event): void => {
      const result = (event as CustomEvent<ComposerReferenceHostRemoveResultV1>).detail
      if (result?.version !== COMPOSER_REFERENCE_PROTOCOL_VERSION || typeof result.requestId !== 'string') return
      const pending = pendingReferenceRemovals.get(result.requestId)
      if (pending === undefined || result.target.workspaceId !== pending.hostTarget.workspaceId
        || result.target.conversationId !== pending.hostTarget.conversationId) return
      pendingReferenceRemovals.delete(result.requestId)
      if (result.ok) syncReferenceDrafts()
      emitReferenceRemovalResult({ ...pending.request, ok: result.ok, ...(result.reason === undefined ? {} : { reason: result.reason }) })
    }
    const reportHostAvailability = (
      available: boolean,
      reason?: string,
      features?: { readonly activation?: boolean },
    ): void => {
      hostInsertSeamAvailable = available
      hostActivationAvailable = available && features?.activation === true
      if (available) syncReferenceDrafts()
      else referenceDrafts.setHostAvailability(false, reason)
      notifyDecorated()
    }
    window.addEventListener(COMPOSER_REFERENCE_ADD_TO_MAIN_EVENT, onReferenceHandoff)
    window.addEventListener(COMPOSER_REFERENCE_HOST_INSERT_RESULT_EVENT, onReferenceInsertResult)
    window.addEventListener(COMPOSER_REFERENCE_REMOVE_FROM_MAIN_EVENT, onReferenceRemoval)
    window.addEventListener(COMPOSER_REFERENCE_HOST_REMOVE_RESULT_EVENT, onReferenceHostRemovalResult)
    window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_HOST_PROBE_EVENT, {
      detail: { version: COMPOSER_REFERENCE_PROTOCOL_VERSION, report: reportHostAvailability },
    }))
    disposers.push(() => window.removeEventListener(COMPOSER_REFERENCE_ADD_TO_MAIN_EVENT, onReferenceHandoff))
    disposers.push(() => window.removeEventListener(COMPOSER_REFERENCE_HOST_INSERT_RESULT_EVENT, onReferenceInsertResult))
    disposers.push(() => window.removeEventListener(COMPOSER_REFERENCE_REMOVE_FROM_MAIN_EVENT, onReferenceRemoval))
    disposers.push(() => window.removeEventListener(COMPOSER_REFERENCE_HOST_REMOVE_RESULT_EVENT, onReferenceHostRemovalResult))
    disposers.push(() => referenceDrafts.setHostAvailability(false, 'structured conversation insert capability is unavailable'))
    disposers.push(() => { hostInsertSeamAvailable = false; hostActivationAvailable = false; notifyDecorated() })
    const onSelectionReference = (event: Event): void => {
      if (getComposerReferenceDraftControllerV2().snapshot().hostAvailable) return
      const detail = (event as CustomEvent<{ readonly anchor?: { readonly artifactRef?: string; readonly artifactVersion?: string; readonly quotePreview?: string; readonly quoteDigest?: string } }>).detail
      const anchor = detail?.anchor
      if (anchor?.artifactRef === undefined || anchor.artifactVersion === undefined || anchor.quoteDigest === undefined) return
      getComposerReferenceController().dispatch({ type: 'replace_active', reference: {
        id: referenceId('selection', anchor.artifactRef, anchor.artifactVersion), kind: 'selection-anchor', owner: 'dsh.selection', ref: anchor.artifactRef, version: anchor.artifactVersion,
        label: '选区引用', scope: 'selection', digest: anchor.quoteDigest, freshness: 'fresh', quote: (anchor.quotePreview ?? '').slice(0, 500), anchor,
      } })
    }
    window.addEventListener('dsh-selection-annotation:submit', onSelectionReference)
    disposers.push(() => window.removeEventListener('dsh-selection-annotation:submit', onSelectionReference))
    const emitImageRegionResult = (requestId: string, ok: boolean, reason?: string): void => {
      window.dispatchEvent(new CustomEvent(FILE_IMAGE_REGION_REFERENCE_RESULT_EVENT, { detail: { version: 1, requestId, ok, ...(reason === undefined ? {} : { reason }) } }))
    }
    const onImageRegionReference = (event: Event): void => {
      const detail = (event as CustomEvent<FileImageRegionReferenceDetailV1>).detail
      if (detail?.version !== 1 || typeof detail.requestId !== 'string' || detail.requestId === ''
        || detail.owner !== 'dsh.local' || typeof detail.ref !== 'string' || detail.ref === ''
        || typeof detail.resourceVersion !== 'string' || detail.resourceVersion === '' || !validImageRegion(detail.region)) return
      void (async () => {
        const bridgeSnapshot = composerReferenceBridge(referenceBridgeContext)?.snapshot()
        const target = bridgeSnapshot?.target
        if (bridgeSnapshot?.available !== true || target === undefined) { emitImageRegionResult(detail.requestId, false, bridgeSnapshot?.reason ?? 'current conversation reference target is unavailable'); return }
        const entry = openFilesById.get(detail.ref)?.entry ?? seededMediaEntries.get(detail.ref)
        if (entry === undefined || fileHost?.inspect === undefined || fileHost.readBinary === undefined) { emitImageRegionResult(detail.requestId, false, 'image owner is unavailable'); return }
        const proof = await fileHost.inspect.inspect(detail.ref)
        const binary = await fileHost.readBinary(entry)
        if (!proof.usable || proof.version !== detail.resourceVersion || binary === undefined || binary.truncated || binary.version !== detail.resourceVersion) {
          emitImageRegionResult(detail.requestId, false, 'image changed; reopen it before referencing')
          return
        }
        const digest = await imageRegionDigest(binary.bytes, detail.region)
        const regionKey = `${detail.region.x}:${detail.region.y}:${detail.region.width}:${detail.region.height}`
        const result = await requestReferenceInsertion(ctx, {
          version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
          requestId: detail.requestId,
          target,
          reference: {
            id: referenceId('image-region', detail.ref, `${detail.resourceVersion}:${regionKey}:${digest}`),
            kind: 'image-region', intent: 'content', owner: 'dsh.local', ref: detail.ref, version: detail.resourceVersion,
            label: detail.label, scope: detail.scope, digest, freshness: 'fresh', region: detail.region,
            preview: `${Math.round(detail.region.width * 100)}% × ${Math.round(detail.region.height * 100)}%`,
          },
        }, ownerSignal())
        emitImageRegionResult(detail.requestId, result.ok, result.reason)
      })().catch(error => emitImageRegionResult(detail.requestId, false, error instanceof Error ? error.message : 'image region reference failed'))
    }
    window.addEventListener(FILE_IMAGE_REGION_REFERENCE_EVENT, onImageRegionReference)
    disposers.push(() => window.removeEventListener(FILE_IMAGE_REGION_REFERENCE_EVENT, onImageRegionReference))
  }
  if (fileHost !== undefined) {
    const filesButton = () => createElement(DesktopSidebarAction, { wide: false, label: '文件', title: '打开工作区文件', icon: 'files', onClick: openFiles })
    disposers.push(slots.inject('sidebar.footer.action', () => slots.register({
      name: 'sidebar.footer.action', id: 'desktop-workbench-sidebar-files', order: 40,
    }, filesButton)))
  }
  const openMediaLibrary = (): void => workbench.openView({
    kind: 'desktop.media', resourceKey: 'desktop:media', role: 'content', preferredRegion: 'right',
    retention: 'snapshot', singleton: true, pinned: true, title: '媒体',
  })
  // dsh-web-render-preview：侧栏常驻「媒体」库入口（无 mediaHost 时面板显示诚实空态）。
  const mediaButton = (): ReactNode => createElement(DesktopSidebarAction, { wide: false, label: '媒体', title: '打开媒体库', icon: 'media', onClick: openMediaLibrary })
  disposers.push(slots.inject('sidebar.footer.action', () => slots.register({
    name: 'sidebar.footer.action', id: 'desktop-workbench-sidebar-media', order: 42,
  }, mediaButton)))
  // 4.5「查看当前版本」：owner inspect 重解析真值 + 打开刷新后的内容视图。
  const viewCurrentReference = fileHost === undefined || fileHost.inspect === undefined
    ? undefined
    : async (reference: import('@yeisme/dsh-client-ui-pane-workbench/client').ComposerReferenceV1): Promise<import('@yeisme/dsh-client-ui-pane-workbench/client').ComposerReferenceV1 | undefined> => {
      try {
        const proof = await fileHost.inspect!.inspect(reference.ref)
        if (!proof.usable || (proof.state !== 'ready' && proof.state !== 'partial')) return undefined
        workbench.openView({ kind: 'desktop.file', resourceKey: proof.ref, role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, preview: true, title: proof.resource?.name ?? reference.label })
        return {
          id: referenceId('file', proof.ref, proof.version),
          kind: reference.kind,
          owner: proof.owner,
          ref: proof.ref,
          version: proof.version,
          label: proof.resource?.name ?? reference.label,
          scope: reference.scope,
          digest: proof.inspectedWindow?.digest ?? referenceId('digest', proof.ref, proof.version),
          freshness: 'fresh',
          ...(proof.inspectedWindow === undefined ? {} : { window: { start: proof.inspectedWindow.start, end: proof.inspectedWindow.end } }),
        }
      } catch {
        return undefined
      }
    }
  const referenceDraftController = getComposerReferenceDraftControllerV2()
  const composerDock = (): ReactNode => {
    const referenceSnapshot = useSyncExternalStore(
      listener => referenceDraftController.subscribe(listener),
      () => referenceDraftController.snapshot(),
      () => referenceDraftController.snapshot(),
    )
    if (referenceSnapshot.hostAvailable) return createElement(ComposerReferenceDraftDockV2, { controller: referenceDraftController })
    return createElement(ComposerReferenceDock, {
      controller: getComposerReferenceController(),
      onCopy: reference => {
        const text = reference.quote === undefined ? `@${reference.label}` : `@${reference.label}: ${reference.quote}`
        if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') void navigator.clipboard.writeText(text)
      },
      ...(viewCurrentReference === undefined ? {} : { onViewCurrent: viewCurrentReference }),
    })
  }
  if (unified?.version !== 'workspace.unified.v1') {
    disposers.push(slots.inject('conversation.input.dock', () => slots.register({
      name: 'conversation.input.dock', id: 'desktop-workbench-composer-references', order: 35,
    }, composerDock)))
  }
  const sessionsButton = () => createElement(DesktopSidebarAction, { wide: false, label: '对话', title: '打开对话管理', icon: 'sessions', onClick: openSessions })
  disposers.push(slots.inject('sidebar.footer.action', () => slots.register({
    name: 'sidebar.footer.action', id: 'desktop-workbench-sidebar-sessions', order: 39,
  }, sessionsButton)))
  if (gitHost !== undefined) {
    const gitButton = () => createElement(DesktopSidebarAction, { wide: false, label: 'Git', title: '打开 Git 状态', icon: 'git', onClick: openGit })
    disposers.push(slots.inject('sidebar.footer.action', () => slots.register({
      name: 'sidebar.footer.action', id: 'desktop-workbench-sidebar-git', order: 41,
    }, gitButton)))
  }
  if (terminalHost !== undefined) disposers.push(slots.inject('conversation.session.header.actions', () => slots.register({
    name: 'conversation.session.header.actions', id: 'desktop-workbench-open-terminal', order: 31,
  }, () => createElement(DesktopSidebarAction, { wide: false, label: '终端', title: '打开终端', icon: 'terminal', onClick: openTerminal }))))

  try {
    disposers.push(applySubagentMonitor(ctx as never))
  } catch {
    // Agents requires sessions + connection. Missing seams keep the workbench usable.
  }

  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}

export const DesktopWorkbenchClientPlugin = {
  inject,
  apply: (ctx: Context): (() => void) => apply(ctx as ClientContext),
}

export default DesktopWorkbenchClientPlugin

/** Desktop Workbench Pane view-provider assembly. */
import { createElement, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  FileOpenPane,
  FilePane,
  GitPane,
  ConversationManager,
  TerminalPane,
  type ConversationManagerSession,
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
import { apply as applyPaneWorkbench, bindExplorerRuntime, ComposerReferenceDock, getComposerReferenceController, type ExplorerRuntimeV2 } from '@yeisme/dsh-client-ui-pane-workbench/client'
import { apply as applySubagentMonitor } from '@yeisme/dsh-client-ui-pane-subagent/client'
import { ComposedDesktopWorkbench } from './composed-workbench.tsx'

export const inject = ['slots', 'workspaces']

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
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

function resolveFileHost(ctx: ClientContext): FileHostV1 | undefined {
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
  const disposers: Array<() => void> = []
  let pane = resolvePaneWorkbench(ctx)
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

  const fileHost = resolveFileHost(ctx)
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
  const resolveSeededUrl = async (media: MediaRefV1): Promise<string | undefined> => {
    const entry = seededMediaEntries.get(media.ref)
    if (entry === undefined || fileHost === undefined) return undefined
    const direct = fileHost.resolvePreviewUrl?.(entry)
    if (direct !== undefined) return direct
    const binary = await fileHost.readBinary?.(entry)
    if (binary === undefined || binary.truncated || binary.bytes.byteLength === 0 || typeof URL.createObjectURL !== 'function') return undefined
    return URL.createObjectURL(new Blob([new Uint8Array(binary.bytes)], { type: binary.mediaType ?? media.mediaType }))
  }
  const openMedia = (entry: FileEntryV1, media: MediaRefV1, preview: boolean): void => {
    seededMedia.set(media.ref, media)
    seededMediaEntries.set(media.ref, entry)
    workbench.openView({
      kind: 'desktop.media',
      resourceKey: media.ref,
      role: 'content',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: true,
      preview,
      pinned: !preview,
      title: entry.name,
    })
  }
  const openFile = (entry: FileEntryV1, preview: boolean): void => {
    if (entry.kind === 'directory') return
    const media = fileEntryToMediaRef(entry)
    if (media !== undefined) {
      openMedia(entry, media, preview)
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
      const entry: FileEntryV1 = {
        id: node.ref,
        ...(node.parentRef === undefined ? {} : { parentId: node.parentRef }),
        name: node.name,
        kind: node.kind === 'symlink' ? 'file' : node.kind,
        capabilities: node.capabilities.filter((capability): capability is 'preview' | 'open' | 'download' | 'edit' => capability === 'preview' || capability === 'open' || capability === 'download' || capability === 'edit'),
      }
      const proof = await fileHost.inspect.inspect(node.ref)
      if (!proof.usable || (proof.state !== 'ready' && proof.state !== 'partial')) return { ok: false, reason: proof.reason ?? 'owner preview proof is not usable' }
      getComposerReferenceController().dispatch({ type: 'mark_stale', ref: proof.ref, version: proof.version })
      getComposerReferenceController().dispatch({ type: 'replace_active', reference: {
        id: referenceId('file', proof.ref, proof.version), kind: 'file-preview', owner: proof.owner, ref: proof.ref, version: proof.version,
        label: proof.resource?.name ?? node.name, scope: 'workspace', digest: proof.inspectedWindow?.digest ?? referenceId('digest', proof.ref, proof.version), freshness: 'fresh',
        ...(proof.inspectedWindow === undefined ? {} : { window: { start: proof.inspectedWindow.start, end: proof.inspectedWindow.end } }),
      } })
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
              const receipt = await fileHost.mutations!.execute(preflight.proposalRef, { ...intent, previewDigest: preflight.previewDigest })
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
          while (offset < file.size) { const bytes = new Uint8Array(await file.slice(offset, offset + upload.chunkSize).arrayBuffer()); await fileHost.transfer!.uploadChunk(upload.sessionRef, offset, bytes); offset += bytes.byteLength }
          const committed = await fileHost.transfer!.commitUpload(upload.sessionRef)
          return { importRef: committed.importRef, name: file.name, size: committed.size }
        },
        download: async (ref, version) => { const ticket = await fileHost.transfer!.issueDownloadTicket(ref, version, 'attachment'); if (fileHost.transfer!.download === undefined) throw new Error('download stream is unavailable'); return fileHost.transfer!.download(ticket.ticket) },
      } }),
    }
    disposers.push(bindExplorerRuntime(runtime))
    try {
      const sessions = ctx.get('sessions' as never) as SessionListFace | undefined
      let ownerSession = currentSessionId(ctx)
      const unsubscribe = sessions?.list?.subscribe?.(() => {
        const nextSession = currentSessionId(ctx)
        if (nextSession === ownerSession) return
        ownerSession = nextSession
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
      descriptor: { kind: 'desktop.files', label: '文件（兼容别名）', componentKey: 'desktop-files-alias', role: 'navigator', preferredRegion: 'right', retention: 'recreate', singleton: true, deprecated: true, presentation: { description: '已迁移到 dsh.explorer；保留用于旧布局恢复。' } },
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
    descriptor: { kind: 'desktop.media', label: '媒体', componentKey: 'desktop-media', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { description: '预览图片、音频、视频与 PDF 媒体文件。' } },
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
  if (fileHost !== undefined && hasCorePaneHost) openFiles()
  const slots = ctx.get('slots') as unknown as {
    inject(name: string, setup: () => () => void): () => void
    register(input: unknown, component: (props?: { wide?: boolean }) => ReactNode): () => void
  }
  if (typeof window !== 'undefined') {
    const onSelectionReference = (event: Event): void => {
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
  }
  if (fileHost !== undefined) {
    const filesButton = () => createElement(DesktopSidebarAction, { wide: false, label: '文件', title: '打开工作区文件', icon: 'files', onClick: openFiles })
    disposers.push(slots.inject('sidebar.footer.action', () => slots.register({
      name: 'sidebar.footer.action', id: 'desktop-workbench-sidebar-files', order: 40,
    }, filesButton)))
  }
  disposers.push(slots.inject('conversation.input.dock', () => slots.register({
    name: 'conversation.input.dock', id: 'desktop-workbench-composer-references', order: 35,
  }, () => createElement(ComposerReferenceDock, {
    controller: getComposerReferenceController(),
    onCopy: reference => {
      const text = reference.quote === undefined ? `@${reference.label}` : `@${reference.label}: ${reference.quote}`
      if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') void navigator.clipboard.writeText(text)
    },
  }))))
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

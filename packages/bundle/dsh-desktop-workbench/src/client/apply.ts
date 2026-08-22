/** Desktop Workbench Pane view-provider assembly. */
import { createElement, useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  FileOpenPane,
  FilePane,
  GitPane,
  TerminalPane,
} from '@yeisme/dsh-client-ui-desktop-workbench/client'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import { MEDIA_HOST_CONTEXT_KEY, isMediaHostV1, MediaPreviewPane, type MediaHostV1, type MediaRefV1 } from '@yeisme/dsh-rich-media/client'
import { createExplorerFileHost, createExplorerGitHost, createFileHostFromWorkspaces, FILE_HOST_CONTEXT_KEY, isFileHostV1, type FileHostV1 } from '@yeisme/dsh-file-host'
import { isTerminalHostV2, TERMINAL_HOST_CONTEXT_KEY, type TerminalHostV2 } from '@yeisme/dsh-terminal-host'
import { apply as applyPaneWorkbench } from '@yeisme/dsh-client-ui-pane-workbench/client'
import { apply as applySubagentMonitor } from '@yeisme/dsh-client-ui-pane-subagent/client'
import { ComposedDesktopWorkbench } from './composed-workbench.tsx'

export const inject = ['slots', 'workspaces']

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
}

const launcherStyle: CSSProperties = {
  position: 'absolute', right: 18, bottom: 18, zIndex: 40, display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 15px',
  color: 'var(--dsw-alias-label-primary, #f2f2f4)', background: 'var(--dsw-alias-button-elevated-fill, #343438)',
  border: '1px solid var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.16))', borderRadius: 11,
  boxShadow: '0 14px 36px rgba(0, 0, 0, 0.3)', cursor: 'pointer',
  font: '600 13px var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
}

/** @deprecated One-RC story component only; production apply never registers it. */
export function DesktopWorkbenchOverlay(): ReactNode {
  const [open, setOpen] = useState(true)
  if (open) return createElement(ComposedDesktopWorkbench, { onClose: () => { setOpen(false) } })
  return createElement('button', {
    type: 'button', 'aria-label': '打开桌面工作台', 'data-dsh-desktop-workbench-launcher': true,
    style: launcherStyle, onClick: () => { setOpen(true) },
  }, createElement('span', { 'aria-hidden': true }, '▦'), '打开工作台')
}

function MediaPane({ host }: { readonly host: MediaHostV1 }): ReactNode {
  const [media, setMedia] = useState<readonly MediaRefV1[]>([])
  const [error, setError] = useState<string>()
  useEffect(() => {
    let live = true
    setError(undefined)
    void host.listMedia().then(next => {
      if (live) setMedia(next)
    }).catch(caught => {
      if (live) setError(caught instanceof Error ? caught.message : '媒体资源加载失败')
    })
    return () => { live = false }
  }, [host])
  const resolveUrl = useCallback(async (item: MediaRefV1): Promise<string> => {
    const resolved = await host.resolveUrl(item)
    if (resolved === undefined) throw new Error('资源授权失败或已过期')
    return resolved.url
  }, [host])
  return createElement('section', { style: { minHeight: '100%' }, 'data-dsh-media-host-pane': true },
    createElement(MediaPreviewPane, { title: '媒体库', media, resolveUrl }),
    error === undefined ? null : createElement('p', { role: 'alert', style: { margin: '8px 12px', color: 'var(--dsw-alias-state-error-secondary, #f25a5a)' } }, error),
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
  readonly list?: { getSnapshot(): { readonly current?: string } }
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

function resolveMediaHost(ctx: ClientContext): MediaHostV1 | undefined {
  try {
    const candidate = ctx.get(MEDIA_HOST_CONTEXT_KEY as never)
    if (isMediaHostV1(candidate)) return candidate
  } catch {
    // Optional context service.
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
    } catch (error) {
      throw new Error(`dsh-desktop-workbench could not mount Pane Workbench V2: ${error instanceof Error ? error.message : String(error)}`)
    }
    pane = resolvePaneWorkbench(ctx)
  }
  if (pane === undefined) throw new Error('dsh-desktop-workbench could not mount Pane Workbench V2; install @yeisme/dsh-pane-workbench or a layout with shell.workspace.right')
  const workbench = pane

  const fileHost = resolveFileHost(ctx)
  const gitHost = createExplorerGitHost({
    sessionId: () => currentSessionId(ctx),
    cwd: () => currentWorkspacePath(ctx),
  })
  const terminalHost = resolveTerminalHost(ctx)
  const mediaHost = resolveMediaHost(ctx)
  const openFilesById = new Map<string, FileEntryV1>()
  const views: Array<{ descriptor: Record<string, unknown>; component: (props?: { view?: { resourceKey?: string } }) => ReactNode }> = []
  const openFile = (entry: FileEntryV1, preview: boolean): void => {
    if (entry.kind === 'directory') return
    openFilesById.set(entry.id, entry)
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
  if (fileHost !== undefined) views.push(
    {
      descriptor: { kind: 'desktop.files', label: '文件', componentKey: 'desktop-files', role: 'navigator', preferredRegion: 'right', retention: 'recreate', singleton: true },
      component: () => createElement(FilePane, {
        host: fileHost,
        tabId: 'files',
        showPreviewPanel: false,
        compact: true,
        onOpenEntry: entry => openFile(entry, true),
        onPinEntry: entry => openFile(entry, false),
      }),
    },
    {
      descriptor: { kind: 'desktop.file', label: '文件内容', componentKey: 'desktop-file', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false },
      component: props => {
        const resourceKey = props?.view?.resourceKey
        const entry = resourceKey === undefined ? undefined : openFilesById.get(resourceKey)
        if (entry === undefined) return createElement('p', { role: 'status' }, '文件不可用。')
        return createElement(FileOpenPane, { host: fileHost, entry })
      },
    },
    {
      descriptor: { kind: 'desktop.documents', label: '文档', componentKey: 'desktop-documents', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true },
      component: () => createElement(FilePane, { host: fileHost, tabId: 'documents', showPreviewPanel: false, compact: true, onOpenEntry: entry => openFile(entry, true) }),
    },
  )
  if (gitHost !== undefined) views.push({
    descriptor: { kind: 'desktop.git', label: 'Git', componentKey: 'desktop-git', role: 'utility', preferredRegion: 'right', retention: 'recreate', singleton: true },
    component: () => createElement(GitPane, { host: gitHost }),
  })
  if (terminalHost !== undefined) views.push(
    {
      descriptor: { kind: 'desktop.terminal', label: '终端', componentKey: 'desktop-terminal', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: true },
      component: () => createElement(TerminalPane, { host: terminalHost }),
    },
  )
  if (mediaHost !== undefined) views.push(
    {
      descriptor: { kind: 'desktop.media', label: '媒体', componentKey: 'desktop-media', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true },
      component: () => createElement(MediaPane, { host: mediaHost }),
    },
  )
  for (const view of views) disposers.push(workbench.registerView(view))

  const openFiles = (): void => workbench.openView({
    kind: 'desktop.files', resourceKey: 'desktop:files', role: 'navigator', preferredRegion: 'right',
    retention: 'recreate', singleton: true, pinned: true, title: '文件',
  })
  const openGit = (): void => workbench.openView({
    kind: 'desktop.git', resourceKey: 'desktop:git', role: 'utility', preferredRegion: 'right',
    retention: 'recreate', singleton: true, pinned: true, title: 'Git',
  })
  const openTerminal = (): void => workbench.openView({
    kind: 'desktop.terminal', resourceKey: 'desktop:terminal', role: 'utility', preferredRegion: 'bottom',
    retention: 'keep-alive', singleton: true, pinned: true, title: '终端',
  })
  if (fileHost !== undefined) openFiles()
  const slots = ctx.get('slots') as unknown as {
    inject(name: string, setup: () => () => void): () => void
    register(input: unknown, component: () => ReactNode): () => void
  }
  if (fileHost !== undefined) {
    const filesButton = () => createElement('button', { type: 'button', onClick: openFiles, title: '打开工作区文件' }, '文件')
    disposers.push(slots.inject('conversation.session.header.actions', () => slots.register({
      name: 'conversation.session.header.actions', id: 'desktop-workbench-open-files', order: 30,
    }, filesButton)))
    disposers.push(slots.inject('sidebar.footer.action', () => slots.register({
      name: 'sidebar.footer.action', id: 'desktop-workbench-sidebar-files', order: 40,
    }, filesButton)))
  }
  if (gitHost !== undefined) {
    const gitButton = () => createElement('button', { type: 'button', onClick: openGit, title: '打开 Git 状态' }, 'Git')
    disposers.push(slots.inject('conversation.session.header.actions', () => slots.register({
      name: 'conversation.session.header.actions', id: 'desktop-workbench-open-git', order: 29,
    }, gitButton)))
    disposers.push(slots.inject('sidebar.footer.action', () => slots.register({
      name: 'sidebar.footer.action', id: 'desktop-workbench-sidebar-git', order: 41,
    }, gitButton)))
  }
  if (terminalHost !== undefined) disposers.push(slots.inject('conversation.session.header.actions', () => slots.register({
    name: 'conversation.session.header.actions', id: 'desktop-workbench-open-terminal', order: 31,
  }, () => createElement('button', { type: 'button', onClick: openTerminal, title: '打开终端' }, '>_'))))

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

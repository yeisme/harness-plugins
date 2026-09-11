/**
 * Per-file preview dispatch surface (dsh-file-preview-dispatch-v1). One pane
 * per opened resource: the owner grants one bounded binary read
 * (`FileHostV1.readBinary` → bytes + short-lived object URL), the entry is
 * adapted into a `PreviewResourceV1`, and rendering is delegated to the
 * local preview registry (preference → exact MIME → suffix → family →
 * binary fallback). No renderer is ever selected by file name, and no URL is
 * inferred from a ref. Text/markdown and images keep the `desktop.file`
 * editor path; this pane owns audio/video/pdf/table/document/archive/binary.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

import { createElement, useEffect, useMemo, useState, type ReactElement } from 'react'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { FileHostV1 } from '@yeisme/dsh-file-host'
import {
  FILE_PREVIEW_DESCRIPTORS,
  PreviewRendererRegistry,
  classifyFileEntry,
  createPreviewAccessHandle,
  fileEntryToPreviewResource,
  type PreviewAccessHandleV1,
  type PreviewRendererComponentType,
  type PreviewRendererProps,
  type PreviewResourceV1,
} from '@yeisme/dsh-rich-media/client'

export interface FilePreviewDispatchPaneProps {
  readonly host: FileHostV1
  readonly entry: FileEntryV1
}

const dispatchStyles = `
[data-pane-view-generation]:has(>[data-dsh-file-preview-dispatch]){display:flex;flex-direction:column;height:100%;min-height:0}
[data-dsh-file-preview-dispatch].dwo-file-preview{flex:1 1 0;height:100%;min-height:0}
.dwo-file-preview .dwo-file-preview-body{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;overflow:auto;padding:14px 16px}
.dwo-file-preview .dwo-file-preview-body>[data-dsh-archive-list-scroll]{max-height:100%;overflow:auto;border:1px solid var(--vk-border-l1);border-radius:8px}
.dwo-file-preview .dwo-file-preview-body [data-dsh-archive-entry-table],.dwo-file-preview .dwo-file-preview-body [data-dsh-binary-hex-table]{width:100%;border-collapse:separate;border-spacing:0;font:var(--dsh-wb-font-size,14px)/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
.dwo-file-preview .dwo-file-preview-body [data-dsh-archive-entry-table] th,.dwo-file-preview .dwo-file-preview-body [data-dsh-archive-entry-table] td,.dwo-file-preview .dwo-file-preview-body [data-dsh-binary-hex-table] th,.dwo-file-preview .dwo-file-preview-body [data-dsh-binary-hex-table] td{padding:4px 10px;border-bottom:1px solid var(--vk-border-l1);text-align:left;white-space:pre}
.dwo-file-preview .dwo-file-preview-body [data-dsh-archive-entry-table] thead th,.dwo-file-preview .dwo-file-preview-body [data-dsh-binary-hex-table] th[scope=row]{position:sticky;top:0;color:var(--vk-text-tertiary);background:var(--vk-bg-layer-1);font-weight:600}
.dwo-file-preview .dwo-file-preview-body [data-dsh-binary-hex-table] th[scope=row]{width:96px}
.dwo-file-preview .dwo-file-preview-body tr[data-dsh-archive-entry-directory=true] td:first-child{color:var(--vk-text-secondary)}
.dwo-file-preview .dwo-file-preview-status{min-height:26px;padding:5px 12px;border-top:1px solid var(--vk-border-l1);color:var(--vk-text-tertiary);background:var(--vk-bg-layer-1);font-size:calc(var(--dsh-wb-font-size,14px) - 2px);font-variant-numeric:tabular-nums}
`

type DispatchState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'unsupported'; readonly message: string }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'ready'; readonly resource: PreviewResourceV1; readonly access: PreviewAccessHandleV1; readonly renderer: PreviewRendererComponentType }

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Resolve one preview resource for the entry. The owner-declared media type
 * wins; the shared extension table only fills the gap when the owner stayed
 * silent, and a generic `file` kind takes the classification's family signal
 * (e.g. `text/csv` reaches the table family, not plain text). Same owner-hint
 * precedence as the desktop media mapping.
 */
export function previewResourceOfEntry(entry: FileEntryV1, size: number | undefined, version: string | undefined): PreviewResourceV1 {
  const classified = classifyFileEntry(entry.name, entry.mediaType)
  const mediaType = entry.mediaType ?? classified?.mediaType ?? 'application/octet-stream'
  const kind = classified?.kind ?? entry.kind
  const resource = fileEntryToPreviewResource(
    { ...entry, ...(kind === entry.kind ? {} : { kind }), ...(mediaType === entry.mediaType ? {} : { mediaType }) },
    'dsh',
    version ?? 'v1',
  )
  return size === undefined ? resource : { ...resource, size }
}

export function FilePreviewDispatchPane({ host, entry }: FilePreviewDispatchPaneProps): ReactElement {
  const registry = useMemo(() => new PreviewRendererRegistry(), [])
  useEffect(() => {
    const disposers = FILE_PREVIEW_DESCRIPTORS.map(descriptor => registry.register(descriptor))
    return () => { for (const dispose of disposers.reverse()) dispose() }
  }, [registry])
  const [state, setState] = useState<DispatchState>({ phase: 'loading' })

  useEffect(() => {
    let live = true
    setState({ phase: 'loading' })
    if (host.readBinary === undefined) {
      setState({ phase: 'unsupported', message: '文件服务尚未提供二进制预览能力。' })
      return () => { live = false }
    }
    void host.readBinary(entry).then(read => {
      if (!live) return
      if (read === undefined) {
        setState({ phase: 'unsupported', message: '文件 owner 未授权该资源预览。' })
        return
      }
      if (read.truncated) {
        setState({ phase: 'unsupported', message: `文件大小为 ${formatBytes(read.size)}，超过预览安全上限，请下载后查看。` })
        return
      }
      const resource = previewResourceOfEntry(entry, read.size, read.version)
      const directUrl = host.resolvePreviewUrl?.(entry)
      const objectUrl = directUrl === undefined && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(new Blob([new Uint8Array(read.bytes)], { type: read.mediaType ?? resource.mediaType }))
        : undefined
      const url = directUrl ?? objectUrl
      if (url === undefined) {
        setState({ phase: 'unsupported', message: '此资源需要短时预览授权，当前环境不可用。' })
        return
      }
      const access = createPreviewAccessHandle({ resource, bytes: read.bytes, ...(directUrl === undefined ? { objectUrl } : { url: directUrl }) })
      void registry.loadBest({ mediaType: resource.mediaType, family: resource.family }).then(descriptor => {
        if (!live) {
          access.release('abort')
          return
        }
        if (descriptor === undefined) {
          access.release('close')
          setState({ phase: 'unsupported', message: `没有兼容 ${resource.mediaType} 的本地预览渲染器。` })
          return
        }
        void descriptor.load().then(component => {
          if (!live) {
            access.release('abort')
            return
          }
          setState({ phase: 'ready', resource, access, renderer: component })
        }).catch(() => {
          if (!live) return
          access.release('close')
          setState({ phase: 'unsupported', message: '预览渲染器加载失败。' })
        })
      }).catch(() => {
        if (!live) return
        access.release('close')
        setState({ phase: 'error', message: '预览渲染器解析失败。' })
      })
    }, caught => {
      if (!live) return
      setState({ phase: 'error', message: caught instanceof Error ? caught.message : String(caught) })
    })
    return () => {
      live = false
    }
  }, [host, entry, registry])

  // Release the handle (and its object URL) exactly once when leaving ready.
  useEffect(() => {
    if (state.phase !== 'ready') return
    const access = state.access
    return () => { access.release('close') }
  }, [state])

  const ready = state.phase === 'ready' ? state : undefined
  const status = state.phase === 'loading' ? '正在打开文件…'
    : state.phase === 'ready' ? `${ready!.resource.family} · ${ready!.resource.mediaType}${ready!.resource.size === undefined ? '' : ` · ${formatBytes(ready!.resource.size)}`}`
      : state.phase === 'unsupported' ? '暂不支持预览'
        : '预览失败'
  return (
    <Surface kind="workspace" className="dwo-file-preview" data-dsh-file-preview-dispatch data-file-id={entry.id} data-preview-family={ready?.resource.family}>
      <style data-dsh-file-preview-styles>{dispatchStyles}</style>
      <SurfaceContextBar title={entry.name} context={ready?.resource.mediaType ?? entry.mediaType ?? entry.kind} />
      <div className="dwo-file-preview-body">
        {state.phase === 'loading' && <SurfaceState phase="loading" title="正在打开文件…" />}
        {state.phase === 'unsupported' && <SurfaceState phase="disabled" title={state.message} data-dsh-preview-unsupported />}
        {state.phase === 'error' && <SurfaceState phase="error" title={state.message} />}
        {ready && createElement(ready.renderer as (props: PreviewRendererProps) => ReactElement, { resource: ready.resource, access: ready.access })}
      </div>
      <div className="dwo-file-preview-status" role="status" data-dsh-file-preview-status>{status}</div>
    </Surface>
  )
}

export default FilePreviewDispatchPane

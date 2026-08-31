/** Opened file tab with rendered Markdown editing and an explicit source mode. */
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Button, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { SemanticFileEditor, createRemoteLanguageIntelligenceHost } from '@yeisme/dsh-client-ui-semantic-file-editor'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import { FILE_OPAQUE_REF_CAPABILITY, type FileBinaryReadV1, type FileHostV1 } from '@yeisme/dsh-file-host'
import { isMarkdownEntry } from './file-markdown.ts'
import { DocxPreview, isDocxFile } from './docx-preview.tsx'

export interface FileOpenPaneProps {
  readonly host: FileHostV1
  readonly entry: FileEntryV1
  /** Session owner used only with host-issued opaque refs. */
  readonly semanticSessionId?: string
}

const fileOpenStyles = `
[data-pane-view-generation]:has(>[data-dsh-file-open-pane]){display:flex;flex-direction:column;height:100%;min-height:0}
[data-dsh-file-open-pane].dwo-file-open{flex:1 1 0;height:100%;min-height:0}
.dwo-file-open .dwo-file-body{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;overflow:hidden}
.dwo-file-open .dwo-file-mode-switch{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--vk-border-l1);border-radius:8px;background:var(--vk-bg-layer-2)}
.dwo-file-open .dwo-file-mode-switch button{min-height:28px;padding-inline:10px;border-radius:6px}
.dwo-file-open .dwo-file-mode-switch button[data-active='true']{color:var(--vk-text-primary);background:var(--vk-bg-elevated);box-shadow:inset 0 0 0 1px var(--vk-border-l2)}
.dwo-file-open .dwo-file-source{box-sizing:border-box;flex:1 1 auto;min-width:0;min-height:0;overflow:auto;margin:12px;padding:18px 20px;border:1px solid var(--vk-border-l1);border-radius:9px;white-space:pre;tab-size:2;color:var(--vk-text-secondary);background:var(--vk-bg-layer-1);font:var(--dsh-wb-font-size,14px)/1.68 ui-monospace,SFMono-Regular,Menlo,monospace}
.dwo-file-open .dwo-file-editor-field{display:flex;flex:1 1 auto;flex-direction:column;min-width:0;min-height:0;padding:12px}.dwo-file-open .dwo-file-editor{box-sizing:border-box;width:100%;height:100%;min-height:240px;resize:none;border:1px solid var(--vk-border-l1);border-radius:9px;outline:0;padding:18px 20px;color:var(--vk-text-primary);background:var(--vk-bg-layer-1);caret-color:var(--vk-accent);font:var(--dsh-wb-font-size,14px)/1.68 ui-monospace,SFMono-Regular,Menlo,monospace;tab-size:2;white-space:pre;overflow:auto}.dwo-file-open .dwo-file-editor:focus-visible{border-color:color-mix(in srgb,var(--vk-accent) 65%,var(--vk-border-l1));box-shadow:0 0 0 2px color-mix(in srgb,var(--vk-accent) 18%,transparent)}
.dwo-file-open .dwo-file-markdown{flex:1 1 auto;min-height:0;overflow:auto;padding:18px 24px 30px;line-height:1.65}
.dwo-file-open .dwo-markdown-editor{flex:1 1 auto;min-height:0;overflow:auto;padding:14px 18px 36px;line-height:1.65}
.dwo-file-open .dwo-markdown-block{box-sizing:border-box;max-width:920px;margin:0 auto;padding:5px 9px;border:1px solid transparent;border-radius:9px;cursor:text;transition:background-color .14s ease-out,border-color .14s ease-out}
.dwo-file-open .dwo-markdown-block:hover,.dwo-file-open .dwo-markdown-block:focus-visible{outline:0;border-color:var(--vk-border-l1);background:color-mix(in srgb,var(--vk-bg-layer-1) 64%,transparent)}
.dwo-file-open .dwo-markdown-block[data-active='true']{margin-block:5px;padding:10px;border-color:color-mix(in srgb,var(--vk-accent) 48%,var(--vk-border-l1));background:var(--vk-bg-layer-1);box-shadow:0 0 0 2px color-mix(in srgb,var(--vk-accent) 8%,transparent)}
.dwo-file-open .dwo-markdown-block [data-dsh-file-markdown]{max-width:none;margin:0}
.dwo-file-open .dwo-markdown-block-source{display:grid;gap:8px}.dwo-file-open .dwo-markdown-block-source>span,.dwo-file-open .dwo-markdown-live-label{color:var(--vk-text-tertiary);font-size:11px;font-weight:650}
.dwo-file-open .dwo-markdown-block-editor{box-sizing:border-box;width:100%;min-height:70px;resize:vertical;border:1px solid var(--vk-border-l2);border-radius:7px;outline:0;padding:10px 11px;color:var(--vk-text-primary);background:var(--vk-bg-base);caret-color:var(--vk-accent);font:var(--dsh-wb-font-size,14px)/1.62 ui-monospace,SFMono-Regular,Menlo,monospace;tab-size:2}.dwo-file-open .dwo-markdown-block-editor:focus-visible{border-color:var(--vk-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--vk-accent) 16%,transparent)}
.dwo-file-open .dwo-markdown-live{display:grid;gap:6px;padding-top:9px;border-top:1px solid var(--vk-border-l1)}
.dwo-file-open .dwo-markdown-live-preview{min-height:34px;padding:2px 4px;color:var(--vk-text-secondary)}
.dwo-file-open .dwo-markdown-empty{display:grid;place-items:center;min-height:120px;color:var(--vk-text-tertiary)}
.dwo-file-open .dwo-file-media{display:block;box-sizing:border-box;max-width:calc(100% - 32px);margin:16px}.dwo-file-open img.dwo-file-media{max-height:100%;object-fit:contain}.dwo-file-open audio.dwo-file-media{width:calc(100% - 32px);max-width:560px}.dwo-file-open video.dwo-file-media{width:calc(100% - 32px);max-height:min(68vh,720px);background:var(--vk-bg-base)}.dwo-file-open iframe.dwo-file-media{width:calc(100% - 32px);height:min(68vh,720px);border:0;background:var(--vk-bg-layer-1)}
.dwo-file-open .dwo-file-status{min-height:26px;padding:5px 12px;border-top:1px solid var(--vk-border-l1);color:var(--vk-text-tertiary);background:var(--vk-bg-layer-1);font-size:calc(var(--dsh-wb-font-size,14px) - 2px);font-variant-numeric:tabular-nums}
@container yeisme-surface (min-width:720px){.dwo-file-open .dwo-markdown-block[data-active='true']{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.dwo-file-open .dwo-markdown-live{padding-top:0;padding-left:12px;border-top:0;border-left:1px solid var(--vk-border-l1)}}
@container yeisme-surface (max-width:420px){.dwo-file-open .dwo-file-markdown{padding:12px}.dwo-file-open .dwo-markdown-editor{padding:8px 7px 28px}.dwo-file-open .dwo-markdown-block{padding:4px 6px}.dwo-file-open .dwo-markdown-block[data-active='true']{padding:8px}.dwo-file-open .dwo-file-source,.dwo-file-open .dwo-file-editor-field{margin:0;padding:9px}.dwo-file-open .dwo-file-editor{padding:13px}.dwo-file-open .dwo-file-media{margin:10px;max-width:calc(100% - 20px)}}
`

const markdownStyles = `
[data-dsh-file-markdown]{max-width:920px;margin:0 auto}
[data-dsh-file-markdown] h1,[data-dsh-file-markdown] h2,[data-dsh-file-markdown] h3{margin:1.15em 0 .45em;line-height:1.22;font-weight:680;border-bottom:1px solid var(--vk-border-l1);padding-bottom:.28em}
[data-dsh-file-markdown] h1{font-size:1.55em}[data-dsh-file-markdown] h2{font-size:1.3em}[data-dsh-file-markdown] h3{font-size:1.12em}
[data-dsh-file-markdown] p,[data-dsh-file-markdown] ul,[data-dsh-file-markdown] ol,[data-dsh-file-markdown] blockquote{margin:0 0 .9em}
[data-dsh-file-markdown] ul,[data-dsh-file-markdown] ol{padding-left:1.5em}
[data-dsh-file-markdown] code{padding:.1em .35em;border-radius:5px;background:var(--vk-bg-layer-1);color:var(--vk-state-warn);font:0.92em/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
[data-dsh-file-markdown] pre{overflow:auto;padding:13px;border:1px solid var(--vk-border-l1);border-radius:7px;background:var(--vk-bg-layer-1)}
[data-dsh-file-markdown] pre code{padding:0;background:transparent;color:inherit}
[data-dsh-file-markdown] a{color:var(--vk-accent)}
[data-dsh-file-markdown] blockquote{padding-left:12px;border-left:3px solid var(--vk-accent);color:var(--vk-text-secondary)}
[data-dsh-file-markdown] hr{border:0;border-top:1px solid var(--vk-border-l2);margin:1.2em 0}
[data-dsh-file-markdown] div:has(>table){max-width:100%;max-height:420px;overflow:auto;overscroll-behavior:contain;border:1px solid var(--vk-border-l2);border-radius:8px}
[data-dsh-file-markdown] table{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}
[data-dsh-file-markdown] th,[data-dsh-file-markdown] td{min-width:96px;padding:7px 10px;border-right:1px solid var(--vk-border-l1);border-bottom:1px solid var(--vk-border-l1);text-align:left;vertical-align:top}
[data-dsh-file-markdown] th{position:sticky;top:0;z-index:2;background:var(--vk-bg-layer-1);font-size:.92em;font-weight:680}
[data-dsh-file-markdown] tbody tr:nth-child(even) td{background:color-mix(in srgb,var(--vk-bg-layer-1) 45%,transparent)}
@container yeisme-surface (max-width:719px){[data-dsh-file-markdown] th:first-child,[data-dsh-file-markdown] td:first-child{position:sticky;left:0;z-index:1;background:var(--vk-bg-base);box-shadow:1px 0 var(--vk-border-l2)}[data-dsh-file-markdown] th:first-child{z-index:3;background:var(--vk-bg-layer-1)}}
`

type FileViewMode = 'preview' | 'edit' | 'source'

interface MarkdownEditBlock {
  readonly source: string
  readonly separator: string
}

function fenceMarker(line: string): string | undefined {
  return /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1]
}

function splitMarkdownBlocks(source: string): MarkdownEditBlock[] {
  if (source.length === 0) return [{ source: '', separator: '' }]
  const lines = source.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter(line => line.length > 0) ?? [source]
  const blocks: MarkdownEditBlock[] = []
  let body = ''
  let separator = ''
  let fence: { readonly character: string; readonly length: number } | undefined

  const flush = (): void => {
    if (body.length === 0 && separator.length === 0) return
    blocks.push({ source: body, separator })
    body = ''
    separator = ''
  }

  for (const chunk of lines) {
    const line = chunk.replace(/(?:\r\n|\n|\r)$/u, '')
    const marker = fenceMarker(line)
    if (fence !== undefined) {
      body += chunk
      if (marker !== undefined && marker[0] === fence.character && marker.length >= fence.length && line.trim().slice(marker.length).trim().length === 0) fence = undefined
      continue
    }
    if (marker !== undefined) {
      if (separator.length > 0) flush()
      body += chunk
      fence = { character: marker[0]!, length: marker.length }
      continue
    }
    if (line.trim().length === 0 && body.length > 0) {
      if (separator.length === 0) {
        const ending = /(?:\r\n|\n|\r)$/u.exec(body)?.[0]
        if (ending !== undefined) {
          body = body.slice(0, -ending.length)
          separator = ending
        }
      }
      separator += chunk
      continue
    }
    if (separator.length > 0) flush()
    body += chunk
  }
  flush()
  return blocks.length > 0 ? blocks : [{ source, separator: '' }]
}

function joinMarkdownBlocks(blocks: readonly MarkdownEditBlock[]): string {
  return blocks.map(block => `${block.source}${block.separator}`).join('')
}

function editorRows(source: string): number {
  return Math.max(2, Math.min(18, source.split(/\r\n|\n|\r/u).length + 1))
}

function mediaKindOf(entry: FileEntryV1): 'image' | 'audio' | 'video' | 'pdf' | undefined {
  if (entry.kind === 'image') return 'image'
  if (entry.kind === 'pdf' || entry.mediaType === 'application/pdf') return 'pdf'
  if (entry.mediaType?.startsWith('audio/')) return 'audio'
  if (entry.mediaType?.startsWith('video/')) return 'video'
  if (/\.(?:mp3|wav|ogg|m4a|flac|aac)$/i.test(entry.name)) return 'audio'
  if (/\.(?:mp4|webm|ogv|mov|m4v)$/i.test(entry.name)) return 'video'
  return undefined
}

function LegacyFileOpenPane({ host, entry }: Omit<FileOpenPaneProps, 'semanticSessionId'>) {
  const markdown = isMarkdownEntry(entry)
  const docx = isDocxFile(entry.name, entry.mediaType)
  const mediaKind = mediaKindOf(entry)
  const [text, setText] = useState<string>()
  const [draft, setDraft] = useState('')
  const [version, setVersion] = useState<string>()
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [binary, setBinary] = useState<FileBinaryReadV1>()
  const [binaryUrl, setBinaryUrl] = useState<string>()
  const [viewMode, setViewMode] = useState<FileViewMode>('preview')
  const [markdownBlocks, setMarkdownBlocks] = useState<readonly MarkdownEditBlock[]>([{ source: '', separator: '' }])
  const [activeBlock, setActiveBlock] = useState<number>()
  const previewUrl = host.resolvePreviewUrl?.(entry)
  const canEdit = mediaKind === undefined && host.writeText !== undefined && entry.capabilities.includes('edit') && version !== undefined && !truncated
  const dirty = text !== undefined && draft !== text

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(undefined)
    setNotice(undefined)
    setText(undefined)
    setBinary(undefined)
    setDraft('')
    setVersion(undefined)
    setTruncated(false)
    setViewMode('preview')
    setMarkdownBlocks([{ source: '', separator: '' }])
    setActiveBlock(undefined)
    if (docx || (mediaKind !== undefined && previewUrl === undefined)) {
      if (host.readBinary === undefined) {
        setLoading(false)
        setError('文件服务尚未提供二进制预览能力。')
        return () => { live = false }
      }
      void host.readBinary(entry).then(result => {
        if (!live) return
        setLoading(false)
        if (result === undefined) { setError('文件 owner 未授权该资源预览。'); return }
        if (result.truncated) { setError(`文件大小为 ${(result.size / (1024 * 1024)).toFixed(1)} MB，超过 Pane 的安全预览上限。`); return }
        setBinary(result)
      }, caught => {
        if (!live) return
        setLoading(false)
        setError(caught instanceof Error ? caught.message : String(caught))
      })
      return () => { live = false }
    }
    if (mediaKind !== undefined) {
      setLoading(false)
      return () => { live = false }
    }
    if (host.readText === undefined) {
      setLoading(false)
      setError('文件服务尚未提供读取能力。')
      return () => { live = false }
    }
    void host.readText(entry).then(result => {
      if (!live) return
      setLoading(false)
      if (result === undefined) { setError('无法读取该文件。'); return }
      if (result.binary) { setError('二进制文件不支持文本预览。'); return }
      setText(result.content)
      setDraft(result.content)
      setMarkdownBlocks(splitMarkdownBlocks(result.content))
      setVersion(result.version)
      setTruncated(result.truncated)
    }, caught => {
      if (!live) return
      setLoading(false)
      setError(caught instanceof Error ? caught.message : String(caught))
    })
    return () => { live = false }
  }, [host, entry, previewUrl, mediaKind, docx])

  useEffect(() => {
    setBinaryUrl(undefined)
    if (binary === undefined || mediaKind === undefined || typeof URL.createObjectURL !== 'function') return
    const url = URL.createObjectURL(new Blob([new Uint8Array(binary.bytes)], { type: binary.mediaType ?? entry.mediaType ?? 'application/octet-stream' }))
    setBinaryUrl(url)
    return () => { URL.revokeObjectURL(url) }
  }, [binary, entry.mediaType, mediaKind])

  const save = async (): Promise<void> => {
    if (!canEdit || host.writeText === undefined || version === undefined || saving) return
    setSaving(true)
    setError(undefined)
    setNotice(undefined)
    try {
      const receipt = await host.writeText(entry, draft, version)
      if (receipt.status !== 'ok' || receipt.version === undefined) {
        setError(receipt.status === 'conflict' ? '文件已在外部修改。请重新打开文件后再继续编辑。' : receipt.reason ?? '文件保存失败。')
        return
      }
      setText(draft)
      setVersion(receipt.version)
      setNotice('已保存')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  const editableSource = viewMode === 'source' && canEdit
  const editing = viewMode === 'edit' || editableSource
  const visibleText = dirty ? draft : text
  const modeStatus = docx ? '预览 · DOCX'
    : viewMode === 'edit'
    ? '编辑 · 点击区块修改，失焦后渲染'
    : viewMode === 'source'
      ? canEdit ? '源码 · 可编辑' : '源码 · 只读'
      : markdown ? '预览 · Markdown' : '只读'
  const status = error ?? notice ?? (dirty ? `已修改 · ${modeStatus}` : truncated ? '只读 · 文件过大，仅显示部分内容' : `${modeStatus}${canEdit ? ' · 可保存' : ''}`)
  const onEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void save()
    }
  }

  const switchMode = (mode: FileViewMode): void => {
    if (mode === 'edit' && !canEdit) return
    if (mode === 'edit') {
      const nextBlocks = splitMarkdownBlocks(draft)
      setMarkdownBlocks(nextBlocks)
      setActiveBlock(0)
    } else {
      setActiveBlock(undefined)
    }
    setNotice(undefined)
    setViewMode(mode)
  }

  const updateBlock = (index: number, source: string): void => {
    const next = markdownBlocks.map((block, blockIndex) => blockIndex === index ? { ...block, source } : block)
    setMarkdownBlocks(next)
    setDraft(joinMarkdownBlocks(next))
    setNotice(undefined)
  }

  const effectivePreviewUrl = previewUrl ?? binaryUrl

  const modeNav = text === undefined ? undefined : <div className="dwo-file-mode-switch" role="group" aria-label="文件显示模式" data-dsh-file-mode-switch>
    <Button type="button" size="sm" variant="toolbar" data-active={viewMode === 'preview'} aria-label={markdown ? '预览模式' : '只读模式'} aria-pressed={viewMode === 'preview'} onClick={() => { switchMode('preview') }}>{markdown ? '预览' : '只读'}</Button>
    <Button type="button" size="sm" variant="toolbar" data-active={viewMode === 'edit'} aria-label="编辑模式" title={canEdit ? '块级实时渲染编辑' : truncated ? '截断文件不能直接编辑' : '文件 owner 未授权编辑'} aria-pressed={viewMode === 'edit'} disabled={!canEdit} onClick={() => { switchMode('edit') }}>编辑</Button>
    {markdown && <Button type="button" size="sm" variant="toolbar" data-active={viewMode === 'source'} aria-label="源码模式" aria-pressed={viewMode === 'source'} onClick={() => { switchMode('source') }}>源码</Button>}
  </div>

  return (
    <Surface kind="workspace" className="dwo-file-open" data-dsh-file-open-pane data-file-id={entry.id} data-file-view={viewMode} data-file-mode={editing ? 'edit' : 'readonly'}>
      <style data-dsh-file-open-styles>{fileOpenStyles}</style>
      <style data-dsh-file-markdown-styles>{markdownStyles}</style>
      <SurfaceContextBar
        title={entry.name}
        context={entry.mediaType ?? entry.kind}
        nav={modeNav}
        actions={canEdit && (editing || dirty) ? <Button type="button" size="sm" variant="primary" disabled={!dirty || saving} title={!dirty ? '没有待保存的修改' : undefined} onClick={() => { void save() }}>{saving ? '保存中…' : '保存'}</Button> : undefined}
      />
      <div className="dwo-file-body">
        {loading && <SurfaceState phase="loading" title="正在打开文件…" />}
        {error !== undefined && !loading && <SurfaceState phase="error" title={error} />}
        {docx && binary !== undefined && <DocxPreview bytes={binary.bytes} title={entry.name} />}
        {mediaKind === 'image' && effectivePreviewUrl !== undefined && <img className="dwo-file-media" src={effectivePreviewUrl} alt={entry.name} data-dsh-file-open-image />}
        {mediaKind === 'audio' && effectivePreviewUrl !== undefined && <audio className="dwo-file-media" src={effectivePreviewUrl} controls preload="metadata" aria-label={entry.name} data-dsh-file-open-audio />}
        {mediaKind === 'video' && effectivePreviewUrl !== undefined && <video className="dwo-file-media" src={effectivePreviewUrl} controls preload="metadata" aria-label={entry.name} data-dsh-file-open-video />}
        {mediaKind === 'pdf' && effectivePreviewUrl !== undefined && <iframe className="dwo-file-media" src={effectivePreviewUrl} title={entry.name} sandbox="allow-same-origin" referrerPolicy="no-referrer" data-dsh-file-open-pdf />}
        {mediaKind !== undefined && effectivePreviewUrl === undefined && error === undefined && !loading && <SurfaceState phase="disabled" title="此资源暂不支持内嵌预览。" data-dsh-file-open-unsupported />}
        {markdown && visibleText !== undefined && viewMode === 'preview' && <div className="dwo-file-markdown" data-dsh-file-markdown data-dsh-file-open-preview><MarkdownText text={visibleText} /></div>}
        {markdown && text !== undefined && viewMode === 'edit' && <div className="dwo-markdown-editor" data-dsh-markdown-editor>
          {markdownBlocks.map((block, index) => activeBlock === index
            ? <section className="dwo-markdown-block" data-dsh-markdown-block data-active="true" key={index}>
                <label className="dwo-markdown-block-source">
                  <span>{`区块 ${index + 1} 源码`}</span>
                  <textarea autoFocus className="dwo-markdown-block-editor ys-field__input" rows={editorRows(block.source)} aria-label={`编辑 ${entry.name} 的 Markdown 区块 ${index + 1}`} value={block.source} spellCheck={false} onChange={event => { updateBlock(index, event.target.value) }} onKeyDown={event => { onEditorKeyDown(event); if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); setActiveBlock(undefined) } }} onBlur={() => { setActiveBlock(undefined) }} />
                </label>
                <div className="dwo-markdown-live" aria-live="polite">
                  <span className="dwo-markdown-live-label">实时渲染</span>
                  <div className="dwo-markdown-live-preview" data-dsh-file-markdown data-dsh-markdown-active-preview>{block.source.trim().length > 0 ? <MarkdownText text={block.source} /> : <span className="dwo-markdown-empty">输入 Markdown 后将在这里渲染</span>}</div>
                </div>
              </section>
            : <section className="dwo-markdown-block" data-dsh-markdown-block data-active="false" key={index} role="button" tabIndex={0} aria-label={`编辑 Markdown 区块 ${index + 1}`} onClick={event => { event.preventDefault(); setActiveBlock(index) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveBlock(index) } }}>
                <div data-dsh-file-markdown>{block.source.trim().length > 0 ? <MarkdownText text={block.source} /> : <span className="dwo-markdown-empty">空白区块，点击编辑</span>}</div>
              </section>)}
        </div>}
        {text !== undefined && viewMode === 'source' && !canEdit && <pre className="dwo-file-source" data-dsh-file-open-text>{draft}</pre>}
        {text !== undefined && ((viewMode === 'source' && canEdit) || (!markdown && viewMode === 'edit')) && <label className="ys-field dwo-file-editor-field"><textarea className="dwo-file-editor" aria-label={`编辑 ${entry.name}`} value={draft} spellCheck={false} wrap="off" data-dsh-file-open-editor data-dsh-file-source-editor={viewMode === 'source' || undefined} onChange={event => { setDraft(event.target.value); setNotice(undefined) }} onKeyDown={onEditorKeyDown} /></label>}
        {!markdown && visibleText !== undefined && viewMode === 'preview' && <pre className="dwo-file-source" data-dsh-file-open-text>{visibleText}</pre>}
      </div>
      <div className="dwo-file-status" role={error === undefined ? 'status' : 'alert'} data-dsh-file-open-status>{status}</div>
    </Surface>
  )
}

export function FileOpenPane({ host, entry, semanticSessionId }: FileOpenPaneProps) {
  const languageHost = useMemo(() => createRemoteLanguageIntelligenceHost(), [])
  const legacy = <LegacyFileOpenPane host={host} entry={entry} />
  const semantic = semanticSessionId !== undefined
    && host.capabilities?.includes(FILE_OPAQUE_REF_CAPABILITY) === true
    && entry.kind === 'text'
    && mediaKindOf(entry) === undefined
    && !isDocxFile(entry.name, entry.mediaType)
  if (!semantic) return legacy
  return <SemanticFileEditor
    entry={entry}
    fileHost={host}
    languageHost={languageHost}
    sessionId={semanticSessionId}
    fallback={legacy}
  />
}

export default FileOpenPane

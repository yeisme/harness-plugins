import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { FileHostV1, FileWorkspaceEditPreviewV1 } from '@yeisme/dsh-file-host'
import type {
  LanguageDiagnosticV1,
  LanguageDocumentSnapshotV1,
  LanguageIntelligenceHostV1,
  SyntaxNodeProjectionV1,
  SyntaxTreeProjectionV1,
  TextPositionV1,
  WorkspaceTextEditDraftV1,
} from '@yeisme/dsh-language-intelligence-host'
import { createRemoteSemanticWorkspaceEditHost, type SemanticWorkspaceEditHostV1 } from './client.js'

export { createRemoteLanguageIntelligenceHost, createRemoteSemanticWorkspaceEditHost } from './client.js'
export type { RemoteLanguageIntelligenceOptions, SemanticWorkspaceEditHostV1 } from './client.js'

type ViewMode = 'edit' | 'preview' | 'split' | 'structure'

interface MonacoModel {
  getValue(): string
  setValue(value: string): void
  onDidChangeContent(listener: () => void): { dispose(): void }
  dispose(): void
}

interface MonacoEditorInstance {
  setPosition(position: { lineNumber: number; column: number }): void
  revealLineInCenter(lineNumber: number): void
  focus(): void
  onDidChangeCursorPosition(listener: (event: { position: { lineNumber: number; column: number } }) => void): { dispose(): void }
  layout(): void
  dispose(): void
}

interface MonacoFace {
  readonly Uri: { parse(value: string): unknown }
  readonly editor: {
    createModel(value: string, language: string, uri: unknown): MonacoModel
    create(container: HTMLElement, options: Record<string, unknown>): MonacoEditorInstance
    setModelMarkers(model: MonacoModel, owner: string, markers: readonly Record<string, unknown>[]): void
  }
  readonly MarkerSeverity: { Error: number; Warning: number; Info: number; Hint: number }
  readonly languages?: {
    readonly typescript?: {
      readonly typescriptDefaults?: { setDiagnosticsOptions(options: Record<string, unknown>): void }
      readonly javascriptDefaults?: { setDiagnosticsOptions(options: Record<string, unknown>): void }
    }
  }
}

interface AmdRequire {
  (modules: readonly string[], resolve: () => void, reject: (error: unknown) => void): void
  config(options: Record<string, unknown>): void
}

declare global {
  interface Window {
    require?: AmdRequire
    monaco?: MonacoFace
    MonacoEnvironment?: { getWorkerUrl(moduleId: string, label: string): string }
  }
}

const monacoLoads = new Map<string, Promise<MonacoFace>>()

/**
 * G21 dispose 收口：loader script 的 load/error 监听成对挂载、任一触发即
 * 先摘下双监听再转发（`once` 兜底）——监听不残留在常驻 document.head 的
 * script 元素上，加载失败也完成释放。
 */
function attachLoaderListeners(target: HTMLScriptElement, onLoad: () => void, onError: () => void): void {
  const detach = (): void => {
    target.removeEventListener('load', forwardLoad)
    target.removeEventListener('error', forwardError)
  }
  const forwardLoad = (): void => { detach(); onLoad() }
  const forwardError = (): void => { detach(); onError() }
  target.addEventListener('load', forwardLoad, { once: true })
  target.addEventListener('error', forwardError, { once: true })
}

function loadMonaco(assetBase: string): Promise<MonacoFace> {
  const normalized = assetBase.replace(/\/$/, '')
  const existing = monacoLoads.get(normalized)
  if (existing !== undefined) return existing
  const pending = new Promise<MonacoFace>((resolve, reject) => {
    const finish = (): void => {
      const amd = window.require
      if (amd === undefined) { reject(new Error('Monaco AMD loader is unavailable')); return }
      amd.config({ paths: { vs: normalized } })
      window.MonacoEnvironment = { getWorkerUrl: (_moduleId, label) => {
        if (label === 'json') return `${normalized}/language/json/json.worker.js`
        if (label === 'css' || label === 'scss' || label === 'less') return `${normalized}/language/css/css.worker.js`
        if (label === 'html' || label === 'handlebars' || label === 'razor') return `${normalized}/language/html/html.worker.js`
        if (label === 'typescript' || label === 'javascript') return `${normalized}/language/typescript/ts.worker.js`
        return `${normalized}/editor/editor.worker.js`
      } }
      amd(['vs/editor/editor.main'], () => {
        if (window.monaco === undefined) { reject(new Error('Monaco editor is unavailable')); return }
        const defaults = window.monaco.languages?.typescript
        defaults?.typescriptDefaults?.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true })
        defaults?.javascriptDefaults?.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true })
        resolve(window.monaco)
      }, reject)
    }
    if (window.monaco !== undefined) { resolve(window.monaco); return }
    const current = document.querySelector<HTMLScriptElement>(`script[data-dsh-monaco-loader="${normalized}"]`)
    if (current !== null) {
      attachLoaderListeners(current, finish, () => { reject(new Error('Monaco loader failed')) })
      return
    }
    const script = document.createElement('script')
    script.src = `${normalized}/loader.js`
    script.async = true
    script.dataset.dshMonacoLoader = normalized
    attachLoaderListeners(script, finish, () => { reject(new Error('Monaco loader failed')) })
    document.head.append(script)
  })
  monacoLoads.set(normalized, pending)
  return pending
}

const styles = `
[data-dsh-semantic-file-editor]{display:flex;flex:1 1 0;min-height:0;height:100%;--dsh-semantic-outline:clamp(220px,26%,340px)}
.dsh-semantic-file{display:flex;flex:1 1 0;min-height:0;container-type:inline-size;container-name:dsh-semantic-file}
.dsh-semantic-file__body{display:grid;grid-template-columns:minmax(0,1fr) var(--dsh-semantic-outline);flex:1 1 0;min-height:0;background:var(--vk-bg-base)}
.dsh-semantic-file__main{position:relative;display:flex;min-width:0;min-height:0;overflow:hidden}.dsh-semantic-file__main[data-split='true']{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.dsh-semantic-file__main[data-split='true'] .dsh-semantic-file__preview{border-left:1px solid var(--vk-border-l1)}
.dsh-semantic-file__editor,.dsh-semantic-file__fallback,.dsh-semantic-file__preview{box-sizing:border-box;width:100%;height:100%;min-height:240px}
.dsh-semantic-file__editor{overflow:hidden}.dsh-semantic-file__fallback{resize:none;border:0;outline:0;padding:18px 22px;color:var(--vk-text-primary);background:var(--vk-bg-base);font:var(--dsh-wb-font-size,14px)/1.62 ui-monospace,SFMono-Regular,Menlo,monospace;tab-size:2}
.dsh-semantic-file__fallback[data-monaco-ready='true']{display:none}
.dsh-semantic-file__fallback-field{display:contents}.dsh-semantic-file__actions{display:flex;gap:6px}
.dsh-semantic-file__preview{overflow:auto;padding:24px 30px 42px;line-height:1.68}.dsh-semantic-file__preview>pre{box-sizing:border-box;max-width:1100px;min-height:100%;margin:0 auto;padding:20px;overflow:auto;border:1px solid var(--vk-border-l1);border-radius:10px;background:var(--vk-bg-layer-1);font:13px/1.62 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}
.dsh-semantic-file__outline{min-width:0;min-height:0;overflow:auto;border-left:1px solid var(--vk-border-l1);background:color-mix(in srgb,var(--vk-bg-layer-1) 72%,var(--vk-bg-base))}
.dsh-semantic-file__outline-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid var(--vk-border-l1);background:var(--vk-bg-layer-1);font-size:12px;font-weight:680}
.dsh-semantic-file__engine{padding:2px 7px;border:1px solid var(--vk-border-l2);border-radius:999px;color:var(--vk-text-tertiary);font-size:10px;font-weight:600}.dsh-semantic-file__tree{display:grid;padding:7px}.dsh-semantic-file__node{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;width:100%;min-height:28px;padding:5px 7px;border:0;border-radius:6px;text-align:left;color:var(--vk-text-secondary);background:transparent;cursor:pointer;font:12px/1.35 ui-sans-serif,system-ui}.dsh-semantic-file__node:hover,.dsh-semantic-file__node:focus-visible{outline:0;background:var(--vk-bg-elevated);color:var(--vk-text-primary)}
.dsh-semantic-file__node[data-depth='1']{padding-left:18px}.dsh-semantic-file__node[data-depth='2']{padding-left:29px}.dsh-semantic-file__node[data-depth='3']{padding-left:40px}.dsh-semantic-file__node[data-depth='4']{padding-left:51px}.dsh-semantic-file__node[data-depth='5']{padding-left:62px}.dsh-semantic-file__node[data-depth='6']{padding-left:73px}
.dsh-semantic-file__kind{color:var(--vk-accent);font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}.dsh-semantic-file__label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-semantic-file__empty{padding:18px 13px;color:var(--vk-text-tertiary);font-size:12px}
.dsh-semantic-file__problems{border-top:1px solid var(--vk-border-l1)}.dsh-semantic-file__problem{display:grid;gap:3px;width:100%;padding:8px 12px;border:0;border-bottom:1px solid var(--vk-border-l1);text-align:left;color:var(--vk-text-secondary);background:transparent;cursor:pointer;font:11px/1.4 ui-sans-serif,system-ui}.dsh-semantic-file__problem:hover{background:var(--vk-bg-elevated)}.dsh-semantic-file__problem strong{color:var(--vk-text-primary);font-weight:600}.dsh-semantic-file__problem span{color:var(--vk-text-tertiary)}
.dsh-semantic-file__diagnostics{display:flex;gap:7px;align-items:center;color:var(--vk-text-tertiary);font-size:11px;font-variant-numeric:tabular-nums}.dsh-semantic-file__diagnostics [data-severity='error']{color:var(--vk-state-error)}.dsh-semantic-file__diagnostics [data-severity='warning']{color:var(--vk-state-warn)}
.dsh-semantic-file__modes{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--vk-border-l1);border-radius:8px;background:var(--vk-bg-layer-2)}.dsh-semantic-file__modes button[data-active='true']{background:var(--vk-bg-elevated);box-shadow:inset 0 0 0 1px var(--vk-border-l2)}
.dsh-semantic-file__status{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:27px;padding:4px 12px;border-top:1px solid var(--vk-border-l1);color:var(--vk-text-tertiary);background:var(--vk-bg-layer-1);font-size:11px}
.dsh-semantic-file__edit-preview{position:absolute;inset:44px 18px 38px;z-index:8;display:flex;flex-direction:column;min-height:0;border:1px solid var(--vk-border-l2);border-radius:12px;background:var(--vk-bg-elevated);box-shadow:0 18px 50px color-mix(in srgb,#000 28%,transparent);overflow:hidden}.dsh-semantic-file__edit-preview header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--vk-border-l1)}.dsh-semantic-file__edit-preview-files{display:grid;gap:10px;min-height:0;overflow:auto;padding:12px}.dsh-semantic-file__edit-preview-file{display:grid;gap:7px}.dsh-semantic-file__edit-preview-file strong{font-size:12px}.dsh-semantic-file__edit-preview-file pre{max-height:220px;overflow:auto;margin:0;padding:10px;border:1px solid var(--vk-border-l1);border-radius:7px;background:var(--vk-bg-base);font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}.dsh-semantic-file__edit-preview-actions{display:flex;justify-content:flex-end;gap:7px;padding:10px 14px;border-top:1px solid var(--vk-border-l1)}
@container dsh-semantic-file (max-width:720px){.dsh-semantic-file__body{grid-template-columns:minmax(0,1fr)}.dsh-semantic-file__outline{position:absolute;inset:0 0 0 35%;z-index:3;box-shadow:-8px 0 22px color-mix(in srgb,#000 18%,transparent)}.dsh-semantic-file__body:not([data-view='structure']) .dsh-semantic-file__outline{display:none}.dsh-semantic-file__preview{padding:16px}}
`

export interface SemanticFileEditorProps {
  readonly entry: FileEntryV1
  readonly fileHost: FileHostV1
  readonly languageHost: LanguageIntelligenceHostV1
  readonly sessionId: string
  readonly monacoAssetBase?: string
  readonly workspaceEditHost?: SemanticWorkspaceEditHostV1
  readonly fallback?: ReactNode
}

interface PendingWorkspacePreview {
  readonly preview: FileWorkspaceEditPreviewV1
  readonly draft: WorkspaceTextEditDraftV1
  readonly currentText?: string
}

function isMarkdown(entry: FileEntryV1, languageId?: string): boolean {
  return languageId === 'markdown' || entry.mediaType === 'text/markdown' || /\.mdx?$/i.test(entry.name)
}

function displaySource(source: string, languageId?: string): string {
  if (languageId === 'json' || languageId === 'jsonc') {
    try { return JSON.stringify(JSON.parse(source), null, 2) } catch { return source }
  }
  return source
}

function positionOffset(source: string, position: TextPositionV1): number {
  let line = 0
  let offset = 0
  while (line < position.line && offset < source.length) {
    const next = source.indexOf('\n', offset)
    if (next < 0) return source.length
    offset = next + 1
    line += 1
  }
  return Math.max(offset, Math.min(source.length, offset + position.character))
}

function offsetPosition(source: string, offset: number): TextPositionV1 {
  const target = Math.max(0, Math.min(source.length, offset))
  let line = 0
  let lineStart = 0
  for (let index = 0; index < target; index += 1) {
    if (source.charCodeAt(index) === 10) { line += 1; lineStart = index + 1 }
  }
  return { line, character: target - lineStart }
}

function applyWorkspaceDraft(source: string, draft: WorkspaceTextEditDraftV1, ref: string): string | undefined {
  if (draft.rejectedReason !== undefined || draft.files.length !== 1 || draft.files[0]?.ref !== ref) return undefined
  const edits = [...draft.files[0].edits].map(edit => ({
    start: positionOffset(source, edit.range.start),
    end: positionOffset(source, edit.range.end),
    text: edit.newText,
  })).sort((left, right) => right.start - left.start || right.end - left.end)
  let next = source
  let boundary = source.length
  for (const edit of edits) {
    if (edit.start > edit.end || edit.end > boundary) return undefined
    next = `${next.slice(0, edit.start)}${edit.text}${next.slice(edit.end)}`
    boundary = edit.start
  }
  return next
}

function markerSeverity(monaco: MonacoFace, severity: LanguageDiagnosticV1['severity']): number {
  if (severity === 'error') return monaco.MarkerSeverity.Error
  if (severity === 'warning') return monaco.MarkerSeverity.Warning
  if (severity === 'information') return monaco.MarkerSeverity.Info
  return monaco.MarkerSeverity.Hint
}

function meaningfulNodes(tree: SyntaxTreeProjectionV1 | undefined): readonly SyntaxNodeProjectionV1[] {
  if (tree === undefined) return []
  return tree.nodes.filter(node => node.named && (node.depth <= 4 || node.field !== undefined)).slice(0, 800)
}

export function SemanticFileEditor({ entry, fileHost, languageHost, sessionId, monacoAssetBase = '/yeisme-language/assets/vs', workspaceEditHost, fallback }: SemanticFileEditorProps) {
  const [snapshot, setSnapshot] = useState<LanguageDocumentSnapshotV1>()
  const [draft, setDraft] = useState('')
  const [fileVersion, setFileVersion] = useState<string>()
  const [documentVersion, setDocumentVersion] = useState(1)
  const [tree, setTree] = useState<SyntaxTreeProjectionV1>()
  const [diagnostics, setDiagnostics] = useState<readonly LanguageDiagnosticV1[]>([])
  const [view, setView] = useState<ViewMode>('edit')
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [cursor, setCursor] = useState<TextPositionV1>({ line: 0, character: 0 })
  const [pendingEdit, setPendingEdit] = useState<PendingWorkspacePreview>()
  const [monacoReady, setMonacoReady] = useState(false)
  const editorContainer = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MonacoEditorInstance>()
  const modelRef = useRef<MonacoModel>()
  const monacoRef = useRef<MonacoFace>()
  const versionRef = useRef(1)
  const draftRef = useRef('')
  const workspaceEdits = useMemo(() => workspaceEditHost ?? createRemoteSemanticWorkspaceEditHost(), [workspaceEditHost])

  const refreshProjections = useCallback(async (opened: LanguageDocumentSnapshotV1, version: number): Promise<void> => {
    const [structure, diagnosticRows] = await Promise.all([
      languageHost.query(opened.handleId, version, { kind: 'structure' }).catch(() => undefined),
      languageHost.query(opened.handleId, version, { kind: 'diagnostics' }).catch(() => undefined),
    ])
    if (structure?.kind === 'structure') setTree(structure.value)
    if (diagnosticRows?.kind === 'diagnostics') setDiagnostics(diagnosticRows.value)
  }, [languageHost])

  useEffect(() => {
    let live = true
    let opened: LanguageDocumentSnapshotV1 | undefined
    setLoading(true)
    setUnavailable(false)
    setNotice(undefined)
    void languageHost.open({ sessionId, ref: entry.id }).then(value => {
      if (!live) { void languageHost.close(value.handleId); return }
      opened = value
      setSnapshot(value)
      setDraft(value.text)
      draftRef.current = value.text
      setFileVersion(value.fileVersion)
      setDocumentVersion(value.documentVersion)
      versionRef.current = value.documentVersion
      setLoading(false)
      void refreshProjections(value, value.documentVersion)
    }, () => {
      if (!live) return
      setLoading(false)
      setUnavailable(true)
    })
    return () => {
      live = false
      if (opened !== undefined) void languageHost.close(opened.handleId)
    }
  }, [entry.id, languageHost, refreshProjections, sessionId])

  useEffect(() => {
    if (snapshot === undefined) return
    const interval = window.setInterval(() => { void refreshProjections(snapshot, versionRef.current) }, 2_000)
    return () => { window.clearInterval(interval) }
  }, [refreshProjections, snapshot])

  const updateDraft = useCallback((value: string): void => {
    draftRef.current = value
    setDraft(value)
    setNotice(undefined)
    if (snapshot === undefined) return
    const nextVersion = versionRef.current + 1
    versionRef.current = nextVersion
    setDocumentVersion(nextVersion)
    void languageHost.change({ handleId: snapshot.handleId, documentVersion: nextVersion, text: value }).then(receipt => {
      if (receipt.accepted) void refreshProjections(snapshot, receipt.documentVersion)
    })
  }, [languageHost, refreshProjections, snapshot])

  useEffect(() => {
    if (snapshot === undefined || editorContainer.current === null) return
    let live = true
    let changeDisposable: { dispose(): void } | undefined
    let cursorDisposable: { dispose(): void } | undefined
    void loadMonaco(monacoAssetBase).then(monaco => {
      if (!live || editorContainer.current === null) return
      const model = monaco.editor.createModel(draftRef.current, snapshot.languageId, monaco.Uri.parse(snapshot.modelUri))
      const editor = monaco.editor.create(editorContainer.current, {
        model,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 21,
        padding: { top: 14, bottom: 20 },
        readOnly: snapshot.readOnly || snapshot.truncated,
        renderWhitespace: 'selection',
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        stickyScroll: { enabled: true },
        wordWrap: isMarkdown(entry, snapshot.languageId) ? 'on' : 'off',
      })
      changeDisposable = model.onDidChangeContent(() => { updateDraft(model.getValue()) })
      cursorDisposable = editor.onDidChangeCursorPosition(event => { setCursor({ line: event.position.lineNumber - 1, character: event.position.column - 1 }) })
      monacoRef.current = monaco
      modelRef.current = model
      editorRef.current = editor
      setMonacoReady(true)
    }).catch(() => { setMonacoReady(false) })
    return () => {
      live = false
      changeDisposable?.dispose()
      cursorDisposable?.dispose()
      editorRef.current?.dispose()
      modelRef.current?.dispose()
      editorRef.current = undefined
      modelRef.current = undefined
      monacoRef.current = undefined
      setMonacoReady(false)
    }
  }, [entry, monacoAssetBase, snapshot, updateDraft])

  useEffect(() => {
    const monaco = monacoRef.current
    const model = modelRef.current
    if (monaco === undefined || model === undefined) return
    monaco.editor.setModelMarkers(model, 'dsh-language-host', diagnostics.map(diagnostic => ({
      startLineNumber: diagnostic.range.start.line + 1,
      startColumn: diagnostic.range.start.character + 1,
      endLineNumber: diagnostic.range.end.line + 1,
      endColumn: diagnostic.range.end.character + 1,
      message: diagnostic.message,
      severity: markerSeverity(monaco, diagnostic.severity),
      ...(diagnostic.source === undefined ? {} : { source: diagnostic.source }),
      ...(diagnostic.code === undefined ? {} : { code: diagnostic.code }),
    })))
  }, [diagnostics, monacoReady])

  const dirty = snapshot !== undefined && draft !== snapshot.text && fileVersion !== undefined
  const canEdit = snapshot !== undefined && !snapshot.readOnly && !snapshot.truncated && fileHost.writeText !== undefined && entry.capabilities.includes('edit')
  const nodes = useMemo(() => meaningfulNodes(tree), [tree])
  const errors = diagnostics.filter(row => row.severity === 'error').length
  const warnings = diagnostics.filter(row => row.severity === 'warning').length

  const save = async (): Promise<void> => {
    if (!canEdit || !dirty || saving || fileHost.writeText === undefined || fileVersion === undefined || snapshot === undefined) return
    setSaving(true)
    try {
      const receipt = await fileHost.writeText(entry, draftRef.current, fileVersion)
      if (receipt.status !== 'ok' || receipt.version === undefined) {
        setNotice(receipt.status === 'conflict' ? '文件已在外部修改，请重新打开后再保存。' : receipt.reason ?? '保存被文件 owner 拒绝。')
        return
      }
      setSnapshot({ ...snapshot, text: draftRef.current, fileVersion: receipt.version, documentVersion: versionRef.current })
      setFileVersion(receipt.version)
      await languageHost.didSave(snapshot.handleId, receipt.version)
      setNotice('已保存')
    } catch {
      setNotice('保存失败，原文件未被覆盖。')
    } finally {
      setSaving(false)
    }
  }

  const previewWorkspaceEdit = async (workspaceDraft: WorkspaceTextEditDraftV1): Promise<void> => {
    if (workspaceDraft.rejectedReason !== undefined || workspaceDraft.files.length === 0) { setNotice(workspaceDraft.rejectedReason ?? 'Language Server 未返回可应用编辑。'); return }
    try {
      const currentFile = workspaceDraft.files.find(file => file.ref === entry.id)
      const currentText = currentFile === undefined ? undefined : applyWorkspaceDraft(draftRef.current, { ...workspaceDraft, files: [currentFile] }, entry.id)
      const preview = await workspaceEdits.preview(sessionId, workspaceDraft)
      setPendingEdit({ preview, draft: workspaceDraft, ...(currentText === undefined ? {} : { currentText }) })
    } catch {
      setNotice('工作区编辑预检失败，未修改任何文件。')
    }
  }

  const format = async (): Promise<void> => {
    if (snapshot === undefined || !snapshot.features.includes('format') || !canEdit) return
    const result = await languageHost.query(snapshot.handleId, versionRef.current, { kind: 'format', tabSize: 2, insertSpaces: true }).catch(() => undefined)
    if (result?.kind !== 'workspaceEdit') { setNotice('Language Server 未返回格式化编辑。'); return }
    await previewWorkspaceEdit(result.value)
  }

  const rename = async (): Promise<void> => {
    if (snapshot === undefined || !snapshot.features.includes('rename') || !canEdit) return
    const newName = window.prompt('输入新的符号名称')?.trim()
    if (newName === undefined || newName === '') return
    const result = await languageHost.query(snapshot.handleId, versionRef.current, { kind: 'rename', position: cursor, newName }).catch(() => undefined)
    if (result?.kind !== 'workspaceEdit') { setNotice('Language Server 未返回重命名编辑。'); return }
    await previewWorkspaceEdit(result.value)
  }

  const codeAction = async (): Promise<void> => {
    if (snapshot === undefined || !snapshot.features.includes('codeActions') || !canEdit) return
    const result = await languageHost.query(snapshot.handleId, versionRef.current, { kind: 'codeAction', range: { start: cursor, end: cursor } }).catch(() => undefined)
    if (result?.kind !== 'workspaceEdit') { setNotice('当前位置没有可安全应用的快速修复。'); return }
    await previewWorkspaceEdit(result.value)
  }

  const applyWorkspacePreview = async (): Promise<void> => {
    if (pendingEdit === undefined || snapshot === undefined) return
    const pending = pendingEdit
    setPendingEdit(undefined)
    try {
      const receipt = await workspaceEdits.apply(sessionId, pending.preview.previewId)
      if (receipt.status !== 'ok') { setNotice(receipt.reason ?? `工作区编辑未完成：${receipt.status}`); return }
      const current = receipt.files.find(file => file.ref === entry.id)
      if (current?.version !== undefined && pending.currentText !== undefined) {
        if (modelRef.current !== undefined) modelRef.current.setValue(pending.currentText)
        else updateDraft(pending.currentText)
        setFileVersion(current.version)
        setSnapshot({ ...snapshot, text: pending.currentText, fileVersion: current.version, documentVersion: versionRef.current })
        await languageHost.didSave(snapshot.handleId, current.version)
      }
      setNotice(`已应用 ${receipt.files.length} 个文件的工作区编辑`)
    } catch {
      setNotice('工作区编辑应用失败；请检查 receipt 后重试。')
    }
  }

  const reveal = (node: SyntaxNodeProjectionV1): void => {
    setView('edit')
    const editor = editorRef.current
    if (editor === undefined) return
    editor.setPosition({ lineNumber: node.range.start.line + 1, column: node.range.start.character + 1 })
    editor.revealLineInCenter(node.range.start.line + 1)
    editor.focus()
  }

  if (unavailable && fallback !== undefined) return <>{fallback}</>
  if (unavailable) return <Surface kind="workspace"><SurfaceState phase="error" title="语义文件能力不可用，文件未被修改。" /></Surface>
  if (loading || snapshot === undefined) return <Surface kind="workspace"><SurfaceState phase="loading" title="正在建立 AST / LSP 文档模型…" /></Surface>

  const modeNav = <div className="dsh-semantic-file__modes" role="group" aria-label="语义文件视图">
    {(['edit', 'preview', 'split', 'structure'] as const).map(mode => <Button key={mode} type="button" size="sm" variant="toolbar" data-active={view === mode} aria-pressed={view === mode} onClick={() => { setView(mode) }}>{mode === 'edit' ? '编辑' : mode === 'preview' ? '预览' : mode === 'split' ? '分栏' : '结构'}</Button>)}
  </div>

  return <Surface kind="workspace" className="dsh-semantic-file" data-dsh-semantic-file-editor data-language-engine={snapshot.engine} data-language-id={snapshot.languageId}>
    <style>{styles}</style>
    <SurfaceContextBar
      title={entry.name}
      context={`${snapshot.languageId} · ${snapshot.engine}`}
      nav={modeNav}
      actions={<div className="dsh-semantic-file__actions">
        {snapshot.features.includes('format') && <Button type="button" size="sm" variant="toolbar" disabled={!canEdit} onClick={() => { void format() }}>格式化</Button>}
        {snapshot.features.includes('rename') && <Button type="button" size="sm" variant="toolbar" disabled={!canEdit} onClick={() => { void rename() }}>重命名</Button>}
        {snapshot.features.includes('codeActions') && <Button type="button" size="sm" variant="toolbar" disabled={!canEdit} onClick={() => { void codeAction() }}>快速修复</Button>}
        {canEdit && <Button type="button" size="sm" variant="primary" disabled={!dirty || saving} onClick={() => { void save() }}>{saving ? '保存中…' : '保存'}</Button>}
      </div>}
    />
    <div className="dsh-semantic-file__body" data-view={view}>
      <div className="dsh-semantic-file__main" data-split={view === 'split'}>
        <div ref={editorContainer} className="dsh-semantic-file__editor" hidden={view !== 'edit' && view !== 'split'} />
        <label className="ys-field dsh-semantic-file__fallback-field">
          <textarea
            className="dsh-semantic-file__fallback"
            data-monaco-ready={monacoReady}
            hidden={view !== 'edit' && view !== 'split'}
            aria-label={`${entry.name} 源码`}
            readOnly={!canEdit}
            value={draft}
            onChange={event => { updateDraft(event.currentTarget.value) }}
            onSelect={event => { setCursor(offsetPosition(event.currentTarget.value, event.currentTarget.selectionStart)) }}
            onKeyDown={event => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save() }
            }}
          />
        </label>
        {(view === 'preview' || view === 'split') && <div className="dsh-semantic-file__preview" data-dsh-semantic-preview>
          {isMarkdown(entry, snapshot.languageId) ? <div data-dsh-file-markdown><MarkdownText text={draft} /></div> : <pre><code>{displaySource(draft, snapshot.languageId)}</code></pre>}
        </div>}
      </div>
      <aside className="dsh-semantic-file__outline" aria-label="语法结构">
        <div className="dsh-semantic-file__outline-head"><span>结构</span><span className="dsh-semantic-file__engine">{tree?.engine ?? snapshot.engine}</span></div>
        {nodes.length === 0 ? <div className="dsh-semantic-file__empty">当前格式没有可投影的结构节点。</div> : <div className="dsh-semantic-file__tree">
          {nodes.map(node => <button key={node.id} type="button" className="dsh-semantic-file__node" data-depth={Math.min(node.depth, 6)} onClick={() => { reveal(node) }} title={`${node.kind} · ${node.range.start.line + 1}:${node.range.start.character + 1}`}>
            <span className="dsh-semantic-file__kind">{node.field ?? node.kind}</span><span className="dsh-semantic-file__label">{node.label ?? node.kind}</span>
          </button>)}
        </div>}
        <div className="dsh-semantic-file__outline-head"><span>问题</span><span className="dsh-semantic-file__engine">{diagnostics.length}</span></div>
        {diagnostics.length === 0 ? <div className="dsh-semantic-file__empty">Language Server 当前没有报告问题。</div> : <div className="dsh-semantic-file__problems">
          {diagnostics.slice(0, 200).map((diagnostic, index) => <button key={`${diagnostic.range.start.line}:${diagnostic.range.start.character}:${index}`} type="button" className="dsh-semantic-file__problem" onClick={() => { reveal({ id: `diagnostic-${index}`, kind: diagnostic.severity, range: diagnostic.range, depth: 0, named: true, error: diagnostic.severity === 'error', missing: false }) }}>
            <strong>{diagnostic.message}</strong><span>{diagnostic.severity} · {diagnostic.range.start.line + 1}:{diagnostic.range.start.character + 1}</span>
          </button>)}
        </div>}
      </aside>
    </div>
    <div className="dsh-semantic-file__status" role="status">
      <span>{notice ?? (dirty ? '已修改，尚未保存' : snapshot.reason)}</span>
      <span className="dsh-semantic-file__diagnostics"><span>Ln {cursor.line + 1}, Col {cursor.character + 1}</span><span data-severity="error">错误 {errors}</span><span data-severity="warning">警告 {warnings}</span><span>v{documentVersion}</span></span>
    </div>
    {pendingEdit !== undefined && <section className="dsh-semantic-file__edit-preview" role="dialog" aria-modal="true" aria-label="工作区编辑预览">
      <header><strong>{pendingEdit.draft.title}</strong><span>{pendingEdit.preview.files.length} 个文件</span></header>
      <div className="dsh-semantic-file__edit-preview-files">
        {pendingEdit.preview.files.map(file => <article key={file.ref} className="dsh-semantic-file__edit-preview-file"><strong>{file.ref} · {file.editCount} 处编辑</strong><pre>{file.diff ?? `${file.beforeBytes} bytes → ${file.afterBytes} bytes`}</pre></article>)}
      </div>
      <div className="dsh-semantic-file__edit-preview-actions"><Button type="button" size="sm" variant="toolbar" onClick={() => { setPendingEdit(undefined) }}>取消</Button><Button type="button" size="sm" variant="primary" onClick={() => { void applyWorkspacePreview() }}>确认应用</Button></div>
    </section>}
  </Surface>
}

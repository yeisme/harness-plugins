/**
 * File/Document Workbench panel.
 *
 * This panel renders safe file-entry projections as a tree. It never
 * constructs paths from ids/names and never receives raw filesystem paths.
 * The canonical file tree, watcher, and document extraction stay with
 * DSH/domain owners.
 *
 * @module @yeisme/dsh-file-document/client
 */

import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { FileEntryKind, FileEntryV1 } from '../types.ts'
import {
  buildFileTree,
  fileTreePathOf,
  initialFileTreeUiState,
  selectFileTreeEntry,
  toggleFileTreeDirectory,
  type FileTreeNode,
} from '../file-tree.ts'

export interface FileDocumentPanelProps {
  tabId: 'files' | 'documents'
  /** Safe file-entry projections from the owning DSH/domain seam. */
  entries?: readonly FileEntryV1[] | undefined
  /** Optional Host-authorized preview URL resolver. */
  resolvePreviewUrl?: ((entry: FileEntryV1) => string | undefined) | undefined
  /** Optional owner callback for opening a file as a preview tab. */
  onOpenEntry?: ((entry: FileEntryV1) => void) | undefined
  /** Optional owner callback for pinning a file as a durable tab. */
  onPinEntry?: ((entry: FileEntryV1) => void) | undefined
  /** Optional on-demand directory loader used when expanding a directory. */
  loadChildren?: ((entry: FileEntryV1) => Promise<void>) | undefined
  /** Whether the root file projection is loading. */
  loading?: boolean | undefined
  /** Root projection error, if loading failed. */
  error?: string | undefined
  /** Retry the root projection after an error. */
  onRetry?: (() => void) | undefined
  /** Optional on-demand text preview loader for the selected file. */
  loadText?: ((entry: FileEntryV1) => Promise<string | undefined>) | undefined
  /** When false, keep the explorer as a tree without the embedded preview pane. */
  showPreviewPanel?: boolean | undefined
  /** Compact navigator chrome for the right-side directory tree. */
  compact?: boolean | undefined
}

const styles = {
  root: {
    display: 'grid',
    alignContent: 'start',
    gap: 18,
    width: '100%',
    maxWidth: 1120,
    minHeight: '100%',
    margin: '0 auto',
    color: 'var(--vk-text-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
    minWidth: 0,
  },
  eyebrow: {
    display: 'block',
    marginBottom: 5,
    color: 'var(--vk-text-tertiary)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
  },
  heading: {
    margin: 0,
    fontSize: 22,
    fontWeight: 680,
    letterSpacing: '-0.02em',
  },
  description: {
    margin: '6px 0 0',
    color: 'var(--vk-text-tertiary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  count: {
    display: 'inline-grid',
    flex: '0 0 auto',
    placeItems: 'center',
    minWidth: 52,
    minHeight: 28,
    padding: '0 10px',
    color: 'var(--vk-text-secondary)',
    background: 'var(--vk-bg-layer-1)',
    border: '1px solid var(--vk-border-l2)',
    borderRadius: 999,
    fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
  },
  tree: {
    display: 'grid',
    gap: 5,
    padding: 6,
    background: 'var(--vk-bg-layer-1)',
    border: '1px solid var(--vk-border-l2)',
    borderRadius: 12,
  },
  row: {
    display: 'grid',
    gap: 5,
    minHeight: 32,
    padding: '4px 8px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 7,
    cursor: 'default',
  },
  rowContent: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  toggle: {
    display: 'inline-grid',
    flex: '0 0 auto',
    placeItems: 'center',
    width: 22,
    height: 22,
    padding: 0,
    color: 'var(--vk-text-secondary)',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 6,
    cursor: 'pointer',
  },
  icon: {
    display: 'inline-grid',
    flex: '0 0 auto',
    placeItems: 'center',
    width: 22,
    height: 22,
    color: 'var(--vk-text-tertiary)',
    background: 'transparent',
    borderRadius: 6,
    fontSize: 9,
    fontWeight: 750,
    letterSpacing: '0.04em',
  },
  name: {
    minWidth: 0,
    overflow: 'hidden',
    fontSize: 'var(--dsh-wb-font-size, 13px)',
    fontWeight: 560,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
    overflow: 'hidden',
    fontSize: '11px',
    color: 'var(--vk-text-tertiary)',
    whiteSpace: 'nowrap',
  },
  breadcrumbItem: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    border: 0,
    padding: '2px 4px',
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
  },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 32,
    color: 'var(--vk-text-tertiary)',
    fontSize: 11,
  },
  empty: {
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 8,
    minHeight: 250,
    padding: 32,
    color: 'var(--vk-text-tertiary)',
    textAlign: 'center',
    background: 'var(--vk-bg-layer-1)',
    border: '1px dashed var(--vk-border-l2)',
    borderRadius: 14,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    marginBottom: 2,
    color: 'var(--vk-text-tertiary)',
  },
  emptyTitle: {
    color: 'var(--vk-text-primary)',
    fontSize: 15,
    fontWeight: 650,
  },
  emptyBody: { maxWidth: 430, fontSize: 13, lineHeight: 1.55 },
  preview: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: 520,
    marginTop: 8,
    overflow: 'auto',
    color: 'var(--vk-text-secondary)',
    background: 'var(--vk-bg-base)',
    border: '1px solid var(--vk-border-l2)',
    borderRadius: 10,
  },
  selected: {
    background: 'var(--vk-fill-active)',
    border: '1px solid var(--vk-border-l2)',
  },
  openButton: {
    minHeight: 24,
    marginLeft: 'auto',
    padding: '0 8px',
    color: 'var(--vk-text-secondary)',
    background: 'transparent',
    border: '1px solid var(--vk-border-l2)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
  },
  previewPanel: {
    display: 'grid',
    gap: 10,
    minWidth: 0,
    padding: 12,
    background: 'var(--vk-bg-layer-1)',
    border: '1px solid var(--vk-border-l2)',
    borderRadius: 12,
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 0,
  },
  previewTitle: {
    minWidth: 0,
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: 680,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  previewActions: { display: 'flex', flexWrap: 'wrap' as const, justifyContent: 'flex-end', gap: 6, flex: '0 0 auto' },
  previewButton: {
    minHeight: 30,
    padding: '0 9px',
    color: 'var(--vk-text-secondary)',
    background: 'transparent',
    border: '1px solid var(--vk-border-l2)',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 11,
    textDecoration: 'none',
  },
  previewBody: {
    display: 'grid',
    placeItems: 'center',
    minHeight: 180,
    maxHeight: 560,
    overflow: 'auto',
    padding: 10,
    color: 'var(--vk-text-secondary)',
    background: 'var(--vk-bg-base)',
    border: '1px solid var(--vk-border-l2)',
    borderRadius: 9,
  },
  previewImage: { display: 'block', maxWidth: '100%', maxHeight: 520, objectFit: 'contain' as const },
  previewFrame: { width: '100%', height: 520, border: 0, background: '#101012' },
  previewText: { width: '100%', margin: 0, whiteSpace: 'pre-wrap' as const, overflowWrap: 'anywhere' as const, fontFamily: 'var(--ds-font-family-code, monospace)', fontSize: 12, lineHeight: 1.55 },
  loading: {
    padding: '4px 12px 4px 52px',
    color: 'var(--vk-text-tertiary)',
    fontSize: 11,
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px 6px 52px',
    color: 'var(--vk-state-error)',
    fontSize: 11,
  },
} satisfies Record<string, CSSProperties>

const panelStyles = `
[data-dsh-file-document-panel], [data-dsh-file-document-panel] * { box-sizing: border-box; }
[data-dsh-file-document-panel] { font-size: var(--dsh-wb-font-size, 13px); font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif); }
[data-dsh-file-tree-row] { transition: background var(--ds-transition-duration-fast, .1s) ease, border-color var(--ds-transition-duration-fast, .1s) ease; }
[data-dsh-file-tree-row]:hover { background: var(--vk-fill-hover) !important; }
[data-dsh-file-tree-row]:focus-visible { outline: 2px solid var(--vk-accent); outline-offset: 1px; }
[data-dsh-file-tree-toggle]:hover, [data-dsh-file-open-button]:hover, [data-dsh-file-retry]:hover { background: var(--vk-fill-hover) !important; color: var(--vk-text-primary) !important; }
[data-dsh-file-tree-toggle]:focus-visible, [data-dsh-file-open-button]:focus-visible, [data-dsh-file-retry]:focus-visible { outline: 2px solid var(--vk-accent); outline-offset: 1px; }
[data-dsh-file-document-panel][data-compact='true'] { gap: 8px; max-width: none; margin: 0; padding: 8px; min-height: 100%; }
[data-dsh-file-document-panel][data-compact='true'] [data-dsh-file-tree] { padding: 2px; border-radius: 8px; }
[data-dsh-file-document-panel][data-compact='true'] [data-dsh-file-tree-row] { min-height: 28px; }
`

function kindLabel(kind: FileEntryKind): string {
  if (kind === 'directory') return '目录'
  if (kind === 'document') return '文档'
  if (kind === 'pdf') return 'PDF'
  if (kind === 'text') return '文本'
  if (kind === 'image') return '图片'
  if (kind === 'archive') return '压缩包'
  if (kind === 'binary') return '二进制'
  return '文件'
}

function ChevronIcon({ direction }: { readonly direction: 'right' | 'down' }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={direction === 'down' ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6'} />
  </svg>
}

function FileKindIcon({ kind }: { readonly kind: FileEntryKind }) {
  const path = kind === 'directory'
    ? 'M4 6h6l2 2h8v10H4zM4 8h16'
    : kind === 'image'
    ? 'M5 5h14v14H5zM8 15l3-3 2 2 2-3 2 4'
    : kind === 'pdf'
      ? 'M6 3h8l4 4v14H6zM14 3v5h4M9 15h6M9 11h4'
      : kind === 'document'
        ? 'M7 3h7l4 4v14H7zM14 3v5h4M10 12h5M10 16h5'
        : kind === 'text'
          ? 'M6 4h12M6 8h12M6 12h8M6 16h10M6 20h5'
          : kind === 'archive'
            ? 'M5 7h14v13H5zM4 4h16v3H4zM10 11h4'
            : kind === 'binary'
              ? 'M7 4h10v16H7zM10 8h1M13 8h1M10 12h1M13 12h1M10 16h1M13 16h1'
              : 'M6 3h8l4 4v14H6zM14 3v5h4'
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
}

function formatBytes(bytes: number | undefined): string | undefined {
  if (bytes === undefined) return undefined
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Preview({ entry, previewUrl }: { entry: FileEntryV1; previewUrl: string | undefined }) {
  const size = formatBytes(entry.size)
  const meta = [kindLabel(entry.kind), entry.mediaType, size].filter((part): part is string => part !== undefined).join(' · ')
  return <div style={styles.meta}>{meta}{previewUrl !== undefined ? ' · 可预览' : ''}</div>
}

function ResourcePreview({ entry, previewUrl, onOpenEntry, text, textLoading }: {
  entry: FileEntryV1 | undefined
  previewUrl: string | undefined
  onOpenEntry: ((entry: FileEntryV1) => void) | undefined
  text: string | undefined
  textLoading: boolean
}) {
  if (entry === undefined) {
    return <div style={styles.previewPanel} data-dsh-file-preview-empty><strong>选择一个文件</strong><span style={styles.emptyBody}>单击目录中的文件即可在这里预览，双击或按 Enter 打开。</span></div>
  }
  const isText = entry.kind === 'text' || entry.kind === 'document'
  const canMedia = previewUrl !== undefined && (entry.kind === 'image' || entry.kind === 'pdf')
  const size = formatBytes(entry.size)
  return (
    <section style={styles.previewPanel} aria-label={`Preview ${entry.name}`} data-dsh-file-preview>
      <header style={styles.previewHeader}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.previewTitle} title={entry.name}>{entry.name}</div>
          <div style={styles.meta}>{[kindLabel(entry.kind), entry.mediaType, size].filter((part): part is string => part !== undefined).join(' · ')}</div>
        </div>
        <div style={styles.previewActions}>
          {onOpenEntry !== undefined && <button type="button" style={styles.previewButton} onClick={() => onOpenEntry(entry)}>打开</button>}
          {previewUrl !== undefined && entry.capabilities.includes('download') && <a href={previewUrl} download={entry.name} style={styles.previewButton}>下载</a>}
        </div>
      </header>
      <div style={styles.previewBody}>
        {entry.kind === 'directory' && <span>展开目录查看文件。</span>}
        {canMedia && entry.kind === 'image' && <img style={styles.previewImage} src={previewUrl} alt={entry.name} />}
        {canMedia && entry.kind === 'pdf' && <iframe style={styles.previewFrame} src={previewUrl} title={entry.name} sandbox="allow-same-origin" referrerPolicy="no-referrer" />}
        {isText && textLoading && <span>正在读取文件…</span>}
        {isText && !textLoading && <pre style={styles.previewText} data-dsh-file-preview-text>{text ?? entry.summary ?? '等待文件服务提供预览。'}</pre>}
        {!isText && !canMedia && entry.kind !== 'directory' && <span>{previewUrl === undefined ? '等待文件服务提供预览授权。' : '此文件类型暂不支持内嵌预览。'}</span>}
      </div>
    </section>
  )
}

function TreeRow({
  node,
  depth,
  expandedIds,
  selectedId,
  resolvePreviewUrl,
  loadingIds,
  errorIds,
  onToggle,
  onRetry,
  onSelect,
  onOpenEntry,
  onPinEntry,
  compact,
}: {
  node: FileTreeNode
  depth: number
  expandedIds: ReadonlySet<string>
  selectedId: string | null
  resolvePreviewUrl: ((entry: FileEntryV1) => string | undefined) | undefined
  loadingIds: ReadonlySet<string>
  errorIds: ReadonlySet<string>
  onToggle: (entry: FileEntryV1) => void
  onRetry: (entry: FileEntryV1) => void
  onSelect: (entry: FileEntryV1) => void
  onOpenEntry: ((entry: FileEntryV1) => void) | undefined
  onPinEntry: ((entry: FileEntryV1) => void) | undefined
  compact: boolean
}) {
  const { entry, children } = node
  const isDirectory = entry.kind === 'directory'
  const expanded = isDirectory && expandedIds.has(entry.id)
  const selected = selectedId === entry.id
  const previewUrl = resolvePreviewUrl?.(entry)
  const loading = isDirectory && loadingIds.has(entry.id)
  const failed = isDirectory && errorIds.has(entry.id)

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(entry)
      if (!isDirectory) onOpenEntry?.(entry)
      return
    }
    if (!isDirectory) return
    if (event.key === 'ArrowRight' && !expanded) {
      event.preventDefault()
      onToggle(entry)
    } else if (event.key === 'ArrowLeft' && expanded) {
      event.preventDefault()
      onToggle(entry)
    }
  }

  let toggle: ReactNode = null
  if (isDirectory) {
    toggle = (
      <button
        type="button"
        style={styles.toggle}
        data-dsh-file-tree-toggle
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${entry.name}`}
        aria-expanded={expanded}
        onClick={event => {
          event.stopPropagation()
          onToggle(entry)
        }}
      >
        {loading ? <span aria-label="Loading">…</span> : <ChevronIcon direction={expanded ? 'down' : 'right'} />}
      </button>
    )
  } else {
    toggle = <span style={styles.icon} role="img" aria-label={kindLabel(entry.kind)}><FileKindIcon kind={entry.kind} /></span>
  }

  return (
    <>
      <div
        role="treeitem"
        aria-selected={selected}
        aria-expanded={isDirectory ? expanded : undefined}
        tabIndex={0}
        style={{ ...styles.row, ...(selected ? styles.selected : {}), paddingLeft: 8 + depth * 14 }}
        data-dsh-file-tree-row
        data-file-entry-kind={entry.kind}
        onClick={() => {
          onSelect(entry)
          if (!isDirectory) onOpenEntry?.(entry)
        }}
        onDoubleClick={() => { if (!isDirectory) (onPinEntry ?? onOpenEntry)?.(entry) }}
        onKeyDown={handleRowKeyDown}
      >
        <div style={styles.rowContent}>
          {toggle}
          {isDirectory && <span style={styles.icon} role="img" aria-label={kindLabel(entry.kind)}><FileKindIcon kind={entry.kind} /></span>}
          <strong style={styles.name} title={entry.name}>{entry.name}</strong>
          {!compact && !isDirectory && onOpenEntry !== undefined && (
            <button
              type="button"
              style={styles.openButton}
              data-dsh-file-open-button
              onClick={event => {
                event.stopPropagation()
                onOpenEntry(entry)
              }}
            >
              打开
            </button>
          )}
        </div>
        {!compact && !isDirectory && <Preview entry={entry} previewUrl={previewUrl} />}
        {!compact && isDirectory && entry.summary !== undefined && <div style={styles.meta}>{entry.summary}</div>}
      </div>
      {isDirectory && loading && <div style={styles.loading}>正在加载目录…</div>}
      {isDirectory && failed && (
        <div style={styles.error}>
          <span>目录加载失败。</span>
          <button type="button" data-dsh-file-retry style={styles.openButton} onClick={() => onRetry(entry)}>重试</button>
        </div>
      )}
      {isDirectory && expanded && (
        <div role="group">
          {children.map(child => (
            <TreeRow
              key={child.entry.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              resolvePreviewUrl={resolvePreviewUrl}
              loadingIds={loadingIds}
              errorIds={errorIds}
              onToggle={onToggle}
              onRetry={onRetry}
              onSelect={onSelect}
              onOpenEntry={onOpenEntry}
              onPinEntry={onPinEntry}
              compact={compact}
            />
          ))}
        </div>
      )}
    </>
  )
}

/** File/Document panel backed by safe file-entry projections. */
export function FileDocumentPanel({ tabId, entries = [], resolvePreviewUrl, onOpenEntry, onPinEntry, loadChildren, loading = false, error, onRetry, loadText, showPreviewPanel = true, compact = false }: FileDocumentPanelProps) {
  const visible = useMemo(() => {
    if (tabId === 'documents') {
      return entries.filter(entry => entry.kind === 'document' || entry.kind === 'pdf' || entry.kind === 'text' || entry.kind === 'directory')
    }
    return entries
  }, [entries, tabId])
  const tree = useMemo(() => buildFileTree(visible), [visible])
  const [uiState, setUiState] = useState(initialFileTreeUiState)
  const path = useMemo(() => fileTreePathOf(visible, uiState.selectedId), [visible, uiState.selectedId])
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(() => new Set())
  const [errorIds, setErrorIds] = useState<ReadonlySet<string>>(() => new Set())

  const loadDirectory = (entry: FileEntryV1): void => {
    if (loadChildren === undefined) return
    setLoadingIds(previous => new Set(previous).add(entry.id))
    setErrorIds(previous => {
      const next = new Set(previous)
      next.delete(entry.id)
      return next
    })
    void loadChildren(entry).then(
      () => {
        setLoadingIds(previous => {
          const next = new Set(previous)
          next.delete(entry.id)
          return next
        })
        setErrorIds(previous => {
          const next = new Set(previous)
          next.delete(entry.id)
          return next
        })
      },
      () => {
        setLoadingIds(previous => {
          const next = new Set(previous)
          next.delete(entry.id)
          return next
        })
        setErrorIds(previous => new Set(previous).add(entry.id))
      },
    )
  }

  const toggle = (entry: FileEntryV1): void => {
    const willExpand = !uiState.expandedIds.has(entry.id)
    const hasLoadedChildren = entries.some(item => item.parentId === entry.id)
    if (willExpand && entry.kind === 'directory' && loadChildren !== undefined && !hasLoadedChildren && !loadingIds.has(entry.id)) {
      loadDirectory(entry)
    }
    setUiState(state => toggleFileTreeDirectory(state, entry.id))
  }

  const retry = (entry: FileEntryV1): void => {
    setUiState(state => ({ ...state, expandedIds: new Set(state.expandedIds).add(entry.id) }))
    loadDirectory(entry)
  }

  const select = (entry: FileEntryV1): void => {
    setUiState(state => selectFileTreeEntry(state, entry.id))
  }
  const selectedEntry = uiState.selectedId === null ? undefined : visible.find(entry => entry.id === uiState.selectedId)
  const selectedPreviewUrl = selectedEntry === undefined ? undefined : resolvePreviewUrl?.(selectedEntry)
  const [textById, setTextById] = useState<Record<string, string>>({})
  const [textLoadingId, setTextLoadingId] = useState<string>()
  useEffect(() => {
    if (selectedEntry === undefined || loadText === undefined) return
    if (selectedEntry.kind !== 'text' && selectedEntry.kind !== 'document') return
    if (textById[selectedEntry.id] !== undefined) return
    const id = selectedEntry.id
    setTextLoadingId(id)
    void loadText(selectedEntry).then(next => {
      setTextById(previous => ({ ...previous, [id]: next ?? '' }))
      setTextLoadingId(current => current === id ? undefined : current)
    }, () => {
      setTextById(previous => ({ ...previous, [id]: previous[id] ?? '' }))
      setTextLoadingId(current => current === id ? undefined : current)
    })
  }, [selectedEntry, loadText, textById])

  return (
    <Surface kind="navigator" aria-label={tabId} data-dsh-file-document-panel data-compact={compact ? 'true' : undefined} style={compact ? { ...styles.root, gap: 8, maxWidth: 'none', margin: 0 } : styles.root}>
      <style data-dsh-file-document-styles>{panelStyles}</style>
      <SurfaceContextBar title={compact ? (tabId === 'files' ? '文件' : '文档') : (tabId === 'files' ? '文件浏览器' : '文档预览')} description={compact ? undefined : (tabId === 'files' ? '浏览当前工作区中的目录和文件。' : '查看可预览的文本、图片与 PDF。')} status={<span style={styles.count}>{visible.length} 项</span>} />
      {loading
        ? <SurfaceState phase="loading" title="正在加载文件" description="正在读取当前工作区的目录结构…" data-dsh-file-empty />
        : error !== undefined
          ? <SurfaceState phase="error" title="文件加载失败" description={error} action={onRetry === undefined ? undefined : <Button type="button" size="sm" variant="toolbar" data-dsh-file-retry onClick={onRetry}>重试</Button>} data-dsh-file-empty />
          : tree.length === 0
        ? <SurfaceState phase="empty" title={tabId === 'files' ? '文件源尚未连接' : '还没有可预览的文档'} description={tabId === 'files' ? '连接工作区文件服务后，目录会自动显示在这里。' : '选择可预览的文本、图片或 PDF 后，内容会显示在这里。'} data-dsh-file-empty />
          : (
            <>
              {path.length > 1 && (
                <nav aria-label="选定路径" style={styles.breadcrumb} data-dsh-file-breadcrumb>
                  {path.map((item, index) => (
                    <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                      {index > 0 && <span aria-hidden="true">/</span>}
                      {index === path.length - 1
                        ? <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--vk-text-secondary)' }}>{item.name}</strong>
                        : <button
                            type="button"
                            style={styles.breadcrumbItem}
                            onClick={() => setUiState(previous => ({ ...previous, selectedId: item.id }))}
                            aria-label={`定位到 ${item.name}`}
                          >{item.name}</button>}
                    </span>
                  ))}
                </nav>
              )}
              <div style={styles.tree} role="tree" aria-label={tabId === 'files' ? 'Files' : 'Documents'} data-dsh-file-tree>
                {tree.map(node => (
                  <TreeRow
                    key={node.entry.id}
                    node={node}
                    depth={0}
                    expandedIds={uiState.expandedIds}
                    selectedId={uiState.selectedId}
                    resolvePreviewUrl={resolvePreviewUrl}
                    loadingIds={loadingIds}
                    errorIds={errorIds}
                    onToggle={toggle}
                    onRetry={retry}
                    onSelect={select}
                    onOpenEntry={onOpenEntry}
                    onPinEntry={onPinEntry}
                    compact={compact}
                  />
                ))}
              </div>
              {showPreviewPanel === false ? null : (
                <ResourcePreview
                  entry={selectedEntry}
                  previewUrl={selectedPreviewUrl}
                  onOpenEntry={onOpenEntry}
                  text={selectedEntry === undefined ? undefined : textById[selectedEntry.id]}
                  textLoading={selectedEntry !== undefined && textLoadingId === selectedEntry.id}
                />
              )}
            </>
          )}
    </Surface>
  )
}

export default FileDocumentPanel

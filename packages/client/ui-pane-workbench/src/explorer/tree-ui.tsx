import { createElement, useEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Button, Input, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { WorkbenchIcon, type WorkbenchIconName } from '../icon.js'
import { t } from '../i18n/locale.js'
import type { PaneLocalViewProps } from '../view-registry.js'
import { windowVirtualRows } from '../virtual-window.js'
import { EXPLORER_STYLES } from './styles.js'
import type { ExplorerOpenAdapterV1 } from './open-adapter.js'
import { getExplorerRuntime, subscribeExplorerRuntime, type ExplorerMetadataV1, type ExplorerMutationProposalV1, type ExplorerRuntimeSourceV1, type ExplorerRuntimeV2 } from './runtime.js'
import { createExplorerWatchController } from './explorer-watch.js'
import {
  createExplorerTreeState,
  explorerRowHeight,
  flattenExplorerTree,
  moveExplorerFocus,
  reduceExplorerTree,
  type ExplorerTreeNodeV1,
  type ExplorerTreeRowV1,
  type ExplorerTreeStateV1,
} from './tree-state.js'

/** 3.4 窄屏判定：<560px 视口进入窄屏内容流（SSR/无 matchMedia 时按宽屏）。 */
export const EXPLORER_NARROW_VIEWPORT_PX = 560

export function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const view = typeof window === 'undefined' ? undefined : window
    if (view?.matchMedia === undefined) return
    const query = view.matchMedia(`(max-width: ${EXPLORER_NARROW_VIEWPORT_PX - 1}px)`)
    setNarrow(query.matches)
    const listener = (event: MediaQueryListEvent): void => { setNarrow(event.matches) }
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  return narrow
}

export interface ExplorerTreeUiProps {
  readonly state: ExplorerTreeStateV1
  /** 窄屏内容流：内容页替换 navigator，返回时恢复焦点（宽屏保持锁定 navigator）。 */
  readonly narrow?: boolean
  readonly pointer?: 'fine' | 'coarse'
  readonly viewportHeight?: number
  readonly scrollTop?: number
  readonly breadcrumb?: readonly { readonly ref: string; readonly name: string }[]
  readonly adapter?: ExplorerOpenAdapterV1
  readonly gitMutationDisabled?: boolean
  readonly gitMutationReason?: string
  readonly onIntent?: (state: ExplorerTreeStateV1) => void
  readonly runtime?: ExplorerRuntimeV2
}

/**
 * Presentation-only extension → icon hints (file-preview-dispatch). The glyph
 * never gates preview or renderer choice — owner inspect/classify stays the
 * authority; unknown extensions fall back to the generic file glyph.
 */
const FILE_ICON_EXTENSIONS: Readonly<Record<string, WorkbenchIconName>> = Object.freeze({
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image', avif: 'image', ico: 'image', svg: 'image',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio', aac: 'audio', opus: 'audio', aif: 'audio', aiff: 'audio', wma: 'audio', mid: 'audio', midi: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', mkv: 'video', avi: 'video', flv: 'video', m4v: 'video', mts: 'video', m2ts: 'video', '3gp': 'video', ogm: 'video',
  pdf: 'pdf',
  zip: 'archive', jar: 'archive', tar: 'archive', gz: 'archive', tgz: 'archive', bz2: 'archive', xz: 'archive', '7z': 'archive', rar: 'archive',
  ts: 'code', tsx: 'code', js: 'code', mjs: 'code', cjs: 'code', jsx: 'code', py: 'code', go: 'code', rs: 'code', java: 'code',
  c: 'code', cpp: 'code', h: 'code', sh: 'code', bash: 'code', zsh: 'code', sql: 'code', css: 'code', scss: 'code', html: 'code',
  htm: 'code', xml: 'code', json: 'code', yaml: 'code', yml: 'code', toml: 'code',
  md: 'document', markdown: 'document', mdx: 'document', txt: 'document', log: 'document',
  csv: 'document', tsv: 'document', docx: 'document', xlsx: 'document', xlsm: 'document', pptx: 'document', odt: 'document', ods: 'document',
})

export function explorerFileIconOf(name: string): WorkbenchIconName {
  const dot = name.lastIndexOf('.')
  const extension = dot <= 0 ? undefined : name.slice(dot + 1).toLowerCase()
  return extension === undefined ? 'file' : FILE_ICON_EXTENSIONS[extension] ?? 'file'
}

function iconForRow(row: ExplorerTreeRowV1): WorkbenchIconName {
  if (row.node.kind === 'directory') return 'folder'
  if (row.node.gitDecoration === 'conflict') return 'git-branch'
  return explorerFileIconOf(row.node.name)
}

function decorationLabel(kind: string | undefined): string | undefined {
  if (kind === undefined) return undefined
  return kind
}

export function ExplorerTree(props: ExplorerTreeUiProps): ReactNode {
  const pointer = props.pointer ?? 'fine'
  const rowHeight = explorerRowHeight(pointer)
  const rows = useMemo(() => flattenExplorerTree(props.state), [props.state])
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(props.viewportHeight ?? 560)
  const windowed = windowVirtualRows(rows, props.scrollTop ?? scrollTop, props.viewportHeight ?? viewportHeight, rowHeight)
  const latest = useRef(props.state)
  latest.current = props.state
  const runtimeRef = useRef(props.runtime)
  runtimeRef.current = props.runtime
  const emit = (next: ExplorerTreeStateV1): void => { latest.current = next; props.onIntent?.(next) }

  // dsh-explorer-live-watch：活度徽标 + 用户显式刷新（视图级权威重读，走
  // reconcile_apply 语义保留展开/选择/焦点/滚动锚点；ondemand 模式同样可用）。
  const watchLive = props.runtime?.fileWatch !== undefined
  const [refreshing, setRefreshing] = useState(false)
  const refresh = (): void => {
    const runtime = props.runtime
    if (runtime === undefined || refreshing) return
    setRefreshing(true)
    const start = latest.current
    const expanded = [...start.expandedRefs]
    void Promise.all([runtime.roots(), Promise.all(expanded.map(ref => runtime.listChildren(ref)))])
      .then(([roots, childLists]) => {
        const childrenByRef: Record<string, readonly ExplorerTreeNodeV1[]> = {}
        expanded.forEach((ref, index) => { childrenByRef[ref] = childLists[index] ?? [] })
        emit(reduceExplorerTree(latest.current, { type: 'reconcile_apply', roots, childrenByRef }))
      })
      .catch(() => { /* 重读失败保持现状；行级错误由既有 errors 面呈现 */ })
      .finally(() => { setRefreshing(false) })
  }
  const focused = props.state.focusedRef === undefined
    ? undefined
    : rows.find(row => row.ref === props.state.focusedRef)
  const [pendingRefs, setPendingRefs] = useState<readonly string[]>([])
  const [metadata, setMetadata] = useState<Readonly<Record<string, ExplorerMetadataV1>>>({})
  const [draftAction, setDraftAction] = useState<ExplorerMutationProposalV1['action']>()
  const [draftName, setDraftName] = useState('')
  const [proposal, setProposal] = useState<ExplorerMutationProposalV1>()
  const [mutationStatus, setMutationStatus] = useState<string>()
  const [lastUndo, setLastUndo] = useState<(() => Promise<{ readonly ok: boolean; readonly reason?: string }>)>()
  const [dangerPhrase, setDangerPhrase] = useState('')
  const [draggedRefs, setDraggedRefs] = useState<readonly string[]>([])
  const [menuRow, setMenuRow] = useState<ExplorerTreeRowV1>()
  const requestGeneration = useRef(0)
  const proposalGeneration = useRef<number | undefined>(undefined)
  const executingGeneration = useRef<number | undefined>(undefined)
  const [proposalPending, setProposalPending] = useState(false)
  const proposalRef = useRef<HTMLDivElement>(null)
  const invalidateProposal = (): void => {
    requestGeneration.current += 1
    proposalGeneration.current = undefined
    executingGeneration.current = undefined
    setProposal(undefined); setProposalPending(false); setMutationStatus(undefined)
  }
  const actionContext = useRef<{ row: ExplorerTreeRowV1; runtime: ExplorerRuntimeV2 | undefined } | undefined>(undefined)
  const menuRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDetailsElement>(null)
  const restoreFocus = (): void => {
    const origin = actionContext.current?.row
    const visible = flattenExplorerTree(latest.current)
    const ref = [origin?.ref, origin?.node.parentRef, latest.current.focusedRef].find(ref => visible.some(row => row.ref === ref)) ?? visible[0]?.ref
    emit(reduceExplorerTree(latest.current, { type: 'focus', ref }))
    requestAnimationFrame(() => { treeRef.current?.focus() })
  }
  const closeMenu = (): void => { invalidateProposal(); setMenuRow(undefined); setDraftAction(undefined); setDraftName(''); restoreFocus(); actionContext.current = undefined }
  const showMenu = (row: ExplorerTreeRowV1): void => {
    invalidateProposal(); setDraftAction(undefined); setDraftName('')
    actionContext.current = { row, runtime: props.runtime }
    emit(reduceExplorerTree(latest.current, { type: 'focus', ref: row.ref }))
    setMenuRow(row)
  }
  useEffect(() => {
    if (menuRow !== undefined) menuRef.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not(:disabled)')?.focus()
  }, [menuRow])
  useEffect(() => {
    invalidateProposal()
    setMenuRow(undefined); actionContext.current = undefined
    setDraftAction(undefined); setProposal(undefined); setLastUndo(undefined)
    return () => { requestGeneration.current += 1 }
  }, [props.runtime])
  useEffect(() => {
    if (proposal !== undefined) proposalRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [proposal])
  const hoverTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const treeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = treeRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const measure = () => { if (element.clientHeight > 0) setViewportHeight(element.clientHeight) }
    const observer = new ResizeObserver(measure)
    observer.observe(element); measure()
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const element = treeRef.current
    const index = rows.findIndex(row => row.ref === props.state.focusedRef)
    if (!element || index < 0) return
    const top = index * rowHeight
    if (top < element.scrollTop) element.scrollTop = top
    else if (top + rowHeight > element.scrollTop + viewportHeight) element.scrollTop = top + rowHeight - viewportHeight
    setScrollTop(element.scrollTop)
  }, [props.state.focusedRef, rowHeight, viewportHeight])
  const loadChildren = (ref: string): void => {
    if (!props.runtime || latest.current.loadingRefs.includes(ref)) return
    const runtime = props.runtime
    emit(reduceExplorerTree(latest.current, { type: 'children_loading', ref }))
    void runtime.listChildren(ref)
      .then(nodes => { if (runtimeRef.current === runtime) emit(reduceExplorerTree(latest.current, { type: 'children_ready', ref, nodes })) })
      .catch(error => { if (runtimeRef.current === runtime) emit(reduceExplorerTree(latest.current, { type: 'children_error', ref, reason: error instanceof Error ? error.message : 'Failed to load directory' })) })
  }
  const toggleDirectory = (row: ExplorerTreeRowV1): void => {
    emit(reduceExplorerTree(latest.current, { type: row.expanded ? 'collapse' : 'expand', ref: row.ref }))
    if (!row.expanded && latest.current.children[row.ref] === undefined) loadChildren(row.ref)
  }
  const open = (row: ExplorerTreeRowV1, mode: 'preview' | 'pin'): void => {
    if (row.node.kind === 'directory') return
    if (row.node.availability?.preview !== undefined && row.node.availability.preview !== 'available') return
    let action
    try {
      action = props.runtime?.openResource(row.node, mode) ?? props.adapter?.openResource(row.node, mode)
    } catch (error) {
      setMutationStatus(error instanceof Error ? error.message : 'Unable to open file')
      return
    }
    if (action === undefined) return
    setPendingRefs(current => current.includes(row.ref) ? current : [...current, row.ref])
    void Promise.resolve(action).then(result => {
      if (result.ok && props.narrow === true) emit(reduceExplorerTree(latest.current, { type: 'narrow_content', ref: row.ref }))
      if (!result.ok) setMetadata(current => ({ ...current, [row.ref]: { ref: row.ref, version: row.node.version, state: 'unsupported', label: row.node.name, ...(result.reason === undefined ? {} : { detail: result.reason }) } }))
    }).catch(error => setMutationStatus(error instanceof Error ? error.message : 'Unable to open file'))
      .finally(() => setPendingRefs(current => current.filter(ref => ref !== row.ref)))
  }
  const addReference = (row: ExplorerTreeRowV1): void => {
    if (props.runtime?.addReference === undefined || row.node.sensitive === true) return
    setPendingRefs(current => current.includes(row.ref) ? current : [...current, row.ref])
    void props.runtime.addReference(row.node).then(result => {
      setMutationStatus(result.ok ? `已添加引用：${row.node.name}` : result.reason ?? '引用不可用')
    }).catch(error => setMutationStatus(error instanceof Error ? error.message : '引用不可用'))
      .finally(() => setPendingRefs(current => current.filter(ref => ref !== row.ref)))
  }
  const inspect = (row: ExplorerTreeRowV1, delay = 350): void => {
    if (props.runtime?.inspectMetadata === undefined || row.node.kind === 'directory') return
    const existing = hoverTimers.current.get(row.ref)
    if (existing !== undefined) clearTimeout(existing)
    const timer = setTimeout(() => {
      setPendingRefs(current => current.includes(row.ref) ? current : [...current, row.ref])
      void props.runtime?.inspectMetadata?.(row.node).then(result => setMetadata(current => ({ ...current, [row.ref]: result }))).catch(error => setMetadata(current => ({ ...current, [row.ref]: { ref: row.ref, version: row.node.version, state: 'unsupported', label: row.node.name, detail: error instanceof Error ? error.message : 'metadata unavailable' } }))).finally(() => setPendingRefs(current => current.filter(ref => ref !== row.ref)))
    }, delay)
    hoverTimers.current.set(row.ref, timer)
  }
  const cancelInspect = (ref: string): void => {
    const timer = hoverTimers.current.get(ref)
    if (timer !== undefined) clearTimeout(timer)
    hoverTimers.current.delete(ref)
  }
  useEffect(() => {
    if (focused !== undefined) inspect(focused)
    return () => { if (focused !== undefined) cancelInspect(focused.ref) }
  }, [focused?.ref, props.runtime])
  const selectedNode = props.state.selectedRef === undefined ? undefined : props.state.nodes[props.state.selectedRef]
  const targetRefs = props.state.checkedRefs.length > 0 ? props.state.checkedRefs : props.state.selectedRef === undefined ? [] : [props.state.selectedRef]
  const beginProposal = (action: ExplorerMutationProposalV1['action'], importRef?: string, importName?: string, destinationOverride?: string): void => {
    if (props.runtime?.mutation === undefined || !props.runtime.mutation.enabled) return
    const context = actionContext.current
    if (context !== undefined && (context.runtime !== props.runtime || latest.current.nodes[context.row.ref] === undefined)) { setMutationStatus('Resource context changed'); restoreFocus(); return }
    invalidateProposal()
    const generation = requestGeneration.current
    const runtime = props.runtime
    const isCurrent = (): boolean => runtimeRef.current === runtime && requestGeneration.current === generation
    const actionNode = context?.row.node ?? selectedNode
    const needsDestination = action === 'create-file' || action === 'create-directory' || action === 'move' || action === 'copy' || action === 'import-commit'
    const destinationRef = needsDestination ? (destinationOverride ?? (actionNode?.kind === 'directory' ? actionNode.ref : props.runtime.getRootRef?.())) : undefined
    const targets = action === 'create-file' || action === 'create-directory' || action === 'import-commit' ? undefined : context !== undefined ? [context.row.ref] : draggedRefs.length > 0 ? draggedRefs : targetRefs
    setProposalPending(true); setMutationStatus('正在预检…')
    void props.runtime.mutation.propose({ action, ...(targets === undefined ? {} : { targetRefs: targets }), ...(destinationRef === undefined ? {} : { destinationRef }), ...((importName ?? draftName) === '' ? {} : { name: importName ?? draftName }), ...(importRef === undefined ? {} : { importRef }) })
      .then(next => { if (!isCurrent()) return; proposalGeneration.current = generation; setProposalPending(false); setProposal(next); setMutationStatus(undefined); setDangerPhrase('') })
      .catch(error => { if (!isCurrent()) return; setProposalPending(false); setMutationStatus(error instanceof Error ? error.message : '预检失败'); restoreFocus() })
  }
  const executeProposal = (choice?: 'keep-both' | 'replace'): void => {
    const generation = proposalGeneration.current
    if (proposal === undefined || generation === undefined || generation !== requestGeneration.current || executingGeneration.current === generation) return
    const runtime = props.runtime
    if (actionContext.current !== undefined && actionContext.current.runtime !== runtime) return
    const isCurrent = (): boolean => runtimeRef.current === runtime && requestGeneration.current === generation
    executingGeneration.current = generation
    setMutationStatus('正在执行…')
    void proposal.execute(choice).then(result => {
      if (!isCurrent()) return
      if (!result.ok) { setMutationStatus(result.reason ?? '操作被拒绝'); restoreFocus(); return }
      setLastUndo(result.undo === undefined ? undefined : () => result.undo)
      setProposal(undefined); setDraftAction(undefined); setDraftName(''); setMutationStatus('已完成')
      void runtime?.roots().then(nodes => { if (!isCurrent()) return; emit(reduceExplorerTree(latest.current, { type: 'hydrate_roots', nodes })); restoreFocus() }).catch(() => { if (isCurrent()) restoreFocus() })
    }).catch(error => { if (!isCurrent()) return; setMutationStatus(error instanceof Error ? error.message : '执行失败'); restoreFocus() })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const key = event.key
    if ((key === 'ContextMenu' || (key === 'F10' && event.shiftKey)) && event.target instanceof Element) {
      const ref = event.target.closest('[data-explorer-ref]')?.getAttribute('data-explorer-ref')
      const row = rows.find(row => row.ref === ref) ?? focused
      if (row !== undefined) { event.preventDefault(); showMenu(row); return }
    }
    if (key === 'ArrowDown') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'down')) }
    else if (key === 'ArrowUp') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'up')) }
    else if (key === 'Home') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'home')) }
    else if (key === 'End') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'end')) }
    else if (key === 'PageDown') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'pageDown')) }
    else if (key === 'PageUp') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'pageUp')) }
    else if (key === 'ArrowRight' && focused?.node.hasChildren && !focused.expanded) {
      event.preventDefault()
      toggleDirectory(focused)
    } else if (key === 'ArrowLeft' && focused?.expanded) {
      event.preventDefault()
      emit(reduceExplorerTree(props.state, { type: 'collapse', ref: focused.ref }))
    } else if ((key === 'Enter' || key === ' ') && focused !== undefined) {
      event.preventDefault()
      emit(reduceExplorerTree(props.state, { type: 'select', ref: focused.ref }))
      if (focused.node.kind === 'directory') {
        toggleDirectory(focused)
      } else open(focused, key === 'Enter' ? 'pin' : 'preview')
    } else if (((key === 'F10' && event.shiftKey) || key === 'ContextMenu') && focused !== undefined) {
      event.preventDefault()
      showMenu(focused)
    }
  }

  const menuReason = props.runtime?.mutation?.enabled !== true ? props.runtime?.mutation?.disabledReason ?? 'File operations unavailable'
    : props.state.freshness !== 'fresh' || menuRow?.node.freshness !== 'fresh' ? 'Refresh required before file operations'
    : menuRow.node.availability?.mutate !== 'available' ? menuRow.node.availability?.reason ?? 'File operation permission unavailable' : undefined
  const menuActions = [
    { id: 'create-file', label: '新建文件', directory: true },
    { id: 'create-directory', label: '新建目录', directory: true },
    { id: 'rename', label: '重命名' },
    { id: 'trash', label: '移到废纸篓' },
  ] as const
  return createElement(Surface, { kind: 'navigator', className: 'pwr-explorer', 'data-explorer-tree': 'true' },
    menuRow === undefined ? null : createElement('div', { className: 'pwr-explorer-context-menu', ref: menuRef,
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)') ?? [])
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation()
          items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus()
        } else if (event.key === 'Tab') { closeMenu() }
      },
    }, createElement(Menu, { open: true, anchor: null, compact: true, onClose: closeMenu,
      items: [{ type: 'label', id: 'resource', text: menuRow.node.name }, ...menuActions.map(action => {
        const reason = menuReason ?? ('directory' in action && menuRow.node.kind !== 'directory' ? 'Select a directory' : undefined)
        return { id: action.id, disabled: reason !== undefined, danger: action.id === 'trash', label: createElement('span', { title: reason }, action.label, reason === undefined ? null : createElement('small', null, reason)) }
      }), { id: 'cancel', label: '取消' }],
      onSelect: id => {
        if (id === 'cancel') { closeMenu(); return }
        if (menuReason !== undefined) return
        setMenuRow(undefined)
        if (id === 'trash') beginProposal('trash')
        else { if (actionsRef.current !== null) actionsRef.current.open = true; setDraftAction(id as ExplorerMutationProposalV1['action']); requestAnimationFrame(() => actionsRef.current?.querySelector<HTMLInputElement>('.pwr-explorer-action-draft input')?.focus()) }
      },
    })),
    createElement('style', null, EXPLORER_STYLES),
    createElement(SurfaceContextBar, {
      className: 'pwr-explorer-header',
      title: props.breadcrumb?.at(-1)?.name ?? t('explorer.root'),
      actions: createElement('span', { className: 'pwr-explorer-header-actions' },
        createElement('span', {
          className: 'pwr-explorer-watch-pill',
          'data-file-watch': watchLive ? 'live' : 'ondemand',
          'data-freshness': props.state.freshness,
          role: 'status',
          'aria-label': watchLive ? '目录树实时监听中' : '目录树按需刷新',
          title: watchLive ? 'owner watch 在线：外部改动自动刷新' : '按需刷新：点击「刷新」重读工作区',
        }, watchLive ? 'live' : '手动'),
        createElement(Button, {
          type: 'button',
          size: 'sm',
          variant: 'toolbar',
          className: 'pwr-explorer-refresh',
          'aria-label': '刷新目录树',
          title: '重读工作区根目录与已展开目录（保留展开、选择与焦点）',
          disabled: props.runtime === undefined || refreshing,
          onClick: () => { refresh() },
        }, refreshing ? '刷新中…' : '刷新'),
        createElement(Input, {
          className: 'pwr-explorer-filter',
          'aria-label': t('explorer.search'),
          placeholder: t('explorer.search'),
          value: props.state.filter,
          onChange: event => emit(reduceExplorerTree(props.state, { type: 'filter', query: event.currentTarget.value })),
        }),
      ),
    }),
    props.state.errors.search ? createElement(SurfaceState, { phase: 'error', title: props.state.errors.search }) : null,
    props.runtime?.mutation === undefined ? null : createElement('details', { onClickCapture: (event: { target: EventTarget }) => { if (event.target instanceof Element && !event.target.closest('.pwr-explorer-action-draft')) { invalidateProposal(); actionContext.current = undefined } }, ref: actionsRef, className: 'pwr-explorer-resource-actions', 'data-explorer-resource-actions': true },
      createElement('summary', null, t('explorer.fileActions')),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: selectedNode?.kind !== 'directory' && props.runtime.getRootRef?.() === undefined, onClick: () => setDraftAction('create-file') }, '新建文件'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: selectedNode?.kind !== 'directory' && props.runtime.getRootRef?.() === undefined, onClick: () => setDraftAction('create-directory') }, '新建目录'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: props.state.selectedRef === undefined, onClick: () => setDraftAction('rename') }, '重命名'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: targetRefs.length === 0 || selectedNode?.kind !== 'directory', onClick: () => beginProposal('move') }, '移动到此处'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: targetRefs.length === 0 || selectedNode?.kind !== 'directory', onClick: () => beginProposal('copy') }, '复制到此处'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: targetRefs.length === 0, onClick: () => beginProposal('trash') }, '移到废纸篓'),
      createElement('label', { className: 'pwr-explorer-import' }, '导入', createElement('input', { type: 'file', hidden: true, disabled: (selectedNode?.kind !== 'directory' && props.runtime.getRootRef?.() === undefined) || props.runtime.transfer?.enabled !== true, onChange: (event: { currentTarget: HTMLInputElement }) => { const file = event.currentTarget.files?.[0]; if (file === undefined || props.runtime?.transfer === undefined) return; setMutationStatus('正在上传…'); void props.runtime.transfer.importFile(file).then(uploaded => beginProposal('import-commit', uploaded.importRef, uploaded.name)).catch(error => setMutationStatus(error instanceof Error ? error.message : '上传失败')) } })),
      selectedNode?.kind === 'file' && selectedNode.availability?.download === 'available' && props.runtime.transfer?.enabled === true ? createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => { setMutationStatus('正在下载…'); void props.runtime?.transfer?.download(selectedNode.ref, selectedNode.version).then(() => setMutationStatus('下载已授权')).catch(error => setMutationStatus(error instanceof Error ? error.message : '下载失败')) } }, '下载') : null,
      lastUndo === undefined ? null : createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => { void lastUndo().then(result => { setMutationStatus(result.ok ? '已撤销' : result.reason ?? '撤销失败'); if (result.ok) setLastUndo(undefined) }) } }, '撤销'),
      draftAction === undefined ? null : createElement('div', { className: 'pwr-explorer-action-draft', onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === 'Escape') { closeMenu() } } },
        createElement(Input, { value: draftName, 'aria-label': '资源名称', placeholder: draftAction === 'rename' ? selectedNode?.name ?? '新名称' : '名称', onChange: event => setDraftName(event.currentTarget.value) }),
        createElement(Button, { type: 'button', size: 'sm', variant: 'primary', disabled: draftName.trim() === '', onClick: () => beginProposal(draftAction) }, '预检'),
        createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => { closeMenu() } }, '取消'),
      ),
    ),
    mutationStatus === undefined ? null : createElement('span', { role: 'status', className: 'pwr-explorer-action-status', onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => { if (event.key === 'Escape' && proposalPending) closeMenu() } }, mutationStatus, proposalPending ? createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', autoFocus: true, onClick: closeMenu }, '取消') : null),
    proposal === undefined ? null : createElement('div', { ref: proposalRef, className: 'pwr-explorer-proposal', onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === 'Escape') { closeMenu() } }, role: proposal.conflicts.length > 0 ? 'dialog' : 'region', 'aria-label': '文件操作预览' },
      createElement('strong', null, proposal.summary),
      proposal.risks.length === 0 ? null : createElement('span', null, `风险：${proposal.risks.join('、')}`),
      proposal.conflicts.length === 0
        ? createElement(Button, { type: 'button', size: 'sm', variant: 'primary', onClick: () => executeProposal() }, '确认执行')
        : createElement('div', null,
          createElement('span', null, `同名冲突：${proposal.conflicts.join('、')}`),
          createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => executeProposal('keep-both') }, '保留两份'),
          createElement(Input, { value: dangerPhrase, 'aria-label': '输入目标名称确认替换', placeholder: proposal.conflicts[0], onChange: event => setDangerPhrase(event.currentTarget.value) }),
          createElement(Button, { type: 'button', size: 'sm', variant: 'primary', disabled: dangerPhrase !== proposal.conflicts[0], onClick: () => executeProposal('replace') }, '替换'),
        ),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => { closeMenu() } }, '取消'),
    ),
    props.narrow === true && props.state.narrowReturnRef !== undefined
      ? createElement('div', { className: 'pwr-explorer-narrow-back', 'data-explorer-narrow-back': props.state.narrowReturnRef, role: 'region', 'aria-label': t('rail.explorer') },
        createElement(Button, {
          type: 'button', size: 'sm', variant: 'toolbar',
          onClick: () => {
            emit(reduceExplorerTree(props.state, { type: 'narrow_return' }))
            // 焦点恢复：回到树容器并聚焦来源行。
            requestAnimationFrame(() => { treeRef.current?.focus() })
          },
        }, t('explorer.backToExplorer')),
        createElement('span', { role: 'status' }, props.state.nodes[props.state.narrowReturnRef]?.name ?? ''),
      )
      : null,
    createElement('div', {
      className: 'pwr-explorer-tree ys-body',
      role: 'tree',
      tabIndex: 0,
      'aria-label': t('rail.explorer'),
      'aria-activedescendant': focused === undefined ? undefined : `explorer-row-${focused.ref}`,
      ref: treeRef,
      hidden: props.narrow === true && props.state.narrowReturnRef !== undefined,
      onKeyDown,
      onDragOver: (event: DragEvent<HTMLDivElement>) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() },
      onDrop: (event: DragEvent<HTMLDivElement>) => {
        if (event.dataTransfer.files.length === 0 || props.runtime?.transfer === undefined) return
        event.preventDefault()
        const destination = selectedNode?.kind === 'directory' ? selectedNode.ref : props.runtime.getRootRef?.()
        for (const file of Array.from(event.dataTransfer.files)) void props.runtime.transfer.importFile(file).then(uploaded => beginProposal('import-commit', uploaded.importRef, uploaded.name, destination)).catch(error => setMutationStatus(error instanceof Error ? error.message : '上传失败'))
      },
      onScroll: (event: { currentTarget: HTMLDivElement }) => setScrollTop(event.currentTarget.scrollTop),
      style: { ...(props.viewportHeight === undefined ? {} : { height: props.viewportHeight }), overflow: 'auto' },
    },
      createElement('div', { style: { height: windowed.height, position: 'relative' } },
        createElement('div', { style: { transform: `translateY(${windowed.offset}px)` } },
          ...windowed.items.map(row => createElement('div', {
            key: row.ref,
            id: `explorer-row-${row.ref}`,
            role: 'treeitem',
            'aria-expanded': row.node.hasChildren ? row.expanded : undefined,
            'aria-selected': row.selected,
            'aria-checked': row.checked,
            'aria-level': row.depth + 1,
            'data-explorer-ref': row.ref,
            'data-explorer-kind': row.node.kind,
            className: 'pwr-explorer-row ys-row',
            style: {
              height: rowHeight,
              minHeight: rowHeight,
              paddingInlineStart: 8 + row.depth * 16,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            },
            onClick: () => {
              let next = reduceExplorerTree(props.state, { type: 'select', ref: row.ref })
              if (row.node.hasChildren) {
                emit(next)
                toggleDirectory(row)
                return
              } else {
                next = reduceExplorerTree(next, { type: 'set_primary', ref: row.ref })
                open(row, 'preview')
              }
              emit(next)
            },
            onContextMenu: (event: { preventDefault(): void; stopPropagation(): void }) => { event.preventDefault(); event.stopPropagation(); showMenu(row) },
            onDoubleClick: () => {
              if (row.node.kind !== 'directory') open(row, 'pin')
            },
            draggable: row.node.availability?.mutate === 'available',
            onDragStart: (event: DragEvent<HTMLDivElement>) => { const refs = row.checked && props.state.checkedRefs.length > 0 ? props.state.checkedRefs : [row.ref]; setDraggedRefs(refs); event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('application/x-dsh-file-refs', refs.join(',')) },
            onDragEnd: () => setDraggedRefs([]),
            onDragOver: (event: DragEvent<HTMLDivElement>) => { if (row.node.kind === 'directory') event.preventDefault() },
            onDrop: (event: DragEvent<HTMLDivElement>) => { if (row.node.kind !== 'directory' || draggedRefs.length === 0) return; event.preventDefault(); event.stopPropagation(); beginProposal(event.ctrlKey || event.altKey ? 'copy' : 'move', undefined, undefined, row.ref); setDraggedRefs([]) },
            onMouseEnter: () => inspect(row),
            onMouseLeave: () => cancelInspect(row.ref),
            onFocus: () => inspect(row),
            onBlur: () => cancelInspect(row.ref),
          },
            row.node.hasChildren
              ? createElement('span', { 'aria-hidden': true, className: 'pwr-explorer-twistie' }, row.expanded ? '▾' : '▸')
              : createElement('span', { 'aria-hidden': true, className: 'pwr-explorer-twistie' }, ' '),
            createElement('input', { type: 'checkbox', checked: row.checked, 'aria-label': `选择 ${row.node.name}`, onChange: () => emit(reduceExplorerTree(props.state, { type: 'toggle_checked', ref: row.ref })), onClick: (event: { stopPropagation(): void }) => event.stopPropagation() }),
            createElement(WorkbenchIcon, { name: iconForRow(row), size: 14 }),
            createElement('span', { className: 'pwr-explorer-name' }, row.node.name),
            row.checked ? createElement('span', { className: 'pwr-explorer-checked', 'aria-label': 'checked' }, '✓') : null,
            row.primary ? createElement('span', { className: 'pwr-explorer-primary', 'aria-label': 'primary preview' }, '•') : null,
            decorationLabel(row.node.gitDecoration) === undefined
              ? null
              : createElement('span', { className: 'pwr-explorer-deco', 'data-git-decoration': row.node.gitDecoration }, row.node.gitDecoration),
            row.loading ? createElement('span', { className: 'pwr-explorer-loading' }, t('state.loading')) : null,
            row.error === undefined ? null : createElement(Button, {
              type: 'button',
              size: 'sm',
              variant: 'toolbar',
              className: 'pwr-explorer-retry',
              onClick: (event: { stopPropagation(): void }) => {
                event.stopPropagation()
                loadChildren(row.ref)
              },
            }, t('state.retry')),
            pendingRefs.includes(row.ref) ? createElement('span', { className: 'pwr-explorer-metadata-pending', role: 'status' }, '…') : null,
            pointer === 'coarse' && row.node.kind !== 'directory' ? createElement(Button, {
              type: 'button', size: 'sm', variant: 'toolbar', 'aria-label': `Info ${row.node.name}`,
              onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); inspect(row, 0) },
            }, 'ⓘ') : null,
            row.node.sensitive === true && props.runtime?.revealSensitive !== undefined ? createElement(Button, {
              type: 'button', size: 'sm', variant: 'toolbar', 'aria-label': `Reveal ${row.node.name}`,
              onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); setPendingRefs(current => [...new Set([...current, row.ref])]); void props.runtime?.revealSensitive?.(row.node).then(result => setMutationStatus(result.ok ? '敏感内容已临时授权' : result.reason ?? '授权失败')).finally(() => setPendingRefs(current => current.filter(ref => ref !== row.ref))) },
            }, '揭示') : null,
            props.runtime?.addReference === undefined || row.node.sensitive === true ? null : createElement(Button, {
              type: 'button', size: 'sm', variant: 'toolbar', className: 'pwr-explorer-reference', 'aria-label': `添加 ${row.node.name} 到当前对话引用`,
              onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); addReference(row) },
            }, '引用'),
          )),
        ),
      ),
    ),
    focused === undefined || metadata[focused.ref] === undefined ? null : createElement('div', {
      className: 'pwr-explorer-metadata-card', role: 'status', 'data-explorer-metadata-ref': focused.ref,
    }, createElement('strong', null, metadata[focused.ref]!.label), createElement('span', null, metadata[focused.ref]!.detail ?? metadata[focused.ref]!.state)),
    props.gitMutationDisabled === true
      ? createElement(SurfaceState, { className: 'pwr-explorer-git-offline', phase: 'disabled', title: props.gitMutationReason ?? t('state.offline') })
      : null,
  )
}

export function ExplorerTreeView(props: PaneLocalViewProps & { readonly runtimeSource?: ExplorerRuntimeSourceV1 }): ReactNode {
  const [state, setState] = useState(createExplorerTreeState)
  const runtime = useSyncExternalStore(
    props.runtimeSource?.subscribe ?? subscribeExplorerRuntime,
    props.runtimeSource?.getSnapshot ?? getExplorerRuntime,
    props.runtimeSource?.getSnapshot ?? getExplorerRuntime,
  )
  const narrow = useNarrowViewport()
  // followups 1.1：同步镜像最新树状态，watch 事件折叠与 reconcile 都基于最新值，
  // 不覆盖用户在事件间隙做出的选择/焦点/滚动锚点。
  const explorerViewState = useRef(state)
  explorerViewState.current = state
  const applyState = (next: ExplorerTreeStateV1): void => {
    explorerViewState.current = next
    setState(next)
  }
  useEffect(() => {
    if (runtime === undefined) return
    let live = true
    void runtime.roots().then(nodes => { if (live) applyState(reduceExplorerTree(explorerViewState.current, { type: 'hydrate_roots', nodes })) }).catch(error => { if (live) applyState({ ...explorerViewState.current, freshness: 'offline', errors: { ...explorerViewState.current.errors, root: error instanceof Error ? error.message : 'failed to load roots' } }) })
    return () => { live = false }
  }, [runtime])
  // followups 1.1：owner watch 能力在场才绑定；缺位时保持显式读取，不伪造事件也不轮询。
  useEffect(() => {
    if (runtime?.fileWatch === undefined) return
    const controller = createExplorerWatchController({
      source: runtime.fileWatch,
      getRoots: () => runtime.roots(),
      listChildren: ref => runtime.listChildren(ref),
      getState: () => explorerViewState.current,
      setState: applyState,
    })
    return () => controller.dispose()
  }, [runtime])
  useEffect(() => {
    if (runtime?.search === undefined) return
    let live = true
    const timer = setTimeout(() => {
      const query = state.filter.trim()
      const request = query === '' ? runtime.roots() : runtime.search!(query)
      void request.then(nodes => {
        if (!live) return
        const next = reduceExplorerTree(explorerViewState.current, { type: 'hydrate_roots', nodes })
        const errors = { ...next.errors }
        delete errors.search
        applyState({ ...next, errors })
      })
        .catch(error => { if (live) applyState({ ...explorerViewState.current, errors: { ...explorerViewState.current.errors, search: error instanceof Error ? error.message : 'Search unavailable' } }) })
    }, 150)
    return () => { live = false; clearTimeout(timer) }
  }, [runtime, state.filter])
  if (runtime === undefined) {
    return createElement(Surface, { kind: 'navigator', className: 'pwr-explorer', 'data-explorer-tree': 'true' },
      createElement(SurfaceState, { phase: 'disabled', title: t('state.offline') }),
    )
  }
  if (state.freshness === 'offline' && state.errors.root !== undefined) {
    return createElement(Surface, { kind: 'navigator', className: 'pwr-explorer', 'data-explorer-tree': 'true' },
      createElement(SurfaceState, { phase: 'error', title: state.errors.root }),
    )
  }
  return createElement(ExplorerTree, { state, runtime, narrow, onIntent: applyState })
}

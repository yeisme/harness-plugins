import { createElement, useEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { WorkbenchIcon, type WorkbenchIconName } from '../icon.js'
import { t } from '../i18n/locale.js'
import type { PaneLocalViewProps } from '../view-registry.js'
import { windowVirtualRows } from '../virtual-window.js'
import type { ExplorerOpenAdapterV1 } from './open-adapter.js'
import { getExplorerRuntime, subscribeExplorerRuntime, type ExplorerMetadataV1, type ExplorerMutationProposalV1, type ExplorerRuntimeV2 } from './runtime.js'
import {
  createExplorerTreeState,
  explorerRowHeight,
  flattenExplorerTree,
  moveExplorerFocus,
  reduceExplorerTree,
  type ExplorerTreeRowV1,
  type ExplorerTreeStateV1,
} from './tree-state.js'

export interface ExplorerTreeUiProps {
  readonly state: ExplorerTreeStateV1
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

function iconForRow(row: ExplorerTreeRowV1): WorkbenchIconName {
  if (row.node.kind === 'directory') return 'folder'
  if (row.node.gitDecoration === 'conflict') return 'git-branch'
  return 'file'
}

function decorationLabel(kind: string | undefined): string | undefined {
  if (kind === undefined) return undefined
  return kind
}

export function ExplorerTree(props: ExplorerTreeUiProps): ReactNode {
  const pointer = props.pointer ?? 'fine'
  const rowHeight = explorerRowHeight(pointer)
  const rows = useMemo(() => flattenExplorerTree(props.state), [props.state])
  const windowed = windowVirtualRows(rows, props.scrollTop ?? 0, props.viewportHeight ?? 560, rowHeight)
  const emit = (next: ExplorerTreeStateV1): void => { props.onIntent?.(next) }
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
  const hoverTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const open = (row: ExplorerTreeRowV1, mode: 'preview' | 'pin'): void => {
    if (row.node.kind === 'directory') return
    if (row.node.availability?.preview !== undefined && row.node.availability.preview !== 'available') return
    const action = props.runtime?.openResource(row.node, mode) ?? props.adapter?.openResource(row.node, mode)
    if (action === undefined || typeof (action as Promise<unknown>).then !== 'function') return
    setPendingRefs(current => current.includes(row.ref) ? current : [...current, row.ref])
    void (action as Promise<{ readonly ok: boolean; readonly reason?: string }>).then(result => {
      if (!result.ok) setMetadata(current => ({ ...current, [row.ref]: { ref: row.ref, version: row.node.version, state: 'unsupported', label: row.node.name, ...(result.reason === undefined ? {} : { detail: result.reason }) } }))
    }).finally(() => setPendingRefs(current => current.filter(ref => ref !== row.ref)))
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
    const needsDestination = action === 'create-file' || action === 'create-directory' || action === 'move' || action === 'copy' || action === 'import-commit'
    const destinationRef = needsDestination ? (destinationOverride ?? (selectedNode?.kind === 'directory' ? selectedNode.ref : props.runtime.getRootRef?.())) : undefined
    const targets = action === 'create-file' || action === 'create-directory' || action === 'import-commit' ? undefined : draggedRefs.length > 0 ? draggedRefs : targetRefs
    setMutationStatus('正在预检…')
    void props.runtime.mutation.propose({ action, ...(targets === undefined ? {} : { targetRefs: targets }), ...(destinationRef === undefined ? {} : { destinationRef }), ...((draftName || importName) === '' ? {} : { name: importName ?? draftName }), ...(importRef === undefined ? {} : { importRef }) })
      .then(next => { setProposal(next); setMutationStatus(undefined); setDangerPhrase('') })
      .catch(error => setMutationStatus(error instanceof Error ? error.message : '预检失败'))
  }
  const executeProposal = (choice?: 'keep-both' | 'replace'): void => {
    if (proposal === undefined) return
    setMutationStatus('正在执行…')
    void proposal.execute(choice).then(result => {
      if (!result.ok) { setMutationStatus(result.reason ?? '操作被拒绝'); return }
      setLastUndo(result.undo === undefined ? undefined : () => result.undo)
      setProposal(undefined); setDraftAction(undefined); setDraftName(''); setMutationStatus('已完成')
      void props.runtime?.roots().then(nodes => emit(reduceExplorerTree(props.state, { type: 'hydrate_roots', nodes })))
    }).catch(error => setMutationStatus(error instanceof Error ? error.message : '执行失败'))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const key = event.key
    if (key === 'ArrowDown') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'down')) }
    else if (key === 'ArrowUp') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'up')) }
    else if (key === 'Home') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'home')) }
    else if (key === 'End') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'end')) }
    else if (key === 'PageDown') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'pageDown')) }
    else if (key === 'PageUp') { event.preventDefault(); emit(moveExplorerFocus(props.state, 'pageUp')) }
    else if (key === 'ArrowRight' && focused?.node.hasChildren && !focused.expanded) {
      event.preventDefault()
      emit(reduceExplorerTree(props.state, { type: 'expand', ref: focused.ref }))
    } else if (key === 'ArrowLeft' && focused?.expanded) {
      event.preventDefault()
      emit(reduceExplorerTree(props.state, { type: 'collapse', ref: focused.ref }))
    } else if ((key === 'Enter' || key === ' ') && focused !== undefined) {
      event.preventDefault()
      emit(reduceExplorerTree(props.state, { type: 'select', ref: focused.ref }))
      if (focused.node.kind === 'directory') {
        const next = reduceExplorerTree(props.state, { type: focused.expanded ? 'collapse' : 'expand', ref: focused.ref })
        emit(next)
      } else open(focused, key === 'Enter' ? 'pin' : 'preview')
    } else if (key === 'F10' && event.shiftKey && focused !== undefined) {
      event.preventDefault()
      emit(reduceExplorerTree(props.state, { type: 'select', ref: focused.ref }))
    }
  }

  return createElement(Surface, { kind: 'navigator', className: 'pwr-explorer', 'data-explorer-tree': 'true' },
    createElement(SurfaceContextBar, {
      className: 'pwr-explorer-header',
      title: t('rail.explorer'),
      nav: createElement('div', { className: 'pwr-explorer-crumb', 'aria-label': t('explorer.root') },
        ...(props.breadcrumb ?? [{ ref: 'workspace', name: t('explorer.root') }]).map(segment =>
          createElement('span', { key: segment.ref, className: 'pwr-explorer-crumb-item' }, segment.name)),
      ),
      actions: createElement(Input, {
        className: 'pwr-explorer-filter',
        'aria-label': t('picker.search.placeholder'),
        value: props.state.filter,
        onChange: event => emit(reduceExplorerTree(props.state, { type: 'filter', query: event.currentTarget.value })),
      }),
    }),
    props.runtime?.mutation === undefined ? null : createElement('div', { className: 'pwr-explorer-resource-actions', 'data-explorer-resource-actions': true },
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: selectedNode?.kind !== 'directory' && props.runtime.getRootRef?.() === undefined, onClick: () => setDraftAction('create-file') }, '新建文件'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: selectedNode?.kind !== 'directory' && props.runtime.getRootRef?.() === undefined, onClick: () => setDraftAction('create-directory') }, '新建目录'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: props.state.selectedRef === undefined, onClick: () => setDraftAction('rename') }, '重命名'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: targetRefs.length === 0 || selectedNode?.kind !== 'directory', onClick: () => beginProposal('move') }, '移动到此处'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: targetRefs.length === 0 || selectedNode?.kind !== 'directory', onClick: () => beginProposal('copy') }, '复制到此处'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: targetRefs.length === 0, onClick: () => beginProposal('trash') }, '移到废纸篓'),
      createElement('label', { className: 'pwr-explorer-import' }, '导入', createElement('input', { type: 'file', hidden: true, disabled: (selectedNode?.kind !== 'directory' && props.runtime.getRootRef?.() === undefined) || props.runtime.transfer?.enabled !== true, onChange: (event: { currentTarget: HTMLInputElement }) => { const file = event.currentTarget.files?.[0]; if (file === undefined || props.runtime?.transfer === undefined) return; setMutationStatus('正在上传…'); void props.runtime.transfer.importFile(file).then(uploaded => beginProposal('import-commit', uploaded.importRef, uploaded.name)).catch(error => setMutationStatus(error instanceof Error ? error.message : '上传失败')) } })),
      selectedNode?.kind === 'file' && selectedNode.availability?.download === 'available' && props.runtime.transfer?.enabled === true ? createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => { setMutationStatus('正在下载…'); void props.runtime?.transfer?.download(selectedNode.ref, selectedNode.version).then(() => setMutationStatus('下载已授权')).catch(error => setMutationStatus(error instanceof Error ? error.message : '下载失败')) } }, '下载') : null,
      lastUndo === undefined ? null : createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => { void lastUndo().then(result => { setMutationStatus(result.ok ? '已撤销' : result.reason ?? '撤销失败'); if (result.ok) setLastUndo(undefined) }) } }, '撤销'),
      draftAction === undefined ? null : createElement('div', { className: 'pwr-explorer-action-draft' },
        createElement(Input, { value: draftName, 'aria-label': '资源名称', placeholder: draftAction === 'rename' ? selectedNode?.name ?? '新名称' : '名称', onChange: event => setDraftName(event.currentTarget.value) }),
        createElement(Button, { type: 'button', size: 'sm', variant: 'primary', disabled: draftName.trim() === '', onClick: () => beginProposal(draftAction) }, '预检'),
        createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => { setDraftAction(undefined); setDraftName('') } }, '取消'),
      ),
      mutationStatus === undefined ? null : createElement('span', { role: 'status' }, mutationStatus),
    ),
    proposal === undefined ? null : createElement('div', { className: 'pwr-explorer-proposal', role: proposal.conflicts.length > 0 ? 'dialog' : 'region', 'aria-label': '文件操作预览' },
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
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => setProposal(undefined) }, '取消'),
    ),
    createElement('div', {
      className: 'pwr-explorer-tree ys-body',
      role: 'tree',
      tabIndex: 0,
      'aria-label': t('rail.explorer'),
      'aria-activedescendant': focused === undefined ? undefined : `explorer-row-${focused.ref}`,
      onKeyDown,
      onDragOver: (event: DragEvent<HTMLDivElement>) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() },
      onDrop: (event: DragEvent<HTMLDivElement>) => {
        if (event.dataTransfer.files.length === 0 || props.runtime?.transfer === undefined) return
        event.preventDefault()
        const destination = selectedNode?.kind === 'directory' ? selectedNode.ref : props.runtime.getRootRef?.()
        for (const file of Array.from(event.dataTransfer.files)) void props.runtime.transfer.importFile(file).then(uploaded => beginProposal('import-commit', uploaded.importRef, uploaded.name, destination)).catch(error => setMutationStatus(error instanceof Error ? error.message : '上传失败'))
      },
      style: { height: props.viewportHeight ?? 560, overflow: 'auto' },
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
                next = reduceExplorerTree(next, { type: row.expanded ? 'collapse' : 'expand', ref: row.ref })
                if (!row.expanded && props.runtime !== undefined && props.state.children[row.ref] === undefined) {
                  emit(reduceExplorerTree(next, { type: 'children_loading', ref: row.ref }))
                  void props.runtime.listChildren(row.ref)
                    .then(nodes => emit(reduceExplorerTree(next, { type: 'children_ready', ref: row.ref, nodes })))
                    .catch(error => emit(reduceExplorerTree(next, { type: 'children_error', ref: row.ref, reason: error instanceof Error ? error.message : 'failed to load children' })))
                  return
                }
              } else {
                next = reduceExplorerTree(next, { type: 'set_primary', ref: row.ref })
                open(row, 'preview')
              }
              emit(next)
            },
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
                emit(reduceExplorerTree(props.state, { type: 'retry', ref: row.ref }))
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

export function ExplorerTreeView(_props: PaneLocalViewProps): ReactNode {
  const [state, setState] = useState(createExplorerTreeState)
  const runtime = useSyncExternalStore(subscribeExplorerRuntime, getExplorerRuntime, getExplorerRuntime)
  useEffect(() => {
    if (runtime === undefined) return
    let live = true
    void runtime.roots().then(nodes => { if (live) setState(current => reduceExplorerTree(current, { type: 'hydrate_roots', nodes })) }).catch(error => { if (live) setState(current => ({ ...current, freshness: 'offline', errors: { ...current.errors, root: error instanceof Error ? error.message : 'failed to load roots' } })) })
    return () => { live = false }
  }, [runtime])
  useEffect(() => {
    if (runtime?.search === undefined || state.filter.trim() === '') return
    let live = true
    const timer = setTimeout(() => {
      void runtime.search?.(state.filter.trim()).then(nodes => { if (live) setState(current => reduceExplorerTree(current, { type: 'hydrate_roots', nodes })) })
    }, 150)
    return () => { live = false; clearTimeout(timer) }
  }, [runtime, state.filter])
  return createElement(ExplorerTree, { state, runtime, onIntent: setState })
}

import { createElement, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { WorkbenchIcon, type WorkbenchIconName } from '../icon.js'
import { t } from '../i18n/locale.js'
import type { PaneLocalViewProps } from '../view-registry.js'
import { windowVirtualRows } from '../virtual-window.js'
import type { ExplorerOpenAdapterV1 } from './open-adapter.js'
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
      if (focused.node.kind !== 'directory') props.adapter?.openResource(focused.node, key === 'Enter' ? 'pin' : 'preview')
    } else if (key === 'F10' && event.shiftKey && focused !== undefined) {
      event.preventDefault()
      emit(reduceExplorerTree(props.state, { type: 'select', ref: focused.ref }))
    }
  }

  return createElement('section', { className: 'pwr-explorer', 'data-explorer-tree': 'true' },
    createElement('header', { className: 'pwr-explorer-header' },
      createElement('strong', null, t('rail.explorer')),
      createElement('nav', { className: 'pwr-explorer-crumb', 'aria-label': t('explorer.root') },
        ...(props.breadcrumb ?? [{ ref: 'workspace', name: t('explorer.root') }]).map(segment =>
          createElement('span', { key: segment.ref, className: 'pwr-explorer-crumb-item' }, segment.name)),
      ),
      createElement('input', {
        className: 'pwr-explorer-filter',
        'aria-label': t('picker.search.placeholder'),
        value: props.state.filter,
        onChange: event => emit(reduceExplorerTree(props.state, { type: 'filter', query: event.currentTarget.value })),
      }),
    ),
    createElement('div', {
      className: 'pwr-explorer-tree',
      role: 'tree',
      tabIndex: 0,
      'aria-label': t('rail.explorer'),
      'aria-activedescendant': focused === undefined ? undefined : `explorer-row-${focused.ref}`,
      onKeyDown,
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
            'aria-level': row.depth + 1,
            'data-explorer-ref': row.ref,
            'data-explorer-kind': row.node.kind,
            className: 'pwr-explorer-row',
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
              } else {
                props.adapter?.openResource(row.node, 'preview')
              }
              emit(next)
            },
            onDoubleClick: () => {
              if (row.node.kind !== 'directory') props.adapter?.openResource(row.node, 'pin')
            },
          },
            row.node.hasChildren
              ? createElement('span', { 'aria-hidden': true, className: 'pwr-explorer-twistie' }, row.expanded ? '▾' : '▸')
              : createElement('span', { 'aria-hidden': true, className: 'pwr-explorer-twistie' }, ' '),
            createElement(WorkbenchIcon, { name: iconForRow(row), size: 14 }),
            createElement('span', { className: 'pwr-explorer-name' }, row.node.name),
            decorationLabel(row.node.gitDecoration) === undefined
              ? null
              : createElement('span', { className: 'pwr-explorer-deco', 'data-git-decoration': row.node.gitDecoration }, row.node.gitDecoration),
            row.loading ? createElement('span', { className: 'pwr-explorer-loading' }, t('state.loading')) : null,
            row.error === undefined ? null : createElement('button', {
              type: 'button',
              className: 'pwr-explorer-retry',
              onClick: (event: { stopPropagation(): void }) => {
                event.stopPropagation()
                emit(reduceExplorerTree(props.state, { type: 'retry', ref: row.ref }))
              },
            }, t('state.retry')),
          )),
        ),
      ),
    ),
    props.gitMutationDisabled === true
      ? createElement('p', { className: 'pwr-explorer-git-offline', role: 'status' }, props.gitMutationReason ?? t('state.offline'))
      : null,
  )
}

export function ExplorerTreeView(_props: PaneLocalViewProps): ReactNode {
  const [state, setState] = useState(createExplorerTreeState)
  return createElement(ExplorerTree, { state, onIntent: setState })
}

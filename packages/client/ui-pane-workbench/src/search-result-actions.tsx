import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { WorkbenchIcon } from './icon.js'
import { formatT, t } from './i18n/locale.js'
import { workspaceSearchPlacementSupport, type WorkspaceSearchOpenPlacementV1 } from './search-open.js'
import type { PaneWorkbenchController } from './controller.js'
import type { WorkspaceSearchCandidateV1 } from './search-identity.js'

/** Official menu rendering, with focus scoped to this result's menu only. */
export function SearchResultActions(props: {
  item: WorkspaceSearchCandidateV1
  controller: PaneWorkbenchController
  open: boolean
  onToggle: () => void
  onClose: () => void
  onRestoreFocus: () => void
  onActivate: (placement: WorkspaceSearchOpenPlacementV1) => void
}) {
  const labels = useRef(new Map<string, HTMLSpanElement>())
  const entries = [
    { id: 'right' as const, label: t('search.openRight') },
    { id: 'bottom' as const, label: t('search.openBelow') },
    { id: 'float' as const, label: t('search.openFloat') },
    ...(props.item.kind === 'command' ? [{ id: 'default' as const, label: t('search.run') }] : []),
  ].map(entry => ({ ...entry, disabled: !workspaceSearchPlacementSupport(props.item, props.controller, entry.id).ok }))
  const buttons = () => entries.filter(entry => !entry.disabled).flatMap(entry => {
    const button = labels.current.get(entry.id)?.closest<HTMLButtonElement>('button[role="menuitem"]')
    return button ? [button] : []
  })
  const close = () => { props.onClose(); props.onRestoreFocus() }
  useEffect(() => {
    if (!props.open) return
    const first = buttons()[0] ?? labels.current.values().next().value?.closest<HTMLElement>('[role="menu"]')
    if (!first) return
    const menu = first.closest<HTMLElement>('[role="menu"]')
    if (!menu) return
    menu.tabIndex = -1
    const focus = () => {
      if (getComputedStyle(menu).visibility === 'hidden' || getComputedStyle(menu).display === 'none') return false
      first.focus()
      return document.activeElement === first
    }
    if (focus()) return
    const observer = new MutationObserver(() => { if (focus()) observer.disconnect() })
    observer.observe(menu, { attributes: true, attributeFilter: ['style', 'class'] })
    return () => observer.disconnect()
  }, [props.open])
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!props.open) return
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.stopPropagation()
      if (event.key === 'Escape') event.preventDefault()
      close()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault(); event.stopPropagation()
    const items = buttons()
    if (!items.length) return
    const current = items.findIndex(item => item === document.activeElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length
    items[next]?.focus()
  }
  return <span className="pwr-search-actions" onClick={event => event.stopPropagation()} onKeyDown={onKeyDown}>
    <Menu open={props.open} portal align="end" compact
      anchor={<button type="button" className="pwr-search-more" tabIndex={-1}
        aria-label={formatT('search.actionsFor', { title: props.item.title })}
        aria-haspopup="menu" aria-expanded={props.open} onClick={props.onToggle}>
        <WorkbenchIcon name="more" size={14} />
      </button>}
      items={entries.map(entry => ({ id: entry.id, disabled: entry.disabled,
        label: <span className="pwr-search-action-label" ref={node => { if (node) labels.current.set(entry.id, node); else labels.current.delete(entry.id) }}
          title={entry.disabled ? t('search.center.placementUnsupported') : undefined}>{entry.label}</span> }))}
      onClose={props.onClose}
      onSelect={id => {
        const entry = entries.find(entry => entry.id === id && !entry.disabled)
        if (!entry) return
        close()
        props.onActivate(entry.id)
      }} />
  </span>
}

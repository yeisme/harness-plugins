import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CompositionEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import type { PaneCommandRegistry } from './composition.js'
import type { PaneWorkbenchController } from './controller.js'
import { WorkbenchIcon } from './icon.js'
import { formatT, getActiveLocale, getLocaleRevision, subscribeLocale, t } from './i18n/locale.js'
import { probeWorkbenchStorage } from './browser-storage.js'
import type { PaneConversationSearchHostV1, PaneWorkspaceContextProviderV1 } from './management.js'
import { createWorkspaceSearchHistoryAdapter } from './search-adapter.js'
import { DEFAULT_WORKSPACE_SEARCH_FILTERS, type WorkspaceSearchCategoryV1, type WorkspaceSearchFiltersV1, type WorkspaceSearchGroupV1 } from './search-group.js'
import { collectWorkspaceSearchCandidates, type WorkspaceSearchCandidateV1 } from './search-identity.js'
import { highlightWorkspaceSearchText, matchWorkspaceSearchCandidate } from './search-match.js'
import {
  activateWorkspaceSearchCandidate,
  openWorkspaceSearchPane,
  WORKSPACE_SEARCH_DRAG_MIME,
  workspaceSearchDragPayload,
  type WorkspaceSearchOpenPlacementV1,
} from './search-open.js'
import { WorkspaceSearchPreferenceStore } from './search-preferences.js'
import { probeWorkspaceSearchHistoryAdapter, WorkspaceSearchCoordinator } from './search-query.js'
import type { PaneViewRegistry } from './view-registry.js'
import { REGION_STYLES } from './chrome/shared.js'

export interface WorkspaceSearchOverlayProps {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly commands?: PaneCommandRegistry
  readonly conversationSearch?: PaneConversationSearchHostV1
  readonly workspaceContext?: PaneWorkspaceContextProviderV1
  readonly storage?: { getItem(key: string): string | null | undefined; setItem(key: string, value: string): void; removeItem(key: string): void }
  readonly mode?: 'dialog' | 'pane'
  readonly onClose?: () => void
  readonly restoreFocus?: () => void
}

function groupTitle(id: WorkspaceSearchGroupV1['id']): string {
  return t(`search.group.${id}`)
}

function categoryLabel(category: WorkspaceSearchCategoryV1): string {
  return t(`search.category.${category}`)
}

function statusReason(status: string, reason?: string): string {
  if (status === 'loading') return t('search.loading')
  if (status === 'empty') return t('search.emptyHistory')
  if (status === 'partial') return t('search.partial')
  if (status === 'stale') return t('search.stale')
  if (status === 'disabled' || status === 'unknown') return t('search.historyUnavailable')
  if (reason === 'permission_denied') return t('management.search.reason.permission_denied')
  if (reason === 'contract_mismatch') return t('management.search.reason.contract_mismatch')
  if (reason === 'offline') return t('management.search.reason.offline')
  if (reason === 'time:unavailable') return t('search.timeUnavailable')
  return t('management.search.reason.failed')
}

export function WorkspaceSearchOverlay(props: WorkspaceSearchOverlayProps): ReactNode {
  useSyncExternalStore(subscribeLocale, getLocaleRevision, getLocaleRevision)
  const workspace = useSyncExternalStore(props.controller.subscribeWorkspace, props.controller.getSnapshot, props.controller.getSnapshot)
  const management = useSyncExternalStore(props.controller.subscribeManagement, props.controller.getManagementSnapshot, props.controller.getManagementSnapshot)
  const [, setTick] = useState(0)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [composing, setComposing] = useState(false)
  const [filters, setFilters] = useState<WorkspaceSearchFiltersV1>(DEFAULT_WORKSPACE_SEARCH_FILTERS)
  const [menuKey, setMenuKey] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [busyKey, setBusyKey] = useState<string>()
  const mode = props.mode ?? 'dialog'
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const preferences = useMemo(() => new WorkspaceSearchPreferenceStore(props.storage ?? probeWorkbenchStorage()), [props.storage])
  const [preferenceRevision, setPreferenceRevision] = useState(0)
  const namedFilters = useMemo(() => preferences.load().namedFilters, [preferences, preferenceRevision])
  const recentRefs = useMemo(() => preferences.load().recent.map(item => item.stableKey), [preferences, preferenceRevision])

  const locals = useMemo(() => collectWorkspaceSearchCandidates({
    registrations: props.registry.snapshot(),
    commands: props.commands?.snapshot(),
    state: workspace,
    profile: management.profile,
    recentRefs,
    projectRef: management.scope.kind === 'workspace' ? management.scope.ref : props.workspaceContext?.getSnapshot().workspaceRef,
  }), [props.registry, props.commands, workspace, management, recentRefs, props.workspaceContext, catalogRevision])

  const adapter = useMemo(() => createWorkspaceSearchHistoryAdapter({
    conversationSearch: props.conversationSearch,
    workspaceContext: props.workspaceContext,
    workspaceRef: props.workspaceContext?.getSnapshot().workspaceRef ?? (management.scope.kind === 'workspace' ? management.scope.ref : undefined),
    sessionRef: management.scope.kind === 'session' ? management.scope.ref : undefined,
  }), [props.conversationSearch, props.workspaceContext, management.scope])

  const localsRef = useRef(locals)
  localsRef.current = locals
  const coordinator = useMemo(() => new WorkspaceSearchCoordinator(() => localsRef.current, adapter), [adapter])
  useEffect(() => () => coordinator.dispose(), [coordinator])
  useEffect(() => props.registry.subscribe(() => setCatalogRevision(value => value + 1)), [props.registry])
  useEffect(() => props.commands?.subscribe(() => setCatalogRevision(value => value + 1)), [props.commands])
  useEffect(() => coordinator.subscribe(() => setTick(value => value + 1)), [coordinator])
  useEffect(() => { if (mode !== 'pane') inputRef.current?.focus() }, [mode])
  useEffect(() => {
    coordinator.setRequest({
      query,
      composing,
      filters,
      locale: getActiveLocale(),
      profileRef: management.scope.ref,
      projectRef: filters.projectRef,
    })
  }, [coordinator, query, composing, filters, management.scope.ref])

  const snapshot = coordinator.getSnapshot()
  const selectedKey = snapshot.selectedKey
  const probe = probeWorkspaceSearchHistoryAdapter({
    search: props.conversationSearch?.search ?? props.workspaceContext?.search,
    capability: props.conversationSearch?.capability ?? (props.workspaceContext?.search === undefined ? undefined : 'pane.workspace-search.v1'),
  })

  const close = (): void => {
    coordinator.invalidate('close')
    props.onClose?.()
    props.restoreFocus?.()
  }

  const activate = async (candidate: WorkspaceSearchCandidateV1, placement: WorkspaceSearchOpenPlacementV1 = 'default'): Promise<void> => {
    if (candidate.sideEffect && placement !== 'default') return
    setBusyKey(candidate.stableKey)
    const result = await activateWorkspaceSearchCandidate({
      candidate,
      controller: props.controller,
      registry: props.registry,
      commands: props.commands,
      conversationSearch: props.conversationSearch,
      workspaceContext: props.workspaceContext,
      placement,
    })
    setBusyKey(undefined)
    if (!result.ok) {
      setNotice(result.reason === 'geometry_unavailable' ? t('reason.geometryTier0') : t('search.openFailed'))
      return
    }
    const saved = preferences.recordOpen(candidate.stableKey)
    if (!saved.saved) setNotice(t('search.storageFailed'))
    else setPreferenceRevision(value => value + 1)
    if (mode === 'dialog') close()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (menuKey !== undefined) { setMenuKey(undefined); return }
      if (mode === 'dialog') close()
      return
    }
    const items = snapshot.local.visibleItems
    if (items.length === 0) return
    const index = Math.max(0, items.findIndex(item => item.stableKey === selectedKey))
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
      coordinator.select(items[next]!.stableKey)
      listRef.current?.querySelector<HTMLElement>(`[data-search-option='${CSS.escape(items[next]!.stableKey)}']`)?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (selectedKey !== undefined) setMenuKey(selectedKey)
      return
    }
    if (event.key === 'ArrowLeft' && menuKey !== undefined) {
      event.preventDefault()
      setMenuKey(undefined)
      return
    }
    if (event.key === 'Enter' && selectedKey !== undefined) {
      const fromInput = document.activeElement === inputRef.current || event.target === inputRef.current
      if (!fromInput) return
      const current = items.find(item => item.stableKey === selectedKey)
      if (current !== undefined) {
        event.preventDefault()
        void activate(current)
      }
    }
  }

  const setCategory = (category: WorkspaceSearchCategoryV1): void => {
    setFilters(current => ({
      ...current,
      category,
      ...(category !== 'session' ? { timeRange: undefined } : {}),
      ...(category !== 'command' ? { pluginOwner: undefined } : {}),
    }))
  }

  const body = createElement('section', {
    className: `pwr-search ${mode === 'pane' ? 'pwr-search-pane' : ''}`,
    'data-workspace-search': mode,
    onKeyDown,
  },
  createElement('header', { className: 'pwr-search-header' },
    createElement('div', { className: 'pwr-search-title' },
      createElement(WorkbenchIcon, { name: 'search', size: 18 }),
      createElement('strong', null, t('search.title'))),
    createElement('div', { className: 'pwr-search-header-actions' },
      mode === 'dialog' ? createElement('button', {
        type: 'button',
        className: 'pwr-icon',
        'aria-label': t('search.pin'),
        onClick: () => { openWorkspaceSearchPane(props.controller); close() },
      }, createElement(WorkbenchIcon, { name: 'pin' })) : null,
      mode === 'dialog' ? createElement('button', {
        type: 'button',
        className: 'pwr-icon',
        'aria-label': t('chrome.closeViewSelector'),
        onClick: close,
      }, createElement(WorkbenchIcon, { name: 'close' })) : null)),
  createElement('div', { className: 'pwr-search-input' },
    createElement(WorkbenchIcon, { name: 'search', size: 16 }),
    createElement('input', {
      ref: inputRef,
      type: 'search',
      role: 'combobox',
      value: query,
      placeholder: t('search.placeholder'),
      'aria-label': t('search.placeholder'),
      'aria-expanded': true,
      'aria-controls': 'pwr-search-listbox',
      'aria-activedescendant': selectedKey === undefined ? undefined : `pwr-search-option-${selectedKey}`,
      'aria-autocomplete': 'list',
      onChange: (event: ChangeEvent<HTMLInputElement>) => setQuery(event.currentTarget.value),
      onCompositionStart: () => setComposing(true),
      onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => {
        setComposing(false)
        setQuery(event.currentTarget.value)
      },
    }),
    query.length === 0 ? null : createElement('button', {
      type: 'button',
      className: 'pwr-search-clear',
      'aria-label': t('management.search.clear'),
      onClick: () => { setQuery(''); inputRef.current?.focus() },
    }, createElement(WorkbenchIcon, { name: 'close', size: 14 }))),
  createElement('div', { className: 'pwr-search-filters', role: 'toolbar', 'aria-label': t('search.filters') },
    ...(['all', 'session', 'pane', 'command'] as const).map(category => createElement('button', {
      key: category,
      type: 'button',
      'aria-pressed': filters.category === category,
      onClick: () => setCategory(category),
    }, categoryLabel(category))),
    createElement('button', {
      type: 'button',
      'aria-pressed': filters.openedOnly,
      onClick: () => setFilters(current => ({ ...current, openedOnly: !current.openedOnly })),
    }, t('search.filter.opened')),
    createElement('button', {
      type: 'button',
      'aria-pressed': filters.allAccessibleProjects,
      disabled: props.workspaceContext?.search === undefined,
      title: props.workspaceContext?.search === undefined ? t('search.historyUnavailable') : undefined,
      onClick: () => setFilters(current => ({ ...current, allAccessibleProjects: !current.allAccessibleProjects, projectRef: undefined })),
    }, t('search.filter.allProjects')),
    filters.timeRange === 'unsupported' || filters.category === 'session' ? createElement('button', {
      type: 'button',
      'aria-pressed': filters.timeRange === 'unsupported',
      onClick: () => setFilters(current => ({ ...current, timeRange: current.timeRange === 'unsupported' ? undefined : 'unsupported' })),
    }, t('search.filter.time')) : null,
    snapshot.local.activeFilterLabels.length > (filters.category === 'all' ? 1 : 0) ? createElement('button', {
      type: 'button',
      className: 'pwr-search-clear-filters',
      onClick: () => setFilters(DEFAULT_WORKSPACE_SEARCH_FILTERS),
    }, t('search.clearFilters')) : null,
    snapshot.local.activeFilterLabels.length > 0 ? createElement('button', {
      type: 'button',
      onClick: () => {
        const saved = preferences.saveNamedFilter({
          id: `named:${Date.now().toString(36)}`,
          label: snapshot.local.activeFilterLabels.slice(0, 3).join(' · ') || t('search.filters'),
          filters,
        })
        if (!saved.saved) setNotice(t('search.storageFailed'))
        else setPreferenceRevision(value => value + 1)
      },
    }, t('search.saveFilter')) : null),
    namedFilters.length === 0 ? null : createElement('div', { className: 'pwr-search-named', 'aria-label': t('search.namedFilters') },
      ...namedFilters.map(named => createElement('button', {
        key: named.id,
        type: 'button',
        onClick: () => {
          const accessible = new Set(props.workspaceContext?.listWorkspaces?.().map(target => target.workspaceRef) ?? [])
          if (management.scope.kind === 'workspace') accessible.add(management.scope.ref)
          const restored = preferences.restoreNamedFilter(named.id, accessible)
          if (restored.filters === undefined) return
          setFilters(restored.filters)
          if (restored.staleProject) setNotice(t('search.staleProject'))
        },
      }, named.label))),
  snapshot.local.activeFilterLabels.length === 0 ? null : createElement('div', { className: 'pwr-search-chips', 'aria-label': t('search.filters') },
    ...snapshot.local.activeFilterLabels.map(label => createElement('span', { key: label, className: 'pwr-search-chip' }, label))),
  snapshot.history.status === 'idle' || snapshot.history.status === 'ready' ? null : createElement('div', {
    className: `pwr-search-state pwr-search-state-${snapshot.history.status}`,
    role: snapshot.history.status === 'error' ? 'alert' : 'status',
  },
    snapshot.history.status === 'loading' ? createElement('span', { className: 'pwr-management-spinner', 'aria-hidden': true }) : createElement(WorkbenchIcon, { name: 'message', size: 14 }),
    createElement('span', null, snapshot.history.slow ? t('search.slow') : statusReason(snapshot.history.status, snapshot.history.reason)),
    snapshot.history.status === 'error' && snapshot.history.reason !== 'permission_denied' && snapshot.history.reason !== 'contract_mismatch'
      ? createElement('button', { type: 'button', onClick: () => coordinator.retry() }, t('management.search.retry'))
      : null),
  notice === undefined ? null : createElement('p', { className: 'pwr-search-notice', role: 'status' }, notice),
  createElement('div', {
    ref: listRef,
    id: 'pwr-search-listbox',
    className: 'pwr-search-list',
    role: 'listbox',
    'aria-label': t('search.results'),
  },
    snapshot.local.groups.length === 0 ? createElement('p', { className: 'pwr-empty' },
      filters.openedOnly || filters.status !== undefined ? t('search.emptyFiltered') : t('search.empty')) : null,
    ...snapshot.local.groups.map(group => createElement('section', {
      key: group.id,
      className: 'pwr-search-group',
      'data-collapsed': group.collapsed || undefined,
      'aria-hidden': group.collapsed || undefined,
    },
      createElement('h3', null,
        createElement('span', null, groupTitle(group.id)),
        createElement('small', null, group.countLabelKind === 'exact' && group.totalCount !== undefined
          ? formatT('search.count.exact', { count: group.totalCount })
          : formatT('search.count.found', { count: group.loadedCount })),
        group.collapsed ? createElement('span', { className: 'pwr-search-collapsed' }, t('search.compatibilityHint')) : null),
      group.collapsed ? null : group.items.map(item => {
        const selected = item.stableKey === selectedKey
        const match = query.trim().length === 0 ? undefined : matchWorkspaceSearchCandidate(item, query)
        const titleParts = highlightWorkspaceSearchText(item.title, match?.field === 'title' ? match.spans : [])
        return createElement('div', {
          key: item.stableKey,
          id: `pwr-search-option-${item.stableKey}`,
          role: 'option',
          className: `pwr-search-row${selected ? ' pwr-search-row-selected' : ''}`,
          'data-search-option': item.stableKey,
          'aria-label': item.title,
          'aria-selected': selected,
          draggable: true,
          onMouseEnter: () => coordinator.select(item.stableKey),
          onClick: () => { void activate(item) },
          onDragStart: (event: DragEvent<HTMLDivElement>) => {
            event.dataTransfer.setData(WORKSPACE_SEARCH_DRAG_MIME, workspaceSearchDragPayload(item))
            event.dataTransfer.effectAllowed = 'copyMove'
          },
        },
          createElement(WorkbenchIcon, { name: item.semanticIcon, size: 16 }),
          createElement('span', { className: 'pwr-search-copy' },
            createElement('strong', null, ...titleParts.map((part, index) => createElement(part.match ? 'mark' : 'span', { key: index }, part.text))),
            createElement('small', null, [item.ownerRef, item.kind, item.opened ? t('search.filter.opened') : undefined, item.status].filter(Boolean).join(' · '))),
          item.availability === 'available' ? null : createElement('span', { className: 'pwr-search-status' }, item.reason ?? item.availability),
          busyKey === item.stableKey ? createElement('span', { className: 'pwr-management-spinner', 'aria-hidden': true }) : null,
          createElement('button', {
            type: 'button',
            className: 'pwr-search-more',
            tabIndex: -1,
            'aria-label': formatT('search.actionsFor', { title: item.title }),
            'aria-haspopup': 'menu',
            'aria-expanded': menuKey === item.stableKey,
            onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); setMenuKey(current => current === item.stableKey ? undefined : item.stableKey) },
          }, createElement(WorkbenchIcon, { name: 'more', size: 14 })),
          menuKey === item.stableKey ? createElement('div', { className: 'pwr-search-menu', role: 'menu' },
            createElement('button', { type: 'button', role: 'menuitem', onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); setMenuKey(undefined); void activate(item, 'right') } }, t('search.openRight')),
            createElement('button', { type: 'button', role: 'menuitem', onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); setMenuKey(undefined); void activate(item, 'bottom') } }, t('search.openBelow')),
            createElement('button', { type: 'button', role: 'menuitem', onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); setMenuKey(undefined); void activate(item, 'float') } }, t('search.openFloat')),
            item.kind === 'command' ? createElement('button', { type: 'button', role: 'menuitem', onClick: (event: { stopPropagation(): void }) => { event.stopPropagation(); setMenuKey(undefined); void activate(item) } }, t('search.run')) : null,
          ) : null)
      }))),
    snapshot.history.nextCursor === undefined ? null : createElement('button', {
      type: 'button',
      className: 'pwr-search-more-results',
      onClick: () => coordinator.loadMore(),
    }, t('management.loadMore'))),
  createElement('footer', { className: 'pwr-search-footer' },
    createElement('span', null, t('search.hint')),
    probe.capability === 'available' ? null : createElement('small', null, t('search.historyUnavailable')),
    recentRefs.length === 0 ? null : createElement('button', {
      type: 'button',
      onClick: () => {
        const result = preferences.clearRecent()
        if (!result.saved) setNotice(t('search.storageFailed'))
        setPreferenceRevision(value => value + 1)
      },
    }, t('search.clearRecent'))),
  )

  const chrome = createElement('style', { 'data-workspace-search-styles': true }, REGION_STYLES)
  if (mode === 'pane') {
    return createElement(Surface, { kind: 'workspace', className: 'pwr-root pwr-search-surface', 'aria-label': t('search.title') }, chrome, body)
  }
  return createElement(Modal, {
    open: true,
    onClose: close,
    title: t('search.title'),
    closeLabel: t('chrome.closeViewSelector'),
    headless: true,
  }, createElement(Surface, { kind: 'dialog', className: 'pwr-root pwr-search-surface', 'aria-label': t('search.title') }, chrome, body))
}

export function WorkspaceSearchPaneView(props: {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly commands?: PaneCommandRegistry
  readonly conversationSearch?: PaneConversationSearchHostV1
  readonly workspaceContext?: PaneWorkspaceContextProviderV1
}): ReactNode {
  return createElement(WorkspaceSearchOverlay, { ...props, mode: 'pane' })
}

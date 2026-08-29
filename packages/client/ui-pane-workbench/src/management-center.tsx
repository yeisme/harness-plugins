import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import type { PaneWorkbenchController } from './controller.js'
import { WorkbenchIcon, type WorkbenchIconName } from './icon.js'
import { formatT, getLocaleRevision, subscribeLocale, t, tWithFallback } from './i18n/locale.js'
import {
  boundedPaneDescription,
  buildPaneManagementEntries,
  filterAndRankPaneEntries,
  type PaneConversationSearchHostV1,
  type PaneConversationSearchItemV1,
  type PaneManagementEntrySource,
  type PaneManagementEntryV1,
  type PaneManagementMode,
  type PaneWorkspaceContextProviderV1,
  type PaneWorkspaceSearchItemV1,
} from './management.js'
import type { PaneViewRegistry } from './view-registry.js'
import { windowVirtualRows } from './virtual-window.js'
import type { PaneBulkCloseProtectedViewV1, PaneGroupV1, PaneViewInstanceV1 } from './workspace.js'

export interface PaneManagementCenterProps {
  readonly mode: PaneManagementMode
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly conversationSearch?: PaneConversationSearchHostV1
  readonly initialProtectedViews?: readonly PaneBulkCloseProtectedViewV1[]
  readonly workspaceContext?: PaneWorkspaceContextProviderV1
  readonly onClose: () => void
  readonly restoreFocus?: () => void
}

export function PaneCloseUndoToast({ controller }: { readonly controller: PaneWorkbenchController }): ReactNode {
  useSyncExternalStore(subscribeLocale, getLocaleRevision, getLocaleRevision)
  const management = useSyncExternalStore(controller.subscribeManagement, controller.getManagementSnapshot, controller.getManagementSnapshot)
  const [visibleBatchId, setVisibleBatchId] = useState<string>()
  const batch = management.lastClosedBatch
  useEffect(() => {
    if (batch === undefined) { setVisibleBatchId(undefined); return }
    setVisibleBatchId(batch.id)
    const timeout = setTimeout(() => setVisibleBatchId(current => current === batch.id ? undefined : current), 10_000)
    return () => clearTimeout(timeout)
  }, [batch?.id])
  if (batch === undefined || visibleBatchId !== batch.id) return null
  return createElement('div', { className: 'pwr-undo-toast', role: 'status' },
    createElement('span', null, formatT('management.closedCount', { count: batch.entries.length })),
    createElement('button', { type: 'button', onClick: () => { controller.restoreClosedBatch(batch.id); setVisibleBatchId(undefined) } }, t('management.undo')))
}

interface ConversationState {
  readonly items: readonly PaneConversationSearchItemV1[]
  readonly nextCursor?: string
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly reason?: string
}

interface WorkspaceSearchState {
  readonly items: readonly PaneWorkspaceSearchItemV1[]
  readonly nextCursor?: string
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly reason?: string
}

const GROUP_ORDER = ['favorites', 'recent', 'development', 'agents', 'creator', 'knowledge', 'system', 'other', 'history'] as const

function groupLabel(groupId: string, customLabel?: string): string {
  if (customLabel !== undefined) return customLabel
  const known = new Set<string>(GROUP_ORDER)
  return known.has(groupId) ? t(`management.group.${groupId}`) : groupId
}

function iconForEntry(entry: PaneManagementEntryV1): WorkbenchIconName {
  if (entry.kind.includes('git')) return 'git'
  if (entry.kind.includes('agent')) return 'agents'
  if (entry.kind.includes('terminal')) return 'terminal'
  if (entry.kind.includes('file') || entry.kind.includes('explorer')) return 'file'
  if (entry.kind.includes('media') || entry.kind.includes('image') || entry.kind.includes('video') || entry.kind.includes('audio')) return 'media'
  return entry.source === 'history' ? 'restore' : 'window'
}

function sourceLabel(source: PaneManagementEntrySource): string {
  if (source === 'pane') return t('management.source.pane')
  if (source === 'tab') return t('management.source.tab')
  if (source === 'history') return t('management.source.history')
  return t('management.includeConversation')
}

function activeGroup(controller: PaneWorkbenchController): PaneGroupV1 | undefined {
  const state = controller.getSnapshot()
  return state.activeGroupId === undefined ? undefined : state.groups[state.activeGroupId]
}

function groupPlacementLabel(group: Pick<PaneGroupV1, 'region' | 'role'>): string {
  return `${t(`region.${group.region}`)} · ${tWithFallback(`role.${group.role}`, group.role)}`
}

export function PaneManagementCenter(props: PaneManagementCenterProps): ReactNode {
  const localeRevision = useSyncExternalStore(subscribeLocale, getLocaleRevision, getLocaleRevision)
  const workspace = useSyncExternalStore(props.controller.subscribeWorkspace, props.controller.getSnapshot, props.controller.getSnapshot)
  const management = useSyncExternalStore(props.controller.subscribeManagement, props.controller.getManagementSnapshot, props.controller.getManagementSnapshot)
  const [, setRegistryRevision] = useState(0)
  const [, setWorkspaceRevision] = useState(0)
  const [mode, setMode] = useState(props.mode)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<PaneManagementEntrySource | 'all'>(props.mode === 'manage' ? 'tab' : 'all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pinnedFilter, setPinnedFilter] = useState('all')
  const [workspaceFilter, setWorkspaceFilter] = useState('current')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [includeConversation, setIncludeConversation] = useState(false)
  const [conversation, setConversation] = useState<ConversationState>({ items: [], status: 'idle' })
  const [workspaceSearch, setWorkspaceSearch] = useState<WorkspaceSearchState>({ items: [], status: 'idle' })
  const [notice, setNotice] = useState<string>()
  const [protectedViews, setProtectedViews] = useState<readonly PaneBulkCloseProtectedViewV1[]>(props.initialProtectedViews ?? [])
  const [targetEntry, setTargetEntry] = useState<PaneManagementEntryV1>()
  const [newGroup, setNewGroup] = useState('')
  const [groupDrafts, setGroupDrafts] = useState<Readonly<Record<string, string>>>({})
  const [groupForSelection, setGroupForSelection] = useState('')
  const [moveTargetGroup, setMoveTargetGroup] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [detailKey, setDetailKey] = useState<string>()
  const searchRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLElement>(null)
  const conversationAbort = useRef<AbortController>()
  const workspaceAbort = useRef<AbortController>()

  useEffect(() => props.registry.subscribe(() => setRegistryRevision(value => value + 1)), [props.registry])
  useEffect(() => props.workspaceContext?.subscribe?.(() => setWorkspaceRevision(value => value + 1)), [props.workspaceContext])
  useEffect(() => { searchRef.current?.focus() }, [])
  useEffect(() => {
    setMode(props.mode)
    setSource(props.mode === 'manage' ? 'tab' : 'all')
  }, [props.mode])
  useEffect(() => setProtectedViews(props.initialProtectedViews ?? []), [props.initialProtectedViews])

  const entries = useMemo(() => buildPaneManagementEntries({
    registrations: props.registry.snapshot(),
    state: workspace,
    history: management.history,
    profile: management.profile,
    workspace: management.workspace,
  }), [props.registry, workspace, management, localeRevision])

  const sourceFilter = source === 'all' ? undefined : new Set<PaneManagementEntrySource>([source])
  const groups = useMemo(() => [...new Set(entries.map(entry => entry.groupId))].sort(), [entries])
  const regions = useMemo(() => [...new Set(entries.flatMap(entry => entry.region === undefined ? [] : [entry.region]))].sort(), [entries])
  const owners = useMemo(() => [...new Set(entries.flatMap(entry => entry.owner === undefined ? [] : [entry.owner]))].sort(), [entries])
  const kinds = useMemo(() => [...new Set(entries.map(entry => entry.kind))].sort(), [entries])
  const statuses = useMemo(() => [...new Set(entries.flatMap(entry => entry.statusTokens))].sort(), [entries])
  const workspaceTargets = props.workspaceContext?.listWorkspaces?.() ?? []
  const localResults = useMemo(() => workspaceFilter !== 'current' && workspaceFilter !== 'all' ? [] : filterAndRankPaneEntries(entries, query, {
    ...(sourceFilter === undefined ? {} : { sources: sourceFilter }),
    ...(groupFilter === 'all' ? {} : { groupIds: new Set([groupFilter]) }),
    ...(regionFilter === 'all' ? {} : { regions: new Set([regionFilter as 'right' | 'bottom']) }),
    ...(ownerFilter === 'all' ? {} : { owners: new Set([ownerFilter]) }),
    ...(kindFilter === 'all' ? {} : { kinds: new Set([kindFilter]) }),
    ...(statusFilter === 'all' ? {} : { statuses: new Set([statusFilter]) }),
    ...(pinnedFilter === 'all' ? {} : { pinned: pinnedFilter === 'pinned' }),
  }), [entries, query, sourceFilter, groupFilter, regionFilter, ownerFilter, kindFilter, statusFilter, pinnedFilter, workspaceFilter])

  const conversationEnabled = includeConversation || /^@conversation(?:\s|$)/i.test(query.trim())
  const conversationQuery = query.trim().replace(/^@conversation\s*/i, '')

  const loadConversation = (cursor?: string, append = false): void => {
    if (!conversationEnabled || conversationQuery.length === 0 || props.conversationSearch === undefined) return
    conversationAbort.current?.abort()
    const abort = new AbortController()
    conversationAbort.current = abort
    setConversation(current => ({ ...current, status: 'loading', reason: undefined }))
    const scope = management.scope
    void props.conversationSearch.search({
      workspaceRef: scope.ref,
      ...(scope.kind === 'session' ? { sessionRef: scope.ref } : {}),
      query: conversationQuery,
      ...(cursor === undefined ? {} : { cursor }),
      limit: 20,
    }, abort.signal).then(page => {
      if (abort.signal.aborted) return
      if (page.status !== 'ready' && page.status !== 'partial') {
        setConversation({ items: append ? conversation.items : [], status: 'error', reason: page.reason ?? page.status })
        return
      }
      setConversation(current => ({
        items: append ? [...current.items, ...page.items].slice(0, 100) : page.items.slice(0, 100),
        nextCursor: page.nextCursor,
        status: 'ready',
      }))
    }).catch(error => {
      if (abort.signal.aborted) return
      setConversation({ items: [], status: 'error', reason: error instanceof Error ? error.message : 'search_failed' })
    })
  }

  useEffect(() => {
    if (!conversationEnabled || conversationQuery.length === 0) {
      conversationAbort.current?.abort()
      setConversation({ items: [], status: 'idle' })
      return
    }
    const timeout = setTimeout(() => loadConversation(), 150)
    return () => { clearTimeout(timeout); conversationAbort.current?.abort() }
    // The host and current query define one generation; loadConversation is intentionally inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationEnabled, conversationQuery, props.conversationSearch, management.scope.ref])

  const loadWorkspaceSearch = (cursor?: string, append = false): void => {
    const search = props.workspaceContext?.search
    if (workspaceFilter === 'current' || search === undefined) return
    const workspaceRefs = workspaceFilter === 'all' ? workspaceTargets.map(target => target.workspaceRef) : [workspaceFilter]
    if (workspaceRefs.length === 0) return
    workspaceAbort.current?.abort()
    const abort = new AbortController()
    workspaceAbort.current = abort
    setWorkspaceSearch(current => ({ ...current, status: 'loading', reason: undefined }))
    void search({ workspaceRefs, query: query.trim(), ...(cursor === undefined ? {} : { cursor }), limit: 20 }, abort.signal).then(page => {
      if (abort.signal.aborted) return
      if (page.status !== 'ready' && page.status !== 'partial') {
        setWorkspaceSearch({ items: [], status: 'error', reason: page.reason ?? page.status })
        return
      }
      setWorkspaceSearch(current => ({
        items: append ? [...current.items, ...page.items].slice(0, 100) : page.items.slice(0, 100),
        nextCursor: page.nextCursor,
        status: 'ready',
      }))
    }).catch(() => {
      if (!abort.signal.aborted) setWorkspaceSearch({ items: [], status: 'error', reason: 'workspace_search_failed' })
    })
  }

  useEffect(() => {
    if (workspaceFilter === 'current') {
      workspaceAbort.current?.abort()
      setWorkspaceSearch({ items: [], status: 'idle' })
      return
    }
    const timeout = setTimeout(() => loadWorkspaceSearch(), 150)
    return () => { clearTimeout(timeout); workspaceAbort.current?.abort() }
    // Scope, query and host snapshot define one cancellable generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceFilter, query, props.workspaceContext, workspaceTargets.map(target => target.workspaceRef).join('|')])

  const conversationEntries: readonly PaneManagementEntryV1[] = conversation.items.map(item => ({
    key: `conversation:${item.sessionRef}:${item.messageRef}`,
    source: 'conversation',
    title: item.title,
    kind: 'conversation.result',
    groupId: 'conversation',
    pinned: false,
    active: false,
    opened: false,
    recent: true,
    statusTokens: [],
    keywords: [item.snippet],
    description: boundedPaneDescription(item.snippet),
    ...(item.updatedAt === undefined ? {} : { updatedAt: item.updatedAt }),
  }))
  const workspaceEntries: readonly PaneManagementEntryV1[] = workspaceSearch.items.map(item => ({
    key: `workspace:${item.workspaceRef}:${item.ref}`,
    source: item.source,
    title: item.title,
    kind: item.kind,
    groupId: item.groupId ?? 'other',
    workspaceRef: item.workspaceRef,
    owner: item.owner,
    region: item.region,
    pinned: item.pinned === true,
    active: false,
    opened: item.source === 'tab',
    recent: true,
    statusTokens: item.statusTokens ?? [],
    keywords: [item.title, item.kind, item.workspaceRef],
    ...(item.description === undefined ? {} : { description: boundedPaneDescription(item.description) }),
  }))
  const results = [...localResults, ...workspaceEntries, ...conversationEntries].slice(0, 200)
  const customLabels = new Map(management.profile.groups.map(group => [group.id, group.label]))
  const detailEntry = detailKey === undefined
    ? undefined
    : [...entries, ...results].find(entry => entry.key === detailKey)

  const detailFields = (entry: PaneManagementEntryV1): readonly { field: string; label: string; value: string }[] => [
    { field: 'source', label: t('management.details.source'), value: sourceLabel(entry.source) },
    ...(entry.owner === undefined ? [] : [{ field: 'owner', label: t('management.details.owner'), value: entry.owner }]),
    { field: 'kind', label: t('management.details.kind'), value: entry.kind },
    ...(entry.role === undefined ? [] : [{ field: 'role', label: t('management.details.role'), value: tWithFallback(`role.${entry.role}`, entry.role) }]),
    ...(entry.region === undefined ? [] : [{ field: 'region', label: t('management.details.region'), value: t(`region.${entry.region}`) }]),
    ...(entry.statusTokens.length === 0 ? [] : [{ field: 'status', label: t('management.details.status'), value: entry.statusTokens.join(' · ') }]),
    ...(entry.descriptor?.presentation?.keywords === undefined ? [] : [{ field: 'keywords', label: t('management.details.keywords'), value: entry.descriptor.presentation.keywords.join(' · ') }]),
    ...(entry.workspaceRef === undefined ? [] : [{ field: 'workspace', label: t('management.details.workspace'), value: workspaceTargets.find(target => target.workspaceRef === entry.workspaceRef)?.label ?? entry.workspaceRef }]),
    ...(entry.source === 'history' && entry.updatedAt !== undefined ? [{ field: 'closedAt', label: t('management.details.closedAt'), value: entry.updatedAt }] : []),
    ...(entry.source === 'conversation' && entry.updatedAt !== undefined ? [{ field: 'updatedAt', label: t('management.details.updated'), value: entry.updatedAt }] : []),
  ]

  const detailPanel = (entry: PaneManagementEntryV1): ReactNode => createElement('section', {
    className: 'pwr-management-detail',
    role: 'region',
    'aria-label': t('management.details'),
    'data-pane-management-detail': entry.key,
  },
  createElement('header', { className: 'pwr-management-detail-header' },
    createElement('strong', null, entry.title),
    createElement('button', {
      type: 'button', className: 'pwr-icon',
      'aria-label': t('management.details.hide'),
      onClick: () => { hideDetail() },
    }, createElement(WorkbenchIcon, { name: 'close', size: 14 }))),
  createElement('p', { className: 'pwr-management-detail-desc' },
    entry.description ?? t('management.details.noDescription')),
  createElement('div', { className: 'pwr-management-detail-grid' },
    ...detailFields(entry).map(field => createElement('div', {
      key: field.field,
      className: 'pwr-management-detail-field',
      'data-pane-management-detail-field': field.field,
    },
    createElement('span', null, field.label),
    createElement('small', null, field.value)))))

  /** Collapses the detail panel and returns focus to the invoking row's info button. */
  const hideDetail = (): void => {
    const key = detailKey
    setDetailKey(undefined)
    if (key === undefined) return
    const info = rootRef.current?.querySelector<HTMLButtonElement>(`[data-pane-management-entry='${CSS.escape(key)}'] .pwr-management-info`)
    info?.focus()
  }

  const displayGroups = useMemo(() => {
    const panes = entries.filter(entry => entry.source === 'pane')
    const groups = new Map<string, PaneManagementEntryV1[]>()
    const push = (groupId: string, entry: PaneManagementEntryV1): void => {
      const current = groups.get(groupId) ?? []
      if (!current.some(item => item.key === entry.key)) groups.set(groupId, [...current, entry])
    }
    if (mode === 'manage') {
      for (const entry of entries.filter(entry => entry.source === 'tab' || entry.source === 'history')) push(entry.groupId, entry)
      return groups
    }
    for (const entry of panes.filter(entry => management.profile.favoritePaneKinds.includes(entry.kind))) push('favorites', entry)
    for (const kind of management.profile.recentPaneKinds) {
      const entry = panes.find(item => item.kind === kind)
      if (entry !== undefined) push('recent', entry)
    }
    for (const entry of panes) push(entry.groupId, entry)
    return groups
  }, [entries, management.profile, mode])

  const showSearchResults = query.trim().length > 0 || workspaceFilter !== 'current'
  const flatRows = showSearchResults ? results : [...displayGroups.values()].flat()
  const virtual = flatRows.length > 50 ? windowVirtualRows(flatRows, scrollTop, 420, 44) : {
    start: 0, end: flatRows.length, offset: 0, height: flatRows.length * 44, items: flatRows, total: flatRows.length,
  }

  const closeWithRestore = (): void => {
    conversationAbort.current?.abort()
    workspaceAbort.current?.abort()
    props.onClose()
    props.restoreFocus?.()
  }

  const openDescriptor = (entry: PaneManagementEntryV1, targetGroupId?: string, splitEdge?: 'right' | 'bottom'): void => {
    const descriptor = entry.descriptor ?? props.registry.get(entry.kind)?.descriptor
    if (descriptor === undefined) return
    props.controller.openView({
      kind: descriptor.kind,
      resourceKey: `view:${descriptor.kind}`,
      role: descriptor.role,
      preferredRegion: descriptor.preferredRegion,
      retention: descriptor.retention,
      singleton: descriptor.singleton,
      pinned: management.workspace.pinnedResourceKeys.includes(`view:${descriptor.kind}`),
      title: descriptor.label,
      ...(targetGroupId === undefined ? {} : { targetGroupId }),
    })
    if (splitEdge !== undefined) {
      const nextState = props.controller.getSnapshot()
      const opened = Object.values(nextState.views).find(view => view.kind === descriptor.kind && view.resourceKey === `view:${descriptor.kind}`)
      const target = targetGroupId === undefined ? activeGroup(props.controller) : nextState.groups[targetGroupId]
      if (opened !== undefined && target !== undefined) props.controller.dispatch({ type: 'split_with_view', viewId: opened.id, targetGroupId: target.id, edge: splitEdge })
    }
    closeWithRestore()
  }

  const activateEntry = (entry: PaneManagementEntryV1, shift = false): void => {
    if (entry.workspaceRef !== undefined) {
      const item = workspaceSearch.items.find(candidate => entry.key === `workspace:${candidate.workspaceRef}:${candidate.ref}`)
      if (item !== undefined) void props.workspaceContext?.open?.(item)
      closeWithRestore()
      return
    }
    if (entry.source === 'pane') {
      if (shift) setTargetEntry(entry)
      else openDescriptor(entry)
      return
    }
    if (entry.source === 'tab' && entry.viewId !== undefined) {
      props.controller.dispatch({ type: 'activate_view', viewId: entry.viewId })
      closeWithRestore()
      return
    }
    if (entry.source === 'history' && entry.historyBatchId !== undefined) {
      props.controller.restoreClosedBatch(entry.historyBatchId)
      closeWithRestore()
      return
    }
    if (entry.source === 'conversation') {
      const item = conversation.items.find(candidate => entry.key === `conversation:${candidate.sessionRef}:${candidate.messageRef}`)
      if (item !== undefined) void props.conversationSearch?.open(item)
      closeWithRestore()
    }
  }

  const toggleSelection = (entry: PaneManagementEntryV1): void => {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(entry.key)) next.delete(entry.key)
      else next.add(entry.key)
      return next
    })
  }

  const selectedViews = (): readonly PaneViewInstanceV1[] => {
    const keys = selected
    return entries.flatMap(entry => entry.source === 'tab' && entry.viewId !== undefined && keys.has(entry.key)
      ? [workspace.views[entry.viewId]].filter((view): view is PaneViewInstanceV1 => view !== undefined)
      : [])
  }

  const closeSelectedSafely = (viewIds = selectedViews().map(view => view.id)): void => {
    if (viewIds.length === 0) return
    const groupId = activeGroup(props.controller)?.id ?? workspace.views[viewIds[0]!]?.groupId
    if (groupId === undefined) return
    const result = props.controller.dispatch({ type: 'bulk_close_safe', groupId, mode: 'group', viewIds })
    const outcome = result.details?.bulkCloseSafe
    if (outcome !== undefined) {
      setProtectedViews(outcome.protectedViews)
      setNotice(outcome.protectedViews.length > 0
        ? formatT('management.protectedCount', { count: outcome.protectedViews.length })
        : formatT('management.closedCount', { count: outcome.closedViewIds.length }))
    }
    setSelected(new Set())
  }

  const confirmProtectedClose = (item: PaneBulkCloseProtectedViewV1): void => {
    if (item.reason === 'deny' || item.reason === 'unknown') return
    const result = props.controller.dispatch({ type: 'close_view', viewId: item.viewId, decision: 'allow' })
    if (!result.accepted) return
    setProtectedViews(current => current.filter(candidate => candidate.viewId !== item.viewId))
  }

  const createGroup = (): void => {
    const label = newGroup.trim()
    if (label.length === 0) return
    props.controller.saveCustomGroup({ label })
    setNewGroup('')
  }

  const addSelectedToGroup = (): void => {
    if (groupForSelection.length === 0) return
    props.controller.addKindsToCustomGroup(groupForSelection, selectedViews().map(view => view.kind))
    setNotice(groupLabel(groupForSelection, customLabels.get(groupForSelection)))
  }

  const pinSelected = (pinned: boolean): void => {
    for (const view of selectedViews()) props.controller.dispatch({ type: 'pin_view', viewId: view.id, pinned })
    setSelected(new Set())
  }

  const moveSelected = (): void => {
    if (moveTargetGroup.length === 0) return
    for (const view of selectedViews()) props.controller.dispatch({ type: 'move_view', viewId: view.id, targetGroupId: moveTargetGroup })
    setSelected(new Set())
  }

  const rowNodes = (rows: readonly PaneManagementEntryV1[], offset = 0): ReactNode[] => rows.map((entry, index) => {
    const selectedRow = selected.has(entry.key)
    return createElement('div', {
      key: entry.key,
      className: `pwr-management-row ys-row ${selectedRow ? 'pwr-management-row-selected' : ''}`,
      'data-pane-management-entry': entry.key,
      'data-pane-management-source': entry.source,
    },
    mode === 'manage' && entry.source === 'tab' ? createElement('input', {
      type: 'checkbox', checked: selectedRow, 'aria-label': entry.title,
      onChange: () => toggleSelection(entry),
    }) : null,
    createElement('button', {
      type: 'button',
      className: 'pwr-management-row-main',
      'data-pane-management-index': offset + index,
      onClick: () => activateEntry(entry),
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); activateEntry(entry, true); return }
        if (event.key === 'ArrowRight') { event.preventDefault(); setDetailKey(entry.key); return }
        if (event.key === 'ArrowLeft') { event.preventDefault(); setDetailKey(undefined) }
      },
    },
    createElement(WorkbenchIcon, { name: iconForEntry(entry), size: 16 }),
      createElement('span', { className: 'pwr-management-row-copy' },
      createElement('strong', null, entry.title),
      createElement('small', null, `${sourceLabel(entry.source)} · ${groupLabel(entry.groupId, customLabels.get(entry.groupId))}${entry.workspaceRef === undefined ? '' : ` · ${workspaceTargets.find(target => target.workspaceRef === entry.workspaceRef)?.label ?? entry.workspaceRef}`}`),
      entry.description === undefined ? null : createElement('small', { className: 'pwr-management-row-desc', title: entry.description }, entry.description)),
    entry.statusTokens.length === 0 ? null : createElement('span', { className: 'pwr-management-status' }, entry.statusTokens.join(' · '))),
    createElement('button', {
      type: 'button', className: 'pwr-management-info',
      title: t('management.details.toggle'),
      'aria-label': `${t('management.details.toggle')}: ${entry.title}`,
      'aria-expanded': detailKey === entry.key,
      onClick: () => { setDetailKey(current => current === entry.key ? undefined : entry.key) },
    }, createElement(WorkbenchIcon, { name: 'more', size: 14 })),
    entry.source === 'pane' ? createElement('button', {
      type: 'button', className: 'pwr-management-star',
      title: entry.pinned ? t('management.unfavorite') : t('management.favorite'),
      'aria-label': entry.pinned ? t('management.unfavorite') : t('management.favorite'),
      onClick: () => props.controller.toggleFavorite(entry.kind),
    }, createElement(WorkbenchIcon, { name: entry.pinned ? 'unpin' : 'pin', size: 14 })) : null)
  })

  const onDialogKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') {
      // The Modal primitive closes on any document-level Escape; owning the chain here
      // keeps the nested dismiss order (detail → target → dialog) intact.
      event.preventDefault()
      event.stopPropagation()
      if (detailKey !== undefined) hideDetail()
      else if (targetEntry !== undefined) setTargetEntry(undefined)
      else closeWithRestore()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
    if (flatRows.length === 0) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? flatRows.length - 1
      : Math.max(0, Math.min(flatRows.length - 1, focusedIndex + (event.key === 'ArrowDown' ? 1 : -1)))
    setFocusedIndex(next)
    const target = rootRef.current?.querySelector<HTMLElement>(`[data-pane-management-index='${next}']`)
    target?.focus()
  }

  return createElement(Modal, {
    open: true,
    onClose: closeWithRestore,
    title: t('management.title'),
    closeLabel: t('chrome.closeViewSelector'),
    headless: true,
  }, createElement(Surface, { kind: 'dialog' }, createElement('section', {
    ref: rootRef,
    className: 'pwr-management-center',
    'aria-label': t('management.title'),
    'data-pane-management-mode': mode,
    onKeyDown: onDialogKeyDown,
  },
  createElement('header', { className: 'pwr-management-header' },
    createElement('div', { className: 'pwr-management-modes', role: 'tablist', 'aria-label': t('management.title') },
      createElement('button', { type: 'button', role: 'tab', 'aria-selected': mode === 'open', onClick: () => { setMode('open'); setSource('all') } }, t('management.openMode')),
      createElement('button', { type: 'button', role: 'tab', 'aria-selected': mode === 'manage', onClick: () => { setMode('manage'); setSource('tab') } }, t('management.manageMode'))),
    createElement('button', { type: 'button', className: 'pwr-icon', onClick: closeWithRestore, 'aria-label': t('chrome.closeViewSelector') }, createElement(WorkbenchIcon, { name: 'close' }))),
  createElement('div', { className: 'pwr-management-search' },
    createElement(WorkbenchIcon, { name: 'search', size: 16 }),
    createElement('input', {
      ref: searchRef,
      type: 'search',
      value: query,
      placeholder: t('management.search.placeholder'),
      'aria-label': t('management.search.placeholder'),
      onChange: (event: ChangeEvent<HTMLInputElement>) => { setQuery(event.currentTarget.value); setFocusedIndex(0); setScrollTop(0); setDetailKey(undefined) },
    })),
  createElement('div', { className: 'pwr-management-filters', role: 'toolbar', 'aria-label': t('management.title') },
    ...(['all', 'pane', 'tab', 'history'] as const).map(value => createElement('button', {
      key: value, type: 'button', 'aria-pressed': source === value, onClick: () => setSource(value),
    }, value === 'all' ? t('management.title') : sourceLabel(value))),
    createElement('button', {
      type: 'button',
      'aria-pressed': conversationEnabled,
      disabled: props.conversationSearch === undefined,
      title: props.conversationSearch === undefined ? t('management.conversationUnavailable') : undefined,
      onClick: () => setIncludeConversation(value => !value),
    }, t('management.includeConversation')),
    createElement('span', { className: 'pwr-management-scope' }, formatT('management.currentScope', { scope: t(`management.scope.${management.scope.kind}`) }))),
  createElement('div', { className: 'pwr-management-advanced-filters ys-field', 'aria-label': t('management.filters') },
    createElement('select', { value: groupFilter, onChange: (event: ChangeEvent<HTMLSelectElement>) => setGroupFilter(event.currentTarget.value), 'aria-label': t('management.filter.group') },
      createElement('option', { value: 'all' }, t('management.filter.group')),
      ...groups.map(group => createElement('option', { key: group, value: group }, groupLabel(group, customLabels.get(group))))),
    createElement('select', { value: regionFilter, onChange: (event: ChangeEvent<HTMLSelectElement>) => setRegionFilter(event.currentTarget.value), 'aria-label': t('management.filter.region') },
      createElement('option', { value: 'all' }, t('management.filter.region')),
      ...regions.map(region => createElement('option', { key: region, value: region }, region))),
    createElement('select', { value: ownerFilter, onChange: (event: ChangeEvent<HTMLSelectElement>) => setOwnerFilter(event.currentTarget.value), 'aria-label': t('management.filter.owner') },
      createElement('option', { value: 'all' }, t('management.filter.owner')),
      ...owners.map(owner => createElement('option', { key: owner, value: owner }, owner))),
    createElement('select', { value: kindFilter, onChange: (event: ChangeEvent<HTMLSelectElement>) => setKindFilter(event.currentTarget.value), 'aria-label': t('management.filter.type') },
      createElement('option', { value: 'all' }, t('management.filter.type')),
      ...kinds.map(kind => createElement('option', { key: kind, value: kind }, kind))),
    createElement('select', { value: statusFilter, onChange: (event: ChangeEvent<HTMLSelectElement>) => setStatusFilter(event.currentTarget.value), 'aria-label': t('management.filter.status') },
      createElement('option', { value: 'all' }, t('management.filter.status')),
      ...statuses.map(status => createElement('option', { key: status, value: status }, status))),
    createElement('select', { value: pinnedFilter, onChange: (event: ChangeEvent<HTMLSelectElement>) => setPinnedFilter(event.currentTarget.value), 'aria-label': t('management.filter.pinned') },
      createElement('option', { value: 'all' }, t('management.filter.pinned')),
      createElement('option', { value: 'pinned' }, t('management.filter.onlyPinned')),
      createElement('option', { value: 'unpinned' }, t('management.filter.onlyUnpinned'))),
    createElement('select', { value: workspaceFilter, disabled: props.workspaceContext?.search === undefined, onChange: (event: ChangeEvent<HTMLSelectElement>) => setWorkspaceFilter(event.currentTarget.value), 'aria-label': t('management.filter.workspace') },
      createElement('option', { value: 'current' }, t('management.filter.currentWorkspace')),
      workspaceTargets.length > 1 ? createElement('option', { value: 'all' }, t('management.filter.allWorkspaces')) : null,
      ...workspaceTargets.filter(target => target.workspaceRef !== management.scope.ref).map(target => createElement('option', { key: target.workspaceRef, value: target.workspaceRef }, target.label)))),
  notice === undefined ? null : createElement('p', { className: 'pwr-management-notice', role: 'status' }, notice),
  protectedViews.length === 0 ? null : createElement('section', { className: 'pwr-management-protected', 'aria-label': t('management.protectedTitle') },
    createElement('strong', null, t('management.protectedTitle')),
    ...protectedViews.map(item => {
      const view = workspace.views[item.viewId]
      const closable = item.reason !== 'deny' && item.reason !== 'unknown'
      return createElement('div', { key: item.viewId, className: 'pwr-management-protected-row' },
        createElement('span', null, view?.title ?? item.viewId),
        createElement('small', null, t(`management.protectedReason.${item.reason}`)),
        closable ? createElement('button', { type: 'button', onClick: () => confirmProtectedClose(item) }, t('management.confirmClose')) : null)
    })),
  conversation.status === 'error' ? createElement('p', { className: 'pwr-management-notice', role: 'alert' }, conversation.reason) : null,
  workspaceSearch.status === 'error' ? createElement('p', { className: 'pwr-management-notice', role: 'alert' }, workspaceSearch.reason) : null,
  detailEntry === undefined ? null : detailPanel(detailEntry),
  showSearchResults || flatRows.length > 50
    ? createElement('div', {
      className: 'pwr-management-list pwr-management-list-virtual',
      onScroll: (event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop),
    }, createElement('div', { style: { height: virtual.height, position: 'relative' } },
      createElement('div', { style: { transform: `translateY(${virtual.offset}px)` } }, ...rowNodes(virtual.items, virtual.start))),
      results.length === 0 ? createElement('p', { className: 'pwr-empty' }, t('management.noResults')) : null,
      conversation.nextCursor === undefined ? null : createElement('button', {
        type: 'button', className: 'pwr-management-load-more', disabled: conversation.status === 'loading',
        onClick: () => loadConversation(conversation.nextCursor, true),
      }, t('management.loadMore')),
      workspaceSearch.nextCursor === undefined ? null : createElement('button', {
        type: 'button', className: 'pwr-management-load-more', disabled: workspaceSearch.status === 'loading',
        onClick: () => loadWorkspaceSearch(workspaceSearch.nextCursor, true),
      }, t('management.loadMore')))
    : createElement('div', { className: 'pwr-management-list' },
      ...[...displayGroups.entries()]
        .sort(([left], [right]) => {
          const leftCustom = management.profile.groups.find(group => group.id === left)
          const rightCustom = management.profile.groups.find(group => group.id === right)
          if (leftCustom !== undefined || rightCustom !== undefined) {
            const customRank = (group: typeof leftCustom): number => group === undefined ? 50 : group.pinned ? 2 : 40
            return customRank(leftCustom) - customRank(rightCustom)
              || (leftCustom?.order ?? 0) - (rightCustom?.order ?? 0)
              || groupLabel(left, customLabels.get(left)).localeCompare(groupLabel(right, customLabels.get(right)))
          }
          const leftIndex = GROUP_ORDER.indexOf(left as typeof GROUP_ORDER[number])
          const rightIndex = GROUP_ORDER.indexOf(right as typeof GROUP_ORDER[number])
          return (leftIndex < 0 ? 100 : leftIndex) - (rightIndex < 0 ? 100 : rightIndex)
            || groupLabel(left, customLabels.get(left)).localeCompare(groupLabel(right, customLabels.get(right)))
        })
        .flatMap(([groupId, rows]) => rows.length === 0 ? [] : [
          createElement('section', { key: groupId, className: 'pwr-management-group', 'aria-label': groupLabel(groupId, customLabels.get(groupId)) },
            createElement('h3', null, groupLabel(groupId, customLabels.get(groupId))),
            ...rowNodes([...rows].sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || left.title.localeCompare(right.title)))),
        ])),
  mode === 'open' && management.profile.groups.length > 0 ? createElement('div', { className: 'pwr-management-custom-groups', 'aria-label': t('management.customGroups') },
    ...management.profile.groups.map(group => createElement('div', { key: group.id },
      createElement('input', {
        value: groupDrafts[group.id] ?? group.label,
        'aria-label': t('management.groupName'),
        onChange: (event: ChangeEvent<HTMLInputElement>) => setGroupDrafts(current => ({ ...current, [group.id]: event.currentTarget.value })),
        onBlur: () => {
          const label = groupDrafts[group.id]
          if (label !== undefined) props.controller.editCustomGroup(group.id, { label })
        },
      }),
      createElement('button', { type: 'button', title: t('management.pinGroup'), 'aria-label': t('management.pinGroup'), onClick: () => props.controller.editCustomGroup(group.id, { pinned: !group.pinned }) }, createElement(WorkbenchIcon, { name: group.pinned ? 'unpin' : 'pin', size: 13 })),
      createElement('button', { type: 'button', title: t('management.moveGroupUp'), 'aria-label': t('management.moveGroupUp'), onClick: () => props.controller.editCustomGroup(group.id, { move: -1 }) }, '↑'),
      createElement('button', { type: 'button', title: t('management.moveGroupDown'), 'aria-label': t('management.moveGroupDown'), onClick: () => props.controller.editCustomGroup(group.id, { move: 1 }) }, '↓'),
      createElement('button', { type: 'button', title: t('management.deleteGroup'), 'aria-label': t('management.deleteGroup'), onClick: () => props.controller.deleteCustomGroup(group.id) }, createElement(WorkbenchIcon, { name: 'close', size: 13 })))),
  ) : null,
  mode === 'manage' ? createElement('footer', { className: 'pwr-management-footer ys-field' },
    createElement('button', { type: 'button', disabled: selected.size === 0, onClick: () => pinSelected(true) }, t('management.pinSelected')),
    createElement('button', { type: 'button', disabled: selected.size === 0, onClick: () => pinSelected(false) }, t('management.unpinSelected')),
    createElement('button', { type: 'button', disabled: selected.size === 0, onClick: () => closeSelectedSafely() }, t('management.closeSelected')),
    createElement('button', {
      type: 'button', onClick: () => closeSelectedSafely(Object.values(workspace.views).filter(view => !view.pinned).map(view => view.id)),
    }, t('management.closeUnpinned')),
    createElement('button', { type: 'button', disabled: management.history.length === 0, onClick: () => props.controller.restoreClosedBatch() }, t('management.restoreLast')),
    createElement('select', { value: moveTargetGroup, onChange: (event: ChangeEvent<HTMLSelectElement>) => setMoveTargetGroup(event.currentTarget.value), 'aria-label': t('management.moveSelected') },
      createElement('option', { value: '' }, t('management.moveSelected')),
      ...Object.values(workspace.groups).map(group => createElement('option', { key: group.id, value: group.id }, groupPlacementLabel(group)))),
    createElement('button', { type: 'button', disabled: selected.size === 0 || moveTargetGroup.length === 0, onClick: moveSelected }, t('management.moveSelected')),
    createElement('select', { value: groupForSelection, onChange: (event: ChangeEvent<HTMLSelectElement>) => setGroupForSelection(event.currentTarget.value), 'aria-label': t('management.createGroup') },
      createElement('option', { value: '' }, t('management.createGroup')),
      ...management.profile.groups.map(group => createElement('option', { key: group.id, value: group.id }, group.label))),
    createElement('button', { type: 'button', disabled: selected.size === 0 || groupForSelection.length === 0, onClick: addSelectedToGroup }, t('management.createGroup')),
  ) : createElement('footer', { className: 'pwr-management-footer ys-field' },
    createElement('input', { value: newGroup, placeholder: t('management.groupName'), 'aria-label': t('management.groupName'), onChange: (event: ChangeEvent<HTMLInputElement>) => setNewGroup(event.currentTarget.value) }),
    createElement('button', { type: 'button', disabled: newGroup.trim().length === 0, onClick: createGroup }, t('management.createGroup'))),
  targetEntry === undefined ? null : createElement('div', { className: 'pwr-management-target', role: 'dialog', 'aria-label': t('management.target') },
    createElement('strong', null, targetEntry.title),
    createElement('button', { type: 'button', onClick: () => openDescriptor(targetEntry) }, t('management.targetCurrent')),
    ...Object.values(workspace.groups).map(group => createElement('button', {
      key: group.id,
      type: 'button',
      disabled: group.locked && group.role !== targetEntry.role,
      onClick: () => openDescriptor(targetEntry, group.id),
    }, groupPlacementLabel(group))),
    createElement('button', {
      type: 'button',
      disabled: (props.controller.experienceTier?.getSnapshot().tier ?? 1) === 0,
      title: (props.controller.experienceTier?.getSnapshot().tier ?? 1) === 0 ? t('reason.geometryTier0') : undefined,
      onClick: () => openDescriptor(targetEntry, activeGroup(props.controller)?.id, 'right'),
    }, formatT('tab.splitEdge', { edge: t('drag.edge.right') })),
    createElement('button', {
      type: 'button',
      disabled: (props.controller.experienceTier?.getSnapshot().tier ?? 1) === 0,
      title: (props.controller.experienceTier?.getSnapshot().tier ?? 1) === 0 ? t('reason.geometryTier0') : undefined,
      onClick: () => openDescriptor(targetEntry, activeGroup(props.controller)?.id, 'bottom'),
    }, formatT('tab.splitEdge', { edge: t('drag.edge.bottom') }))),
  )))
}

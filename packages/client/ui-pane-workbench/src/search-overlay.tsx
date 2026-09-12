import {
  createElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CompositionEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { SearchResultActions } from './search-result-actions.js'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { PaneCommandRegistry } from './composition.js'
import type { PaneWorkbenchController } from './controller.js'
import { WorkbenchIcon } from './icon.js'
import { formatT, getActiveLocale, getLocaleRevision, subscribeLocale, t } from './i18n/locale.js'
import { probeWorkbenchStorage } from './browser-storage.js'
import type { PaneConversationSearchHostV1, PaneWorkspaceContextProviderV1, PaneWorkspaceSearchTargetV1 } from './management.js'
import { createWorkspaceSearchHistoryAdapter } from './search-adapter.js'
import { DEFAULT_WORKSPACE_SEARCH_FILTERS, type WorkspaceSearchCategoryV1, type WorkspaceSearchFiltersV1, type WorkspaceSearchGroupV1 } from './search-group.js'
import { collectWorkspaceSearchCandidates, type WorkspaceSearchCandidateV1 } from './search-identity.js'
import { highlightWorkspaceSearchText, matchWorkspaceSearchCandidate } from './search-match.js'
import {
  activateWorkspaceSearchCandidate,
  WORKSPACE_SEARCH_DRAG_MIME,
  workspaceSearchDragPayload,
  type WorkspaceSearchOpenPlacementV1,
} from './search-open.js'
import { useSearchVisualViewport, SEARCH_VISUAL_VIEWPORT_STYLES } from './search-visual-viewport.js'
import { SearchResultAnnouncement, SEARCH_ANNOUNCEMENT_STYLES } from './search-announcement.js'
import { WorkspaceSearchPreferenceStore } from './search-preferences.js'
import { probeWorkspaceSearchHistoryAdapter, WorkspaceSearchCoordinator, type WorkspaceSearchHistoryAdapterV1 } from './search-query.js'
import type { PaneViewRegistry } from './view-registry.js'
import { REGION_STYLES } from './chrome/shared.js'
import { isSessionListConversationSearchHost, getSessionListSearchSeam, projectSessionListSnapshot } from './conversation-search-host.js'
import { SEARCH_CENTER_FAMILIES, legacySearchResourceKind, searchCenterResourceKinds, type SearchCenterCategory, type SearchCenterResourceKind, type SearchCenterQuickView } from './search-catalog.js'
import { SearchCenterCategorySelect, SearchCenterDiscovery, SearchCenterSidebar, SEARCH_CENTER_NAVIGATION_STYLES } from './search-center-navigation.js'
import { DEFAULT_SEARCH_CENTER_CONTROLS, hasSearchCenterConstraints, type SearchCenterControls } from './search-controls.js'
import { requestSearchPaneHandoff, searchHandoffChannel, type SearchCenterHandoff } from './search-handoff.js'
import { SearchCenterPreview, SEARCH_CENTER_PREVIEW_STYLES } from './search-center-preview.js'
import { searchSourcesFor } from './search-source-registry.js'
import type { SearchCenterResult } from './search-source.js'
import { SearchProviderResults, visibleProviderResults } from './search-provider-results.js'
import { SearchCenterFilters, SEARCH_CENTER_FILTER_STYLES } from './search-center-filters.js'
import { cycleSearchDialogFocus, SEARCH_FOCUS_STYLES } from './search-focus.js'
import { SearchCompactPanel, SEARCH_COMPACT_PANEL_STYLES } from './search-compact-panel.js'

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

function statusReason(status: string, reason?: string): string {
  if (reason === 'source_controls_unsupported' || reason === 'status_filter_unsupported') return t('search.center.sourceControlsUnsupported')
  if (reason === 'session_unavailable') return t('search.center.sessionScopeUnavailable')
  if (reason === 'project_unavailable') return t('search.center.scopeUnavailable')
  if (reason === 'source_scope_mismatch') return t('search.center.scopeMismatch')
  if (reason === 'cursor_stale') return t('search.center.cursorStale')
  if (reason === 'opened_filter_unsupported') return t('search.center.openedUnsupported')
  if (reason === 'time:unavailable') return t('search.timeUnavailable')
  if (reason === 'project_scope_unsupported') return t('search.center.projectUnsupported')
  if (reason === 'search_timeout') return t('search.center.timeout')
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
  const localeRevision = useSyncExternalStore(subscribeLocale, getLocaleRevision, getLocaleRevision)
  const workspace = useSyncExternalStore(props.controller.subscribeWorkspace, props.controller.getSnapshot, props.controller.getSnapshot)
  const management = useSyncExternalStore(props.controller.subscribeManagement, props.controller.getManagementSnapshot, props.controller.getManagementSnapshot)
  const contextRevision = useSyncExternalStore(
    useCallback(listener => props.workspaceContext?.subscribe?.(listener) ?? (() => {}), [props.workspaceContext]),
    useCallback(() => props.workspaceContext?.getSnapshot().revision ?? '', [props.workspaceContext]),
    () => '',
  )
  const currentWorkspaceRef = props.workspaceContext?.getSnapshot().workspaceRef ?? (management.scope.kind === 'workspace' ? management.scope.ref : undefined)
  const workspaceTargets = useMemo(() => {
    const targets = new Map<string, PaneWorkspaceSearchTargetV1>()
    for (const target of props.workspaceContext?.listWorkspaces?.() ?? []) targets.set(target.workspaceRef, target)
    if (currentWorkspaceRef !== undefined && !targets.has(currentWorkspaceRef)) targets.set(currentWorkspaceRef, { workspaceRef: currentWorkspaceRef, label: t('search.center.currentProject') })
    return [...targets.values()]
  }, [props.workspaceContext, contextRevision, currentWorkspaceRef, localeRevision])
  const sessionList = props.conversationSearch === undefined ? undefined : getSessionListSearchSeam(props.conversationSearch)?.list
  const [sessionRoster, setSessionRoster] = useState(() => ({ list: sessionList, targets: projectSessionListSnapshot(sessionList?.getSnapshot() ?? {}) }))
  useEffect(() => {
    const refresh = () => setSessionRoster({ list: sessionList, targets: projectSessionListSnapshot(sessionList?.getSnapshot() ?? {}) })
    const off = sessionList?.subscribe?.(refresh)
    refresh()
    return off
  }, [sessionList])
  const sessionTargets = sessionRoster.list === sessionList ? sessionRoster.targets : []
  const [, setTick] = useState(0)
  const sourceRegistry = useMemo(() => searchSourcesFor(props.controller), [props.controller])
  const sourceDescriptors = useSyncExternalStore(sourceRegistry.subscribe, sourceRegistry.getSnapshot, sourceRegistry.getSnapshot)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [centerCategory, setCenterCategory] = useState<SearchCenterCategory>('all')
  const [quickView, setQuickView] = useState<SearchCenterQuickView>()
  const [previewLimit, setPreviewLimit] = useState(5)
  const resourceKinds = useMemo(() => searchCenterResourceKinds(centerCategory), [centerCategory])
  const listboxId = useId()
  const [composing, setComposing] = useState(false)
  const [filters, setFilters] = useState<WorkspaceSearchFiltersV1>(() => ({ ...DEFAULT_WORKSPACE_SEARCH_FILTERS,
    allAccessibleProjects: currentWorkspaceRef === undefined, ...(currentWorkspaceRef === undefined ? {} : { projectRef: currentWorkspaceRef }) }))
  const [controls, setControls] = useState<SearchCenterControls>(DEFAULT_SEARCH_CENTER_CONTROLS)
  const [followContext, setFollowContext] = useState(true)
  const selectedWorkspaceRef = controls.sessionRef !== undefined || filters.allAccessibleProjects ? undefined : filters.projectRef ?? currentWorkspaceRef
  const scopeValid = controls.sessionRef !== undefined ? sessionTargets.some(target => target.sessionRef === controls.sessionRef) : selectedWorkspaceRef === undefined || workspaceTargets.some(target => target.workspaceRef === selectedWorkspaceRef)
  const [previewKey, setPreviewKey] = useState<string>()
  const [menuKey, setMenuKey] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [busyKey, setBusyKey] = useState<string>()
  const activationBusy = useRef(false)
  const openEpoch = useRef(0)
  useEffect(() => {
    openEpoch.current += 1
    setBusyKey(undefined)
  }, [query, centerCategory, quickView, filters, controls, contextRevision])
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const mode = props.mode ?? 'dialog'
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingTransfer = useRef<AbortController>()
  const pendingSourceOpen = useRef<AbortController>()
  useEffect(() => () => { pendingSourceOpen.current?.abort() }, [query, centerCategory, quickView, filters, controls, contextRevision])
  const [transferring, setTransferring] = useState(false)
  useEffect(() => () => { pendingTransfer.current?.abort() }, [query, centerCategory, quickView, filters, controls])
  const handoffChannel = useMemo(() => searchHandoffChannel(props.controller), [props.controller])
  const handoff = useSyncExternalStore(handoffChannel.subscribe, handoffChannel.getSnapshot, handoffChannel.getSnapshot)
  const [handoffFocus, setHandoffFocus] = useState(false)
  useEffect(() => {
    if (!handoffFocus) return
    const handle = setTimeout(() => { inputRef.current?.focus(); setHandoffFocus(false) }, 0)
    return () => clearTimeout(handle)
  }, [handoffFocus])
  const [handoffSelection, setHandoffSelection] = useState<string>()
  const [appliedHandoff, setAppliedHandoff] = useState<SearchCenterHandoff>()
  useEffect(() => {
    if (mode !== 'pane' || handoff === undefined || handoffChannel.getSnapshot() !== handoff) return
    setQuery(handoff.query)
    setCenterCategory(handoff.category)
    setQuickView(handoff.quickView)
    setFilters(handoff.filters)
    setControls(handoff.controls)
    setFollowContext(false)
    setPreviewLimit(handoff.previewLimit)
    setPreviewKey(undefined)
    setMenuKey(undefined)
    setHandoffSelection(handoff.selectedKey)
    setAppliedHandoff(handoff)
  }, [mode, handoff, handoffChannel])
  const listRef = useRef<HTMLDivElement>(null)
  const preferences = useMemo(() => new WorkspaceSearchPreferenceStore(props.storage ?? probeWorkbenchStorage()), [props.storage])
  const [preferenceRevision, setPreferenceRevision] = useState(0)
  const namedFilters = useMemo(() => preferences.load().namedFilters, [preferences, preferenceRevision])
  const recentRefs = useMemo(() => preferences.load().recent.map(item => item.stableKey), [preferences, preferenceRevision])
  const previousWorkspaceRef = useRef(currentWorkspaceRef)
  useEffect(() => {
    if (previousWorkspaceRef.current === currentWorkspaceRef) return
    previousWorkspaceRef.current = currentWorkspaceRef
    if (!followContext) return
    // Losing the active context does not prove the chosen project lost access.
    // Keep the explicit scope; scopeValid reports an actual removal from the roster.
    if (currentWorkspaceRef === undefined) return
    setFilters(current => ({ ...current, projectRef: currentWorkspaceRef, allAccessibleProjects: false }))
  }, [currentWorkspaceRef, followContext])

  const catalog = useMemo(() => collectWorkspaceSearchCandidates({
    registrations: props.registry.snapshot(),
    commands: props.commands?.snapshot(),
    state: workspace,
    profile: management.profile,
    recentRefs,
    projectRef: currentWorkspaceRef,
  }), [props.registry, props.commands, workspace, management, recentRefs, currentWorkspaceRef, catalogRevision])
  const locals = useMemo(() => catalog.filter(candidate => controls.sessionRef === undefined && resourceKinds.includes(legacySearchResourceKind(candidate)) && (quickView === undefined || candidate[quickView])), [catalog, resourceKinds, quickView, controls.sessionRef])

  const adapter = useMemo<WorkspaceSearchHistoryAdapterV1 | undefined>(() => !scopeValid ? {
    capability: 'denied' as const, reason: controls.sessionRef === undefined ? 'project_unavailable' : 'session_unavailable',
    search: async () => ({ items: [], status: 'permission_denied' as const, reason: controls.sessionRef === undefined ? 'project_unavailable' : 'session_unavailable' }),
  } : filters.openedOnly ? {
    capability: 'unavailable' as const, reason: 'opened_filter_unsupported',
    search: async () => ({ items: [], status: 'contract_mismatch' as const, reason: 'opened_filter_unsupported' }),
  } : quickView === undefined && resourceKinds.includes('session') ? createWorkspaceSearchHistoryAdapter({
    conversationSearch: props.conversationSearch,
    workspaceContext: controls.sessionRef === undefined ? props.workspaceContext : undefined,
    workspaceRef: currentWorkspaceRef,
    // Management persistence may use a synthetic session:root scope. Search is
    // project/profile-wide unless the user explicitly selects a session source.
  }) : undefined, [props.conversationSearch, props.workspaceContext, currentWorkspaceRef, contextRevision, resourceKinds, quickView, scopeValid, filters.openedOnly, controls.sessionRef])

  const localsRef = useRef(locals)
  localsRef.current = locals
  const coordinator = useMemo(() => new WorkspaceSearchCoordinator(() => localsRef.current, adapter), [adapter])
  useEffect(() => props.registry.subscribe(() => setCatalogRevision(value => value + 1)), [props.registry])
  useEffect(() => props.commands?.subscribe(() => setCatalogRevision(value => value + 1)), [props.commands])
  useEffect(() => {
    // React may replay effect setup/cleanup without replacing the memoized instance.
    coordinator.open()
    const unsubscribe = coordinator.subscribe(() => setTick(value => value + 1))
    const disconnect = coordinator.connectSources(sourceRegistry)
    const unsubscribeAdapter = adapter?.subscribe?.(() => coordinator.refreshSource())
    return () => {
      openEpoch.current += 1
      unsubscribe()
      unsubscribeAdapter?.()
      disconnect()
      coordinator.invalidate('close')
    }
  }, [coordinator, sourceRegistry, adapter])
  useEffect(() => { if (mode !== 'pane') inputRef.current?.focus() }, [mode])
  useEffect(() => {
    coordinator.setRequest({
      query,
      composing,
      filters: { ...filters, allAccessibleProjects: selectedWorkspaceRef === undefined, projectRef: selectedWorkspaceRef },
      locale: getActiveLocale(),
      profileRef: JSON.stringify([management.scope.ref, contextRevision]),
      projectRef: filters.projectRef,
      browse: centerCategory !== 'all' || quickView !== undefined,
      previewLimit,
      controls,
      sources: !scopeValid || quickView !== undefined ? undefined : {
        scope: controls.sessionRef !== undefined ? { kind: 'session', ref: controls.sessionRef } : selectedWorkspaceRef === undefined ? { kind: 'profile' } : { kind: 'workspace', ref: selectedWorkspaceRef },
        kinds: resourceKinds, owner: controls.owner, filters: {
          ...(controls.status === undefined ? {} : { status: controls.status }),
          ...(controls.updatedSince === undefined ? {} : { updatedSince: controls.updatedSince }),
          ...(filters.openedOnly ? { opened: 'true' } : {}),
        },
      },
    })
  }, [coordinator, query, composing, filters, management.scope.ref, centerCategory, previewLimit, quickView, controls, selectedWorkspaceRef, contextRevision, localeRevision, scopeValid, resourceKinds])

  const snapshot = coordinator.getSnapshot()
  useEffect(() => {
    if (handoffSelection === undefined) return
    coordinator.select(handoffSelection, { deferUntilVisible: true })
    setHandoffSelection(undefined)
  }, [coordinator, handoffSelection])
  useEffect(() => {
    if (!appliedHandoff || handoffSelection !== undefined) return
    // Acknowledge only after the restored state and selection have committed.
    if (handoffChannel.acknowledge(appliedHandoff)) setHandoffFocus(true)
    setAppliedHandoff(undefined)
  }, [appliedHandoff, handoffSelection, handoffChannel])
  const sourceVisible = visibleProviderResults(snapshot.sources ?? [], previewLimit)
  const selectedKey = snapshot.selectedKey
  const previewSource = scopeValid ? sourceVisible.find(result => result.stableKey === previewKey) : undefined
  const previewCandidate = scopeValid ? snapshot.local.visibleItems.find(item => item.stableKey === previewKey) : undefined
  const leavePreview = (): void => { setPreviewKey(undefined); inputRef.current?.focus() }
  const probe = probeWorkspaceSearchHistoryAdapter({
    search: props.conversationSearch?.search ?? props.workspaceContext?.search,
    capability: props.conversationSearch?.capability ?? (props.workspaceContext?.search === undefined ? undefined : 'pane.workspace-search.v1'),
  })
  const availableKinds = new Set<SearchCenterResourceKind>(['pane', 'command', 'compatibility-entry'])
  if (probe.capability === 'available') availableKinds.add('session')
  for (const source of sourceDescriptors) for (const kind of source.resourceKinds) availableKinds.add(kind)
  const categoryConnected = resourceKinds.some(kind => availableKinds.has(kind))
  const metadataOnly = isSessionListConversationSearchHost(props.conversationSearch)
  const metadataLane = metadataOnly && (controls.sessionRef !== undefined || typeof props.workspaceContext?.search !== 'function')
  const sourceOwners = [...new Set([...sourceDescriptors.filter(source => source.resourceKinds.some(kind => resourceKinds.includes(kind))).map(source => source.owner), ...locals.map(item => item.ownerRef), ...(resourceKinds.includes('session') && probe.capability === 'available' ? [controls.sessionRef === undefined && typeof props.workspaceContext?.search === 'function' ? 'dsh.workspace' : 'dsh.session'] : []), ...(controls.owner === undefined ? [] : [controls.owner])])].sort()
  const statuses = [...new Set([...sourceVisible.flatMap(result => result.adapter === 'source' && sourceDescriptors.some(source => source.id === result.sourceId && source.filters.includes('status')) && (result.resource.status ?? result.resource.availability) !== undefined ? [result.resource.status ?? result.resource.availability!] : []), ...locals.flatMap(item => item.status === undefined ? [] : [item.status]), ...(metadataLane && resourceKinds.includes('session') ? ['running', 'idle'] : []), ...(controls.status === undefined ? [] : [controls.status])])].sort()
  const canFilterTime = (metadataLane && selectedWorkspaceRef === undefined && resourceKinds.includes('session') && quickView === undefined) || sourceDescriptors.some(source => source.filters.includes('updatedSince') && source.resourceKinds.some(kind => resourceKinds.includes(kind)))
  const canSaveFilter = !hasSearchCenterConstraints(controls) && quickView === undefined && ['all', 'session', 'pane', 'command'].includes(centerCategory)

  const close = (): void => {
    pendingTransfer.current?.abort()
    pendingSourceOpen.current?.abort()
    openEpoch.current += 1
    coordinator.invalidate('close')
    props.onClose?.()
    props.restoreFocus?.()
  }

  const activate = async (candidate: WorkspaceSearchCandidateV1, placement: WorkspaceSearchOpenPlacementV1 = 'default'): Promise<void> => {
    if (activationBusy.current) return
    activationBusy.current = true
    const epoch = openEpoch.current
    setBusyKey(candidate.stableKey)
    const result = await activateWorkspaceSearchCandidate({
      candidate,
      controller: props.controller,
      registry: props.registry,
      commands: props.commands,
      conversationSearch: props.conversationSearch,
      workspaceContext: props.workspaceContext,
      placement,
    }).catch(() => ({ ok: false, reason: 'open_unconfirmed' }))
    activationBusy.current = false
    if (!mounted.current || epoch !== openEpoch.current) return
    setBusyKey(undefined)
    if (!result.ok) {
      setNotice(result.reason === 'geometry_unavailable' ? t('reason.geometryTier0')
        : result.reason?.endsWith('_placement_unsupported') ? t('search.center.placementUnsupported')
          : result.reason?.startsWith('command_') ? t('search.center.commandUnconfirmed') : t('search.openFailed'))
      return
    }
    const saved = preferences.recordOpen(candidate.stableKey)
    if (!saved.saved) setNotice(t('search.storageFailed'))
    else setPreferenceRevision(value => value + 1)
    if (mode === 'dialog') close()
  }

  const activateSource = async (result: SearchCenterResult): Promise<void> => {
    if (activationBusy.current) return
    activationBusy.current = true
    const epoch = openEpoch.current
    setBusyKey(result.stableKey)
    const operation = new AbortController()
    pendingSourceOpen.current = operation
    const receipt = await sourceRegistry.open(result, operation.signal)
    if (pendingSourceOpen.current === operation) pendingSourceOpen.current = undefined
    activationBusy.current = false
    if (!mounted.current || epoch !== openEpoch.current) return
    setBusyKey(undefined)
    if (receipt.status !== 'opened') { setNotice(t('search.openFailed')); return }
    // V1 preferences retain only bounded opaque identities, never resource bodies.
    if (result.stableKey.length <= 240) {
      const saved = preferences.recordOpen(result.stableKey)
      if (saved.saved) setPreferenceRevision(value => value + 1)
      else setNotice(t('search.storageFailed'))
    }
    if (mode === 'dialog') close()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (composing || event.nativeEvent.isComposing) return
    if (event.key === 'Tab' && mode === 'dialog') {
      event.preventDefault(); event.stopPropagation()
      cycleSearchDialogFocus(event.currentTarget, event.shiftKey, inputRef.current)
      return
    }
    const fromInput = event.target === inputRef.current
    const target = event.target as HTMLElement
    if (event.key === 'Escape' && previewKey !== undefined) {
      event.preventDefault(); event.stopPropagation(); leavePreview(); return
    }
    if (target.closest('.pwr-search-preview') !== null) return
    if ((event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) && fromInput) {
      if (snapshot.local.visibleItems.some(item => item.stableKey === selectedKey)) {
        event.preventDefault(); event.stopPropagation(); setMenuKey(selectedKey)
      }
      return
    }
    if (fromInput && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (menuKey !== undefined) { setMenuKey(undefined); return }
      if (mode === 'dialog') close()
      return
    }
    if (target.tagName === 'SELECT' || target.tagName === 'BUTTON') return
    if (event.key === 'Enter' && fromInput) { event.preventDefault(); event.stopPropagation() }
    const items = [...snapshot.local.visibleItems, ...sourceVisible]
    if (items.length === 0) return
    const index = items.findIndex(item => item.stableKey === selectedKey)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      event.stopPropagation()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : index < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
      coordinator.select(items[next]!.stableKey)
      listRef.current?.querySelector<HTMLElement>(`[data-search-option='${CSS.escape(items[next]!.stableKey)}']`)?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      event.stopPropagation()
      if (selectedKey !== undefined) setMenuKey(selectedKey)
      return
    }
    if (event.key === 'ArrowLeft' && menuKey !== undefined) {
      event.preventDefault()
      event.stopPropagation()
      setMenuKey(undefined)
      return
    }
    if (event.key === 'Enter' && selectedKey !== undefined) {
      const fromInput = document.activeElement === inputRef.current || event.target === inputRef.current
      if (!fromInput) return
      const current = items.find(item => item.stableKey === selectedKey)
      if (current !== undefined) {
        event.preventDefault()
        if ('adapter' in current) void activateSource(current)
        else void activate(current)
      }
    }
  }

  const setCategory = (category: SearchCenterCategory): void => {
    const nextKinds = searchCenterResourceKinds(category)
    const hasSessions = nextKinds.includes('session')
    const keepTime = hasSessions || sourceDescriptors.some(source => source.resourceKinds.some(kind => nextKinds.includes(kind)) && (source.filters.includes('updatedSince') || source.sorts.includes('updated')))
    const nextCatalog = catalog.filter(candidate => nextKinds.includes(legacySearchResourceKind(candidate)))
    const keepStatus = controls.status === undefined || sourceDescriptors.some(source => source.filters.includes('status') && source.resourceKinds.some(kind => nextKinds.includes(kind))) || (hasSessions && metadataLane && ['running', 'idle'].includes(controls.status)) || nextCatalog.some(candidate => candidate.status === controls.status)
    const keepOwner = controls.owner === undefined || sourceDescriptors.some(source => source.owner === controls.owner && source.resourceKinds.some(kind => nextKinds.includes(kind))) || (hasSessions && controls.owner === (controls.sessionRef === undefined && typeof props.workspaceContext?.search === 'function' ? 'dsh.workspace' : 'dsh.session')) || nextCatalog.some(candidate => candidate.ownerRef === controls.owner)
    if ((!keepTime && (controls.updatedSince !== undefined || controls.sort === 'updated')) || !keepStatus || !keepOwner) {
      setControls(current => ({ ...current, updatedSince: keepTime ? current.updatedSince : undefined,
        status: keepStatus ? current.status : undefined, owner: keepOwner ? current.owner : undefined,
        sort: !keepTime && current.sort === 'updated' ? 'relevance' : current.sort }))
      setNotice(t('search.center.conditionsRemoved'))
    }
    setCenterCategory(category)
    setQuickView(undefined)
    setPreviewLimit(category === 'all' ? 5 : 50)
    const legacyCategory: WorkspaceSearchCategoryV1 = category === 'session' || category === 'pane' || category === 'command' ? category : 'all'
    setFilters(current => ({
      ...current,
      category: legacyCategory,
      showCompatibility: category === 'compatibility-entry',
      ...(legacyCategory !== 'session' ? { timeRange: undefined } : {}),
      ...(legacyCategory !== 'command' ? { pluginOwner: undefined } : {}),
    }))
  }
  const navigation = { category: centerCategory, onChange: setCategory, availableKinds, quickView,
    onQuickView: (view: SearchCenterQuickView) => {
      setCategory('all'); setQuickView(view); setPreviewLimit(50)
      if (controls.updatedSince !== undefined || controls.sort === 'updated') {
        setControls(current => ({ ...current, updatedSince: undefined, sort: current.sort === 'updated' ? 'relevance' : current.sort }))
        setNotice(t('search.center.conditionsRemoved'))
      }
    } }
  const onControls = (next: SearchCenterControls): void => { setControls(next); setPreviewLimit(centerCategory === 'all' ? 5 : 50) }
  const filterProps = { sessions: sessionTargets, onSessionScope: (sessionRef: string) => {
    setFollowContext(false); setControls(current => ({ ...current, sessionRef })); setQuickView(undefined)
    setFilters(current => ({ ...current, projectRef: undefined, allAccessibleProjects: true }))
  }, workspaceRef: selectedWorkspaceRef, workspaces: workspaceTargets, controls, owners: sourceOwners, statuses,
    openedOnly: filters.openedOnly, canFilterTime,
    onScope: (workspaceRef: string | undefined) => {
      setControls(current => ({ ...current, sessionRef: undefined }))
      setFollowContext(false)
      setFilters(current => ({ ...current, projectRef: workspaceRef, allAccessibleProjects: workspaceRef === undefined }))
    },
    onControls,
    onOpenedOnly: () => setFilters(current => ({ ...current, openedOnly: !current.openedOnly })),
  }

  const viewportRoot = useRef<HTMLElement>(null)
  useSearchVisualViewport(viewportRoot)
  const body = createElement('section', {
    ref: viewportRoot,
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
        disabled: transferring,
        onClick: async () => {
          if (pendingTransfer.current) return
          const transfer = new AbortController()
          pendingTransfer.current = transfer
          setTransferring(true)
          const transferred = await requestSearchPaneHandoff(props.controller, props.registry, { query, category: centerCategory, quickView,
            filters: { ...filters, allAccessibleProjects: selectedWorkspaceRef === undefined, projectRef: selectedWorkspaceRef },
            controls, selectedKey, previewLimit }, transfer.signal)
          pendingTransfer.current = undefined
          if (!mounted.current) return
          setTransferring(false)
          if (transfer.signal.aborted) return
          if (!transferred) { setNotice(t('search.center.handoffFailed')); return }
          openEpoch.current += 1
          coordinator.invalidate('close')
          props.onClose?.()
        },
      }, createElement(WorkbenchIcon, { name: 'pin' })) : null,
      mode === 'dialog' ? createElement('button', {
        type: 'button',
        className: 'pwr-icon',
        'aria-label': t('chrome.closeViewSelector'),
        onClick: close,
      }, createElement(WorkbenchIcon, { name: 'close' })) : null)),
  createElement(SearchResultAnnouncement, {
    contextKey: JSON.stringify([query, centerCategory, quickView, filters, controls, localeRevision]),
    keys: [...snapshot.local.visibleItems.map(item => item.stableKey), ...sourceVisible.map(item => item.stableKey)],
    selectedKey, busy: snapshot.history.updating || snapshot.sources?.some(source => source.updating || source.page.status === 'loading') === true,
    composing, enabled: query.trim().length > 0 || centerCategory !== 'all' || quickView !== undefined,
  }),
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
      'aria-controls': listboxId,
      'aria-activedescendant': selectedKey === undefined || previewKey !== undefined ? undefined : `${listboxId}-${selectedKey}`,
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
  createElement(SearchCenterCategorySelect, navigation),
  createElement(SearchCompactPanel, { label: t('search.center.categoryPanel'), onReturn: () => inputRef.current?.focus(),
    children: done => createElement(SearchCenterSidebar, { ...navigation,
      onChange: category => { setCategory(category); if (!SEARCH_CENTER_FAMILIES.some(family => family.id === category)) done() },
      onQuickView: view => { navigation.onQuickView(view); done() },
    }),
  }),
  createElement(SearchCenterFilters, filterProps),
  createElement(SearchCompactPanel, { label: t('search.center.filterPanel'), onReturn: () => inputRef.current?.focus(),
    children: () => createElement(SearchCenterFilters, { ...filterProps, expanded: true }),
  }),
  createElement('div', { className: 'pwr-search-filters', role: 'toolbar', 'aria-label': t('search.filters') },
    centerCategory !== 'all' || quickView !== undefined || filters.openedOnly || filters.timeRange !== undefined || hasSearchCenterConstraints(controls) ? createElement('button', {
      type: 'button',
      className: 'pwr-search-clear-filters',
      onClick: () => { setCategory('all'); setControls({ ...DEFAULT_SEARCH_CENTER_CONTROLS, sessionRef: controls.sessionRef }); setFilters({ ...DEFAULT_WORKSPACE_SEARCH_FILTERS, projectRef: selectedWorkspaceRef, allAccessibleProjects: selectedWorkspaceRef === undefined }) },
    }, t('search.clearFilters')) : null,
    snapshot.local.activeFilterLabels.length > 0 ? createElement('button', {
      type: 'button',
      disabled: !canSaveFilter,
      title: canSaveFilter ? undefined : t('search.center.saveUnsupported'),
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
          setCenterCategory(restored.filters.category)
          setQuickView(undefined)
          setControls(DEFAULT_SEARCH_CENTER_CONTROLS)
          setFollowContext(false)
          setFilters(restored.filters)
          if (restored.staleProject) setNotice(t('search.staleProject'))
        },
      }, named.label))),
  createElement('div', { className: 'pwr-search-filter-chips', 'aria-label': t('search.filters') },
    centerCategory === 'all' ? null : createElement(Button, { variant: 'toolbar', size: 'sm', onClick: () => setCategory('all') }, t(`search.center.category.${centerCategory}`), ' ×'),
    controls.owner === undefined ? null : createElement(Button, { variant: 'toolbar', size: 'sm', onClick: () => onControls({ ...controls, owner: undefined }) }, `${t('search.center.owner')}: ${controls.owner} ×`),
    controls.status === undefined ? null : createElement(Button, { variant: 'toolbar', size: 'sm', onClick: () => onControls({ ...controls, status: undefined }) }, `${t('search.center.status')}: ${controls.status} ×`),
    controls.updatedSince === undefined ? null : createElement(Button, { variant: 'toolbar', size: 'sm', onClick: () => onControls({ ...controls, updatedSince: undefined }) }, `${t('search.center.updatedSince')}: ${controls.updatedSince.slice(0, 10)} ×`),
    controls.sort === 'relevance' ? null : createElement(Button, { variant: 'toolbar', size: 'sm', onClick: () => onControls({ ...controls, sort: 'relevance' }) }, t(`search.center.sort.${controls.sort}`), ' ×'),
    filters.timeRange !== 'unsupported' ? null : createElement(Button, { variant: 'toolbar', size: 'sm', onClick: () => setFilters(current => ({ ...current, timeRange: undefined })) }, t('search.timeUnavailable'), ' ×')),
  quickView !== undefined || !resourceKinds.includes('session') || snapshot.history.status === 'idle' || snapshot.history.status === 'ready' ? null : createElement('div', {
    className: `pwr-search-state pwr-search-state-${snapshot.history.status}`,
    role: snapshot.history.status === 'error' ? 'alert' : 'status',
  },
    snapshot.history.status === 'loading' ? createElement('span', { className: 'pwr-management-spinner', 'aria-hidden': true }) : createElement(WorkbenchIcon, { name: 'message', size: 14 }),
    createElement('span', null, snapshot.history.slow ? t('search.slow') : statusReason(snapshot.history.status, snapshot.history.reason)),
    (snapshot.history.status === 'error' || (snapshot.history.status === 'stale' && snapshot.history.reason !== undefined) || snapshot.history.reason === 'cursor_stale') && snapshot.history.reason !== 'permission_denied' && snapshot.history.reason !== 'contract_mismatch' && snapshot.history.reason !== 'project_unavailable'
      ? createElement('button', { type: 'button', onClick: () => coordinator.retry() }, t('management.search.retry'))
      : null),
  snapshot.notice === undefined ? null : createElement('p', { className: 'pwr-search-notice', role: 'status' }, t(`search.center.${snapshot.notice}`)),
  notice === undefined ? null : createElement('p', { className: 'pwr-search-notice', role: 'status' }, notice),
  (controls.updatedSince !== undefined || controls.sort === 'updated') && resourceKinds.some(kind => kind === 'pane' || kind === 'command') ? createElement('p', { className: 'pwr-search-coverage', role: 'status' }, t('search.center.catalogTimeUnsupported')) : null,
  selectedWorkspaceRef !== undefined && resourceKinds.includes('pane') ? createElement('p', { className: 'pwr-search-coverage' }, t('search.center.globalCatalogScope')) : null,
  quickView === undefined && resourceKinds.includes('session') && probe.capability === 'available' ? createElement('p', { className: 'pwr-search-coverage' }, t(metadataLane ? 'search.center.metadata' : 'search.center.unknownCoverage')) : null,
  createElement('div', { className: 'pwr-search-preview-control' },
    createElement(Button, { variant: 'toolbar', size: 'sm', disabled: selectedKey === undefined, onClick: () => { setMenuKey(undefined); setPreviewKey(selectedKey) } }, t('search.center.preview')),
    createElement(Button, { variant: 'toolbar', size: 'sm', disabled: !snapshot.local.visibleItems.some(item => item.stableKey === selectedKey),
      'aria-haspopup': 'menu', 'aria-expanded': menuKey !== undefined,
      onClick: () => setMenuKey(selectedKey) }, t('search.center.selectedActions'))),
  createElement('div', { className: 'pwr-search-content', 'data-preview': previewKey === undefined ? undefined : true },
  mode === 'pane' ? createElement(SearchCenterSidebar, navigation) : null,
  createElement('div', { className: 'pwr-search-main' },
  mode === 'pane' && query.trim().length === 0 && centerCategory === 'all' && quickView === undefined ? createElement(SearchCenterDiscovery, navigation) : null,
  categoryConnected ? null : createElement(SurfaceState, { phase: 'disabled', title: t('search.center.pending'), description: t('search.center.pendingDescription') }),
  createElement('div', {
    ref: listRef,
    id: listboxId,
    className: 'pwr-search-list',
    role: 'listbox',
    'aria-label': t('search.results'),
  },
    categoryConnected && snapshot.local.groups.length === 0 && (snapshot.sources?.length ?? 0) === 0 ? createElement('p', { className: 'pwr-empty' },
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
          className: `pwr-search-row${selected ? ' pwr-search-row-selected' : ''}`,
          'data-search-option': item.stableKey,
          draggable: true,
          onMouseMove: (event: ReactMouseEvent<HTMLDivElement>) => { if (event.movementX !== 0 || event.movementY !== 0) coordinator.select(item.stableKey) },
          onClick: () => { void activate(item) },
          onDragStart: (event: DragEvent<HTMLDivElement>) => {
            event.dataTransfer.setData(WORKSPACE_SEARCH_DRAG_MIME, workspaceSearchDragPayload(item))
            event.dataTransfer.effectAllowed = 'copyMove'
          },
        },
          createElement('div', { id: `${listboxId}-${item.stableKey}`, role: 'option',
            className: 'pwr-search-result-content', 'aria-label': item.title, 'aria-selected': selected },
          createElement(WorkbenchIcon, { name: item.semanticIcon, size: 16 }),
          createElement('span', { className: 'pwr-search-copy' },
            createElement('strong', null, ...titleParts.map((part, index) => createElement(part.match ? 'mark' : 'span', { key: index }, part.text))),
            createElement('small', null, [item.ownerRef, item.kind, item.opened ? t('search.filter.opened') : undefined, item.status].filter(Boolean).join(' · '))),
          item.availability === 'available' ? null : createElement('span', { className: 'pwr-search-status' }, item.reason ?? item.availability),
          busyKey === item.stableKey ? createElement('span', { className: 'pwr-management-spinner', 'aria-hidden': true }) : null),
          createElement(SearchResultActions, { item, controller: props.controller, open: menuKey === item.stableKey,
            onToggle: () => { coordinator.select(item.stableKey); setMenuKey(current => current === item.stableKey ? undefined : item.stableKey) },
            onClose: () => setMenuKey(undefined), onRestoreFocus: () => inputRef.current?.focus(),
            onActivate: placement => { void activate(item, placement) },
          }))
      }),
      group.collapsed || group.loadedCount <= group.items.length ? null : createElement(Button, {
        variant: 'toolbar', size: 'sm',
        onClick: () => {
          if (centerCategory === 'all' && quickView === undefined && (group.id === 'session' || group.id === 'pane' || group.id === 'command')) setCategory(group.id)
          else setPreviewLimit(limit => limit + 50)
        },
      }, t(centerCategory === 'all' && quickView === undefined ? 'search.center.viewAll' : 'search.center.showMore')))),
    createElement(SearchProviderResults, { groups: snapshot.sources ?? [], limit: previewLimit, selectedKey, busyKey, listboxId,
      onSelect: (key: string) => coordinator.select(key), onOpen: (result: SearchCenterResult) => { void activateSource(result) },
      onCategory: (kind: SearchCenterResourceKind) => { if (centerCategory === kind) setPreviewLimit(limit => limit + 50); else setCategory(kind) },
      onMore: (id: string, retry?: boolean) => coordinator.loadSourcePage(id, retry),
    }),
    snapshot.history.nextCursor === undefined ? null : createElement('button', {
      type: 'button',
      className: 'pwr-search-more-results',
      onClick: () => coordinator.loadMore(),
    }, t('management.loadMore')))),
  previewKey === undefined ? null : createElement(SearchCenterPreview, { candidate: previewCandidate, resource: previewSource?.adapter === 'source' ? previewSource.resource : undefined,
    onOpenResource: previewSource?.adapter === 'source' && sourceDescriptors.some(source => source.id === previewSource.sourceId && source.open) ? () => { void activateSource(previewSource) } : undefined,
    query, onBack: leavePreview, onOpen: (item: WorkspaceSearchCandidateV1) => { void activate(item) } })),
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

  const chrome = createElement('style', { 'data-workspace-search-styles': true }, REGION_STYLES + SEARCH_ANNOUNCEMENT_STYLES + SEARCH_FOCUS_STYLES + SEARCH_VISUAL_VIEWPORT_STYLES + SEARCH_CENTER_NAVIGATION_STYLES + SEARCH_CENTER_FILTER_STYLES + SEARCH_CENTER_PREVIEW_STYLES + SEARCH_COMPACT_PANEL_STYLES + '\n.pwr-search-modal{width:min(680px,100%);padding:0;gap:0;border-radius:12px;background:transparent}.pwr-search-modal .pwr-search{width:100%;max-width:none;max-height:min(640px,calc(100dvh - 48px))}')
  if (mode === 'pane') {
    return createElement(Surface, { kind: 'navigator', className: 'pwr-root pwr-search-surface', 'aria-label': t('search.title') }, chrome, body)
  }
  return createElement(Modal, {
    open: true,
    className: 'pwr-search-modal',
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

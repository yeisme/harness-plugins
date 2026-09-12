/**
 * DSH Tools workbench: safe catalog management plus tool details.
 *
 * The view never invokes tools, reads private arguments, or owns canonical
 * health/session state. Catalog mutations remain generation-CAS owner calls.
 * 调用活动/上下文洞察已移交 dsh-context 插件；本插件聚焦工具启停与 MCP 管理。
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type JSX, type ReactNode } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ToolsViewState } from './workspace-state.ts'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import type { ToolsHubBinding } from './binding.ts'
import { ToolsHubController, type ToolsHubControllerState } from './controller.ts'
import { catalogSources, countByAvailability, countByFamily, filterCatalog, purposeCategories, type EnabledFilter, type FamilyFilter, type PurposeFilter, type SourceFilter } from './filter.ts'
import type { DraftReferenceResult } from './draft-reference.ts'
import { en, type McpInspectorKey } from './locales.ts'
import { mcpInspectorStyles } from './styles.ts'
import type { ToolHubClientErrorCode } from './remote.ts'
import type { ToolHubHealthStateV1, ToolHubItemV1 } from './wire.ts'

export type ToolsTranslator = (key: McpInspectorKey, params?: Readonly<Record<string, string | number>>) => string
export type ToolsSection = 'catalog' | 'details'

export interface ToolsInspectorViewProps extends ConvViewProps {
  readonly binding?: ToolsHubBinding
  readonly controller?: ToolsHubController
  readonly t?: ToolsTranslator
}

export interface ToolsNotice {
  readonly key: 'notice.toggleSuccess' | 'notice.generationConflict' | 'notice.toggleFailure' | 'notice.draftAdded' | 'notice.draftAlreadyAdded' | 'notice.draftUnavailable'
  readonly tone: 'positive' | 'info' | 'warn' | 'critical'
  readonly reason?: string
}

export interface ToolsInspectorTreeProps {
  readonly renderReference?: (item: ToolHubItemV1, generation: number) => ReactNode
  readonly catalogState: ToolsHubControllerState
  readonly pendingId?: string
  readonly query: string
  readonly family: FamilyFilter
  readonly enabled: EnabledFilter
  readonly purpose?: PurposeFilter
  readonly source?: SourceFilter
  readonly sessionNotice?: string | undefined
  readonly selectedId?: string
  readonly activeSection?: ToolsSection
  readonly notice?: ToolsNotice
  readonly now?: number
  readonly canRefresh?: boolean
  readonly t?: ToolsTranslator
  readonly viewState?: ToolsViewState
  readonly toolbarActions?: ReactNode
  readonly contextLabel?: string
  readonly readOnlyCatalog?: boolean
  readonly globalManagement?: boolean
  readonly scope?: 'session' | 'installed'
  readonly boundSessionLabel?: string
  readonly boundSessionId?: string
  readonly instanceId?: string
  readonly preferChinesePurpose?: boolean
  readonly draftPendingId?: string
  readonly draftDisabledReason?: string
  readonly onAddToDraft?: (item: ToolHubItemV1) => Promise<DraftReferenceResult>
  readonly onScopeChange?: (scope: 'session' | 'installed') => void
  readonly onOpenSession?: () => void
  readonly onQueryChange: (query: string) => void
  readonly onFamilyChange: (family: FamilyFilter) => void
  readonly onEnabledChange: (enabled: EnabledFilter) => void
  readonly onPurposeChange?: (purpose: PurposeFilter) => void
  readonly onSourceChange?: (source: SourceFilter) => void
  readonly onToggle: (id: string, enabled: boolean) => void
  readonly onRefresh?: () => void
  readonly onClearFilters?: () => void
  readonly onSelectItem?: (id: string) => void
  readonly onActiveSectionChange?: (section: ToolsSection) => void
}

function interpolate(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key: string) => String(params[key] ?? `{${key}}`))
}

function textReader(translator?: ToolsTranslator) {
  return (key: McpInspectorKey, params: Readonly<Record<string, string | number>> = {}): string => {
    const translated = translator?.(key, params)
    return interpolate(translated && translated !== key ? translated : en[key], params)
  }
}

function idleSubscribe(): () => void {
  return () => {}
}

// useSyncExternalStore compares snapshots with Object.is: the degrade
// snapshot must be a stable module constant or the Tools tab loops forever
// while the catalog remote is absent or unresolved.
const UNAVAILABLE_CONTROLLER_STATE: ToolsHubControllerState = Object.freeze({
  status: 'unavailable',
  message: 'catalog_unavailable',
  code: 'catalog_unavailable',
})

const EMPTY_CONTROLLER: ToolsHubController = {
  getSnapshot: () => UNAVAILABLE_CONTROLLER_STATE,
  pendingIdSnapshot: () => undefined,
  subscribe: () => () => {},
  refresh: async () => {},
  setEnabled: async () => ({ ok: false, code: 'catalog-unavailable', message: 'catalog_unavailable' }),
  dispose: () => {},
} as unknown as ToolsHubController

function familyLabel(family: ToolHubItemV1['family'], text: ReturnType<typeof textReader>): string {
  if (family === 'mcp') return text('family.mcp')
  if (family === 'skill') return text('family.skill')
  return text('family.native')
}

function availabilityLabel(item: ToolHubItemV1, text: ReturnType<typeof textReader>): string {
  if (item.availability === 'available') return text('status.available')
  if (item.availability === 'disabled') return text('status.disabled')
  if (item.reasonCode === 'not_model_invocable') return text('status.notModelInvocable')
  return text('status.unavailable')
}

function availabilityTone(item: ToolHubItemV1): 'positive' | 'neutral' | 'critical' {
  if (item.availability === 'available') return 'positive'
  if (item.availability === 'disabled') return 'neutral'
  return 'critical'
}

function categoryLabel(category: string, text: ReturnType<typeof textReader>): string {
  const known: Record<string, McpInspectorKey> = { files: 'category.files', development: 'category.development', discovery: 'category.discovery', operations: 'category.operations', writing: 'category.writing' }
  return known[category] === undefined ? category : text(known[category])
}

function catalogHeading(state: ToolsHubControllerState, text: ReturnType<typeof textReader>): string {
  if (state.status === 'loading' || state.status === 'idle') return text('header.loading')
  if (state.status !== 'ready') return text('header.unavailable')
  return state.catalog.complete ? text('header.ready') : text('header.partial')
}

function catalogErrorCode(state: ToolsHubControllerState): ToolHubClientErrorCode {
  if ((state.status === 'unavailable' || state.status === 'error') && state.code !== undefined) return state.code
  return 'catalog_unavailable'
}

function catalogErrorKey(code: ToolHubClientErrorCode): McpInspectorKey {
  return `catalog.error.${code}` as McpInspectorKey
}

function healthLabel(item: ToolHubItemV1, healthAvailable: boolean, now: number, text: ReturnType<typeof textReader>): string | null {
  if (item.family !== 'mcp') return null
  if (!healthAvailable || item.health === undefined) return text('health.notReported')
  const state = text(`health.${item.health.state}` as McpInspectorKey)
  return now - item.health.observedAt > 60_000 ? `${state} · ${text('health.stale')}` : state
}

function healthTone(state: ToolHubHealthStateV1 | undefined, stale: boolean): 'positive' | 'info' | 'warn' | 'critical' | 'neutral' {
  if (stale) return 'warn'
  if (state === 'connected') return 'positive'
  if (state === 'syncing') return 'info'
  if (state === 'disconnected') return 'critical'
  return 'neutral'
}

function DetailsPanel({ item, healthAvailable, now, text, onBack, reference, boundSessionLabel, pendingId, disabledReason, sessionScoped, onAddToDraft, onOpenSession }: {
  readonly item: ToolHubItemV1 | undefined
  readonly reference?: ReactNode
  readonly healthAvailable: boolean
  readonly now: number
  readonly text: ReturnType<typeof textReader>
  readonly onBack: () => void
  readonly boundSessionLabel?: string
  readonly pendingId?: string
  readonly disabledReason?: string
  readonly sessionScoped?: boolean
  readonly onAddToDraft?: (item: ToolHubItemV1) => void
  readonly onOpenSession?: () => void
}): JSX.Element {
  const health = item === undefined ? null : healthLabel(item, healthAvailable, now, text)
  const stale = item?.health !== undefined && now - item.health.observedAt > 60_000
  return (
    <section className="tools-pane tools-details-pane" data-section="right" data-content="details" aria-label={text('section.details')} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onBack() } }}>
      <header className="tools-pane-header"><div><h2>{text('section.details')}</h2><p>{item?.label ?? text('tab.details')}</p></div><button type="button" className="vk-btn" onClick={onBack}>{text('action.backToCatalog')}</button></header>
      {item === undefined ? <div className="vk-empty"><p>{text('tab.details')}</p></div> : (
        <div className="tools-details-body">
          <div className="tools-detail-title"><i className="vk-dot" data-tone={availabilityTone(item)} aria-hidden="true" /><strong>{item.label}</strong><span className="vk-badge">{familyLabel(item.family, text)}</span></div>
          <p>{item.description || item.source}</p>
          <dl>
            {item.purpose !== undefined ? <><div><dt>{text('details.purpose')}</dt><dd>{item.purpose.zh}</dd></div><div><dt>{text('details.category')}</dt><dd>{categoryLabel(item.purpose.category, text)}</dd></div></> : null}
            <div><dt>{text('details.source')}</dt><dd>{item.source}</dd></div>
            <div><dt>{text('details.family')}</dt><dd>{familyLabel(item.family, text)}</dd></div>
            <div><dt>{text(sessionScoped ? 'details.sessionAvailability' : 'details.availability')}</dt><dd>{availabilityLabel(item, text)}</dd></div>
            {item.toolCount !== undefined ? <div><dt>{text('details.tools')}</dt><dd>{item.toolCount}</dd></div> : null}
            {health !== null ? <div><dt>{text('health.label')}</dt><dd className="tools-health"><i className="vk-dot" data-tone={healthTone(item.health?.state, stale)} aria-hidden="true" />{health}</dd></div> : null}
          </dl>
          {item.disabledReason || item.reasonCode === 'not_model_invocable' ? <p className="tools-reason">{item.disabledReason ?? text('status.notModelInvocable')}</p> : null}
          {disabledReason !== undefined ? <p className="tools-reason" data-tools-session-admission="unavailable">{disabledReason}</p> : null}
          {onAddToDraft !== undefined && boundSessionLabel !== undefined ? <button type="button" className="vk-btn tools-add-draft" data-tools-add-draft={item.id} disabled={item.availability !== 'available' || pendingId !== undefined || disabledReason !== undefined} title={disabledReason ?? (item.availability === 'available' ? undefined : item.disabledReason)} onClick={() => onAddToDraft(item)}>{pendingId === item.id ? text('action.addingToDraft') : text('action.addToDraft', { target: boundSessionLabel })}</button> : null}
          {onOpenSession === undefined ? null : <button type="button" className="vk-btn" data-tools-open-session="true" onClick={onOpenSession}>{text('action.openSession')}</button>}
          {reference}
          <p className="tools-scope-note">{text(sessionScoped ? 'details.sessionScope' : 'details.toggleScope')}</p>
        </div>
      )}
    </section>
  )
}

/** Pure tree used by the live view and by unit/browser fixtures. */
export function renderToolsInspectorTree(props: ToolsInspectorTreeProps): JSX.Element {
  const text = textReader(props.t)
  const now = props.now ?? Date.now()
  const items = 'catalog' in props.catalogState ? props.catalogState.catalog?.items ?? [] : []
  const visible = filterCatalog(items, { query: props.query, family: props.family, enabled: props.enabled, purpose: props.purpose, source: props.source })
  const families = countByFamily(items)
  const categories = purposeCategories(items)
  const sources = catalogSources(items)
  const coverage = countByAvailability(items)
  const activeSection = props.activeSection ?? 'catalog'
  const selected = items.find(item => item.id === props.selectedId)
  const healthAvailable = props.catalogState.status === 'ready' && props.catalogState.catalog.healthAvailable === true
  const headerTone = props.catalogState.status === 'ready' && props.catalogState.catalog.complete ? 'positive' : 'warn'
  const errorCode = catalogErrorCode(props.catalogState)
  const rightContent = activeSection === 'details' ? 'details' : 'none'

  return (
    <Surface kind="inspector" data-mcp-inspector="" data-catalog-state={props.catalogState.status} data-active-section={activeSection} data-tools-session-target={props.boundSessionId} data-tools-instance={props.instanceId} aria-label={text('view.tools')}>
      <style>{mcpInspectorStyles}</style>
      {props.sessionNotice === undefined ? null : <p className="tools-notice" role="status">{props.sessionNotice}</p>}
      <header className="vk-header tools-header" data-tools-toolbar="true">
        <div className="tools-title"><strong className="vk-heading" title={props.contextLabel ?? text('view.tools')}>{props.contextLabel ?? text('view.tools')}</strong><p className="vk-sub" role="status"><i className="vk-dot" data-tone={headerTone} aria-hidden="true" />{catalogHeading(props.catalogState, text)}</p></div>
        {props.boundSessionLabel === undefined ? null : <span className="tools-bound-target" data-tools-bound-target={props.boundSessionId}>{props.boundSessionLabel}</span>}
        <div className="tools-scope-switch" role="group" aria-label={text('view.tools')} data-tools-scope={props.scope ?? 'installed'}>{props.onScopeChange === undefined ? <span>{text(props.scope === 'session' ? 'scope.session' : 'scope.installed')}</span> : <>{(['session', 'installed'] as const).map(scope => <button key={scope} type="button" className="vk-btn" data-tools-scope-switch={scope} aria-pressed={props.scope === scope} onClick={() => props.onScopeChange?.(scope)}>{text(scope === 'session' ? 'scope.session' : 'scope.installed')}</button>)}</>}</div>
        <label className="vk-field tools-search tools-toolbar-search"><span className="visually-hidden">{text('search.label')}</span><input type="search" value={props.query} placeholder={text('search.placeholder')} aria-label={text('search.label')} onChange={event => props.onQueryChange(event.currentTarget.value)} /></label>
        {props.toolbarActions}<button type="button" className="vk-btn tools-recheck" disabled={!props.canRefresh} onClick={props.onRefresh}>{text('action.recheck')}</button>
      </header>

      {'stale' in props.catalogState && props.catalogState.stale && <p className="tools-notice" data-tone="warn" role="status">{text('catalog.stale')}</p>}
      {props.notice ? <p className="tools-notice" data-tone={props.notice.tone} role="status" data-tools-draft-status={props.notice.key.startsWith('notice.draft') ? props.notice.tone : undefined}>{text(props.notice.key, props.notice.reason === undefined ? {} : { reason: props.notice.reason })}</p> : null}

      {activeSection === 'catalog' && !props.readOnlyCatalog && props.catalogState.status === 'ready' && coverage.all > 0 ? (
        <div className="tools-coverage" role="group" aria-label={text('coverage.aria', coverage)}>
          {(['enabled', 'disabled', 'unavailable'] as const).map(value => (
            <button key={value} type="button" data-state={value} aria-pressed={props.enabled === value} style={{ flexGrow: Math.max(coverage[value], 1) }} onClick={() => props.onEnabledChange(value)}><span>{text(`filter.${value}`)}</span><strong>{coverage[value]}</strong></button>
          ))}
        </div>
      ) : null}

      <div className="tools-workspace" data-active-section={activeSection} data-right-content={rightContent}>
        <section className="tools-pane tools-catalog-pane" data-section="catalog" aria-label={text('section.catalog')}>
          <header className="tools-pane-header">
            <div>{props.catalogState.status === 'ready' ? <p>{visible.length}/{items.length}</p> : null}</div>
          </header>
          <div className="tools-filter-row">
            <div className="tools-family-tabs" role="toolbar" aria-label={text('section.catalog')}>
              {(['all', 'mcp', 'skill', 'native'] as const).map(value => <button key={value} type="button" className="tools-chip" aria-pressed={props.family === value} onClick={() => props.onFamilyChange(value)}>{text(`filter.${value}`)} <span>{families[value]}</span></button>)}
            </div>
            <label className="tools-state-filter ys-field"><span>{text('filter.state')}</span><select value={props.enabled} onChange={event => props.onEnabledChange(event.currentTarget.value as EnabledFilter)}><option value="all">{text('filter.all')}</option><option value="enabled">{text('filter.enabled')}</option><option value="disabled">{text('filter.disabled')}</option><option value="unavailable">{text('filter.unavailable')}</option></select></label>
            {categories.length > 0 ? <label className="tools-state-filter ys-field"><span>{text('filter.purpose')}</span><select value={props.purpose ?? 'all'} onChange={event => props.onPurposeChange?.(event.currentTarget.value)}><option value="all">{text('filter.purpose.all')}</option>{categories.map(category => <option key={category} value={category}>{categoryLabel(category, text)}</option>)}</select></label> : null}
            {sources.length > 1 ? <label className="tools-state-filter ys-field"><span>{text('filter.source')}</span><select value={props.source ?? 'all'} onChange={event => props.onSourceChange?.(event.currentTarget.value)}><option value="all">{text('filter.source.all')}</option>{sources.map(source => <option key={source} value={source}>{source}</option>)}</select></label> : null}
          </div>

          {props.catalogState.status === 'loading' || props.catalogState.status === 'idle' ? <div className="tools-skeleton-list" aria-label={text('catalog.loading')}>{[0, 1, 2].map(value => <div key={value} className="vk-skeleton" />)}</div> : null}
          {props.catalogState.status === 'unavailable' || props.catalogState.status === 'error' ? (
            <div className="vk-alert tools-catalog-alert" data-tone="warn" role="alert"><strong>{text(catalogErrorKey(errorCode))}</strong><p>{text('catalog.error.hint')}</p><div><button type="button" className="vk-btn" disabled={!props.canRefresh} onClick={props.onRefresh}>{text('action.recheck')}</button><details><summary>{text('catalog.technical')}</summary><code>{errorCode}</code></details></div></div>
          ) : null}
          {props.catalogState.status === 'ready' && !props.catalogState.catalog.complete ? <div className="vk-alert" data-tone="warn" role="status">{text('catalog.partial')} {!props.catalogState.catalog.toolsAvailable && text('catalog.toolsMissing')} {!props.catalogState.catalog.skillsAvailable && text('catalog.skillsMissing')} {!props.readOnlyCatalog && !props.catalogState.catalog.mcpInventoryAvailable && text('catalog.inventoryMissing')}</div> : null}
          {props.catalogState.status === 'ready' && items.length === 0 ? <div className="vk-empty tools-empty"><p>{text('empty.catalog')}</p><small>{text('empty.catalog.hint')}</small></div> : null}
          {props.catalogState.status === 'ready' && items.length > 0 && visible.length === 0 ? <div className="vk-empty tools-empty"><p>{text('empty.matches')}</p><button type="button" className="vk-btn" onClick={props.onClearFilters}>{text('action.clearFilters')}</button></div> : null}

          {visible.length > 0 ? <div className="tools-catalog-list">
            {visible.map(item => {
              const health = healthLabel(item, healthAvailable, now, text)
              const stale = item.health !== undefined && now - item.health.observedAt > 60_000
              return (
                <article key={item.id} className="tools-row" data-item-id={item.id} data-selected={selected?.id === item.id ? 'true' : undefined}>
                  <i className="vk-dot" data-tone={availabilityTone(item)} aria-hidden="true" />
                  <button type="button" className="tools-row-main" aria-label={text('action.details', { name: item.label })} onClick={() => props.onSelectItem?.(item.id)}>
                    <span className="tools-row-title"><strong>{item.label}</strong><span className="vk-badge">{familyLabel(item.family, text)}</span><span className="tools-availability">{availabilityLabel(item, text)}</span></span>
                    <span className="tools-row-description">{props.preferChinesePurpose && item.purpose !== undefined ? item.purpose.zh : item.description || item.source}</span>
                    <span className="tools-row-meta">{item.source}{item.toolCount !== undefined ? ` · ${text('details.tools')} ${item.toolCount}` : ''}</span>
                    {health !== null ? <span className="tools-health"><i className="vk-dot" data-tone={healthTone(item.health?.state, stale)} aria-hidden="true" />{health}</span> : null}
                  </button>
                  {!props.readOnlyCatalog && <button type="button" className="vk-btn tools-toggle" aria-pressed={item.enabled} disabled={props.catalogState.status !== 'ready' || !item.canToggle || props.pendingId !== undefined} title={item.canToggle ? undefined : (item.disabledReason ?? text('toggle.unsupported'))} onClick={() => props.onToggle(item.id, !item.enabled)}>{props.pendingId === item.id ? text('toggle.pending') : item.enabled ? text('toggle.disable') : text('toggle.enable')}</button>}
                </article>
              )
            })}
          </div> : null}
        </section>

        <div className="tools-right-column" data-section="right">
          {activeSection === 'details' ? <DetailsPanel reference={selected && props.catalogState.status === 'ready' ? props.renderReference?.(selected, props.catalogState.catalog.generation) : undefined} item={selected} healthAvailable={healthAvailable} now={now} text={text} onBack={() => props.onActiveSectionChange?.('catalog')} {...(props.readOnlyCatalog === undefined ? {} : { sessionScoped: props.readOnlyCatalog })} {...(props.boundSessionLabel === undefined ? {} : { boundSessionLabel: props.boundSessionLabel })} {...(props.draftPendingId === undefined ? {} : { pendingId: props.draftPendingId })} {...(props.draftDisabledReason === undefined ? {} : { disabledReason: props.draftDisabledReason })} {...(props.onAddToDraft === undefined ? {} : { onAddToDraft: (item: ToolHubItemV1) => { void props.onAddToDraft?.(item) } })} {...(props.onOpenSession === undefined ? {} : { onOpenSession: props.onOpenSession })} /> : null}
        </div>
      </div>
    </Surface>
  )
}

function snapshotController(binding: ToolsHubBinding | undefined, fallback: ToolsHubController | undefined): ToolsHubController | undefined {
  return binding === undefined ? fallback : binding.getSnapshot()
}

export function McpInspectorView(props: ToolsInspectorViewProps): JSX.Element {
  return <ToolsInspectorContent binding={props.binding} controller={props.controller} t={props.t} />
}

/** Shared content for the legacy exported renderer and the session-following pane. */
export function ToolsInspectorContent({ binding, controller, t, renderReference, initialFamily = 'all', sessionNotice, viewState, toolbarActions, contextLabel, readOnlyCatalog, globalManagement, scope, boundSessionLabel, boundSessionId, onAddToDraft, draftDisabledReason, onScopeChange, onOpenSession, preferChinesePurpose }: {
  readonly binding?: ToolsHubBinding | undefined
  readonly renderReference?: (item: ToolHubItemV1, generation: number) => ReactNode
  readonly controller?: ToolsHubController | undefined
  readonly t?: ToolsTranslator | undefined
  readonly viewState?: ToolsViewState
  readonly toolbarActions?: ReactNode
  readonly contextLabel?: string | undefined
  readonly readOnlyCatalog?: boolean
  readonly globalManagement?: boolean
  readonly scope?: 'session' | 'installed'
  readonly boundSessionLabel?: string
  readonly boundSessionId?: string
  readonly onAddToDraft?: (item: ToolHubItemV1) => Promise<DraftReferenceResult>
  readonly draftDisabledReason?: string
  readonly onScopeChange?: (scope: 'session' | 'installed') => void
  readonly onOpenSession?: () => void
  readonly preferChinesePurpose?: boolean
  readonly initialFamily?: FamilyFilter
  readonly sessionNotice?: string | undefined
}): JSX.Element {
  const subscribe = binding === undefined ? idleSubscribe : binding.subscribe.bind(binding)
  const bound = useSyncExternalStore(subscribe, () => snapshotController(binding, controller), () => snapshotController(binding, controller))
  const hub = bound ?? EMPTY_CONTROLLER
  const catalogState = useSyncExternalStore(hub.subscribe.bind(hub), hub.getSnapshot.bind(hub), hub.getSnapshot.bind(hub))
  const pendingId = useSyncExternalStore(hub.subscribe.bind(hub), hub.pendingIdSnapshot.bind(hub), hub.pendingIdSnapshot.bind(hub))
  const [fallbackState] = useState(() => new ToolsViewState(initialFamily, 'catalog'))
  const [instanceId] = useState(() => `tools-${Math.random().toString(36).slice(2)}`)
  const shared = viewState ?? fallbackState
  const { query, family, enabled, purpose, source, selectedId, activeSection } = useSyncExternalStore(shared.subscribe, shared.getSnapshot, shared.getSnapshot)
  const setQuery = (value: string) => shared.set('query', value)
  const setFamily = (value: FamilyFilter) => shared.set('family', value)
  const setEnabled = (value: EnabledFilter) => shared.set('enabled', value)
  const setPurpose = (value: PurposeFilter) => shared.set('purpose', value)
  const setSource = (value: SourceFilter) => shared.set('source', value)
  const setSelectedId = (value: string | undefined) => shared.set('selectedId', value)
  const setActiveSection = (value: ToolsSection | ((previous: ToolsSection) => ToolsSection)) => shared.set('activeSection', value)
  const [notice, setNotice] = useState<ToolsNotice>()
  const [draftPendingId, setDraftPendingId] = useState<string>()
  const focusIntent = useRef<'detail' | 'row'>()
  useLayoutEffect(() => {
    const intent = focusIntent.current
    if (intent === undefined) return
    if (intent === 'detail' && activeSection !== 'details' || intent === 'row' && activeSection !== 'catalog') return
    focusIntent.current = undefined
    const root = document.querySelector<HTMLElement>(`[data-tools-instance="${instanceId}"]`)
    if (root === null || selectedId === undefined) return
    if (intent === 'detail' && root.clientWidth <= 720) {
      root.querySelector<HTMLButtonElement>('.tools-details-pane .tools-pane-header .vk-btn')?.focus()
      return
    }
    if (intent === 'row') root.querySelector<HTMLElement>(`[data-item-id="${selectedId}"] .tools-row-main`)?.focus()
  }, [activeSection, instanceId, selectedId])

  useEffect(() => {
    if (bound === undefined || viewState !== undefined) return
    void bound.refresh()
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void bound.refresh()
    }, 30_000)
    return () => clearInterval(timer)
  }, [bound, viewState])

  useEffect(() => {
    if (catalogState.status !== 'ready' || selectedId === undefined) return
    const visible = filterCatalog(catalogState.catalog.items, { query, family, enabled, purpose, source })
    if (visible.some(item => item.id === selectedId)) return
    setSelectedId(undefined)
    setActiveSection(section => section === 'details' ? 'catalog' : section)
  }, [catalogState, enabled, family, purpose, query, selectedId, source])

  return renderToolsInspectorTree({
    catalogState, toolbarActions, instanceId, ...(preferChinesePurpose === undefined ? {} : { preferChinesePurpose }), ...(globalManagement === undefined ? {} : { globalManagement }), ...(contextLabel === undefined ? {} : { contextLabel }), ...(readOnlyCatalog === undefined ? {} : { readOnlyCatalog }), ...(scope === undefined ? {} : { scope }), ...(boundSessionLabel === undefined ? {} : { boundSessionLabel }), ...(boundSessionId === undefined ? {} : { boundSessionId }), ...(draftDisabledReason === undefined ? {} : { draftDisabledReason }), ...(onScopeChange === undefined ? {} : { onScopeChange }), ...(onOpenSession === undefined ? {} : { onOpenSession }),
    ...(pendingId === undefined ? {} : { pendingId }),
    query,
    family,
    enabled,
    purpose,
    source,
    sessionNotice,
    ...(selectedId === undefined ? {} : { selectedId }),
    activeSection,
    ...(notice === undefined ? {} : { notice }),
    canRefresh: bound !== undefined,
    ...(renderReference === undefined ? {} : { renderReference }),
    ...(t === undefined ? {} : { t }),
    onQueryChange: setQuery,
    onFamilyChange: setFamily,
    onEnabledChange: setEnabled,
    onPurposeChange: setPurpose,
    onSourceChange: setSource,
    onRefresh: () => { if (bound !== undefined) void bound.refresh() },
    onClearFilters: () => { setQuery(''); setFamily('all'); setEnabled('all'); setPurpose('all'); setSource('all') },
    onSelectItem: id => { focusIntent.current = 'detail'; setSelectedId(id); setActiveSection('details') },
    onActiveSectionChange: section => { if (section === 'catalog') focusIntent.current = 'row'; setActiveSection(section) },
    onToggle: (id, next) => {
      void hub.setEnabled(id, next).then(answer => {
        if (answer.ok) setNotice({ key: 'notice.toggleSuccess', tone: 'positive' })
        else if (answer.code === 'generation-conflict') setNotice({ key: 'notice.generationConflict', tone: 'warn' })
        else setNotice({ key: 'notice.toggleFailure', tone: 'critical' })
      })
    },
    ...(onAddToDraft === undefined ? {} : { ...(draftPendingId === undefined ? {} : { draftPendingId }), onAddToDraft: async (item: ToolHubItemV1) => {
      setDraftPendingId(item.id)
      const result = await onAddToDraft(item)
      setDraftPendingId(undefined)
      if (result.status === 'added') setNotice({ key: 'notice.draftAdded', tone: 'positive' })
      else if (result.status === 'already-added') setNotice({ key: 'notice.draftAlreadyAdded', tone: 'info' })
      else setNotice({ key: 'notice.draftUnavailable', tone: 'critical', reason: result.reason })
      return result
    } }),
  })
}

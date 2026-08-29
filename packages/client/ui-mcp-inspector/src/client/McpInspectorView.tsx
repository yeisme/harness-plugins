/**
 * DSH Tools workbench: safe catalog management plus session activity.
 *
 * The view never invokes tools, reads private arguments, or owns canonical
 * health/session state. Catalog mutations remain generation-CAS owner calls.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client
 */
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type JSX } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import {
  deriveToolActivity,
  type ActivityRunningCall,
  type ActivityToolResultNode,
  type McpServerActivity,
  type ToolActivityRecord,
  type ToolActivitySnapshot,
} from './activity.ts'
import type { ToolsHubBinding } from './binding.ts'
import { ToolsHubController, type ToolsHubControllerState } from './controller.ts'
import { countByAvailability, countByFamily, filterCatalog, type EnabledFilter, type FamilyFilter } from './filter.ts'
import { en, type McpInspectorKey } from './locales.ts'
import { mcpInspectorStyles } from './styles.ts'
import type { ToolHubClientErrorCode } from './remote.ts'
import type { ToolHubHealthStateV1, ToolHubItemV1 } from './wire.ts'

export type ToolsTranslator = (key: McpInspectorKey, params?: Readonly<Record<string, string | number>>) => string
export type ToolsSection = 'catalog' | 'activity' | 'details'
export type ActivityMode = 'list' | 'timeline'
export type ActivityFilter = 'all' | 'errors' | 'running'

export interface ToolsInspectorViewProps extends ConvViewProps {
  readonly binding?: ToolsHubBinding
  readonly controller?: ToolsHubController
  readonly t?: ToolsTranslator
}

export interface ToolsNotice {
  readonly key: 'notice.toggleSuccess' | 'notice.generationConflict' | 'notice.toggleFailure'
  readonly tone: 'positive' | 'warn' | 'critical'
}

export interface ToolsInspectorTreeProps {
  readonly catalogState: ToolsHubControllerState
  readonly pendingId?: string
  readonly query: string
  readonly family: FamilyFilter
  readonly enabled: EnabledFilter
  /** Legacy MCP-only tree input retained for exported test/consumer compatibility. */
  readonly servers?: readonly McpServerActivity[]
  readonly activity?: ToolActivitySnapshot
  readonly selectedId?: string
  readonly activeSection?: ToolsSection
  readonly activityMode?: ActivityMode
  readonly activityFilter?: ActivityFilter
  readonly notice?: ToolsNotice
  readonly now?: number
  readonly canRefresh?: boolean
  readonly t?: ToolsTranslator
  readonly onQueryChange: (query: string) => void
  readonly onFamilyChange: (family: FamilyFilter) => void
  readonly onEnabledChange: (enabled: EnabledFilter) => void
  readonly onToggle: (id: string, enabled: boolean) => void
  readonly onRefresh?: () => void
  readonly onClearFilters?: () => void
  readonly onSelectItem?: (id: string) => void
  readonly onActiveSectionChange?: (section: ToolsSection) => void
  readonly onActivityModeChange?: (mode: ActivityMode) => void
  readonly onActivityFilterChange?: (filter: ActivityFilter) => void
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

function formatDuration(ms: number | null, text: ReturnType<typeof textReader>): string {
  if (ms === null) return text('record.durationUnavailable')
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m`
}

function formatTime(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(11, 19)
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

function activityFromServers(servers: readonly McpServerActivity[]): ToolActivitySnapshot {
  const records: ToolActivityRecord[] = servers.flatMap(server => server.records.map((record, index) => ({
    itemId: `mcp:${server.server}` as const,
    family: 'mcp' as const,
    server: server.server,
    tool: record.tool,
    time: record.time,
    durationMs: record.durationMs,
    isError: record.isError,
    running: record.running,
    sequence: index,
  }))).sort((a, b) => b.time - a.time || a.tool.localeCompare(b.tool))
  return {
    calls: servers.reduce((sum, server) => sum + server.calls, 0),
    errors: servers.reduce((sum, server) => sum + server.errors, 0),
    running: servers.reduce((sum, server) => sum + server.running, 0),
    records,
  }
}

function familyLabel(family: ToolHubItemV1['family'], text: ReturnType<typeof textReader>): string {
  if (family === 'mcp') return text('family.mcp')
  if (family === 'skill') return text('family.skill')
  return text('family.native')
}

function availabilityLabel(item: ToolHubItemV1, text: ReturnType<typeof textReader>): string {
  if (item.availability === 'available') return text('status.enabled')
  if (item.availability === 'disabled') return text('status.disabled')
  return text('status.unavailable')
}

function availabilityTone(item: ToolHubItemV1): 'positive' | 'neutral' | 'critical' {
  if (item.availability === 'available') return 'positive'
  if (item.availability === 'disabled') return 'neutral'
  return 'critical'
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

function recordName(record: ToolActivityRecord, text: ReturnType<typeof textReader>): string {
  if (record.family === 'skill') return text('record.skill')
  if (record.family === 'mcp') return `mcp__${record.server} / ${record.tool}`
  return record.tool
}

function recordStatus(record: ToolActivityRecord, text: ReturnType<typeof textReader>): string {
  if (record.running) return text('record.running')
  if (record.isError) return `${text('record.error')} · ${formatDuration(record.durationMs, text)}`
  return `${text('record.success')} · ${formatDuration(record.durationMs, text)}`
}

function timelineStyle(record: ToolActivityRecord, records: readonly ToolActivityRecord[], now: number): CSSProperties {
  const starts = records.map(item => item.running ? item.time : item.time - (item.durationMs ?? 0))
  const ends = records.map(item => item.running ? now : item.time)
  const start = Math.min(...starts)
  const end = Math.max(...ends, start + 1)
  const span = Math.max(1, end - start)
  const recordStart = record.running ? record.time : record.time - (record.durationMs ?? 0)
  const recordEnd = record.running ? now : record.time
  return {
    '--tool-left': `${Math.max(0, ((recordStart - start) / span) * 100)}%`,
    '--tool-width': `${Math.max(2, ((recordEnd - recordStart) / span) * 100)}%`,
  } as CSSProperties
}

function ActivityPanel({ activity, mode, filter, now, text, onMode, onFilter }: {
  readonly activity: ToolActivitySnapshot
  readonly mode: ActivityMode
  readonly filter: ActivityFilter
  readonly now: number
  readonly text: ReturnType<typeof textReader>
  readonly onMode: (mode: ActivityMode) => void
  readonly onFilter: (filter: ActivityFilter) => void
}): JSX.Element {
  const records = activity.records.filter(record => filter === 'all' || (filter === 'errors' ? record.isError : record.running))
  return (
    <section className="tools-pane tools-activity-pane" data-section="right" data-content="activity" aria-label={text('section.activity')}>
      <header className="tools-pane-header">
        <div><h2>{text('section.activity')}</h2><p>{text('summary.calls', { count: activity.calls })} · {text('summary.errors', { count: activity.errors })} · {text('summary.running', { count: activity.running })}</p></div>
        <div className="tools-compact-controls" role="toolbar" aria-label={text('section.activity')}>
          {(['list', 'timeline'] as const).map(value => <button key={value} type="button" className="tools-chip" aria-pressed={mode === value} onClick={() => onMode(value)}>{text(`mode.${value}`)}</button>)}
        </div>
      </header>
      <div className="tools-compact-controls tools-activity-filter" role="toolbar" aria-label={text('section.activity')}>
        {(['all', 'errors', 'running'] as const).map(value => <button key={value} type="button" className="tools-chip" aria-pressed={filter === value} onClick={() => onFilter(value)}>{text(`activity.${value}`)}</button>)}
      </div>
      {records.length === 0 ? <div className="vk-empty tools-empty"><p>{text('empty.activity')}</p><small>{text('empty.activity.hint')}</small></div> : mode === 'list' ? (
        <ol className="tools-activity-list">
          {records.map(record => (
            <li key={`${record.sequence}-${record.time}-${record.tool}`} className="tools-activity-row">
              <i className="vk-dot" data-tone={record.running ? 'info' : record.isError ? 'critical' : 'positive'} aria-hidden="true" />
              <span className="tools-record-name">{recordName(record, text)}</span>
              <time>{formatTime(record.time)}</time>
              <span className="tools-record-status">{recordStatus(record, text)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="tools-timeline" aria-label={text('mode.timeline')}>
          {records.map(record => (
            <li key={`${record.sequence}-${record.time}-${record.tool}`} className="tools-timeline-row">
              <span className="tools-record-name">{recordName(record, text)}</span>
              <span className="tools-timeline-track" aria-label={`${recordName(record, text)} · ${recordStatus(record, text)}`}><i style={timelineStyle(record, records, now)} data-tone={record.running ? 'info' : record.isError ? 'critical' : 'positive'} /></span>
              <span className="tools-record-status">{recordStatus(record, text)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function DetailsPanel({ item, activity, healthAvailable, now, text, onBack }: {
  readonly item: ToolHubItemV1 | undefined
  readonly activity: ToolActivitySnapshot
  readonly healthAvailable: boolean
  readonly now: number
  readonly text: ReturnType<typeof textReader>
  readonly onBack: () => void
}): JSX.Element {
  const recent = item === undefined ? undefined : activity.records.find(record => record.itemId === item.id)
  const health = item === undefined ? null : healthLabel(item, healthAvailable, now, text)
  const stale = item?.health !== undefined && now - item.health.observedAt > 60_000
  return (
    <section className="tools-pane tools-details-pane" data-section="right" data-content="details" aria-label={text('section.details')}>
      <header className="tools-pane-header"><div><h2>{text('section.details')}</h2><p>{item?.label ?? text('tab.details')}</p></div><button type="button" className="vk-btn" onClick={onBack}>{text('action.backToActivity')}</button></header>
      {item === undefined ? <div className="vk-empty"><p>{text('tab.details')}</p></div> : (
        <div className="tools-details-body">
          <div className="tools-detail-title"><i className="vk-dot" data-tone={availabilityTone(item)} aria-hidden="true" /><strong>{item.label}</strong><span className="vk-badge">{familyLabel(item.family, text)}</span></div>
          <p>{item.description || item.source}</p>
          <dl>
            <div><dt>{text('details.source')}</dt><dd>{item.source}</dd></div>
            <div><dt>{text('details.family')}</dt><dd>{familyLabel(item.family, text)}</dd></div>
            <div><dt>{text('details.availability')}</dt><dd>{availabilityLabel(item, text)}</dd></div>
            {item.toolCount !== undefined ? <div><dt>{text('details.tools')}</dt><dd>{item.toolCount}</dd></div> : null}
            <div><dt>{text('details.lastUsed')}</dt><dd>{recent === undefined ? text('details.neverUsed') : `${formatTime(recent.time)} · ${recordStatus(recent, text)}`}</dd></div>
            {health !== null ? <div><dt>{text('health.label')}</dt><dd className="tools-health"><i className="vk-dot" data-tone={healthTone(item.health?.state, stale)} aria-hidden="true" />{health}</dd></div> : null}
          </dl>
          {item.disabledReason ? <p className="tools-reason">{item.disabledReason}</p> : null}
          <p className="tools-scope-note">{text('details.toggleScope')}</p>
        </div>
      )}
    </section>
  )
}

/** Pure tree used by the live view and by unit/browser fixtures. */
export function renderToolsInspectorTree(props: ToolsInspectorTreeProps): JSX.Element {
  const text = textReader(props.t)
  const now = props.now ?? Date.now()
  const activity = props.activity ?? activityFromServers(props.servers ?? [])
  const items = props.catalogState.status === 'ready' ? props.catalogState.catalog.items : []
  const visible = filterCatalog(items, { query: props.query, family: props.family, enabled: props.enabled })
  const families = countByFamily(items)
  const coverage = countByAvailability(items)
  const activeSection = props.activeSection ?? 'catalog'
  const selected = items.find(item => item.id === props.selectedId)
  const healthAvailable = props.catalogState.status === 'ready' && props.catalogState.catalog.healthAvailable === true
  const headerTone = props.catalogState.status === 'ready' && props.catalogState.catalog.complete ? 'positive' : 'warn'
  const errorCode = catalogErrorCode(props.catalogState)
  const rightContent = activeSection === 'details' ? 'details' : 'activity'

  return (
    <Surface kind="inspector" data-mcp-inspector="" data-active-section={activeSection} aria-label={text('view.tools')}>
      <style>{mcpInspectorStyles}</style>
      <header className="vk-header tools-header">
        <div className="tools-title"><strong className="vk-heading">{text('view.tools')}</strong><p className="vk-sub" role="status"><i className="vk-dot" data-tone={headerTone} aria-hidden="true" />{catalogHeading(props.catalogState, text)}</p></div>
        <div className="tools-summary" aria-label={text('header.subtitle')}>
          {props.catalogState.status === 'ready' ? <><span>{text('summary.items', { count: coverage.all })}</span><span>{text('summary.enabled', { count: coverage.enabled })}</span></> : null}
          <span>{text('summary.calls', { count: activity.calls })}</span>
          {activity.errors > 0 ? <span data-tone="critical">{text('summary.errors', { count: activity.errors })}</span> : null}
          {activity.running > 0 ? <span data-tone="info">{text('summary.running', { count: activity.running })}</span> : null}
        </div>
        <button type="button" className="vk-btn tools-recheck" disabled={!props.canRefresh} onClick={props.onRefresh}>{text('action.recheck')}</button>
      </header>

      {props.notice ? <p className="tools-notice" data-tone={props.notice.tone} role="status">{text(props.notice.key)}</p> : null}

      {props.catalogState.status === 'ready' && coverage.all > 0 ? (
        <div className="tools-coverage" role="group" aria-label={text('coverage.aria', coverage)}>
          {(['enabled', 'disabled', 'unavailable'] as const).map(value => (
            <button key={value} type="button" data-state={value} aria-pressed={props.enabled === value} style={{ flexGrow: Math.max(coverage[value], 1) }} onClick={() => props.onEnabledChange(value)}><span>{text(`filter.${value}`)}</span><strong>{coverage[value]}</strong></button>
          ))}
        </div>
      ) : null}

      <nav className="tools-mobile-tabs" aria-label={text('view.tools')}>
        {(['catalog', 'activity', 'details'] as const).map(section => <button key={section} type="button" aria-pressed={activeSection === section} disabled={section === 'details' && selected === undefined} onClick={() => props.onActiveSectionChange?.(section)}>{text(`tab.${section}`)}</button>)}
      </nav>

      <div className="tools-workspace" data-active-section={activeSection} data-right-content={rightContent}>
        <section className="tools-pane tools-catalog-pane" data-section="catalog" aria-label={text('section.catalog')}>
          <header className="tools-pane-header">
            <div><h2>{text('section.catalog')}</h2>{props.catalogState.status === 'ready' ? <p>{visible.length}/{items.length}</p> : null}</div>
            <label className="vk-field tools-search"><span className="visually-hidden">{text('search.label')}</span><input type="search" value={props.query} placeholder={text('search.placeholder')} aria-label={text('search.label')} onChange={event => props.onQueryChange(event.currentTarget.value)} /></label>
          </header>
          <div className="tools-filter-row">
            <div className="tools-family-tabs" role="toolbar" aria-label={text('section.catalog')}>
              {(['all', 'mcp', 'skill', 'native'] as const).map(value => <button key={value} type="button" className="tools-chip" aria-pressed={props.family === value} onClick={() => props.onFamilyChange(value)}>{text(`filter.${value}`)} <span>{families[value]}</span></button>)}
            </div>
            <label className="tools-state-filter ys-field"><span>{text('filter.state')}</span><select value={props.enabled} onChange={event => props.onEnabledChange(event.currentTarget.value as EnabledFilter)}><option value="all">{text('filter.all')}</option><option value="enabled">{text('filter.enabled')}</option><option value="disabled">{text('filter.disabled')}</option><option value="unavailable">{text('filter.unavailable')}</option></select></label>
          </div>

          {props.catalogState.status === 'loading' || props.catalogState.status === 'idle' ? <div className="tools-skeleton-list" aria-label={text('catalog.loading')}>{[0, 1, 2].map(value => <div key={value} className="vk-skeleton" />)}</div> : null}
          {props.catalogState.status === 'unavailable' || props.catalogState.status === 'error' ? (
            <div className="vk-alert tools-catalog-alert" data-tone="warn" role="alert"><strong>{text(catalogErrorKey(errorCode))}</strong><p>{text('catalog.error.hint')}</p><div><button type="button" className="vk-btn" disabled={!props.canRefresh} onClick={props.onRefresh}>{text('action.recheck')}</button><details><summary>{text('catalog.technical')}</summary><code>{errorCode}</code></details></div></div>
          ) : null}
          {props.catalogState.status === 'ready' && !props.catalogState.catalog.complete ? <div className="vk-alert" data-tone="warn" role="status">{text('catalog.partial')}</div> : null}
          {props.catalogState.status === 'ready' && items.length === 0 ? <div className="vk-empty tools-empty"><p>{text('empty.catalog')}</p><small>{text('empty.catalog.hint')}</small></div> : null}
          {props.catalogState.status === 'ready' && items.length > 0 && visible.length === 0 ? <div className="vk-empty tools-empty"><p>{text('empty.matches')}</p><button type="button" className="vk-btn" onClick={props.onClearFilters}>{text('action.clearFilters')}</button></div> : null}

          {visible.length > 0 ? <div className="tools-catalog-list">
            {visible.map(item => {
              const recent = activity.records.find(record => record.itemId === item.id)
              const health = healthLabel(item, healthAvailable, now, text)
              const stale = item.health !== undefined && now - item.health.observedAt > 60_000
              return (
                <article key={item.id} className="tools-row" data-item-id={item.id} data-selected={selected?.id === item.id ? 'true' : undefined}>
                  <i className="vk-dot" data-tone={availabilityTone(item)} aria-hidden="true" />
                  <button type="button" className="tools-row-main" aria-label={text('action.details', { name: item.label })} onClick={() => props.onSelectItem?.(item.id)}>
                    <span className="tools-row-title"><strong>{item.label}</strong><span className="vk-badge">{familyLabel(item.family, text)}</span><span className="tools-availability">{availabilityLabel(item, text)}</span></span>
                    <span className="tools-row-description">{item.description || item.source}</span>
                    <span className="tools-row-meta">{item.source}{item.toolCount !== undefined ? ` · ${text('details.tools')} ${item.toolCount}` : ''}{recent !== undefined ? ` · ${formatTime(recent.time)}` : ''}</span>
                    {health !== null ? <span className="tools-health"><i className="vk-dot" data-tone={healthTone(item.health?.state, stale)} aria-hidden="true" />{health}</span> : null}
                  </button>
                  <button type="button" className="vk-btn tools-toggle" aria-pressed={item.enabled} disabled={!item.canToggle || props.pendingId === item.id} title={item.canToggle ? undefined : (item.disabledReason ?? text('toggle.unsupported'))} onClick={() => props.onToggle(item.id, !item.enabled)}>{props.pendingId === item.id ? text('toggle.pending') : item.enabled ? text('toggle.disable') : text('toggle.enable')}</button>
                </article>
              )
            })}
          </div> : null}
        </section>

        <div className="tools-right-column" data-section="right">
          <nav className="tools-right-tabs" aria-label={text('view.tools')}><button type="button" aria-pressed={rightContent === 'activity'} onClick={() => props.onActiveSectionChange?.('activity')}>{text('tab.activity')}</button><button type="button" aria-pressed={rightContent === 'details'} disabled={selected === undefined} onClick={() => props.onActiveSectionChange?.('details')}>{text('tab.details')}</button></nav>
          {rightContent === 'details' ? <DetailsPanel item={selected} activity={activity} healthAvailable={healthAvailable} now={now} text={text} onBack={() => props.onActiveSectionChange?.('activity')} /> : <ActivityPanel activity={activity} mode={props.activityMode ?? 'list'} filter={props.activityFilter ?? 'all'} now={now} text={text} onMode={mode => props.onActivityModeChange?.(mode)} onFilter={filter => props.onActivityFilterChange?.(filter)} />}
        </div>
      </div>
    </Surface>
  )
}

function snapshotController(binding: ToolsHubBinding | undefined, fallback: ToolsHubController | undefined): ToolsHubController | undefined {
  return binding === undefined ? fallback : binding.getSnapshot()
}

export function McpInspectorView({ useSession, binding, controller, t }: ToolsInspectorViewProps): JSX.Element {
  const subscribe = binding === undefined ? idleSubscribe : binding.subscribe.bind(binding)
  const bound = useSyncExternalStore(subscribe, () => snapshotController(binding, controller), () => snapshotController(binding, controller))
  const hub = bound ?? EMPTY_CONTROLLER
  const catalogState = useSyncExternalStore(hub.subscribe.bind(hub), hub.getSnapshot.bind(hub), hub.getSnapshot.bind(hub))
  const pendingId = useSyncExternalStore(hub.subscribe.bind(hub), hub.pendingIdSnapshot.bind(hub), hub.pendingIdSnapshot.bind(hub))
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<FamilyFilter>('all')
  const [enabled, setEnabled] = useState<EnabledFilter>('all')
  const [selectedId, setSelectedId] = useState<string>()
  const [activeSection, setActiveSection] = useState<ToolsSection>('catalog')
  const [activityMode, setActivityMode] = useState<ActivityMode>('list')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [notice, setNotice] = useState<ToolsNotice>()

  useEffect(() => {
    if (bound === undefined) return
    void bound.refresh()
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void bound.refresh()
    }, 30_000)
    return () => clearInterval(timer)
  }, [bound])

  const activity = useSession(snapshot => {
    const landed = snapshot.nodes.filter(node => node.kind === 'tool-result') as unknown as ActivityToolResultNode[]
    return deriveToolActivity(landed, snapshot.runningCalls as unknown as ActivityRunningCall[])
  })

  useEffect(() => {
    if (catalogState.status !== 'ready' || selectedId === undefined) return
    const visible = filterCatalog(catalogState.catalog.items, { query, family, enabled })
    if (visible.some(item => item.id === selectedId)) return
    setSelectedId(undefined)
    setActiveSection(section => section === 'details' ? 'activity' : section)
  }, [catalogState, enabled, family, query, selectedId])

  return renderToolsInspectorTree({
    catalogState,
    ...(pendingId === undefined ? {} : { pendingId }),
    query,
    family,
    enabled,
    activity,
    ...(selectedId === undefined ? {} : { selectedId }),
    activeSection,
    activityMode,
    activityFilter,
    ...(notice === undefined ? {} : { notice }),
    canRefresh: bound !== undefined,
    ...(t === undefined ? {} : { t }),
    onQueryChange: setQuery,
    onFamilyChange: setFamily,
    onEnabledChange: setEnabled,
    onRefresh: () => { if (bound !== undefined) void bound.refresh() },
    onClearFilters: () => { setQuery(''); setFamily('all'); setEnabled('all') },
    onSelectItem: id => { setSelectedId(id); setActiveSection('details') },
    onActiveSectionChange: setActiveSection,
    onActivityModeChange: setActivityMode,
    onActivityFilterChange: setActivityFilter,
    onToggle: (id, next) => {
      void hub.setEnabled(id, next).then(answer => {
        if (answer.ok) setNotice({ key: 'notice.toggleSuccess', tone: 'positive' })
        else if (answer.code === 'generation-conflict') setNotice({ key: 'notice.generationConflict', tone: 'warn' })
        else setNotice({ key: 'notice.toggleFailure', tone: 'critical' })
      })
    },
  })
}

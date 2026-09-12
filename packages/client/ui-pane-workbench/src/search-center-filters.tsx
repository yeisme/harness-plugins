import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PaneWorkspaceSearchTargetV1 } from './management.js'
import type { SearchCenterControls } from './search-controls.js'
import { t } from './i18n/locale.js'

export interface SearchCenterFilterProps {
  readonly expanded?: boolean
  readonly sessions?: readonly { sessionRef: string; title: string }[]
  readonly onSessionScope?: (sessionRef: string) => void
  readonly workspaceRef?: string
  readonly workspaces: readonly PaneWorkspaceSearchTargetV1[]
  readonly controls: SearchCenterControls
  readonly owners: readonly string[]
  readonly statuses: readonly string[]
  readonly openedOnly: boolean
  readonly canFilterTime: boolean
  readonly onScope: (workspaceRef: string | undefined) => void
  readonly onControls: (controls: SearchCenterControls) => void
  readonly onOpenedOnly: () => void
}

export function SearchCenterFilters(props: SearchCenterFilterProps) {
  const sessionRef = props.controls.sessionRef
  const knownSession = sessionRef === undefined || props.sessions?.some(session => session.sessionRef === sessionRef)
  const knownScope = props.workspaceRef === undefined || props.workspaces.some(workspace => workspace.workspaceRef === props.workspaceRef)
  return <div className="pwr-search-query-controls" data-expanded={props.expanded || undefined} aria-label={t('search.filters')}>
    <label className="ys-field"><span>{t('search.center.scope')}</span>
      <select aria-label={t('search.center.scope')} value={sessionRef !== undefined ? `session:${sessionRef}` : props.workspaceRef === undefined ? 'all' : `workspace:${props.workspaceRef}`}
        onChange={event => event.target.value.startsWith('session:') ? props.onSessionScope?.(event.target.value.slice('session:'.length)) : props.onScope(event.target.value === 'all' ? undefined : event.target.value.slice('workspace:'.length))}>
        <option value="all">{t('search.filter.allProjects')}</option>
        {!knownScope && <option value={`workspace:${props.workspaceRef}`} disabled>{t('search.center.scopeUnavailable')}</option>}
        {!knownSession && <option value={`session:${sessionRef}`} disabled>{t('search.center.sessionScopeUnavailable')}</option>}
        {props.onSessionScope && <optgroup label={t('search.category.session')}>{props.sessions?.map(session => <option key={session.sessionRef} value={`session:${session.sessionRef}`}>{session.title}</option>)}</optgroup>}
        {props.workspaces.map(workspace => <option key={workspace.workspaceRef} value={`workspace:${workspace.workspaceRef}`}>{workspace.label}</option>)}
      </select>
    </label>
    <div className="pwr-search-advanced-controls">
    <label className="ys-field"><span>{t('search.center.owner')}</span>
      <select aria-label={t('search.center.owner')} value={props.controls.owner ?? ''} onChange={event => props.onControls({ ...props.controls, owner: event.target.value || undefined })}>
        <option value="">{t('search.center.anyOwner')}</option>
        {props.owners.map(owner => <option key={owner} value={owner}>{owner}</option>)}
      </select>
    </label>
    <label className="ys-field"><span>{t('search.center.status')}</span>
      <select aria-label={t('search.center.status')} value={props.controls.status ?? ''} onChange={event => props.onControls({ ...props.controls, status: event.target.value || undefined })}>
        <option value="">{t('search.center.anyStatus')}</option>
        {props.statuses.map(status => <option key={status} value={status}>{status}</option>)}
      </select>
    </label>
    <label className="ys-field"><span>{t('search.center.updatedSince')}</span>
      <Input type="date" aria-label={t('search.center.updatedSince')} value={props.controls.updatedSince?.slice(0, 10) ?? ''}
        disabled={!props.canFilterTime} title={props.canFilterTime ? undefined : t('search.timeUnavailable')}
        onChange={event => props.onControls({ ...props.controls, updatedSince: event.target.value ? `${event.target.value}T00:00:00.000Z` : undefined })} />
    </label>
    <label className="ys-field"><span>{t('search.center.sort')}</span>
      <select aria-label={t('search.center.sort')} value={props.controls.sort} onChange={event => props.onControls({ ...props.controls, sort: event.target.value as SearchCenterControls['sort'] })}>
        <option value="relevance">{t('search.center.sort.relevance')}</option>
        <option value="name">{t('search.center.sort.name')}</option>
        <option value="updated" disabled={!props.canFilterTime}>{t('search.center.sort.updated')}</option>
      </select>
    </label>
    <Button variant="toolbar" size="sm" aria-pressed={props.openedOnly} onClick={props.onOpenedOnly}>{t('search.filter.opened')}</Button>
    </div>
  </div>
}

export const SEARCH_CENTER_FILTER_STYLES = `
.pwr-root .pwr-search-query-controls{display:flex;flex-wrap:wrap;align-items:flex-end;gap:var(--vk-gap-md);padding:0 var(--vk-gap-lg) var(--vk-gap-md)}
.pwr-search-advanced-controls{display:contents}
.pwr-root .pwr-search-query-controls .ys-field{min-width:0;flex:1 1 130px}
.pwr-root .pwr-search-query-controls select,.pwr-root .pwr-search-query-controls input{width:100%;min-width:0;max-width:100%;box-sizing:border-box;color:var(--vk-text-primary);background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);min-height:var(--vk-ctrl-input);font:inherit}
.pwr-root .pwr-search-query-controls button{background:transparent;color:var(--vk-text-primary);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);min-height:var(--vk-ctrl-button)}
.pwr-root .pwr-search-query-controls button[aria-pressed=true]{background:var(--vk-fill-selected)}
.pwr-root .pwr-search-filter-chips{display:flex;flex-wrap:wrap;gap:var(--vk-gap-sm);padding:0 var(--vk-gap-lg) var(--vk-gap-sm)}
.pwr-root .pwr-search-filter-chips button{color:var(--vk-text-secondary);background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);font:inherit;min-height:var(--vk-ctrl-button)}
@media(pointer:coarse){.pwr-root .pwr-search-query-controls input,.pwr-root .pwr-search-query-controls select,.pwr-root .pwr-search-query-controls button,.pwr-root .pwr-search-filter-chips button{min-height:44px}}
`

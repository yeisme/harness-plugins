import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { SEARCH_CENTER_FAMILIES, searchCenterFamily, searchCenterResourceKinds, type SearchCenterResourceKind } from './search-catalog.js'
import { sourcePreviewResults, type SearchCenterResult } from './search-source.js'
import type { WorkspaceSearchProviderGroup } from './search-query.js'
import { t, formatT } from './i18n/locale.js'
import { WorkbenchIcon } from './icon.js'

export function visibleProviderResults(groups: readonly WorkspaceSearchProviderGroup[], limit: number): readonly SearchCenterResult[] {
  return sourcePreviewResults(groups.flatMap(group => group.page.results), limit)
}

export function SearchProviderResults(props: {
  readonly groups: readonly WorkspaceSearchProviderGroup[]
  readonly limit: number
  readonly selectedKey?: string
  readonly busyKey?: string
  readonly listboxId: string
  readonly onSelect: (key: string) => void
  readonly onOpen: (result: SearchCenterResult) => void
  readonly onCategory: (kind: SearchCenterResourceKind) => void
  readonly onMore: (id: string, retry?: boolean) => void
}): ReactNode {
  const all = props.groups.flatMap(group => group.page.results)
  return <>
    {searchCenterResourceKinds('all').map(kind => {
      const results = all.filter(result => result.kind === kind)
      if (results.length === 0) return null
      return <section key={kind} className="pwr-search-group">
        <h3><span>{t(`search.center.category.${kind}`)}</span><small>{formatT('search.count.found', { count: results.length })}</small></h3>
        {results.slice(0, props.limit).map(result => {
          if (result.adapter !== 'source') return null
          const canOpen = props.groups.some(group => group.descriptor.id === result.sourceId && group.descriptor.open) && (result.resource.availability === undefined || result.resource.availability === 'available')
          return <div key={result.stableKey}
          id={`${props.listboxId}-${result.stableKey}`} role="option" aria-selected={result.stableKey === props.selectedKey}
          aria-label={result.resource.title} aria-busy={result.stableKey === props.busyKey || undefined}
          className={`pwr-search-row${result.stableKey === props.selectedKey ? ' pwr-search-row-selected' : ''}`}
          data-search-option={result.stableKey} onMouseMove={event => { if (event.movementX !== 0 || event.movementY !== 0) props.onSelect(result.stableKey) }} onClick={() => { props.onSelect(result.stableKey); if (canOpen) props.onOpen(result) }}>
          <WorkbenchIcon name={SEARCH_CENTER_FAMILIES.find(family => family.id === searchCenterFamily(kind))!.icon} size={16}/>
          <span className="pwr-search-copy"><strong>{result.resource.title}</strong><small>{[result.resource.sourceLabel, result.resource.owner, result.resource.projectRef,
            result.resource.revision, result.resource.status ?? result.resource.availability].filter(Boolean).join(' · ')}</small></span>
          {canOpen ? null : <span className="pwr-search-status">{t('search.center.openUnavailable')}</span>}
        </div>})}
        {results.length <= props.limit ? null : <Button variant="toolbar" size="sm" onClick={() => props.onCategory(kind)}>{t(props.limit > 5 ? 'search.center.showMore' : 'search.center.viewAll')}</Button>}
      </section>
    })}
    {props.groups.map(group => {
      const { page, descriptor } = group
      if (page.status === 'idle') return null
      const failed = ['error', 'offline', 'denied', 'disabled', 'stale'].includes(page.status)
      return <section key={descriptor.id} className="pwr-search-provider-state">
        {failed || page.status === 'loading' || (page.status === 'ready' && page.results.length === 0) ? <SurfaceState
          phase={page.status === 'loading' ? 'loading' : page.status === 'stale' ? 'stale' : page.status === 'error' || page.status === 'offline' ? 'error' : failed ? 'disabled' : 'empty'}
          title={t(`search.center.provider.${page.status === 'ready' ? 'empty' : page.status}`)}
          description={page.status === 'denied' ? undefined : `${descriptor.owner} · ${t(`search.center.coverage.${descriptor.coverage}`)}`}/>
          : <p className="pwr-search-coverage">{descriptor.owner} · {t(`search.center.coverage.${descriptor.coverage}`)}{page.status === 'partial' ? ` · ${t('search.partial')}` : ''}</p>}
        {['error', 'offline', 'stale'].includes(page.status) || page.reason === 'pagination_stalled'
          ? <Button variant="toolbar" size="sm" disabled={group.updating} onClick={() => props.onMore(descriptor.id, true)}>{t('management.search.retry')}</Button> : null}
        {page.nextCursor === undefined ? null : <Button variant="toolbar" size="sm" disabled={group.updating}
          onClick={() => props.onMore(descriptor.id)}>{t('management.loadMore')} · {descriptor.owner}</Button>}
      </section>
    })}
  </>
}

import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { t } from './i18n/locale.js'
import type { WorkspaceSearchCandidateV1 } from './search-identity.js'
import { matchWorkspaceSearchCandidate } from './search-match.js'
import type { SearchCenterResource } from './search-source.js'

/** Metadata only: never mount the target component or dereference an owner URL. */
export function SearchCenterPreview(props: {
  readonly candidate?: WorkspaceSearchCandidateV1
  readonly resource?: SearchCenterResource
  readonly onOpenResource?: () => void
  readonly query: string
  readonly onBack: () => void
  readonly onOpen: (candidate: WorkspaceSearchCandidateV1) => void
}): ReactNode {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  const candidate = props.candidate
  const item = props.resource === undefined ? candidate : { ...props.resource, ownerRef: props.resource.owner }
  const match = candidate === undefined ? undefined : matchWorkspaceSearchCandidate(candidate, props.query)
  const summary = candidate?.snippet ?? item?.description
  return <aside className="pwr-search-preview" aria-label={t('search.center.previewTitle')}>
    <Button variant="toolbar" size="sm" onClick={props.onBack}>{t('search.center.previewBack')}</Button>
    <h3 ref={heading} tabIndex={-1}>{item?.title ?? t('search.center.previewTitle')}</h3>
    {item === undefined ? <p role="status">{t('search.center.previewUnavailable')}</p> : <>
      <dl>
        <dt>{t('search.center.owner')}</dt><dd>{[props.resource?.sourceLabel, item.ownerRef].filter(Boolean).join(' · ')}</dd>
        <dt>{t('search.center.previewProject')}</dt><dd>{item.projectRef ?? t('search.center.previewUndeclared')}</dd>
        <dt>{t('search.center.previewVersion')}</dt><dd>{props.resource?.revision ?? t('search.center.previewUndeclared')}</dd>
        <dt>{t('search.center.previewMatch')}</dt><dd>{match?.field ?? t('search.center.previewUndeclared')}</dd>
      </dl>
      <p>{t('search.center.previewMetadata')}</p>
      {summary === undefined ? null : <section aria-label={t('search.center.previewDescription')}>
        <h4>{t('search.center.previewDescription')}</h4>
        <p className="pwr-search-preview-summary">{summary.slice(0, 8192)}</p>
      </section>}
      {item.kind === 'command' ? null : <Button variant="toolbar" size="sm" disabled={(item.availability !== undefined && item.availability !== 'available') || (props.resource !== undefined && props.onOpenResource === undefined)} onClick={() => {
        if (props.resource !== undefined) props.onOpenResource?.()
        else if (candidate !== undefined) props.onOpen(candidate)
      }}>{t('search.center.previewOpen')}</Button>}
    </>}
  </aside>
}

export const SEARCH_CENTER_PREVIEW_STYLES = `
.pwr-root .pwr-search-preview{min-width:0;flex:1;overflow:auto;padding:var(--vk-gap-lg);background:var(--vk-bg-layer-1);color:var(--vk-text-primary);overflow-wrap:anywhere}
.pwr-root .pwr-search-preview h3:focus{outline:2px solid var(--vk-border-focus);outline-offset:2px}
.pwr-root .pwr-search-preview dt{font-size:var(--vk-font-small);color:var(--vk-text-secondary);margin-top:var(--vk-gap-md)}
.pwr-root .pwr-search-preview dd{margin:0}
.pwr-root .pwr-search-preview-summary{white-space:pre-wrap}
.pwr-root .pwr-search-content[data-preview]>.pwr-search-main,.pwr-root .pwr-search-content[data-preview]>.pwr-search-sidebar{display:none}
@container yeisme-surface (min-width:1120px){
  .pwr-root .pwr-search-pane .pwr-search-content[data-preview]>.pwr-search-main{display:flex;min-width:480px}
  .pwr-root .pwr-search-pane .pwr-search-content[data-preview]>.pwr-search-sidebar{display:block}
  .pwr-root .pwr-search-pane .pwr-search-preview{flex:0 0 320px;box-sizing:border-box;border-left:1px solid var(--vk-border-l1)}
}
`

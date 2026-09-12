import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { WorkbenchIcon } from './icon.js'
import { t } from './i18n/locale.js'
import { SEARCH_CENTER_FAMILIES, searchCenterResourceKinds, type SearchCenterCategory, type SearchCenterResourceKind, type SearchCenterQuickView } from './search-catalog.js'

interface NavigationProps {
  readonly category: SearchCenterCategory
  readonly availableKinds: ReadonlySet<SearchCenterResourceKind>
  readonly onChange: (category: SearchCenterCategory) => void
  readonly quickView?: SearchCenterQuickView
  readonly onQuickView: (view: SearchCenterQuickView) => void
}

const QUICK_VIEWS = ['recent', 'opened', 'frequent'] as const

function label(category: SearchCenterCategory): string { return t(`search.center.category.${category}`) }

export function SearchCenterCategorySelect(props: NavigationProps) {
  return <label className="ys-field pwr-search-category-select">
    <span>{t('search.center.categories')}</span>
    <select value={props.quickView === undefined ? props.category : `quick:${props.quickView}`} aria-label={t('search.center.categories')} onChange={event => {
      const value = event.target.value
      if (value.startsWith('quick:')) props.onQuickView(value.slice(6) as SearchCenterQuickView)
      else props.onChange(value as SearchCenterCategory)
    }}>
      <option value="all">{label('all')}</option>
      {QUICK_VIEWS.map(view => <option key={view} value={`quick:${view}`}>{t(`search.center.quick.${view}`)}</option>)}
      {SEARCH_CENTER_FAMILIES.map(family => <optgroup key={family.id} label={label(family.id)}>
        <option value={family.id}>{label(family.id)}</option>
        {family.resources.map(kind => <option key={kind} value={kind}>{label(kind)}{props.availableKinds.has(kind) ? '' : ` · ${t('search.center.pending')}`}</option>)}
      </optgroup>)}
    </select>
  </label>
}

export function SearchCenterSidebar(props: NavigationProps) {
  return <nav className="pwr-search-sidebar" aria-label={t('search.center.categories')}>
    <Button variant="toolbar" size="sm" aria-pressed={props.category === 'all' && props.quickView === undefined} onClick={() => props.onChange('all')}>{label('all')}</Button>
    {QUICK_VIEWS.map(view => <Button key={view} variant="toolbar" size="sm" aria-pressed={props.quickView === view} onClick={() => props.onQuickView(view)}>{t(`search.center.quick.${view}`)}</Button>)}
    {SEARCH_CENTER_FAMILIES.map(family => {
      const expanded = props.category === family.id || (family.resources as readonly string[]).includes(props.category)
      return <div key={family.id}>
        <Button variant="toolbar" size="sm" aria-expanded={expanded} aria-pressed={props.category === family.id} onClick={() => props.onChange(family.id)}>
          <WorkbenchIcon name={family.icon} /><span>{label(family.id)}</span>
        </Button>
        {expanded && <div className="pwr-search-subcategories">
          {family.resources.map(kind => <Button key={kind} variant="toolbar" size="sm" aria-pressed={props.category === kind} onClick={() => props.onChange(kind)}>
            <span>{label(kind)}</span>{!props.availableKinds.has(kind) && <small>{t('search.center.pending')}</small>}
          </Button>)}
        </div>}
      </div>
    })}
  </nav>
}

export function SearchCenterDiscovery(props: NavigationProps) {
  return <section className="pwr-search-discovery" aria-label={t('search.center.explore')}>
    <h3>{t('search.center.explore')}</h3>
    <div className="pwr-search-category-grid">
      {SEARCH_CENTER_FAMILIES.map(family => <Button key={family.id} variant="toolbar" onClick={() => props.onChange(family.id)}>
        <WorkbenchIcon name={family.icon} />
        <span>{label(family.id)}</span>
        <small>{searchCenterResourceKinds(family.id).some(kind => props.availableKinds.has(kind))
          ? family.resources.slice(0, 3).map(label).join(' · ')
          : t('search.center.pending')}</small>
      </Button>)}
    </div>
  </section>
}

export const SEARCH_CENTER_NAVIGATION_STYLES = `
.pwr-root .pwr-search-content{display:flex;flex:1;min-height:0;overflow:hidden}
.pwr-root .pwr-search-main{display:flex;flex:1;min-width:0;min-height:0;flex-direction:column;overflow:auto}
.pwr-root .pwr-search-main .pwr-search-list{flex:none;overflow:visible}
.pwr-root .pwr-search-sidebar{display:none;flex:0 0 192px;overflow:auto;padding:var(--vk-gap-lg);border-right:1px solid var(--vk-border-l1)}
.pwr-root .pwr-search-sidebar button{display:flex;width:100%;justify-content:flex-start;text-align:start;white-space:normal;height:auto;min-height:var(--vk-ctrl-button);gap:var(--vk-gap-sm);font:inherit;color:var(--vk-text-primary);background:transparent;border:0;border-radius:var(--vk-radius-md);padding:var(--vk-gap-sm);cursor:pointer}
.pwr-root .pwr-search-sidebar button:hover{background:var(--vk-fill-hover)}
.pwr-root .pwr-search-sidebar button:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:-2px}
.pwr-root .pwr-search-sidebar button[aria-pressed=true]{background:var(--vk-fill-selected)}
.pwr-root .pwr-search-subcategories{padding-inline-start:var(--vk-gap-lg)}
.pwr-root .pwr-search-subcategories button{display:flex;flex-wrap:wrap}
.pwr-root .pwr-search-subcategories small{color:var(--vk-text-tertiary)}
.pwr-root .pwr-search-category-select{margin:0 var(--vk-gap-lg) var(--vk-gap-sm)}
.pwr-root .pwr-search-category-select select{max-width:100%;background:var(--vk-bg-layer-1);color:var(--vk-text-primary);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);min-height:var(--vk-ctrl-input)}
.pwr-root .pwr-search-discovery{padding:var(--vk-gap-lg)}
.pwr-root .pwr-search-discovery h3{font-size:var(--vk-font-heading);margin:0 0 var(--vk-gap-md)}
.pwr-root .pwr-search-category-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--vk-gap-md)}
.pwr-root .pwr-search-category-grid button{display:flex;flex-wrap:wrap;justify-content:flex-start;align-content:center;gap:var(--vk-gap-sm);white-space:normal;height:auto;min-height:88px;text-align:start;padding:var(--vk-gap-lg);border-radius:var(--vk-radius-md);background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1)}
.pwr-root .pwr-search-category-grid small{width:100%;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
.pwr-root .pwr-search-coverage{margin:0 var(--vk-gap-lg) var(--vk-gap-sm);font-size:var(--vk-font-small);color:var(--vk-text-secondary)}
@container yeisme-surface (min-width:721px){.pwr-root .pwr-search-pane .pwr-search-sidebar{display:block}.pwr-root .pwr-search-pane .pwr-search-category-select{display:none}}
@container yeisme-surface (max-width:520px){.pwr-root .pwr-search-category-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container yeisme-surface (max-width:350px){.pwr-root .pwr-search-category-grid{grid-template-columns:minmax(0,1fr)}}
@media(pointer:coarse){.pwr-root .pwr-search-sidebar button,.pwr-root .pwr-search-category-select select{min-height:44px}}
`

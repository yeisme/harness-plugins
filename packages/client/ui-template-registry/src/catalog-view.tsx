/**
 * 模板目录 pane (task 3.1): navigator surface — left category/tag facets,
 * middle results list (primary scroll owner), right inspect detail with
 * fail-closed preview rights. Full state matrix: loading skeleton, offline
 * error + retry, degraded catalog snapshot badge + refresh, empty-with-
 * clear-filters, owner error strips, and disabled preview with a stable
 * reason. Keyboard path: filter box -> results listbox (arrow keys) ->
 * detail; the collapsible regions are native disclosures so focus returns
 * to their summary on close.
 *
 * @module @yeisme/dsh-client-ui-template-registry/catalog-view
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { Template, TemplateInspection, TemplatePreview } from '@yeisme/dsh-template-registry'
import {
  filterTemplates,
  isTemplateCatalogFilterActive,
  moveCatalogSelection,
  templateCatalogFacets,
  type TemplateCatalogController,
  type TemplateCatalogState,
} from './catalog-controller.js'
import type { TemplateRegistryLocale } from './seam.js'
import { templatePreviewReasonText, templateRegistryTranslator } from './locales.js'

const styles = `
[data-template-registry-catalog] .tr-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-width:0}
[data-template-registry-catalog] .tr-nav{display:grid;gap:4px;align-content:start;min-width:0}
[data-template-registry-catalog] .tr-nav h3{margin:6px 0 2px;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);font-weight:650}
[data-template-registry-catalog] .tr-nav button{display:block;width:100%;min-height:30px;padding:5px 8px;color:var(--vk-text-secondary);text-align:left;background:transparent;border:0;border-radius:var(--vk-radius-md);font:inherit;font-size:var(--vk-font-small);cursor:pointer}
[data-template-registry-catalog] .tr-nav button[aria-pressed='true']{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
[data-template-registry-catalog] .tr-listbox{display:grid;gap:4px;min-width:0;margin:0;padding:0;list-style:none}
[data-template-registry-catalog] .tr-option{display:grid;gap:2px;min-height:44px;padding:7px 9px;border-radius:var(--vk-radius-md);cursor:pointer}
[data-template-registry-catalog] .tr-option:hover{background:var(--vk-fill-hover)}
[data-template-registry-catalog] .tr-option[data-selected='true']{background:var(--vk-fill-hover)}
[data-template-registry-catalog] .tr-option strong{overflow:hidden;color:var(--vk-text-primary);font-size:var(--vk-font-body);text-overflow:ellipsis;white-space:nowrap}
[data-template-registry-catalog] .tr-option small{overflow:hidden;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);text-overflow:ellipsis;white-space:nowrap}
[data-template-registry-catalog] .tr-detail{display:grid;gap:8px;min-width:0;padding:8px;border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md)}
[data-template-registry-catalog] .tr-detail>summary{min-height:var(--vk-ctrl-touch);color:var(--vk-text-secondary);cursor:pointer;font-weight:650}
[data-template-registry-catalog] .tr-filters{display:grid;gap:8px;min-width:0;padding:8px;border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md)}
[data-template-registry-catalog] .tr-filters>summary{min-height:var(--vk-ctrl-touch);color:var(--vk-text-secondary);cursor:pointer;font-weight:650}
[data-template-registry-catalog] .tr-dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 10px;margin:0;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
[data-template-registry-catalog] .tr-dl dt{color:var(--vk-text-tertiary)}
[data-template-registry-catalog] .tr-dl dd{margin:0;overflow-wrap:anywhere}
[data-template-registry-catalog] .tr-badge{display:inline-block;padding:1px 6px;color:var(--vk-text-secondary);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-sm);font-size:var(--vk-font-micro)}
[data-template-registry-catalog] .tr-actions{display:flex;flex-wrap:wrap;gap:6px}
[data-template-registry-catalog] .tr-preview{margin:0;color:var(--vk-text-secondary);font-size:var(--vk-font-small);overflow-wrap:anywhere}
[data-template-registry-catalog] .tr-skeleton{display:grid;gap:4px}
[data-template-registry-catalog] .tr-skeleton .vk-skeleton{min-height:30px;border-radius:var(--vk-radius-md)}
@container yeisme-surface (min-width:421px){[data-template-registry-catalog] .tr-layout{grid-template-columns:150px minmax(0,1fr)}[data-template-registry-catalog] .tr-detail{grid-column:1/-1}}
@container yeisme-surface (min-width:721px){[data-template-registry-catalog] .tr-layout{grid-template-columns:160px minmax(200px,1.3fr) minmax(220px,1fr)}[data-template-registry-catalog] .tr-detail{grid-column:auto}}
@media(pointer:coarse){[data-template-registry-catalog] .tr-nav button,[data-template-registry-catalog] .tr-option{min-height:44px}}
@media(prefers-reduced-motion:reduce){[data-template-registry-catalog] *{transition:none!important;animation:none!important}}
`

export interface TemplateCatalogViewProps {
  readonly controller: TemplateCatalogController
  readonly locale?: TemplateRegistryLocale
  /** Cross-pane link: pin this template in the guided-compile pane. */
  readonly onCompile?: (template: Template) => void
}

export function TemplateCatalogView({ controller, locale = 'zh', onCompile }: TemplateCatalogViewProps) {
  const [state, setState] = useState<TemplateCatalogState>(() => controller.snapshot())
  useEffect(() => {
    const dispose = controller.subscribe(setState)
    setState(controller.snapshot())
    void controller.refresh()
    return () => dispose()
  }, [controller])
  const t = templateRegistryTranslator(locale)
  const optionRefs = useRef(new Map<string, HTMLDivElement>())
  const visible = useMemo(() => filterTemplates(state.templates, state.filters), [state.templates, state.filters])
  const facets = useMemo(() => templateCatalogFacets(state.templates), [state.templates])
  const filtersActive = isTemplateCatalogFilterActive(state.filters)
  const health = controller.health()
  const degraded = state.phase === 'ready' && state.origin === 'catalog'
  const connected = health.state === 'connected'

  const focusOption = (ref: string): void => {
    const node = optionRefs.current.get(ref)
    if (node !== undefined && node.isConnected) node.focus()
  }

  const selectFromKeyboard = (key: string): void => {
    const index = visible.findIndex(template => template.ref === state.selection)
    const next = moveCatalogSelection(key, index < 0 ? 0 : index, visible.length)
    const target = visible[next]
    if (target === undefined || target.ref === state.selection) return
    void controller.select(target.ref)
    focusOption(target.ref)
  }

  const detail = state.detail
  const inspection = detail?.phase === 'ready' ? detail.inspection : undefined
  const selected = state.selection !== undefined ? state.templates.find(template => template.ref === state.selection) : undefined

  return <Surface kind="navigator" data-template-registry-catalog aria-label={t('catalogTitle')}>
    <style>{styles}</style>
    <SurfaceContextBar
      title={t('catalogTitle')}
      context={state.phase === 'ready' ? `${visible.length}/${state.templates.length}` : undefined}
      status={degraded ? <span className="tr-badge">{t('degradedCatalog')}</span> : undefined}
      actions={<Button onClick={() => { void controller.refresh() }}>{t('refresh')}</Button>}
    />
    <div className="ys-body">
      <details className="tr-filters" open>
        <summary>{locale === 'zh' ? '过滤' : locale === 'pseudo' ? '[!! Filters Filters !!]' : 'Filters'}</summary>
        <label className="ys-field" htmlFor="tr-catalog-search">{t('searchLabel')}
          <Input id="tr-catalog-search" value={state.filters.query} onChange={event => controller.setFilters({ query: event.target.value })} />
        </label>
        <label className="ys-field" htmlFor="tr-catalog-tag">{t('tagFilterLabel')}
          <select id="tr-catalog-tag" value={state.filters.tag ?? ''} onChange={event => controller.setFilters({ tag: event.target.value === '' ? null : event.target.value })}>
            <option value="">{t('allTags')}</option>
            {facets.tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
        <label className="ys-field" htmlFor="tr-catalog-capability">{t('capabilityFilterLabel')}
          <select id="tr-catalog-capability" value={state.filters.capability ?? ''} onChange={event => controller.setFilters({ capability: event.target.value === '' ? null : event.target.value })}>
            <option value="">{t('allCapabilities')}</option>
            {facets.capabilities.map(capability => <option key={capability} value={capability}>{capability}</option>)}
          </select>
        </label>
      </details>

      {state.phase === 'loading' ? <SurfaceState phase="loading" title={t('loadingCatalog')} description={<span className="tr-skeleton" aria-hidden="true">
        <span className="vk-skeleton" /><span className="vk-skeleton" /><span className="vk-skeleton" /><span className="vk-skeleton" />
      </span>} /> : null}

      {state.phase === 'error' ? <SurfaceState phase="error"
        title={state.errorReason === 'offline' ? t('registryOffline') : state.errorReason === 'registry_error' ? t('registryError') : t('contractMismatch')}
        description={state.errorReason === 'offline' ? t('registryOfflineHelp') : state.errorCode ?? undefined}
        action={<Button onClick={() => { void controller.retry() }}>{t('retryProbe')}</Button>} /> : null}

      {state.phase === 'ready' ? <>
        {degraded ? <SurfaceState phase="partial" title={t('degradedCatalog')} description={t('degradedCatalogHelp')} /> : null}
        {visible.length === 0 ? <SurfaceState phase="empty" title={t('noMatch')}
          action={filtersActive ? <Button onClick={() => controller.clearFilters()}>{t('clearFilters')}</Button> : undefined} /> : null}
        {visible.length > 0 ? <div className="tr-layout">
          <nav className="tr-nav" aria-label={t('navFacets')}>
            <h3>{t('tagFilterLabel')}</h3>
            <button type="button" aria-pressed={state.filters.tag === null} onClick={() => controller.setFilters({ tag: null })}>{t('allTags')}</button>
            {facets.tags.slice(0, 12).map(tag => <button type="button" key={tag} aria-pressed={state.filters.tag === tag} onClick={() => controller.setFilters({ tag })}>{tag}</button>)}
            <h3>{t('capabilityFilterLabel')}</h3>
            <button type="button" aria-pressed={state.filters.capability === null} onClick={() => controller.setFilters({ capability: null })}>{t('allCapabilities')}</button>
            {facets.capabilities.slice(0, 12).map(capability => <button type="button" key={capability} aria-pressed={state.filters.capability === capability} onClick={() => controller.setFilters({ capability })}>{capability}</button>)}
          </nav>
          <section aria-label={t('resultsHeading')}>
            <div className="tr-listbox" role="listbox" aria-label={t('resultsHeading')}
              onKeyDown={event => {
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Home' || event.key === 'End') {
                  event.preventDefault()
                  selectFromKeyboard(event.key)
                }
              }}>
              {visible.map(template => {
                const isSelected = state.selection === template.ref
                const fallbackFocus = state.selection === undefined && visible[0] !== undefined && visible[0].ref === template.ref
                return <div
                  key={template.ref}
                  ref={node => {
                    if (node === null) optionRefs.current.delete(template.ref)
                    else optionRefs.current.set(template.ref, node)
                  }}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={isSelected || fallbackFocus ? 0 : -1}
                  data-selected={isSelected}
                  onClick={() => { void controller.select(template.ref) }}
                  onFocus={() => { if (!isSelected) void controller.select(template.ref) }}
                >
                  <strong>{template.title}</strong>
                  <small>{template.maturity} · {template.tags.slice(0, 3).join(' · ')}</small>
                  <small>{template.summary}</small>
                </div>
              })}
            </div>
          </section>
          <details className="tr-detail" open>
            <summary>{t('detailHeading')}</summary>
            {inspection === undefined ? <SurfaceState phase="empty" title={t('selectTemplate')} /> : null}
            {detail?.phase === 'loading' ? <SurfaceState phase="loading" title={t('detailLoading')} /> : null}
            {detail?.phase === 'error' ? <SurfaceState phase={detail.reason === 'degraded' ? 'disabled' : 'error'}
              title={t('detailUnavailable')} description={detail.reason} /> : null}
            {inspection !== undefined ? <TemplateInspectionPanel
              inspection={inspection}
              connected={connected}
              locale={locale}
              onCompile={onCompile}
              onPreview={() => { if (selected !== undefined) void controller.loadPreview(selected.ref) }}
              preview={detail?.preview}
            /> : null}
          </details>
        </div> : null}
      </> : null}
    </div>
  </Surface>
}

function TemplateInspectionPanel({ inspection, connected, locale, onCompile, onPreview, preview }: {
  readonly inspection: TemplateInspection
  readonly connected: boolean
  readonly locale: TemplateRegistryLocale
  readonly onCompile?: ((template: Template) => void) | undefined
  readonly onPreview: () => void
  readonly preview?: TemplatePreview | undefined
}) {
  const t = templateRegistryTranslator(locale)
  const template = inspection.template
  const previewAllowed = template.rights.preview
  const previewReason = preview !== undefined && preview.allowed === false ? templatePreviewReasonText(locale, preview.reason) : undefined
  const compileDisabledReason = !connected
    ? (locale === 'zh' ? 'MCP 未连接，编译会话动作已禁用' : 'session actions stay disabled while the MCP seam is down')
    : !template.rights.export
      ? (locale === 'zh' ? '该模板未授予导出权限' : 'this template grants no export permission')
      : undefined
  return <SurfaceSection title={template.title} description={template.summary}>
    <dl className="tr-dl">
      <dt>{t('ref')}</dt><dd>{template.ref}</dd>
      <dt>{t('digest')}</dt><dd>{template.digest}</dd>
      <dt>{t('maturity')}</dt><dd>{template.maturity}</dd>
      <dt>{t('license')}</dt><dd>{inspection.contract.license}</dd>
      {template.version !== undefined ? <><dt>{t('version')}</dt><dd>{template.version}</dd></> : undefined}
      <dt>{t('contractDigest')}</dt><dd>{inspection.contract.digest}</dd>
      <dt>{t('rights')}</dt><dd>{t('rightsPreview')}: {template.rights.preview ? t('allowed') : t('denied')} · {t('rightsExport')}: {template.rights.export ? t('allowed') : t('denied')}</dd>
      {inspection.usage !== undefined ? <><dt>{t('usage')}</dt><dd>{inspection.usage}</dd></> : undefined}
    </dl>
    {inspection.issues.length > 0 ? <ul>{inspection.issues.map((issue, index) => <li key={index}>{issue.code}{issue.field === undefined ? '' : ` · ${issue.field}`}{issue.step === undefined ? '' : ` · ${issue.step}`}</li>)}</ul> : null}
    <div className="tr-actions">
      <Button
        disabled={!previewAllowed}
        title={!previewAllowed ? (locale === 'zh' ? '该模板未授予预览权限' : 'this template grants no preview permission') : undefined}
        aria-describedby={!previewAllowed ? 'tr-preview-denied' : undefined}
        onClick={onPreview}
      >{t('previewButton')}</Button>
      {!previewAllowed ? <span id="tr-preview-denied" role="status">{previewReason ?? (locale === 'zh' ? '该模板未授予预览权限' : 'this template grants no preview permission')}</span> : null}
      <Button
        disabled={compileDisabledReason !== undefined}
        title={compileDisabledReason}
        aria-describedby={compileDisabledReason !== undefined ? 'tr-compile-denied' : undefined}
        onClick={() => onCompile?.(template)}
      >{t('openCompile')}</Button>
      {compileDisabledReason !== undefined ? <span id="tr-compile-denied" role="status">{compileDisabledReason}</span> : null}
    </div>
    {preview !== undefined && preview.allowed ? <p className="tr-preview">{preview.summary}{preview.usage === undefined ? '' : ` — ${preview.usage}`}</p> : null}
    {preview !== undefined && preview.allowed === false ? <p className="tr-preview" role="status">{previewReason}</p> : null}
  </SurfaceSection>
}

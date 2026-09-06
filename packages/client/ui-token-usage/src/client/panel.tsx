import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { TokenUsageViewModel } from './projection.ts'
import type { TokenUsageTranslator } from './locales.ts'

const styles = `
[data-dsh-token-usage-panel]{font:inherit}
[data-dsh-token-usage-panel] .tu-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--vk-gap-md)}
[data-dsh-token-usage-panel] .tu-stat{display:grid;gap:3px;padding:8px 10px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
[data-dsh-token-usage-panel] .tu-stat span{color:var(--vk-text-tertiary);font-size:10px;letter-spacing:.06em;text-transform:uppercase}[data-dsh-token-usage-panel] .tu-stat strong{font-size:var(--vk-font-title)}
[data-dsh-token-usage-panel] .tu-list{display:grid;gap:5px;margin:0;padding:0;list-style:none}[data-dsh-token-usage-panel] .tu-row{display:flex;justify-content:space-between;gap:var(--vk-gap-lg);padding:5px 8px;border-radius:var(--vk-radius-sm);background:var(--vk-bg-layer-1)}[data-dsh-token-usage-panel] .tu-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-token-usage-panel] .tu-balance{padding:12px;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg)}
[data-dsh-token-usage-panel] .tu-balance-line{display:flex;justify-content:space-between;font-weight:650}
[data-dsh-token-usage-panel] .tu-notice{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
[data-dsh-token-usage-panel] .tu-legacy{display:inline-block;padding:1px 8px;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-sm)}
@container yeisme-surface (max-width:420px){[data-dsh-token-usage-panel] .tu-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(pointer:coarse){[data-dsh-token-usage-panel] .tu-btn{min-height:44px;min-width:44px}}
@media(prefers-reduced-motion:reduce){[data-dsh-token-usage-panel] *{transition:none!important;animation:none!important}}
`

export interface TokenUsagePanelProps {
  readonly model: TokenUsageViewModel
  readonly t: TokenUsageTranslator
  readonly onRefresh?: () => void
  readonly refreshing?: boolean
  /** Usage-slice retry (explicit); independent of the balance refresh. */
  readonly onRetryUsage?: () => void
  /**
   * True when the host predates the session insights query: the panel then
   * shows the legacy process-observed statistics, explicitly labeled — never
   * presented as full-session statistics.
   */
  readonly legacy?: boolean
}

export function TokenUsagePanel({ model, t, onRefresh, refreshing = false, onRetryUsage, legacy = false }: TokenUsagePanelProps) {
  const balanceBusy = refreshing || model.balance.busy
  return (
    <Surface kind="navigator" data-dsh-token-usage-panel aria-label={t('panel.title')}>
      <style>{styles}</style>
      <SurfaceContextBar
        title={t('panel.title')}
        status={legacy ? <span className="tu-legacy" data-legacy-tag>{t('panel.legacyTag')}</span> : undefined}
        description={`${t('panel.subtitle')}${model.generatedAt === null ? '' : ` · ${t('generatedAt')} ${model.generatedAt.slice(11, 19)} UTC`}${model.usageStale ? ` · ${t('balance.stale')}` : ''}`} />
      <div className="ys-body">
        {model.usageError !== null ? (
          <SurfaceState phase="error" title={model.usageError} data-usage-error
            action={onRetryUsage === undefined ? undefined : (
              <Button type="button" size="sm" variant="toolbar" className="tu-btn" data-usage-retry
                onClick={() => { onRetryUsage() }}>{t('usage.error.retry')}</Button>
            )} />
        ) : null}
        {model.usageAvailable ? <>
          <div className="tu-grid">
            <div className="tu-stat"><span>{t('window.session')}</span><strong data-current-session>{model.currentSession?.text ?? '—'}</strong></div>
            <div className="tu-stat"><span>{t('window.today')}</span><strong>{model.todayText}</strong></div>
            <div className="tu-stat"><span>{t('window.week')}</span><strong>{model.weekText}</strong></div>
            <div className="tu-stat"><span>{t('window.process')}</span><strong>{model.processText}</strong></div>
          </div>
          <SurfaceSection title={t('section.sessions')}>
            {model.bySession.length === 0 ? <SurfaceState phase="empty" title={t('empty.sessions')} /> : <ul className="tu-list">{model.bySession.map(row => <li className="tu-row" key={row.label}><span>{row.label}</span><strong>{row.text}</strong></li>)}</ul>}
            {model.truncated ? <p className="tu-notice">{t('truncated')}</p> : null}
          </SurfaceSection>
          {model.byProvider.length > 0 ? <SurfaceSection title={t('section.providers')}><ul className="tu-list">{model.byProvider.map(row => <li className="tu-row" key={row.label}><span>{row.label}</span><strong>{row.text}</strong></li>)}</ul></SurfaceSection> : null}
        </> : model.usageError === null ? <SurfaceState phase="empty" title={t('empty.usage')} data-usage-unavailable /> : null}
        <SurfaceSection className="tu-balance" title={`${t('balance.title')}${model.balance.freshness === 'stale' ? ` · ${t('balance.stale')}` : ''}`} meta={model.balance.canRefresh ? <Button type="button" size="sm" variant="toolbar" className="tu-btn" data-dsh-token-usage-refresh disabled={balanceBusy} onClick={() => { onRefresh?.() }}>{balanceBusy ? t('balance.refreshing') : t('balance.refresh')}</Button> : undefined}>
          {model.balance.error !== null ? <SurfaceState phase="error" title={model.balance.error} data-balance-error /> : null}
          {!model.balance.queried ? <SurfaceState phase="empty" title={t('balance.idle')} data-balance-idle /> : model.balance.visible ? model.balance.lines.map(line => { const [currency, amount] = line.split(' '); return <div className="tu-balance-line" key={line}><span>{currency}</span><strong data-balance-amount>{amount}</strong></div> }) : <SurfaceState phase="disabled" title={model.balance.message ?? t('balance.unavailable')} data-balance-message />}
        </SurfaceSection>
      </div>
    </Surface>
  )
}

/**
 * Session insights statistics pane (Surface inspector).
 *
 * One top context bar (session + scope + freshness/coverage + refresh);
 * body order: overview one-line metrics, usage composition, context,
 * model/provider distribution, paginated request list. Balance and cost
 * basis collapse into a secondary account block with its own busy/error/
 * stale state and explicit refresh. Request rows carry opaque refs for the
 * same-session trajectory locator; when the seam is unavailable the row
 * action is disabled with the reason and the statistics view stays put.
 *
 * All styles are scoped under [data-dsh-token-usage-insights] and consume
 * --vk-* tokens only — no global selectors, no literal fallbacks.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Button, DisclosureRow, Input, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { SessionInsightsBindingState } from './insights-binding.ts'
import type { InsightsRequestRowVM, SessionInsightsViewModel } from './insights-projection.ts'
import { deriveSessionInsightsViewModel } from './insights-projection.ts'
import type { TokenUsageKey, TokenUsageTranslator } from './locales.ts'
import type { TokenBalanceSlice } from './controller.ts'
import { SESSION_DIRECTORY_PAGE_SIZE, type SessionDirectoryEntryV1, type SessionDirectoryProbe } from './session-directory.ts'
import type { SessionInsightsScope } from '../wire.ts'

const S = '[data-dsh-token-usage-insights]'
const styles = `
${S}{font:inherit}
${S} .tui-metrics{display:flex;flex-wrap:wrap;gap:var(--vk-gap-sm) var(--vk-gap-lg);margin:0;padding:0;list-style:none}
${S} .tui-metric{display:flex;align-items:baseline;gap:var(--vk-gap-sm)}
${S} .tui-metric span{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .tui-metric strong{font-size:var(--vk-font-strong);font-weight:650}
${S} .tui-bar{display:flex;height:6px;overflow:hidden;border-radius:var(--vk-radius-sm);background:var(--vk-bg-layer-2)}
${S} .tui-bar i{display:block;height:100%}
${S} .tui-bar .tui-seg-input{background:var(--vk-accent)}
${S} .tui-bar .tui-seg-output{background:var(--vk-state-positive)}
${S} .tui-bar .tui-seg-cacheread{background:var(--vk-state-info)}
${S} .tui-bar .tui-seg-cachewrite{background:var(--vk-state-warn)}
${S} .tui-rows{display:grid;gap:var(--vk-gap-xs);margin:0;padding:0;list-style:none}
${S} .tui-rowline{display:flex;justify-content:space-between;gap:var(--vk-gap-lg);padding:5px 8px;border-radius:var(--vk-radius-sm);background:var(--vk-bg-layer-1)}
${S} .tui-rowline span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .tui-rowline strong{font-variant-numeric:tabular-nums}
${S} .tui-req{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:var(--vk-gap-sm);min-height:38px;padding:6px 9px;border-radius:var(--vk-radius-md)}
${S} .tui-req:hover{background:var(--vk-fill-hover)}
${S} .tui-req-main{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px var(--vk-gap-md);min-width:0}
${S} .tui-req-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
${S} .tui-req-main small{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .tui-note{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .tui-busy{display:flex;align-items:center;gap:var(--vk-gap-sm);padding:6px 10px;color:var(--vk-text-secondary);font-size:var(--vk-font-small);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);background:var(--vk-bg-layer-1)}
${S} .tui-scope-fields{display:flex;flex-wrap:wrap;align-items:flex-end;gap:var(--vk-gap-md)}
${S} .tui-scope-fields .ys-field{min-width:140px}
${S} .tui-pager{display:flex;align-items:center;gap:var(--vk-gap-md)}
${S} .tui-directory{display:grid;gap:var(--vk-gap-sm)}
${S} .tui-dir-rows{display:grid;gap:var(--vk-gap-xs);margin:0;padding:0;list-style:none}
${S} .tui-dir-row{display:flex;align-items:center;justify-content:space-between;gap:var(--vk-gap-md);min-height:38px;padding:6px 9px;border-radius:var(--vk-radius-md);background:var(--vk-bg-layer-1)}
${S} .tui-dir-row[data-current="true"]{outline:1px solid var(--vk-border-l1)}
${S} .tui-dir-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
${S} .tui-dir-label small{color:var(--vk-text-tertiary);font-size:var(--vk-font-small);font-weight:400}
${S} .tui-dir-current{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .tui-dir-head{display:flex;align-items:center;justify-content:flex-end;gap:var(--vk-gap-md)}
${S} .tui-account{display:grid;gap:var(--vk-gap-sm);padding:var(--vk-gap-md) 0}
${S} .tui-balance-line{display:flex;justify-content:space-between;font-weight:650}
${S} .tui-costs{margin:0;padding-left:16px;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
${S} .tui-req .tui-locate:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:1px}
${S} .tui-dir-use:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:1px}
@container yeisme-surface (max-width:420px){
  ${S} .tui-req{grid-template-columns:minmax(0,1fr)}
  ${S} .tui-req .tui-locate{justify-self:start}
  ${S} .tui-scope-fields .ys-field{flex:1 1 100%}
}
@media(pointer:coarse){
  ${S} .tui-btn,${S} .tui-locate,${S} .tui-scope,${S} .tui-dir-use{min-height:44px;min-width:44px}
}
@media(prefers-reduced-motion:reduce){
  ${S} *{transition:none!important;animation:none!important}
}
`

export interface SessionInsightsTrajectorySeam {
  readonly available: boolean
  readonly reason?: string
  /** Locate the official Trajectory inside the same-session pane. */
  readonly locate?: (refs: InsightsRequestRowVM['refs']) => void
}

export interface SessionInsightsScopeDraft {
  readonly scope: SessionInsightsScope
  readonly runRef?: string
  readonly from?: string
  readonly to?: string
}

export interface SessionInsightsPanelProps {
  readonly state: SessionInsightsBindingState
  readonly t: TokenUsageTranslator
  readonly onRefresh: () => void
  readonly onLoadMore?: () => void
  /** Explicit scope switch; the parent re-binds (never implicit). */
  readonly onScopeChange?: (draft: SessionInsightsScopeDraft) => void
  /**
   * Official accessible-session directory seam (design §1). Absent → the
   * target switcher is disabled with the probe reason; the legacy ledger
   * `bySession` top-20 is never used as a substitute directory.
   */
  readonly directory?: SessionDirectoryProbe
  /** Currently bound statistics target (for the "current" marker). */
  readonly targetRef?: string
  /** Explicit statistics-target switch; the parent re-binds (never implicit). */
  readonly onTargetChange?: (sessionRef: string) => void
  readonly trajectory?: SessionInsightsTrajectorySeam
  readonly account?: {
    readonly slice: TokenBalanceSlice
    readonly onRefresh: () => void
  }
}

const STATUS_KEY: Record<InsightsRequestRowVM['status'], TokenUsageKey> = {
  completed: 'insights.request.status.completed',
  cancelled: 'insights.request.status.cancelled',
  failed: 'insights.request.status.failed',
  unknown: 'insights.request.status.unknown',
}

const METRIC_KEY: Record<string, TokenUsageKey> = {
  requests: 'insights.metric.requests',
  total: 'insights.metric.total',
  output: 'insights.metric.output',
  cacheRead: 'insights.metric.cacheRead',
  wallClock: 'insights.metric.wallClock',
  sumDuration: 'insights.metric.sumDuration',
}

const BUCKET_KEY: Record<string, TokenUsageKey> = {
  uncachedInput: 'insights.bucket.uncachedInput',
  output: 'insights.bucket.output',
  cacheRead: 'insights.bucket.cacheRead',
  cacheWrite: 'insights.bucket.cacheWrite',
}

function freshnessLabel(model: SessionInsightsViewModel, stale: boolean, t: TokenUsageTranslator): string {
  if (stale || model.freshness === 'stale') return t('insights.freshness.stale')
  if (model.freshness === 'unknown') return t('insights.freshness.unknown')
  return `${t('generatedAt')} ${model.generatedAt.slice(11, 19)} UTC`
}

function ScopeNav({ scope, t, onScopeChange }: {
  readonly scope: SessionInsightsScope
  readonly t: TokenUsageTranslator
  readonly onScopeChange?: (draft: SessionInsightsScopeDraft) => void
}): ReactNode {
  const [draftScope, setDraftScope] = useState<SessionInsightsScope>(scope)
  const [runRef, setRunRef] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const draft: SessionInsightsScopeDraft = draftScope === 'session'
    ? { scope: 'session' }
    : draftScope === 'run'
      ? { scope: 'run', ...(runRef.trim().length === 0 ? {} : { runRef: runRef.trim() }) }
      : { scope: 'range', ...(from.trim().length === 0 ? {} : { from: from.trim() }), ...(to.trim().length === 0 ? {} : { to: to.trim() }) }
  // The apply action is explicit; invalid drafts (missing runRef/from/to or
  // no change) stay disabled with the fields explaining what is required.
  const valid = draftScope !== scope
    && (draftScope === 'session'
      || (draftScope === 'run' && draft.runRef !== undefined)
      || (draftScope === 'range' && draft.from !== undefined && draft.to !== undefined))
  const apply = (): void => {
    if (!valid) return
    onScopeChange?.(draft)
  }
  return (
    <>
      {(['session', 'run', 'range'] as const).map(value => (
        <Pill key={value} className="tui-scope" type="button" active={draftScope === value}
          onClick={() => { setDraftScope(value) }}>
          {t(value === 'session' ? 'insights.scope.session' : value === 'run' ? 'insights.scope.run' : 'insights.scope.range')}
        </Pill>
      ))}
      {draftScope !== 'session' ? (
        <span className="tui-scope-fields">
          {draftScope === 'run' ? (
            <label className="ys-field"><span>{t('insights.scope.runRef')}</span>
              <Input value={runRef} onChange={event => { setRunRef(event.currentTarget.value) }} />
            </label>
          ) : (
            <>
              <label className="ys-field"><span>{t('insights.scope.from')}</span>
                <Input value={from} onChange={event => { setFrom(event.currentTarget.value) }} />
              </label>
              <label className="ys-field"><span>{t('insights.scope.to')}</span>
                <Input value={to} onChange={event => { setTo(event.currentTarget.value) }} />
              </label>
            </>
          )}
        </span>
      ) : null}
      <Button type="button" size="sm" variant="toolbar" className="tui-btn" disabled={!valid} onClick={apply}>
        {t('insights.scope.apply')}
      </Button>
    </>
  )
}

function BreakdownList({ title, rows, truncated, t }: {
  readonly title: string
  readonly rows: SessionInsightsViewModel['byModel']
  readonly truncated: boolean
  readonly t: TokenUsageTranslator
}): ReactNode {
  if (rows.length === 0) return null
  return (
    <SurfaceSection title={title}>
      <ul className="tui-rows">
        {rows.map(row => (
          <li className="tui-rowline" key={row.key}>
            <span>{row.label} · {row.requestCount}</span>
            <strong>{row.tokensText ?? '—'}</strong>
          </li>
        ))}
      </ul>
      {truncated ? <p className="tui-note">{t('insights.breakdownTruncated')}</p> : null}
    </SurfaceSection>
  )
}

function AccountBlock({ account, costs, t }: {
  readonly account: SessionInsightsPanelProps['account']
  readonly costs: readonly string[]
  readonly t: TokenUsageTranslator
}): ReactNode {
  const [open, setOpen] = useState(false)
  const slice = account?.slice
  const busy = slice?.status === 'loading'
  const balance = slice?.status === 'ready' ? slice.balance
    : slice?.status === 'error' || slice?.status === 'loading' ? slice.previous
      : undefined
  const unsupported = balance?.status === 'unsupported'
  const stale = slice?.status === 'error' || balance?.freshness === 'stale'
  return (
    <SurfaceSection title={t('insights.section.account')}>
      <DisclosureRow
        icon={null}
        title={`${t('balance.title')}${stale ? ` · ${t('balance.stale')}` : ''}`}
        open={open}
        expandable
        expandOnRowClick
        onToggle={() => { setOpen(value => !value) }}
      >
        <div className="tui-account">
          {slice === undefined || slice.status === 'idle' ? (
            <SurfaceState phase="empty" title={t('balance.idle')} data-balance-idle />
          ) : null}
          {slice?.status === 'error' ? (
            <SurfaceState phase="error" title={slice.message} data-balance-error />
          ) : null}
          {busy ? <p className="tui-note" role="status">{t('balance.refreshing')}</p> : null}
          {balance !== undefined && balance.status === 'ready' && balance.infos !== undefined ? (
            balance.infos.map(info => (
              <div className="tui-balance-line" key={info.currency}>
                <span>{info.currency}</span>
                <strong data-balance-amount>{info.totalBalance}</strong>
              </div>
            ))
          ) : null}
          {balance !== undefined && balance.status !== 'ready' ? (
            <SurfaceState phase="disabled" title={balance.safeMessage} data-balance-message />
          ) : null}
          {costs.length > 0 ? (
            <>
              <p className="tui-note">{t('insights.account.costs')}</p>
              <ul className="tui-costs">{costs.map(line => <li key={line}>{line}</li>)}</ul>
            </>
          ) : null}
          {unsupported ? null : (
            <div>
              <Button type="button" size="sm" variant="toolbar" className="tui-btn" data-dsh-token-usage-refresh
                disabled={busy || account === undefined}
                onClick={() => { account?.onRefresh() }}>
                {busy ? t('balance.refreshing') : t('balance.refresh')}
              </Button>
            </div>
          )}
        </div>
      </DisclosureRow>
    </SurfaceSection>
  )
}

/**
 * Paginated browser over the official session directory. Mounts only while
 * the switcher is open and loads on mount; paging is client-side over the
 * owner-defined row order with a bounded page size. Selecting a row is the
 * explicit target switch — nothing here follows the last-active session.
 */
function DirectoryBrowser({ source, targetRef, t, onSelect }: {
  readonly source: { listSessions(): Promise<readonly SessionDirectoryEntryV1[]> }
  readonly targetRef: string | undefined
  readonly t: TokenUsageTranslator
  readonly onSelect: (sessionRef: string) => void
}): ReactNode {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [entries, setEntries] = useState<readonly SessionDirectoryEntryV1[]>([])
  const [page, setPage] = useState(0)

  const load = (): void => {
    setStatus('loading')
    void source.listSessions().then(
      next => {
        setEntries(next)
        setPage(0)
        setStatus('ready')
      },
      () => { setStatus('error') },
    )
  }
  // Load once on mount; the browser unmounts when the switcher closes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  const pageCount = Math.max(1, Math.ceil(entries.length / SESSION_DIRECTORY_PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = entries.slice(current * SESSION_DIRECTORY_PAGE_SIZE, (current + 1) * SESSION_DIRECTORY_PAGE_SIZE)

  return (
    <SurfaceSection title={t('insights.target.directory.title')}>
      <div className="tui-directory" data-insights-directory>
        {status === 'loading' ? (
          <SurfaceState phase="loading" title={t('insights.target.directory.loading')} data-insights-directory-loading />
        ) : null}
        {status === 'error' ? (
          <SurfaceState phase="error" title={t('insights.target.directory.error')} data-insights-directory-error
            action={<Button type="button" size="sm" variant="toolbar" className="tui-btn"
              onClick={() => { load() }}>{t('usage.error.retry')}</Button>} />
        ) : null}
        {status === 'ready' && entries.length === 0 ? (
          <SurfaceState phase="empty" title={t('insights.target.directory.empty')} data-insights-directory-empty />
        ) : null}
        {rows.length > 0 ? (
          <ul className="tui-dir-rows">
            {rows.map(entry => {
              const isCurrent = entry.sessionRef === targetRef
              return (
                <li className="tui-dir-row" key={entry.sessionRef} data-insights-directory-row
                  data-current={String(isCurrent)}>
                  <span className="tui-dir-label">
                    {entry.label}
                    {entry.running ? <small> · {t('insights.target.directory.running')}</small> : null}
                  </span>
                  {isCurrent ? (
                    <span className="tui-dir-current" aria-current="true">{t('insights.target.directory.bound')}</span>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" className="tui-dir-use"
                      onClick={() => { onSelect(entry.sessionRef) }}>
                      {t('insights.target.directory.use')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}
        {status === 'ready' && entries.length > 0 ? (
          <div className="tui-dir-head">
            {pageCount > 1 ? (
              <div className="tui-pager" data-insights-directory-pager>
                <Button type="button" size="sm" variant="toolbar" className="tui-btn"
                  disabled={current === 0} onClick={() => { setPage(current - 1) }}>
                  {t('insights.target.directory.prev')}
                </Button>
                <span>{t('insights.target.directory.pageOf')} {current + 1}/{pageCount}</span>
                <Button type="button" size="sm" variant="toolbar" className="tui-btn"
                  disabled={current >= pageCount - 1} onClick={() => { setPage(current + 1) }}>
                  {t('insights.target.directory.next')}
                </Button>
              </div>
            ) : null}
            <Button type="button" size="sm" variant="toolbar" className="tui-btn" data-insights-directory-refresh
              onClick={() => { load() }}>
              {t('insights.target.directory.refresh')}
            </Button>
          </div>
        ) : null}
      </div>
    </SurfaceSection>
  )
}

export function SessionInsightsPanel({ state, t, onRefresh, onLoadMore, onScopeChange, directory, targetRef, onTargetChange, trajectory, account }: SessionInsightsPanelProps): ReactNode {
  const snapshot = state.snapshot
  const model = snapshot === undefined ? undefined : deriveSessionInsightsViewModel(snapshot)
  const busy = state.status === 'loading'
  const trajectoryAvailable = trajectory?.available === true && typeof trajectory.locate === 'function'
  const trajectoryReason = trajectory?.reason ?? t('insights.trajectory.unavailable')

  // Explicit statistics-target switcher (design §1): pinned to the bound
  // session by default; the directory opens only on an explicit click, and
  // an absent official seam disables the action with the probe reason.
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const directoryAvailable = directory?.available === true && onTargetChange !== undefined
  const switcherTitle = directoryAvailable
    ? t('insights.target.switch')
    : (directory?.available === false ? directory.reason : t('insights.target.directory.unavailable'))
  const selectTarget = (sessionRef: string): void => {
    if (sessionRef === targetRef) {
      setDirectoryOpen(false)
      return
    }
    onTargetChange?.(sessionRef)
    setDirectoryOpen(false)
  }

  const statusBits: string[] = []
  if (model !== undefined) {
    statusBits.push(freshnessLabel(model, state.stale, t))
    statusBits.push(t(model.coverageStatus === 'complete' ? 'insights.coverage.complete' : model.coverageStatus === 'partial' ? 'insights.coverage.partial' : 'insights.coverage.unknown'))
  }
  if (!state.subscription) statusBits.push(t('insights.manualRefresh'))

  return (
    <Surface kind="inspector" data-dsh-token-usage-insights aria-label={t('insights.title')}>
      <style>{styles}</style>
      <SurfaceContextBar
        title={t('insights.title')}
        context={model?.sessionRef ?? state.status}
        description={model === undefined ? undefined : `${t(model.scope === 'session' ? 'insights.scope.session' : model.scope === 'run' ? 'insights.scope.run' : 'insights.scope.range')} · rev ${model.revision}`}
        status={statusBits.length === 0 ? undefined : <span>{statusBits.join(' · ')}</span>}
        actions={<>
          <Button type="button" size="sm" variant="toolbar" className="tui-btn" data-dsh-insights-switch-target
            disabled={!directoryAvailable} aria-expanded={directoryOpen} title={switcherTitle}
            onClick={() => { setDirectoryOpen(value => !value) }}>
            {t('insights.target.switch')}
          </Button>
          <Button type="button" size="sm" variant="toolbar" className="tui-btn" data-dsh-insights-refresh
            disabled={busy} onClick={() => { onRefresh() }}>
            {busy ? t('insights.refreshing') : t('insights.refresh')}
          </Button>
        </>}
        nav={<ScopeNav scope={model?.scope ?? 'session'} t={t} {...(onScopeChange === undefined ? {} : { onScopeChange })} />}
      />
      <div className="ys-body">
        {directoryOpen && directory?.available === true ? (
          <DirectoryBrowser source={directory.source} targetRef={targetRef} t={t} onSelect={selectTarget} />
        ) : null}
        {busy && model !== undefined ? <div className="tui-busy" role="status">{t('insights.refreshing')}</div> : null}
        {state.status === 'error' ? (
          <SurfaceState phase="error" title={state.message ?? t('empty.usage')} data-insights-error
            action={<Button type="button" size="sm" variant="toolbar" className="tui-btn" data-insights-retry
              onClick={() => { onRefresh() }}>{t('usage.error.retry')}</Button>} />
        ) : null}
        {state.staleCursor ? (
          <SurfaceState phase="stale" title={t('insights.staleCursor')} data-insights-stale-cursor
            action={<Button type="button" size="sm" variant="toolbar" className="tui-btn"
              onClick={() => { onRefresh() }}>{t('insights.rereadFirstPage')}</Button>} />
        ) : null}
        {model === undefined ? (
          busy ? <SurfaceState phase="loading" title={t('insights.section.overview')} data-insights-loading /> : null
        ) : (
          <>
            <SurfaceSection title={t('insights.section.overview')}>
              {model.emptyConfirmed ? (
                <SurfaceState phase="empty" title={t('insights.empty.confirmed')} data-insights-empty />
              ) : (
                <ul className="tui-metrics" data-insights-overview>
                  {model.overview.map(metric => (
                    <li className="tui-metric" key={metric.label}>
                      <span>{t(METRIC_KEY[metric.label] ?? 'insights.metric.total')}</span>
                      <strong>{metric.text ?? '—'}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {model.coverageText !== null ? (
                <SurfaceState phase="partial" title={t(model.coverageStatus === 'partial' ? 'insights.coverage.partial' : 'insights.coverage.unknown')} description={model.coverageText} data-insights-coverage />
              ) : null}
            </SurfaceSection>
            <SurfaceSection title={t('insights.section.composition')}>
              <CompositionBar model={model} />
              <ul className="tui-rows" data-insights-composition>
                {model.composition.map(bucket => (
                  <li className="tui-rowline" key={bucket.label}>
                    <span>{t(BUCKET_KEY[bucket.label] ?? 'insights.bucket.output')}</span>
                    <strong>{bucket.text ?? '—'}</strong>
                  </li>
                ))}
              </ul>
            </SurfaceSection>
            <SurfaceSection title={t('insights.section.context')}>
              {model.context.available ? (
                <ul className="tui-rows" data-insights-context>
                  <li className="tui-rowline"><span>{t('insights.context.used')}</span><strong>{model.context.usedText ?? '—'}</strong></li>
                  <li className="tui-rowline"><span>{t('insights.context.limit')}</span><strong>{model.context.limitText ?? '—'}</strong></li>
                  <li className="tui-rowline"><span>{t('insights.context.remaining')}</span><strong>
                    {model.context.remainingText ?? '—'}{model.context.percentText === null ? '' : ` (${model.context.percentText})`}
                  </strong></li>
                </ul>
              ) : (
                <SurfaceState phase="disabled" title={model.context.reason ?? t('insights.coverage.unknown')} data-insights-context-unavailable />
              )}
            </SurfaceSection>
            <BreakdownList title={t('insights.section.models')} rows={model.byModel} truncated={model.byModelTruncated} t={t} />
            <BreakdownList title={t('insights.section.providers')} rows={model.byProvider} truncated={model.byProviderTruncated} t={t} />
            <SurfaceSection title={t('insights.section.requests')}>
              {model.requests.length === 0 ? (
                model.emptyConfirmed
                  ? <SurfaceState phase="empty" title={t('insights.empty.confirmed')} />
                  : <SurfaceState phase="empty" title={t('empty.sessions')} />
              ) : (
                <ul className="tui-rows" data-insights-requests>
                  {model.requests.map(row => (
                    <li className="tui-req" key={row.key}>
                      <span className="tui-req-main">
                        <strong>{row.model ?? row.refs.attemptRef}</strong>
                        <small>{t(STATUS_KEY[row.status])}{row.happenedAt === null ? '' : ` · ${row.happenedAt.slice(11, 19)}Z`}{row.tokensText === null ? '' : ` · ${row.tokensText}`}</small>
                      </span>
                      <Button type="button" size="sm" variant="ghost" className="tui-locate"
                        disabled={!trajectoryAvailable}
                        title={trajectoryAvailable ? t('insights.trajectory.locate') : trajectoryReason}
                        onClick={() => { if (trajectoryAvailable) trajectory.locate?.(row.refs) }}>
                        {t('insights.trajectory.locate')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {model.nextCursor !== null ? (
                <div className="tui-pager">
                  <Button type="button" size="sm" variant="toolbar" className="tui-btn" data-insights-load-more
                    disabled={state.loadingMore} onClick={() => { onLoadMore?.() }}>
                    {state.loadingMore ? t('insights.loadingMore') : t('insights.loadMore')}
                  </Button>
                </div>
              ) : null}
            </SurfaceSection>
            <AccountBlock account={account} costs={model.costLines} t={t} />
          </>
        )}
      </div>
    </Surface>
  )
}

/** Composition bar: aria-labelled visual; the text rows are the equivalent. */
function CompositionBar({ model }: { readonly model: SessionInsightsViewModel }): ReactNode {
  // Unknown (null) buckets contribute no width — they are never zero-filled.
  const total = model.composition.reduce((sum, bucket) => sum + (bucket.value ?? 0), 0)
  if (total <= 0) return null
  const label = model.composition.map(bucket => `${bucket.label} ${bucket.text ?? '—'}`).join(', ')
  return (
    <div className="tui-bar" role="img" aria-label={label} data-insights-composition-bar>
      {model.composition.map(bucket => bucket.value === null || bucket.value <= 0 ? null : (
        <i key={bucket.label} className={`tui-seg-${bucket.label.toLowerCase()}`} style={{ width: `${(bucket.value / total) * 100}%` }} />
      ))}
    </div>
  )
}

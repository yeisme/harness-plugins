import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { createMarketReviewController, createMarketDetailController, MarketSignalProjection } from '@yeisme/dsh-personal-radar'
import { marketLabel, marketTime } from './market-labels.js'
import type { MarketLocale } from './market-view.js'

/**
 * Weekly judgment review (周度回顾). Original judgments and their later
 * follow-up evidence stay side by side; `inconclusive` entries live in their
 * own section and are never styled, phrased or placed as failures — the owner
 * freezes "no later evidence is inconclusive, never a failed prediction".
 * Retracted entries carry the explicit correction entry point: the follow-up
 * correction revision opens in the shared detail view.
 */

const messages = {
  en: { title: 'Judgment review', loading: 'Reading the weekly review', unavailable: 'Review unavailable', empty: 'No complete review week yet',
    connect: 'Connect a Radar owner to read frozen reviews.', window: 'Review window', cutoff: 'Cutoff', entries: 'Original and follow-up',
    inconclusive: 'Cannot judge yet', noFollowup: 'No later evidence before the cutoff; not scored as right or wrong',
    choose: 'Switch review', openOriginal: 'View original', openCorrection: 'View correction', filtered: 'Content restrictions applied',
    revision: 'Revision', limitations: 'Review limitations' },
  zh: { title: '判断回顾', loading: '正在读取周度回顾', unavailable: '回顾暂不可读', empty: '尚无完整周回顾',
    connect: '连接 Radar 后读取已冻结的回顾。', window: '回顾窗口', cutoff: '截止', entries: '原判断与后续',
    inconclusive: '暂无法判断', noFollowup: '截止前无后续证据，不计成败',
    choose: '切换回顾', openOriginal: '查看原判断', openCorrection: '查看更正', filtered: '已应用内容禁区',
    revision: '修订', limitations: '回顾限制' },
} as const
const errors = {
  offline: ['Radar is offline. Check the owner connection.', 'Radar 已离线，请检查连接。'],
  timeout: ['Reading timed out. Check the owner connection.', '读取超时，请检查 Radar 连接。'],
  cancelled: ['Reading was cancelled after the context changed.', '上下文已改变，本次读取已取消。'],
  capability_unavailable: ['This Radar connection does not support market reviews.', '当前 Radar 连接尚不支持市场回顾。'],
  contract_mismatch: ['The connected Radar contract is incompatible.', '当前 Radar 数据协议不兼容。'],
  policy_changed: ['Content restrictions changed. Read again in the current context.', '内容禁区已改变，需要在当前上下文重新读取。'],
  state_changed: ['Reading state changed. Restart the current view.', '阅读状态已改变，请重新读取当前视图。'],
  brief_absent: ['No completed brief is stored on the Radar owner yet.', 'Radar 尚未保存已完成的市场简报。'],
  reference_unavailable: ['The selected review is unavailable.', '所选回顾不可用。'],
  content_blocked: ['The current content policy prevents this read.', '当前内容禁区禁止读取该内容。'],
} as const

function ReviewSignal({ signal, locale, timezone, label }: { signal: MarketSignalProjection; locale: MarketLocale; timezone?: string; label: string }) {
  return <article className="ys-row">
    <h3>{signal.title}</h3>
    <p>{signal.signalRef} · {label} {signal.revision}</p>
    <p>{signal.market} · <time dateTime={signal.observedAt} title={signal.observedAt}>{marketTime(signal.observedAt, timezone ?? 'UTC', locale)}</time></p>
    <p>{marketLabel('claim', signal.claimKind, locale)} · {marketLabel('lifecycle', signal.lifecycle, locale)}</p>
    {signal.comparison ? <p>{signal.comparison.before} → {signal.comparison.after} ({signal.comparison.change})</p> : null}
  </article>
}

export function MarketReviewView({ controller, detail, locale = 'zh', onOpenSignal }: { controller: ReturnType<typeof createMarketReviewController>; detail?: ReturnType<typeof createMarketDetailController>; locale?: MarketLocale; onOpenSignal?(selection: { signalRef: string; revision: number }, source: HTMLElement | null): void }) {
  const [state, setState] = useState(() => controller.snapshot())
  useEffect(() => { const dispose = controller.subscribe(setState); setState(controller.snapshot()); return () => dispose() }, [controller])
  const t = (key: keyof typeof messages.en) => locale === 'zh' ? messages.zh[key] : locale === 'pseudo' ? `[!! ${messages.en[key]} ${messages.en[key]} !!]` : messages.en[key]
  const errorDescription = (key: keyof typeof errors) => locale === 'zh' ? errors[key][1] : locale === 'pseudo' ? `[!! ${errors[key][0]} !!]` : errors[key][0]
  const index = state.index
  const summaries = index?.ok ? index.index.reviews : []
  const review = state.review?.ok ? state.review.review : null
  const judged = review ? review.entries.filter(entry => entry.outcome !== 'inconclusive') : []
  const inconclusive = review ? review.entries.filter(entry => entry.outcome === 'inconclusive') : []
  const open = (selection: { signalRef: string; revision: number }, source: HTMLElement | null) => {
    if (!detail || !onOpenSignal) return
    void detail.select(selection)
    onOpenSignal(selection, source)
  }
  const day = (value: string) => locale === 'pseudo' ? `[${value.slice(0, 10)}]` : value.slice(0, 10)
  return <div className="ys-body" data-radar-market-review>
    {state.loading && !review ? <SurfaceState phase="loading" title={t('loading')} /> : null}
    {!state.loading && !index ? <SurfaceState phase="disabled" title={t('unavailable')} description={t('connect')} /> : null}
    {!state.loading && index && !index.ok ? <SurfaceState phase="error" title={t('unavailable')} description={errorDescription(index.reason)} /> : null}
    {index?.ok && summaries.length === 0 && !review ? <SurfaceState phase="empty" title={t('empty')} description={t('noFollowup')} /> : null}
    {summaries.length > 0 ? <SurfaceSection title={t('choose')}>
      {/* Owner-frozen refs only: switching reads another exact stored review, never a live rebuild. */}
      {summaries.map(summary => <Button key={summary.reviewRef} aria-pressed={state.selection === summary.reviewRef}
        onClick={() => { if (state.selection !== summary.reviewRef) void controller.select(summary.reviewRef) }}>
        {day(summary.window.start)}–{day(summary.window.end)} · {t('cutoff')} {day(summary.asOf)} · {summary.entries}
      </Button>)}
    </SurfaceSection> : null}
    {review ? <SurfaceSection title={t('title')}>
      <p>{t('window')}: <time dateTime={review.window.start} title={review.window.start}>{marketTime(review.window.start, 'UTC', locale)}</time>
        {' – '}<time dateTime={review.window.end} title={review.window.end}>{marketTime(review.window.end, 'UTC', locale)}</time>
        {' · '}{t('cutoff')}: <time dateTime={review.asOf} title={review.asOf}>{marketTime(review.asOf, 'UTC', locale)}</time></p>
      <p>{review.reviewRef} · {review.builderVersion}</p>
      {review.filtered ? <SurfaceState phase="partial" title={t('filtered')} /> : null}
      <details><summary>{t('limitations')}</summary><ul>{review.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></details>
      {judged.map(entry => <div key={`${entry.original.signalRef}:${entry.original.revision}`} className="ys-entry" data-review-outcome={entry.outcome}>
        <p>{marketLabel('outcome', entry.outcome, locale)} · {entry.reason}</p>
        <div className="ys-grid">
          <ReviewSignal signal={entry.original} locale={locale} label={t('revision')} />
          {entry.followup ? <ReviewSignal signal={entry.followup} locale={locale} label={t('revision')} /> : <article className="ys-row"><p>{t('noFollowup')}</p></article>}
        </div>
        {detail && onOpenSignal ? <div>
          <Button onClick={event => open({ signalRef: entry.original.signalRef, revision: entry.original.revision }, event.currentTarget)}>{t('openOriginal')}</Button>
          {entry.outcome === 'retracted' && entry.followup ? <Button onClick={event => open({ signalRef: entry.followup!.signalRef, revision: entry.followup!.revision }, event.currentTarget)}>{t('openCorrection')}</Button> : null}
        </div> : null}
      </div>)}
      {inconclusive.length > 0 ? <SurfaceSection title={t('inconclusive')}>
        {/* Separated on purpose: inconclusive is its own outcome, never a failure row mixed into judged entries. */}
        <p>{t('noFollowup')}</p>
        {inconclusive.map(entry => <div key={`${entry.original.signalRef}:${entry.original.revision}`} data-review-outcome="inconclusive">
          <p>{marketLabel('outcome', 'inconclusive', locale)} · {entry.reason}</p>
          <div className="ys-grid"><ReviewSignal signal={entry.original} locale={locale} label={t('revision')} /></div>
          {detail && onOpenSignal ? <Button onClick={event => open({ signalRef: entry.original.signalRef, revision: entry.original.revision }, event.currentTarget)}>{t('openOriginal')}</Button> : null}
        </div>)}
      </SurfaceSection> : null}
    </SurfaceSection> : null}
    {state.review && !state.review.ok && state.selection !== null && !state.loading ? <SurfaceState phase="error" title={t('unavailable')} description={errorDescription(state.review.reason)} /> : null}
  </div>
}

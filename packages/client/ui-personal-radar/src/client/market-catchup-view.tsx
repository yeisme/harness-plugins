import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceActionBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { createMarketCatchupController } from '@yeisme/dsh-personal-radar'
import { marketLabel, marketTime } from './market-labels.js'
import type { MarketLocale } from './market-view.js'

type Controller = ReturnType<typeof createMarketCatchupController>
const words = {
  title: ['Unread catch-up', '未读补看'], loading: ['Reading unread changes', '正在读取未读变化'],
  empty: ['No unread changes in this window', '本窗口没有未读变化'], continuation: ['No visible items on this page; more pages remain', '本页没有可显示项目，仍有后续页'],
  failed: ['Catch-up needs a fresh read', '补看需要重新读取'], first: ['Read from start', '从头读取'], next: ['Next page', '下一页'],
  boundary: ['Last 30 days only; older history remains with Radar', '仅覆盖最近30天，更早历史保留在 Radar'],
  offline: ['Radar is offline. Check the owner connection.', 'Radar 已离线，请检查连接。'],
  timeout: ['Reading timed out; no read marks were changed.', '读取超时，已读状态未改变。'],
  cancelled: ['The reading context changed; the old page was discarded.', '读取上下文已改变，旧页已丢弃。'],
  capability_unavailable: ['This connection does not support catch-up.', '当前连接尚不支持补看。'],
  contract_mismatch: ['The owner data contract is incompatible.', 'Radar 数据协议不兼容。'],
  policy_changed: ['Content restrictions changed. Read again with the current policy.', '内容禁区已改变，请按当前策略重新读取。'],
  state_changed: ['Reading state changed. Discard the old cursor and read from start.', '阅读状态已改变，请丢弃旧游标并从头读取。'],
  brief_absent: ['The requested owner data is not available.', '所请求的 Radar 数据尚不可用。'],
  reference_unavailable: ['The selected revision or evidence is unavailable.', '所选修订或证据引用不可用。'],
  content_blocked: ['The current content policy prevents this read.', '当前内容禁区禁止读取该内容。'],
} as const
export function MarketCatchupView({ controller, locale }: { controller: Controller; locale: MarketLocale }) {
  const [state, setState] = useState(() => controller.snapshot())
  useEffect(() => {
    const dispose = controller.subscribe(setState)
    setState(controller.snapshot())
    return () => dispose()
  }, [controller])
  const t = (key: keyof typeof words) => locale === 'zh' ? words[key][1] : locale === 'pseudo' ? `[!! ${words[key][0]} !!]` : words[key][0]
  const result = state.result, page = result?.ok ? result.page : null
  return <SurfaceSection title={t('title')}>
    {state.loading ? <SurfaceState phase="loading" title={t('loading')} /> : null}
    {!state.loading && !page ? <SurfaceState phase={result && !result.ok ? 'error' : 'disabled'} title={t('failed')}
      description={result && !result.ok ? t(result.reason) : undefined} /> : null}
    {page ? <>
      <p>{marketTime(page.window.start, 'UTC', locale)} – {marketTime(page.window.end, 'UTC', locale)} · UTC</p>
      {page.historyLimited ? <p>{t('boundary')}</p> : null}
      {page.signals.length === 0 ? <SurfaceState phase="empty" title={t(page.nextCursor ? 'continuation' : 'empty')} /> : null}
      <div className="ys-list">{page.signals.map(signal => <article className="ys-row" key={`${signal.signalRef}:${signal.revision}`}>
        <h3>{signal.title}</h3><p>{marketLabel('claim', signal.claimKind, locale)} · {marketLabel('lifecycle', signal.lifecycle, locale)}</p>
        <time dateTime={signal.observedAt}>{marketTime(signal.observedAt, 'UTC', locale)}</time>
        <p>{marketLabel('origin', signal.origin, locale)}</p>
        <ul>{signal.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </article>)}</div>
    </> : null}
    <SurfaceActionBar>
      <Button disabled={state.loading || state.contextRef === null} onClick={() => { void controller.first() }}>{t('first')}</Button>
      <Button disabled={state.loading || !page?.nextCursor} onClick={() => { void controller.next() }}>{t('next')}</Button>
    </SurfaceActionBar>
  </SurfaceSection>
}

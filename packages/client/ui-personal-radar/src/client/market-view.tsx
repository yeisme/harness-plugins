import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { MarketReadingState, createMarketReadingController, createMarketCatchupController, createMarketDetailController, createMarketCompareController } from '@yeisme/dsh-personal-radar'
import { MarketDetailView } from './market-detail-view.js'
import { MarketCompareView } from './market-compare-view.js'
import { MarketCatchupView } from './market-catchup-view.js'
import { marketLabel, marketTime } from './market-labels.js'
import type { MarketActionsController } from './market-actions.js'
import type { MarketQuestionController } from './market-question.js'

const messages = {
  en: { title: 'Market changes', loading: 'Reading market brief', absent: 'No completed brief', unavailable: 'Market reading unavailable',
    connect: 'Connect a Radar owner to read stored changes.', empty: 'No significant changes in this window', main: 'Changes', watching: 'Watching',
    coverage: 'Source coverage', details: 'Evidence and limitations', partial: 'Coverage is incomplete', remaining: 'Additional signals',
    filtered: 'Content restrictions applied', unknown: 'Unknown market', evidence: 'Evidence reference',
    watch: 'Watch', unwatch: 'Unwatch', pauseWatch: 'Pause watching', resumeWatch: 'Resume watching',
    markRead: 'Mark shown as read', undoRead: 'Undo read marks', actionsUnavailable: 'Market actions need a writable Radar reader seam',
    pending: 'Waiting for the Radar receipt', accepted: 'Confirmed by Radar', rejected: 'Rejected by Radar',
    conflict: 'Reader revision changed; read again', unknownOutcome: 'Outcome unknown; reconcile by the original action',
    reconciled: 'Reconciled with the owner receipt', reconcile: 'Reconcile' },
  zh: { title: '市场变化', loading: '正在读取市场简报', absent: '尚无已完成简报', unavailable: '市场简报暂不可读',
    connect: '连接 Radar 后读取已存市场变化。', empty: '本窗口暂无重大变化', main: '变化', watching: '继续观察',
    coverage: '来源覆盖', details: '证据与限制', partial: '覆盖不完整', remaining: '其他信号',
    filtered: '已应用内容禁区', unknown: '地区未知', evidence: '证据引用',
    watch: '关注', unwatch: '取消关注', pauseWatch: '暂停观察', resumeWatch: '恢复观察',
    markRead: '标记已读', undoRead: '撤销已读', actionsUnavailable: '市场操作需要可写的 Radar reader seam',
    pending: '等待 Radar 回执', accepted: 'Radar 已确认', rejected: 'Radar 已拒绝',
    conflict: '阅读版本已变化，请重新读取', unknownOutcome: '结果未知，可按原动作对账',
    reconciled: '已按 owner 回执对账', reconcile: '对账' },
} as const
const errors = {
  offline: ['Radar is offline. Check the owner connection.', 'Radar 已离线，请检查连接。'],
  timeout: ['Reading timed out. Check the owner connection.', '读取超时，请检查 Radar 连接。'],
  cancelled: ['Reading was cancelled after the context changed.', '上下文已改变，本次读取已取消。'],
  capability_unavailable: ['This Radar connection does not support market briefs.', '当前 Radar 连接尚不支持市场简报。'],
  contract_mismatch: ['The connected Radar contract is incompatible.', '当前 Radar 数据协议不兼容。'],
  policy_changed: ['Content restrictions changed. Read again in the current context.', '内容禁区已改变，需要在当前上下文重新读取。'],
  state_changed: ['Reading state changed. Restart the current view.', '阅读状态已改变，请重新读取当前视图。'],
  brief_absent: ['No completed brief is stored on the Radar owner yet.', 'Radar 尚未保存已完成的市场简报。'],
  reference_unavailable: ['The selected revision or evidence is unavailable.', '所选修订或证据引用不可用。'],
  content_blocked: ['The current content policy prevents this read.', '当前内容禁区禁止读取该内容。'],
} as const
export type MarketLocale = 'en' | 'zh' | 'pseudo'
type Controller = ReturnType<typeof createMarketReadingController>
const styles = '[data-radar-market] .ys-context-value{white-space:normal;overflow-wrap:anywhere}[data-radar-market] .ys-row{grid-template-columns:minmax(0,1fr);overflow-wrap:anywhere}[data-radar-market] .ys-row h3,[data-radar-market] .ys-row p{margin:0;font-size:var(--vk-font-body)}[data-radar-market] summary{min-height:var(--vk-ctrl-touch);cursor:pointer}[data-radar-market] details{padding-block:var(--vk-gap-sm)}'

export function MarketReadingView({ controller, catchup, detail, compare, actions, question, capability, locale = 'zh' }: { controller: Controller; detail?: ReturnType<typeof createMarketDetailController>; catchup?: ReturnType<typeof createMarketCatchupController>; compare?: ReturnType<typeof createMarketCompareController>; actions?: MarketActionsController; question?: MarketQuestionController; capability?: { status: 'reader_only' | 'mismatch'; reason: string }; locale?: MarketLocale }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareSelections, setCompareSelections] = useState<Array<{ signalRef: string; revision: number }>>([])
  const returnFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!detail) return
    const dispose = detail.subscribe(() => { if (detail.selection() === null) setDetailOpen(false) })
    return () => dispose()
  }, [detail])
  useEffect(() => {
    if (!compare) return
    const dispose = compare.subscribe(() => { if (compare.selections() === null) { setCompareOpen(false); setCompareSelections([]) } })
    return () => dispose()
  }, [compare])
  const [actionState, setActionState] = useState(() => actions ? actions.snapshot() : { available: false, entries: {} })
  useEffect(() => {
    if (!actions) return
    const dispose = actions.subscribe(setActionState)
    setActionState(actions.snapshot())
    return () => dispose()
  }, [actions])
  const [mode, setMode] = useState<'brief' | 'catchup'>('brief')
  const [state, setState] = useState<MarketReadingState>(() => controller.snapshot())
  useEffect(() => {
    const dispose = controller.subscribe(setState)
    setState(controller.snapshot())
    return () => dispose()
  }, [controller])
  const label = (key: keyof typeof messages.en) => locale === 'pseudo' ? `[!! ${messages.en[key]} ${messages.en[key]} !!]` : messages[locale][key]
  const errorDescription = (key: keyof typeof errors) => locale === 'zh' ? errors[key][1] : locale === 'pseudo' ? `[!! ${errors[key][0]} !!]` : errors[key][0]
  const result = state.result
  const brief = result?.ok ? result.brief : null
  const readerRevision = result?.ok ? result.reader.revision : undefined
  const actionContext = brief && readerRevision !== undefined ? { readerRevision, policyRevision: brief.policyRevision } : null
  const chooseCompare = (selection: { signalRef: string; revision: number }) => setCompareSelections(current => {
    const index = current.findIndex(item => item.signalRef === selection.signalRef && item.revision === selection.revision)
    if (index >= 0) return current.filter((_, i) => i !== index)
    return current.length >= 2 ? [current[1]!, selection] : [...current, selection]
  })
  return <Surface kind="workspace" data-radar-market aria-label={label('title')}>
    <style>{styles}</style>
    <SurfaceContextBar title={label('title')} nav={catchup ? <>
      <Button aria-pressed={mode === 'brief'} onClick={() => setMode('brief')}>{locale === 'zh' ? '变化简报' : locale === 'pseudo' ? '[!! Brief !!]' : 'Brief'}</Button>
      <Button aria-pressed={mode === 'catchup'} onClick={() => { setMode('catchup'); void catchup.first() }}>{locale === 'zh' ? '未读补看' : locale === 'pseudo' ? '[!! Catch-up !!]' : 'Catch-up'}</Button>
    </> : undefined} actions={compare && compareSelections.length === 2 && !compareOpen ? <Button onClick={() => { setCompareOpen(true); void compare.select(compareSelections[0]!, compareSelections[1]!) }}>{locale === 'zh' ? '打开对照' : 'Open comparison'}</Button> : undefined} context={brief && mode === 'brief' ? <span>
      <time dateTime={brief.window.start} title={brief.window.start}>{marketTime(brief.window.start, brief.timezone, locale)}</time>
      {' – '}<time dateTime={brief.window.end} title={brief.window.end}>{marketTime(brief.window.end, brief.timezone, locale)}</time>
      {' · '}{brief.timezone}
    </span> : undefined}
      status={brief?.status === 'degraded' ? label('partial') : undefined} />
    {compareOpen && compare ? <div className="ys-body"><MarketCompareView controller={compare} locale={locale} onClose={() => { compare.close(); setCompareOpen(false) }} /></div> : detailOpen && detail ? <div className="ys-body"><MarketDetailView controller={detail} locale={locale} onClose={() => {
      detail.close(); setDetailOpen(false); requestAnimationFrame(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus() })
    }} {...(question ? { question } : {})} /></div> : null}<div hidden={detailOpen || compareOpen}>
    {actions && !actionState.available ? <p role="status">{label('actionsUnavailable')}</p> : null}
    {mode === 'catchup' && catchup ? <div className="ys-body"><MarketCatchupView controller={catchup} locale={locale} {...(actions ? { actions } : {})} /></div> : <>
    {state.loading ? <SurfaceState phase="loading" title={label('loading')} /> : null}
    {!state.loading && !result ? <SurfaceState phase="disabled" title={label('unavailable')} description={capability !== undefined ? capability.reason : label('connect')} /> : null}
    {!state.loading && result && !result.ok ? <SurfaceState phase={result.reason === 'brief_absent' ? 'empty' : 'error'}
      title={label(result.reason === 'brief_absent' ? 'absent' : 'unavailable')} description={errorDescription(result.reason)} /> : null}
    {brief ? <div className="ys-body">
      {brief.status === 'empty' ? <SurfaceState phase="empty" title={label('empty')} /> : null}
      {brief.filtered ? <SurfaceState phase="partial" title={label('filtered')} /> : null}
      {(['main', 'watching'] as const).map(section => <SurfaceSection key={section} title={label(section)}>
        <div className="ys-list">{brief[section].map(signal => <article key={`${signal.signalRef}:${signal.revision}`} className="ys-row">
          <h3>{signal.title}</h3>
          {detail ? <Button onClick={event => { returnFocus.current = event.currentTarget; setDetailOpen(true); void detail.select({ signalRef: signal.signalRef, revision: signal.revision }) }}>{locale === 'zh' ? '打开详情' : locale === 'pseudo' ? '[!! Open details !!]' : 'Open details'}</Button> : null}
          {compare ? <Button aria-pressed={compareSelections.some(item => item.signalRef === signal.signalRef && item.revision === signal.revision)} onClick={() => chooseCompare({ signalRef: signal.signalRef, revision: signal.revision })}>{locale === 'zh' ? '加入对照' : locale === 'pseudo' ? '[!! Add compare !!]' : 'Add comparison'}</Button> : null}
          {actions && actionState.available && actionContext ? <>
            <Button onClick={() => { void actions.watch({ signalRef: signal.signalRef, revision: signal.revision }, actionContext) }}>{label('watch')}</Button>
            <Button onClick={() => { void actions.unwatch({ signalRef: signal.signalRef, revision: signal.revision }, actionContext) }}>{label('unwatch')}</Button>
          </> : null}
          <p>{marketLabel('claim', signal.claimKind, locale)} · {marketLabel('lifecycle', signal.lifecycle, locale)}</p>
          <p>{signal.market === 'unknown' ? label('unknown') : signal.market} · <time dateTime={signal.observedAt} title={signal.observedAt}>
            {marketTime(signal.observedAt, brief.timezone, locale)}</time> · {marketLabel('origin', signal.origin, locale)}</p>
          {signal.comparison ? <p>{signal.comparison.before} → {signal.comparison.after} ({signal.comparison.change})</p> : null}
          <details><summary>{label('details')}</summary>
            <ul>{signal.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul>
            <ul>{signal.evidenceRefs.map(ref => <li key={ref}>{label('evidence')}: {ref}</li>)}</ul>
          </details>
        </article>)}</div>
      </SurfaceSection>)}
      {actions && actionState.available && actionContext ? <SurfaceSection title={label('markRead')}>
        {/* Only the signals actually rendered above are submitted; pre-reads, scrolling and questions never mark read. */}
        <Button disabled={mode === 'catchup'} onClick={() => {
          void actions.markRead([...brief.main, ...brief.watching].map(signal => ({ signalRef: signal.signalRef, revision: signal.revision })), actionContext)
        }}>{label('markRead')}</Button>
        <Button disabled={mode === 'catchup'} onClick={() => {
          void actions.undoRead([...brief.main, ...brief.watching].map(signal => ({ signalRef: signal.signalRef, revision: signal.revision })), actionContext)
        }}>{label('undoRead')}</Button>
      </SurfaceSection> : null}
      {Object.entries(actionState.entries).slice(-4).map(([key, entry]) => <p role="status" key={key}>
        {entry.kind} · {label(entry.state === 'pending' ? 'pending' : entry.state === 'accepted' ? 'accepted' : entry.state === 'rejected' ? 'rejected'
          : entry.state === 'conflict' ? 'conflict' : entry.state === 'reconciled' ? 'reconciled' : 'unknownOutcome')}
        {entry.state === 'unknown' ? <Button onClick={() => { void actions!.reconcile(key) }}>{label('reconcile')}</Button> : null}
      </p>)}
      {brief.remaining > 0 ? <p>{label('remaining')}: {brief.remaining}</p> : null}
      <SurfaceSection title={label('coverage')}><ul>{brief.coverage.map(source => <li key={source.sourceRef}>
        {source.sourceRef} · {marketLabel('health', source.health, locale)}<ul>{source.reasons.map(reason => <li key={reason}>{marketLabel('reason', reason, locale)}</li>)}</ul>
      </li>)}</ul></SurfaceSection>
    </div> : null}</>}</div>
  </Surface>
}

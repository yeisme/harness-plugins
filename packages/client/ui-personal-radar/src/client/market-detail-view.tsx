import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { createMarketDetailController } from '@yeisme/dsh-personal-radar'
import { marketLabel, marketTime } from './market-labels.js'
import type { MarketQuestionController, MarketQuestionStatus } from './market-question.js'
import type { MarketLocale } from './market-view.js'

const questionWords: Record<MarketQuestionStatus | 'ask', readonly [string, string]> = {
  ask: ['Ask about this evidence', '就证据提问'],
  idle: ['Question draft is empty', '暂无问题草稿'],
  draft: ['Draft bound to the current conversation; sending is explicit', '草稿已绑定当前会话，发送需显式确认'],
  evidence_insufficient: ['No citable evidence on this signal; evidence reading stays available', '该信号没有可引用证据；证据阅读保持可用'],
  composer_unavailable: ['No conversation composer seam; the question action stays disabled', '缺少会话 composer seam，问答保持禁用'],
  reference_stale: ['The selected revision changed; select again', '所选修订已变化，请重新选择'],
  session_changed: ['The conversation switched; rebind before sending', '会话已切换，发送前需显式重新绑定'],
  sending: ['Sending to the current conversation', '正在发送到当前会话'],
  sent: ['Sent to the current conversation', '已发送到当前会话'],
  failed: ['The conversation did not accept the message; the draft is kept', '会话未接收该消息，草稿已保留'],
}

export function MarketDetailView({ controller, locale, onClose, question }: {
  controller: ReturnType<typeof createMarketDetailController>; locale: MarketLocale; onClose(): void; question?: MarketQuestionController
}) {
  const [state, setState] = useState(() => controller.snapshot())
  const [questionState, setQuestionState] = useState(() => question ? question.snapshot() : null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { const dispose = controller.subscribe(setState); setState(controller.snapshot()); return () => dispose() }, [controller])
  useEffect(() => {
    if (!question) return
    const dispose = question.subscribe(setQuestionState)
    setQuestionState(question.snapshot())
    return () => dispose()
  }, [question])
  useEffect(() => { heading.current?.focus() }, [])
  const t = (en: string, zh: string) => locale === 'zh' ? zh : locale === 'pseudo' ? `[!! ${en} !!]` : en
  const qt = (status: MarketQuestionStatus | 'ask') => locale === 'zh' ? questionWords[status][1] : locale === 'pseudo' ? `[!! ${questionWords[status][0]} !!]` : questionWords[status][0]
  const result = state.result, signal = result?.ok ? result.signal : null
  // Loading a different revision invalidates an existing draft citation;
  // the same revision re-selected keeps the draft untouched.
  useEffect(() => {
    if (!question || !signal) return
    question.invalidateForSelection({ signalRef: signal.signalRef, revision: signal.revision })
  }, [question, signal?.signalRef, signal?.revision])
  return <SurfaceSection aria-label={t('Signal details', '信号详情')}>
    <h2 ref={heading} tabIndex={-1}>{t('Signal details', '信号详情')}</h2>
    <Button onClick={onClose}>{t('Back to list', '返回列表')}</Button>
    {state.loading ? <SurfaceState phase="loading" title={t('Reading selected revision', '正在读取所选修订')} /> : null}
    {!state.loading && !signal ? <SurfaceState phase="error" title={t('Selected detail is unavailable', '所选详情不可用')}
      description={t('Return to the list and select an available revision.', '请返回列表选择可用修订。')} /> : null}
    {signal ? <article className="ys-row">
      <h3>{signal.title}</h3>
      <p>{signal.signalRef} · {t('Revision', '修订')} {signal.revision}</p>
      <p>{marketLabel('claim', signal.claimKind, locale)} · {marketLabel('lifecycle', signal.lifecycle, locale)}</p>
      <p>{signal.market} · {signal.sourceRef} · {marketLabel('origin', signal.origin, locale)}</p>
      <time dateTime={signal.observedAt}>{marketTime(signal.observedAt, 'UTC', locale)} · UTC</time>
      {signal.comparison ? <p>{signal.comparison.before} → {signal.comparison.after} ({signal.comparison.change})</p> : null}
      <ul>{signal.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul>
      <ul>{signal.evidenceRefs.map(ref => <li key={ref}>{ref}</li>)}</ul>
    </article> : null}
    {question ? <section aria-label={qt('ask')}>
      <h3>{qt('ask')}</h3>
      {signal ? <Button disabled={questionState === null || questionState.status === 'evidence_insufficient'} onClick={() => question.prepare(signal!)}>{qt('ask')}</Button> : null}
      {questionState ? <>
        <p role="status">{qt(questionState.status)}</p>
        {questionState.reason ? <p>{questionState.reason}</p> : null}
        {questionState.status === 'draft' || questionState.status === 'session_changed' || questionState.status === 'failed' ? <>
          {/* The draft is editable locally; nothing is sent until the explicit send action. Shared ys-field contract. */}
          <label className="ys-field" htmlFor="radar-market-question">
            <textarea id="radar-market-question" aria-label={qt('ask')} value={questionState.draft?.question ?? ''} onChange={event => question.edit(event.target.value)}
              placeholder={locale === 'zh' ? '输入问题（发送前可编辑）' : 'Type a question (editable before sending)'} />
          </label>
          {questionState.status === 'session_changed' ? <Button onClick={() => question.rebind()}>{t('Rebind to the current conversation', '重新绑定当前会话')}</Button> : null}
          <Button disabled={questionState.draft === null || questionState.draft.question.trim().length === 0} onClick={() => { void question.send() }}>{t('Send to the current conversation', '发送到当前会话')}</Button>
        </> : null}
      </> : null}
    </section> : null}
  </SurfaceSection>
}

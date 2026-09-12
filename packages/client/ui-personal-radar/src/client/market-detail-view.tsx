import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { createMarketDetailController } from '@yeisme/dsh-personal-radar'
import { marketLabel, marketTime } from './market-labels.js'
import type { MarketLocale } from './market-view.js'

export function MarketDetailView({ controller, locale, onClose }: {
  controller: ReturnType<typeof createMarketDetailController>; locale: MarketLocale; onClose(): void
}) {
  const [state, setState] = useState(() => controller.snapshot())
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { const dispose = controller.subscribe(setState); setState(controller.snapshot()); return () => dispose() }, [controller])
  useEffect(() => { heading.current?.focus() }, [])
  const t = (en: string, zh: string) => locale === 'zh' ? zh : locale === 'pseudo' ? `[!! ${en} !!]` : en
  const result = state.result, signal = result?.ok ? result.signal : null
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
  </SurfaceSection>
}

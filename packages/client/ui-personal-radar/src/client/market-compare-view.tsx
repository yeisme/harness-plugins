import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { createMarketCompareController } from '@yeisme/dsh-personal-radar'
import { marketLabel, marketTime } from './market-labels.js'
import type { MarketLocale } from './market-view.js'

export function MarketCompareView({ controller, locale, onClose }: { controller: ReturnType<typeof createMarketCompareController>; locale: MarketLocale; onClose(): void }) {
  const [state, setState] = useState(() => controller.snapshot())
  useEffect(() => { const dispose = controller.subscribe(setState); setState(controller.snapshot()); return () => dispose() }, [controller])
  const t = (en: string, zh: string) => locale === 'zh' ? zh : locale === 'pseudo' ? `[!! ${en} !!]` : en
  const result = state.result, compare = result?.ok ? result.compare : null
  return <SurfaceSection aria-label={t('Cross-market comparison', '跨市场对照')} title={t('Cross-market comparison', '跨市场对照')}>
    <Button onClick={onClose}>{t('Back to list', '返回列表')}</Button>
    {state.loading ? <SurfaceState phase="loading" title={t('Reading comparison', '正在读取对照')} /> : null}
    {!state.loading && !compare ? <SurfaceState phase="error" title={t('Comparison unavailable', '对照暂不可用')} description={t('Select two available signal revisions.', '请选择两个可用的信号修订。')} /> : null}
    {compare ? <div className="ys-grid">{compare.sides.map(side => <article className="ys-row" key={`${side.signalRef}:${side.signalRevision}`}>
      <h3>{side.title}</h3><p>{side.market} · {side.signalRef} · {t('Revision', '修订')} {side.signalRevision}</p>
      <p>{marketLabel('lifecycle', side.lifecycle, locale)} · {side.identity.status}</p>
      {side.observations.map(observation => <div key={observation.observationRef}><p>{observation.platform} · {observation.samplingScope}</p>
        <time dateTime={observation.observedAt}>{marketTime(observation.observedAt, 'UTC', locale)} · UTC</time></div>)}
    </article>)}</div> : null}
    {compare ? <p>{t('Each side keeps its source scope; no shared numeric axis or causal conclusion.', '两侧保留各自来源口径，不共用数值轴，也不作因果判断。')}</p> : null}
  </SurfaceSection>
}

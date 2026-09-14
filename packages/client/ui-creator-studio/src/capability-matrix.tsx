import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { SonoraCapabilityMatrix, SonoraCapabilityMatrixEntry } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'

type MatrixState = SonoraCapabilityMatrixEntry['state']

/** Renders the owner-sourced capability matrix. Missing/unverified families keep a
 * disabled entry with the stable reason instead of disappearing or faking support. */
export function CreatorCapabilityMatrix({ runtime, t }: {
  runtime: { readCapabilityMatrix(): Promise<SonoraCapabilityMatrix | undefined> }
  t: CreatorStudioTranslator
}) {
  const [matrix, setMatrix] = useState<SonoraCapabilityMatrix>()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const request = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++request.current
    setPhase('loading')
    try {
      const next = await runtime.readCapabilityMatrix()
      if (current !== request.current) return
      if (next === undefined) { setPhase('error'); return }
      setMatrix(next); setPhase('ready')
    } catch { if (current === request.current) setPhase('error') }
  }, [runtime])
  useEffect(() => { void refresh(); return () => { request.current++ } }, [refresh])
  const stateLabel = (state: MatrixState) => t(`capability.matrix.state.${state}`)
  return <SurfaceSection className="cs-section" title={t('capability.matrix.title')} description={t('capability.matrix.description')} data-capability-matrix>
    <div className="cs-actions"><Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" disabled={phase === 'loading'} onClick={() => void refresh()}>{t('state.refresh')}</Button></div>
    {phase === 'loading' && <SurfaceState phase="loading" title={t('state.loading')} />}
    {phase === 'error' && <SurfaceState phase={matrix === undefined ? 'error' : 'stale'} title={t(matrix === undefined ? 'capability.matrix.unavailable' : 'capability.matrix.stale')} />}
    {matrix !== undefined && <dl className="cs-capability-matrix">
      {matrix.entries.map(entry => <div className="cs-capability-row" key={entry.family} data-family={entry.family} data-state={entry.state}>
        <dt>{t(`capability.matrix.family.${entry.family}`)}</dt>
        <dd>
          {/* 状态标签本地化；原因保留 owner/矩阵的稳定机器码，不翻译成断言。 */}
          <strong className="cs-capability-state" data-state={entry.state}>{stateLabel(entry.state)}</strong>
          <code>{entry.reasonCode}</code>
          <span className="cs-muted">{t(`capability.matrix.state.${entry.state}.note`)}</span>
          {entry.detail !== undefined && <span className="cs-muted">{entry.detail}</span>}
          {entry.source === 'contract_audit' && <span className="cs-muted">{t('capability.matrix.contractAudit')}</span>}
          {entry.providers.length > 0 && <span className="cs-capability-providers">{entry.providers.map(provider => `${provider.id} (${provider.status})`).join(', ')}</span>}
        </dd>
      </div>)}
    </dl>}
    <p className="cs-muted">{t('capability.matrix.noQuotation')}</p>
  </SurfaceSection>
}

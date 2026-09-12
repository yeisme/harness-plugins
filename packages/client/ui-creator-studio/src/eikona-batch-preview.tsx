import { EikonaBatchPlanPreview } from './eikona-batch-plan-preview.tsx'
import type { EikonaBatchPlanResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection } from '@yeisme/dsh-client-ui-surface'
import { eikonaBatchInputResultSchema, type CreatorResourceV1, type EikonaBatchInputQuery, type EikonaBatchInputResult } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'
export function EikonaBatchPreview({ resource, read, plan, t }: { plan?(input: EikonaBatchInputQuery): Promise<EikonaBatchPlanResult>; resource: CreatorResourceV1; read(input: EikonaBatchInputQuery): Promise<EikonaBatchInputResult>; t: CreatorStudioTranslator }) {
  const live = useRef(true), pending = useRef(false)
  const [busy, setBusy] = useState(false), [result, setResult] = useState<EikonaBatchInputResult>()
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  return <SurfaceSection className="cs-section" title={resource.title} description={t('eikona.batch.description')}>
    <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={async () => {
      if (pending.current) return
      pending.current = true; setBusy(true)
      let next: EikonaBatchInputResult
      try {
        const parsed = eikonaBatchInputResultSchema.safeParse(await read({ batchRef: resource.ref, digest: resource.version }))
        next = parsed.success && (parsed.data.status !== 'ready' || (parsed.data.batchRef === resource.ref && parsed.data.digest === resource.version)) ? parsed.data : { status: 'unconfirmed' }
      } catch { next = { status: 'unconfirmed' } }
      pending.current = false
      if (live.current) { setResult(next); setBusy(false) }
    }}>{t(busy ? 'eikona.batch.loading' : 'eikona.batch.read')}</Button>
    {result && <div role="status">{result.status === 'ready' ? <><p>{t('eikona.batch.requests')} {result.requestCount} · {t('eikona.batch.candidates')} {result.candidateCount}</p><p>{t('eikona.batch.noPlan')}</p></> : t('eikona.batch.failed')}</div>}
    {result?.status === 'ready' && plan && <EikonaBatchPlanPreview input={{ batchRef: resource.ref, digest: resource.version }} read={plan} t={t} />}
  </SurfaceSection>
}

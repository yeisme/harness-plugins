import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { eikonaBatchPlanResultSchema, type EikonaBatchInputQuery, type EikonaBatchPlanResult } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'
const blockerMessages = {
 PROMPT_PACK_UNRESOLVED: 'eikona.batch.promptMissing',
 PROMPT_PACK_DIGEST_MISMATCH: 'eikona.batch.promptChanged',
 DRAMA_PROMPT_NOT_READY: 'eikona.batch.promptReview',
 PROVIDER_CAPABILITY_UNAVAILABLE: 'eikona.batch.modelUnavailable',
 PROVIDER_AUTH_NOT_CONFIGURED: 'eikona.batch.providerAccess',
 COST_ESTIMATE_UNKNOWN: 'eikona.batch.costApproval',
} as const
export function EikonaBatchPlanPreview({ input, read, t }: { input: EikonaBatchInputQuery; read(input: EikonaBatchInputQuery): Promise<EikonaBatchPlanResult>; t: CreatorStudioTranslator }) {
 const live = useRef(true), pending = useRef(false)
 const [busy, setBusy] = useState(false), [result, setResult] = useState<EikonaBatchPlanResult>()
 useEffect(() => { live.current = true; return () => { live.current = false } }, [])
 return <div className="cs-wrapping-content">
  <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={async () => {
   if (pending.current) return
   pending.current = true; setBusy(true); setResult(undefined)
   let next: EikonaBatchPlanResult
   try {
    const parsed = eikonaBatchPlanResultSchema.safeParse(await read(input))
    next = parsed.success && (parsed.data.status !== 'ready' || (parsed.data.batchRef === input.batchRef && parsed.data.digest === input.digest)) ? parsed.data : { status: 'unconfirmed' }
   } catch { next = { status: 'unconfirmed' } }
   pending.current = false
   if (live.current) { setBusy(false); setResult(next) }
  }}>{t(busy ? 'eikona.batch.loading' : 'eikona.batch.plan')}</Button>
  {result && <div role="status">{result.status === 'ready' ? <>
   <p>{t(result.planStatus === 'blocked' ? 'eikona.batch.blocked' : 'eikona.batch.planReady')}</p>
   <p>{t('eikona.batch.calls')} {result.estimatedCalls}</p>
   <p>{t('eikona.batch.cost')} {result.costEstimateKnown ? `$${result.estimatedUSDUpper!.toFixed(4)}` : t('eikona.batch.unknownCost')}</p>
   {result.blockers.length > 0 && <ul>{result.blockers.map((blocker, index) => <li key={`${blocker.requestId}:${index}`}>{blocker.requestId}: {t(Object.hasOwn(blockerMessages, blocker.code) ? blockerMessages[blocker.code as keyof typeof blockerMessages] : 'eikona.batch.fixRequired')} <code>{blocker.code}</code></li>)}</ul>}
  </> : t('eikona.batch.failed')}</div>}
 </div>
}

import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { eikonaStatusResultSchema, type EikonaStatusResult } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'

/** This view observes a saved reference; it cannot approve or submit work. */
export function EikonaRestoredApproval({ approvalRef, preparationRef, digest, read, t, continueEditing }: {
  approvalRef: string; preparationRef: string; digest: string
  read(input: unknown): Promise<EikonaStatusResult>; t: CreatorStudioTranslator
  continueEditing?(observation: Extract<EikonaStatusResult, { status: 'observed' }>): Promise<boolean>
}) {
  const live = useRef(true), pending = useRef(false)
  const [busy, setBusy] = useState(false), [result, setResult] = useState<EikonaStatusResult>()
  const last = useRef<Extract<EikonaStatusResult, { status: 'observed' }>>()
  const [failed, setFailed] = useState(false)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  return <div className="cs-receipt">
    <Button type="button" className="cs-button vk-btn" disabled={busy} onClick={async () => {
      if (pending.current) return
      pending.current = true; setBusy(true)
      let next: EikonaStatusResult
      try {
        const parsed = eikonaStatusResultSchema.safeParse(await read({ approvalRef }))
        next = parsed.success ? parsed.data : { status: 'unconfirmed' }
        if (next.status === 'observed' && (next.approvalRef !== approvalRef || next.preparationRef !== preparationRef || next.digest !== digest)) next = { status: 'unconfirmed' }
        const previous = last.current
        if (next.status === 'observed' && previous && (
          Date.parse(next.observedAt) < Date.parse(previous.observedAt)
          || (previous.revoked && !next.revoked)
          || (previous.expired && !next.expired)
          || (previous.consumedOperation !== undefined && next.consumedOperation !== previous.consumedOperation)
          || next.projectId !== previous.projectId || next.expiresAt !== previous.expiresAt
        )) next = { status: 'unconfirmed' }
      } catch { next = { status: 'unconfirmed' } }
      pending.current = false
      if (live.current) {
        if (next.status === 'observed') { last.current = next; setResult(next); setFailed(false) }
        else { setResult(last.current ?? next); setFailed(true) }
        setBusy(false)
      }
    }}>{t(busy ? 'eikona.draft.checkingApproval' : 'eikona.draft.checkApproval')}</Button>
    {continueEditing && result?.status === 'observed' && result.revoked && <Button type="button" className="cs-button vk-btn" disabled={busy || failed} onClick={async () => {
      if (pending.current || failed) return
      pending.current = true; setBusy(true)
      try { if (!await continueEditing(result) && live.current) setFailed(true) }
      catch { if (live.current) setFailed(true) }
      finally { pending.current = false; if (live.current) setBusy(false) }
    }}>{t('eikona.draft.continueEditing')}</Button>}
    {failed && last.current && <p role="status">{t('eikona.draft.approvalStale')}</p>}
    {result && <div role="status">
      <p>{t(result.status !== 'observed' ? 'eikona.draft.approvalUnknown' : result.revoked ? 'eikona.draft.approvalRevoked' : result.expired ? 'eikona.draft.approvalExpired' : 'eikona.draft.approvalObserved')}</p>
      {result.status === 'observed' && <>
        <p>{t('eikona.draft.observedAt')} {result.observedAt}</p>
        {result.consumedOperation && <p>{t('eikona.draft.originalOperation')} {result.consumedOperation}</p>}
      </>}
    </div>}
  </div>
}

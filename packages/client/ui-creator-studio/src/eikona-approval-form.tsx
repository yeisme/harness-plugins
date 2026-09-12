import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection } from '@yeisme/dsh-client-ui-surface'
import type { EikonaStatusResult, EikonaRevokeResult, EikonaApprovalResult, EikonaPreparationResult } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'

/** Parent keys this form by preparation digest and full context. */
export function EikonaApprovalForm({ preparation, approve, available, t, onUnresolved, revoke, readStatus }: {
  preparation: Extract<EikonaPreparationResult, { status: 'ready' }>
  approve(input: unknown): Promise<EikonaApprovalResult>; available: boolean; t: CreatorStudioTranslator; onUnresolved?(unresolved: boolean): void; revoke?(input: unknown): Promise<EikonaRevokeResult>; readStatus?(input: unknown): Promise<EikonaStatusResult>
}) {
  const id = useId(), flight = useRef(false), live = useRef(true)
  const [budget, setBudget] = useState(''), [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false), [result, setResult] = useState<EikonaApprovalResult>()
  const [revocation, setRevocation] = useState<EikonaRevokeResult>()
  const [revoking, setRevoking] = useState(false)
  const [checking, setChecking] = useState(false), [checkFailed, setCheckFailed] = useState(false)
  const [observed, setObserved] = useState<Extract<EikonaStatusResult, { status: 'observed' }>>()
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    if (result?.status !== 'approved') { setExpired(false); return }
    const deadline = Date.parse(result.expiresAt)
    const check = () => setExpired(Date.now() >= deadline)
    check()
    const timer = setTimeout(check, Math.max(0, deadline - Date.now()))
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => { clearTimeout(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check) }
  }, [result])
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const valid = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(budget) && Number.isFinite(Number(budget))
  const locked = busy || result?.status === 'approved' || result?.status === 'unconfirmed'
  return <SurfaceSection className="cs-section" title={t('eikona.approval.title')} description={t('eikona.approval.description')}>
    <p>{preparation.modelRef}</p>
    <p>{t('eikona.approval.scope')}</p>
    <label className="cs-field ys-field" htmlFor={`${id}-budget`}>{t('eikona.approval.budget')}
      <Input id={`${id}-budget`} inputMode="decimal" value={budget} disabled={locked} aria-invalid={budget !== '' && !valid} onChange={event => { setBudget(event.target.value); setConsent(false) }} />
    </label>
    <label className="cs-field ys-field" htmlFor={`${id}-consent`}>{t('eikona.approval.consent')}
      <select id={`${id}-consent`} value={consent ? 'yes' : 'no'} disabled={locked} onChange={event => setConsent(event.target.value === 'yes')}>
        <option value="no">{t('eikona.approval.no')}</option><option value="yes">{t('eikona.approval.yes')}</option>
      </select>
    </label>
    <Button type="button" className="cs-button vk-btn" disabled={!available || !valid || !consent || locked} onClick={async () => {
      if (!available || !valid || !consent || flight.current || locked) return
      flight.current = true; onUnresolved?.(true); setBusy(true)
      let next: EikonaApprovalResult
      try { next = await approve({ preparation_ref: preparation.preparationRef, expected_digest: preparation.digest,
        max_cost_usd: Number(budget), max_images: 1, allow_unknown_cost: true, confirmed: true, expires_in_seconds: 3600 }) }
      catch { next = { status: 'unconfirmed' } }
      flight.current = false
      if (live.current) { onUnresolved?.(next.status === 'unconfirmed'); setResult(next); setBusy(false) }
    }}>{t(busy ? 'eikona.approval.busy' : 'eikona.approval.submit')}</Button>
    {!available && <p role="status">{t('eikona.approval.unavailable')}</p>}
    {result && <p role="status">{t(result.status === 'approved' ? revoking ? 'eikona.approval.revoking' : revocation?.status === 'unconfirmed' ? 'eikona.approval.revokeUnknown' : revocation?.status === 'revoked' ? 'eikona.approval.revoked' : expired ? 'eikona.approval.expired' : 'eikona.approval.approved' : result.status === 'unconfirmed' ? 'eikona.approval.unknown' : 'eikona.approval.failed')}</p>}
    {result?.status === 'approved' && <dl className="cs-receipt">
      <dt>{t('eikona.approval.reference')}</dt><dd>{result.approvalRef}</dd>
      <dt>{t('eikona.approval.preparation')}</dt><dd>{result.preparationRef}</dd>
      <dt>{t('eikona.approval.budget')}</dt><dd>{result.maxCostUSD} USD</dd>
      <dt>{t('eikona.approval.expires')}</dt><dd><time dateTime={result.expiresAt}>{result.expiresAt}</time></dd>
    </dl>}
    {result?.status === 'approved' && revoke && <>
      <p>{t('eikona.approval.revokeDescription')}</p>
      <Button type="button" className="cs-button vk-btn" disabled={!available || revoking || revocation?.status === 'revoked' || revocation?.status === 'unconfirmed'} onClick={async () => {
        if (!available || flight.current || revocation?.status === 'revoked' || revocation?.status === 'unconfirmed') return
        flight.current = true; setRevoking(true); onUnresolved?.(true)
        let next: EikonaRevokeResult
        try { next = await revoke({ approvalRef: result.approvalRef, confirmed: true }) } catch { next = { status: 'unconfirmed' } }
        flight.current = false
        if (live.current) { setRevocation(next); setRevoking(false); onUnresolved?.(next.status === 'unconfirmed') }
      }}>{t(revoking ? 'eikona.approval.revoking' : 'eikona.approval.revoke')}</Button>
      {revocation && revocation.status !== 'revoked' && revocation.status !== 'unconfirmed' && <p role="status">{t('eikona.approval.revokeFailed')}</p>}
    </>}
    {result?.status === 'approved' && readStatus && <>
      <Button type="button" className="cs-button vk-btn" disabled={checking || revoking} onClick={async () => {
        if (checking || flight.current) return
        flight.current = true; setChecking(true); setCheckFailed(false)
        let value: EikonaStatusResult
        try { value = await readStatus({ approvalRef: result.approvalRef }) } catch { value = { status: 'unconfirmed' } }
        flight.current = false
        if (!live.current) return
        setChecking(false)
        if (value.status !== 'observed' || value.approvalRef !== result.approvalRef || value.preparationRef !== preparation.preparationRef
          || value.digest !== preparation.digest || value.projectId !== preparation.projectId
          || (observed && Date.parse(value.observedAt) < Date.parse(observed.observedAt))
          || (observed?.revoked && !value.revoked)
          || (observed?.consumedOperation && value.consumedOperation !== observed.consumedOperation)) { setCheckFailed(true); return }
        setObserved(value); setExpired(value.expired)
        if (value.revoked) { setRevocation({ status: 'revoked', approvalRef: value.approvalRef }); onUnresolved?.(false) }
        else if (revocation?.status === 'unconfirmed') setCheckFailed(true)
      }}>{t(checking ? 'eikona.approval.checking' : 'eikona.approval.check')}</Button>
      {checkFailed && <p role="status">{t('eikona.approval.checkFailed')}</p>}
      {observed && (checking || checkFailed) && <p>{t('eikona.approval.previousObservation')}</p>}
      {observed && <dl className="cs-receipt">
        <dt>{t('eikona.approval.observedAt')}</dt><dd><time dateTime={observed.observedAt}>{observed.observedAt}</time></dd>
        {observed.consumedOperation && <><dt>{t('eikona.approval.consumed')}</dt><dd>{observed.consumedOperation}</dd></>}
      </dl>}
      {observed?.consumedOperation && <p role="status">{t('eikona.approval.consumedHint')}</p>}
    </>}
  </SurfaceSection>
}

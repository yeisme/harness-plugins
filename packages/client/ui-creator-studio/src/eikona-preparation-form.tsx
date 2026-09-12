import { EikonaRestoredApproval } from './eikona-restored-approval.tsx'
import { EikonaDraftSession, type EikonaDraftRuntime } from './eikona-draft-session.ts'
import { eikonaDraftFieldsSchema, type EikonaDraft } from '@yeisme/dsh-creator-studio-host/contracts'
import { EikonaApprovalForm } from './eikona-approval-form.tsx'
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection } from '@yeisme/dsh-client-ui-surface'
import type { EikonaStatusResult, EikonaRevokeResult, EikonaApprovalResult, EikonaPreparationResult } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'

/** Mount keyed by full context; preparation never grants execution consent. */
export function EikonaPreparationForm({ prepare, available, t, onDirty, approve, revoke, readStatus, approvalAvailable = false, draftStorage }: {
  draftStorage?: { runtime: EikonaDraftRuntime; scope: EikonaDraft['scope'] };
  prepare(input: unknown): Promise<EikonaPreparationResult>; available: boolean; t: CreatorStudioTranslator; onDirty?(dirty: boolean): void; approve?(input: unknown): Promise<EikonaApprovalResult>; approvalAvailable?: boolean; revoke?(input: unknown): Promise<EikonaRevokeResult>; readStatus?(input: unknown): Promise<EikonaStatusResult>
}) {
  const id = useId(), live = useRef(true), inFlight = useRef(false)
  const composing = useRef(false)
  const [prompt, setPrompt] = useState(''), [version, setVersion] = useState('1')
  const [size, setSize] = useState(''), [seed, setSeed] = useState('')
  const [reference, setReference] = useState(''), [mask, setMask] = useState('')
  const [referenceMode, setReferenceMode] = useState<'auto' | 'edit' | 'generate'>('auto')
  const referenceFields = { ...(reference ? { reference } : {}), ...(mask ? { mask } : {}), ...(referenceMode !== 'auto' ? { referenceMode } : {}) }
  const [variables, setVariables] = useState<{ name: string; value: string }[]>([])
  const [approvalUnresolved, setApprovalUnresolved] = useState(false)
  const [busy, setBusy] = useState(false), [result, setResult] = useState<EikonaPreparationResult>()
  const [draftSession] = useState(() => draftStorage ? new EikonaDraftSession(draftStorage.runtime, {
    schemaVersion: 'eikona.studio_draft.v1', scope: draftStorage.scope, id: 'primary', revision: 0,
    fields: { prompt: '', version: '1', size: '', seed: '', variables: [] }, checkpoint: { status: 'editing' },
  }, () => crypto.randomUUID()) : undefined)
  const [draftState, setDraftState] = useState(() => draftSession?.snapshot())
  const [restoredLock, setRestoredLock] = useState(false)
  useEffect(() => {
    if (!draftSession) return
    let active = true
    void draftSession.load().then(() => {
      if (!active) return
      const state = draftSession.snapshot()
      setDraftState(state)
      if (state.draft) {
        const fields = state.draft.fields
        setPrompt(fields.prompt); setVersion(fields.version); setSize(fields.size); setSeed(fields.seed); setVariables(fields.variables)
        setRestoredLock(!['editing', 'prepared', 'approval_reconciled'].includes(state.draft.checkpoint.status))
      }
    })
    return () => { active = false }
  }, [draftSession])
  const draftFieldsValid = !draftSession || eikonaDraftFieldsSchema.safeParse({ prompt, version, size, seed, variables, ...referenceFields }).success
  const storageLocked = !!draftSession && draftState?.phase !== 'ready'
  async function persist(checkpoint: EikonaDraft['checkpoint']): Promise<boolean> {
    if (!draftSession) return true
    if (!draftSession.edit({ prompt, version, size, seed, variables, ...referenceFields }, checkpoint)) return false
    const saving = draftSession.save()
    setDraftState(draftSession.snapshot())
    await saving
    const state = draftSession.snapshot()
    if (live.current) setDraftState(state)
    return state.phase === 'ready' && !state.dirty
  }
  const fieldsChanged = draftState?.draft === undefined || JSON.stringify({ prompt, version, size, seed, variables, ...referenceFields }) !== JSON.stringify(draftState.draft.fields)
  const legacyDirty = prompt !== '' || version !== '1' || variables.length > 0 || size !== '' || seed !== '' || reference !== '' || mask !== '' || referenceMode !== 'auto'
  const draftDirty = draftSession ? draftState?.phase !== 'ready' || draftState.dirty || fieldsChanged : legacyDirty
  const dirty = draftDirty || restoredLock || approvalUnresolved || busy || result?.status === 'unconfirmed'
  useEffect(() => { onDirty?.(dirty) }, [dirty, onDirty])
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const promptValid = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(prompt)
  const versionValid = /^[1-9][0-9]*$/u.test(version) && Number.isSafeInteger(Number(version))
  const variablesValid = variables.every(item => item.name.trim().length > 0) && new Set(variables.map(item => item.name.trim())).size === variables.length
  const seedValid = seed === '' || (/^-?(?:0|[1-9][0-9]*)$/u.test(seed) && Number.isSafeInteger(Number(seed)))
  const fixedImageRef = (value: string) => value === '' || /^eikona:\/\/artifacts\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(value)
  const referencesValid = fixedImageRef(reference) && fixedImageRef(mask) && (!mask || !!reference)
  const valid = draftFieldsValid && promptValid && versionValid && variablesValid && seedValid && referencesValid
  return <SurfaceSection className="cs-section" title={t('eikona.prepare.title')} description={t('eikona.prepare.description')}>
    {draftSession && <div className="cs-receipt">
      {!draftFieldsValid && <p role="alert">{t('eikona.draft.tooLarge')}</p>}
      <p role="status">{t(restoredLock ? 'eikona.draft.ownerPending' : draftState?.phase === 'loading' ? 'eikona.draft.loading' : draftState?.phase === 'ready' ? 'eikona.draft.ready' : 'eikona.draft.unsettled')}</p>
      {restoredLock && draftState?.draft && 'preparationRef' in draftState.draft.checkpoint && <p>{draftState.draft.checkpoint.preparationRef}</p>}
      {restoredLock && draftState?.draft && 'approvalRef' in draftState.draft.checkpoint && <p>{draftState.draft.checkpoint.approvalRef}</p>}
      {restoredLock && readStatus && draftState?.draft && 'approvalRef' in draftState.draft.checkpoint && <EikonaRestoredApproval key={draftState.draft.checkpoint.approvalRef} approvalRef={draftState.draft.checkpoint.approvalRef} preparationRef={draftState.draft.checkpoint.preparationRef} digest={draftState.draft.checkpoint.digest} read={readStatus} t={t} continueEditing={async observation => {
        if (!observation.revoked || storageLocked) return false
        const saved = await persist({ status: 'approval_reconciled', preparationRef: observation.preparationRef, digest: observation.digest, approvalRef: observation.approvalRef, revoked: true, observedAt: observation.observedAt, ...(observation.consumedOperation ? { consumedOperation: observation.consumedOperation } : {}) })
        if (saved && live.current) { setRestoredLock(false); setApprovalUnresolved(false) }
        return saved
      }} />}
      {draftState?.phase === 'error' && <Button type="button" className="cs-button vk-btn" onClick={async () => {
        const loading = draftSession.load(); setDraftState(draftSession.snapshot()); await loading
        if (!live.current) return
        const state = draftSession.snapshot(); setDraftState(state)
        if (state.draft) { const fields = state.draft.fields; setPrompt(fields.prompt); setVersion(fields.version); setSize(fields.size); setSeed(fields.seed); setVariables(fields.variables); setReference(fields.reference ?? ''); setMask(fields.mask ?? ''); setReferenceMode(fields.referenceMode ?? 'auto'); setRestoredLock(!['editing', 'prepared', 'approval_reconciled'].includes(state.draft.checkpoint.status)) }
      }}>{t('eikona.draft.retryRead')}</Button>}
      <Button type="button" className="cs-button vk-btn" disabled={!draftFieldsValid || storageLocked || restoredLock || busy || approvalUnresolved} onClick={() => { void persist(draftSession.snapshot().draft?.checkpoint ?? { status: 'editing' }) }}>{t('eikona.draft.save')}</Button>
      {draftState?.phase === 'unknown' && <Button type="button" className="cs-button vk-btn" onClick={async () => { await draftSession.reconcile(); if (live.current) setDraftState(draftSession.snapshot()) }}>{t('eikona.draft.reconcile')}</Button>}
    </div>}
    <form onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
      onKeyDown={event => { if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault() }}
      onSubmit={async event => {
      event.preventDefault()
      if (storageLocked || restoredLock || approvalUnresolved || composing.current || !available || !valid || inFlight.current || result?.status === 'unconfirmed') return
      inFlight.current = true; setBusy(true); setResult(undefined)
      if (draftSession && !await persist({ status: 'preparation_unconfirmed' })) { inFlight.current = false; if (live.current) setBusy(false); return }
      if (!live.current) { inFlight.current = false; return }
      let next: EikonaPreparationResult
      try { next = await prepare({ prompt_id: prompt, prompt_version: Number(version), ...(reference ? { references: [{ ref: reference, role: 'reference_image' as const }, ...(mask ? [{ ref: mask, role: 'mask' as const }] : [])] } : {}), ...(variables.length ? { values: Object.fromEntries(variables.map(item => [item.name.trim(), item.value])) } : {}), controls: { model_ref: 'openai/gpt-5.4-image-2', candidate_count: 1, ...(reference ? { reference_mode: referenceMode } : {}), ...(size.trim() ? { size: size.trim() } : {}), ...(seed !== '' ? { seed: Number(seed) } : {}) } }) }
      catch { next = { status: 'unconfirmed' } }
      await persist(next.status === 'ready' ? { status: 'prepared', preparationRef: next.preparationRef, digest: next.digest }
        : next.status === 'unconfirmed' ? { status: 'preparation_unconfirmed' } : { status: 'editing' })
      inFlight.current = false
      if (live.current) { setResult(next); setBusy(false) }
    }}>
      <label className="cs-field ys-field" htmlFor={`${id}-prompt`}>{t('eikona.prepare.prompt')}
        <Input id={`${id}-prompt`} aria-invalid={prompt !== '' && !promptValid} aria-describedby={`${id}-prompt-help`} maxLength={160} value={prompt} disabled={busy || approvalUnresolved || storageLocked || restoredLock} onChange={event => { setPrompt(event.target.value); if (result?.status !== 'unconfirmed') setResult(undefined) }} />
      </label>
      <p id={`${id}-prompt-help`}>{t('eikona.prepare.promptHelp')}</p>
      <label className="cs-field ys-field" htmlFor={`${id}-version`}>{t('eikona.prepare.version')}
        <Input id={`${id}-version`} aria-invalid={!versionValid} aria-describedby={`${id}-version-help`} inputMode="numeric" maxLength={32} value={version} disabled={busy || approvalUnresolved || storageLocked || restoredLock} onChange={event => { setVersion(event.target.value); if (result?.status !== 'unconfirmed') setResult(undefined) }} />
      </label>
      <p id={`${id}-version-help`}>{t('eikona.prepare.versionHelp')}</p>
      <label className="cs-field ys-field" htmlFor={`${id}-size`}>{t('eikona.prepare.size')}
        <Input id={`${id}-size`} maxLength={80} value={size} disabled={busy || approvalUnresolved || storageLocked || restoredLock} aria-describedby={`${id}-controls-help`} onChange={event => { setSize(event.target.value); if (result?.status !== 'unconfirmed') setResult(undefined) }} />
      </label>
      <label className="cs-field ys-field" htmlFor={`${id}-seed`}>{t('eikona.prepare.seed')}
        <Input id={`${id}-seed`} inputMode="numeric" maxLength={32} value={seed} disabled={busy || approvalUnresolved || storageLocked || restoredLock} aria-invalid={!seedValid} aria-describedby={`${id}-controls-help`} onChange={event => { setSeed(event.target.value); if (result?.status !== 'unconfirmed') setResult(undefined) }} />
      </label>
      <label className="cs-field ys-field" htmlFor={`${id}-reference`}>{t('eikona.reference')}
        <Input id={`${id}-reference`} value={reference} maxLength={480} aria-invalid={!fixedImageRef(reference)} disabled={busy || approvalUnresolved || storageLocked || restoredLock} onChange={event => { setReference(event.target.value); if (result?.status !== 'unconfirmed') setResult(undefined) }} />
      </label>
      <label className="cs-field ys-field" htmlFor={`${id}-mask`}>{t('eikona.mask')}
        <Input id={`${id}-mask`} value={mask} maxLength={480} aria-invalid={!referencesValid} disabled={busy || approvalUnresolved || storageLocked || restoredLock} onChange={event => { setMask(event.target.value); if (result?.status !== 'unconfirmed') setResult(undefined) }} />
      </label>
      <label className="cs-field ys-field" htmlFor={`${id}-reference-mode`}>{t('eikona.referenceMode')}
        <select id={`${id}-reference-mode`} value={referenceMode} disabled={busy || approvalUnresolved || storageLocked || restoredLock} onChange={event => { setReferenceMode(event.target.value as 'auto' | 'edit' | 'generate'); if (result?.status !== 'unconfirmed') setResult(undefined) }}>
          <option value="auto">{t('eikona.referenceAuto')}</option><option value="generate">{t('eikona.referenceGenerate')}</option><option value="edit">{t('eikona.referenceEdit')}</option>
        </select>
      </label>
      <p id={`${id}-controls-help`}>{t('eikona.prepare.controlsHelp')}</p>
      <fieldset disabled={busy || approvalUnresolved || storageLocked || restoredLock}>
        <legend>{t('eikona.prepare.variables')}</legend>
        {variables.map((item, index) => <div key={index}>
          <label className="cs-field ys-field" htmlFor={`${id}-name-${index}`}>{t('eikona.prepare.variableName')} {index + 1}
            <Input id={`${id}-name-${index}`} maxLength={160} value={item.name} onChange={event => { setVariables(current => current.map((row, i) => i === index ? { ...row, name: event.target.value } : row)); if (result?.status !== 'unconfirmed') setResult(undefined) }} />
          </label>
          <label className="cs-field ys-field" htmlFor={`${id}-value-${index}`}>{t('eikona.prepare.variableValue')} {index + 1}
            <textarea id={`${id}-value-${index}`} maxLength={4096} value={item.value} onChange={event => { setVariables(current => current.map((row, i) => i === index ? { ...row, value: event.target.value } : row)); if (result?.status !== 'unconfirmed') setResult(undefined) }} />
          </label>
          <Button type="button" className="cs-button vk-btn" onClick={() => { setVariables(current => current.filter((_, i) => i !== index)); if (result?.status !== 'unconfirmed') setResult(undefined) }}>{t('eikona.prepare.removeVariable')} {index + 1}</Button>
        </div>)}
        <Button type="button" className="cs-button vk-btn" disabled={variables.length >= 64} onClick={() => { setVariables(current => [...current, { name: '', value: '' }]); if (result?.status !== 'unconfirmed') setResult(undefined) }}>{t('eikona.prepare.addVariable')}</Button>
        {!variablesValid && <p role="status">{t('eikona.prepare.variablesInvalid')}</p>}
      </fieldset>
      <p>openai/gpt-5.4-image-2</p>
      <Button type="submit" className="cs-button vk-btn" disabled={storageLocked || restoredLock || approvalUnresolved || !available || !valid || busy || result?.status === 'unconfirmed'}>{t(busy ? 'eikona.prepare.busy' : 'eikona.prepare.submit')}</Button>
      {approvalUnresolved && <p role="status">{t('eikona.approval.lockedPreparation')}</p>}
      {!available && <p role="status">{t('eikona.prepare.unavailable')}</p>}
      {result && <div role="status" className="cs-receipt"><span>{t(result.status === 'ready' ? 'eikona.prepare.ready' : result.status === 'unconfirmed' ? 'eikona.prepare.unknown'
        : result.status === 'permission_denied' ? 'eikona.prepare.denied' : result.status === 'invalid_input' ? 'eikona.prepare.invalid'
        : result.status === 'needs_contract' ? 'eikona.prepare.contract' : 'eikona.prepare.failed')}</span>
        {result.status === 'ready' && <p>{result.preparationRef}</p>}
      </div>}
    </form>
    {result?.status === 'ready' && <dl className="cs-receipt" data-eikona-prepared-controls>
      <dt>{t('eikona.prepare.fixedInput')}</dt><dd>{result.promptRef}</dd>
      <dt>{t('eikona.prepare.fixedModel')}</dt><dd>{result.modelRef}</dd>
      {result.controls.size !== undefined && <><dt>{t('eikona.prepare.fixedSize')}</dt><dd>{result.controls.size}</dd></>}
      {result.controls.seed !== undefined && <><dt>{t('eikona.prepare.fixedSeed')}</dt><dd>{result.controls.seed}</dd></>}
      <dt>{t('eikona.prepare.fixedDigest')}</dt><dd>{result.digest}</dd>
    </dl>}
    {result?.status === 'ready' && approve && <EikonaApprovalForm {...(readStatus ? { readStatus } : {})} {...(revoke ? { revoke } : {})} onUnresolved={setApprovalUnresolved} key={result.digest} preparation={result} approve={async input => {
      if (!await persist({ status: 'approval_unconfirmed', preparationRef: result.preparationRef, digest: result.digest })) return { status: 'unconfirmed' }
      if (!live.current) return { status: 'unconfirmed' }
      const approved = await approve(input)
      if (approved.status === 'approved') await persist({ status: 'approval_observed', preparationRef: result.preparationRef, digest: result.digest, approvalRef: approved.approvalRef })
      else if (approved.status !== 'unconfirmed') await persist({ status: 'prepared', preparationRef: result.preparationRef, digest: result.digest })
      return approved
    }} available={approvalAvailable && !storageLocked && !restoredLock} t={t} />}
  </SurfaceSection>
}

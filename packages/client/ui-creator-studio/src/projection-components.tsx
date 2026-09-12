import { EikonaBatchResults } from './eikona-batch-results.tsx'
import { EikonaRunCandidates } from './eikona-run-candidates.tsx'
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ArtifactIntentV1,
  ArtifactRefV1,
  PaneActionDescriptorV1,
  PaneActionReceiptV1,
  PaneActionValueV1,
  PaneContextV1,
} from '@yeisme/dsh-pane-protocol'
import type {
  CreatorOwnerProjectionV1,
  CreatorResourceV1,
  CreatorStudioOwner,
  CreatorStudioSnapshotV1,
  CreatorStudioTask,
} from '@yeisme/dsh-creator-studio-host/contracts'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { CreatorStudioViewState } from './controller.ts'
import type { CreatorStudioRuntimeV1 } from './runtime.ts'
import {
  defaultCreatorStudioTranslator,
  type CreatorStudioTranslator,
} from './locales.ts'

export { creatorStudioStyles } from './styles.ts'

function ActionReceiptFeedback({ receipt, t, controller }: { readonly receipt: PaneActionReceiptV1; readonly t: CreatorStudioTranslator; readonly controller: Partial<Pick<import('./controller.ts').CreatorStudioController, 'readEikonaBatchMembers' | 'readEikonaReview' | 'readEikonaCandidateImage' | 'selectEikonaCandidate' | 'refresh'>> }): ReactNode {
  const summary = receipt.owner === 'eikona' && receipt.actionId === 'candidate.adopt' && receipt.status === 'completed'
    ? t('receipt.eikonaAdopted')
    : receipt.owner === 'eikona' && receipt.actionId === 'candidate.adopt' && ['unknown', 'reconcile_required'].includes(receipt.status)
      ? t('receipt.eikonaUnconfirmed')
    : receipt.summary ?? receipt.reconcileReason ?? receipt.receiptRef
  return <div className="cs-receipt cs-action-receipt" role="status" data-status={receipt.status}>
    <strong>{t(`receipt.${receipt.status}`)}</strong><span>{summary}</span>
    {controller.readEikonaBatchMembers && receipt.owner === 'eikona' && receipt.actionId === 'eikona.batch.submit' && /^eikona-batch:[A-Za-z0-9][A-Za-z0-9._:-]{0,114}$/u.test(receipt.receiptRef) && <EikonaBatchResults key={receipt.receiptRef} operationRef={receipt.receiptRef} runtime={controller} t={t} />}
    {controller.readEikonaReview && receipt.owner === 'eikona' && receipt.actionId === 'eikona.generation.submit' && receipt.evidenceRefs?.length === 1 && /^run_owner_[a-f0-9]{32}$/u.test(receipt.evidenceRefs[0]!) && <EikonaRunCandidates key={receipt.evidenceRefs[0]} runId={receipt.evidenceRefs[0]!} read={input => controller.readEikonaReview!(input)} {...(controller.readEikonaCandidateImage ? { readImage: (input: Parameters<NonNullable<typeof controller.readEikonaCandidateImage>>[0]) => controller.readEikonaCandidateImage!(input) } : {})} {...(controller.selectEikonaCandidate ? { select: async (input: Parameters<NonNullable<typeof controller.selectEikonaCandidate>>[0]) => { const result = await controller.selectEikonaCandidate!(input); if (result.status === 'selected') await controller.refresh?.(); return result } } : {})} t={t} />}
  </div>
}

function buildProjectionArtifactIntent(input: {
  readonly intent: ArtifactIntentV1['intent']
  readonly source: ArtifactRefV1
  readonly context: PaneContextV1
  readonly idempotencyKey: string
  readonly targetOwner?: string
  readonly targetPaneKind?: string
}): ArtifactIntentV1 {
  return { schema: 'pane.intent.v1alpha1', ...input }
}

export function CreatorProjectionProgress({ value }: { readonly value: number }): ReactNode {
  return <span className="cs-progress" aria-label={`${Math.round(value * 100)}%`}><i style={{ width: `${Math.round(value * 100)}%` }} /></span>
}

function mediaGlyph(artifact: ArtifactRefV1 | undefined, kind: string): string {
  const mediaType = artifact?.mediaType ?? ''
  if (mediaType.startsWith('image/') || kind === 'image') return '▧'
  if (mediaType.startsWith('audio/') || kind === 'audio') return '∿'
  if (mediaType.startsWith('video/') || kind === 'video' || kind === 'shot') return '▶'
  if (kind.includes('text') || kind.includes('script') || kind.includes('candidate')) return '¶'
  if (kind.includes('note') || kind.includes('context')) return '⌁'
  return '◇'
}

function handoffTargets(owner: CreatorStudioOwner): readonly CreatorStudioOwner[] {
  switch (owner) {
    case 'auctra': return ['eikona', 'sonora', 'scaena']
    case 'eikona': return ['scaena', 'anatomia']
    case 'sonora': return ['scaena', 'anatomia']
    case 'scaena': return ['anatomia']
    case 'pinax': return ['auctra', 'eikona', 'sonora', 'scaena']
    case 'anatomia': return ['scaena', 'auctra']
  }
}

export function CreatorResourceCard({
  resource,
  owner,
  projectRef,
  onIntent,
  t = defaultCreatorStudioTranslator,
}: {
  readonly resource: CreatorResourceV1
  readonly owner: CreatorStudioOwner
  readonly projectRef?: string
  readonly onIntent: (intent: ArtifactIntentV1) => void
  readonly t?: CreatorStudioTranslator
}): ReactNode {
  return <article className="cs-card" data-resource={resource.ref} data-kind={resource.kind} data-status={resource.status}>
    {(resource.artifact !== undefined || resource.waveform !== undefined) && <div className="cs-card-preview" aria-hidden="true">
      {resource.waveform === undefined
        ? mediaGlyph(resource.artifact, resource.kind)
        : <div className="cs-waveform">{resource.waveform.slice(0, 64).map((value, index) => <i key={index} style={{ height: `${Math.max(8, Math.round(value * 100))}%` }} />)}</div>}
    </div>}
    <header><h3>{resource.title}</h3><span className="cs-badge">{resource.status}</span></header>
    {resource.summary === undefined ? null : <p>{resource.summary}</p>}
    {resource.progress === undefined ? null : <CreatorProjectionProgress value={resource.progress} />}
    {resource.textPreview !== undefined && <div className="cs-diff">
      <pre data-side="before">{resource.textPreview.before ?? t('resource.beforeMissing')}</pre><pre data-side="after">{resource.textPreview.after ?? t('resource.afterMissing')}</pre>
    </div>}
    <div className="cs-badges">{projectRef === undefined ? null : <span className="cs-badge">{projectRef}</span>}{resource.partial === true && <span className="cs-badge">partial</span>}{resource.badges?.map(badge => <span className="cs-badge" key={badge}>{badge}</span>)}</div>
    <div className="cs-metrics">{resource.metrics?.map(metric => <span className="cs-metric" data-tone={metric.tone ?? 'neutral'} key={`${metric.label}:${metric.value}`}>{metric.label} {metric.value}</span>)}</div>
    {resource.artifact !== undefined && <div className="cs-actions">
      {resource.artifact.capabilities.includes('open') && <Button className="cs-button" size="sm" variant="toolbar" type="button" onClick={() => onIntent(buildProjectionArtifactIntent({ intent: 'open', source: resource.artifact!, context: { workspaceRef: 'workspace:artifact', revision: resource.artifact!.version }, idempotencyKey: `open-${resource.artifact!.ref}-${resource.artifact!.version}` }))}>{t('action.open')}</Button>}
      {handoffTargets(owner).slice(0, 2).map(target => <Button className="cs-button" size="sm" variant="toolbar" type="button" key={target} onClick={() => onIntent(buildProjectionArtifactIntent({ intent: owner === 'pinax' ? 'attach_context' : 'handoff', source: resource.artifact!, targetOwner: target, targetPaneKind: target === 'eikona' ? 'creator.visual' : target === 'sonora' ? 'creator.audio' : target === 'scaena' ? 'creator.production' : target === 'anatomia' ? 'creator.analysis' : 'creator.text', context: { workspaceRef: 'workspace:artifact', revision: resource.artifact!.version }, idempotencyKey: `${owner}-${target}-${resource.artifact!.ref}-${resource.artifact!.version}` }))}>{t('action.handoff', { owner: target })}</Button>)}
    </div>}
  </article>
}

function fieldHasValue(value: PaneActionValueV1 | undefined): boolean {
  if (value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

function ActionField({ field, value, artifacts, onChange, t }: { field: PaneActionDescriptorV1['fields'][number]; value: PaneActionValueV1 | undefined; artifacts: readonly ArtifactRefV1[]; onChange(value: PaneActionValueV1 | undefined): void; t: CreatorStudioTranslator }): ReactNode {
  if (field.kind === 'boolean') return <label className="cs-confirm"><input type="checkbox" checked={value === true} onChange={event => onChange(event.currentTarget.checked)} /><span>{field.label}</span></label>
  if (field.kind === 'select') return <label className="cs-field ys-field"><span>{field.label}</span><select value={typeof value === 'string' ? value : ''} required={field.required} onChange={event => onChange(event.currentTarget.value)}><option value="">{t('action.choose')}</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
  if (field.kind === 'multiselect') {
    const selected = Array.isArray(value) ? value : []
    return <fieldset className="cs-field ys-field"><legend>{field.label}</legend>{field.options?.map(option => <label className="cs-confirm" key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={event => onChange(event.currentTarget.checked ? [...selected, option.value] : selected.filter(item => item !== option.value))} /><span>{option.label}</span></label>)}</fieldset>
  }
  if (field.kind === 'artifact_ref') {
    const selected = typeof value === 'object' && value !== null && !Array.isArray(value) ? `${value.owner}:${value.ref}:${value.version}` : ''
    const available = artifacts.filter(artifact => field.artifactKinds === undefined || field.artifactKinds.includes(artifact.kind))
    return <label className="cs-field ys-field"><span>{field.label}</span><select value={selected} required={field.required} onChange={event => onChange(available.find(artifact => `${artifact.owner}:${artifact.ref}:${artifact.version}` === event.currentTarget.value))}><option value="">{t('action.chooseArtifact')}</option>{available.map(artifact => <option key={`${artifact.owner}:${artifact.ref}:${artifact.version}`} value={`${artifact.owner}:${artifact.ref}:${artifact.version}`}>{artifact.title}</option>)}</select></label>
  }
  if (field.kind === 'number') return <label className="cs-field ys-field"><span>{field.label}</span><input type="number" value={typeof value === 'number' ? value : ''} min={field.min} max={field.max} required={field.required} onChange={event => onChange(event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value))} /></label>
  const common = { value: typeof value === 'string' ? value : '', placeholder: field.placeholder, minLength: field.minLength, maxLength: field.maxLength, required: field.required, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.currentTarget.value) }
  return <label className="cs-field ys-field"><span>{field.label}</span>{field.kind === 'textarea' ? <textarea {...common} /> : <input type="text" {...common} />}</label>
}

/** Seed the canonical model only when the owner explicitly offers that model field/value. */
function initialActionValues(descriptor: PaneActionDescriptorV1 | undefined, initial?: Readonly<Record<string, PaneActionValueV1>>): Readonly<Record<string, PaneActionValueV1>> {
  const values = { ...initial }
  for (const field of descriptor?.fields ?? []) {
    // Model selection has its own explicit canonical-default policy below.
    if (field.key === 'model') continue
    if (values[field.key] !== undefined) continue
    if (field.kind === 'select' && field.options?.length === 1) values[field.key] = field.options[0]!.value
    if (field.kind === 'number' && field.min !== undefined && field.min === field.max) values[field.key] = field.min
  }
  if (descriptor?.owner !== 'eikona' || descriptor.presentation?.task !== 'image') return values
  const field = descriptor.fields.find(item => item.key === 'model')
  const model = 'openai/gpt-5.4-image-2'
  if (field?.kind === 'select' && values.model === undefined && field.options?.some(option => option.value === model)) values.model = model
  return values
}

export function CreatorActionComposer({
  owner,
  task,
  snapshot,
  state,
  controller,
  onDirty,
  t = defaultCreatorStudioTranslator,
  descriptorRef,
  presentationGroup,
  initialValues,
  retainValuesOnPartial = false,
  retainValuesOnAccepted = false,
  onReceipt,
  lockedValueKeys = [],
  executionBlocked = false,
}: {
  readonly owner: CreatorOwnerProjectionV1
  readonly task: CreatorStudioTask
  readonly snapshot: CreatorStudioSnapshotV1
  readonly state: CreatorStudioViewState
  readonly controller: Pick<CreatorStudioRuntimeV1, 'dispatchAction' | 'reconcileAction' | 'hasUnresolvedAction'> & Partial<Pick<import('./controller.ts').CreatorStudioController, 'readEikonaBatchMembers' | 'readEikonaReview' | 'readEikonaCandidateImage' | 'selectEikonaCandidate' | 'refresh'>>
  readonly onDirty?: (dirty: boolean) => void
  readonly t?: CreatorStudioTranslator
  /** Pins a server-authored descriptor for an embedded lifecycle action. */
  readonly descriptorRef?: string
  /** Limits the versions/export composers to one owner presentation group. */
  readonly presentationGroup?: string
  /** Ephemeral values supplied by the current editor; never persisted locally. */
  readonly initialValues?: Readonly<Record<string, PaneActionValueV1>>
  /** Lifecycle editors retain local input when the owner reports partial settlement. */
  readonly retainValuesOnPartial?: boolean
  /** Keep values after an owner acceptance when a second Host receipt is still required. */
  readonly retainValuesOnAccepted?: boolean
  readonly onReceipt?: (receipt: PaneActionReceiptV1) => void
  /** Owner-bound selection/body values are rendered by their dedicated control, not editable again in the generic form. */
  readonly lockedValueKeys?: readonly string[]
  /** A lifecycle submission is unresolved; reconciliation remains available. */
  readonly executionBlocked?: boolean
}): ReactNode {
  const descriptors = descriptorRef === undefined
    ? owner.actions.filter(action => (action.presentation?.task === task || action.presentation?.task === undefined)
      && (presentationGroup === undefined || action.presentation?.group === presentationGroup))
    : owner.actions.filter(action => action.descriptorRef === descriptorRef)
  const [selectedRef, setSelectedRef] = useState<string | undefined>(descriptors[0]?.descriptorRef)
  const descriptor = descriptors.find(item => item.descriptorRef === selectedRef) ?? descriptors[0]
  const [values, setValues] = useState<Readonly<Record<string, PaneActionValueV1>>>(() => initialActionValues(descriptor, initialValues))
  const [confirmed, setConfirmed] = useState<string | false>(false)
  const reconcileFlight = useRef<Promise<void> | undefined>(undefined)
  const reconcileMounted = useRef(true)
  useEffect(() => { reconcileMounted.current = true; return () => { reconcileMounted.current = false } }, [])
  const scopeKey = JSON.stringify([snapshot.context?.tenantRef, snapshot.context?.workspaceRef, snapshot.context?.projectRef,
    snapshot.context?.principalRef, owner.owner, task, descriptorRef, presentationGroup, descriptor?.descriptorRef])
  const activeScope = useRef(scopeKey)
  const drafts = useRef(new Map<string, Readonly<Record<string, PaneActionValueV1>>>())
  if (activeScope.current !== scopeKey) {
    // Reset before committing the new scope, so old values cannot appear in a
    // new project's form. Keep only ephemeral drafts for a later return.
    drafts.current.set(activeScope.current, values)
    activeScope.current = scopeKey
    const previous = drafts.current.get(scopeKey)
    setValues(previous ?? initialActionValues(descriptor, initialValues))
    setSelectedRef(descriptor?.descriptorRef)
    setConfirmed(false)
  }
  const lockedValueSignature = lockedValueKeys.join('\u0000')
  useEffect(() => {
    setValues(current => {
      const next = { ...current }
      for (const key of lockedValueKeys) {
        const value = initialValues?.[key]
        if (value === undefined) delete next[key]
        else next[key] = value
      }
      return next
    })
  }, [initialValues, lockedValueSignature])
  const dirty = Object.keys(values).length > 0
  useEffect(() => { onDirty?.(dirty); return () => onDirty?.(false) }, [dirty, onDirty])
  const artifacts = snapshot.owners.flatMap(item => item.resources.flatMap(resource => resource.artifact === undefined ? [] : [resource.artifact]))
  if (descriptor === undefined) return <aside className="cs-composer">
    <SurfaceState phase="disabled" title={t('action.unavailable.title', { owner: owner.owner })} description={t('action.unavailable.description')} data-action-unavailable />
    {state.lastReceipt?.owner === owner.owner && <ActionReceiptFeedback receipt={state.lastReceipt} t={t} controller={controller} />}
  </aside>
  const requiredMissing = descriptor.fields.some(field => field.required && !fieldHasValue(values[field.key]))
  const stale = owner.status !== 'ready' || owner.freshness !== 'fresh' || Date.parse(descriptor.expiresAt) <= Date.now()
    || descriptor.context.workspaceRef !== snapshot.context?.workspaceRef || descriptor.context.projectRef !== snapshot.context?.projectRef
  const confirmationSignature = JSON.stringify([descriptor, values])
  const confirmationMissing = descriptor.confirmation !== 'none' && confirmed !== confirmationSignature
  const pending = state.pendingDescriptorRef === descriptor.descriptorRef
  const unresolved = controller.hasUnresolvedAction?.(descriptor) === true
  const disabled = stale || confirmationMissing || requiredMissing || pending || executionBlocked || unresolved
  const disabledReason = stale ? t('action.stale') : pending || executionBlocked ? t('action.disabled.pending') : unresolved ? t('action.disabled.unresolved') : requiredMissing ? t('action.disabled.required') : confirmationMissing ? t('action.disabled.confirmation') : undefined
  const submit = async (): Promise<void> => {
    if (disabled) return
    const submittedValues = values
    const submittedScope = scopeKey
    const receipt = await controller.dispatchAction(descriptor, submittedValues)
    if (activeScope.current !== submittedScope) return
    onReceipt?.(receipt)
    if (((receipt.status === 'accepted' || receipt.status === 'completed') && !retainValuesOnAccepted) || (receipt.status === 'partial' && !retainValuesOnPartial)) {
      setValues(current => current === submittedValues ? initialActionValues(descriptor) : current)
      setConfirmed(false)
    }
  }
  return <aside className="cs-composer" data-action-composer={descriptor.actionId}>
    <header><div><h3>{descriptor.label}</h3><p className="cs-muted">{descriptor.preview.summary}</p></div><span className="cs-badge" data-risk={descriptor.risk}>{descriptor.risk}</span></header>
    {descriptors.length > 1 && <label className="cs-field ys-field"><span>{t('action.label')}</span><select value={descriptor.descriptorRef} onChange={event => { setSelectedRef(event.currentTarget.value); setConfirmed(false) }}>{descriptors.map(item => <option key={item.descriptorRef} value={item.descriptorRef}>{item.label}</option>)}</select></label>}
    <div className="cs-metric" data-cost-state={descriptor.preview.cost === undefined ? 'unknown' : descriptor.preview.cost.estimate ? 'estimated' : 'quoted'} data-tone="warning">{descriptor.preview.cost === undefined ? t('action.costUnknown') : t(descriptor.preview.cost.estimate ? 'action.estimatedCost' : 'action.quotedCost', { currency: descriptor.preview.cost.currency, amount: descriptor.preview.cost.amount })}</div>
    {descriptor.preview.rights !== undefined && <div className="cs-receipt" data-status={descriptor.preview.rights.status}>{descriptor.preview.rights.summary}</div>}
    {descriptor.fields.filter(field => !lockedValueKeys.includes(field.key)).map(field => <ActionField key={field.key} field={field} value={values[field.key]} artifacts={artifacts} t={t} onChange={value => setValues(current => value === undefined ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== field.key)) : { ...current, [field.key]: value })} />)}
    {descriptor.confirmation !== 'none' && <label className="cs-confirm"><input type="checkbox" checked={confirmed === confirmationSignature} onChange={event => setConfirmed(event.currentTarget.checked ? confirmationSignature : false)} /><span>{t(descriptor.confirmation === 'approval' ? 'action.confirmApproval' : 'action.confirmMutation')}</span></label>}
    {disabledReason === undefined ? null : <p className={stale ? 'cs-alert' : 'cs-disabled-reason'} role="status">{disabledReason}</p>}
    <span data-risk={descriptor.risk}><Button className="cs-button vk-btn" data-primary="true" size="sm" variant="primary" type="button" disabled={disabled} title={disabledReason} onClick={() => void submit()}>{pending ? t('action.pending') : t(descriptor.confirmation === 'approval' ? 'action.submitApproval' : 'action.execute')}</Button></span>
    {state.lastReceipt?.owner === descriptor.owner && state.lastReceipt.actionId === descriptor.actionId
      && ['unknown', 'reconcile_required', 'pending', 'partial'].includes(state.lastReceipt.status) && <Button className="cs-button vk-btn" type="button"
        disabled={controller.reconcileAction === undefined || pending} title={controller.reconcileAction === undefined ? t('action.reconcileUnavailable') : undefined}
        onClick={() => {
          if (reconcileFlight.current !== undefined || controller.reconcileAction === undefined) return
          const submittedScope = scopeKey
          const flight = Promise.resolve().then(() => controller.reconcileAction!(descriptor)).then(receipt => {
            if (reconcileMounted.current && activeScope.current === submittedScope) onReceipt?.(receipt)
          }).catch(() => { /* Keep the original operation unresolved; never redispatch. */ }).finally(() => { if (reconcileFlight.current === flight) reconcileFlight.current = undefined })
          reconcileFlight.current = flight
        }}>{t('action.reconcile')}</Button>}
    {state.lastReceipt?.actionId === descriptor.actionId && <ActionReceiptFeedback receipt={state.lastReceipt} t={t} controller={controller} />}
  </aside>
}

export function CreatorReviewList({ snapshot, limit, t = defaultCreatorStudioTranslator }: { readonly snapshot: CreatorStudioSnapshotV1; readonly limit?: number; readonly t?: CreatorStudioTranslator }): ReactNode {
  const reviews = limit === undefined ? snapshot.reviews : snapshot.reviews.slice(0, limit)
  return <SurfaceSection className="cs-section" title={t('review.title')} description={t('review.description')} meta={<span className="cs-badge">{snapshot.reviews.length}</span>} data-review-list>
    {reviews.length === 0 ? <SurfaceState className="cs-empty" phase="empty" title={t('review.empty')} /> : <ul className="cs-list ys-list">{reviews.map(review => <li className="ys-row" key={review.ref}><i className="cs-status-dot" data-status={review.status} /><span className="ys-row-main"><strong>{review.title}</strong><small>{review.owner} · {review.summary ?? review.status}</small></span><span className="cs-badge">{review.risk}</span></li>)}</ul>}
  </SurfaceSection>
}

export function CreatorGenerationView({ snapshot, legacyKind = false, t = defaultCreatorStudioTranslator }: { readonly snapshot: CreatorStudioSnapshotV1; readonly legacyKind?: boolean; readonly t?: CreatorStudioTranslator }): ReactNode {
  const legacy = snapshot.generationRuns === undefined
  const runs = snapshot.generationRuns ?? []
  return <div className="cs-body ys-body" data-creator-generation data-legacy={legacy || legacyKind}><SurfaceSection className="cs-section" title={t('generation.title')} description={legacy ? t('generation.legacy.description') : snapshot.operations?.safeMessage ?? t('generation.unavailable')} meta={<span className="cs-badge">{legacy ? snapshot.jobs.length : runs.length}</span>}>
    {legacy
      ? snapshot.jobs.length === 0 ? <SurfaceState phase="empty" title={t('generation.legacyEmpty')} /> : <ul className="cs-list ys-list">{snapshot.jobs.map(job => <li className="ys-row" key={job.ref}><i className="cs-status-dot" data-status={job.status} /><span className="ys-row-main"><strong>{job.title}</strong><small>legacy · {job.owner} · {job.summary ?? job.status}</small>{job.progress === undefined ? null : <CreatorProjectionProgress value={job.progress} />}</span><span className="cs-badge">{job.status}</span></li>)}</ul>
      : runs.length === 0 ? <SurfaceState phase="empty" title={t('generation.empty')} /> : <ul className="cs-list ys-list">{runs.map(run => <li className="ys-row" key={run.ref}><i className="cs-status-dot" data-status={run.freshness === 'fresh' ? 'running' : 'stale'} /><span className="ys-row-main"><strong>{run.title}</strong><small>{run.state} · {t('generation.stats', { done: run.completedTaskCount, total: run.taskCount, attention: run.attentionCount })}</small><CreatorProjectionProgress value={run.taskCount === 0 ? 0 : run.completedTaskCount / run.taskCount} /></span><span className="cs-badge">{run.freshness}</span></li>)}</ul>}
  </SurfaceSection></div>
}

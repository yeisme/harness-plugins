import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ArtifactIntentV1,
  ArtifactRefV1,
  PaneActionDescriptorV1,
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

export function CreatorActionComposer({
  owner,
  task,
  snapshot,
  state,
  controller,
  onDirty,
  t = defaultCreatorStudioTranslator,
}: {
  readonly owner: CreatorOwnerProjectionV1
  readonly task: CreatorStudioTask
  readonly snapshot: CreatorStudioSnapshotV1
  readonly state: CreatorStudioViewState
  readonly controller: Pick<CreatorStudioRuntimeV1, 'dispatchAction'>
  readonly onDirty?: (dirty: boolean) => void
  readonly t?: CreatorStudioTranslator
}): ReactNode {
  const descriptors = owner.actions.filter(action => action.presentation?.task === task || action.presentation?.task === undefined)
  const [selectedRef, setSelectedRef] = useState<string | undefined>(descriptors[0]?.descriptorRef)
  const descriptor = descriptors.find(item => item.descriptorRef === selectedRef) ?? descriptors[0]
  const [values, setValues] = useState<Readonly<Record<string, PaneActionValueV1>>>({})
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => { setSelectedRef(descriptors[0]?.descriptorRef); setValues({}); setConfirmed(false) }, [owner.snapshotRef, task])
  const dirty = Object.keys(values).length > 0
  useEffect(() => { onDirty?.(dirty); return () => onDirty?.(false) }, [dirty, onDirty])
  const artifacts = snapshot.owners.flatMap(item => item.resources.flatMap(resource => resource.artifact === undefined ? [] : [resource.artifact]))
  if (descriptor === undefined) return <SurfaceState className="cs-composer" phase="disabled" title={t('action.unavailable.title', { owner: owner.owner })} description={t('action.unavailable.description')} data-action-unavailable />
  const requiredMissing = descriptor.fields.some(field => field.required && !fieldHasValue(values[field.key]))
  const stale = owner.status !== 'ready' || owner.freshness !== 'fresh' || Date.parse(descriptor.expiresAt) <= Date.now()
  const confirmationMissing = descriptor.confirmation !== 'none' && !confirmed
  const pending = state.pendingDescriptorRef === descriptor.descriptorRef
  const disabled = stale || confirmationMissing || requiredMissing || pending
  const disabledReason = stale ? t('action.stale') : pending ? t('action.disabled.pending') : requiredMissing ? t('action.disabled.required') : confirmationMissing ? t('action.disabled.confirmation') : undefined
  const submit = async (): Promise<void> => {
    const receipt = await controller.dispatchAction(descriptor, values)
    if (receipt.status === 'accepted' || receipt.status === 'completed' || receipt.status === 'partial') {
      setValues({})
      setConfirmed(false)
      onDirty?.(false)
    }
  }
  return <aside className="cs-composer" data-action-composer={descriptor.actionId}>
    <header><div><h3>{descriptor.label}</h3><p className="cs-muted">{descriptor.preview.summary}</p></div><span className="cs-badge" data-risk={descriptor.risk}>{descriptor.risk}</span></header>
    {descriptors.length > 1 && <label className="cs-field ys-field"><span>{t('action.label')}</span><select value={descriptor.descriptorRef} onChange={event => { setSelectedRef(event.currentTarget.value); setValues({}); setConfirmed(false) }}>{descriptors.map(item => <option key={item.descriptorRef} value={item.descriptorRef}>{item.label}</option>)}</select></label>}
    {descriptor.preview.cost !== undefined && <div className="cs-metric" data-tone="warning">{t('action.estimatedCost', { currency: descriptor.preview.cost.currency, amount: descriptor.preview.cost.amount })}</div>}
    {descriptor.preview.rights !== undefined && <div className="cs-receipt" data-status={descriptor.preview.rights.status}>{descriptor.preview.rights.summary}</div>}
    {descriptor.fields.map(field => <ActionField key={field.key} field={field} value={values[field.key]} artifacts={artifacts} t={t} onChange={value => setValues(current => value === undefined ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== field.key)) : { ...current, [field.key]: value })} />)}
    {descriptor.confirmation !== 'none' && <label className="cs-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.currentTarget.checked)} /><span>{t(descriptor.confirmation === 'approval' ? 'action.confirmApproval' : 'action.confirmMutation')}</span></label>}
    {disabledReason === undefined ? null : <p className={stale ? 'cs-alert' : 'cs-disabled-reason'} role="status">{disabledReason}</p>}
    <span data-risk={descriptor.risk}><Button className="cs-button" size="sm" variant="primary" type="button" disabled={disabled} title={disabledReason} onClick={() => void submit()}>{pending ? t('action.pending') : t(descriptor.confirmation === 'approval' ? 'action.submitApproval' : 'action.execute')}</Button></span>
    {state.lastReceipt?.actionId === descriptor.actionId && <div className="cs-receipt" data-status={state.lastReceipt.status}><strong>{state.lastReceipt.status}</strong><span>{state.lastReceipt.summary ?? state.lastReceipt.reconcileReason ?? state.lastReceipt.receiptRef}</span></div>}
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

import { useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ArtifactIntentV1,
  ArtifactRefV1,
  PaneActionDescriptorV1,
  PaneActionReceiptV1,
  PaneActionValueV1,
} from '@yeisme/dsh-pane-protocol'
import type {
  CreatorApprovalV1,
  CreatorAssetScopeV1,
  CreatorOwnerProjectionV1,
  CreatorResourceV1,
  CreatorStudioOwner,
  CreatorStudioSnapshotV1,
  CreatorStudioTask,
} from '@yeisme/dsh-creator-studio-host/contracts'
import { buildArtifactIntent } from '@yeisme/dsh-client-ui-pane-workbench'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'
import { MediaPreviewPane, type MediaRefV1 } from '@yeisme/dsh-rich-media/client'
import { CreatorStudioController, type CreatorStudioViewState } from './controller.ts'
import type { CreatorStudioRuntimeV1 } from './runtime.ts'
import {
  CreatorActionComposer as SharedCreatorActionComposer,
  CreatorGenerationView as SharedCreatorGenerationView,
  CreatorProjectionProgress,
  CreatorResourceCard as SharedCreatorResourceCard,
  CreatorReviewList as SharedCreatorReviewList,
} from './projection-components.tsx'
import {
  defaultCreatorStudioTranslator,
  type CreatorStudioKey,
  type CreatorStudioTranslator,
} from './locales.ts'
import { creatorStudioStyles } from './styles.ts'

export type CreatorStudioViewMode = 'home' | 'text' | 'visual' | 'audio' | 'production' | 'context' | 'assets' | 'analysis' | 'generation' | 'approvals' | 'review' | 'jobs'

export interface CreatorPaneFace {
  openView(request: unknown): void
  dispatchIntent?(intent: unknown): Promise<PaneActionReceiptV1>
  readonly controller?: { dispatch(intent: unknown): unknown }
  readonly views?: { has(kind: string): boolean }
}

export const CREATOR_TASK_VIEWS = [
  { mode: 'text', task: 'text', owner: 'auctra', labelKey: 'mode.text', descriptionKey: 'home.text.description', glyph: '文', kind: 'creator.text' },
  { mode: 'visual', task: 'image', owner: 'eikona', labelKey: 'mode.visual', descriptionKey: 'home.visual.description', glyph: '图', kind: 'creator.visual' },
  { mode: 'audio', task: 'audio', owner: 'sonora', labelKey: 'mode.audio', descriptionKey: 'home.audio.description', glyph: '声', kind: 'creator.audio' },
  { mode: 'production', task: 'video', owner: 'scaena', labelKey: 'mode.production', descriptionKey: 'home.production.description', glyph: '剧', kind: 'creator.production' },
] as const

export const CREATOR_LIFECYCLE_GROUPS = [
  { id: 'start', labelKey: 'lifecycle.start', modes: ['home'] },
  { id: 'create', labelKey: 'lifecycle.create', modes: ['text', 'visual', 'audio'] },
  { id: 'produce', labelKey: 'lifecycle.produce', modes: ['production', 'generation'] },
  { id: 'review', labelKey: 'lifecycle.review', modes: ['approvals', 'analysis'] },
  { id: 'library', labelKey: 'lifecycle.library', modes: ['context', 'assets'] },
] as const

const MODE_META: Record<CreatorStudioViewMode, { titleKey: CreatorStudioKey; descriptionKey: CreatorStudioKey; owner?: CreatorStudioOwner; task?: CreatorStudioTask }> = {
  home: { titleKey: 'mode.home', descriptionKey: 'home.description' },
  text: { titleKey: 'mode.text', descriptionKey: 'mode.text.description', owner: 'auctra', task: 'text' },
  visual: { titleKey: 'mode.visual', descriptionKey: 'mode.visual.description', owner: 'eikona', task: 'image' },
  audio: { titleKey: 'mode.audio', descriptionKey: 'mode.audio.description', owner: 'sonora', task: 'audio' },
  production: { titleKey: 'mode.production', descriptionKey: 'mode.production.description', owner: 'scaena', task: 'video' },
  context: { titleKey: 'mode.context', descriptionKey: 'mode.context.description', owner: 'pinax', task: 'context' },
  assets: { titleKey: 'mode.assets', descriptionKey: 'mode.assets.description', task: 'assets' },
  analysis: { titleKey: 'mode.analysis', descriptionKey: 'mode.analysis.description', owner: 'anatomia', task: 'analysis' },
  generation: { titleKey: 'mode.generation', descriptionKey: 'mode.generation.description', task: 'generation' },
  approvals: { titleKey: 'mode.approvals', descriptionKey: 'mode.approvals.description', task: 'approval' },
  review: { titleKey: 'mode.reviewLegacy', descriptionKey: 'mode.reviewLegacy.description', task: 'review' },
  jobs: { titleKey: 'mode.jobsLegacy', descriptionKey: 'mode.jobsLegacy.description', task: 'operations' },
}

function canonicalMode(mode: CreatorStudioViewMode): CreatorStudioViewMode {
  if (mode === 'jobs') return 'generation'
  if (mode === 'review') return 'approvals'
  return mode
}

function ownerOf(snapshot: CreatorStudioSnapshotV1 | null, owner: CreatorStudioOwner | undefined): CreatorOwnerProjectionV1 | undefined {
  return owner === undefined ? undefined : snapshot?.owners.find(item => item.owner === owner)
}

function OwnerStatus({ owner }: { owner: CreatorOwnerProjectionV1 }): ReactNode {
  return <div className="cs-owner-row ys-row" data-owner={owner.owner}>
    <i className="cs-status-dot" data-status={owner.status} aria-label={owner.status} />
    <span className="ys-row-main"><strong>{owner.owner[0]!.toUpperCase() + owner.owner.slice(1)}</strong><small>{owner.summary}</small></span>
  </div>
}

function OwnerStatusPanel({ owners, t }: { owners: readonly CreatorOwnerProjectionV1[]; t: CreatorStudioTranslator }): ReactNode {
  const ready = owners.filter(owner => owner.status === 'ready').length
  return <details className="cs-owner-status-panel" data-owner-status-panel>
    <summary><span>{t('owner.status')}</span><strong>{t('owner.status.summary', { ready, total: owners.length })}</strong></summary>
    <p>{t('owner.status.description')}</p>
    <div className="cs-owner-list ys-list">{owners.map(owner => <OwnerStatus key={owner.owner} owner={owner} />)}</div>
  </details>
}

function ProductionPulse({ snapshot, t }: { snapshot: CreatorStudioSnapshotV1; t: CreatorStudioTranslator }): ReactNode {
  const production = snapshot.production
  if (production === undefined) return <SurfaceState className="cs-pulse" phase="empty" title={t('production.unavailable.title')} description={t('production.unavailable.description')} data-production-empty />
  return <SurfaceSection className="cs-pulse" title={production.title} description={t('production.currentStage', { stage: production.currentStage })} meta={<span className="cs-badge">v{production.version}</span>} data-production={production.ref}>
    <div className="cs-stage-track">
      {production.stages.map(stage => <div className="cs-stage" key={stage.id} data-current={stage.id === production.currentStage} data-status={stage.status}>
        <strong>{stage.label}</strong><small>{stage.status}{stage.itemCount === undefined ? '' : ` · ${stage.itemCount}`}</small><CreatorProjectionProgress value={stage.progress} />
      </div>)}
    </div>
    {production.blockers.length > 0 && <ul className="cs-list ys-list" aria-label={t('production.blockers')}>
      {production.blockers.map(blocker => <li className="ys-row" key={blocker.ref}><i className="cs-status-dot" data-status={blocker.severity === 'critical' ? 'failed' : 'partial'} /><span className="ys-row-main"><strong>{blocker.title}</strong><small>{blocker.summary}</small></span><span className="cs-badge">{blocker.severity}</span></li>)}
    </ul>}
  </SurfaceSection>
}

function QuickCreate({ onOpenMode, onOpenDrama, onOpenShowControl, t }: { onOpenMode(mode: CreatorStudioViewMode): void; onOpenDrama?(): void; onOpenShowControl?(): void; t: CreatorStudioTranslator }): ReactNode {
  return <SurfaceSection className="cs-section" title={t('home.next.title')} description={t('home.next.description')} aria-label={t('home.next.title')}>
    <div className="cs-quick-grid">
      {CREATOR_TASK_VIEWS.map(item => <Button key={item.mode} type="button" size="sm" variant="toolbar" className="cs-quick-card" onClick={() => item.mode === 'production' && onOpenDrama !== undefined ? onOpenDrama() : onOpenMode(item.mode)}>
        <b aria-hidden="true">{item.glyph}</b><strong>{t(item.labelKey)}</strong><span>{t(item.descriptionKey)}</span>
      </Button>)}
      <Button type="button" size="sm" variant="toolbar" className="cs-quick-card" disabled={onOpenShowControl === undefined} title={onOpenShowControl === undefined ? t('home.showControl.unavailable') : t('home.showControl')} onClick={onOpenShowControl}>
        <b aria-hidden="true">▦</b><strong>{t('home.showControl')}</strong><span>{t('home.showControl.description')}</span>
      </Button>
    </div>
  </SurfaceSection>
}

function HomeView({ snapshot, onOpenMode, onOpenDrama, onOpenShowControl, t }: { snapshot: CreatorStudioSnapshotV1; onOpenMode(mode: CreatorStudioViewMode): void; onOpenDrama?(): void; onOpenShowControl?(): void; t: CreatorStudioTranslator }): ReactNode {
  return <div className="cs-body ys-body" data-creator-home>
    <QuickCreate onOpenMode={onOpenMode} t={t} {...(onOpenDrama === undefined ? {} : { onOpenDrama })} {...(onOpenShowControl === undefined ? {} : { onOpenShowControl })} />
    <ProductionPulse snapshot={snapshot} t={t} />
    <SharedCreatorReviewList snapshot={snapshot} limit={4} t={t} />
  </div>
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

export function CreatorResourceCard({ resource, owner, projectRef, onIntent, t }: { resource: CreatorResourceV1; owner: CreatorStudioOwner; projectRef?: string; onIntent(intent: ArtifactIntentV1): void; t: CreatorStudioTranslator }): ReactNode {
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
      {resource.artifact.capabilities.includes('open') && <Button className="cs-button" size="sm" variant="toolbar" type="button" onClick={() => onIntent(buildArtifactIntent({ intent: 'open', source: resource.artifact!, context: resource.artifact === undefined ? { workspaceRef: 'workspace:unavailable', revision: '0' } : { workspaceRef: 'workspace:artifact', revision: resource.artifact.version }, idempotencyKey: `open-${resource.artifact!.ref}-${resource.artifact!.version}` }))}>{t('action.open')}</Button>}
      {handoffTargets(owner).slice(0, 2).map(target => <Button className="cs-button" size="sm" variant="toolbar" type="button" key={target} onClick={() => onIntent(buildArtifactIntent({ intent: owner === 'pinax' ? 'attach_context' : 'handoff', source: resource.artifact!, targetOwner: target, targetPaneKind: target === 'eikona' ? 'creator.visual' : target === 'sonora' ? 'creator.audio' : target === 'scaena' ? 'creator.production' : target === 'anatomia' ? 'creator.analysis' : 'creator.text', context: { workspaceRef: 'workspace:artifact', revision: resource.artifact!.version }, idempotencyKey: `${owner}-${target}-${resource.artifact!.ref}-${resource.artifact!.version}` }))}>{t('action.handoff', { owner: target })}</Button>)}
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

export function CreatorActionComposer({ owner, task, snapshot, state, controller, onDirty, t }: { owner: CreatorOwnerProjectionV1; task: CreatorStudioTask; snapshot: CreatorStudioSnapshotV1; state: CreatorStudioViewState; controller: Pick<CreatorStudioRuntimeV1, 'dispatchAction'>; onDirty?(dirty: boolean): void; t: CreatorStudioTranslator }): ReactNode {
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
  const disabledReason = stale ? t('action.stale')
    : pending ? t('action.disabled.pending')
      : requiredMissing ? t('action.disabled.required')
        : confirmationMissing ? t('action.disabled.confirmation')
          : undefined
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

export function CreatorReviewList({ snapshot, limit, t }: { snapshot: CreatorStudioSnapshotV1; limit?: number; t: CreatorStudioTranslator }): ReactNode {
  const reviews = limit === undefined ? snapshot.reviews : snapshot.reviews.slice(0, limit)
  return <SurfaceSection className="cs-section" title={t('review.title')} description={t('review.description')} meta={<span className="cs-badge">{snapshot.reviews.length}</span>} data-review-list>
    {reviews.length === 0 ? <SurfaceState className="cs-empty" phase="empty" title={t('review.empty')} /> : <ul className="cs-list ys-list">{reviews.map(review => <li className="ys-row" key={review.ref}><i className="cs-status-dot" data-status={review.status} /><span className="ys-row-main"><strong>{review.title}</strong><small>{review.owner} · {review.summary ?? review.status}</small></span><span className="cs-badge">{review.risk}</span></li>)}</ul>}
  </SurfaceSection>
}

function AssetView({ snapshot, state, controller, pane, t }: { snapshot: CreatorStudioSnapshotV1; state: CreatorStudioViewState; controller: CreatorStudioController; pane: CreatorPaneFace; t: CreatorStudioTranslator }): ReactNode {
  const [scope, setScope] = useState<CreatorAssetScopeV1>(state.assetQuery.scope)
  const [owner, setOwner] = useState<CreatorStudioOwner | ''>(state.assetQuery.owner ?? '')
  const [kind, setKind] = useState(state.assetQuery.kind ?? '')
  const [text, setText] = useState(state.assetQuery.text ?? '')
  const [intentReceipt, setIntentReceipt] = useState<PaneActionReceiptV1 | undefined>()
  useEffect(() => {
    if (state.assetPhase === 'cold') void controller.loadAssets({ scope: 'current_project' })
  }, [controller, state.assetPhase])
  const query = () => ({ scope, ...(owner === '' ? {} : { owner }), ...(kind.trim() === '' ? {} : { kind: kind.trim() }), ...(text.trim() === '' ? {} : { text: text.trim() }) })
  const onIntent = async (intent: ArtifactIntentV1): Promise<void> => {
    if (pane.dispatchIntent === undefined) return
    setIntentReceipt(await pane.dispatchIntent({ ...intent, context: snapshot.context ?? intent.context }))
  }
  return <div className="cs-body ys-body" data-creator-assets>
    <SurfaceSection className="cs-section" title={t('asset.title')} description={t('asset.description')} meta={<span className="cs-badge">{state.assetStatus ?? state.assetPhase}</span>}>
      <div className="cs-actions" role="group" aria-label={t('asset.scope')}>
        <Button className="cs-button" size="sm" variant={scope === 'current_project' ? 'primary' : 'toolbar'} type="button" onClick={() => { setScope('current_project'); void controller.loadAssets({ ...query(), scope: 'current_project' }) }}>{t('asset.currentProject')}</Button>
        <Button className="cs-button" size="sm" variant={scope === 'all_projects' ? 'primary' : 'toolbar'} type="button" onClick={() => { setScope('all_projects'); void controller.loadAssets({ ...query(), scope: 'all_projects' }) }}>{t('asset.allProjects')}</Button>
      </div>
      <div className="cs-actions">
        <label className="cs-field ys-field"><span>{t('asset.owner')}</span><select value={owner} onChange={event => setOwner(event.currentTarget.value as CreatorStudioOwner | '')}><option value="">{t('asset.allOwners')}</option>{(['eikona', 'scaena', 'sonora', 'auctra', 'pinax', 'anatomia'] as const).map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="cs-field ys-field"><span>{t('asset.kind')}</span><input value={kind} placeholder="image / audio / video" onChange={event => setKind(event.currentTarget.value)} /></label>
        <label className="cs-field ys-field"><span>{t('asset.search')}</span><input value={text} placeholder={t('asset.search.placeholder')} onChange={event => setText(event.currentTarget.value)} /></label>
        <Button className="cs-button" size="sm" variant="toolbar" type="button" onClick={() => void controller.loadAssets(query())}>{t('asset.apply')}</Button>
      </div>
      {state.assetMessage === null ? null : <p className={state.assetStatus === 'ready' ? 'cs-muted' : 'cs-alert'} role="status">{state.assetMessage}</p>}
      {state.assetPhase === 'loading' && state.assetItems.length === 0 ? <SurfaceState phase="loading" title={t('asset.loading')} />
        : state.assetPhase === 'error' && state.assetItems.length === 0 ? <SurfaceState phase="error" title={t('asset.error')} description={state.assetErrorCode ?? undefined} />
          : state.assetItems.length === 0 ? <SurfaceState phase="empty" title={t('asset.empty')} />
            : <div className="cs-resource-grid ys-grid">{state.assetItems.map(asset => <SharedCreatorResourceCard key={`${asset.owner}:${asset.projectRef}:${asset.ref}:${asset.version}`} resource={asset} owner={asset.owner} projectRef={asset.projectRef} t={t} onIntent={intent => void onIntent(intent)} />)}</div>}
      {state.assetNextCursor === null ? null : <SurfaceActionBar><Button className="cs-button" size="sm" variant="toolbar" type="button" disabled={state.assetPhase === 'loading'} onClick={() => void controller.loadAssets({ ...state.assetQuery, cursor: state.assetNextCursor! }, true)}>{t('asset.more')}</Button></SurfaceActionBar>}
      {intentReceipt === undefined ? null : <div className="cs-receipt" data-status={intentReceipt.status}>{intentReceipt.summary ?? intentReceipt.reconcileReason ?? intentReceipt.receiptRef}</div>}
    </SurfaceSection>
  </div>
}

export function CreatorGenerationView({ snapshot, legacyKind = false, t }: { snapshot: CreatorStudioSnapshotV1; legacyKind?: boolean; t: CreatorStudioTranslator }): ReactNode {
  const legacy = snapshot.generationRuns === undefined
  const runs = snapshot.generationRuns ?? []
  return <div className="cs-body ys-body" data-creator-generation data-legacy={legacy || legacyKind}><SurfaceSection className="cs-section" title={t('generation.title')} description={legacy ? t('generation.legacy.description') : snapshot.operations?.safeMessage ?? t('generation.unavailable')} meta={<span className="cs-badge">{legacy ? snapshot.jobs.length : runs.length}</span>}>
    {legacy
      ? snapshot.jobs.length === 0 ? <SurfaceState phase="empty" title={t('generation.legacyEmpty')} /> : <ul className="cs-list ys-list">{snapshot.jobs.map(job => <li className="ys-row" key={job.ref}><i className="cs-status-dot" data-status={job.status} /><span className="ys-row-main"><strong>{job.title}</strong><small>legacy · {job.owner} · {job.summary ?? job.status}</small>{job.progress === undefined ? null : <CreatorProjectionProgress value={job.progress} />}</span><span className="cs-badge">{job.status}</span></li>)}</ul>
      : runs.length === 0 ? <SurfaceState phase="empty" title={t('generation.empty')} /> : <ul className="cs-list ys-list">{runs.map(run => <li className="ys-row" key={run.ref}><i className="cs-status-dot" data-status={run.freshness === 'fresh' ? 'running' : 'stale'} /><span className="ys-row-main"><strong>{run.title}</strong><small>{run.state} · {t('generation.stats', { done: run.completedTaskCount, total: run.taskCount, attention: run.attentionCount })}</small><CreatorProjectionProgress value={run.taskCount === 0 ? 0 : run.completedTaskCount / run.taskCount} /></span><span className="cs-badge">{run.freshness}</span></li>)}</ul>}
  </SurfaceSection></div>
}

function approvalDisabled(approval: CreatorApprovalV1, state: CreatorStudioViewState, snapshot: CreatorStudioSnapshotV1): boolean {
  return approval.status !== 'pending'
    || Date.parse(approval.expiresAt) <= Date.now()
    || state.pendingApprovalRef !== null
    || snapshot.operations?.status !== 'ready'
    || snapshot.operations.freshness !== 'fresh'
}

function ApprovalsView({ snapshot, state, controller, legacyKind = false, t }: { snapshot: CreatorStudioSnapshotV1; state: CreatorStudioViewState; controller: CreatorStudioController; legacyKind?: boolean; t: CreatorStudioTranslator }): ReactNode {
  const legacy = snapshot.approvals === undefined
  if (legacy) return <div className="cs-body ys-body" data-creator-approvals data-legacy="true"><SurfaceState phase="stale" title={t('approval.legacy')} /><SharedCreatorReviewList snapshot={snapshot} t={t} /></div>
  return <div className="cs-body ys-body" data-creator-approvals data-legacy={legacyKind}><SurfaceSection className="cs-section" title={t('mode.approvals')} description={snapshot.operations?.safeMessage ?? t('approval.unavailable')} meta={<span className="cs-badge">{snapshot.approvals.length}</span>}>
    {snapshot.approvals.length === 0 ? <SurfaceState phase="empty" title={t('approval.empty')} /> : <ul className="cs-list ys-list">{snapshot.approvals.map(approval => <li className="ys-row" key={approval.ref}><i className="cs-status-dot" data-status={approval.status} /><span className="ys-row-main"><strong>{approval.title}</strong><small>{approval.ownerRef} · {approval.targetRef}@{approval.targetVersion}</small></span><Button className="cs-button" size="sm" variant="toolbar" type="button" disabled={approvalDisabled(approval, state, snapshot)} onClick={() => void controller.decideApproval(approval.ref)}>{state.pendingApprovalRef === approval.ref ? t('approval.pending') : t('approval.approve')}</Button></li>)}</ul>}
    {state.lastReceipt?.actionId === 'ordo.approval.decide' ? <div className="cs-receipt" data-status={state.lastReceipt.status}><strong>{state.lastReceipt.status}</strong><span>{state.lastReceipt.summary ?? state.lastReceipt.reconcileReason ?? state.lastReceipt.receiptRef}</span></div> : null}
  </SurfaceSection></div>
}

function WorkspaceView({ meta, owner, snapshot, state, controller, pane, onDirty, t }: { meta: (typeof MODE_META)[CreatorStudioViewMode]; owner: CreatorOwnerProjectionV1; snapshot: CreatorStudioSnapshotV1; state: CreatorStudioViewState; controller: CreatorStudioController; pane: CreatorPaneFace; onDirty?(dirty: boolean): void; t: CreatorStudioTranslator }): ReactNode {
  const [intentReceipt, setIntentReceipt] = useState<PaneActionReceiptV1 | undefined>()
  const onIntent = async (intent: ArtifactIntentV1): Promise<void> => {
    if (pane.dispatchIntent === undefined) return
    setIntentReceipt(await pane.dispatchIntent({ ...intent, context: snapshot.context ?? intent.context }))
  }
  return <div className="cs-body ys-body" data-owner-workspace={owner.owner}>
    {owner.status !== 'ready' && <SurfaceState phase={owner.freshness === 'stale' ? 'stale' : 'partial'} title={owner.summary} description={owner.status} />}
    <div className="cs-workspace-grid">
      <SurfaceSection className="cs-section" title={t(meta.titleKey)} description={t(meta.descriptionKey)} meta={<div className="cs-badges"><span className="cs-badge">{owner.transport}</span><span className="cs-badge">{owner.freshness}</span></div>}>
        {owner.resources.length === 0 ? <SurfaceState phase="empty" title={t('owner.resources.empty')} description={t('owner.resources.empty.description', { owner: owner.owner })} /> : <div className="cs-resource-grid ys-grid">{owner.resources.map(resource => <SharedCreatorResourceCard key={resource.ref} resource={resource} owner={owner.owner} t={t} onIntent={intent => void onIntent(intent)} />)}</div>}
        {intentReceipt !== undefined && <div className="cs-receipt" data-status={intentReceipt.status}>{intentReceipt.summary ?? intentReceipt.reconcileReason ?? intentReceipt.receiptRef}</div>}
      </SurfaceSection>
      {meta.task === undefined ? null : <SharedCreatorActionComposer owner={owner} task={meta.task} snapshot={snapshot} state={state} controller={controller} t={t} {...onDirty === undefined ? {} : { onDirty }} />}
    </div>
  </div>
}

export interface CreatorStudioViewProps {
  readonly mode: CreatorStudioViewMode
  readonly controller: CreatorStudioController
  readonly pane: CreatorPaneFace
  readonly onOpenMode: (mode: CreatorStudioViewMode) => void
  readonly onOpenDrama?: () => void
  readonly onOpenShowControl?: () => void
  readonly onDirty?: (dirty: boolean) => void
  readonly t?: CreatorStudioTranslator
}

function LifecycleNav({ mode, onOpenMode, onOpenDrama, t }: { mode: CreatorStudioViewMode; onOpenMode(mode: CreatorStudioViewMode): void; onOpenDrama?(): void; t: CreatorStudioTranslator }): ReactNode {
  const active = canonicalMode(mode)
  return <div className="cs-lifecycle" aria-label={t('lifecycle.aria')}>
    {CREATOR_LIFECYCLE_GROUPS.map(group => <div className="cs-lifecycle-group" data-lifecycle={group.id} key={group.id}>
      <span>{t(group.labelKey)}</span>
      <div className="cs-lifecycle-items">
        {group.modes.map(item => <span key={item} data-active={active === item}>
          <Button type="button" size="sm" variant={active === item ? 'primary' : 'toolbar'} onClick={() => item === 'production' && onOpenDrama !== undefined ? onOpenDrama() : onOpenMode(item)}>{t(MODE_META[item].titleKey)}</Button>
        </span>)}
      </div>
    </div>)}
  </div>
}

export function CreatorStudioView({ mode, controller, pane, onOpenMode, onOpenDrama, onOpenShowControl, onDirty, t = defaultCreatorStudioTranslator }: CreatorStudioViewProps): ReactNode {
  const state = useSyncExternalStore(controller.store.subscribe, controller.store.getSnapshot, controller.store.getSnapshot)
  const meta = MODE_META[mode]
  const snapshot = state.snapshot
  const owner = ownerOf(snapshot, meta.owner)
  const lifecycleNav = <LifecycleNav mode={mode} onOpenMode={onOpenMode} t={t} {...(onOpenDrama === undefined ? {} : { onOpenDrama })} />
  return <Surface kind="workspace" className="cs-shell" data-creator-studio data-mode={mode} data-phase={state.phase}>
    <style>{creatorStudioStyles}</style>
    <SurfaceContextBar
      className="cs-header"
      title="Creator Studio"
      context={t(meta.titleKey)}
      description={snapshot?.safeMessage ?? t(meta.descriptionKey)}
      status={snapshot === null ? undefined : <OwnerStatusPanel owners={snapshot.owners} t={t} />}
      actions={<Button size="sm" variant="toolbar" type="button" onClick={() => void controller.refresh()}>{t('state.refresh')}</Button>}
      nav={lifecycleNav}
    />
    {state.phase === 'loading' && snapshot !== null ? <SurfaceState className="cs-state-strip" phase="loading" title={t('state.loading')} /> : null}
    {state.phase === 'error' && snapshot !== null ? <SurfaceState className="cs-state-strip" phase="stale" title={t('state.error')} description={state.errorCode ?? undefined} action={<Button size="sm" variant="toolbar" type="button" onClick={() => void controller.refresh()}>{t('state.retry')}</Button>} /> : null}
    {state.phase === 'loading' && snapshot === null ? <div className="cs-body ys-body"><SurfaceState phase="loading" title={t('state.loading')} /></div>
      : state.phase === 'error' && snapshot === null ? <div className="cs-body ys-body"><SurfaceState phase="error" title={t('state.error')} description={state.errorCode ?? undefined} action={<Button size="sm" variant="toolbar" type="button" onClick={() => void controller.refresh()}>{t('state.retry')}</Button>} /></div>
        : snapshot === null ? <div className="cs-body ys-body"><SurfaceState phase="empty" title={t('state.cold')} /></div>
          : mode === 'home' ? <HomeView snapshot={snapshot} onOpenMode={onOpenMode} t={t} {...(onOpenDrama === undefined ? {} : { onOpenDrama })} {...(onOpenShowControl === undefined ? {} : { onOpenShowControl })} />
            : mode === 'assets' ? <AssetView snapshot={snapshot} state={state} controller={controller} pane={pane} t={t} />
              : mode === 'generation' ? <SharedCreatorGenerationView snapshot={snapshot} t={t} />
                : mode === 'jobs' ? <SharedCreatorGenerationView snapshot={snapshot} legacyKind t={t} />
                  : mode === 'approvals' ? <ApprovalsView snapshot={snapshot} state={state} controller={controller} t={t} />
                    : mode === 'review' ? <ApprovalsView snapshot={snapshot} state={state} controller={controller} legacyKind t={t} />
                      : owner === undefined ? <div className="cs-body ys-body"><SurfaceState phase="partial" title={t('state.ownerUnavailable')} /></div>
                        : <WorkspaceView meta={meta} owner={owner} snapshot={snapshot} state={state} controller={controller} pane={pane} t={t} {...onDirty === undefined ? {} : { onDirty }} />}
  </Surface>
}

function mediaKind(artifact: ArtifactRefV1): MediaRefV1['kind'] {
  if (artifact.mediaType.startsWith('image/')) return 'image'
  if (artifact.mediaType.startsWith('audio/')) return 'audio'
  if (artifact.mediaType.startsWith('video/')) return 'video'
  if (artifact.mediaType === 'application/pdf') return 'pdf'
  if (artifact.mediaType.startsWith('text/')) return 'text'
  return 'file'
}

export function CreatorMediaView({ artifact, controller, t = defaultCreatorStudioTranslator }: { artifact?: ArtifactRefV1; controller: CreatorStudioController; t?: CreatorStudioTranslator }): ReactNode {
  const media = useMemo<readonly MediaRefV1[]>(() => artifact === undefined ? [] : [{
    owner: artifact.owner,
    kind: mediaKind(artifact),
    ref: artifact.ref,
    version: artifact.version,
    mediaType: artifact.mediaType,
    title: artifact.title,
    ...(artifact.summary === undefined ? {} : { summary: artifact.summary }),
    capabilities: artifact.capabilities.filter((capability): capability is MediaRefV1['capabilities'][number] => ['play', 'download', 'extract_text', 'open', 'preview'].includes(capability)),
  }], [artifact])
  return <Surface kind="workspace" data-creator-studio data-mode="media"><style>{creatorStudioStyles}</style><MediaPreviewPane title={t('mode.media')} media={media} resolveUrl={item => controller.resolveArtifact({ ...artifact!, owner: item.owner, ref: item.ref, version: item.version }).then(url => { if (url === undefined) throw new Error(t('media.unauthorized')); return url })} /></Surface>
}

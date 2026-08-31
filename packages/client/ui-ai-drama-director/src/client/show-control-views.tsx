import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  DramaShowAssetV1,
  DramaShowControlPaneId,
  DramaShowReviewV1,
} from '@yeisme/dsh-ai-drama-director'
import type { ArtifactRefV1 } from '@yeisme/dsh-pane-protocol'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'
import {
  DramaShowControlController,
  DRAMA_SHOW_CONTROL_INITIAL_STATE,
  type DramaShowControlClientStateV1,
  type DramaReviewAnnotationKindV1,
  type DramaShowSelectionKind,
} from './show-control-controller.js'
import { DRAMA_SHOW_CONTROL_VIEW_KINDS } from './preset.js'

export interface DramaShowControlViewModel {
  readonly controller?: DramaShowControlController
  readonly disabledReason?: string
  refresh(): Promise<void>
  openArtifact(artifact: ArtifactRefV1, compare?: boolean): void
}

export interface DramaShowControlViewRegistrationV1 {
  readonly id: DramaShowControlPaneId
  readonly descriptor: {
    readonly kind: string
    readonly label: string
    readonly componentKey: string
    readonly role: 'content'
    readonly preferredRegion: 'right'
    readonly retention: 'keep-alive'
    readonly singleton: true
    readonly presentation: {
      readonly icon: string
      readonly group: 'drama.show-control'
      readonly description: string
      readonly order: number
      readonly launcher: true
    }
  }
}

const META: Record<DramaShowControlPaneId, { readonly label: string; readonly icon: string; readonly description: string; readonly order: number }> = {
  ShowBoard: { label: 'Show Board', icon: 'table', description: 'Episode stages, status, attention, and owner-gated context switch', order: 110 },
  ReviewInbox: { label: 'Review Inbox', icon: 'check', description: 'Cross-episode review filtering, compare, and batch owner actions', order: 120 },
  AssetWall: { label: 'Asset Wall', icon: 'media', description: 'Cross-episode asset browser and version comparison', order: 130 },
  Delivery: { label: 'Delivery', icon: 'package', description: 'Delivery readiness, blockers, evidence, and owner actions', order: 140 },
}

export const DRAMA_SHOW_CONTROL_VIEW_REGISTRATIONS: readonly DramaShowControlViewRegistrationV1[] = (['ShowBoard', 'ReviewInbox', 'AssetWall', 'Delivery'] as const).map(id => ({
  id,
  descriptor: {
    kind: DRAMA_SHOW_CONTROL_VIEW_KINDS[id],
    label: META[id].label,
    componentKey: `drama-show-control-${id.toLowerCase()}`,
    role: 'content',
    preferredRegion: 'right',
    retention: 'keep-alive',
    singleton: true,
    presentation: { icon: META[id].icon, group: 'drama.show-control', description: META[id].description, order: META[id].order, launcher: true },
  },
}))

const STYLES = `
[data-show-control-view]{height:100%;outline:none}
[data-show-control-view]:focus-visible{outline:2px solid var(--vk-accent);outline-offset:-2px}
[data-show-control-view] .sc-stack{display:grid;gap:12px}
[data-show-control-view] .sc-filters{display:flex;align-items:end;gap:8px;flex-wrap:wrap}
[data-show-control-view] .sc-field{display:grid;gap:4px;min-width:130px;color:var(--vk-text-tertiary);font-size:11px}
[data-show-control-view] .sc-field select,[data-show-control-view] .sc-field input{min-height:32px;padding:5px 8px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:8px}
[data-show-control-view] .sc-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}
[data-show-control-view] .sc-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--vk-border-l1);border-radius:9px;background:var(--vk-bg-layer-1)}
[data-show-control-view] .sc-main{display:grid;gap:3px;min-width:0}.sc-main strong,.sc-main small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sc-main small{color:var(--vk-text-tertiary)}
[data-show-control-view] .sc-badges,[data-show-control-view] .sc-actions{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end}
[data-show-control-view] .sc-badge{padding:2px 6px;border-radius:999px;background:var(--vk-bg-layer-2);color:var(--vk-text-tertiary);font-size:10px}
[data-show-control-view] .sc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}
[data-show-control-view] .sc-card{display:grid;gap:8px;padding:10px;border:1px solid var(--vk-border-l1);border-radius:10px;background:var(--vk-bg-layer-1)}
[data-show-control-view] .sc-progress{width:100%;accent-color:var(--vk-accent)}
[data-show-control-view] .sc-alert{padding:8px;border:1px solid color-mix(in srgb,var(--vk-tone-warn) 32%,var(--vk-border-l1));border-radius:8px;color:var(--vk-tone-warn);font-size:11px}
[data-show-control-view] .sc-receipt{display:grid;gap:3px;padding:8px;border-radius:8px;background:var(--vk-bg-layer-2);font-size:11px}
[data-show-control-view] .sc-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
[data-show-control-view] .sc-compare>[data-compare-side]{display:grid;gap:6px;padding:9px;border:1px solid var(--vk-border-l1);border-radius:9px;background:var(--vk-bg-layer-2)}
@media(max-width:390px){[data-show-control-view] .sc-row{grid-template-columns:auto minmax(0,1fr)}[data-show-control-view] .sc-row>.sc-actions{grid-column:1/-1;justify-content:flex-start}[data-show-control-view] .sc-grid{grid-template-columns:1fr}[data-show-control-view] .sc-field{min-width:100%;}}
`

function mutationDisabled(state: DramaShowControlClientStateV1): string | undefined {
  const snapshot = state.snapshot
  if (snapshot === null) return 'Show-control snapshot has not resolved.'
  if (snapshot.status !== 'ready' || snapshot.freshness !== 'fresh') return `${snapshot.status}/${snapshot.freshness}; reconcile with the owner before mutation.`
  if (state.lastReceipt?.status === 'unknown' || state.lastReceipt?.status === 'reconcile_required') return state.lastReceipt.reconcileReason ?? 'The previous settlement requires reconcile.'
  return undefined
}

function StateStrip({ state, lane }: { readonly state: DramaShowControlClientStateV1; readonly lane: 'episode' | 'review' | 'asset' | 'delivery' }): ReactNode {
  const phase = lane === 'episode' ? state.episodePhase : lane === 'review' ? state.reviewPhase : lane === 'asset' ? state.assetPhase : state.deliveryPhase
  if (phase === 'loading') return <SurfaceState phase="loading" title={`Loading ${lane} projection`} />
  if (phase === 'error') return <SurfaceState phase="error" title={`${lane} projection failed`} description={state.errorCode ?? undefined} />
  return null
}

function SelectionInput({ state, controller, kind, targetRef, version }: { readonly state: DramaShowControlClientStateV1; readonly controller: DramaShowControlController; readonly kind: DramaShowSelectionKind; readonly targetRef: string; readonly version: string }): ReactNode {
  const checked = state.selected.some(item => item.kind === kind && item.ref === targetRef && item.version === version)
  return <input aria-label={`Select ${targetRef}`} type="checkbox" checked={checked} onChange={() => controller.toggleSelection({ kind, ref: targetRef, version })} />
}

function PreviewBar({ state, controller, actionId, label }: { readonly state: DramaShowControlClientStateV1; readonly controller: DramaShowControlController; readonly actionId: string; readonly label: string }): ReactNode {
  const reason = mutationDisabled(state)
  const descriptor = state.previewDescriptor
  return <div className="sc-stack" data-show-action-preview={actionId}>
    {state.selectionMessage === null ? null : <p className="sc-alert" role="status">{state.selectionMessage}</p>}
    {descriptor === null
      ? <Button type="button" size="sm" variant="toolbar" disabled={state.selected.length === 0 || reason !== undefined} title={reason} onClick={() => void controller.previewAction(actionId)}>Preview {label} ({state.selected.length})</Button>
      : <div className="sc-receipt"><strong>{descriptor.label}</strong><span>{descriptor.preview.summary}</span><Button type="button" size="sm" variant="primary" disabled={state.pendingDescriptorRef !== null || reason !== undefined} title={reason} onClick={() => void controller.dispatchPreview()}>{state.pendingDescriptorRef === descriptor.descriptorRef ? 'Submitting…' : 'Submit once'}</Button></div>}
    {state.lastReceipt === null ? null : <div className="sc-receipt" data-status={state.lastReceipt.status}><strong>{state.lastReceipt.status} · {state.lastReceipt.receiptRef}</strong><span>{state.lastReceipt.summary ?? state.lastReceipt.reconcileReason ?? 'Owner receipt recorded.'}</span></div>}
  </div>
}

function ShowBoard({ state, controller }: { readonly state: DramaShowControlClientStateV1; readonly controller: DramaShowControlController }): ReactNode {
  const [stage, setStage] = useState(state.episodeQuery.stage ?? '')
  const [status, setStatus] = useState(state.episodeQuery.status ?? '')
  const [attention, setAttention] = useState(state.episodeQuery.attention === true)
  const apply = (): void => { void controller.loadEpisodes({ limit: 50, ...(stage === '' ? {} : { stage: stage as NonNullable<typeof state.episodeQuery.stage> }), ...(status === '' ? {} : { status: status as NonNullable<typeof state.episodeQuery.status> }), ...(attention ? { attention: true } : {}) }) }
  return <div className="sc-stack">
    <SurfaceSection title="Episode Board" description="Owner-projected episode stage, status, attention, and progress." meta={<span className="sc-badge">{state.episodeItems.length}</span>}>
      <div className="sc-filters">
        <label className="sc-field ys-field"><span>Stage</span><select value={stage} onChange={event => setStage(event.currentTarget.value)}><option value="">All stages</option>{['prepare', 'text', 'visual', 'shots', 'review', 'export'].map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="sc-field ys-field"><span>Status</span><select value={status} onChange={event => setStatus(event.currentTarget.value)}><option value="">All statuses</option>{['pending', 'running', 'ready', 'attention', 'blocked'].map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="sc-field ys-field"><span><input type="checkbox" checked={attention} onChange={event => setAttention(event.currentTarget.checked)} /> Attention only</span></label>
        <Button type="button" size="sm" variant="toolbar" onClick={apply}>Apply filters</Button>
      </div>
      <StateStrip state={state} lane="episode" />
      {state.episodePhase !== 'loading' && state.episodeItems.length === 0 ? <SurfaceState phase="empty" title="No episodes in this projection" /> : <ol className="sc-list">{state.episodeItems.map(item => <li className="sc-row" key={`${item.ref}:${item.version}`}>
        <SelectionInput state={state} controller={controller} kind="episode" targetRef={item.ref} version={item.version} />
        <span className="sc-main"><strong>{item.ordinal}. {item.title}</strong><small>{item.stage} · {item.status} · attention {item.attentionCount}</small><progress className="sc-progress" max={1} value={item.progress} /></span>
        <span className="sc-badges"><span className="sc-badge">{item.version}</span><span className="sc-badge">{item.status}</span></span>
      </li>)}</ol>}
      {state.episodeNextCursor === null ? null : <Button type="button" size="sm" variant="toolbar" disabled={state.episodePhase === 'loading'} onClick={() => void controller.loadEpisodes({ ...state.episodeQuery, cursor: state.episodeNextCursor! }, true)}>Load more</Button>}
    </SurfaceSection>
    <PreviewBar state={state} controller={controller} actionId="drama.episode.open" label="context switch" />
  </div>
}

interface CompareCandidateV1 {
  readonly key: string
  readonly episodeRef: string
  readonly title: string
  readonly artifact: ArtifactRefV1
}

function selectedReviewArtifacts(state: DramaShowControlClientStateV1): readonly CompareCandidateV1[] {
  const selected = new Set(state.selected.filter(item => item.kind === 'review').map(item => `${item.ref}:${item.version}`))
  return state.reviewItems.flatMap(item => item.artifact !== undefined && selected.has(`${item.ref}:${item.version}`) ? [{ key: `${item.episodeRef}:${item.artifact.ref}:${item.artifact.version}`, episodeRef: item.episodeRef, title: item.title, artifact: item.artifact }] : [])
}

function mediaFamily(artifact: ArtifactRefV1): 'image' | 'video' | 'audio' | 'other' {
  if (artifact.mediaType.startsWith('image/')) return 'image'
  if (artifact.mediaType.startsWith('video/')) return 'video'
  if (artifact.mediaType.startsWith('audio/')) return 'audio'
  return 'other'
}

function CompareTray({ candidates, state, openArtifact }: { readonly candidates: readonly CompareCandidateV1[]; readonly state: DramaShowControlClientStateV1; readonly openArtifact: (artifact: ArtifactRefV1, compare?: boolean) => void }): ReactNode {
  if (candidates.length !== 2) return null
  const compatible = mediaFamily(candidates[0]!.artifact) !== 'other' && mediaFamily(candidates[0]!.artifact) === mediaFamily(candidates[1]!.artifact)
  return <SurfaceSection title="Version compare" description={compatible ? 'Independent episode/artifact/version keys; each side resolves through its owner.' : 'Select two image, video, or audio artifacts of the same media family.'}>
    <div className="sc-compare" data-readonly={mutationDisabled(state) === undefined ? undefined : 'stale'}>{candidates.map((candidate, index) => <article data-compare-side={index === 0 ? 'left' : 'right'} key={candidate.key}><strong>{candidate.title}</strong><span>{candidate.episodeRef}</span><small>{candidate.artifact.ref}@{candidate.artifact.version} · {mediaFamily(candidate.artifact)}</small><Button type="button" size="sm" variant="toolbar" disabled={!compatible} onClick={() => openArtifact(candidate.artifact, true)}>Open {index === 0 ? 'left' : 'right'}</Button></article>)}</div>
    {mutationDisabled(state) === undefined ? null : <p className="sc-alert">Projection is stale or unsettled; read-only comparison remains available while mutation stays disabled.</p>}
  </SurfaceSection>
}

function ReviewAnnotationComposer({ state, controller }: { readonly state: DramaShowControlClientStateV1; readonly controller: DramaShowControlController }): ReactNode {
  const targets = state.reviewItems.filter(item => state.selected.some(selected => selected.kind === 'review' && selected.ref === item.ref && selected.version === item.version) && item.annotation !== undefined && item.artifact !== undefined)
  const allowed = targets.length === 0 ? [] : targets.map(item => item.annotation!.allowedKinds).reduce((current, kinds) => current.filter(kind => kinds.includes(kind)))
  const [kind, setKind] = useState<DramaReviewAnnotationKindV1>('media-time-point')
  const [note, setNote] = useState('')
  const [primary, setPrimary] = useState('0')
  const [secondary, setSecondary] = useState('1000')
  const selectionKey = state.selected.map(item => `${item.kind}:${item.ref}:${item.version}`).join('|')
  useEffect(() => { setNote(''); setPrimary('0'); setSecondary('1000'); setKind((allowed[0] as DramaReviewAnnotationKindV1 | undefined) ?? 'media-time-point') }, [state.snapshot?.snapshotRef, state.snapshot?.snapshotVersion, selectionKey])
  const disabledReason = mutationDisabled(state) ?? (!controller.annotationAvailable ? 'Selection annotation owner is unavailable.' : targets.length === 0 ? 'Select loaded review targets with owner annotation metadata.' : allowed.length === 0 ? 'Selected targets do not share an annotation kind.' : undefined)
  const submit = (): void => {
    const first = Number(primary); const second = Number(secondary)
    controller.submitAnnotations(targets.map(item => ({ reviewRef: item.ref, reviewVersion: item.version, kind, note,
      ...(kind === 'image-point' ? { x: first, y: second } : {}),
      ...(kind === 'image-region' ? { x: first, y: first, width: second, height: second } : {}),
      ...(kind === 'media-frame' ? { frame: Math.max(0, Math.round(first)), timeMs: Math.max(0, Math.round(second)) } : {}),
      ...(kind === 'media-time-point' ? { timeMs: Math.max(0, Math.round(first)) } : {}),
      ...(kind === 'media-time-region' ? { startMs: Math.max(0, Math.round(first)), endMs: Math.max(0, Math.round(second)) } : {}),
    })))
  }
  const batch = state.annotationBatch
  return <SurfaceSection title="Selection-owner annotations" description="Frame, time, and region drafts are ephemeral; the selection owner returns the batch and markers.">
    <div className="sc-filters"><label className="sc-field ys-field"><span>Anchor kind</span><select value={kind} disabled={allowed.length === 0} onChange={event => setKind(event.currentTarget.value as DramaReviewAnnotationKindV1)}>{allowed.map(item => <option key={item}>{item}</option>)}</select></label><label className="sc-field ys-field"><span>{kind.startsWith('image') ? 'X / start' : kind === 'media-frame' ? 'Frame' : 'Start ms'}</span><input type="number" value={primary} onChange={event => setPrimary(event.currentTarget.value)} /></label><label className="sc-field ys-field"><span>{kind.startsWith('image') ? 'Y / size' : kind === 'media-frame' ? 'Time ms' : 'End ms'}</span><input type="number" value={secondary} onChange={event => setSecondary(event.currentTarget.value)} /></label><label className="sc-field ys-field"><span>Bounded note</span><input maxLength={512} value={note} onChange={event => setNote(event.currentTarget.value)} /></label></div>
    <div className="sc-actions"><Button type="button" size="sm" variant="toolbar" disabled={disabledReason !== undefined || note.trim() === '' || state.annotationPhase === 'loading'} title={disabledReason} onClick={submit}>{state.annotationPhase === 'loading' ? 'Submitting annotations…' : `Submit annotation batch (${targets.length})`}</Button>{batch === null ? null : <Button type="button" size="sm" variant="toolbar" disabled={mutationDisabled(state) !== undefined} onClick={() => void controller.previewAction('drama.review.repair', { annotationBatchRef: batch.batchId })}>Preview repair handoff</Button>}</div>
    {state.annotationMessage === null ? null : <p className={state.annotationPhase === 'error' ? 'sc-alert' : 'sc-receipt'} role="status">{state.annotationMessage}</p>}
    {batch === null ? null : <div className="sc-receipt"><strong>{batch.batchId} · {batch.status}</strong><span>{state.annotationAgentRequest?.markers.map(marker => `${marker.label} ${marker.kind}`).join(' · ')}</span></div>}
  </SurfaceSection>
}

function ReviewInbox({ state, controller, openArtifact }: { readonly state: DramaShowControlClientStateV1; readonly controller: DramaShowControlController; readonly openArtifact: (artifact: ArtifactRefV1, compare?: boolean) => void }): ReactNode {
  const [status, setStatus] = useState(state.reviewQuery.status ?? '')
  const [risk, setRisk] = useState(state.reviewQuery.risk ?? '')
  const apply = (): void => { void controller.loadReviews({ limit: 50, ...(status === '' ? {} : { status: status as NonNullable<typeof state.reviewQuery.status> }), ...(risk === '' ? {} : { risk: risk as NonNullable<typeof state.reviewQuery.risk> }) }) }
  const compare = selectedReviewArtifacts(state)
  return <div className="sc-stack">
    <SurfaceSection title="Cross-episode Review Inbox" description="Select at most 100 loaded, explicitly versioned review targets." meta={<span className="sc-badge">{state.reviewItems.length}</span>}>
      <div className="sc-filters"><label className="sc-field ys-field"><span>Status</span><select value={status} onChange={event => setStatus(event.currentTarget.value)}><option value="">All statuses</option>{['pending', 'approved', 'rejected', 'partial', 'blocked'].map(item => <option key={item}>{item}</option>)}</select></label><label className="sc-field ys-field"><span>Risk</span><select value={risk} onChange={event => setRisk(event.currentTarget.value)}><option value="">All risks</option>{['low', 'medium', 'high'].map(item => <option key={item}>{item}</option>)}</select></label><Button type="button" size="sm" variant="toolbar" onClick={apply}>Apply filters</Button></div>
      <StateStrip state={state} lane="review" />
      {state.reviewPhase !== 'loading' && state.reviewItems.length === 0 ? <SurfaceState phase="empty" title="Review inbox is empty" /> : <ul className="sc-list">{state.reviewItems.map(item => <ReviewRow key={`${item.ref}:${item.version}`} item={item} state={state} controller={controller} openArtifact={openArtifact} />)}</ul>}
      <div className="sc-actions">{state.reviewNextCursor === null ? null : <Button type="button" size="sm" variant="toolbar" onClick={() => void controller.loadReviews({ ...state.reviewQuery, cursor: state.reviewNextCursor! }, true)}>Load more</Button>}</div>
    </SurfaceSection>
    <CompareTray candidates={compare} state={state} openArtifact={openArtifact} />
    <ReviewAnnotationComposer state={state} controller={controller} />
    <PreviewBar state={state} controller={controller} actionId="drama.review.batch" label="batch review" />
  </div>
}

function ReviewRow({ item, state, controller, openArtifact }: { readonly item: DramaShowReviewV1; readonly state: DramaShowControlClientStateV1; readonly controller: DramaShowControlController; readonly openArtifact: (artifact: ArtifactRefV1, compare?: boolean) => void }): ReactNode {
  return <li className="sc-row"><SelectionInput state={state} controller={controller} kind="review" targetRef={item.ref} version={item.version} /><span className="sc-main"><strong>{item.title}</strong><small>{item.episodeRef} · {item.owner} · {item.status}</small></span><span className="sc-actions"><span className="sc-badge">{item.risk}</span>{item.artifact === undefined ? null : <Button type="button" size="sm" variant="toolbar" onClick={() => openArtifact(item.artifact!)}>Open</Button>}</span></li>
}

function selectedAssetArtifacts(state: DramaShowControlClientStateV1): readonly CompareCandidateV1[] {
  const selected = new Set(state.selected.filter(item => item.kind === 'asset').map(item => `${item.ref}:${item.version}`))
  return state.assetItems.flatMap(item => item.artifact !== undefined && selected.has(`${item.ref}:${item.version}`) ? [{ key: `${item.episodeRef}:${item.artifact.ref}:${item.artifact.version}`, episodeRef: item.episodeRef, title: item.title, artifact: item.artifact }] : [])
}

function AssetWall({ state, controller, openArtifact }: { readonly state: DramaShowControlClientStateV1; readonly controller: DramaShowControlController; readonly openArtifact: (artifact: ArtifactRefV1, compare?: boolean) => void }): ReactNode {
  const [kind, setKind] = useState(state.assetQuery.kind ?? '')
  const [owner, setOwner] = useState(state.assetQuery.owner ?? '')
  useEffect(() => { if (state.assetPhase === 'cold') void controller.loadAssets({ limit: 50 }) }, [controller, state.assetPhase])
  const compare = selectedAssetArtifacts(state)
  return <div className="sc-stack"><SurfaceSection title="Cross-episode Asset Wall" description="Assets remain keyed by independent episode, artifact, and version refs." meta={<span className="sc-badge">{state.assetItems.length}</span>}>
    <div className="sc-filters"><label className="sc-field ys-field"><span>Owner</span><input value={owner} onChange={event => setOwner(event.currentTarget.value)} /></label><label className="sc-field ys-field"><span>Kind</span><input value={kind} onChange={event => setKind(event.currentTarget.value)} /></label><Button type="button" size="sm" variant="toolbar" onClick={() => void controller.loadAssets({ limit: 50, ...(owner.trim() === '' ? {} : { owner: owner.trim() }), ...(kind.trim() === '' ? {} : { kind: kind.trim() }) })}>Apply filters</Button></div>
    <StateStrip state={state} lane="asset" />
    {state.assetPhase !== 'loading' && state.assetItems.length === 0 ? <SurfaceState phase="empty" title="Asset wall is empty" /> : <div className="sc-grid">{state.assetItems.map(item => <AssetCard key={`${item.ref}:${item.version}`} item={item} state={state} controller={controller} openArtifact={openArtifact} />)}</div>}
    <div className="sc-actions">{state.assetNextCursor === null ? null : <Button type="button" size="sm" variant="toolbar" onClick={() => void controller.loadAssets({ ...state.assetQuery, cursor: state.assetNextCursor! }, true)}>Load more</Button>}</div>
  </SurfaceSection><CompareTray candidates={compare} state={state} openArtifact={openArtifact} /><PreviewBar state={state} controller={controller} actionId="drama.asset.repair" label="repair handoff" /></div>
}

function AssetCard({ item, state, controller, openArtifact }: { readonly item: DramaShowAssetV1; readonly state: DramaShowControlClientStateV1; readonly controller: DramaShowControlController; readonly openArtifact: (artifact: ArtifactRefV1, compare?: boolean) => void }): ReactNode {
  return <article className="sc-card"><div className="sc-actions" style={{ justifyContent: 'space-between' }}><SelectionInput state={state} controller={controller} kind="asset" targetRef={item.ref} version={item.version} /><span className="sc-badge">{item.kind}</span></div><span className="sc-main"><strong>{item.title}</strong><small>{item.episodeRef} · {item.owner} · {item.status}</small></span>{item.rightsSummary === undefined ? null : <p>{item.rightsSummary}</p>}{item.artifact === undefined ? null : <Button type="button" size="sm" variant="toolbar" onClick={() => openArtifact(item.artifact!)}>Open</Button>}</article>
}

function Delivery({ state, controller }: { readonly state: DramaShowControlClientStateV1; readonly controller: DramaShowControlController }): ReactNode {
  const delivery = state.delivery
  return <div className="sc-stack"><SurfaceSection title="Delivery readiness" description={delivery?.safeMessage ?? 'Owner-projected deliverables, rights, evidence, and blockers.'} meta={<span className="sc-badge">{delivery === null ? '—' : `${delivery.readyCount}/${delivery.totalCount}`}</span>}>
    <StateStrip state={state} lane="delivery" />
    {delivery !== null && delivery.status !== 'ready' ? <p className="sc-alert">{delivery.status}/{delivery.freshness} · owner reconcile required</p> : null}
    {delivery === null || delivery.items.length === 0 ? <SurfaceState phase="empty" title="No delivery items" /> : <div className="sc-stack">{delivery.items.map(item => {
      const submitBlocked = item.rightsStatus !== 'ready' || item.evidenceStatus !== 'ready' || item.blockerRefs.length > 0
      return <article className="sc-card" key={`${item.ref}:${item.version}`} data-delivery-item={item.ref}><div className="sc-row"><SelectionInput state={state} controller={controller} kind="delivery" targetRef={item.ref} version={item.version} /><span className="sc-main"><strong>{item.title}</strong><small>{item.episodeRef} · {item.previousVersion ?? 'new'} → {item.version}</small></span><span className="sc-badges"><span className="sc-badge">{item.status}</span><span className="sc-badge">{item.blockerRefs.length} blockers</span></span></div>
        {item.versionDifference === undefined ? null : <p><strong>{item.versionDifference.changed ? 'Changed' : 'Unchanged'}:</strong> {item.versionDifference.summary}</p>}
        <div className="sc-grid"><div className="sc-receipt"><strong>Rights · {item.rightsStatus}</strong><span>{item.rightsSummary ?? 'Owner did not provide a rights summary.'}</span></div><div className="sc-receipt"><strong>Evidence · {item.evidenceStatus}</strong><span>{item.evidenceSummary ?? `${item.evidenceRefs.length} evidence refs`}</span></div></div>
        {item.blockerRefs.length === 0 ? null : <p className="sc-alert">{item.blockerRefs.join(' · ')}</p>}
        <div className="sc-actions">{item.actions?.map(action => {
          const reason = action.disabledReason ?? mutationDisabled(state) ?? (action.kind === 'submit' && submitBlocked ? 'Rights, evidence, and blockers must be owner-ready before submit.' : undefined)
          return <Button type="button" size="sm" variant={action.kind === 'submit' ? 'primary' : 'toolbar'} key={action.actionId} disabled={reason !== undefined} title={reason} onClick={() => { if (controller.selectOnly({ kind: 'delivery', ref: item.ref, version: item.version })) void controller.previewAction(action.actionId) }}>{action.label}</Button>
        })}</div>
        {item.receiptHistory === undefined || item.receiptHistory.length === 0 ? null : <details><summary>Owner receipt history ({item.receiptHistory.length})</summary><ol className="sc-list">{item.receiptHistory.map(receipt => <li className="sc-receipt" data-status={receipt.status} key={receipt.receiptRef}><strong>{receipt.status} · {receipt.receiptRef}</strong><span>{receipt.summary ?? receipt.reconcileReason ?? receipt.actionId ?? 'Owner receipt'}</span></li>)}</ol></details>}
      </article>
    })}</div>}
  </SurfaceSection><PreviewBar state={state} controller={controller} actionId="drama.delivery.prepare" label="delivery action" /></div>
}

function ShowControlView({ id, model }: { readonly id: DramaShowControlPaneId; readonly model: DramaShowControlViewModel }): ReactNode {
  const controller = model.controller
  const state = useSyncExternalStore(controller?.store.subscribe ?? (() => () => {}), controller?.store.getSnapshot ?? (() => DRAMA_SHOW_CONTROL_INITIAL_STATE))
  if (controller === undefined) return <Surface kind="workspace" data-show-control-view={id}><style>{STYLES}</style><SurfaceContextBar title={META[id].label} /><div className="ys-body"><SurfaceState phase="disabled" title={`${META[id].label} unavailable`} description={model.disabledReason ?? 'missing show-control owner projection'} /></div></Surface>
  const body = id === 'ShowBoard' ? <ShowBoard state={state} controller={controller} /> : id === 'ReviewInbox' ? <ReviewInbox state={state} controller={controller} openArtifact={model.openArtifact} /> : id === 'AssetWall' ? <AssetWall state={state} controller={controller} openArtifact={model.openArtifact} /> : <Delivery state={state} controller={controller} />
  return <Surface kind="workspace" data-show-control-view={id} tabIndex={0} aria-label={META[id].label}><style>{STYLES}</style><SurfaceContextBar title={META[id].label} context={state.snapshot?.title ?? state.showRef ?? undefined} description={state.snapshot?.safeMessage ?? META[id].description} status={<span className="sc-badge">{state.snapshot?.freshness ?? state.phase}</span>} actions={<Button type="button" size="sm" variant="toolbar" disabled={state.phase === 'loading'} onClick={() => void model.refresh()}>Refresh</Button>} /><div className="ys-body">{body}</div><SurfaceActionBar><Button type="button" size="sm" variant="toolbar" onClick={() => controller.clearSelection()}>Clear selection ({state.selected.length})</Button></SurfaceActionBar></Surface>
}

export function createDramaShowControlViewFactories(model: DramaShowControlViewModel): Readonly<Record<string, () => ReactNode>> {
  return Object.fromEntries(DRAMA_SHOW_CONTROL_VIEW_REGISTRATIONS.map(({ id, descriptor }) => [descriptor.componentKey, () => <ShowControlView id={id} model={model} />]))
}

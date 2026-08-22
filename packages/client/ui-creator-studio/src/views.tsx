import { useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
import type {
  ArtifactIntentV1,
  ArtifactRefV1,
  PaneActionDescriptorV1,
  PaneActionReceiptV1,
  PaneActionValueV1,
} from '@yeisme/dsh-pane-protocol'
import type {
  CreatorOwnerProjectionV1,
  CreatorResourceV1,
  CreatorStudioOwner,
  CreatorStudioSnapshotV1,
  CreatorStudioTask,
} from '@yeisme/dsh-creator-studio-host/contracts'
import { buildArtifactIntent } from '@yeisme/dsh-client-ui-pane-workbench'
import { MediaPreviewPane, type MediaRefV1 } from '@yeisme/dsh-rich-media/client'
import { CreatorStudioController, type CreatorStudioViewState } from './controller.ts'
import { creatorStudioStyles } from './styles.ts'

export type CreatorStudioViewMode = 'home' | 'text' | 'visual' | 'audio' | 'production' | 'context' | 'analysis' | 'review' | 'jobs'

export interface CreatorPaneFace {
  openView(request: unknown): void
  dispatchIntent?(intent: unknown): Promise<PaneActionReceiptV1>
  readonly controller?: { dispatch(intent: unknown): unknown }
  readonly views?: { has(kind: string): boolean }
}

export const CREATOR_TASK_VIEWS = [
  { mode: 'text', task: 'text', owner: 'auctra', label: '文字', description: '候选创作、局部修改与差异审阅', glyph: '文', kind: 'creator.text' },
  { mode: 'visual', task: 'image', owner: 'eikona', label: '图像', description: '生图、画廊、对比与视觉交付', glyph: '图', kind: 'creator.visual' },
  { mode: 'audio', task: 'audio', owner: 'sonora', label: '音频', description: '台词、音色、take 与版权检查', glyph: '声', kind: 'creator.audio' },
  { mode: 'production', task: 'video', owner: 'scaena', label: '视频 / 短剧', description: '分镜、镜头、预览合成与导出', glyph: '剧', kind: 'creator.production' },
] as const

const OWNER_LENSES = [
  { mode: 'text', owner: 'auctra', label: 'Auctra' },
  { mode: 'visual', owner: 'eikona', label: 'Eikona' },
  { mode: 'audio', owner: 'sonora', label: 'Sonora' },
  { mode: 'production', owner: 'scaena', label: 'Scaena' },
  { mode: 'context', owner: 'pinax', label: 'Pinax' },
  { mode: 'analysis', owner: 'anatomia', label: 'Anatomia' },
] as const

const MODE_META: Record<CreatorStudioViewMode, { title: string; description: string; owner?: CreatorStudioOwner; task?: CreatorStudioTask }> = {
  home: { title: 'Creator Studio', description: '从任务出发，连接六个 canonical owner。' },
  text: { title: '文字创作', description: '候选内容只在 Auctra owner 确认后进入正式版本。', owner: 'auctra', task: 'text' },
  visual: { title: '图像创作', description: 'Eikona 负责模型预览、生成、审阅与图像资产。', owner: 'eikona', task: 'image' },
  audio: { title: '音频创作', description: 'Sonora 负责声音权益、成本、take 与音频资产。', owner: 'sonora', task: 'audio' },
  production: { title: '视频与短剧', description: 'Scaena 提供 ProductionGraph、镜头审阅和导出总控。', owner: 'scaena', task: 'video' },
  context: { title: '创作资料', description: 'Pinax 提供搜索、捕获和上下文挂载，不复制知识库。', owner: 'pinax', task: 'context' },
  analysis: { title: '内容分析', description: 'Anatomia 提供时间线、证据与 partial 分析投影。', owner: 'anatomia', task: 'analysis' },
  review: { title: '跨领域审阅', description: '聚合队列来自 Scaena；各 owner 继续持有审阅事实。', owner: 'scaena', task: 'review' },
  jobs: { title: '生成与审批队列', description: '只展示 owner/Ordo receipt，不推断后台任务成功。', task: 'operations' },
}

function ownerOf(snapshot: CreatorStudioSnapshotV1 | null, owner: CreatorStudioOwner | undefined): CreatorOwnerProjectionV1 | undefined {
  return owner === undefined ? undefined : snapshot?.owners.find(item => item.owner === owner)
}

function useCompactMode(): boolean {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 600px)').matches)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(max-width: 600px)')
    const update = (): void => setCompact(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])
  return compact
}

function Progress({ value }: { value: number }): ReactNode {
  return <span className="cs-progress" aria-label={`${Math.round(value * 100)}%`}><i style={{ width: `${Math.round(value * 100)}%` }} /></span>
}

function OwnerStatus({ owner }: { owner: CreatorOwnerProjectionV1 }): ReactNode {
  return <div className="cs-owner-row" data-owner={owner.owner}>
    <i className="cs-status-dot" data-status={owner.status} aria-label={owner.status} />
    <span><strong>{owner.owner[0]!.toUpperCase() + owner.owner.slice(1)}</strong><small>{owner.summary}</small></span>
  </div>
}

function ProductionPulse({ snapshot }: { snapshot: CreatorStudioSnapshotV1 }): ReactNode {
  const production = snapshot.production
  if (production === undefined) return <section className="cs-pulse cs-empty" data-production-empty><strong>Scaena 尚未发布 Production 投影</strong><span>连接 Scaena adapter 后显示六阶段进度、阻塞项和审阅队列。</span></section>
  return <section className="cs-pulse" data-production={production.ref}>
    <header><div><h2>{production.title}</h2><p className="cs-muted">当前阶段：{production.currentStage}</p></div><span className="cs-badge">v{production.version}</span></header>
    <div className="cs-stage-track">
      {production.stages.map(stage => <div className="cs-stage" key={stage.id} data-current={stage.id === production.currentStage} data-status={stage.status}>
        <strong>{stage.label}</strong><small>{stage.status}{stage.itemCount === undefined ? '' : ` · ${stage.itemCount}`}</small><Progress value={stage.progress} />
      </div>)}
    </div>
    {production.blockers.length > 0 && <ul className="cs-list" aria-label="Production blockers">
      {production.blockers.map(blocker => <li key={blocker.ref}><i className="cs-status-dot" data-status={blocker.severity === 'critical' ? 'failed' : 'partial'} /><span><strong>{blocker.title}</strong><small>{blocker.summary}</small></span><span className="cs-badge">{blocker.severity}</span></li>)}
    </ul>}
  </section>
}

function QuickCreate({ onOpenMode }: { onOpenMode(mode: CreatorStudioViewMode): void }): ReactNode {
  return <section className="cs-section" aria-labelledby="quick-create-title">
    <header><div><h2 id="quick-create-title">快速创作</h2><p className="cs-muted">选择任务，进入 owner 发布的真实操作与资源视图。</p></div></header>
    <div className="cs-quick-grid">
      {CREATOR_TASK_VIEWS.map(item => <button key={item.mode} type="button" className="cs-quick-card" style={{ '--cs-accent': item.mode === 'text' ? '#9d8cff' : item.mode === 'visual' ? '#6fb8ff' : item.mode === 'audio' ? '#74d6ae' : '#ff9b76' } as CSSProperties} onClick={() => onOpenMode(item.mode)}>
        <b aria-hidden="true">{item.glyph}</b><strong>{item.label}</strong><span>{item.description}</span>
      </button>)}
    </div>
  </section>
}

function HomeView({ snapshot, onOpenMode }: { snapshot: CreatorStudioSnapshotV1; onOpenMode(mode: CreatorStudioViewMode): void }): ReactNode {
  return <div className="cs-body" data-creator-home>
    <QuickCreate onOpenMode={onOpenMode} />
    <ProductionPulse snapshot={snapshot} />
    <section className="cs-section"><header><div><h2>Owner 状态</h2><p className="cs-muted">传输选择由 Host 冻结；未知结果不会切换到另一 transport 重试。</p></div></header><div className="cs-owner-grid">{snapshot.owners.map(owner => <OwnerStatus key={owner.owner} owner={owner} />)}</div></section>
    {snapshot.reviews.length > 0 && <ReviewList snapshot={snapshot} limit={4} />}
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

function ResourceCard({ resource, owner, onIntent }: { resource: CreatorResourceV1; owner: CreatorStudioOwner; onIntent(intent: ArtifactIntentV1): void }): ReactNode {
  return <article className="cs-card" data-resource={resource.ref} data-kind={resource.kind} data-status={resource.status}>
    {(resource.artifact !== undefined || resource.waveform !== undefined) && <div className="cs-card-preview" aria-hidden="true">
      {resource.waveform === undefined
        ? mediaGlyph(resource.artifact, resource.kind)
        : <div className="cs-waveform">{resource.waveform.slice(0, 64).map((value, index) => <i key={index} style={{ height: `${Math.max(8, Math.round(value * 100))}%` }} />)}</div>}
    </div>}
    <header><h3>{resource.title}</h3><span className="cs-badge">{resource.status}</span></header>
    {resource.summary === undefined ? null : <p>{resource.summary}</p>}
    {resource.progress === undefined ? null : <Progress value={resource.progress} />}
    {resource.textPreview !== undefined && <div className="cs-diff">
      <pre data-side="before">{resource.textPreview.before ?? '未提供前一版本窗口'}</pre><pre data-side="after">{resource.textPreview.after ?? '未提供候选版本窗口'}</pre>
    </div>}
    <div className="cs-badges">{resource.partial === true && <span className="cs-badge">partial</span>}{resource.badges?.map(badge => <span className="cs-badge" key={badge}>{badge}</span>)}</div>
    <div className="cs-metrics">{resource.metrics?.map(metric => <span className="cs-metric" data-tone={metric.tone ?? 'neutral'} key={`${metric.label}:${metric.value}`}>{metric.label} {metric.value}</span>)}</div>
    {resource.artifact !== undefined && <div className="cs-actions">
      {resource.artifact.capabilities.includes('open') && <button className="cs-button" type="button" onClick={() => onIntent(buildArtifactIntent({ intent: 'open', source: resource.artifact!, context: resource.artifact === undefined ? { workspaceRef: 'workspace:unavailable', revision: '0' } : { workspaceRef: 'workspace:artifact', revision: resource.artifact.version }, idempotencyKey: `open-${resource.artifact!.ref}-${resource.artifact!.version}` }))}>打开</button>}
      {handoffTargets(owner).slice(0, 2).map(target => <button className="cs-button" type="button" key={target} onClick={() => onIntent(buildArtifactIntent({ intent: owner === 'pinax' ? 'attach_context' : 'handoff', source: resource.artifact!, targetOwner: target, targetPaneKind: target === 'eikona' ? 'creator.visual' : target === 'sonora' ? 'creator.audio' : target === 'scaena' ? 'creator.production' : target === 'anatomia' ? 'creator.analysis' : 'creator.text', context: { workspaceRef: 'workspace:artifact', revision: resource.artifact!.version }, idempotencyKey: `${owner}-${target}-${resource.artifact!.ref}-${resource.artifact!.version}` }))}>交给 {target}</button>)}
    </div>}
  </article>
}

function fieldHasValue(value: PaneActionValueV1 | undefined): boolean {
  if (value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

function ActionField({ field, value, artifacts, onChange }: { field: PaneActionDescriptorV1['fields'][number]; value: PaneActionValueV1 | undefined; artifacts: readonly ArtifactRefV1[]; onChange(value: PaneActionValueV1 | undefined): void }): ReactNode {
  if (field.kind === 'boolean') return <label className="cs-confirm"><input type="checkbox" checked={value === true} onChange={event => onChange(event.currentTarget.checked)} /><span>{field.label}</span></label>
  if (field.kind === 'select') return <label className="cs-field"><span>{field.label}</span><select value={typeof value === 'string' ? value : ''} required={field.required} onChange={event => onChange(event.currentTarget.value)}><option value="">请选择</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
  if (field.kind === 'multiselect') {
    const selected = Array.isArray(value) ? value : []
    return <fieldset className="cs-field"><legend>{field.label}</legend>{field.options?.map(option => <label className="cs-confirm" key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={event => onChange(event.currentTarget.checked ? [...selected, option.value] : selected.filter(item => item !== option.value))} /><span>{option.label}</span></label>)}</fieldset>
  }
  if (field.kind === 'artifact_ref') {
    const selected = typeof value === 'object' && value !== null && !Array.isArray(value) ? `${value.owner}:${value.ref}:${value.version}` : ''
    const available = artifacts.filter(artifact => field.artifactKinds === undefined || field.artifactKinds.includes(artifact.kind))
    return <label className="cs-field"><span>{field.label}</span><select value={selected} required={field.required} onChange={event => onChange(available.find(artifact => `${artifact.owner}:${artifact.ref}:${artifact.version}` === event.currentTarget.value))}><option value="">请选择产物</option>{available.map(artifact => <option key={`${artifact.owner}:${artifact.ref}:${artifact.version}`} value={`${artifact.owner}:${artifact.ref}:${artifact.version}`}>{artifact.title}</option>)}</select></label>
  }
  if (field.kind === 'number') return <label className="cs-field"><span>{field.label}</span><input type="number" value={typeof value === 'number' ? value : ''} min={field.min} max={field.max} required={field.required} onChange={event => onChange(event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value))} /></label>
  const common = { value: typeof value === 'string' ? value : '', placeholder: field.placeholder, minLength: field.minLength, maxLength: field.maxLength, required: field.required, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.currentTarget.value) }
  return <label className="cs-field"><span>{field.label}</span>{field.kind === 'textarea' ? <textarea {...common} /> : <input type="text" {...common} />}</label>
}

function ActionComposer({ owner, task, snapshot, state, controller, onDirty }: { owner: CreatorOwnerProjectionV1; task: CreatorStudioTask; snapshot: CreatorStudioSnapshotV1; state: CreatorStudioViewState; controller: CreatorStudioController; onDirty?(dirty: boolean): void }): ReactNode {
  const descriptors = owner.actions.filter(action => action.presentation?.task === task || action.presentation?.task === undefined)
  const [selectedRef, setSelectedRef] = useState<string | undefined>(descriptors[0]?.descriptorRef)
  const descriptor = descriptors.find(item => item.descriptorRef === selectedRef) ?? descriptors[0]
  const [values, setValues] = useState<Readonly<Record<string, PaneActionValueV1>>>({})
  const [confirmed, setConfirmed] = useState(false)
  const compact = useCompactMode()
  useEffect(() => { setSelectedRef(descriptors[0]?.descriptorRef); setValues({}); setConfirmed(false) }, [owner.snapshotRef, task])
  const dirty = Object.keys(values).length > 0
  useEffect(() => { onDirty?.(dirty); return () => onDirty?.(false) }, [dirty, onDirty])
  const artifacts = snapshot.owners.flatMap(item => item.resources.flatMap(resource => resource.artifact === undefined ? [] : [resource.artifact]))
  if (descriptor === undefined) return <aside className="cs-composer cs-empty" data-action-unavailable><strong>{owner.owner} 未发布当前操作</strong><span>读取 owner 的 server-authored action descriptor 后才会显示表单。</span></aside>
  const requiredMissing = descriptor.fields.some(field => field.required && !fieldHasValue(values[field.key]))
  const stale = owner.status !== 'ready' || owner.freshness !== 'fresh' || Date.parse(descriptor.expiresAt) <= Date.now()
  const mobileRisk = compact && descriptor.risk !== 'low'
  const confirmationMissing = descriptor.confirmation !== 'none' && !confirmed
  const pending = state.pendingDescriptorRef === descriptor.descriptorRef
  const disabled = stale || mobileRisk || confirmationMissing || requiredMissing || pending
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
    {descriptors.length > 1 && <label className="cs-field"><span>操作</span><select value={descriptor.descriptorRef} onChange={event => { setSelectedRef(event.currentTarget.value); setValues({}); setConfirmed(false) }}>{descriptors.map(item => <option key={item.descriptorRef} value={item.descriptorRef}>{item.label}</option>)}</select></label>}
    {descriptor.preview.cost !== undefined && <div className="cs-metric" data-tone="warning">预计 {descriptor.preview.cost.currency} {descriptor.preview.cost.amount}</div>}
    {descriptor.preview.rights !== undefined && <div className="cs-receipt" data-status={descriptor.preview.rights.status}>{descriptor.preview.rights.summary}</div>}
    {descriptor.fields.map(field => <ActionField key={field.key} field={field} value={values[field.key]} artifacts={artifacts} onChange={value => setValues(current => value === undefined ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== field.key)) : { ...current, [field.key]: value })} />)}
    {descriptor.confirmation !== 'none' && <label className="cs-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.currentTarget.checked)} /><span>{descriptor.confirmation === 'approval' ? '我已检查预览；提交后仍需 owner 审批。' : '我已检查成本、版权和目标版本。'}</span></label>}
    {mobileRisk && <p className="cs-alert">移动端只开放低风险操作；请在桌面或平板完成此操作。</p>}
    {stale && <p className="cs-alert">当前 owner 投影不是 fresh/ready，操作已禁用并需要刷新或 reconcile。</p>}
    <button className="cs-button" data-primary="true" data-risk={descriptor.risk} type="button" disabled={disabled} onClick={() => void submit()}>{pending ? '等待 owner receipt…' : descriptor.confirmation === 'approval' ? '提交审批' : '执行操作'}</button>
    {state.lastReceipt?.actionId === descriptor.actionId && <div className="cs-receipt" data-status={state.lastReceipt.status}><strong>{state.lastReceipt.status}</strong><span>{state.lastReceipt.summary ?? state.lastReceipt.reconcileReason ?? state.lastReceipt.receiptRef}</span></div>}
  </aside>
}

function ReviewList({ snapshot, limit }: { snapshot: CreatorStudioSnapshotV1; limit?: number }): ReactNode {
  const reviews = limit === undefined ? snapshot.reviews : snapshot.reviews.slice(0, limit)
  return <section className="cs-section" data-review-list><header><div><h2>待审内容</h2><p className="cs-muted">由 Scaena 发布跨 owner 聚合，receipt 仍由对应 owner 确认。</p></div><span className="cs-badge">{snapshot.reviews.length}</span></header>
    {reviews.length === 0 ? <div className="cs-empty">当前没有待审内容。</div> : <ul className="cs-list">{reviews.map(review => <li key={review.ref}><i className="cs-status-dot" data-status={review.status} /><span><strong>{review.title}</strong><small>{review.owner} · {review.summary ?? review.status}</small></span><span className="cs-badge">{review.risk}</span></li>)}</ul>}
  </section>
}

function JobsView({ snapshot }: { snapshot: CreatorStudioSnapshotV1 }): ReactNode {
  return <div className="cs-body" data-creator-jobs><section className="cs-section"><header><div><h2>生成、审批与证据</h2><p className="cs-muted">unknown 与 reconcile_required 不会触发自动重试。</p></div><span className="cs-badge">{snapshot.jobs.length}</span></header>
    {snapshot.jobs.length === 0 ? <div className="cs-empty">Scaena 尚未发布运行队列。</div> : <ul className="cs-list">{snapshot.jobs.map(job => <li key={job.ref}><i className="cs-status-dot" data-status={job.status} /><span><strong>{job.title}</strong><small>{job.owner} · {job.summary ?? job.status}{job.receiptRef === undefined ? '' : ` · ${job.receiptRef}`}</small>{job.progress === undefined ? null : <Progress value={job.progress} />}</span><span className="cs-badge">{job.status}</span></li>)}</ul>}
  </section></div>
}

function WorkspaceView({ meta, owner, snapshot, state, controller, pane, onDirty }: { meta: (typeof MODE_META)[CreatorStudioViewMode]; owner: CreatorOwnerProjectionV1; snapshot: CreatorStudioSnapshotV1; state: CreatorStudioViewState; controller: CreatorStudioController; pane: CreatorPaneFace; onDirty?(dirty: boolean): void }): ReactNode {
  const [intentReceipt, setIntentReceipt] = useState<PaneActionReceiptV1 | undefined>()
  const onIntent = async (intent: ArtifactIntentV1): Promise<void> => {
    if (pane.dispatchIntent === undefined) return
    setIntentReceipt(await pane.dispatchIntent({ ...intent, context: snapshot.context ?? intent.context }))
  }
  return <div className="cs-body" data-owner-workspace={owner.owner}>
    {owner.status !== 'ready' && <div className="cs-alert" role="status">{owner.summary} · {owner.status}</div>}
    <div className="cs-workspace-grid">
      <section className="cs-section"><header><div><h2>{meta.title}</h2><p className="cs-muted">{meta.description}</p></div><div className="cs-badges"><span className="cs-badge">{owner.transport}</span><span className="cs-badge">{owner.freshness}</span></div></header>
        {owner.resources.length === 0 ? <div className="cs-empty"><strong>暂无 owner 资源</strong><span>连接 {owner.owner} snapshot/event adapter 后会在这里显示真实资源。</span></div> : <div className="cs-resource-grid">{owner.resources.map(resource => <ResourceCard key={resource.ref} resource={resource} owner={owner.owner} onIntent={intent => void onIntent(intent)} />)}</div>}
        {intentReceipt !== undefined && <div className="cs-receipt" data-status={intentReceipt.status}>{intentReceipt.summary ?? intentReceipt.reconcileReason ?? intentReceipt.receiptRef}</div>}
      </section>
      {meta.task === undefined ? null : <ActionComposer owner={owner} task={meta.task} snapshot={snapshot} state={state} controller={controller} {...onDirty === undefined ? {} : { onDirty }} />}
    </div>
  </div>
}

export interface CreatorStudioViewProps {
  readonly mode: CreatorStudioViewMode
  readonly controller: CreatorStudioController
  readonly pane: CreatorPaneFace
  readonly onOpenMode: (mode: CreatorStudioViewMode) => void
  readonly onDirty?: (dirty: boolean) => void
}

export function CreatorStudioView({ mode, controller, pane, onOpenMode, onDirty }: CreatorStudioViewProps): ReactNode {
  const state = useSyncExternalStore(controller.store.subscribe, controller.store.getSnapshot, controller.store.getSnapshot)
  const meta = MODE_META[mode]
  const snapshot = state.snapshot
  const owner = ownerOf(snapshot, meta.owner)
  const taskActive = CREATOR_TASK_VIEWS.find(item => item.mode === mode)?.mode
  return <section data-creator-studio data-mode={mode} data-phase={state.phase}>
    <style>{creatorStudioStyles}</style>
    <div className="cs-shell">
      <header className="cs-header">
        <div className="cs-heading"><button className="cs-button" type="button" onClick={() => onOpenMode('home')}>创作</button><strong>{meta.title}</strong><span>{snapshot?.safeMessage ?? meta.description}</span><button className="cs-button" type="button" onClick={() => void controller.refresh()}>刷新</button></div>
        <nav className="cs-task-nav" aria-label="创作任务">{CREATOR_TASK_VIEWS.map(item => <button type="button" key={item.mode} data-active={taskActive === item.mode} onClick={() => onOpenMode(item.mode)}>{item.label}</button>)}<button type="button" data-active={mode === 'review'} onClick={() => onOpenMode('review')}>审阅</button></nav>
        <nav className="cs-owner-nav" aria-label="Owner lens">{OWNER_LENSES.map(item => <button type="button" key={item.owner} data-active={item.mode === mode} onClick={() => onOpenMode(item.mode)}>{item.label}</button>)}</nav>
      </header>
      {state.phase === 'loading' && snapshot === null ? <div className="cs-empty" role="status">正在读取 Creator Studio owner 投影…</div>
        : state.phase === 'error' && snapshot === null ? <div className="cs-empty" role="alert"><strong>Creator Studio 读取失败</strong><span>{state.errorCode}</span><button className="cs-button" type="button" onClick={() => void controller.refresh()}>重试</button></div>
          : snapshot === null ? <div className="cs-empty" role="status">Creator Studio 尚未读取。</div>
            : mode === 'home' ? <HomeView snapshot={snapshot} onOpenMode={onOpenMode} />
              : mode === 'jobs' ? <JobsView snapshot={snapshot} />
                : mode === 'review' ? <div className="cs-body"><ReviewList snapshot={snapshot} /></div>
                  : owner === undefined ? <div className="cs-empty">Owner projection unavailable.</div>
                    : <WorkspaceView meta={meta} owner={owner} snapshot={snapshot} state={state} controller={controller} pane={pane} {...onDirty === undefined ? {} : { onDirty }} />}
    </div>
  </section>
}

function mediaKind(artifact: ArtifactRefV1): MediaRefV1['kind'] {
  if (artifact.mediaType.startsWith('image/')) return 'image'
  if (artifact.mediaType.startsWith('audio/')) return 'audio'
  if (artifact.mediaType.startsWith('video/')) return 'video'
  if (artifact.mediaType === 'application/pdf') return 'pdf'
  if (artifact.mediaType.startsWith('text/')) return 'text'
  return 'file'
}

export function CreatorMediaView({ artifact, controller }: { artifact?: ArtifactRefV1; controller: CreatorStudioController }): ReactNode {
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
  return <section data-creator-studio data-mode="media"><style>{creatorStudioStyles}</style><MediaPreviewPane title="创作产物" media={media} resolveUrl={item => controller.resolveArtifact({ ...artifact!, owner: item.owner, ref: item.ref, version: item.version }).then(url => { if (url === undefined) throw new Error('Owner 未授权当前预览'); return url })} /></section>
}

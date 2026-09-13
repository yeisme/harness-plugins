import { ProjectDraftSchema, ProjectRestoreSchema, type ProjectRestoreState } from '../project-contract.ts'
import { ProjectSessionAgents, type ProjectSessionsFace } from './project-session-agents.tsx'
import { ProjectPlanEditor } from './project-plan-editor.tsx'
import flowCss from '@xyflow/react/dist/base.css?inline'
import { useEffect, useMemo, useState, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { ReactFlow, Background, Controls, type Node, type Edge, type ReactFlowInstance } from '@xyflow/react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState, SurfaceSection, SurfaceActionBar } from '@yeisme/dsh-client-ui-surface'
import { ProjectController } from './project-controller.ts'
import type { ProjectRemote, ProjectTask } from '../project-contract.ts'

export const projectZh = {
  submitting: '正在等待 owner 回执', previewStale: '状态已变化，请返回并重新预览操作', executionUnavailable: '实际执行器还未接入，暂不能从这里启动运行',
  draftConflict: '计划已更新，原草稿已保留，提交暂停', useCurrent: '改用当前计划',
  nativeAgents: 'DSH 原生子会话', noSessionLink: '尚未关联 DSH 根会话；不会根据名称推断关联', sessionUnavailable: '关联会话或并排能力当前不可用', alongside: '并排打开',
  editPlan: '修改计划', budget: '预算引用', minutes: '时限（分钟）', model: '模型引用', newRevision: '提交产生新版本，原批准不会沿用。新增任务或改变写入范围请让主 Agent 提议新计划。',
  statusRunning: '运行中', statusBlocked: '受阻', statusFailed: '失败', statusComplete: '已完成', statusUnknown: '未知', statusPlanned: '计划中', statusReady: '就绪', statusStopped: '已停止', statusCandidate: '候选待验证', leaseRetained: '执行占用尚未解除，需先对账',
  userScope: '用户工作区 · Ordo', registeredProjects: '已注册项目', projectHint: '选择项目查看团队、计划与运行。此 Pane 不随聊天切换。', projectEntry: '进入项目', plans: '计划与批准', blocked: '阻塞与失败', candidates: '验证与候选', settlement: '需要对账', team: '团队', plan: '计划', runKind: '运行',
  title: 'Agent Team', project: '项目', attention: '待处理', graph: '任务图', agents: 'Agent', timeline: '时间线', tasks: '任务列表',
  refresh: '刷新', search: '搜索任务', allRuns: '全部运行', run: '运行', empty: '当前没有对应事项', loading: '正在读取项目',
  unavailable: 'Ordo 项目服务不可用', register: '请先用 Ordo 注册项目', select: '选择项目', detail: '对象详情', back: '返回列表',
  dependencies: '依赖任务', attempts: '历次执行', evidence: '验证证据', artifacts: '成果引用', blockers: '阻塞原因', verification: '验证',
  actions: '可用操作', confirm: '确认提交', cancel: '返回', pending: '操作结果待核对，请勿重复提交', reconcile: '核对回执',
  accepted: '操作已接受', rejected: '操作被拒绝', unknown: '操作结果未知', target: '操作目标', bounded: '有界事件窗口；更早记录请从 Ordo 读取',
  simulate: '预演计划', approve: '批准计划', start: '启动运行', stop: '请求停止', reconcileRun: '对账运行',
  approval: '批准引用', runtime: '运行时', real: '明确允许本次真实运行', source: '来源', state: '状态',
  previous: '定位上游', next: '定位下游', stale: '连接中断，保留最后确认内容；操作已暂停',
  acceptedHint: '验证通过不等于最终验收；成果采纳仍需明确确认', noActions: 'Owner 尚未提供此对象的操作',
} as const
export const projectEn: Record<keyof typeof projectZh, string> = {
  submitting: 'Waiting for the owner receipt', previewStale: 'State changed. Go back and preview the action again.', executionUnavailable: 'The execution adapter is not connected; starting a run is unavailable.',
  draftConflict: 'The plan changed; previous draft retained and submission paused', useCurrent: 'Use current plan',
  nativeAgents: 'DSH native agents', noSessionLink: 'No DSH root session association. Names are never used to infer links.', sessionUnavailable: 'Linked session or side-chat capability unavailable', alongside: 'Open alongside',
  editPlan: 'Edit plan', budget: 'Budget reference', minutes: 'Time limit (minutes)', model: 'Model reference', newRevision: 'Submit a new revision; earlier approval is not reused. Ask the lead agent to propose new tasks or owned paths.',
  statusRunning: 'Running', statusBlocked: 'Blocked', statusFailed: 'Failed', statusComplete: 'Completed', statusUnknown: 'Unknown', statusPlanned: 'Planned', statusReady: 'Ready', statusStopped: 'Stopped', statusCandidate: 'Candidate awaiting verification', leaseRetained: 'Execution ownership is retained; reconcile first.',
  userScope: 'User workspace · Ordo', registeredProjects: 'Registered projects', projectHint: 'Choose a project to inspect teams, plans and runs. Chat selection does not change this pane.', projectEntry: 'Open project', plans: 'Plans and approvals', blocked: 'Blocked and failed', candidates: 'Verification and candidates', settlement: 'Needs reconciliation', team: 'Team', plan: 'Plan', runKind: 'Run',
  title: 'Agent Team', project: 'Project', attention: 'Attention', graph: 'Task graph', agents: 'Agents', timeline: 'Timeline', tasks: 'Task list',
  refresh: 'Refresh', search: 'Search tasks', allRuns: 'All runs', run: 'Run', empty: 'No matching items', loading: 'Loading project',
  unavailable: 'Ordo project service unavailable', register: 'Register a project with Ordo first', select: 'Select project', detail: 'Details', back: 'Back to list',
  dependencies: 'Dependencies', attempts: 'Attempts', evidence: 'Verification evidence', artifacts: 'Artifact references', blockers: 'Blockers', verification: 'Verification',
  actions: 'Available actions', confirm: 'Confirm submission', cancel: 'Back', pending: 'Settlement unknown. Do not submit again.', reconcile: 'Reconcile receipt',
  accepted: 'Action accepted', rejected: 'Action rejected', unknown: 'Settlement unknown', target: 'Target', bounded: 'Bounded event window; read earlier records from Ordo',
  simulate: 'Simulate plan', approve: 'Approve plan', start: 'Start run', stop: 'Request stop', reconcileRun: 'Reconcile run',
  approval: 'Approval reference', runtime: 'Runtime', real: 'Explicitly allow this real run', source: 'Source', state: 'State',
  previous: 'Locate upstream', next: 'Locate downstream', stale: 'Disconnected. Last confirmed content retained; actions paused.',
  acceptedHint: 'Verification is distinct from final human acceptance.', noActions: 'The owner has not published actions for this object',
}
export type ProjectTranslate = (key: keyof typeof projectZh) => string
type View = 'attention' | 'graph' | 'agents' | 'timeline' | 'tasks'
const actionLabels = { 'plan.revise': 'editPlan', 'plan.simulate': 'simulate', 'plan.approve': 'approve', 'run.start': 'start', 'run.cancel': 'stop', 'run.reconcile': 'reconcileRun' } as const
const styles = `
[data-ordo-project]{height:100%;min-height:0!important;container-type:inline-size}
[data-ordo-project] .ops-body{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;min-height:0;overflow:auto;gap:var(--vk-gap-md)}
[data-ordo-project] .ops-toolbar{padding:var(--vk-gap-sm);display:flex;flex-wrap:wrap;gap:var(--vk-gap-sm);align-items:center}
[data-ordo-project] .ops-list{align-content:start;display:grid;gap:var(--vk-gap-xs);padding:var(--vk-gap-sm);min-width:0}
[data-ordo-project] .ops-row{display:flex!important;justify-content:space-between!important;min-height:var(--vk-ctrl-button);gap:var(--vk-gap-sm);justify-content:space-between;text-align:left;overflow-wrap:anywhere;min-width:0}
[data-ordo-project] .ops-row[aria-pressed=true]{background:var(--vk-fill-hover)}
[data-ordo-project] .ops-details{align-self:start;border-left:1px solid var(--vk-border-l1);overflow-wrap:anywhere;min-width:0;padding:var(--vk-gap-md)}
[data-ordo-project] .ops-muted{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
[data-ordo-project] .react-flow__node.selected{outline:2px solid var(--vk-text-secondary)}
[data-ordo-project] .ops-roster-row{padding:var(--vk-gap-sm);border-bottom:1px solid var(--vk-border-l1);display:grid;gap:var(--vk-gap-xs)}
[data-ordo-project] .ops-roster-row>.ops-row{width:100%;text-align:left}
[data-ordo-project] .ops-flow{height:440px;min-width:0;position:relative}
[data-ordo-project] .react-flow__controls-button{background:var(--vk-bg-layer-2);color:var(--vk-text-primary);fill:currentColor;border-color:var(--vk-border-l1)}
[data-ordo-project] .react-flow{--xy-node-background-color-default:var(--vk-bg-layer-2);--xy-node-color-default:var(--vk-text-primary);--xy-node-border-default:1px solid var(--vk-border-l1);--xy-edge-stroke-default:var(--vk-text-tertiary);--xy-controls-button-background-color-default:var(--vk-bg-layer-2);--xy-controls-button-color-default:var(--vk-text-primary)}
@container (min-width:721px){[data-ordo-project] .ops-body[data-detail=true]{grid-template-columns:minmax(0,1fr) minmax(230px,35%)}}
@container (max-width:720px){[data-ordo-project] .ops-body[data-detail=true]>.ops-main{display:none}}
@media(prefers-reduced-motion:reduce){[data-ordo-project] *{animation:none!important;transition:none!important}}
`

export function projectGraph(tasks: readonly ProjectTask[]): { nodes: Node[]; edges: Edge[] } {
  const ids = new Set(tasks.map(task => task.ref)); const depth = new Map<string, number>()
  // Bounded relaxation handles malformed cycles without hanging the renderer.
  for (let pass = 0; pass < tasks.length; pass++) {
    let changed = false
    for (const task of tasks) if (!depth.has(task.ref) && task.dependencies.every(dep => !ids.has(dep) || depth.has(dep))) {
      depth.set(task.ref, Math.max(-1, ...task.dependencies.map(dep => depth.get(dep) ?? -1)) + 1); changed = true
    }
    if (!changed) break
  }
  const lanes = new Map<number, number>()
  return { nodes: tasks.map(task => {
    const column = depth.get(task.ref) ?? 0; const row = lanes.get(column) ?? 0; lanes.set(column, row + 1)
    return { id: task.ref, data: { label: `${task.title} · ${task.state}` }, position: { x: column * 240, y: row * 85 }, connectable: false }
  }), edges: tasks.flatMap(task => task.dependencies.filter(dep => ids.has(dep)).map(dep => ({ id: `${dep}:${task.ref}`, source: dep, target: task.ref, type: 'smoothstep' }))) }
}

export function ProjectPane({ controller, t, sessions, openSession, restore, onRestore, selector, subscribeReset }: { controller: ProjectController; t: ProjectTranslate; sessions?: ProjectSessionsFace | undefined; openSession?: ((ref: string) => void) | undefined; restore?: unknown; onRestore?: ((value: unknown) => boolean) | undefined; selector?: ReactNode; subscribeReset?: ((fn: () => void) => () => void) | undefined }): ReactNode {
  const actionOrigin = useRef<HTMLElement | null>(null)
  const detailHeading = useRef<HTMLHeadingElement | null>(null)
  const [flow, setFlow] = useState<ReactFlowInstance>()
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const parsedRestore = ProjectRestoreSchema.safeParse(restore)
  const saved = parsedRestore.success && parsedRestore.data.projectRef === controller.projectRef ? parsedRestore.data : undefined
  const [view, setView] = useState<View>(saved?.view ?? 'attention'); const [selected, select] = useState<string | undefined>(saved?.selectedRef); const [run, setRun] = useState(saved?.runRef ?? ''); const [query, setQuery] = useState(saved?.query ?? '')
  const [positions, setPositions] = useState(saved?.positions ?? {})
  const [savedDraft, setSavedDraft] = useState<ProjectRestoreState['draft']>(saved?.draft)
  useEffect(() => { onRestore?.({ projectRef: controller.projectRef, view, ...(selected ? { selectedRef: selected } : {}), ...(run ? { runRef: run } : {}), query, positions, ...(savedDraft ? { draft: savedDraft } : {}) }) }, [controller, view, selected, run, query, positions, savedDraft])
  const [pending, setPending] = useState<{ action: string; targetRef: string; version: string }>(); const [draft, setDraft] = useState<string>(); const [approval, setApproval] = useState(''); const [runtime, setRuntime] = useState(''); const [real, setReal] = useState(false)
  useEffect(() => { controller.start(); return subscribeReset?.(() => controller.reset()) }, [controller, subscribeReset])
  const snapshot = state.snapshot
  const tasks = useMemo(() => (snapshot?.tasks ?? []).filter(task => (!run || task.runRef === run) && task.title.toLowerCase().includes(query.toLowerCase())), [snapshot, run, query])
  const graph = useMemo(() => projectGraph(tasks), [tasks])
  useEffect(() => { if (flow && view === 'graph' && (selected || query)) void flow.fitView({ nodes: (tasks.some(item => item.ref === selected) ? tasks.filter(item => item.ref === selected) : tasks).map(item => ({ id: item.ref })), maxZoom: 1, minZoom: 0.1, padding: 0.2, duration: 0 }) }, [flow, view, selected, query])
  const task = snapshot?.tasks.find(item => item.ref === selected)
  const agent = snapshot?.agents.find(item => item.ref === selected)
  const agentTasks = snapshot?.tasks.filter(item => item.agentRefs.includes(agent?.ref ?? '') || snapshot.events.some(event => event.agentRef === agent?.ref && event.taskRef === item.ref)) ?? []
  const selectedRun = snapshot?.runs.find(item => item.ref === (task?.runRef ?? selected))
  const descriptorActions = snapshot?.actions.filter(action => action.targetRef === selectedRun?.ref) ?? []
  const canAct = state.phase === 'ready' && snapshot?.freshness === 'fresh' && !state.busy && state.receipt?.state !== 'unknown' && !state.error
  const act = (action: string, targetRef: string) => { actionOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setPending({ action, targetRef, version: snapshot!.version }) }
  const closeAction = () => { setPending(undefined); queueMicrotask(() => { const origin = actionOrigin.current; if (origin?.isConnected && !origin.matches(':disabled')) origin.focus(); else detailHeading.current?.focus() }) }
  const stateLabel = (value: string): string => { const keys = { running: 'statusRunning', working: 'statusRunning', blocked: 'statusBlocked', failed: 'statusFailed', completed: 'statusComplete', unknown: 'statusUnknown', planned: 'statusPlanned', ready: 'statusReady', cancelled: 'statusStopped', candidate_frozen: 'statusCandidate' } as const; return value in keys ? t(keys[value as keyof typeof keys]) : value }
  const rows = (items: readonly ProjectTask[]) => items.map(item => <Button key={item.ref} className="ops-row vk-btn" aria-pressed={selected === item.ref} onClick={() => select(item.ref)}><span>{item.title}</span><span className="ops-muted">{item.verification ?? stateLabel(item.state)}{item.blockers.length ? ` · ${item.blockers.length}` : ''}</span></Button>)
  const attention = tasks.filter(item => item.blockers.length || ['failed', 'blocked', 'unknown', 'candidate_frozen'].includes(item.state) || item.verification === 'passed').sort((a, b) => Number(b.blockers.includes('lease_retained')) - Number(a.blockers.includes('lease_retained')))
  return <Surface kind="workspace" data-ordo-project aria-label={t('title')}>
    <style>{flowCss + styles}</style>
    <SurfaceContextBar title={t('title')} context={selector ?? controller.projectRef} description={t('userScope')} status={snapshot?.generatedAt} actions={<Button className="vk-btn" onClick={() => void controller.load()}>{t('refresh')}</Button>}
      nav={<div role="tablist" aria-label={t('title')}>{(['attention', 'graph', 'agents', 'timeline', 'tasks'] as const).map(id => <Button className="vk-btn" key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}>{t(id)}</Button>)}</div>} />
    {!snapshot ? <SurfaceState phase={state.phase === 'offline' ? 'error' : 'loading'} title={t(state.phase === 'offline' ? 'unavailable' : 'loading')} /> : <>
      {state.busy && <SurfaceState phase="loading" title={t('submitting')} />}
      {state.phase === 'offline' && <SurfaceState phase="stale" title={t('stale')} />}
      {snapshot.limitations.map(message => <SurfaceState key={message} phase="partial" title={message} />)}
      {(snapshot.pendingReceipts ?? []).map(receipt => <SurfaceState key={receipt.ref} phase="partial" title={t('pending')} description={`${receipt.action} · ${receipt.targetRef}`} action={<Button className="vk-btn" disabled={state.busy} onClick={() => void controller.reconcileReceipt(receipt.requestId)}>{t('reconcile')}</Button>} />)}
      {(state.receipt || state.error === 'action_result_unknown') && <SurfaceState phase={state.receipt?.state === 'accepted' ? 'success' : 'partial'} title={state.receipt ? t(state.receipt.state) : t('pending')} description={state.receipt?.resultRef ?? state.receipt?.reason} action={state.receipt?.state === 'unknown' || state.error === 'action_result_unknown' ? <Button className="vk-btn" disabled={state.busy} onClick={() => void controller.reconcilePending()}>{t('reconcile')}</Button> : undefined} />}
      <div className="ops-toolbar"><label className="ys-field">{t('run')}<select value={run} onChange={event => { setRun(event.target.value); select(undefined); setPending(undefined) }}><option value="">{t('allRuns')}</option>{snapshot.runs.map(item => <option key={item.ref} value={item.ref}>{item.title}</option>)}</select></label><label className="ys-field">{t('search')}<Input value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      <div className="ops-body" data-detail={Boolean(selected)}>
        <div className="ops-main" role="tabpanel">
          {view === 'attention' && <div className="ops-list">
            {snapshot.runs.some(item => item.kind === 'plan' && (!run || run === item.ref)) && <SurfaceSection title={t('plans')}>{snapshot.runs.filter(item => item.kind === 'plan' && (!run || run === item.ref)).map(item => <Button key={item.ref} className="ops-row vk-btn" onClick={() => select(item.ref)}><span>{item.title}</span><span className="ops-muted">{item.state}</span></Button>)}</SurfaceSection>}
            {(['settlement', 'blocked', 'candidates'] as const).map(group => { const items = attention.filter(item => (item.blockers.includes('lease_retained') || item.state === 'unknown' ? 'settlement' : item.blockers.length || ['failed','blocked'].includes(item.state) ? 'blocked' : 'candidates') === group); return items.length ? <SurfaceSection key={group} title={`${t(group)} · ${items.length}`}>{rows(items)}</SurfaceSection> : null })}
            {!attention.length && !snapshot.runs.some(item => item.kind === 'plan' && (!run || run === item.ref)) && <SurfaceState phase="empty" title={t('empty')} />}</div>}
          {view === 'tasks' && <div className="ops-list">{rows(tasks)}</div>}
          {view === 'graph' && <><div className="ops-flow"><ReactFlow onInit={setFlow} minZoom={0.1} fitViewOptions={{ maxZoom: 1, padding: 0.2 }} nodes={graph.nodes.map(node => ({ ...node, ...(positions[node.id] ? { position: positions[node.id]! } : {}), selected: node.id === selected }))} edges={graph.edges} fitView nodesConnectable={false} nodesDraggable onNodeDragStop={(_, node) => setPositions(previous => ({ ...previous, [node.id]: node.position }))} onNodeClick={(_, node) => select(node.id)} onlyRenderVisibleElements><Background /><Controls showInteractive={false} /></ReactFlow></div><details><summary>{t('tasks')}</summary><div className="ops-list">{rows(tasks)}</div></details></>}
          {view === 'agents' && <div className="ops-list"><SurfaceSection title="Ordo">{snapshot.agents.filter(agent => !run || agent.runRef === run).map(agent => <div className="ops-roster-row" key={agent.ref}><Button className="ops-row vk-btn" aria-pressed={selected === agent.ref} onClick={() => select(agent.ref)}><strong>{agent.label}</strong><span className="ops-muted">{stateLabel(agent.state)}</span></Button><div className="ops-muted">{agent.role} · {agent.runtime ?? '—'} · {agent.model ?? '—'}</div><div className="ops-list">{rows(tasks.filter(item => item.agentRefs.includes(agent.ref)))}</div></div>)}{!snapshot.agents.some(agent => !run || agent.runRef === run) && <SurfaceState phase="empty" title={t('empty')} />}</SurfaceSection>{Boolean(snapshot.sessionRoots?.length) && <details><summary>{t('nativeAgents')}</summary><ProjectSessionAgents roots={snapshot.sessionRoots ?? []} sessions={sessions} open={openSession} t={t} /></details>}</div>}
          {view === 'timeline' && <div className="ops-list"><p className="ops-muted">{t('bounded')} ({snapshot.window.eventLimit})</p>{snapshot.events.filter(event => (!run || event.runRef === run) && (!task || event.taskRef === task.ref) && (!agent || event.agentRef === agent.ref)).slice().reverse().map(event => <Button key={event.ref} className="ops-row vk-btn" onClick={() => select(event.taskRef ?? event.runRef)}><time>{event.at}</time><span>{event.kind}</span></Button>)}</div>}
        </div>
        {selected && <aside className="ops-details" aria-label={t('detail')}><Button className="vk-btn" onClick={() => { select(undefined); setPending(undefined) }}>{t('back')}</Button><h3 ref={detailHeading} tabIndex={-1}>{task?.title ?? agent?.label ?? selectedRun?.title}</h3><p>{stateLabel(task?.state ?? agent?.state ?? selectedRun?.state ?? '')}</p>
          {agent && <><p>{t('source')}: {agent.source} · {agent.role}</p><p>{t('runtime')}: {agent.runtime ?? '—'}</p><p>{t('model')}: {agent.model ?? '—'}</p><SurfaceSection title={t('tasks')}>{rows(agentTasks)}</SurfaceSection></>}
          {task && <><p>{t('verification')}: {task.verification ?? '—'}</p><p>{t('acceptedHint')}</p><SurfaceSection title={t('dependencies')}>{rows(snapshot.tasks.filter(item => task.dependencies.includes(item.ref)))}</SurfaceSection><SurfaceSection title={t('next')}>{rows(snapshot.tasks.filter(item => item.dependencies.includes(task.ref)))}</SurfaceSection><SurfaceSection title={t('blockers')}>{task.blockers.map(value => <p key={value}>{snapshot.tasks.find(item => item.ref === value)?.title ?? (value === 'lease_retained' ? t('leaseRetained') : value)}</p>)}</SurfaceSection><SurfaceSection title={t('attempts')}>{task.attempts.map(attempt => <p key={attempt.ref}>{attempt.runtime} · {attempt.state} · {attempt.ref}</p>)}</SurfaceSection><SurfaceSection title={t('artifacts')}>{task.artifacts.map(value => <p key={value}>{value}</p>)}</SurfaceSection><SurfaceSection title={t('evidence')}>{task.evidence.map(value => <p key={value}>{value}</p>)}</SurfaceSection></>}
          <SurfaceSection title={t('actions')}><SurfaceActionBar>{descriptorActions.map(action => <Button className="vk-btn" key={action.id} disabled={!canAct || Boolean(action.disabledReason)} title={action.disabledReason} onClick={() => act(action.id, action.targetRef)}>{t(actionLabels[action.id as keyof typeof actionLabels] ?? 'actions')}</Button>)}{!descriptorActions.length && <p>{t('noActions')}</p>}</SurfaceActionBar>{[...new Set(descriptorActions.map(action => action.disabledReason).filter(Boolean))].map(reason => <p key={reason} className="ops-muted">{reason === 'runtime_dispatch_contract_unavailable' ? t('executionUnavailable') : reason}</p>)}</SurfaceSection>
          {pending && <SurfaceSection title={t('confirm')}>{pending.version !== snapshot.version && <SurfaceState phase="stale" title={t('previewStale')} />}<p>{t('target')}: {pending.targetRef}</p><p>{pending.action}</p>{pending.action === 'plan.revise' && <ProjectPlanEditor key={pending.targetRef} controller={controller} targetRef={pending.targetRef} t={t} restored={savedDraft?.targetRef === pending.targetRef ? savedDraft.value : undefined} onChange={value => { setDraft(value); if (value) { const draftValue = ProjectDraftSchema.safeParse(JSON.parse(value)); if (draftValue.success) setSavedDraft({ targetRef: pending.targetRef, value: draftValue.data }) } }} />}{pending.action === 'run.start' && <><label className="ys-field">{t('approval')}<Input value={approval} onChange={event => setApproval(event.target.value)} /></label><label className="ys-field">{t('runtime')}<select value={runtime} onChange={event => setRuntime(event.target.value)}><option value="">—</option>{(snapshot.runtimeChoices ?? []).map(id => <option key={id}>{id}</option>)}</select></label><label className="ys-field"><input type="checkbox" checked={real} onChange={event => setReal(event.target.checked)} />{t('real')}</label></>}<SurfaceActionBar><Button className="vk-btn" onClick={closeAction}>{t('cancel')}</Button><Button className="vk-btn" disabled={!canAct || pending.version !== snapshot.version || (pending.action === 'plan.revise' && !draft) || (pending.action === 'run.start' && (!approval || !runtime || !real))} onClick={() => { void controller.invoke(pending.action, pending.targetRef, true, pending.action === 'run.start' ? { approval, runtime, real } : pending.action === 'plan.revise' ? { draft: draft! } : {}); closeAction() }}>{t('confirm')}</Button></SurfaceActionBar></SurfaceSection>}
        </aside>}
      </div>
    </>}
  </Surface>
}

export function ProjectPicker({ remote, t, restore, onRestore, sessions, openSession, subscribeReset }: { remote: ProjectRemote; t: ProjectTranslate; restore?: unknown; onRestore?: ((state: unknown) => boolean) | undefined; sessions?: ProjectSessionsFace | undefined; openSession?: ((ref: string) => void) | undefined; subscribeReset?: ((fn: () => void) => () => void) | undefined }): ReactNode {
  const remembered = useRef<Record<string, unknown>>({})
  const restored = useRef(false); const source = useRef(remote)
  const initial = useRef(restore as { projectRef?: unknown; activeProjectRef?: unknown; projects?: Record<string, unknown> } | undefined)
  if (!Object.keys(remembered.current).length && initial.current) {
    if (initial.current.projects && typeof initial.current.projects === 'object') for (const [ref, value] of Object.entries(initial.current.projects)) { const parsed = ProjectRestoreSchema.safeParse(value); if (parsed.success && parsed.data.projectRef === ref) remembered.current[ref] = parsed.data }
    const legacy = ProjectRestoreSchema.safeParse(initial.current); if (legacy.success) remembered.current[legacy.data.projectRef] = legacy.data
  }
  const [projects, setProjects] = useState<{ ref: string; title: string }[]>([]); const [controller, setController] = useState<ProjectController>(); const [failed, setFailed] = useState(false); const [loading, setLoading] = useState(true); const [reload, setReload] = useState(0)
  useEffect(() => { let alive = true; if (source.current !== remote) { source.current = remote; setController(undefined) }; setLoading(true); setFailed(false); void remote.projects().then(result => { if (alive) {
      setProjects(result.projects)
      const projectRef = initial.current?.activeProjectRef ?? initial.current?.projectRef
      if (!restored.current && typeof projectRef === 'string' && result.projects.some(project => project.ref === projectRef)) setController(new ProjectController(remote, projectRef))
      restored.current = true
    } }).catch(() => { if (alive) setFailed(true) }).finally(() => { if (alive) setLoading(false) }); return () => { alive = false } }, [remote, reload])
  useEffect(() => () => controller?.dispose(), [controller])
  const save = (value: unknown): boolean => {
    const parsed = ProjectRestoreSchema.safeParse(value)
    if (!parsed.success || parsed.data.projectRef !== controller?.projectRef) return false
    remembered.current[parsed.data.projectRef] = parsed.data
    return onRestore?.({ activeProjectRef: parsed.data.projectRef, projects: remembered.current }) ?? false
  }
  const picker = <label className="ys-field">{t('project')}<select aria-label={t('project')} value={controller?.projectRef ?? ''} onChange={event => {
    const projectRef = event.target.value
    setController(projectRef ? new ProjectController(remote, projectRef) : undefined)
    onRestore?.({ ...(projectRef ? { activeProjectRef: projectRef } : {}), projects: remembered.current })
  }}><option value="">{t('select')}</option>{projects.map(project => <option key={project.ref} value={project.ref}>{project.title}</option>)}</select></label>
  return controller
    ? <ProjectPane key={controller.projectRef} controller={controller} t={t} sessions={sessions} openSession={openSession} restore={remembered.current[controller.projectRef]} onRestore={save} selector={picker} subscribeReset={subscribeReset} />
     : <Surface kind="workspace" data-ordo-project-picker><style>{`[data-ordo-project-picker]{height:100%;min-height:0!important}[data-ordo-project-picker] .team-project-row{display:flex!important;justify-content:space-between!important;gap:var(--vk-gap-md);padding:var(--vk-gap-md);text-align:left;white-space:normal;overflow-wrap:anywhere}[data-ordo-project-picker] .team-project-row span:last-child{flex-shrink:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}`}</style><SurfaceContextBar title={t('title')} context={t('userScope')} description={t('projectHint')} actions={<Button className="vk-btn" disabled={loading} onClick={() => setReload(value => value + 1)}>{t('refresh')}</Button>} /><div className="ys-body">{picker}{loading || failed || !projects.length ? <SurfaceState phase={loading ? 'loading' : failed ? 'error' : 'empty'} title={t(loading ? 'loading' : failed ? 'unavailable' : 'select')} description={!loading && !projects.length ? t('register') : undefined} /> : <SurfaceSection title={`${t('registeredProjects')} · ${projects.length}`}><div className="ys-list">{projects.map(project => <Button key={project.ref} className="team-project-row vk-btn" onClick={() => { setController(new ProjectController(remote, project.ref)); onRestore?.({ activeProjectRef: project.ref, projects: remembered.current }) }}><span>{project.title}</span><span>{t('projectEntry')} →</span></Button>)}</div></SurfaceSection>}</div></Surface>
}

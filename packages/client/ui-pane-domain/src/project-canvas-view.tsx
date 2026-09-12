import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position, NodeResizer,
  useReactFlow, type Node, type NodeProps, type NodeChange, type Connection } from '@xyflow/react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceActionBar, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'
import type { ArtifactRefV1, PaneActionDescriptorV1, ProjectCanvasDocument, ProjectCanvasNode } from '@yeisme/dsh-pane-protocol'
import { ProjectCanvasController } from './project-canvas-controller.js'
import { searchProjectCanvas, orderProjectCanvasPositions } from './project-canvas.js'
import { inspectCanvasRunScope, type CanvasRunScope } from './project-canvas-workflow.js'
import flowCss from '@xyflow/react/dist/base.css?inline'

export const canvasZh = {
  inputReview: '输入已变化，需审阅',
  externalInputChanged: '上游输入已变化；本次仍引用原选定成果版本，请确认。',
  title: '项目画布', create: '创建画布', draft: '文字草稿', group: '分组框', material: '素材引用', operation: '操作步骤', result: '成果引用',
  save: '保存', clean: '已确认保存', dirty: '未保存', saving: '保存中', unknown: '保存结果待核对', conflict: '版本冲突：草稿已保留', error: '保存失败：草稿已保留',
  reconcile: '核对保存', reload: '重新读取', reapply: '在最新版上重存', discard: '丢弃未保存修改并重新读取？', cancel: '取消', confirm: '确认', close: '关闭',
  undo: '撤销', redo: '重做', copy: '复制选中', remove: '移除选中', search: '搜索对象', fit: '适配选区', reference: '参考关系', execution: '执行连接',
  connect: '连接输入', input: '输入参数', purpose: '输入用途', prompt: '提示词', referenceImage: '参考图', audio: '声音', asset: '素材',
  open: '打开专业面板', inspect: '检查运行范围', one: '单节点', branch: '选中分支', all: '完整流程',
  waiting: '等待项目画布服务', missing: '此项目还没有画布。创建后可添加草稿或引用。', invalid: '画布数据无法读取', forbidden: '当前项目不可访问', unavailable: '画布存储尚未连接',
  noArtifacts: '当前项目没有可引用的成果', noActions: '当前项目没有可配置的操作', invalidEdit: '修改未通过校验，原草稿已保留',
  selected: '选中对象', x: '横坐标', y: '纵坐标', width: '宽度', height: '高度', collapse: '折叠分组', expand: '展开分组',
  noExecution: '这里只检查草案。工作流执行尚未连接；没有提交或收费。', blockers: '需要处理的项', noBlockers: '结构检查通过，仍需 owner 校验权限、输入、费用和计划。',
  mediaUnavailable: '预览不可用', loading: '正在读取', inputUnavailable: '目标操作没有可映射输入', objects: '对象列表',
} as const
export type CanvasTextKey = keyof typeof canvasZh
export const canvasEn: Record<CanvasTextKey, string> = {
  inputReview: 'Inputs changed; review required',
  externalInputChanged: 'Upstream inputs changed; this scope still references the previously selected output version. Review it before running.',
  title: 'Project canvas', create: 'Create canvas', draft: 'Text draft', group: 'Group', material: 'Material reference', operation: 'Operation', result: 'Result reference',
  save: 'Save', clean: 'Save confirmed', dirty: 'Unsaved', saving: 'Saving', unknown: 'Save outcome unknown', conflict: 'Version conflict: draft retained', error: 'Save failed: draft retained',
  reconcile: 'Reconcile save', reload: 'Reload', reapply: 'Reapply on latest', discard: 'Discard unsaved changes and reload?', cancel: 'Cancel', confirm: 'Confirm', close: 'Close',
  undo: 'Undo', redo: 'Redo', copy: 'Copy selected', remove: 'Remove selected', search: 'Search objects', fit: 'Fit selection', reference: 'Reference relation', execution: 'Execution edge',
  connect: 'Connect input', input: 'Input field', purpose: 'Input purpose', prompt: 'Prompt', referenceImage: 'Reference image', audio: 'Audio', asset: 'Asset',
  open: 'Open professional pane', inspect: 'Inspect run scope', one: 'Single node', branch: 'Selected branch', all: 'Whole workflow',
  waiting: 'Waiting for project canvas service', missing: 'This project has no canvas. Create one to add drafts or references.', invalid: 'Canvas data cannot be read', forbidden: 'Project access unavailable', unavailable: 'Canvas storage is not connected',
  noArtifacts: 'No project artifacts are available', noActions: 'No configurable project actions are available', invalidEdit: 'Invalid edit: the previous draft was retained',
  selected: 'Selected object', x: 'X position', y: 'Y position', width: 'Width', height: 'Height', collapse: 'Collapse group', expand: 'Expand group',
  noExecution: 'Draft inspection only. Workflow execution is not connected; nothing was submitted or charged.', blockers: 'Items to resolve', noBlockers: 'Structure checks passed. Owner input, permission, cost and plan validation are still required.',
  mediaUnavailable: 'Preview unavailable', loading: 'Loading', inputUnavailable: 'The target action has no mappable inputs', objects: 'Object list',
}
export type CanvasTranslator = (key: CanvasTextKey) => string
type ResolveMedia = (artifact: ArtifactRefV1) => Promise<{ url: string; expiresAt: string } | undefined>
interface ViewProps {
  controller: ProjectCanvasController
  artifacts?: readonly ArtifactRefV1[]
  actions?: readonly PaneActionDescriptorV1[]
  resolveMedia?: ResolveMedia
  openProfessional?: (owner: string, artifact?: ArtifactRefV1) => void
  t?: CanvasTranslator
}
type CanvasFlowNode = Node<{ model: ProjectCanvasNode; controller: ProjectCanvasController; t: CanvasTranslator; resolveMedia?: ResolveMedia }, 'canvas'>
const styles = buildPanelStyles({ scope: 'project-canvas' }) + `
[data-project-canvas]{height:100%;min-height:360px;container-type:inline-size}
[data-project-canvas] .canvas-layout{display:flex;flex:1;min-height:300px;min-width:0}
[data-project-canvas] .canvas-stage{flex:1;min-width:0;min-height:300px}
[data-project-canvas] .canvas-detail{width:240px;max-width:45%;overflow:auto;padding:var(--vk-gap-md);border-left:1px solid var(--vk-border-l2)}
[data-project-canvas] .canvas-node{height:100%;width:100%;box-sizing:border-box;overflow:hidden;padding:var(--vk-gap-sm);background:var(--vk-bg-layer-1);color:var(--vk-text-primary);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
[data-project-canvas] .canvas-node[data-kind=group]{background:color-mix(in srgb,var(--vk-bg-layer-2) 40%,transparent);border-style:dashed}
[data-project-canvas] .canvas-node[data-selected=true]{border-color:var(--vk-border-focus)}
[data-project-canvas] .canvas-node img,[data-project-canvas] .canvas-node video{width:100%;max-height:110px;object-fit:contain}
[data-project-canvas] .canvas-node audio{width:100%}
[data-project-canvas] .canvas-node textarea{width:100%;height:75%;resize:none}
[data-project-canvas] .canvas-reference-edge path{stroke-dasharray:5 5}
[data-project-canvas] .react-flow__controls-button{background:var(--vk-bg-layer-1);color:var(--vk-text-primary);border:1px solid var(--vk-border-l2)}
[data-project-canvas] .canvas-list{display:grid;gap:var(--vk-gap-sm);padding:0;list-style:none}
[data-project-canvas] .react-flow{--xy-background-color:var(--vk-bg-base);--xy-node-background-color:var(--vk-bg-layer-1);--xy-node-color:var(--vk-text-primary);--xy-edge-stroke:var(--vk-text-tertiary);--xy-edge-stroke-selected:var(--vk-accent);--xy-controls-button-background-color:var(--vk-bg-layer-1);--xy-controls-button-color:var(--vk-text-primary);--xy-minimap-background-color:var(--vk-bg-layer-1);--xy-minimap-node-background-color:var(--vk-text-tertiary);--xy-minimap-mask-background-color:color-mix(in srgb,var(--vk-bg-base) 60%,transparent)}
@container(max-width:720px){[data-project-canvas] .canvas-detail{width:190px}}
@container(max-width:420px){[data-project-canvas] .canvas-layout{flex-direction:column}[data-project-canvas] .canvas-stage{min-height:320px}[data-project-canvas] .canvas-detail{width:auto;max-width:none;max-height:260px;border-left:0;border-top:1px solid var(--vk-border-l2)}}
`

function Media({ artifact, resolve, t }: { artifact: ArtifactRefV1; resolve?: ResolveMedia; t: CanvasTranslator }): ReactNode {
  const [url, setUrl] = useState<string>()
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout> | undefined
    setUrl(undefined)
    if (resolve !== undefined) void resolve(artifact).then(media => {
      const remaining = media === undefined ? 0 : Date.parse(media.expiresAt) - Date.now()
      if (!active || media === undefined || !/^(https?:|blob:)/i.test(media.url) || !Number.isFinite(remaining) || remaining <= 0) return
      setUrl(media.url); timer = setTimeout(() => { setUrl(undefined); video.current?.pause() }, Math.min(remaining, 2_147_483_647))
    }).catch(() => {})
    const element = video.current
    return () => { active = false; if (timer !== undefined) clearTimeout(timer); element?.pause() }
  }, [artifact.owner, artifact.ref, artifact.version, resolve])
  useEffect(() => { const element = video.current; return () => { element?.pause() } }, [url])
  if (url === undefined) return <span className="vk-muted">{artifact.mediaType} · {t('mediaUnavailable')}</span>
  if (artifact.mediaType.startsWith('image/')) return <img src={url} alt={artifact.title} loading="lazy" onError={() => setUrl(undefined)} />
  if (artifact.mediaType.startsWith('video/')) return <video ref={video} src={url} controls preload="metadata" className="nodrag nowheel" />
  if (artifact.mediaType.startsWith('audio/')) return <audio src={url} controls preload="metadata" className="nodrag nowheel" />
  return <span>{artifact.title}</span>
}

function CanvasNodeView({ data, selected }: NodeProps<CanvasFlowNode>): ReactNode {
  const { model, controller, t } = data
  const artifact = model.kind === 'material' || model.kind === 'result' ? model.artifact : model.kind === 'operation' ? model.selectedArtifact : undefined
  return <div className="canvas-node" data-kind={model.kind} data-selected={selected}>
    <NodeResizer isVisible={selected} minWidth={120} minHeight={80} onResizeStart={() => controller.beginGesture()} onResizeEnd={() => setTimeout(() => controller.endGesture(), 50)} />
    {model.kind !== 'group' && <Handle type="target" position={Position.Left} />}
    {model.kind !== 'group' && <Handle type="source" position={Position.Right} />}
    <strong>{model.title}</strong>
    {model.kind === 'operation' && model.inputReviewRequired && <span className="vk-muted" data-input-review-required>{t('inputReview')}</span>}
    {model.kind === 'draft' && <label className="ys-field vk-field"><textarea className="nodrag nowheel" aria-label={t('draft')} value={model.text} onChange={event => controller.edit({ type: 'text', id: model.id, text: event.target.value })} /></label>}
    {artifact !== undefined && <Media artifact={artifact} resolve={data.resolveMedia} t={t} />}
    {model.kind === 'operation' && <div className="vk-muted">{model.owner}</div>}
    {model.kind === 'group' && <Button className="vk-btn nodrag" onClick={() => controller.edit({ type: 'collapse', id: model.id, collapsed: !model.collapsed })}>{t(model.collapsed ? 'expand' : 'collapse')}</Button>}
  </div>
}
const nodeTypes = { canvas: CanvasNodeView }

function CanvasContent({ controller, artifacts = [], actions = [], resolveMedia, openProfessional, t = key => canvasZh[key] }: ViewProps): ReactNode {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const flow = useReactFlow<CanvasFlowNode>()
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [picker, setPicker] = useState<'material' | 'result' | 'operation'>()
  const [edgeKind, setEdgeKind] = useState<'reference' | 'execution'>('reference')
  const [connection, setConnection] = useState<Connection>()
  const [input, setInput] = useState('')
  const [purpose, setPurpose] = useState('reference-image')
  const [discard, setDiscard] = useState(false)
  const [runScope, setRunScope] = useState<CanvasRunScope['kind']>('branch')
  const flowGesture = useRef(false)
  const [preview, setPreview] = useState<{ document: ProjectCanvasDocument; selection: string; scope: CanvasRunScope['kind']; result: ReturnType<typeof inspectCanvasRunScope> }>()
  const editor = state.editor
  const document = editor?.document
  const selectionKey = JSON.stringify(editor?.selection ?? [])
  const inspection = preview?.document === document && preview?.selection === selectionKey && preview?.scope === runScope ? preview.result : undefined
  const choose = (ids: string[]) => controller.edit({ type: 'select', ids })
  const id = () => `node-${crypto.randomUUID()}`
  const add = (kind: 'draft' | 'group' | 'material' | 'result' | 'operation', item?: ArtifactRefV1 | PaneActionDescriptorV1) => {
    const position = flow.screenToFlowPosition({ x: 240, y: 180 })
    const base = { id: id(), title: item === undefined ? t(kind) : 'title' in item ? item.title : item.label, position, size: { width: kind === 'group' ? 480 : 240, height: kind === 'group' ? 300 : 180 } }
    const node: ProjectCanvasNode | undefined = kind === 'draft' ? { ...base, kind, text: '' } : kind === 'group' ? { ...base, kind, collapsed: false }
      : (kind === 'material' || kind === 'result') && item !== undefined && 'mediaType' in item ? { ...base, kind, artifact: item }
        : kind === 'operation' && item !== undefined && 'actionId' in item ? { ...base, kind, owner: item.owner, actionRef: item.descriptorRef, controls: item.owner === 'eikona' ? { modelRef: 'openai/gpt-5.4-image-2' } : {} } : undefined
    if (node !== undefined && controller.edit({ type: 'add', nodes: [node] })) choose([node.id])
    else setMessage(t('invalidEdit'))
    setPicker(undefined)
  }
  const nodes = useMemo<CanvasFlowNode[]>(() => (document?.nodes ?? []).map(model => {
    let parent = model.groupId; let hidden = false
    while (parent !== undefined) { const group = document!.nodes.find(node => node.id === parent); if (group?.kind === 'group' && group.collapsed) hidden = true; parent = group?.groupId }
    return { id: model.id, type: 'canvas', position: model.position, width: model.size.width, height: model.size.height,
      style: { width: model.size.width, height: model.size.height }, selected: editor!.selection.includes(model.id), hidden,
      zIndex: model.kind === 'group' ? -1 : 0, data: { model, controller, t, resolveMedia } }
  }), [document, editor?.selection, controller, t, resolveMedia])
  const nodeChanges = (changes: NodeChange<CanvasFlowNode>[]) => {
    const selected = new Set(controller.getSnapshot().editor?.selection ?? [])
    const currentDocument = controller.getSnapshot().editor?.document
    const gestureChanges = flowGesture.current ? changes : changes.filter(change => change.type !== 'position' && change.type !== 'dimensions')
    const ordered = currentDocument === undefined ? gestureChanges : [
      ...gestureChanges.filter(change => change.type !== 'position'),
      ...orderProjectCanvasPositions(currentDocument, gestureChanges.filter(change => change.type === 'position')),
    ]
    for (const change of ordered) {
      if (!('id' in change)) continue
      const current = controller.getSnapshot().editor?.document.nodes.find(node => node.id === change.id)
      if (change.type === 'select') { if (change.selected) selected.add(change.id); else selected.delete(change.id) }
      if (change.type === 'position' && change.position !== undefined && current !== undefined) controller.edit({ type: 'move', ids: [change.id], dx: change.position.x - current.position.x, dy: change.position.y - current.position.y })
      if (change.type === 'dimensions' && change.resizing && change.dimensions !== undefined) controller.edit({ type: 'resize', id: change.id, ...change.dimensions })
      if (change.type === 'remove') controller.edit({ type: 'remove', ids: [change.id] })
    }
    if (changes.some(change => change.type === 'select')) choose([...selected])
  }
  const copy = () => {
    if (document === undefined || editor === undefined) return
    const nodeIds = Object.fromEntries(document.nodes.map(node => [node.id, id()]))
    const edgeIds = Object.fromEntries(document.edges.map(edge => [edge.id, `edge-${crypto.randomUUID()}`]))
    if (!controller.edit({ type: 'copy', ids: editor.selection, nodeIds, edgeIds, dx: 30, dy: 30 })) setMessage(t('invalidEdit'))
  }
  const targetNode = document?.nodes.find(node => node.id === connection?.target)
  const fields = targetNode?.kind === 'operation' ? actions.find(action => action.descriptorRef === targetNode.actionRef)?.fields ?? [] : []
  const selected = document?.nodes.find(node => node.id === editor?.selection[0])
  const matches = document === undefined ? [] : searchProjectCanvas(document, query)
  const fit = () => void flow.fitView({ nodes: editor?.selection.length ? editor.selection.map(id => ({ id })) : undefined, duration: 0, padding: 0.2 })
  // React Flow may emit the final position/camera change after its stop
  // callback. End the history gesture in a microtask so the complete drag is
  // recorded as one undo step.
  const finishGesture = () => setTimeout(() => controller.endGesture(), 50)
  if (state.status !== 'ready' || editor === undefined || document === undefined) return <Surface kind="workspace" data-project-canvas="true"><style>{styles}</style><SurfaceState phase={state.status === 'loading' ? 'loading' : state.status === 'missing' ? 'empty' : 'error'} title={t(state.status === 'loading' ? 'loading' : state.status === 'error' || state.status === 'ready' ? 'invalid' : state.status)} />{state.status === 'missing' ? <Button className="vk-btn" onClick={() => controller.createDraft()}>{t('create')}</Button> : <Button className="vk-btn" onClick={() => void controller.load()}>{t('reload')}</Button>}</Surface>
  return <Surface kind="workspace" data-project-canvas="true" onKeyDown={event => {
    if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); controller.edit({ type: event.shiftKey ? 'redo' : 'undo' }) }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void controller.save() }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && editor.selection.length) {
      event.preventDefault(); copy()
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); fit() }
    // Keyboard equivalents for object-list operations: arrow nudge, tab cycle, delete.
    if (editor.selection.length && (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      controller.edit({ type: 'move', ids: editor.selection,
        dx: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
        dy: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 })
    }
    if (event.key === 'Tab' && matches.length) {
      event.preventDefault()
      const index = matches.indexOf(editor.selection[0] ?? '')
      const next = matches[(index + (event.shiftKey ? matches.length - 1 : 1) + matches.length) % matches.length]
      if (next !== undefined) choose([next])
    }
    if (event.key === 'Delete' && editor.selection.length) { event.preventDefault(); controller.edit({ type: 'remove', ids: editor.selection }) }
  }}>
    <style>{flowCss}</style><style>{styles}</style>
    <SurfaceContextBar
      title={t('title')}
      context={document.scope.projectRef}
      status={<span role="status">{t(state.saveStatus)}</span>}
    />
    <SurfaceActionBar>
      <Button className="vk-btn" onClick={() => add('draft')}>{t('draft')}</Button><Button className="vk-btn" onClick={() => add('group')}>{t('group')}</Button>
      <Button className="vk-btn" disabled={!artifacts.length} title={!artifacts.length ? t('noArtifacts') : undefined} onClick={() => setPicker('material')}>{t('material')}</Button>
      <Button className="vk-btn" disabled={!artifacts.length} onClick={() => setPicker('result')}>{t('result')}</Button>
      <Button className="vk-btn" disabled={!actions.length} title={!actions.length ? t('noActions') : undefined} onClick={() => setPicker('operation')}>{t('operation')}</Button>
      <Button className="vk-btn" disabled={!editor.past.length} onClick={() => controller.edit({ type: 'undo' })}>{t('undo')}</Button><Button className="vk-btn" disabled={!editor.future.length} onClick={() => controller.edit({ type: 'redo' })}>{t('redo')}</Button>
      <Button className="vk-btn" disabled={!editor.selection.length} onClick={copy}>{t('copy')}</Button><Button className="vk-btn" onClick={fit}>{t('fit')}</Button>
      <Button className="vk-btn" disabled={!state.dirty || state.saveStatus === 'saving' || state.saveStatus === 'unknown'} onClick={() => void controller.save()}>{t('save')}</Button>
      {state.saveStatus === 'unknown' && <Button className="vk-btn" onClick={() => void controller.reconcile()}>{t('reconcile')}</Button>}
      {state.saveStatus === 'conflict' && <Button className="vk-btn" onClick={() => controller.resolveConflict('reapply')}>{t('reapply')}</Button>}
      <Button className="vk-btn" disabled={state.saveStatus === 'saving' || state.saveStatus === 'unknown'} onClick={() => state.dirty ? setDiscard(true) : void controller.load()}>{t('reload')}</Button>
    </SurfaceActionBar>
    {message && <div role="alert">{message}</div>}
    <div className="canvas-layout"><div className="canvas-stage">
      <ReactFlow<CanvasFlowNode> nodes={nodes} nodeTypes={nodeTypes} edges={document.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.kind === 'reference' ? edge.label ?? t('reference') : edge.purpose, className: edge.kind === 'reference' ? 'canvas-reference-edge' : undefined }))}
        onNodesChange={nodeChanges} onEdgesChange={changes => { for (const change of changes) if (change.type === 'remove') controller.edit({ type: 'disconnect', id: change.id }) }}
        onNodeDragStart={() => { flowGesture.current = true; controller.beginGesture() }} onNodeDragStop={() => { finishGesture(); setTimeout(() => { flowGesture.current = false }, 50) }}
        onNodeDoubleClick={(_, node) => { const m = node.data.model; if (m.kind === 'material' || m.kind === 'result') openProfessional?.(m.artifact.owner, m.artifact); else if (m.kind === 'operation') openProfessional?.(m.owner) }}
        onConnect={value => { if (edgeKind === 'reference') controller.edit({ type: 'connect', edge: { id: `edge-${crypto.randomUUID()}`, kind: 'reference', source: value.source, target: value.target } }); else { setConnection(value); setInput('') } }}
        viewport={document.camera} onViewportChange={camera => controller.edit({ type: 'camera', camera })} onMoveStart={() => controller.beginGesture()} onMoveEnd={finishGesture}
        onlyRenderVisibleElements minZoom={0.05} maxZoom={4} deleteKeyCode={null}>
        <Background /><Controls showInteractive={false} /><MiniMap pannable zoomable />
      </ReactFlow>
    </div><aside className="canvas-detail">
      <label className="ys-field vk-field">{t('search')}<Input aria-label={t('search')} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="ys-field vk-field">{t('connect')}<select value={edgeKind} onChange={event => setEdgeKind(event.target.value as 'reference' | 'execution')}><option value="reference">{t('reference')}</option><option value="execution">{t('execution')}</option></select></label>
      <ul className="canvas-list" aria-label={t('objects')}>{document.nodes.filter(node => matches.includes(node.id)).map(node => <li key={node.id}><Button className="vk-btn" aria-pressed={editor.selection.includes(node.id)} onClick={() => { choose([node.id]); void flow.fitView({ nodes: [{ id: node.id }], duration: 0 }) }}>{node.title}</Button></li>)}</ul>
      {selected && <><strong>{t('selected')}: {selected.title}</strong>{(['x', 'y', 'width', 'height'] as const).map(field => <label className="ys-field vk-field" key={field}>{t(field)}<Input type="number" aria-label={t(field)} value={field === 'x' || field === 'y' ? selected.position[field] : selected.size[field]} onChange={event => {
        const value = event.target.valueAsNumber; if (!Number.isFinite(value)) return
        const ok = field === 'x' || field === 'y' ? controller.edit({ type: 'move', ids: [selected.id], dx: field === 'x' ? value - selected.position.x : 0, dy: field === 'y' ? value - selected.position.y : 0 }) : controller.edit({ type: 'resize', id: selected.id, width: field === 'width' ? value : selected.size.width, height: field === 'height' ? value : selected.size.height })
        if (!ok) setMessage(t('invalidEdit'))
      }} /></label>)}
      <label className="ys-field vk-field">{t('group')}<select value={selected.groupId ?? ''} onChange={event => { if (!controller.edit({ type: 'group', ids: editor.selection, groupId: event.target.value || undefined })) setMessage(t('invalidEdit')) }}><option value="">—</option>{document.nodes.filter(node => node.kind === 'group' && node.id !== selected.id).map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
      <Button className="vk-btn" onClick={() => controller.edit({ type: 'remove', ids: editor.selection })}>{t('remove')}</Button></>}
      {selected && selected.kind !== 'draft' && selected.kind !== 'group' && <Button className="vk-btn" disabled={openProfessional === undefined} onClick={() => {
        if (selected.kind === 'material' || selected.kind === 'result') openProfessional?.(selected.artifact.owner, selected.artifact)
        else if (selected.kind === 'operation') openProfessional?.(selected.owner)
      }}>{t('open')}</Button>}
      <label className="ys-field vk-field">{t('inspect')}<select value={runScope} onChange={event => setRunScope(event.target.value as CanvasRunScope['kind'])}><option value="node">{t('one')}</option><option value="branch">{t('branch')}</option><option value="all">{t('all')}</option></select></label>
      <Button className="vk-btn" onClick={() => setPreview({ document, selection: selectionKey, scope: runScope, result: inspectCanvasRunScope(document, runScope === 'all' ? { kind: 'all' } : runScope === 'node' ? { kind: 'node', nodeId: editor.selection[0] ?? '' } : { kind: 'branch', nodeIds: editor.selection }) })}>{t('inspect')}</Button>
      {inspection && <div role="status"><p>{t('noExecution')}</p><p>{inspection.blockers.length ? t('blockers') : t('noBlockers')}</p><ul>{inspection.notices.map(item => <li key={item.edgeId}>{t('externalInputChanged')} · {item.nodeId}</li>)}{inspection.blockers.map((item, i) => <li key={i}>{item.code} · {item.nodeId}</li>)}</ul></div>}
    </aside></div>
    <Modal open={picker !== undefined} onClose={() => setPicker(undefined)} title={picker ? t(picker) : t('title')} closeLabel={t('close')}><ul className="canvas-list">{picker === 'operation' ? actions.map(action => <li key={action.descriptorRef}><Button className="vk-btn" onClick={() => add('operation', action)}>{action.label}</Button></li>) : artifacts.map(artifact => <li key={`${artifact.owner}:${artifact.ref}:${artifact.version}`}><Button className="vk-btn" onClick={() => add(picker === 'result' ? 'result' : 'material', artifact)}>{artifact.title} · {artifact.version}</Button></li>)}</ul></Modal>
    <Modal open={connection !== undefined} onClose={() => setConnection(undefined)} title={t('connect')} closeLabel={t('close')} footer={<Button className="vk-btn" disabled={!input} onClick={() => {
      if (connection && controller.edit({ type: 'connect', edge: { id: `edge-${crypto.randomUUID()}`, kind: 'execution', source: connection.source, target: connection.target, input, output: 'selected', purpose } })) setConnection(undefined)
      else setMessage(t('invalidEdit'))
    }}>{t('confirm')}</Button>}><label className="ys-field vk-field">{t('input')}<select value={input} onChange={event => setInput(event.target.value)}><option value="">{t('input')}</option>{fields.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}</select></label>{!fields.length && <p>{t('inputUnavailable')}</p>}<label className="ys-field vk-field">{t('purpose')}<select value={purpose} onChange={event => setPurpose(event.target.value)}>{[['reference-image', 'referenceImage'], ['prompt', 'prompt'], ['audio', 'audio'], ['asset', 'asset']].map(([value, key]) => <option key={value} value={value}>{t(key as CanvasTextKey)}</option>)}</select></label></Modal>
    <Modal open={discard} onClose={() => setDiscard(false)} title={t('discard')} closeLabel={t('close')} footer={<><Button className="vk-btn" onClick={() => setDiscard(false)}>{t('cancel')}</Button><Button className="vk-btn" onClick={() => { setDiscard(false); void controller.load(true) }}>{t('confirm')}</Button></>} />
  </Surface>
}

export function ProjectCanvasView(props: ViewProps): ReactNode {
  return <ReactFlowProvider><CanvasContent {...props} /></ReactFlowProvider>
}

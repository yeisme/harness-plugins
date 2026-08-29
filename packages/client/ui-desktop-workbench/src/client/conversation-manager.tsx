/** Dense Web conversation organization and batch-management surface. */

import { useEffect, useMemo, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type {
  BatchActionV1,
  BatchPlanV1,
  SessionOrganizationRemoteFace,
  SessionOrganizationSnapshotV1,
} from '@yeisme/dsh-client-ui-session-tags/client'

export interface ConversationManagerSession {
  readonly sessionId: string
  readonly title: string
  readonly workspaceRef: string
  readonly workspaceName?: string | undefined
  readonly tags: readonly string[]
  readonly status: 'running' | 'attention' | 'completed' | 'idle'
  readonly archived: boolean
  readonly trashed?: boolean | undefined
  readonly updatedAt?: string | undefined
}

export interface ConversationManagerProps {
  readonly sessions: readonly ConversationManagerSession[]
  readonly organization: SessionOrganizationRemoteFace
  readonly searchHistory?: ((query: string) => Promise<readonly { readonly sessionId: string; readonly anchor?: string | undefined }[]>) | undefined
  readonly onOpenSession?: ((sessionId: string, anchor?: string) => void) | undefined
}

const EMPTY: SessionOrganizationSnapshotV1 = {
  ok: true, specVersion: '1.0', functionTypes: [], assignments: [], tagCatalog: [], rules: [], recentBatches: [],
}

export function ConversationManager({ sessions, organization, searchHistory, onOpenSession }: ConversationManagerProps) {
  const [snapshot, setSnapshot] = useState<SessionOrganizationSnapshotV1>(EMPTY)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [workspace, setWorkspace] = useState('all')
  const [functionType, setFunctionType] = useState('all')
  const [tag, setTag] = useState('all')
  const [lifecycle, setLifecycle] = useState('active')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [historyMatches, setHistoryMatches] = useState<ReadonlyMap<string, string | undefined>>(new Map())
  const [actionType, setActionType] = useState<'set-function' | 'add-tags' | 'remove-tags' | 'archive' | 'restore' | 'purge'>('set-function')
  const [actionValue, setActionValue] = useState('planning')
  const [plan, setPlan] = useState<BatchPlanV1>()
  const [confirmation, setConfirmation] = useState('')
  const [admin, setAdmin] = useState<{ token: string; expiresAt: number }>()
  const [busy, setBusy] = useState(false)
  const [ruleName, setRuleName] = useState('')
  const [ruleQuery, setRuleQuery] = useState('')

  const refresh = async (): Promise<void> => {
    try {
      const answer = await organization.snapshot()
      if (!answer.ok) throw new Error(answer.message)
      setSnapshot(answer)
      setPhase('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
      setPhase('error')
    }
  }

  useEffect(() => { void refresh() }, [organization])
  useEffect(() => {
    if (admin === undefined) return
    const remaining = Math.max(0, admin.expiresAt - Date.now())
    const timer = window.setTimeout(() => { setAdmin(undefined) }, remaining)
    return () => { window.clearTimeout(timer) }
  }, [admin])
  useEffect(() => {
    if (admin === undefined && actionType === 'purge') setActionType('archive')
  }, [admin, actionType])
  useEffect(() => {
    let live = true
    if (query.trim() === '' || searchHistory === undefined) {
      setHistoryMatches(new Map())
      return () => { live = false }
    }
    void searchHistory(query).then(results => {
      if (live) setHistoryMatches(new Map(results.map(item => [item.sessionId, item.anchor])))
    }, () => { if (live) setHistoryMatches(new Map()) })
    return () => { live = false }
  }, [query, searchHistory])

  const assignments = useMemo(() => new Map(snapshot.assignments.map(item => [item.sessionId, item])), [snapshot.assignments])
  const functions = useMemo(() => new Map(snapshot.functionTypes.map(item => [item.id, item])), [snapshot.functionTypes])
  const allTags = useMemo(() => [...new Set([...sessions.flatMap(item => item.tags), ...snapshot.tagCatalog.map(item => item.name)])].sort(), [sessions, snapshot.tagCatalog])
  const visible = useMemo(() => sessions.filter(session => {
    const assignment = assignments.get(session.sessionId)
    if (workspace !== 'all' && session.workspaceRef !== workspace) return false
    if (functionType !== 'all' && (assignment?.functionTypeId ?? 'unclassified') !== functionType) return false
    if (tag !== 'all' && !session.tags.includes(tag)) return false
    if (lifecycle === 'active' && (session.archived || session.trashed === true)) return false
    if (lifecycle === 'archived' && !session.archived) return false
    if (lifecycle === 'trash' && session.trashed !== true) return false
    const q = query.trim().toLocaleLowerCase()
    if (q === '') return true
    const metadata = `${session.title} ${session.workspaceName ?? session.workspaceRef} ${session.tags.join(' ')} ${functions.get(assignment?.functionTypeId ?? '')?.name ?? ''}`.toLocaleLowerCase()
    return metadata.includes(q) || historyMatches.has(session.sessionId)
  }), [sessions, assignments, workspace, functionType, tag, lifecycle, query, functions, historyMatches])

  const selectedRows = visible.filter(item => selected.has(item.sessionId))
  const selectedAll = visible.length > 0 && visible.every(item => selected.has(item.sessionId))

  const toggle = (sessionId: string): void => {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(sessionId)) next.delete(sessionId); else next.add(sessionId)
      return next
    })
  }

  const makeAction = (): BatchActionV1 | undefined => {
    if (actionType === 'set-function') return actionValue === '' ? undefined : { type: actionType, functionTypeId: actionValue }
    if (actionType === 'add-tags' || actionType === 'remove-tags') {
      const tags = actionValue.split(',').map(value => value.normalize('NFKC').trim()).filter(Boolean)
      return tags.length === 0 ? undefined : { type: actionType, tags }
    }
    return { type: actionType }
  }

  const preview = async (): Promise<void> => {
    const action = makeAction()
    if (action === undefined || selectedRows.length === 0) return
    setBusy(true)
    const result = await organization.planBatch({
      targets: selectedRows.map(item => ({ sessionId: item.sessionId, workspaceRef: item.workspaceRef })),
      action,
    })
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    setPlan(result.plan)
    setConfirmation('')
  }

  const execute = async (): Promise<void> => {
    if (plan === undefined) return
    setBusy(true)
    const result = await organization.executeBatch({
      planId: plan.id,
      decisionRef: plan.decisionRef,
      ...(confirmation === '' ? {} : { confirmationText: confirmation }),
      ...(admin === undefined ? {} : { adminToken: admin.token }),
    })
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    setMessage(`批次完成：${result.receipt.items.filter(item => item.status === 'ok').length}/${result.receipt.items.length}`)
    setPlan(undefined)
    setSelected(new Set())
    await refresh()
  }

  const unlock = async (): Promise<void> => {
    const result = await organization.unlockAdmin()
    if (!result.ok) { setMessage(result.message); return }
    setAdmin({ token: result.token, expiresAt: result.expiresAt })
  }

  const addRule = async (): Promise<void> => {
    if (ruleName.trim() === '' || ruleQuery.trim() === '') return
    const action = makeAction()
    if (action === undefined || action.type === 'restore' || action.type === 'purge') return
    const ruleAction = action.type === 'set-function'
      ? { setFunctionTypeId: action.functionTypeId }
      : action.type === 'add-tags'
        ? { addTags: action.tags }
        : action.type === 'remove-tags'
          ? { removeTags: action.tags }
          : { proposeArchive: true }
    const result = await organization.putRule({
      value: {
        id: globalThis.crypto?.randomUUID?.() ?? `rule-${Date.now()}`,
        name: ruleName.trim(),
        order: snapshot.rules.length,
        enabled: true,
        condition: { query: ruleQuery.trim(), ...(workspace === 'all' ? {} : { workspaceRefs: [workspace] }) },
        action: ruleAction,
      },
      ifVersion: null,
    })
    if (!result.ok) { setMessage(result.message); return }
    setRuleName('')
    setRuleQuery('')
    await refresh()
  }

  if (phase === 'loading') return <Surface kind="workspace" data-dsh-conversation-manager><div className="ys-body"><SurfaceState phase="loading" title="正在加载对话管理" description="读取组织目录与批次历史…" data-dsh-panel-empty /></div></Surface>
  if (phase === 'error') return <Surface kind="workspace" data-dsh-conversation-manager><div className="ys-body"><SurfaceState phase="error" title="对话管理不可用" description={message} action={<Button type="button" size="sm" variant="toolbar" onClick={() => { setPhase('loading'); void refresh() }}>重试</Button>} data-dsh-panel-empty /></div></Surface>

  return (
    <Surface kind="workspace" data-dsh-conversation-manager onKeyDown={event => { if (event.key === 'Escape') setPlan(undefined) }}>
      <SurfaceContextBar title="对话管理" description="按 Workspace、功能类型和标签整理会话；所有批量变更先预览。" status={<span data-dsh-session-count>{visible.length} 条</span>} />
      <div className="ys-body">

      <div data-dsh-conversation-filters>
        <label className="ys-field"><span>搜索</span><input type="search" value={query} onChange={event => { setQuery(event.currentTarget.value) }} placeholder="标题、标签或对话内容" /></label>
        <label className="ys-field"><span>Workspace</span><select value={workspace} onChange={event => { setWorkspace(event.currentTarget.value) }}><option value="all">全部</option>{[...new Map(sessions.map(item => [item.workspaceRef, item.workspaceName ?? item.workspaceRef])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="ys-field"><span>功能</span><select value={functionType} onChange={event => { setFunctionType(event.currentTarget.value) }}><option value="all">全部</option><option value="unclassified">未分类</option>{snapshot.functionTypes.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="ys-field"><span>标签</span><select value={tag} onChange={event => { setTag(event.currentTarget.value) }}><option value="all">全部</option>{allTags.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="ys-field"><span>状态</span><select value={lifecycle} onChange={event => { setLifecycle(event.currentTarget.value) }}><option value="active">活跃</option><option value="archived">归档</option><option value="trash">回收站</option><option value="all">全部</option></select></label>
      </div>

      <div className="ys-field" data-dsh-conversation-batchbar>
        <strong>已选 {selectedRows.length}</strong>
        <select aria-label="批量动作" value={actionType} onChange={event => { setActionType(event.currentTarget.value as typeof actionType) }}>
          <option value="set-function">设置功能</option><option value="add-tags">添加标签</option><option value="remove-tags">移除标签</option><option value="archive">归档</option><option value="restore">恢复</option>{admin !== undefined && <option value="purge">永久删除</option>}
        </select>
        {actionType === 'set-function'
          ? <select aria-label="目标功能" value={actionValue} onChange={event => { setActionValue(event.currentTarget.value) }}>{snapshot.functionTypes.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          : actionType === 'add-tags' || actionType === 'remove-tags'
            ? <input aria-label="批量标签" value={actionValue} onChange={event => { setActionValue(event.currentTarget.value) }} placeholder="逗号分隔" /> : null}
        {admin === undefined && <Button type="button" size="sm" variant="toolbar" onClick={() => { void unlock() }}>临时解锁管理员</Button>}
        <Button type="button" size="sm" variant="primary" disabled={selectedRows.length === 0 || busy || (actionType === 'purge' && admin === undefined)} title={selectedRows.length === 0 ? '请先选择至少一个会话' : undefined} onClick={() => { void preview() }}>预览批次</Button>
      </div>

      {message !== '' && <p role="status" data-dsh-conversation-message>{message}</p>}
      {visible.length === 0 ? <div data-dsh-panel-empty><strong>没有匹配的会话</strong><span>调整筛选条件或检查 history capability。</span></div> : (
        <div data-dsh-conversation-table-wrap><table data-dsh-conversation-table><thead><tr><th><input aria-label="选择全部当前结果" type="checkbox" checked={selectedAll} onChange={() => { setSelected(selectedAll ? new Set() : new Set(visible.map(item => item.sessionId))) }} /></th><th>会话</th><th>Workspace</th><th>功能</th><th>标签</th><th>状态</th><th>更新</th></tr></thead><tbody>{visible.map(session => {
          const assignment = assignments.get(session.sessionId)
          return <tr key={session.sessionId} data-selected={selected.has(session.sessionId)}><td><input aria-label={`选择 ${session.title}`} type="checkbox" checked={selected.has(session.sessionId)} onChange={() => { toggle(session.sessionId) }} /></td><td><button type="button" onClick={() => { onOpenSession?.(session.sessionId, historyMatches.get(session.sessionId)) }}>{session.title}</button>{assignment?.classificationStatus === 'needs_review' && <small>待确认</small>}</td><td>{session.workspaceName ?? session.workspaceRef}</td><td><span data-function-color={functions.get(assignment?.functionTypeId ?? '')?.color ?? 'muted'}>{functions.get(assignment?.functionTypeId ?? '')?.name ?? '未分类'}</span></td><td>{session.tags.length === 0 ? '—' : session.tags.join(' · ')}</td><td>{session.trashed ? '回收站' : session.archived ? '已归档' : session.status}</td><td>{session.updatedAt ?? '—'}</td></tr>
        })}</tbody></table></div>
      )}

      <section data-dsh-conversation-rules><header><div><h3>自动规则</h3><p>分类与标签可自动执行，归档始终需要批次确认。</p></div><span>{snapshot.rules.length} 条</span></header><div data-dsh-rule-form><input aria-label="规则名称" value={ruleName} onChange={event => { setRuleName(event.currentTarget.value) }} placeholder="规则名称" /><input aria-label="规则关键词" value={ruleQuery} onChange={event => { setRuleQuery(event.currentTarget.value) }} placeholder="标题/可见文本关键词" /><button type="button" onClick={() => { void addRule() }}>保存当前分类规则</button></div><ul>{snapshot.rules.map(rule => <li key={rule.id}><strong>{rule.name}</strong><span>{rule.enabled ? '启用' : '停用'} · {rule.condition.query ?? '组合条件'}</span></li>)}</ul></section>

      <section data-dsh-conversation-history><header><h3>最近批次</h3><span>保留 30 天</span></header><ul>{snapshot.recentBatches.length === 0 ? <li>暂无批次记录</li> : snapshot.recentBatches.map(receipt => <li key={receipt.id}><span>{receipt.action.type} · {receipt.status} · {receipt.items.length} 项</span>{receipt.undoExpiresAt !== null && receipt.undoExpiresAt > Date.now() && <button type="button" onClick={() => { void organization.undoBatch({ receiptId: receipt.id }).then(async result => { setMessage(result.ok ? `已撤销 ${result.receipt.items.filter(item => item.status === 'ok').length} 项` : result.message); await refresh() }) }}>撤销</button>}</li>)}</ul></section>

      </div>
      <Modal open={plan !== undefined} onClose={() => { setPlan(undefined) }} title="确认批次" closeLabel="关闭确认批次" {...(plan === undefined ? {} : { description: `${plan.action.type} 将作用于 ${plan.targets.length} 个会话。`, footer: <><Button type="button" size="sm" variant="toolbar" onClick={() => { setPlan(undefined) }}>取消</Button><Button type="button" size="sm" variant="primary" disabled={busy || (plan.confirmationText !== undefined && confirmation !== plan.confirmationText)} onClick={() => { void execute() }}>执行</Button></> })}>
        {plan?.confirmationText !== undefined && <label className="ys-field" data-dsh-conversation-dialog><span>输入 {plan.confirmationText}</span><input autoFocus value={confirmation} onChange={event => { setConfirmation(event.currentTarget.value) }} /></label>}
      </Modal>
    </Surface>
  )
}

export default ConversationManager

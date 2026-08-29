/**
 * Session Sidebar for the Desktop Workbench.
 *
 * This component consumes a `SessionManagerHostV1` and renders a searchable,
 * workspace-grouped session list with archive/trash, continue/pause, and fork
 * actions. It does not talk to DSH directly; mutations go through the host
 * contract so the UI is testable.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type {
  SessionManagerHostV1,
  SessionMutationReceiptV1,
  SessionSummaryV1,
} from '@yeisme/dsh-session-manager'

export interface SessionLineageBadge {
  readonly origin: 'edit' | 'retry' | 'fork' | 'unknown'
  readonly text: string
}

export interface SessionSidebarProps {
  /** Session manager host adapter. */
  host: SessionManagerHostV1
  /** Called when the user asks to open a session. */
  onOpenSession?: ((sessionId: string) => void) | undefined
  /** Called after every mutation receipt, including failures. */
  onMutation?: ((receipt: SessionMutationReceiptV1) => void) | undefined
  /** Optional rewrite/fork lineage badge. Unknown origins stay unlabeled. */
  lineageOf?: ((session: SessionSummaryV1) => SessionLineageBadge) | undefined
}

interface SessionGroup {
  readonly key: string
  readonly label: string
  readonly sessions: readonly SessionSummaryV1[]
}

function groupSessions(sessions: readonly SessionSummaryV1[]): SessionGroup[] {
  const map = new Map<string, SessionGroup>()
  for (const session of sessions) {
    const key = session.workspaceRef ?? 'ungrouped'
    const label = session.workspaceName ?? session.workspaceRef ?? '未分组'
    const existing = map.get(key)
    if (existing === undefined) {
      map.set(key, { key, label, sessions: [session] })
    } else {
      map.set(key, { ...existing, sessions: [...existing.sessions, session] })
    }
  }
  return [...map.values()]
}

function filterSessions(sessions: readonly SessionSummaryV1[], query: string): readonly SessionSummaryV1[] {
  const q = query.trim().toLocaleLowerCase()
  if (q.length === 0) return sessions
  return sessions.filter(session =>
    session.title?.toLocaleLowerCase().includes(q) === true ||
    session.workspaceName?.toLocaleLowerCase().includes(q) === true ||
    session.labels.some(label => label.toLocaleLowerCase().includes(q))
  )
}

export function SessionSidebar({ host, onOpenSession, onMutation, lineageOf }: SessionSidebarProps) {
  const [sessions, setSessions] = useState<readonly SessionSummaryV1[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const next = await host.listSessions()
      setSessions(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // Only initial load; host changes are expected to be passed as new props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host])

  const filtered = useMemo(() => filterSessions(sessions, query), [sessions, query])
  const active = useMemo(() => filtered.filter(session => !session.archived), [filtered])
  const archived = useMemo(() => filtered.filter(session => session.archived), [filtered])
  const activeGroups = useMemo(() => groupSessions(active), [active])
  const archivedGroups = useMemo(() => groupSessions(archived), [archived])

  const runMutation = async (action: (sessionId: string) => Promise<SessionMutationReceiptV1>, sessionId: string): Promise<void> => {
    const receipt = await action(sessionId)
    onMutation?.(receipt)
    await refresh()
  }

  const statusLabel = (session: SessionSummaryV1): string => {
    if (session.running) return '运行中'
    if (session.unread) return '未读'
    if (session.pendingInteraction) return '等待输入'
    if (session.completed) return '已完成'
    return '空闲'
  }

  const statusState = (session: SessionSummaryV1): 'running' | 'attention' | 'completed' | 'idle' => {
    if (session.running) return 'running'
    if (session.unread || session.pendingInteraction) return 'attention'
    if (session.completed) return 'completed'
    return 'idle'
  }

  const renderRow = (session: SessionSummaryV1): JSX.Element => {
    const lineage = lineageOf?.(session)
    return (
    <li key={session.sessionId} data-session-id={session.sessionId} data-dsh-session-row>
      <button type="button" data-dsh-session-primary onClick={() => onOpenSession?.(session.sessionId)}>
        <span data-dsh-session-title>{session.title ?? session.sessionId}</span>
        <span data-dsh-session-state={statusState(session)}>{statusLabel(session)}</span>
      </button>
      {lineage !== undefined && lineage.origin !== 'unknown' && (
        <span data-dsh-session-lineage={lineage.origin} title={lineage.text}>{lineage.text}</span>
      )}
      {session.labels.length > 0 && <span data-dsh-session-labels>{session.labels.join(' · ')}</span>}
      <div data-dsh-session-actions>
        {session.running ? (
          <button type="button" onClick={() => void runMutation(host.pauseSession, session.sessionId)}>暂停</button>
        ) : (
          <button type="button" onClick={() => void runMutation(host.resumeSession, session.sessionId)}>继续</button>
        )}
        <button type="button" onClick={() => void runMutation(host.forkSession, session.sessionId)}>分支</button>
        {session.archived ? (
          <>
            <button type="button" onClick={() => void runMutation(host.restoreSession, session.sessionId)}>恢复</button>
            <button type="button" data-dsh-session-action="danger" onClick={() => void runMutation(host.purgeSession, session.sessionId)}>彻底删除</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => void runMutation(host.archiveSession, session.sessionId)}>归档</button>
            <button type="button" data-dsh-session-action="danger" onClick={() => void runMutation(host.trashSession, session.sessionId)}>删除</button>
          </>
        )}
      </div>
    </li>
  )
  }

  const renderGroup = (group: SessionGroup): JSX.Element => (
    <section key={group.key} aria-label={group.label} data-dsh-session-group={group.key}>
      <h4>{group.label}</h4>
      <ul>{group.sessions.map(renderRow)}</ul>
    </section>
  )

  return (
    <Surface kind="navigator" role="complementary" aria-label="Sessions" data-dsh-session-sidebar>
      <SurfaceContextBar title="会话" description="跨工作区管理运行记录" status={<span data-dsh-session-count aria-label={`${active.length} 个活跃会话`}>{active.length}</span>} />
      <label className="ys-field" data-dsh-session-search>
        <span>搜索会话</span>
        <Input
          type="search"
          aria-label="搜索会话"
          placeholder="标题、标签或工作区"
          value={query}
          onChange={event => { setQuery(event.currentTarget.value) }}
        />
      </label>
      <div data-dsh-session-scroll>
        {loading && <SurfaceState phase="loading" title="正在加载会话" description="请稍候…" data-dsh-panel-empty />}
        {error !== null && <SurfaceState phase="error" title="会话加载失败" description={error} data-dsh-panel-empty />}
        {!loading && error === null && activeGroups.length === 0 && archivedGroups.length === 0 && (
          <SurfaceState phase="empty" title="还没有可管理的会话" description="接入会话服务后，活跃与归档记录会显示在这里。" data-dsh-panel-empty />
        )}
        {activeGroups.map(renderGroup)}
        {archivedGroups.length > 0 && (
          <details data-dsh-archived-sessions>
            <summary>已归档（{archived.length}）</summary>
            {archivedGroups.map(renderGroup)}
          </details>
        )}
      </div>
    </Surface>
  )
}

export default SessionSidebar

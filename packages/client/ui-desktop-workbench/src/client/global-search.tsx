/**
 * Global Search for the Desktop Workbench.
 *
 * Searches all sessions (including archived) by title, labels, and workspace
 * through the `SessionManagerHostV1`. This is a thin client projection; DSH
 * remains the canonical history owner.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

import { useEffect, useMemo, useState } from 'react'
import type { SessionManagerHostV1, SessionSummaryV1 } from '@yeisme/dsh-session-manager'

export interface GlobalSearchProps {
  /** Session manager host adapter. */
  host: SessionManagerHostV1
  /** Called when the user opens a search result. */
  onOpenSession?: ((sessionId: string) => void) | undefined
}

function matches(session: SessionSummaryV1, query: string): boolean {
  const q = query.trim().toLocaleLowerCase()
  if (q.length === 0) return true
  return (
    session.title?.toLocaleLowerCase().includes(q) === true ||
    session.workspaceName?.toLocaleLowerCase().includes(q) === true ||
    session.labels.some(label => label.toLocaleLowerCase().includes(q))
  )
}

export function GlobalSearch({ host, onOpenSession }: GlobalSearchProps) {
  const [sessions, setSessions] = useState<readonly SessionSummaryV1[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void host.listSessions().then(
      next => {
        if (cancelled) return
        setSessions(next)
        setLoading(false)
      },
      caught => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : String(caught))
        setLoading(false)
      },
    )
    return () => { cancelled = true }
  }, [host])

  const results = useMemo(() => sessions.filter(session => matches(session, query)), [sessions, query])

  return (
    <section aria-label="Global search" data-dsh-global-search>
      <header data-dsh-panel-heading>
        <div>
          <h2>历史搜索</h2>
          <p>跨工作区查找活跃与归档会话。</p>
        </div>
        <span data-dsh-session-count>{results.length} 条</span>
      </header>
      <label data-dsh-search-field>
        <span>搜索历史会话</span>
        <input
          type="search"
          aria-label="搜索历史会话"
          placeholder="标题、标签或工作区"
          value={query}
          onChange={event => { setQuery(event.currentTarget.value) }}
        />
      </label>
      {loading && <div data-dsh-panel-empty><strong>正在检索历史</strong><span>请稍候…</span></div>}
      {error !== null && <div role="alert" data-dsh-panel-empty><strong>历史加载失败</strong><span>{error}</span></div>}
      {!loading && error === null && results.length === 0 && (
        <div data-dsh-panel-empty>
          <strong>没有匹配的会话</strong>
          <span>尝试缩短关键词，或改用工作区与标签名称。</span>
        </div>
      )}
      {!loading && error === null && results.length > 0 && (
        <ul>
          {results.map(session => (
            <li key={session.sessionId}>
              <button type="button" onClick={() => onOpenSession?.(session.sessionId)}>
                {session.title ?? session.sessionId}
              </button>
              <span>{session.workspaceName ?? session.workspaceRef ?? '未分组'}</span>
              {session.archived && <span>已归档</span>}
              {session.labels.length > 0 && <span>{session.labels.join(' · ')}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default GlobalSearch

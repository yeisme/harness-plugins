/**
 * Git Pane. Typed status / diff / stage / unstage / commit over the
 * workspace host. Arbitrary argv is rejected by the host contract.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'

export interface GitStatusFileV1 {
  readonly path: string
  readonly index: string
  readonly worktree: string
}

export interface GitStatusV1 {
  readonly branch: string
  readonly files: readonly GitStatusFileV1[]
}

export interface GitDiffV1 {
  readonly path: string
  readonly patch: string
  readonly truncated: boolean
}

export interface GitMutationReceiptV1 {
  readonly status: 'ok' | 'rejected'
  readonly actionId: string
  readonly reason?: string
}

export interface GitHostFace {
  readonly capabilities?: readonly string[]
  status(): Promise<GitStatusV1>
  diff?(path: string): Promise<GitDiffV1>
  stage?(path: string): Promise<GitMutationReceiptV1>
  unstage?(path: string): Promise<GitMutationReceiptV1>
  commit?(message: string): Promise<GitMutationReceiptV1>
}

export interface GitPaneProps {
  readonly host: GitHostFace
}

const styles: Record<string, CSSProperties> = {
  root: { display: 'grid', alignContent: 'start', gap: 12, minHeight: '100%', padding: 12, color: 'var(--dsw-alias-label-primary, #f2f2f4)', fontFamily: 'var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)', fontSize: 'var(--dsh-wb-font-size, 14px)' },
  heading: { margin: 0, fontSize: 'calc(var(--dsh-wb-font-size, 14px) + 2px)', fontWeight: 680 },
  meta: { color: 'var(--dsw-alias-label-tertiary, #92929b)', fontSize: 'calc(var(--dsh-wb-font-size, 14px) - 2px)' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  row: { display: 'grid', gridTemplateColumns: 'minmax(72px, auto) minmax(0, 1fr) auto', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8, font: 'calc(var(--dsh-wb-font-size, 14px) - 1px)/1.4 ui-monospace, SFMono-Regular, Menlo, monospace' },
  empty: { padding: 12, color: 'var(--dsw-alias-label-tertiary, #92929b)' },
  button: { minHeight: 28, padding: '0 10px', borderRadius: 7, border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))', background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit' },
  input: { minHeight: 28, minWidth: 160, flex: 1, padding: '0 10px', borderRadius: 7, border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))', background: 'var(--dsw-alias-bg-layer-1, #232324)', color: 'inherit', font: 'inherit' },
  diff: { margin: 0, maxHeight: 240, overflow: 'auto', padding: 10, borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1, #232324)', whiteSpace: 'pre-wrap', font: 'calc(var(--dsh-wb-font-size, 14px) - 2px)/1.45 ui-monospace, SFMono-Regular, Menlo, monospace' },
  actions: { display: 'flex', gap: 4 },
}

function describeChange(file: GitStatusFileV1): string {
  if (file.index === '?' && file.worktree === '?') return '未跟踪'
  if (file.index === 'A') return '已暂存新增'
  if (file.index === 'M' && file.worktree === ' ') return '已暂存修改'
  if (file.index === ' ' && file.worktree === 'M') return '已修改'
  if (file.index === 'M' || file.worktree === 'M') return '已修改'
  if (file.index === 'D' || file.worktree === 'D') return '已删除'
  return `${file.index}${file.worktree}`
}

function canStage(file: GitStatusFileV1): boolean {
  return file.worktree !== ' ' && file.worktree !== ''
}

function canUnstage(file: GitStatusFileV1): boolean {
  return file.index !== ' ' && file.index !== '?' && file.index !== ''
}

export function GitPane({ host }: GitPaneProps) {
  const [status, setStatus] = useState<GitStatusV1>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [diff, setDiff] = useState<GitDiffV1>()
  const typed = (host.capabilities ?? []).includes('GitTypedActionsCapabilityV1')
    && host.stage !== undefined && host.unstage !== undefined && host.commit !== undefined

  const refresh = useCallback(() => {
    setLoading(true)
    setError(undefined)
    void host.status().then(next => {
      setStatus(next)
      setLoading(false)
    }, caught => {
      setError(caught instanceof Error ? caught.message : String(caught))
      setLoading(false)
    })
  }, [host])
  useEffect(() => { refresh() }, [refresh])

  const run = useCallback(async (action: () => Promise<GitMutationReceiptV1>): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const receipt = await action()
      if (receipt.status !== 'ok') {
        setError(receipt.reason ?? `${receipt.actionId} 未完成`)
        return
      }
      refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }, [refresh])

  return (
    <section data-dsh-git-pane data-git-capability={typed ? 'typed' : 'status-only'} style={styles.root}>
      <header>
        <h2 style={styles.heading}>Git</h2>
        <p style={styles.meta}>{status === undefined ? '工作区状态' : status.branch}</p>
      </header>
      <div style={styles.toolbar}>
        <button type="button" style={styles.button} onClick={refresh} disabled={busy}>刷新</button>
        {typed && (
          <>
            <input style={styles.input} value={message} placeholder="提交说明" aria-label="Commit message" disabled={busy} onChange={event => { setMessage(event.target.value) }} />
            <button type="button" style={styles.button} disabled={busy || message.trim() === '' || host.commit === undefined} onClick={() => { const trimmed = message.trim(); if (host.commit === undefined || trimmed === '') return; void run(() => host.commit!(trimmed)).then(() => { setMessage('') }) }}>提交</button>
          </>
        )}
      </div>
      {!typed && <p style={styles.empty} data-dsh-git-contract>当前仅支持查看状态。暂存、取消暂存和提交需要 GitTypedActionsCapabilityV1。</p>}
      {loading && <p style={styles.empty}>正在读取 git status…</p>}
      {error !== undefined && <p role="alert" style={styles.empty}>{error}</p>}
      {!loading && error === undefined && (status?.files.length ?? 0) === 0 && <p style={styles.empty}>工作区干净。</p>}
      <div>
        {status?.files.map(file => (
          <div key={file.path} style={styles.row} data-dsh-git-file>
            <span>{describeChange(file)}</span>
            <strong title={file.path}>{file.path}</strong>
            <div style={styles.actions}>
              {host.diff !== undefined && <button type="button" style={styles.button} disabled={busy} onClick={() => { void host.diff!(file.path).then(setDiff, caught => { setError(caught instanceof Error ? caught.message : String(caught)) }) }}>差异</button>}
              {typed && canStage(file) && <button type="button" style={styles.button} disabled={busy} onClick={() => void run(() => host.stage!(file.path))}>暂存</button>}
              {typed && canUnstage(file) && <button type="button" style={styles.button} disabled={busy} onClick={() => void run(() => host.unstage!(file.path))}>取消暂存</button>}
            </div>
          </div>
        ))}
      </div>
      {diff !== undefined && <pre style={styles.diff} data-dsh-git-diff>{diff.patch === '' ? `${diff.path} 没有未暂存差异。` : diff.patch}{diff.truncated ? '\n…truncated' : ''}</pre>}
    </section>
  )
}

export default GitPane

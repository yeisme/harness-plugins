/**
 * Interaction space view (P1/P3). Pure projection of one controller
 * snapshot: degrade strip, anchor bar, directive timeline, per-format diff
 * proposals with per-hunk approval, and the attached session panel. The view
 * owns no state beyond local input drafts.
 *
 * @module @yeisme/dsh-client-ui-interaction-space/view
 */

import { useEffect, useState } from 'react'
import type { InteractionSpaceController, InteractionSpaceSnapshot } from './controller.ts'

const styles = {
  root: { display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', height: '100%', minHeight: 0, background: 'var(--dsw-alias-bg-base, #171719)', color: 'var(--dsw-alias-text-primary, #ececf1)' },
  header: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))' },
  title: { margin: 0, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  badge: { fontSize: 10, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.14))' },
  body: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 0.36fr)', minHeight: 0, overflow: 'hidden' },
  main: { display: 'grid', gridTemplateRows: 'minmax(0, 1.2fr) minmax(0, 1fr)', minHeight: 0, overflow: 'hidden', gap: 8, padding: 10 },
  panel: { display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0, border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08))', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1, #1e1e20)', overflow: 'hidden' },
  panelTitle: { padding: '8px 10px', fontSize: 11, fontWeight: 650, borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08))', display: 'flex', gap: 8, alignItems: 'center' },
  scroll: { overflow: 'auto', padding: 8 },
  anchorRow: { display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, padding: '4px 6px', borderRadius: 6 },
  timelineRow: { fontSize: 11, padding: '4px 6px', borderRadius: 6, borderLeft: '2px solid var(--dsw-alias-border-l2, rgba(255,255,255,.14))', marginBottom: 4 },
  proposalCard: { border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))', borderRadius: 8, padding: 10, marginBottom: 8, display: 'grid', gap: 8 },
  diffGrid: { display: 'grid', gap: 2, font: '11px/1.5 var(--ds-font-family-code, ui-monospace, monospace)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  del: { background: 'rgba(248,113,113,.14)', color: '#f87171', padding: '1px 6px', borderRadius: 4 },
  ins: { background: 'rgba(74,222,128,.14)', color: '#4ade80', padding: '1px 6px', borderRadius: 4 },
  button: { fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.14))', background: 'transparent', color: 'inherit', cursor: 'pointer' },
  input: { fontSize: 12, minHeight: 28, padding: '0 8px', color: 'inherit', background: 'var(--dsw-alias-bg-layer-2, #29292c)', border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))', borderRadius: 7 },
  degrade: { padding: '4px 10px', fontSize: 10, background: 'rgba(251,191,36,.12)', color: '#fbbf24' },
} as const

function anchorSummary(anchor: InteractionSpaceSnapshot['anchors'][number]): string {
  switch (anchor.kind) {
    case 'file-range': return `L${anchor.startLine}-${anchor.endLine}`
    case 'markdown-range': return `MD L${anchor.sourceStartLine}-${anchor.sourceEndLine}`
    case 'image-region': return `图 ${(anchor.x * 100).toFixed(0)},${(anchor.y * 100).toFixed(0)} ${(anchor.width * 100).toFixed(0)}×${(anchor.height * 100).toFixed(0)}%`
    case 'image-point': return `图点 ${(anchor.x * 100).toFixed(0)},${(anchor.y * 100).toFixed(0)}%`
    case 'table-range': return `表 ${anchor.sheetId} R${anchor.rowFrom}-${anchor.rowTo}C${anchor.colFrom}-${anchor.colTo}`
    default: return anchor.kind
  }
}

function ProposalDiff({ proposal }: { readonly proposal: InteractionSpaceSnapshot['proposals'][number] }) {
  const { payload } = proposal.proposal
  if (payload.format === 'text-hunk') {
    return (
      <div style={styles.diffGrid}>
        {payload.hunks.map((hunk, index) => (
          <div key={index} style={{ display: 'grid', gap: 2 }}>
            <span style={{ opacity: 0.6 }}>{`L${hunk.startLine}-${hunk.endLine}`}</span>
            <span style={styles.del}>{`- ${hunk.before}`}</span>
            <span style={styles.ins}>{`+ ${hunk.after}`}</span>
          </div>
        ))}
      </div>
    )
  }
  if (payload.format === 'table-cells') {
    return (
      <div style={styles.diffGrid}>
        {payload.cells.map((cell, index) => (
          <div key={index}>
            <span style={{ opacity: 0.6 }}>{`R${cell.row}C${cell.col}: `}</span>
            <span style={styles.del}>{cell.before}</span>
            <span> → </span>
            <span style={styles.ins}>{cell.after}</span>
          </div>
        ))}
      </div>
    )
  }
  if (payload.format === 'image-pair') {
    return <p style={{ margin: 0, fontSize: 11, opacity: 0.8 }}>{`图片对比 ${payload.beforeRef} → ${payload.afterRef}（短时 URL 由宿主解析）`}</p>
  }
  return (
    <div style={styles.diffGrid}>
      <span style={styles.del}>{payload.beforeText}</span>
      <span style={styles.ins}>{payload.afterText}</span>
    </div>
  )
}

function ProposalCard({ controller, state }: { readonly controller: InteractionSpaceController; readonly state: InteractionSpaceSnapshot['proposals'][number] }) {
  const snapshot = controller.getSnapshot()
  const hunkKeys = controller.proposalHunkKeys(state.proposal.proposalId)
  const dispatchAvailable = snapshot.dispatchAvailable
  const reviewable = state.lifecycle === 'review'
  return (
    <article data-dsh-space-proposal={state.proposal.proposalId} data-lifecycle={state.lifecycle} style={styles.proposalCard}>
      <header style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>{state.proposal.safeSummary}</strong>
        <span style={styles.badge}>{state.proposal.payload.format}</span>
        <span style={styles.badge}>{state.lifecycle}</span>
      </header>
      <ProposalDiff proposal={state} />
      {reviewable && hunkKeys.map(key => (
        <div key={key} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
          <span style={{ minWidth: 64 }}>{key}</span>
          <button type="button" style={styles.button} aria-pressed={state.decisions[key] === 'approved'} onClick={() => { void controller.decideHunk(state.proposal.proposalId, key, 'approved') }}>通过</button>
          <button type="button" style={styles.button} aria-pressed={state.decisions[key] === 'rejected'} onClick={() => { void controller.decideHunk(state.proposal.proposalId, key, 'rejected') }}>拒绝</button>
          <button type="button" style={styles.button} aria-pressed={state.decisions[key] === 'revision_requested'} onClick={() => { void controller.decideHunk(state.proposal.proposalId, key, 'revision_requested') }}>返修</button>
        </div>
      ))}
      {reviewable && (
        <button
          type="button"
          style={styles.button}
          disabled={!dispatchAvailable}
          title={dispatchAvailable ? undefined : 'owner-adapter-unavailable'}
          onClick={() => { void controller.applyProposal(state.proposal.proposalId) }}
        >
          应用（preview-before-mutate）
        </button>
      )}
      {state.error !== undefined && <p role="alert" style={{ margin: 0, fontSize: 11, color: '#f87171' }}>{state.error}</p>}
      {state.receiptRef !== undefined && <p style={{ margin: 0, fontSize: 11, color: '#4ade80' }}>{`receipt ${state.receiptRef}`}</p>}
    </article>
  )
}

function SessionPanel({ controller, snapshot }: { readonly controller: InteractionSpaceController; readonly snapshot: InteractionSpaceSnapshot }) {
  const [draft, setDraft] = useState('')
  const [anchorIds, setAnchorIds] = useState<readonly string[]>([])
  const [intent, setIntent] = useState<'ask' | 'comment' | 'edit'>('ask')
  const [notice, setNotice] = useState<string>()
  useEffect(() => { setNotice(undefined) }, [snapshot.sessionId])
  if (snapshot.sessionPhase === 'unresolvable' || snapshot.sessionPhase === 'empty') {
    return (
      <p role="status" data-dsh-space-session={snapshot.sessionPhase} style={{ margin: 0, padding: 10, fontSize: 11, opacity: 0.8 }}>
        {snapshot.sessionPhase === 'empty' ? '未附着会话。' : `会话不可用（${snapshot.sessionError ?? 'needs_contract'}）`}
      </p>
    )
  }
  return (
    <div data-dsh-space-session={snapshot.sessionPhase} style={{ display: 'grid', gap: 6, padding: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={styles.badge}>{snapshot.sessionRunning ? '运行中' : '空闲'}</span>
        <button type="button" style={styles.button} onClick={() => { void controller.cancelSession() }}>取消</button>
        <button type="button" style={styles.button} onClick={() => { void controller.forkSession() }}>Fork</button>
        <button type="button" style={styles.button} onClick={() => { controller.detachSession() }}>分离</button>
      </div>
      <input aria-label="发送到附着会话" placeholder="向附着会话提问…" value={draft} style={styles.input} onChange={event => { setDraft(event.currentTarget.value) }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['ask', 'comment', 'edit'] as const).map(value => (
          <button key={value} type="button" style={styles.button} aria-pressed={intent === value} onClick={() => { setIntent(value) }}>{value}</button>
        ))}
        {snapshot.anchors.map(anchor => (
          <button
            key={anchor.anchorId}
            type="button"
            style={{ ...styles.button, ...(anchorIds.includes(anchor.anchorId) ? { borderColor: '#79b8ff' } : {}) }}
            aria-pressed={anchorIds.includes(anchor.anchorId)}
            onClick={() => { setAnchorIds(current => current.includes(anchor.anchorId) ? current.filter(id => id !== anchor.anchorId) : [...current, anchor.anchorId]) }}
          >
            {anchor.marker !== undefined ? `#${anchor.marker}` : anchorSummary(anchor)}
          </button>
        ))}
        <button
          type="button"
          style={styles.button}
          onClick={() => {
            void controller.sendToAgent({ intent, text: draft, anchorIds }).then(result => {
              if (result.ok) setDraft('')
              else setNotice(result.error ?? '发送失败')
            })
          }}
        >
          发送（锚点附着）
        </button>
      </div>
      {notice !== undefined && <p role="alert" style={{ margin: 0, fontSize: 11, color: '#fbbf24' }}>{notice}</p>}
    </div>
  )
}

/** 交互空间主视图：一层壳 + 锚点/提案/时间线/会话投影。 */
export function InteractionSpaceView({ controller }: { readonly controller: InteractionSpaceController }) {
  const [snapshot, setSnapshot] = useState(controller.getSnapshot())
  useEffect(() => {
    const dispose = controller.subscribe(() => { setSnapshot(controller.getSnapshot()) })
    return () => { dispose() }
  }, [controller])
  const degrades: string[] = []
  if (!snapshot.composerAvailable) degrades.push('composer-adapter-unavailable')
  if (snapshot.sessionPhase === 'unresolvable') degrades.push(snapshot.sessionError ?? 'needs_contract')
  if (!snapshot.dispatchAvailable) degrades.push('owner-adapter-unavailable')
  return (
    <section data-dsh-interaction-space aria-label={snapshot.title} data-resource-key={snapshot.resourceKey} style={styles.root}>
      <header style={styles.header}>
        <h2 style={styles.title}>{snapshot.title}</h2>
        <span style={styles.badge}>{snapshot.version}</span>
        {snapshot.drifted && <span style={{ ...styles.badge, borderColor: '#fbbf24', color: '#fbbf24' }}>drifted</span>}
      </header>
      {degrades.length > 0 && (
        <div role="status" data-dsh-space-degrades style={styles.degrade}>{degrades.join(' · ')}</div>
      )}
      <div style={styles.body}>
        <div style={styles.main}>
          <div style={styles.panel}>
            <div style={styles.panelTitle}><span>提案</span><span style={styles.badge}>{snapshot.proposals.length}</span></div>
            <div style={styles.scroll}>
              {snapshot.proposals.length === 0
                ? <p role="status" style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>暂无提案。选中锚点后向 agent 提问，或等待 agent 的 space.propose。</p>
                : snapshot.proposals.map(state => <ProposalCard key={state.proposal.proposalId} controller={controller} state={state} />)}
            </div>
          </div>
          <div style={styles.panel}>
            <div style={styles.panelTitle}><span>时间线</span><span style={styles.badge}>{snapshot.timeline.length}</span></div>
            <div style={styles.scroll}>
              {snapshot.timeline.length === 0
                ? <p role="status" style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>directive 与 receipt 将按时间序滚动（最多 200 条）。</p>
                : snapshot.timeline.slice().reverse().map(entry => (
                  <div key={entry.id} data-dsh-space-timeline={entry.kind} style={styles.timelineRow}>
                    <span style={{ opacity: 0.6 }}>{entry.at.slice(11, 19)} </span>
                    <span>{entry.summary}</span>
                    {entry.rejection !== undefined && <span style={{ color: '#f87171' }}>{`（${entry.rejection.detail}）`}</span>}
                  </div>
                ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', minHeight: 0, borderLeft: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))' }}>
          <div style={styles.panelTitle}><span>锚点</span><span style={styles.badge}>{snapshot.anchors.length}</span></div>
          <div style={styles.scroll}>
            {snapshot.anchors.length === 0
              ? <p role="status" style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>在渲染面选中区域生成锚点（表格/文本/图片）。</p>
              : snapshot.anchors.map(anchor => (
                <div key={anchor.anchorId} style={styles.anchorRow} data-dsh-space-anchor={anchor.anchorId} data-freshness={anchor.freshness}>
                  <span>{anchor.marker !== undefined ? `#${anchor.marker}` : '·'}</span>
                  <span>{anchorSummary(anchor)}</span>
                  {anchor.freshness !== 'fresh' && <span style={{ color: '#fbbf24' }}>{anchor.freshness}</span>}
                  <button type="button" style={{ ...styles.button, marginLeft: 'auto' }} aria-label={`移除锚点 ${anchor.anchorId}`} onClick={() => { controller.removeAnchor(anchor.anchorId) }}>×</button>
                </div>
              ))}
          </div>
          <SessionPanel controller={controller} snapshot={snapshot} />
        </div>
      </div>
    </section>
  )
}

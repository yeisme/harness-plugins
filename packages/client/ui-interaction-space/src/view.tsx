/**
 * Interaction space view (P1/P3). Pure projection of one controller
 * snapshot: degrade strip, anchor bar, directive timeline, per-format diff
 * proposals with per-hunk approval, and the attached session panel. The view
 * owns no state beyond local input drafts.
 *
 * @module @yeisme/dsh-client-ui-interaction-space/view
 */

import { useEffect, useState } from 'react'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import type { InteractionSpaceController, InteractionSpaceSnapshot } from './controller.ts'

const interactionSpaceStyles = `
.dsh-interaction-space{display:grid;grid-template-rows:auto auto minmax(0,1fr);height:100%;min-height:0}
.dsh-interaction-space__header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--vk-border-l2)}
.dsh-interaction-space__title{min-width:0;margin:0;overflow:hidden;font-size:var(--vk-font-heading);font-weight:700;text-overflow:ellipsis;white-space:nowrap}
.dsh-interaction-space__badge{display:inline-flex;align-items:center;min-height:20px;padding:2px 6px;color:var(--vk-text-secondary);font-size:var(--vk-font-small);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
.dsh-interaction-space__badge--drifted{color:var(--vk-tone-warn);border-color:color-mix(in srgb,var(--vk-tone-warn) 58%,var(--vk-border-l2))}
.dsh-interaction-space__body{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,.36fr);min-height:0;overflow:hidden}
.dsh-interaction-space__main{display:grid;grid-template-rows:minmax(0,1.2fr) minmax(0,1fr);min-height:0;padding:10px;overflow:hidden;gap:8px}
.dsh-interaction-space__panel{display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;overflow:hidden;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-lg)}
.dsh-interaction-space__panel-title{display:flex;align-items:center;gap:8px;padding:8px 10px;font-size:var(--vk-font-small);font-weight:650;border-bottom:1px solid var(--vk-border-l1)}
.dsh-interaction-space__scroll{padding:8px;overflow:auto}
.dsh-interaction-space__anchor-row{display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:var(--vk-font-small);border-radius:var(--vk-radius-md)}
.dsh-interaction-space__timeline-row{margin-bottom:4px;padding:4px 6px;font-size:var(--vk-font-small);border-left:2px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
.dsh-interaction-space__proposal-card{display:grid;gap:8px;margin-bottom:8px;padding:10px;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg)}
.dsh-interaction-space__proposal-header,.dsh-interaction-space__decision-row,.dsh-interaction-space__session-actions,.dsh-interaction-space__option-row{display:flex;align-items:center;gap:6px}
.dsh-interaction-space__proposal-header{gap:8px}.dsh-interaction-space__proposal-header strong{font-size:var(--vk-font-body)}
.dsh-interaction-space__decision-row{font-size:var(--vk-font-small)}.dsh-interaction-space__decision-key{min-width:64px}
.dsh-interaction-space__diff-grid{display:grid;gap:2px;overflow-wrap:anywhere;font:var(--vk-font-small)/1.5 var(--vk-font-code);white-space:pre-wrap}
.dsh-interaction-space__diff-hunk{display:grid;gap:2px}.dsh-interaction-space__muted{color:var(--vk-text-tertiary)}
.dsh-interaction-space__diff-del,.dsh-interaction-space__diff-ins{padding:1px 6px;border-radius:var(--vk-radius-sm)}
.dsh-interaction-space__diff-del{color:var(--vk-tone-critical);background:color-mix(in srgb,var(--vk-tone-critical) 14%,transparent)}
.dsh-interaction-space__diff-ins{color:var(--vk-tone-positive);background:color-mix(in srgb,var(--vk-tone-positive) 14%,transparent)}
.dsh-interaction-space__button{min-height:28px;padding:3px 10px;color:inherit;font:inherit;font-size:var(--vk-font-small);cursor:pointer;background:transparent;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
.dsh-interaction-space__button:hover:not(:disabled){background:var(--vk-fill-hover)}.dsh-interaction-space__button[aria-pressed='true']{border-color:var(--vk-tone-info)}.dsh-interaction-space__button:disabled{cursor:not-allowed;opacity:.55}
.dsh-interaction-space__input{min-height:30px;padding:0 8px;color:inherit;font:inherit;font-size:var(--vk-font-body);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
.dsh-interaction-space__degrade{padding:4px 10px;color:var(--vk-tone-warn);font-size:var(--vk-font-small);background:color-mix(in srgb,var(--vk-tone-warn) 12%,transparent)}
.dsh-interaction-space__copy{margin:0;font-size:var(--vk-font-small)}.dsh-interaction-space__copy--muted{padding:10px;color:var(--vk-text-tertiary)}
.dsh-interaction-space__copy--error{color:var(--vk-tone-critical)}.dsh-interaction-space__copy--success{color:var(--vk-tone-positive)}.dsh-interaction-space__copy--warn{color:var(--vk-tone-warn)}
.dsh-interaction-space__session{display:grid;gap:6px;padding:8px}.dsh-interaction-space__option-row{flex-wrap:wrap}
.dsh-interaction-space__sidebar{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-height:0;border-left:1px solid var(--vk-border-l2)}
.dsh-interaction-space__remove{margin-left:auto}
@container yeisme-surface (max-width:640px){.dsh-interaction-space__body{grid-template-columns:1fr;overflow:auto}.dsh-interaction-space__main{overflow:visible}.dsh-interaction-space__sidebar{border-top:1px solid var(--vk-border-l2);border-left:0}}
`

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
      <div className="dsh-interaction-space__diff-grid">
        {payload.hunks.map((hunk, index) => (
          <div key={index} className="dsh-interaction-space__diff-hunk">
            <span className="dsh-interaction-space__muted">{`L${hunk.startLine}-${hunk.endLine}`}</span>
            <span className="dsh-interaction-space__diff-del">{`- ${hunk.before}`}</span>
            <span className="dsh-interaction-space__diff-ins">{`+ ${hunk.after}`}</span>
          </div>
        ))}
      </div>
    )
  }
  if (payload.format === 'table-cells') {
    return (
      <div className="dsh-interaction-space__diff-grid">
        {payload.cells.map((cell, index) => (
          <div key={index}>
            <span className="dsh-interaction-space__muted">{`R${cell.row}C${cell.col}: `}</span>
            <span className="dsh-interaction-space__diff-del">{cell.before}</span>
            <span> → </span>
            <span className="dsh-interaction-space__diff-ins">{cell.after}</span>
          </div>
        ))}
      </div>
    )
  }
  if (payload.format === 'image-pair') {
    return <p className="dsh-interaction-space__copy dsh-interaction-space__muted">{`图片对比 ${payload.beforeRef} → ${payload.afterRef}（短时 URL 由宿主解析）`}</p>
  }
  return (
    <div className="dsh-interaction-space__diff-grid">
      <span className="dsh-interaction-space__diff-del">{payload.beforeText}</span>
      <span className="dsh-interaction-space__diff-ins">{payload.afterText}</span>
    </div>
  )
}

function ProposalCard({ controller, state }: { readonly controller: InteractionSpaceController; readonly state: InteractionSpaceSnapshot['proposals'][number] }) {
  const snapshot = controller.getSnapshot()
  const hunkKeys = controller.proposalHunkKeys(state.proposal.proposalId)
  const dispatchAvailable = snapshot.dispatchAvailable
  const reviewable = state.lifecycle === 'review'
  return (
    <article data-dsh-space-proposal={state.proposal.proposalId} data-lifecycle={state.lifecycle} className="dsh-interaction-space__proposal-card">
      <header className="dsh-interaction-space__proposal-header">
        <strong>{state.proposal.safeSummary}</strong>
        <span className="dsh-interaction-space__badge">{state.proposal.payload.format}</span>
        <span className="dsh-interaction-space__badge">{state.lifecycle}</span>
      </header>
      <ProposalDiff proposal={state} />
      {reviewable && hunkKeys.map(key => (
        <div key={key} className="dsh-interaction-space__decision-row">
          <span className="dsh-interaction-space__decision-key">{key}</span>
          <button type="button" className="dsh-interaction-space__button" aria-pressed={state.decisions[key] === 'approved'} onClick={() => { void controller.decideHunk(state.proposal.proposalId, key, 'approved') }}>通过</button>
          <button type="button" className="dsh-interaction-space__button" aria-pressed={state.decisions[key] === 'rejected'} onClick={() => { void controller.decideHunk(state.proposal.proposalId, key, 'rejected') }}>拒绝</button>
          <button type="button" className="dsh-interaction-space__button" aria-pressed={state.decisions[key] === 'revision_requested'} onClick={() => { void controller.decideHunk(state.proposal.proposalId, key, 'revision_requested') }}>返修</button>
        </div>
      ))}
      {reviewable && (
        <button
          type="button"
          className="dsh-interaction-space__button"
          disabled={!dispatchAvailable}
          title={dispatchAvailable ? undefined : 'owner-adapter-unavailable'}
          onClick={() => { void controller.applyProposal(state.proposal.proposalId) }}
        >
          应用（preview-before-mutate）
        </button>
      )}
      {state.error !== undefined && <p role="alert" className="dsh-interaction-space__copy dsh-interaction-space__copy--error">{state.error}</p>}
      {state.receiptRef !== undefined && <p className="dsh-interaction-space__copy dsh-interaction-space__copy--success">{`receipt ${state.receiptRef}`}</p>}
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
      <p role="status" data-dsh-space-session={snapshot.sessionPhase} className="dsh-interaction-space__copy dsh-interaction-space__copy--muted">
        {snapshot.sessionPhase === 'empty' ? '未附着会话。' : `会话不可用（${snapshot.sessionError ?? 'needs_contract'}）`}
      </p>
    )
  }
  return (
    <div data-dsh-space-session={snapshot.sessionPhase} className="dsh-interaction-space__session">
      <div className="dsh-interaction-space__session-actions">
        <span className="dsh-interaction-space__badge">{snapshot.sessionRunning ? '运行中' : '空闲'}</span>
        <button type="button" className="dsh-interaction-space__button" onClick={() => { void controller.cancelSession() }}>取消</button>
        <button type="button" className="dsh-interaction-space__button" onClick={() => { void controller.forkSession() }}>Fork</button>
        <button type="button" className="dsh-interaction-space__button" onClick={() => { controller.detachSession() }}>分离</button>
      </div>
      <input aria-label="发送到附着会话" placeholder="向附着会话提问…" value={draft} className="dsh-interaction-space__input" onChange={event => { setDraft(event.currentTarget.value) }} />
      <div className="dsh-interaction-space__option-row">
        {(['ask', 'comment', 'edit'] as const).map(value => (
          <button key={value} type="button" className="dsh-interaction-space__button" aria-pressed={intent === value} onClick={() => { setIntent(value) }}>{value}</button>
        ))}
        {snapshot.anchors.map(anchor => (
          <button
            key={anchor.anchorId}
            type="button"
            className="dsh-interaction-space__button"
            aria-pressed={anchorIds.includes(anchor.anchorId)}
            onClick={() => { setAnchorIds(current => current.includes(anchor.anchorId) ? current.filter(id => id !== anchor.anchorId) : [...current, anchor.anchorId]) }}
          >
            {anchor.marker !== undefined ? `#${anchor.marker}` : anchorSummary(anchor)}
          </button>
        ))}
        <button
          type="button"
          className="dsh-interaction-space__button"
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
      {notice !== undefined && <p role="alert" className="dsh-interaction-space__copy dsh-interaction-space__copy--warn">{notice}</p>}
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
    <Surface kind="workspace" className="dsh-interaction-space" data-dsh-interaction-space aria-label={snapshot.title} data-resource-key={snapshot.resourceKey}>
      <style data-dsh-interaction-space-styles dangerouslySetInnerHTML={{ __html: interactionSpaceStyles }} />
      <header className="dsh-interaction-space__header">
        <h2 className="dsh-interaction-space__title">{snapshot.title}</h2>
        <span className="dsh-interaction-space__badge">{snapshot.version}</span>
        {snapshot.drifted && <span className="dsh-interaction-space__badge dsh-interaction-space__badge--drifted">drifted</span>}
      </header>
      {degrades.length > 0 && (
        <div role="status" data-dsh-space-degrades className="dsh-interaction-space__degrade">{degrades.join(' · ')}</div>
      )}
      <div className="dsh-interaction-space__body">
        <div className="dsh-interaction-space__main">
          <div className="dsh-interaction-space__panel">
            <div className="dsh-interaction-space__panel-title"><span>提案</span><span className="dsh-interaction-space__badge">{snapshot.proposals.length}</span></div>
            <div className="dsh-interaction-space__scroll">
              {snapshot.proposals.length === 0
                ? <p role="status" className="dsh-interaction-space__copy dsh-interaction-space__muted">暂无提案。选中锚点后向 agent 提问，或等待 agent 的 space.propose。</p>
                : snapshot.proposals.map(state => <ProposalCard key={state.proposal.proposalId} controller={controller} state={state} />)}
            </div>
          </div>
          <div className="dsh-interaction-space__panel">
            <div className="dsh-interaction-space__panel-title"><span>时间线</span><span className="dsh-interaction-space__badge">{snapshot.timeline.length}</span></div>
            <div className="dsh-interaction-space__scroll">
              {snapshot.timeline.length === 0
                ? <p role="status" className="dsh-interaction-space__copy dsh-interaction-space__muted">directive 与 receipt 将按时间序滚动（最多 200 条）。</p>
                : snapshot.timeline.slice().reverse().map(entry => (
                  <div key={entry.id} data-dsh-space-timeline={entry.kind} className="dsh-interaction-space__timeline-row">
                    <span className="dsh-interaction-space__muted">{entry.at.slice(11, 19)} </span>
                    <span>{entry.summary}</span>
                    {entry.rejection !== undefined && <span className="dsh-interaction-space__copy--error">{`（${entry.rejection.detail}）`}</span>}
                  </div>
                ))}
            </div>
          </div>
        </div>
        <div className="dsh-interaction-space__sidebar">
          <div className="dsh-interaction-space__panel-title"><span>锚点</span><span className="dsh-interaction-space__badge">{snapshot.anchors.length}</span></div>
          <div className="dsh-interaction-space__scroll">
            {snapshot.anchors.length === 0
              ? <p role="status" className="dsh-interaction-space__copy dsh-interaction-space__muted">在渲染面选中区域生成锚点（表格/文本/图片）。</p>
              : snapshot.anchors.map(anchor => (
                <div key={anchor.anchorId} className="dsh-interaction-space__anchor-row" data-dsh-space-anchor={anchor.anchorId} data-freshness={anchor.freshness}>
                  <span>{anchor.marker !== undefined ? `#${anchor.marker}` : '·'}</span>
                  <span>{anchorSummary(anchor)}</span>
                  {anchor.freshness !== 'fresh' && <span className="dsh-interaction-space__copy--warn">{anchor.freshness}</span>}
                  <button type="button" className="dsh-interaction-space__button dsh-interaction-space__remove" aria-label={`移除锚点 ${anchor.anchorId}`} onClick={() => { controller.removeAnchor(anchor.anchorId) }}>×</button>
                </div>
              ))}
          </div>
          <SessionPanel controller={controller} snapshot={snapshot} />
        </div>
      </div>
    </Surface>
  )
}

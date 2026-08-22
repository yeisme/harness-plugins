/** Local Pane view for the Subagent Monitor. */
import { createElement, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { SubagentMonitorController } from './controller.js'
import type { SubagentPaneNodeV1, SubagentStatus } from './projection.js'

export interface SubagentMonitorViewProps {
  readonly controller: SubagentMonitorController
}

const SUBAGENT_STYLES = `
[data-pane-subagent-monitor]{display:flex;min-width:0;min-height:100%;height:100%;flex-direction:column;color:var(--dsw-alias-label-primary,#f2f2f4);background:var(--dsw-alias-bg-base,#171719);font:13px/1.45 var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)}
[data-pane-subagent-monitor] .psa-toolbar{display:flex;min-height:38px;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-alias-bg-elevated,#1c1c1f)}
[data-pane-subagent-monitor] .psa-summary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#92929b);font-size:12px}
[data-pane-subagent-monitor] button{min-height:28px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#c6c6cb);cursor:pointer;font:inherit}
[data-pane-subagent-monitor] button:hover:not(:disabled),[data-pane-subagent-monitor] button:focus-visible{background:var(--dsw-alias-fill-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#fff);outline:2px solid var(--dsw-alias-state-business-primary,#79a8ff);outline-offset:-2px}
[data-pane-subagent-monitor] button:disabled{cursor:not-allowed;opacity:.45}
[data-pane-subagent-monitor] .psa-refresh{margin-left:auto;padding:0 9px;border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.12));background:var(--dsw-alias-bg-layer-1,#29292d)}
[data-pane-subagent-monitor] .psa-empty{margin:auto;max-width:280px;padding:24px;text-align:center;color:var(--dsw-alias-label-tertiary,#92929b)}
[data-pane-subagent-monitor] .psa-empty strong{display:block;margin-bottom:6px;color:var(--dsw-alias-label-primary,#f2f2f4);font-size:14px}
[data-pane-subagent-monitor] .psa-tree{min-height:0;flex:1;overflow:auto;padding:6px}
[data-pane-subagent-monitor] .psa-node{display:grid;min-width:0;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:4px;min-height:34px;border-radius:7px}
[data-pane-subagent-monitor] .psa-node:hover{background:var(--dsw-alias-fill-hover,rgba(255,255,255,.05))}
[data-pane-subagent-monitor] .psa-disclosure{width:24px;padding:0;border:0}
[data-pane-subagent-monitor] .psa-leaf{display:grid;width:24px;place-items:center;color:var(--dsw-alias-label-quaternary,#676770)}
[data-pane-subagent-monitor] .psa-select{display:flex;min-width:0;align-items:center;gap:7px;padding:0 6px;text-align:left}
[data-pane-subagent-monitor] .psa-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,#ececf1)}
[data-pane-subagent-monitor] .psa-badge{flex:none;padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,#29292d);color:var(--dsw-alias-label-tertiary,#92929b);font-size:10px}
[data-pane-subagent-monitor] .psa-status[data-status='running']{background:rgba(62,166,109,.18);color:#88d5a7}
[data-pane-subagent-monitor] .psa-status[data-status='failed']{background:rgba(242,90,90,.16);color:#f39494}
[data-pane-subagent-monitor] .psa-status[data-status='completed']{background:rgba(121,168,255,.16);color:#a9c9ff}
[data-pane-subagent-monitor] .psa-metrics{color:var(--dsw-alias-label-quaternary,#777780);font-size:11px;white-space:nowrap}
[data-pane-subagent-monitor] .psa-open{margin-right:2px;padding:0 7px;color:var(--dsw-alias-label-tertiary,#92929b);font-size:11px}
[data-pane-subagent-monitor] .psa-detail{display:grid;gap:9px;padding:10px;border-top:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-alias-bg-elevated,#1c1c1f)}
[data-pane-subagent-monitor] .psa-detail-head{display:flex;align-items:center;gap:8px}
[data-pane-subagent-monitor] .psa-detail-head strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-pane-subagent-monitor] .psa-detail-actions{display:flex;flex-wrap:wrap;gap:6px}
[data-pane-subagent-monitor] .psa-detail-actions button{padding:0 9px;border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.12));background:var(--dsw-alias-bg-layer-1,#29292d)}
[data-pane-subagent-monitor] .psa-followup{display:flex;min-width:0;gap:6px}
[data-pane-subagent-monitor] .psa-followup input{min-width:0;min-height:30px;flex:1;padding:0 9px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:7px;background:var(--dsw-alias-bg-base,#171719);color:var(--dsw-alias-label-primary,#fff);font:inherit}
[data-pane-subagent-monitor] .psa-feedback{color:var(--dsw-alias-label-tertiary,#92929b);font-size:12px}
`

const STATUS_LABEL: Record<SubagentStatus, string> = {
  running: '运行中',
  idle: '空闲',
  ready: '就绪',
  inactive: '未活动',
  unknown: '未知',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  interrupted: '已中断',
}

function formatTokens(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)}K`
  return `${(value / 1_000_000).toFixed(1)}M`
}

function NodeRow(props: {
  readonly node: SubagentPaneNodeV1
  readonly expanded: ReadonlySet<string>
  readonly selected: boolean
  readonly onToggle: (ref: string) => void
  readonly onSelect: (node: SubagentPaneNodeV1) => void
  readonly onOpen: (node: SubagentPaneNodeV1) => void
}): ReactNode {
  const isExpanded = props.expanded.has(props.node.ref)
  const disclosure = props.node.hasChildren
    ? createElement('button', {
      type: 'button',
      className: 'psa-disclosure',
      'aria-label': `${isExpanded ? '折叠' : '展开'} ${props.node.label}`,
      'aria-expanded': isExpanded,
      onClick: () => props.onToggle(props.node.ref),
    }, isExpanded ? '▾' : '▸')
    : createElement('span', { className: 'psa-leaf', 'data-pane-subagent-leaf': true, 'aria-hidden': true }, '·')
  const metrics = [
    props.node.timingMs === undefined ? undefined : `${Math.max(1, Math.round(props.node.timingMs / 1000))}s`,
    props.node.tokenUsage === undefined ? undefined : `${formatTokens(
      props.node.tokenUsage.input + props.node.tokenUsage.output + props.node.tokenUsage.cacheRead + props.node.tokenUsage.cacheWrite,
    )} tok`,
  ].filter(value => value !== undefined).join(' · ')
  return createElement('div', {
    role: 'treeitem',
    'aria-level': props.node.depth + 1,
    'aria-selected': props.selected,
    'aria-expanded': props.node.hasChildren ? isExpanded : undefined,
    className: 'psa-node',
    'data-pane-subagent-node': props.node.ref,
    'data-pane-subagent-status': props.node.status,
    style: { paddingLeft: `${props.node.depth * 16}px` },
  },
    disclosure,
    createElement('button', { type: 'button', className: 'psa-select', onClick: () => props.onSelect(props.node) },
      createElement('span', { className: 'psa-label', 'data-pane-subagent-label': true }, props.node.label),
      createElement('span', { className: 'psa-badge', 'data-pane-subagent-mode': true }, props.node.mode === 'continuable' ? '可继续' : '单次'),
      createElement('span', { className: 'psa-badge psa-status', 'data-status': props.node.status, 'data-pane-subagent-status-text': true }, STATUS_LABEL[props.node.status]),
      metrics === '' ? null : createElement('span', { className: 'psa-metrics', 'data-pane-subagent-metrics': true }, metrics),
    ),
    createElement('button', {
      type: 'button',
      className: 'psa-open',
      'aria-label': `在主会话打开 ${props.node.label}`,
      onClick: () => props.onOpen(props.node),
    }, '打开'),
  )
}

/** Renders the current subagent tree from the controller projection. */
export function SubagentMonitorView(props: SubagentMonitorViewProps): ReactNode {
  const projection = useSyncExternalStore(
    props.controller.subscribe.bind(props.controller),
    props.controller.getSnapshot.bind(props.controller),
    props.controller.getSnapshot.bind(props.controller),
  )
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [selectedRef, setSelectedRef] = useState<string>()
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState<string>()
  const toggle = (ref: string): void => {
    setExpanded(previous => {
      const next = new Set(previous)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })
  }
  const visibleNodes = useMemo(() => {
    const visibleParents = new Set<string>()
    const output: SubagentPaneNodeV1[] = []
    for (const node of projection.nodes) {
      const visible = node.depth === 0 || (node.parentRef !== undefined && visibleParents.has(node.parentRef))
      if (visible) {
        output.push(node)
        if (node.hasChildren && expanded.has(node.ref)) visibleParents.add(node.ref)
      }
    }
    return output
  }, [projection.nodes, expanded])
  const selected = useMemo(
    () => projection.nodes.find(node => node.ref === selectedRef),
    [projection.nodes, selectedRef],
  )
  const inactiveCount = projection.nodes.length - projection.runningCount
  const summary = projection.rootSessionId === ''
    ? '未选择会话'
    : `${projection.runningCount} 运行中 · ${inactiveCount} 非活动${projection.totalTokens === undefined ? '' : ` · ${formatTokens(projection.totalTokens)} tok`}`
  return createElement('section', {
    'data-pane-subagent-monitor': true,
    'aria-label': 'Subagent Monitor',
  },
    createElement('style', { 'data-pane-subagent-styles': true }, SUBAGENT_STYLES),
    createElement('header', { className: 'psa-toolbar' },
      createElement('span', { className: 'psa-summary', role: 'status', 'aria-live': 'polite' }, summary),
      createElement('button', {
        type: 'button',
        className: 'psa-refresh',
        disabled: projection.rootSessionId === '',
        onClick: () => props.controller.refresh(),
      }, '刷新'),
    ),
    projection.rootSessionId === ''
      ? createElement('div', { className: 'psa-empty', role: 'status' },
        createElement('strong', null, '未选择会话'),
        createElement('span', null, '选择一个主会话后，这里会显示它实际启动的子 Agent。'))
      : projection.nodes.length === 0
        ? createElement('div', { className: 'psa-empty', role: 'status' },
          createElement('strong', null, '当前会话还没有子 Agent'),
          createElement('span', null, '通过 DSH 的 subagent 工具启动后，这里会显示真实运行状态、耗时和 token。'))
        : createElement('div', { className: 'psa-tree', role: 'tree', 'aria-label': 'Subagent tree' },
          visibleNodes.map(node => createElement(NodeRow, {
            key: node.ref,
            node,
            expanded,
            selected: selectedRef === node.ref,
            onToggle: toggle,
            onSelect: target => { setSelectedRef(target.ref); setFeedback(undefined) },
            onOpen: target => props.controller.openInMain(target),
          })),
        ),
    selected === undefined
      ? null
      : createElement('footer', { className: 'psa-detail', 'data-pane-subagent-detail': selected.ref },
        createElement('div', { className: 'psa-detail-head' },
          createElement('strong', null, selected.label),
          createElement('span', { className: 'psa-badge psa-status', 'data-status': selected.status }, STATUS_LABEL[selected.status]),
        ),
        createElement('div', { className: 'psa-detail-actions' },
          createElement('button', {
            type: 'button',
            onClick: () => {
              void props.controller.peek(selected).then(result => {
                setFeedback(result.ok ? result.summary ?? '最近记录已读取' : result.error ?? '读取失败')
              })
            },
          }, '查看最近记录'),
          createElement('button', { type: 'button', onClick: () => props.controller.openInMain(selected) }, '在主会话打开'),
          selected.mode === 'continuable'
            ? createElement('button', {
              type: 'button',
              onClick: () => {
                void props.controller.interrupt(selected).then(result => {
                  setFeedback(result.ok ? '已请求停止' : result.error ?? '停止失败')
                })
              },
            }, '停止')
            : null,
        ),
        selected.mode === 'continuable'
          ? createElement('div', { className: 'psa-followup' },
            createElement('input', {
              type: 'text',
              value: draft,
              'aria-label': `给 ${selected.label} 发送后续消息`,
              placeholder: '发送后续消息',
              onChange: event => setDraft(event.currentTarget.value),
            }),
            createElement('button', {
              type: 'button',
              disabled: draft.trim().length === 0,
              onClick: () => {
                const text = draft.trim()
                if (text.length === 0) return
                setDraft('')
                void props.controller.send(selected, text).then(result => {
                  setFeedback(result.ok ? '已发送' : result.error ?? '发送失败')
                })
              },
            }, '发送'),
          )
          : null,
        feedback === undefined ? null : createElement('span', { className: 'psa-feedback', role: 'status', 'data-pane-subagent-feedback': true }, feedback),
      ),
  )
}

export function createSubagentMonitorView(controller: SubagentMonitorController): (props: { readonly retry: () => void }) => ReactNode {
  return () => createElement(SubagentMonitorView, { controller })
}

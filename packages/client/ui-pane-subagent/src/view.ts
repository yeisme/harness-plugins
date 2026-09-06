/** Local Pane view for the Subagent Monitor. */
import { createElement, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  Surface,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'
import { SubagentMonitorController } from './controller.js'
import type { SubagentPaneNodeV1, SubagentStatus } from './projection.js'

export interface SubagentMonitorViewProps {
  readonly controller: SubagentMonitorController
}

const SUBAGENT_STYLES = `
[data-pane-subagent-monitor]{height:100%}
[data-pane-subagent-monitor] .psa-summary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
[data-pane-subagent-monitor] .psa-tree{min-height:0;flex:1;overflow:auto;padding:8px}
[data-pane-subagent-monitor] .psa-node{grid-template-columns:28px minmax(0,1fr) auto;gap:4px;padding-right:6px}
[data-pane-subagent-monitor] .psa-node:hover{background:var(--vk-fill-hover)}
[data-pane-subagent-monitor] .psa-node[aria-selected='true']{background:var(--vk-fill-selected)}
[data-pane-subagent-monitor] .psa-disclosure{flex:none}
[data-pane-subagent-monitor] .psa-leaf{display:grid;width:28px;place-items:center;color:var(--vk-text-quaternary)}
[data-pane-subagent-monitor] .psa-select{display:flex;min-width:0;min-height:var(--vk-ctrl-button);align-items:center;gap:6px;padding:0 4px;color:inherit;text-align:left;background:transparent;border:0;cursor:pointer}
[data-pane-subagent-monitor] .psa-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-primary)}
[data-pane-subagent-monitor] .psa-badge{flex:none}
[data-pane-subagent-monitor] .psa-status[data-status='running']{background:color-mix(in srgb,var(--vk-tone-info) 18%,transparent);color:var(--vk-tone-info)}
[data-pane-subagent-monitor] .psa-status[data-status='failed']{background:color-mix(in srgb,var(--vk-tone-critical) 16%,transparent);color:var(--vk-tone-critical)}
[data-pane-subagent-monitor] .psa-status[data-status='completed']{background:color-mix(in srgb,var(--vk-tone-positive) 16%,transparent);color:var(--vk-tone-positive)}
[data-pane-subagent-monitor] .psa-metrics{color:var(--vk-text-quaternary);font-size:var(--vk-font-small);white-space:nowrap}
[data-pane-subagent-monitor] .psa-open{margin-right:0;color:var(--vk-text-tertiary)}
[data-pane-subagent-monitor] .psa-detail-head{display:flex;align-items:center;gap:8px}
[data-pane-subagent-monitor] .psa-detail-head strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-pane-subagent-monitor] .psa-detail-actions{display:flex;flex-wrap:wrap;gap:6px}
[data-pane-subagent-monitor] .psa-followup{display:flex;min-width:0;gap:6px}
[data-pane-subagent-monitor] .psa-followup input{min-width:0;min-height:var(--vk-ctrl-input);flex:1;padding:0 9px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
[data-pane-subagent-monitor] .psa-feedback{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
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
    ? createElement(Button, {
      type: 'button',
      className: 'psa-disclosure vk-icon-btn',
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
    className: 'psa-node ys-row',
    'data-pane-subagent-node': props.node.ref,
    'data-pane-subagent-status': props.node.status,
    style: { paddingLeft: `${8 + props.node.depth * 16}px` },
  },
    disclosure,
    createElement(Button, {
      type: 'button',
      className: 'psa-select',
      'aria-label': `${props.node.label}${props.node.mode === 'continuable' ? '可继续' : '单次'}${STATUS_LABEL[props.node.status]}`,
      onClick: () => props.onSelect(props.node),
    },
      createElement('span', { className: 'psa-label', 'data-pane-subagent-label': true }, props.node.label),
      createElement('span', { className: 'psa-badge vk-badge', 'data-pane-subagent-mode': true }, props.node.mode === 'continuable' ? '可继续' : '单次'),
      createElement('span', { className: 'psa-badge psa-status vk-badge', 'data-status': props.node.status, 'data-pane-subagent-status-text': true }, STATUS_LABEL[props.node.status]),
      metrics === '' ? null : createElement('span', { className: 'psa-metrics', 'data-pane-subagent-metrics': true }, metrics),
    ),
    createElement(Button, {
      type: 'button',
      className: 'psa-open vk-btn',
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
  return createElement(Surface, {
    kind: 'navigator',
    'data-pane-subagent-monitor': true,
    'aria-label': 'Subagent Monitor',
  },
    createElement('style', { 'data-pane-subagent-styles': true }, SUBAGENT_STYLES),
    createElement(SurfaceContextBar, {
      title: 'Subagent Monitor',
      status: createElement('span', { className: 'psa-summary', role: 'status', 'aria-live': 'polite' }, summary),
      actions: createElement(Button, {
        type: 'button',
        className: 'psa-refresh vk-btn',
        disabled: projection.rootSessionId === '',
        onClick: () => props.controller.refresh(),
      }, '刷新'),
    }),
    projection.rootSessionId === ''
      ? createElement('div', { className: 'ys-body' }, createElement(SurfaceState, {
        className: 'psa-empty',
        phase: 'empty',
        title: '未选择会话',
        description: '选择一个主会话后，这里会显示它实际启动的子 Agent。',
      }))
      : projection.nodes.length === 0
        ? createElement('div', { className: 'ys-body' }, createElement(SurfaceState, {
          className: 'psa-empty',
          phase: 'empty',
          title: '当前会话还没有子 Agent',
          description: '通过 DSH 的 subagent 工具启动后，这里会显示真实运行状态、耗时和 token。',
        }))
        : createElement('div', { className: 'ys-body psa-tree', role: 'tree', 'aria-label': 'Subagent tree' },
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
      : createElement('div', { className: 'ys-body' }, createElement(SurfaceSection, { className: 'psa-detail', title: selected.label, 'data-pane-subagent-detail': selected.ref },
        createElement('div', { className: 'psa-detail-head' },
          createElement('span', { className: 'psa-badge psa-status vk-badge', 'data-status': selected.status }, STATUS_LABEL[selected.status]),
        ),
        createElement('div', { className: 'psa-detail-actions' },
          createElement(Button, {
            type: 'button',
            className: 'vk-btn',
            onClick: () => {
              void props.controller.peek(selected).then(result => {
                setFeedback(result.ok ? result.summary ?? '最近记录已读取' : result.error ?? '读取失败')
              })
            },
          }, '查看最近记录'),
          createElement(Button, { type: 'button', className: 'vk-btn', onClick: () => props.controller.openInMain(selected) }, '在主会话打开'),
          selected.mode === 'continuable'
            ? createElement(Button, {
              type: 'button',
              className: 'vk-btn',
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
            createElement(Input, {
              type: 'text',
              value: draft,
              'aria-label': `给 ${selected.label} 发送后续消息`,
              placeholder: '发送后续消息',
              onChange: event => setDraft(event.currentTarget.value),
            }),
            createElement(Button, {
              type: 'button',
              className: 'vk-btn',
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
      )),
  )
}

export function createSubagentMonitorView(controller: SubagentMonitorController): (props: { readonly retry: () => void }) => ReactNode {
  return () => createElement(SubagentMonitorView, { controller })
}

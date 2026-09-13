/** Session-scoped execution tree and inspector over DSH facts. */
import { createElement as h, useEffect, useMemo, useState, useRef, useSyncExternalStore, type ChangeEvent, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceActionBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { SubagentMonitorController } from './controller.js'
import { defaultSubagentText, type SubagentTranslate } from './labels.js'
import type { SubagentPaneNodeV1 } from './projection.js'

export interface SubagentMonitorViewProps { readonly footer?: ReactNode; readonly controller: SubagentMonitorController; readonly t?: SubagentTranslate }
const SUBAGENT_STYLES = `
[data-pane-subagent-monitor]{height:100%;min-height:0!important;container-type:inline-size}
[data-pane-subagent-monitor] .psa-summary{color:var(--vk-text-tertiary);font-size:var(--vk-font-small);overflow-wrap:anywhere}
[data-pane-subagent-monitor] .psa-workspace{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:var(--vk-gap-md);padding:var(--vk-gap-md);min-height:0;overflow:auto}
[data-pane-subagent-monitor] .psa-master{min-width:0;display:grid;align-content:start;gap:var(--vk-gap-md)}
[data-pane-subagent-monitor] .psa-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--vk-gap-sm)}
[data-pane-subagent-monitor] .psa-tree{display:grid;align-content:start;gap:var(--vk-gap-xs);min-width:0}
[data-pane-subagent-monitor] .psa-node{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:var(--vk-gap-xs);padding:var(--vk-gap-xs);border-radius:var(--vk-radius-md);border:0;min-width:0}
[data-pane-subagent-monitor] .psa-node:hover{background:var(--vk-fill-hover)}
[data-pane-subagent-monitor] .psa-node[aria-selected=true]{background:var(--vk-fill-selected)}
[data-pane-subagent-monitor] .psa-leaf{display:grid;place-items:center;color:var(--vk-text-quaternary)}
[data-pane-subagent-monitor] .psa-select{display:flex!important;flex-direction:column;align-items:flex-start!important;justify-content:center!important;min-width:0;min-height:44px;gap:var(--vk-gap-xs);text-align:left;padding:var(--vk-gap-xs);color:inherit;background:transparent!important;border:0!important;box-shadow:none!important;border-radius:var(--vk-radius-sm)}
[data-pane-subagent-monitor] .psa-select:focus-visible{outline:2px solid var(--vk-text-secondary);outline-offset:2px}
[data-pane-subagent-monitor] .psa-label{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--vk-text-primary)}
[data-pane-subagent-monitor] .psa-meta{display:flex;flex-wrap:wrap;align-items:center;gap:var(--vk-gap-sm);font-size:var(--vk-font-small);color:var(--vk-text-tertiary)}
[data-pane-subagent-monitor] .psa-status[data-status=running]{color:var(--vk-tone-info)}
[data-pane-subagent-monitor] .psa-status[data-status=failed]{color:var(--vk-tone-critical)}
[data-pane-subagent-monitor] .psa-status[data-status=completed]{color:var(--vk-tone-positive)}
[data-pane-subagent-monitor] .psa-open{align-self:center}
[data-pane-subagent-monitor] .psa-detail{display:grid;align-content:start;gap:var(--vk-gap-md);min-width:0;padding:var(--vk-gap-md);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);background:var(--vk-bg-layer-1);overflow-wrap:anywhere}
[data-pane-subagent-monitor] .psa-detail h3{margin:0;font-size:var(--vk-font-heading)}
[data-pane-subagent-monitor] .psa-detail-actions{display:flex;flex-wrap:wrap;gap:var(--vk-gap-sm)}
[data-pane-subagent-monitor] .psa-facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--vk-gap-sm);margin:0;font-size:var(--vk-font-small)}
[data-pane-subagent-monitor] .psa-facts dt{color:var(--vk-text-tertiary)}
[data-pane-subagent-monitor] .psa-facts dd{margin:0;text-align:right;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
[data-pane-subagent-monitor] .psa-followup{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--vk-gap-sm);align-items:end}
[data-pane-subagent-monitor] .psa-feedback{color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
[data-pane-subagent-monitor] .psa-footer{padding:var(--vk-gap-md)}
[data-pane-subagent-monitor] .psa-placeholder{display:none}
@container (min-width:721px){[data-pane-subagent-monitor] .psa-workspace{grid-template-columns:minmax(0,1.35fr) minmax(260px,1fr)}[data-pane-subagent-monitor] .psa-placeholder{display:block}}
@container (max-width:720px){[data-pane-subagent-monitor] .psa-workspace[data-detail=true] .psa-master{display:none}}
@media(pointer:coarse){[data-pane-subagent-monitor] button{min-height:44px;min-width:44px}}
@media(prefers-reduced-motion:reduce){[data-pane-subagent-monitor] *{transition:none!important;animation:none!important}}
`
const formatTokens = (value: number): string => value < 1000 ? String(value) : value < 1_000_000 ? `${(value / 1000).toFixed(1)}K` : `${(value / 1_000_000).toFixed(1)}M`
const metrics = (node: SubagentPaneNodeV1) => [node.timingMs === undefined ? undefined : `${Math.round(node.timingMs / 1000)}s`, node.tokenUsage === undefined ? undefined : `${formatTokens(Object.values(node.tokenUsage).reduce((a,b) => a+b, 0))} tok`].filter(Boolean).join(' · ')

export function SubagentMonitorView({ controller, footer, t = defaultSubagentText }: SubagentMonitorViewProps): ReactNode {
  const projection = useSyncExternalStore(controller.subscribe.bind(controller), controller.getSnapshot.bind(controller), controller.getSnapshot.bind(controller))
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [selectedRef, setSelectedRef] = useState<string>()
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState<{ target: string; text: string }>()
  const heading = useRef<HTMLHeadingElement>(null); const origin = useRef<HTMLElement | null>(null)
  const targetKey = `${projection.rootSessionId}:${selectedRef ?? ''}`; const target = useRef(targetKey); target.current = targetKey
  const draft = drafts[targetKey] ?? ''
  const selected = projection.nodes.find(node => node.ref === selectedRef)
  const toggle = (ref: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(ref)) next.delete(ref); else next.add(ref); return next })
  const choose = (node: SubagentPaneNodeV1) => { origin.current = document.activeElement as HTMLElement; setSelectedRef(node.ref); setFeedback(undefined) }
  useEffect(() => { if (selectedRef) heading.current?.focus() }, [selectedRef])
  const back = () => { setSelectedRef(undefined); queueMicrotask(() => origin.current?.isConnected && origin.current.focus()) }
  const visibleNodes = useMemo(() => {
    const visibleParents = new Set<string>(); const output: SubagentPaneNodeV1[] = []
    for (const node of projection.nodes) {
      const visible = node.depth === 0 || (node.parentRef !== undefined && visibleParents.has(node.parentRef))
      if (visible && expanded.has(node.ref)) visibleParents.add(node.ref)
      if ((query || filter !== 'all' || visible) && node.label.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'active' ? node.status === 'running' : ['failed','unknown','interrupted'].includes(node.status)))) output.push(node)
    }
    return output
  }, [projection.nodes, query, filter, expanded])
  const unavailable = !controller.canManage ? t('apiMissing') : projection.freshness !== 'fresh' ? t('stale') : undefined
  const action = async (kind: 'peek' | 'interrupt' | 'send') => {
    if (!selected || busy || unavailable) return
    const bound = targetKey; const submitted = draft; setBusy(true)
    try {
      const result = await (kind === 'peek' ? controller.peek(selected) : kind === 'interrupt' ? controller.interrupt(selected) : controller.send(selected, submitted.trim()))
      if (kind === 'send' && result.ok) setDrafts(previous => previous[bound] === submitted ? { ...previous, [bound]: '' } : previous)
      if (target.current === bound) setFeedback({ target: bound, text: result.ok ? kind === 'peek' ? result.summary ?? t('read') : kind === 'send' ? t('sent') : t('stopRequested') : t('failedAction') })
    } catch { if (target.current === bound) setFeedback({ target: bound, text: t('unknownAction') }) }
    finally { setBusy(false) }
  }
  const row = (node: SubagentPaneNodeV1, index: number) => h('div', { key: node.ref, role: 'treeitem', 'aria-level': query || filter !== 'all' ? 1 : node.depth + 1, 'aria-selected': selectedRef === node.ref, 'aria-expanded': node.hasChildren ? expanded.has(node.ref) : undefined, className: 'psa-node ys-row', 'data-pane-subagent-node': node.ref, 'data-pane-subagent-status': node.status, style: { paddingLeft: `${8 + Math.min(node.depth, 6) * 12}px` } },
    node.hasChildren ? h(Button, { className: 'psa-disclosure vk-icon-btn', 'aria-label': `${t(expanded.has(node.ref) ? 'collapse' : 'expand')} ${node.label}`, onClick: () => toggle(node.ref) }, expanded.has(node.ref) ? '▾' : '▸') : h('span', { className: 'psa-leaf', 'aria-hidden': true, 'data-pane-subagent-leaf': true }, '·'),
    h(Button, { className: 'psa-select', 'aria-label': `${node.label}${t(node.mode === 'continuable' ? 'continuable' : 'once')}${t(node.status)}`, onClick: () => choose(node), onKeyDown: event => {
      const keys: Record<string, number> = { ArrowDown: Math.min(visibleNodes.length - 1,index+1), ArrowUp: Math.max(0,index-1), Home: 0, End: visibleNodes.length-1 }
      if (event.key in keys) { event.preventDefault(); const root = event.currentTarget.closest('[role=tree]'); (root?.querySelectorAll<HTMLElement>('.psa-select')[keys[event.key]!] )?.focus() }
      if (event.key === 'ArrowRight' && node.hasChildren && !expanded.has(node.ref)) { event.preventDefault(); toggle(node.ref) }
      if (event.key === 'ArrowLeft' && node.hasChildren && expanded.has(node.ref)) { event.preventDefault(); toggle(node.ref) }
    } }, h('span', { className: 'psa-label', title: node.label, 'data-pane-subagent-label': true }, node.label),
    h('span', { className: 'psa-meta' }, h('span', { className: 'psa-status', 'data-status': node.status, 'data-pane-subagent-status-text': true }, t(node.status)), h('span', { 'data-pane-subagent-mode': true }, t(node.mode === 'continuable' ? 'continuable' : 'once')), h('span', { 'data-pane-subagent-metrics': true }, metrics(node)))),
    h(Button, { className: 'psa-open vk-btn', 'aria-label': `${t('main')} ${node.label}`, onClick: () => controller.openInMain(node) }, t('open')))
  return h(Surface, { kind: 'navigator', 'data-pane-subagent-monitor': true, 'aria-label': 'Subagent Monitor' }, h('style', { 'data-pane-subagent-styles': true }, SUBAGENT_STYLES),
    h(SurfaceContextBar, { title: t('title'), context: `${t('scope')} · ${projection.nodes.length} ${t('count')}`, status: h('span', { className: 'psa-summary', role: 'status' }, `${projection.runningCount} ${t('running')} · ${projection.nodes.length - projection.runningCount} ${t('inactiveCount')}${projection.totalTokens === undefined ? '' : ` · ${formatTokens(projection.totalTokens)} tok`}`), actions: h(Button, { className: 'vk-btn', disabled: !projection.rootSessionId, onClick: () => controller.refresh() }, t('refresh')) }),
    h('div', { className: 'psa-workspace', 'data-detail': Boolean(selected) },
      h('div', { className: 'psa-master' },
        h('div', { className: 'psa-toolbar' }, h('label', { className: 'ys-field' }, t('search'), h(Input, { value: query, onChange: event => setQuery(event.currentTarget.value) })), h('label', { className: 'ys-field' }, t('filter'), h('select', { value: filter, onChange: (event: ChangeEvent<HTMLSelectElement>) => setFilter(event.currentTarget.value) }, ['all','active','attention'].map(value => h('option', { key: value, value }, t(value as 'all' | 'active' | 'attention')))))),
        projection.freshness !== 'fresh' && projection.rootSessionId ? h(SurfaceState, { phase: projection.freshness === 'unknown' ? 'loading' : 'stale', title: t(projection.freshness === 'unknown' ? 'loading' : 'stale') }) : null,
        !projection.rootSessionId ? h(SurfaceState, { phase: 'empty', title: t('noSession'), description: t('noSessionHint') }) : projection.freshness !== 'fresh' && !projection.nodes.length ? null : !projection.nodes.length ? h(SurfaceState, { phase: 'empty', title: t('empty'), description: t('emptyHint') }) : !visibleNodes.length ? h(SurfaceState, { phase: 'empty', title: t('noMatch') }) : h('div', { className: 'psa-tree', role: 'tree', 'aria-label': t('tree') }, visibleNodes.map(row))),
      selected ? h('aside', { className: 'psa-detail', 'data-pane-subagent-detail': selected.ref, 'aria-label': selected.label },
        h('div', null, h(Button, { className: 'vk-btn', onClick: back }, t('back'))), h('h3', { ref: heading, tabIndex: -1 }, selected.label),
        h('div', { className: 'psa-meta' }, h('span', { className: 'psa-status', 'data-status': selected.status }, t(selected.status)), t(selected.mode === 'continuable' ? 'continuable' : 'once')),
        h('dl', { className: 'psa-facts' }, h('dt', null, t('parent')), h('dd', null, projection.nodes.find(node => node.ref === selected.parentRef)?.label ?? t('scope')), h('dt', null, t('duration')), h('dd', null, selected.timingMs === undefined ? '—' : `${Math.round(selected.timingMs/1000)}s`), h('dt', null, t('input')), h('dd', null, selected.tokenUsage ? formatTokens(selected.tokenUsage.input) : '—'), h('dt', null, t('output')), h('dd', null, selected.tokenUsage ? formatTokens(selected.tokenUsage.output) : '—'), h('dt', null, t('cache')), h('dd', null, selected.tokenUsage ? `${formatTokens(selected.tokenUsage.cacheRead)} / ${formatTokens(selected.tokenUsage.cacheWrite)}` : '—')),
        h(SurfaceActionBar, { className: 'psa-detail-actions' }, h(Button, { className: 'vk-btn', disabled: busy || Boolean(unavailable), title: unavailable, onClick: () => void action('peek') }, t('recent')), h(Button, { className: 'vk-btn', disabled: !controller.canOpenAlongside, title: controller.canOpenAlongside ? t('alongsideHint') : t('alongsideMissing'), onClick: () => controller.openAlongside(selected) }, t('alongside')), h(Button, { className: 'vk-btn', onClick: () => controller.openInMain(selected) }, t('main')), selected.mode === 'continuable' ? h(Button, { className: 'vk-btn', disabled: busy || Boolean(unavailable) || selected.status !== 'running', title: unavailable ?? t(selected.status), onClick: () => void action('interrupt') }, t('stop')) : null),
        unavailable ? h('p', { className: 'psa-summary' }, unavailable) : null,
        selected.mode === 'continuable' ? h('div', { className: 'psa-followup' }, h('label', { className: 'ys-field' }, `${t('followup')} · ${selected.label}`, h(Input, { value: draft, disabled: Boolean(unavailable), onChange: event => { const value = event.currentTarget.value; setDrafts(previous => ({ ...previous, [targetKey]: value })) } })), h(Button, { className: 'vk-btn', disabled: busy || Boolean(unavailable) || !draft.trim(), onClick: () => void action('send') }, t('send'))) : null,
        feedback?.target === targetKey ? h('span', { className: 'psa-feedback', role: 'status', 'data-pane-subagent-feedback': true }, feedback.text) : null)
      : projection.nodes.length ? h('div', { className: 'psa-placeholder' }, h(SurfaceState, { phase: 'empty', title: t('selectHint'), description: t('detailHint') })) : null),
    footer ? h('div', { className: 'psa-footer' }, footer) : null)
}
export function createSubagentMonitorView(controller: SubagentMonitorController): (props: { readonly retry: () => void; readonly footer?: ReactNode; readonly t?: SubagentTranslate }) => ReactNode {
  return props => h(SubagentMonitorView, { controller, footer: props.footer, t: props.t })
}

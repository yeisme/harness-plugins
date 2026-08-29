import { createElement, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { BrowserPerformanceRecordV1, DevtoolsRecordV1 } from '../wire.ts'
import type { DevtoolsControllerState } from './controller.ts'

export type DevtoolsTab = 'overview' | 'timeline' | 'logs' | 'performance'

export interface DevtoolsPanelProps {
  readonly state: DevtoolsControllerState
  readonly browserRecords: readonly BrowserPerformanceRecordV1[]
  readonly onCaptureCpu: () => void
  readonly onExport: () => void
  readonly capturing?: boolean
  readonly message?: string
}

const styles = `
[data-dsh-devtools-panel]{min-height:280px;height:100%;font:13px system-ui}
[data-dsh-devtools-panel] .dt-tabs{display:flex;gap:4px;min-width:0;overflow:auto}
[data-dsh-devtools-panel] .dt-tabs button{text-transform:capitalize}
[data-dsh-devtools-panel] .dt-panel{min-height:0;overflow:auto}
[data-dsh-devtools-panel] .dt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
[data-dsh-devtools-panel] .dt-metric{display:grid;gap:4px;padding:10px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:8px}
[data-dsh-devtools-panel] .dt-metric span{color:var(--vk-text-tertiary)}[data-dsh-devtools-panel] .dt-metric strong{font-size:18px}
[data-dsh-devtools-panel] .dt-findings{grid-column:1/-1;padding:10px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:8px}
[data-dsh-devtools-panel] table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
[data-dsh-devtools-panel] th,[data-dsh-devtools-panel] td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--vk-border-l1)}
[data-dsh-devtools-panel] td:not(:first-child){font-family:ui-monospace,monospace}
`

function fmtMs(value: number): string { return `${Math.round(value)}ms` }
function records(state: DevtoolsControllerState): readonly DevtoolsRecordV1[] { return state.status === 'ready' ? state.snapshot.records : [] }

export function DevtoolsPanel(props: DevtoolsPanelProps): ReactNode {
  const [tab, setTab] = useState<DevtoolsTab>('overview')
  const host = records(props.state)
  const readyState = props.state.status === 'ready' ? props.state : undefined
  const tabs: DevtoolsTab[] = ['overview', 'timeline', 'logs', 'performance']
  return createElement(Surface, { kind: 'inspector', 'data-dsh-devtools-panel': true },
    createElement('style', null, styles),
    createElement(SurfaceContextBar, {
      title: 'DevTools',
      context: readyState === undefined ? props.state.status : `clock ±${readyState.clockUncertaintyMs.toFixed(1)}ms · exact trace ${readyState.snapshot.capabilities.exactRpcCorrelation ? 'on' : 'off'}`,
      actions: createElement('div', null,
        createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: props.capturing || readyState === undefined || !readyState.snapshot.capabilities.cpuProfile, title: readyState !== undefined && !readyState.snapshot.capabilities.cpuProfile ? 'CPU profiling requires a local loopback Web surface' : 'Capture a 10 second CPU profile', onClick: props.onCaptureCpu }, props.capturing ? 'Capturing…' : 'CPU Profile'),
        createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: readyState === undefined, title: readyState === undefined ? 'Diagnostics are not ready for export.' : undefined, onClick: props.onExport }, 'Export')),
      nav: createElement('div', { className: 'dt-tabs', role: 'tablist', 'aria-label': 'DevTools views' }, tabs.map(item => createElement(Button, { key: item, type: 'button', size: 'sm', variant: tab === item ? 'primary' : 'toolbar', role: 'tab', 'aria-selected': tab === item, onClick: () => { setTab(item) } }, item))),
    }),
    props.message === undefined ? null : createElement(SurfaceState, { className: 'dt-message', phase: 'partial', title: props.message }),
    createElement('div', { className: 'ys-body dt-panel', role: 'tabpanel', tabIndex: 0 }, renderTab(tab, props.state, host, props.browserRecords)),
  )
}

function renderTab(tab: DevtoolsTab, state: DevtoolsControllerState, host: readonly DevtoolsRecordV1[], browser: readonly BrowserPerformanceRecordV1[]): ReactNode {
  if (state.status !== 'ready') return createElement(SurfaceState, state.status === 'error' ? { phase: 'error', title: 'Host unavailable', description: state.message } : { phase: 'loading', title: 'Loading diagnostics…' })
  if (tab === 'overview') {
    const metrics = state.snapshot.summary.latestMetrics
    const findings = host.filter(record => record.type === 'finding').slice(-8).reverse()
    return createElement('div', { className: 'dt-grid' },
      metric('Records', state.snapshot.summary.records), metric('Errors', state.snapshot.summary.errors), metric('Findings', state.snapshot.summary.findings), metric('RSS', metrics === undefined ? '—' : `${(metrics.rssBytes / 1048576).toFixed(1)} MiB`),
      createElement(SurfaceSection, { className: 'dt-findings', title: 'Top findings' }, findings.length === 0 ? createElement('p', null, 'No active findings.') : createElement('ul', null, findings.map(record => createElement('li', { key: record.seq }, `${record.code}: ${record.summary}`)))))
  }
  if (tab === 'logs') {
    const logs = host.filter(record => record.type === 'log').slice(-200).reverse()
    return table(['Time', 'Level', 'Source', 'Fingerprint'], logs.map(log => [new Date(log.ts).toLocaleTimeString(), log.severity, log.source, log.fingerprint]))
  }
  if (tab === 'performance') {
    const sample = host.findLast((record): record is Extract<DevtoolsRecordV1, { type: 'sample' }> => record.type === 'sample')
    const recentBrowser = browser.slice(-20).reverse()
    return createElement('div', null,
      sample === undefined ? createElement(SurfaceState, { phase: 'empty', title: 'No Host sample yet.' }) : table(['Metric', 'Value'], [['CPU', `${sample.metrics.cpuPercent.toFixed(1)}%`], ['RSS', `${(sample.metrics.rssBytes / 1048576).toFixed(1)} MiB`], ['Heap', `${(sample.metrics.heapUsedBytes / 1048576).toFixed(1)} MiB`], ['Event loop p95', fmtMs(sample.metrics.eventLoopDelayP95Ms)]]),
      createElement('h3', null, 'Browser performance'), recentBrowser.length === 0 ? createElement(SurfaceState, { phase: 'empty', title: 'No supported browser entries yet.' }) : table(['Kind', 'Name', 'Duration'], recentBrowser.map(item => [item.kind, item.name, fmtMs(item.durationMs)])))
  }
  const timeline = [...host.map(record => ({ ts: record.ts, lane: 'Host', name: record.type === 'span' ? `${record.category}:${record.name}` : record.type === 'finding' ? record.code : record.type === 'lifecycle' ? record.event : record.type, detail: record.type === 'span' ? `${record.status} ${fmtMs(record.durationMs)}` : 'summary' in record ? record.summary : '' })), ...browser.map(record => ({ ts: record.ts, lane: 'Web', name: `${record.kind}:${record.name}`, detail: fmtMs(record.durationMs) }))].sort((a, b) => b.ts - a.ts).slice(0, 300)
  return table(['Time', 'Lane', 'Event', 'Detail'], timeline.map(item => [new Date(item.ts).toLocaleTimeString(), item.lane, item.name, item.detail]))
}

function metric(label: string, value: string | number): ReactNode { return createElement('div', { className: 'dt-metric' }, createElement('span', null, label), createElement('strong', null, String(value))) }
function table(headers: readonly string[], rows: readonly (readonly (string | number)[])[]): ReactNode { return createElement('table', null, createElement('thead', null, createElement('tr', null, headers.map(header => createElement('th', { key: header, scope: 'col' }, header)))), createElement('tbody', null, rows.map((row, index) => createElement('tr', { key: index }, row.map((value, cell) => createElement('td', { key: cell }, String(value))))))) }

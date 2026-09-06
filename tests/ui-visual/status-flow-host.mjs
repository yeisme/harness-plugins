/**
 * Fixture host for the /status → summary → statistics flow.
 *
 * Real plugin code under test in the browser:
 * - @yeisme/dsh-client-ui-token-usage client bundle (pane, header entry,
 *   legacy fallback, session-directory switcher, trajectory seam probe).
 * - @yeisme/dsh-client-ui-command-experience-core slash runtime (planning,
 *   frozen sessionRef, popover → pane → safe-text degradation).
 * - runStatusCommand from @yeisme/dsh-client-ui-command-experience-web
 *   (lifecycle events, no-model-history contract).
 * - deriveSessionStatusViewModel from @yeisme/dsh-client-ui-session-status
 *   (the summary popover / status pane content model).
 *
 * Fixture-owned (host roles): remotes, slots, pane workbench, the popover and
 * session-status pane chrome, and the composer. Remotes are mock objects with
 * wire-valid v1alpha1 shapes; no network, no credentials, no real paths.
 */

import '@deepseek-ai/dsh-client-ui-primitives'
import { createSlashRuntime } from '@yeisme/dsh-client-ui-command-experience-core'
import { runStatusCommand } from '/vendor/ui-command-experience-web/index.mjs'
import { deriveSessionStatusViewModel } from '@yeisme/dsh-client-ui-session-status'

const React = window.React
const ReactDOMClient = window.ReactDOMClient
const h = React.createElement

const params = new URLSearchParams(location.search)
const localeActive = params.get('locale') === 'zh' ? 'zh' : 'en'
const oldHost = params.get('host') === 'old'

const flow = window.__flow
const SESSIONS = [
  { ref: 'sess_a', label: 'Fixture Session A', model: 'fixture-alpha-chat', input: 6400, output: 1200, cacheRead: 300, running: true },
  { ref: 'sess_b', label: 'Fixture Session B', model: 'fixture-beta-reasoner', input: 2210, output: 845, cacheRead: 0, running: false },
]
let currentSession = 'sess_a'

// ---------------------------------------------------------------- mock remotes

function insightsSnapshotFor(session) {
  const buckets = {
    uncachedInputTokens: session.input,
    outputTokens: session.output,
    cacheReadTokens: session.cacheRead,
    cacheWriteTokens: 0,
  }
  return {
    schemaVersion: 'session.insights.snapshot.v1alpha1',
    sessionRef: session.ref,
    scope: 'session',
    revision: 3,
    generatedAt: '2026-09-05T08:00:00.000Z',
    freshness: 'fresh',
    coverage: { status: 'complete', knownRequests: 1 },
    source: { history: 'session_query', context: 'session_projections', cost: 'unknown' },
    totals: { buckets, requestCount: 1, sumRequestDurationMs: 800, wallClockMs: 700 },
    context: { status: 'available', used: 1200, limit: 10000, remaining: 8800 },
    byModel: { rows: [{ key: session.model, label: session.model, requestCount: 1, buckets }], truncated: false },
    byProvider: { rows: [], truncated: false },
    requests: [{
      attemptRef: `att_${session.ref}`,
      requestRef: `req_${session.ref}`,
      runRef: `run_${session.ref}`,
      sessionRef: session.ref,
      happenedAt: '2026-09-05T07:59:00.000Z',
      buckets,
      model: session.model,
      status: 'completed',
    }],
    truncated: false,
  }
}

const legacyUsage = {
  schemaVersion: 'token.usage.snapshot.v1alpha1',
  generatedAt: '2026-09-05T08:00:00.000Z',
  freshness: 'fresh',
  windows: {
    today: { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
    week: { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
    process: { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
  },
  bySession: [],
  byProvider: [],
  truncated: false,
}
const legacyBalance = {
  schemaVersion: 'token.balance.snapshot.v1alpha1',
  status: 'ready',
  freshness: 'fresh',
  generatedAt: '2026-09-05T08:00:00.000Z',
  safeMessage: 'Fixture balance.',
  isAvailable: true,
  infos: [{ currency: 'CNY', totalBalance: '110.00', grantedBalance: '10.00', toppedUpBalance: '100.00' }],
}

const tokenUsageRemote = {
  snapshot: async () => ({ ok: true, specVersion: '1.0', usage: legacyUsage, balance: legacyBalance }),
  refreshBalance: async () => ({ ok: true, specVersion: '1.0', balance: legacyBalance }),
  // Old hosts predating the insights query simply lack these methods; the
  // client must then stay on the explicitly labeled legacy view.
  ...(oldHost ? {} : {
    capabilities: async () => ({
      ok: true,
      specVersion: '1.0',
      capabilities: { query: { available: true, schemaVersion: 'session.insights.snapshot.v1alpha1' } },
    }),
    query: async (input) => {
      const session = SESSIONS.find(candidate => candidate.ref === input.sessionRef) ?? SESSIONS[0]
      flow.queries.push({ sessionRef: session.ref, scope: input.scope ?? 'session' })
      return { ok: true, specVersion: '1.0', snapshot: insightsSnapshotFor(session) }
    },
  }),
}

function statusSnapshotFor(session) {
  return {
    schemaVersion: 'session.status.snapshot.v1alpha1',
    revision: 1,
    generatedAt: '2026-09-05T08:00:00.000Z',
    freshness: 'fresh',
    status: 'ready',
    session: { sessionRef: session.ref, label: session.label, lifecycle: session.running ? 'running' : 'idle' },
    runtime: { modelLabel: session.model },
    context: { status: 'ready', usedTokens: 1200, limitTokens: 10000, remainingRatio: 0.88, source: 'token-meter', safeMessage: 'Context window healthy.' },
    limits: [{ id: 'lim_week', label: 'Weekly quota', scope: 'calendar', status: 'ready', remainingRatio: 0.5, safeMessage: 'Weekly quota half remaining.' }],
  }
}

const sessionStatusRemote = {
  snapshot: async ({ sessionRef }) => {
    const session = SESSIONS.find(candidate => candidate.ref === sessionRef) ?? SESSIONS[0]
    return { ok: true, specVersion: '1.0', snapshot: statusSnapshotFor(session) }
  },
  probe: async () => ({ ok: true, specVersion: '1.0', capabilities: ['session-status'], subscription: false }),
}

const sessionManagerHost = {
  version: 'fixture',
  capability: 'session-manager',
  listSessions: async () => SESSIONS.map(session => ({
    sessionId: session.ref,
    title: session.label,
    running: session.running,
    archived: false,
  })),
}

// ---------------------------------------------------------------- fixture slots

class FixtureSlots {
  constructor() { this.buckets = new Map(); this.currentSlot = 'conversation.session.header.actions' }
  inject(slot, setup) {
    const previous = this.currentSlot
    this.currentSlot = slot
    try { return setup() ?? (() => {}) } finally { this.currentSlot = previous }
  }
  register(input, component) {
    const rows = this.buckets.get(this.currentSlot) ?? []
    rows.push({ ...input, component })
    this.buckets.set(this.currentSlot, rows)
    return () => {}
  }
  entries(slot) { return this.buckets.get(slot) ?? [] }
}

// ---------------------------------------------------------------- pane workbench

const paneHost = document.querySelector('[data-fixture="pane-host"]')
const viewRecords = []
const viewComponents = new Map()
const viewListeners = new Set()
const panes = new Map()

function notifyViews() { for (const listener of viewListeners) listener() }

function registerFixtureView(record, component) {
  viewRecords.push(record)
  viewComponents.set(record.kind, component)
  notifyViews()
}

const paneWorkbench = {
  registerView(view) {
    viewRecords.push({ showInPicker: true, ...view.descriptor })
    viewComponents.set(view.descriptor.kind, view.component)
    notifyViews()
    return () => {}
  },
  openView(request) {
    flow.opened.push({ kind: request.kind, resourceKey: request.resourceKey, metadata: request.metadata ?? null })
    const key = request.resourceKey ?? `fixture:${request.kind}`
    let pane = panes.get(key)
    if (pane === undefined) {
      const component = viewComponents.get(request.kind)
      const container = document.createElement('section')
      container.className = 'sf-pane'
      container.tabIndex = -1
      container.dataset.resourceKey = key
      container.dataset.viewKind = request.kind
      paneHost.append(container)
      const root = ReactDOMClient.createRoot(container)
      pane = { root, container }
      panes.set(key, pane)
      if (component !== undefined) {
        root.render(h(component, { view: { resourceKey: key, metadata: request.metadata ?? {} } }))
      }
    } else {
      flow.focused.push(key)
    }
    pane.container.focus()
  },
  views: {
    snapshot: () => viewRecords,
    subscribe(listener) { viewListeners.add(listener); return () => viewListeners.delete(listener) },
  },
  commands: { snapshot: () => [], subscribe: () => () => {} },
}

// ---------------------------------------------------------------- status surfaces (fixture chrome, real view model)

async function loadStatusViewModel(sessionRef) {
  const answer = await sessionStatusRemote.snapshot({ sessionRef })
  return answer.ok ? deriveSessionStatusViewModel(answer.snapshot) : null
}

function StatusSummary({ view, onExpand, onClose }) {
  return h('div', { className: 'sf-status-summary' },
    h('strong', { 'data-summary-label': true }, view.sessionLabel),
    h('span', { 'data-summary-context': true }, view.contextLine),
    h('ul', null, view.popoverLimits.map(limit => h('li', { key: limit.label }, `${limit.label}: ${limit.text}`))),
    h('div', { className: 'sf-status-actions' },
      h('button', { type: 'button', 'data-action': 'expand-statistics', onClick: onExpand },
        localeActive === 'zh' ? '展开统计' : 'Expand statistics'),
      h('button', { type: 'button', 'data-action': 'close-popover', onClick: onClose },
        localeActive === 'zh' ? '关闭' : 'Close')))
}

function StatusPane({ sessionRef }) {
  const [view, setView] = React.useState(null)
  React.useEffect(() => { void loadStatusViewModel(sessionRef).then(setView) }, [sessionRef])
  if (view === null) return h('p', null, 'Loading status…')
  return h('div', { className: 'sf-status-pane', 'data-fixture': 'session-status-pane', 'data-session-ref': sessionRef },
    h('strong', null, view.sessionLabel),
    h('span', null, view.contextLine),
    h('ul', null, view.paneLimits.map(limit => h('li', { key: limit.label }, `${limit.label}: ${limit.text} — ${limit.message}`))),
    h('button', {
      type: 'button',
      'data-action': 'open-tokens',
      onClick: () => { dispatchStatus('tokens', sessionRef) },
    }, 'Tokens'))
}

let popoverRoot = null
function closePopover(focusComposer = true) {
  if (popoverRoot !== null) {
    popoverRoot.unmount()
    popoverRoot = null
  }
  const host = document.querySelector('[data-fixture="popover-host"]')
  host.innerHTML = ''
  if (focusComposer) document.querySelector('[data-fixture="composer-input"]')?.focus()
}

function openStatusPopover(sessionRef) {
  // The popover belongs to exactly one session: the requested ref is pinned,
  // never swapped for the currently focused session.
  closePopover(false)
  const host = document.querySelector('[data-fixture="popover-host"]')
  const container = document.createElement('div')
  container.className = 'sf-popover-surface'
  container.dataset.fixture = 'status-popover'
  container.dataset.sessionRef = sessionRef
  host.append(container)
  popoverRoot = ReactDOMClient.createRoot(container)
  flow.popovers.push(sessionRef)

  function Popover() {
    const [view, setView] = React.useState(null)
    React.useEffect(() => { void loadStatusViewModel(sessionRef).then(setView) }, [])
    return h('div', {
      role: 'dialog',
      'aria-label': localeActive === 'zh' ? '会话状态' : 'Session status',
      tabIndex: -1,
      ref: node => node?.focus(),
      onKeyDown: event => { if (event.key === 'Escape') closePopover(true) },
    }, view === null
      ? h('p', null, 'Loading status…')
      : h(StatusSummary, {
        view,
        onExpand: () => {
          closePopover(false)
          dispatchStatus('tokens', sessionRef)
        },
        onClose: () => closePopover(true),
      }))
  }
  popoverRoot.render(h(Popover))
  return true
}

// ---------------------------------------------------------------- plugin + runtime wiring

const requireShim = (name) => {
  if (name === 'react') return window.React
  if (name === 'react/jsx-runtime') return window.ReactJsxRuntime
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return window.FixturePrimitives
  throw new Error(`Unexpected module: ${name}`)
}

const tokenUsage = window.__tokenUsageEntry.factory(requireShim)
const localeFace = {
  bind: () => {
    const table = localeActive === 'zh' ? tokenUsage.zh : tokenUsage.en
    return key => table[key] ?? key
  },
  register: () => () => {},
}

const slots = new FixtureSlots()
const ctx = {
  slots,
  locale: localeFace,
  paneWorkbench,
  remote: { tokenUsage: tokenUsageRemote, sessionStatus: sessionStatusRemote },
  'dsh.sessionManagerHost': sessionManagerHost,
}

registerFixtureView({
  kind: 'workspace.session-status',
  label: 'Session status',
  showInPicker: true,
  role: 'navigator',
  preferredRegion: 'right',
  retention: 'keep-alive',
  singleton: true,
}, ({ view }) => h(StatusPane, { sessionRef: view?.metadata?.sessionRef ?? currentSession }))

tokenUsage.apply(ctx)

const runtime = createSlashRuntime({
  paneWorkbench,
  sessionStatus: {
    header: () => ({ available: true, sessionRef: currentSession }),
    openPopover: sessionRef => openStatusPopover(sessionRef),
  },
  currentSessionRef: () => currentSession,
})

// Header entries: the host renders the slot rows once per session header,
// passing that session's id — the same composition the real host performs.
// The entry's ready state only settles after the async remote attach +
// capability probe, so headers render once the plugin has settled.
function renderHeaders() {
  for (const session of SESSIONS) {
    const header = document.querySelector(`[data-fixture="session-header"][data-session="${session.ref}"]`)
    if (header === null) continue
    header.textContent = ''
    const root = ReactDOMClient.createRoot(header)
    root.render(h(React.Fragment, null,
      h('span', { className: 'sf-header-label' }, session.label),
      slots.entries('conversation.session.header.actions').map(row =>
        h(React.Fragment, { key: row.id }, row.component({ ...(row.inject?.() ?? {}), sessionId: session.ref })))))
  }
}
setTimeout(() => {
  renderHeaders()
  document.body.dataset.ready = 'true'
}, 0)

// ---------------------------------------------------------------- composer

const resultEl = document.querySelector('[data-fixture="command-result"]')
const form = document.querySelector('[data-fixture="composer"]')
const input = document.querySelector('[data-fixture="composer-input"]')

function dispatchStatus(arg, sessionRef = currentSession) {
  const result = runStatusCommand({
    runtime,
    sessionRef,
    ...(arg === undefined || arg === '' ? {} : { arg }),
    correlationId: `c-flow-${flow.results.length + 1}`,
  })
  flow.results.push({ sessionRef: result.sessionRef, plan: result.plan.kind, message: result.message, entersTranscript: result.entersTranscript })
  flow.events.push(...result.events)
  resultEl.textContent = result.message
  return result
}

form.addEventListener('submit', event => {
  event.preventDefault()
  const raw = input.value.trim()
  input.value = ''
  const match = raw.match(/^\/status(?:\s+(.*))?$/u)
  if (match === null) {
    resultEl.textContent = 'fixture: only /status is implemented'
    return
  }
  dispatchStatus(match[1]?.trim() ?? '')
})

for (const tab of document.querySelectorAll('[data-session-tab]')) {
  tab.addEventListener('click', () => {
    currentSession = tab.dataset.sessionTab
    flow.switches.push(currentSession)
    for (const other of document.querySelectorAll('[data-session-tab]')) {
      other.setAttribute('aria-pressed', other.dataset.sessionTab === currentSession ? 'true' : 'false')
    }
  })
}

// readiness is signaled from the deferred header render above, after the
// plugin's async remote attach has settled.

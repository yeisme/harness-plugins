/**
 * Client entry: probe + register the token usage surfaces.
 *
 * - Header entry `conversation.session.header.actions` id `token-usage-open`
 *   is always registered; it opens the Pane view when Pane Workbench V2 is
 *   available and the overlay dialog otherwise. The pane/remote/locale
 *   services may arrive late: the entry upgrades from overlay to pane when
 *   the pane service appears (no permanent lock from a one-time probe), and
 *   translations recompute when the locale provider lands or is replaced.
 * - Capability probe first: `capabilities()` decides between the session
 *   insights statistics pane (session.insights.snapshot.v1alpha1) and the
 *   legacy snapshot() view — explicitly labeled 旧版进程观察统计, never
 *   presented as full-session statistics. `query` is only invoked after the
 *   capability confirms it; the version-subscription seam is probed
 *   separately and its absence means manual refresh only.
 * - Session binding: the pane reads `view.metadata.sessionRef` /
 *   `projection.sessionRef` (opened by /status tokens with resourceKey
 *   `token-usage:session:<sessionRef>`); each session gets at most one
 *   statistics instance and explicit target switching re-binds. The
 *   statistics-target switcher sources sessions from the official session
 *   directory (`dsh.sessionManagerHost` on the Cordis context, probed
 *   structurally) with bounded client-side paging; without the seam the
 *   switcher is disabled with a reason and the legacy ledger bySession
 *   top-20 is never used as a substitute.
 * - Remote missing: the entry stays visible but disabled with a readable
 *   reason — no dead buttons, no faked ledger.
 *
 * @module @yeisme/dsh-client-ui-token-usage/client
 */

import { createElement, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { ControllerBinding, OverlayToggle, TokenUsageController, type TokenUsageControllerState } from './controller.ts'
import { SessionInsightsBindingRegistry, sessionInsightsTargetKey, type SessionInsightsBinding, type SessionInsightsSource, type SessionInsightsTarget } from './insights-binding.ts'
import { SessionInsightsPanel, type SessionInsightsScopeDraft, type SessionInsightsTrajectorySeam } from './insights-panel.tsx'
import { en, NS, zh, type TokenUsageKey, type TokenUsageTranslator } from './locales.ts'
import { TokenUsagePanel } from './panel.tsx'
import { deriveTokenUsageViewModel } from './projection.ts'
import { tokenUsageRemoteContribution } from './remote-contribution.ts'
import { probeSessionDirectory } from './session-directory.ts'
import {
  isSafeInsightsRef,
  parseSessionInsightsQueryResult,
  parseTokenUsageCapabilitiesAnswer,
  type TokenUsageRemoteFace,
} from '../wire.ts'

export const name = 'client-ui-token-usage'
export const inject = ['slots', 'locale'] as const

/** Stable empty-controller snapshot for useSyncExternalStore before attach. */
const IDLE_SURFACE_STATE: TokenUsageControllerState = Object.freeze({
  usage: Object.freeze({ status: 'idle' }),
  balance: Object.freeze({ status: 'idle' }),
})

/** Stable idle store source：controller 未附着时的订阅/快照退化（零注册、零渲染）。 */
const IDLE_STATE_STORE: { readonly subscribe: (listener: () => void) => () => void; readonly getSnapshot: () => TokenUsageControllerState } = Object.freeze({
  subscribe: (_listener: () => void) => () => {},
  getSnapshot: () => IDLE_SURFACE_STATE,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalLookup(ctx: Context, key: string): Record<string, unknown> | undefined {
  const getter = (ctx as unknown as { get?: (name: never) => unknown }).get
  if (typeof getter === 'function') {
    try {
      const value = getter.call(ctx, key as never)
      return isRecord(value) ? value : undefined
    } catch {
      return undefined
    }
  }
  try {
    const prop = (ctx as unknown as Record<string, unknown>)[key]
    return isRecord(prop) ? prop : undefined
  } catch {
    return undefined
  }
}

function unwrapNamespace(value: Record<string, unknown>): TokenUsageRemoteFace | undefined {
  const candidate: unknown = value.tokenUsage ?? value
  if (!isRecord(candidate)) return undefined
  if (typeof candidate.snapshot !== 'function' || typeof candidate.refreshBalance !== 'function') return undefined
  return candidate as unknown as TokenUsageRemoteFace
}

async function resolveTokenUsageRemote(ctx: Context): Promise<TokenUsageRemoteFace | undefined> {
  const remote = optionalLookup(ctx, 'remote')
  const direct = isRecord(remote?.tokenUsage) ? unwrapNamespace(remote.tokenUsage) : undefined
  if (direct !== undefined) return direct
  if (remote !== undefined && typeof remote.$mount === 'function') {
    try {
      await (remote.$mount as (contribution: unknown) => Promise<() => Promise<void>>)(tokenUsageRemoteContribution)
    } catch {
      return undefined
    }
    const mounted = optionalLookup(ctx, 'remote.tokenUsage')
    if (mounted !== undefined) return unwrapNamespace(mounted)
  }
  return undefined
}

function defaultTranslator(): TokenUsageTranslator {
  return (key: TokenUsageKey) => en[key]
}

/**
 * Late-locale translator: the locale provider may land or be replaced after
 * apply(); identity is re-checked on every translation so a late/switched
 * provider recomputes without re-registration.
 */
function createLateLocaleTranslator(ctx: Context): { readonly translator: TokenUsageTranslator; readonly register: (disposers: Array<() => void>) => void } {
  let localeFace = optionalLookup(ctx, 'locale')
  let bound = typeof localeFace?.bind === 'function'
    ? (localeFace.bind as (ns: string) => (key: string) => string).call(localeFace, NS)
    : undefined
  const fallback = defaultTranslator()
  return {
    translator: (key: TokenUsageKey) => {
      const now = optionalLookup(ctx, 'locale')
      if (now !== localeFace) {
        localeFace = now
        bound = typeof now?.bind === 'function'
          ? (now.bind as (ns: string) => (key: string) => string).call(now, NS)
          : undefined
      }
      const translated = bound?.(key)
      return translated === undefined || translated === key ? fallback(key) : translated
    },
    register: (disposers) => {
      if (typeof localeFace?.register === 'function') {
        disposers.push((localeFace.register as (ns: string, tables: unknown) => () => void)(NS, { zh, en }))
      }
    },
  }
}

interface PaneViewProps {
  readonly view?: { readonly resourceKey?: string; readonly metadata?: Readonly<Record<string, unknown>> }
  readonly projection?: unknown
}

interface PaneWorkbenchFace {
  registerView(input: { descriptor: Record<string, unknown>; component: (props?: PaneViewProps) => ReactNode }): () => void
  openView(request: Record<string, unknown>): void
}

/** Safe sessionRef carried by openView metadata (resourceKey `token-usage:session:<ref>`). */
export function readViewSessionRef(props: PaneViewProps | undefined): string | null {
  const fromMetadata = props?.view?.metadata?.['sessionRef']
  if (isSafeInsightsRef(fromMetadata)) return fromMetadata
  const projection = props?.projection
  if (isRecord(projection) && isSafeInsightsRef(projection['sessionRef'])) return projection['sessionRef']
  return null
}

/**
 * Trajectory locator seam probe (upstream-prs/session-trajectory-locator is
 * pending). Only a host-provided same-session locator qualifies; request-row
 * refs stay opaque and the locator must confirm the bound session.
 */
function probeTrajectoryLocator(ctx: Context, sessionRef: string, t: TokenUsageTranslator): SessionInsightsTrajectorySeam {
  const seam = optionalLookup(ctx, 'sessionTrajectoryLocator')
  if (seam !== undefined && typeof seam['locate'] === 'function') {
    const locate = seam['locate'] as (refs: { readonly sessionRef: string }) => void
    return {
      available: true,
      locate: (refs) => {
        // Never jump to another session; only same-session opaque refs cross.
        if (refs.sessionRef !== sessionRef) return
        locate(refs)
      },
    }
  }
  return { available: false, reason: t('insights.trajectory.unavailable') }
}

/** Observable insights capability probe result (query vs subscription probed separately). */
export interface InsightsProbeState {
  readonly status: 'probing' | 'ready'
  readonly available: boolean
  readonly reason: string | null
  /** Version-notification seam present; false → manual refresh only. */
  readonly subscription: boolean
  readonly source: SessionInsightsSource | undefined
}

const PROBING_STATE: InsightsProbeState = Object.freeze({
  status: 'probing', available: false, reason: null, subscription: false, source: undefined,
})

/** Stable pre-attach binding snapshot (useSyncExternalStore must be cached). */
const IDLE_BINDING_STORE = Object.freeze({
  subscribe: (_listener: () => void) => () => {},
  snapshot: Object.freeze({
    status: 'idle' as const, stale: false, subscription: false, staleCursor: false, loadingMore: false,
  }),
})

export class InsightsProbeStore {
  private state: InsightsProbeState = PROBING_STATE
  private readonly listeners = new Set<() => void>()

  getSnapshot(): InsightsProbeState {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  attach(next: InsightsProbeState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}

/**
 * Probe capabilities() BEFORE any query call. Old hosts without the method
 * stay in legacy mode; a malformed answer degrades to "not available" with
 * the host reason, never to a guessed version.
 */
export async function probeInsightsCapabilities(remote: TokenUsageRemoteFace, fallbackReason: string): Promise<InsightsProbeState> {
  if (typeof remote.capabilities !== 'function' || typeof remote.query !== 'function') {
    return { status: 'ready', available: false, reason: fallbackReason, subscription: false, source: undefined }
  }
  try {
    const answer = await remote.capabilities()
    const capabilities = parseTokenUsageCapabilitiesAnswer(answer)
    if (capabilities === null || !capabilities.query.available) {
      return {
        status: 'ready',
        available: false,
        reason: capabilities?.query.reason ?? fallbackReason,
        subscription: false,
        source: undefined,
      }
    }
    const source: SessionInsightsSource = {
      query: async (input) => {
        if (typeof remote.query !== 'function') {
          return { ok: false as const, code: 'insights_unavailable' as const, message: fallbackReason }
        }
        const result = await remote.query(input)
        return parseSessionInsightsQueryResult(result) ?? { ok: false as const, code: 'insights_unavailable' as const, message: 'tokenUsage.query returned an invalid snapshot' }
      },
      ...(typeof remote.subscribeVersion === 'function'
        ? { subscribeVersion: (sessionRef: string, listener: () => void) => (remote.subscribeVersion as (ref: string, cb: () => void) => () => void)(sessionRef, listener) }
        : {}),
    }
    return {
      status: 'ready',
      available: true,
      reason: null,
      subscription: typeof remote.subscribeVersion === 'function',
      source,
    }
  } catch {
    return { status: 'ready', available: false, reason: fallbackReason, subscription: false, source: undefined }
  }
}

function TokenUsageSurface({ binding, t, legacy }: {
  readonly binding: ControllerBinding
  readonly t: TokenUsageTranslator
  readonly legacy: boolean
}): ReactNode {
  // G21 dispose 收口：useSyncExternalStore 在卸载时调用 subscribe 返回的退订函数；
  // 订阅句柄经 useMemo 稳定（.bind 显式携带 this 语义），释放由 React 完成。
  const subscribeBinding = useMemo(() => binding.subscribe.bind(binding), [binding])
  const controller = useSyncExternalStore(
    subscribeBinding,
    useCallback(() => binding.getSnapshot(), [binding]),
  )
  // Subscribe to the controller state too: refresh() settles asynchronously
  // and the snapshot must be cached between emissions (stable getSnapshot).
  const stateSource = controller ?? IDLE_STATE_STORE
  const subscribeState = useMemo(() => stateSource.subscribe.bind(stateSource), [stateSource])
  const state = useSyncExternalStore(
    subscribeState,
    useCallback(() => stateSource.getSnapshot(), [stateSource]),
  )
  useEffect(() => {
    void controller?.refresh()
  }, [controller])
  if (controller === undefined) {
    return createElement(SurfaceState, { phase: 'disabled', title: t('entry.disabledReason'), 'data-dsh-token-usage-unavailable': true })
  }
  const usage = state.usage
  const balance = state.balance
  const model = deriveTokenUsageViewModel({
    ...(usage.status === 'ready' ? { usage: usage.usage } : {}),
    ...(usage.status === 'error' || usage.status === 'loading'
      ? { ...(usage.previous === undefined ? {} : { usage: usage.previous }), usageStale: usage.previous !== undefined }
      : {}),
    ...(usage.status === 'error' ? { usageError: usage.message } : {}),
    ...(balance.status === 'ready' ? { balance: balance.balance } : {}),
    ...(balance.status === 'error' || balance.status === 'loading'
      ? { ...(balance.previous === undefined ? {} : { balance: balance.previous }) }
      : {}),
    ...(balance.status === 'error' ? { balanceError: balance.message } : {}),
    balanceBusy: balance.status === 'loading',
  })
  return createElement(TokenUsagePanel, {
    model,
    t,
    legacy,
    onRefresh: () => { void controller.refreshBalance() },
    onRetryUsage: () => { void controller.refresh() },
  })
}

/** One statistics instance per session; explicit scope/target switching re-binds. */
function SessionBoundInsights({ sessionRef, probe, registry, controller, t, ctx }: {
  readonly sessionRef: string
  readonly probe: InsightsProbeState
  readonly registry: SessionInsightsBindingRegistry
  readonly controller: TokenUsageController
  readonly t: TokenUsageTranslator
  readonly ctx: Context
}): ReactNode {
  const [scopeDraft, setScopeDraft] = useState<SessionInsightsScopeDraft>({ scope: 'session' })
  // Pinned by default: the bound session stays the target until the user
  // explicitly picks another session from the official directory. Switching
  // resets the scope to the whole session — scope filters never transfer.
  const [explicitRef, setExplicitRef] = useState<string | null>(null)
  const activeRef = explicitRef ?? sessionRef
  const onTargetChange = useCallback((next: string): void => {
    if (!isSafeInsightsRef(next)) return
    setScopeDraft({ scope: 'session' })
    setExplicitRef(next)
  }, [])
  const target: SessionInsightsTarget = scopeDraft.scope === 'session'
    ? { sessionRef: activeRef, scope: 'session' }
    : scopeDraft.scope === 'run'
      ? { sessionRef: activeRef, scope: 'run', ...(scopeDraft.runRef === undefined ? {} : { runRef: scopeDraft.runRef }) }
      : { sessionRef: activeRef, scope: 'range', ...(scopeDraft.from === undefined ? {} : { from: scopeDraft.from }), ...(scopeDraft.to === undefined ? {} : { to: scopeDraft.to }) }
  return createElement(InsightsBindingView, {
    key: sessionInsightsTargetKey(target),
    target,
    probe,
    registry,
    controller,
    t,
    ctx,
    onScopeChange: setScopeDraft,
    onTargetChange,
  })
}

function InsightsBindingView({ target, probe, registry, controller, t, ctx, onScopeChange, onTargetChange }: {
  readonly target: SessionInsightsTarget
  readonly probe: InsightsProbeState
  readonly registry: SessionInsightsBindingRegistry
  readonly controller: TokenUsageController
  readonly t: TokenUsageTranslator
  readonly ctx: Context
  readonly onScopeChange: (draft: SessionInsightsScopeDraft) => void
  readonly onTargetChange: (sessionRef: string) => void
}): ReactNode {
  const source = probe.source
  const [binding, setBinding] = useState<SessionInsightsBinding | null>(null)
  const targetKey = sessionInsightsTargetKey(target)
  useEffect(() => {
    if (source === undefined) return undefined
    const acquired = registry.acquire(target, source)
    setBinding(acquired)
    return () => {
      registry.release(acquired)
      setBinding(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target identity is the key
  }, [registry, source, targetKey])
  const subscribeBinding = useMemo(
    (): ((listener: () => void) => () => void) => binding === null ? IDLE_BINDING_STORE.subscribe : binding.subscribe.bind(binding),
    [binding],
  )
  const state = useSyncExternalStore(
    subscribeBinding,
    useCallback(() => binding?.getSnapshot() ?? IDLE_BINDING_STORE.snapshot, [binding]),
  )
  const subscribeController = useMemo(() => controller.subscribe.bind(controller), [controller])
  const controllerState = useSyncExternalStore(
    subscribeController,
    useCallback(() => controller.getSnapshot(), [controller]),
  )
  const trajectory = useMemo(() => probeTrajectoryLocator(ctx, target.sessionRef, t), [ctx, target.sessionRef, t])
  const directory = useMemo(
    () => probeSessionDirectory(ctx, t('insights.target.directory.unavailable')),
    [ctx, t],
  )
  return createElement(SessionInsightsPanel, {
    state,
    t,
    trajectory,
    directory,
    targetRef: target.sessionRef,
    onRefresh: () => { void binding?.refresh() },
    onLoadMore: () => { void binding?.loadMore() },
    onScopeChange,
    onTargetChange,
    account: { slice: controllerState.balance, onRefresh: () => { void controller.refreshBalance() } },
  })
}

function TokenUsagePaneView({ binding, probeStore, registry, t, ctx, view, projection }: {
  readonly binding: ControllerBinding
  readonly probeStore: InsightsProbeStore
  readonly registry: SessionInsightsBindingRegistry
  readonly t: TokenUsageTranslator
  readonly ctx: Context
  readonly view?: PaneViewProps['view']
  readonly projection?: unknown
}): ReactNode {
  const subscribeBinding = useMemo(() => binding.subscribe.bind(binding), [binding])
  const controller = useSyncExternalStore(
    subscribeBinding,
    useCallback(() => binding.getSnapshot(), [binding]),
  )
  const subscribeProbe = useMemo(() => probeStore.subscribe.bind(probeStore), [probeStore])
  const probe = useSyncExternalStore(
    subscribeProbe,
    useCallback(() => probeStore.getSnapshot(), [probeStore]),
  )
  if (controller === undefined) {
    return createElement(SurfaceState, { phase: 'disabled', title: t('entry.disabledReason'), 'data-dsh-token-usage-unavailable': true })
  }
  if (probe.status === 'probing') {
    return createElement(SurfaceState, { phase: 'loading', title: t('insights.title'), 'data-insights-probing': true })
  }
  // Old host: fall back to the legacy snapshot() view, explicitly labeled —
  // never presented as full-session statistics.
  if (!probe.available) {
    return createElement(TokenUsageSurface, { binding, t, legacy: true })
  }
  const sessionRef = readViewSessionRef({ ...(view === undefined ? {} : { view }), ...(projection === undefined ? {} : { projection }) })
  if (sessionRef === null) {
    return createElement(SurfaceState, { phase: 'disabled', title: t('insights.pane.noSession'), 'data-insights-no-session': true })
  }
  return createElement(SessionBoundInsights, { sessionRef, probe, registry, controller, t, ctx })
}

function OverlaySeat({ binding, toggle, t, onClosed }: {
  readonly binding: ControllerBinding
  readonly toggle: OverlayToggle
  readonly t: TokenUsageTranslator
  readonly onClosed?: () => void
}): ReactNode {
  // G21 dispose 收口：同上——订阅句柄经 useMemo 稳定，React 卸载时调用退订函数释放。
  const subscribeToggle = useMemo(() => toggle.subscribe.bind(toggle), [toggle])
  const open = useSyncExternalStore(
    subscribeToggle,
    useCallback(() => toggle.isOpen(), [toggle]),
  )
  const subscribeBinding = useMemo(() => binding.subscribe.bind(binding), [binding])
  const controller = useSyncExternalStore(
    subscribeBinding,
    useCallback(() => binding.getSnapshot(), [binding]),
  )
  useEffect(() => {
    if (open) void controller?.refresh()
  }, [controller, open])
  return createElement(Modal, {
    open,
    onClose: () => {
      toggle.setOpen(false)
      onClosed?.()
    },
    title: t('panel.title'),
    closeLabel: t('overlay.close'),
    headless: true,
  }, createElement('div', { 'data-dsh-token-usage-overlay': true }, createElement(TokenUsageSurface, { binding, t, legacy: false })))
}

export function apply(ctx: Context): () => void {
  const disposers: Array<() => void> = []
  const slots = optionalLookup(ctx, 'slots')
  const locale = createLateLocaleTranslator(ctx)
  const boundTranslator = locale.translator

  let disposed = false
  const binding = new ControllerBinding()
  const toggle = new OverlayToggle()
  const probeStore = new InsightsProbeStore()
  const registry = new SessionInsightsBindingRegistry()
  locale.register(disposers)

  // Focus return: remember the same-session trigger; when it was unmounted,
  // fall back to the remaining same-session entry, never another session.
  let lastTrigger: HTMLElement | null = null
  const returnFocus = (): void => {
    const target = lastTrigger !== null && lastTrigger.isConnected
      ? lastTrigger
      : document.querySelector<HTMLElement>('[data-dsh-token-usage-open]')
    target?.focus()
  }

  void resolveTokenUsageRemote(ctx).then(async remote => {
    if (disposed || remote === undefined) return
    const controller = new TokenUsageController(remote)
    binding.attach(controller)
    // Capability probe BEFORE any query call; legacy hosts keep snapshot().
    const probe = await probeInsightsCapabilities(remote, boundTranslator('empty.usage'))
    if (disposed) return
    probeStore.attach(probe)
  })

  let paneDisposer: (() => void) | undefined
  const currentPane = (): PaneWorkbenchFace | undefined => {
    const pane = optionalLookup(ctx, 'paneWorkbench') as PaneWorkbenchFace | undefined
    return pane !== undefined && typeof pane.registerView === 'function' && typeof pane.openView === 'function' ? pane : undefined
  }
  const ensurePaneRegistration = (): PaneWorkbenchFace | undefined => {
    const pane = currentPane()
    if (pane === undefined) return undefined
    if (paneDisposer === undefined) {
      paneDisposer = pane.registerView({
        descriptor: {
          kind: 'workspace.token-usage',
          label: 'Tokens',
          componentKey: 'token-usage-panel',
          role: 'navigator',
          preferredRegion: 'right',
          retention: 'keep-alive',
          singleton: true,
        },
        component: (props?: PaneViewProps) => createElement(TokenUsagePaneView, {
          binding,
          probeStore,
          registry,
          t: boundTranslator,
          ctx,
          ...(props?.view === undefined ? {} : { view: props.view }),
          ...(props?.projection === undefined ? {} : { projection: props.projection }),
        }),
      })
      disposers.push(() => { paneDisposer?.() })
    }
    return pane
  }
  ensurePaneRegistration()

  const remoteReady = (): boolean => binding.getSnapshot() !== undefined
  const openTokens = (sessionRef?: string, trigger?: HTMLElement): void => {
    if (!remoteReady()) return
    if (trigger !== undefined) lastTrigger = trigger
    const pane = ensurePaneRegistration()
    if (pane !== undefined) {
      const probe = probeStore.getSnapshot()
      const sessionBound = probe.available && sessionRef !== undefined && isSafeInsightsRef(sessionRef)
      pane.openView(sessionBound
        ? {
          kind: 'workspace.token-usage',
          resourceKey: `token-usage:session:${sessionRef}`,
          metadata: { sessionRef },
          role: 'navigator',
          preferredRegion: 'right',
          retention: 'keep-alive',
          singleton: true,
          title: 'Tokens',
        }
        : {
          kind: 'workspace.token-usage',
          resourceKey: 'token-usage:process',
          role: 'navigator',
          preferredRegion: 'right',
          retention: 'keep-alive',
          singleton: true,
          title: 'Tokens',
        })
      return
    }
    toggle.setOpen(true)
  }

  if (slots !== undefined && typeof slots.inject === 'function' && typeof slots.register === 'function') {
    // Bind before storing: slot registries may rely on their own `this`.
    const register = (slots.register as unknown as (this: unknown, input: Record<string, unknown>, component: (props?: Record<string, unknown>) => ReactNode) => () => void).bind(slots)
    disposers.push(slots.inject('conversation.session.header.actions', () => register({
      name: 'conversation.session.header.actions',
      id: 'token-usage-open',
      order: 32,
      inject: (): { readonly openTokens: (sessionRef?: string, trigger?: HTMLElement) => void; readonly isReady: () => boolean; readonly disabledReason: () => string } => ({
        openTokens,
        isReady: remoteReady,
        disabledReason: () => boundTranslator('entry.disabledReason'),
      }),
    }, (props) => {
      const face = (props ?? {}) as { openTokens?: (sessionRef?: string, trigger?: HTMLElement) => void; isReady?: () => boolean; disabledReason?: () => string; sessionId?: unknown }
      const ready = face.isReady?.() ?? false
      const sessionRef = typeof face.sessionId === 'string' && isSafeInsightsRef(face.sessionId) ? face.sessionId : undefined
      return createElement(Button, {
        ...{ 'data-dsh-token-usage-open': true },
        type: 'button',
        size: 'sm',
        variant: 'toolbar',
        disabled: !ready,
        title: ready ? 'Tokens' : face.disabledReason?.(),
        onClick: (event?: { currentTarget?: HTMLElement }) => { face.openTokens?.(sessionRef, event?.currentTarget) },
      }, 'Tokens')
    })))
    if (currentPane() === undefined) {
      disposers.push(slots.inject('shell.overlay', () => register({
        name: 'shell.overlay',
        id: 'yeisme.token-usage.dialog',
        order: 90,
        label: 'Tokens',
      }, () => createElement(OverlaySeat, { binding, toggle, t: boundTranslator, onClosed: returnFocus }))))
    }
  }

  return () => {
    disposed = true
    toggle.setOpen(false)
    registry.dispose()
    binding.getSnapshot()?.dispose()
    for (const dispose of disposers.reverse()) dispose()
  }
}

const ClientUiTokenUsagePlugin = { name, inject, apply }
export default ClientUiTokenUsagePlugin

export { ControllerBinding, OverlayToggle, TokenUsageController } from './controller.ts'
export type { TokenBalanceSlice, TokenUsageControllerState, TokenUsageSlice } from './controller.ts'
export { SessionInsightsBinding, SessionInsightsBindingRegistry, sessionInsightsTargetKey } from './insights-binding.ts'
export type { SessionInsightsBindingState, SessionInsightsSource, SessionInsightsTarget } from './insights-binding.ts'
export { deriveSessionInsightsViewModel } from './insights-projection.ts'
export type { SessionInsightsViewModel } from './insights-projection.ts'
export { SessionInsightsPanel } from './insights-panel.tsx'
export type { SessionInsightsPanelProps, SessionInsightsTrajectorySeam } from './insights-panel.tsx'
export { deriveTokenUsageViewModel, formatTokens } from './projection.ts'
export type { TokenUsageViewModel } from './projection.ts'
export { TokenUsagePanel } from './panel.tsx'
export type { TokenUsagePanelProps } from './panel.tsx'
export { tokenUsageRemoteContribution } from './remote-contribution.ts'
export {
  SESSION_DIRECTORY_CONTEXT_KEY,
  SESSION_DIRECTORY_PAGE_SIZE,
  parseSessionDirectoryEntries,
  probeSessionDirectory,
} from './session-directory.ts'
export type { SessionDirectoryEntryV1, SessionDirectoryProbe, SessionDirectorySource } from './session-directory.ts'
export { en, NS, zh } from './locales.ts'
export type { TokenUsageKey, TokenUsageTranslator } from './locales.ts'
export type {
  SessionInsightsQueryInputV1,
  SessionInsightsQueryResultV1,
  SessionInsightsSnapshotV1,
  TokenBalanceInfoV1,
  TokenBalanceSnapshotV1,
  TokenBucketsV1,
  TokenUsageCapabilitiesV1,
  TokenUsageProviderRowV1,
  TokenUsageRemoteFace,
  TokenUsageSessionRowV1,
  TokenUsageSnapshotV1,
} from '../wire.ts'
export { EMPTY_BUCKETS, SESSION_INSIGHTS_SCHEMA_VERSION } from '../wire.ts'

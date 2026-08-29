/**
 * Client entry: probe + register the token usage surfaces.
 *
 * - Header entry `conversation.session.header.actions` id `token-usage-open`
 *   is always registered; it opens the Pane view when Pane Workbench V2 is
 *   available and the overlay dialog otherwise.
 * - Pane path: `workspace.token-usage` navigator (right region, singleton).
 * - Overlay path: `shell.overlay` resident seat, zero render when idle.
 * - Remote missing: the entry stays visible but disabled with a readable
 *   reason — no dead buttons, no faked ledger.
 *
 * @module @yeisme/dsh-client-ui-token-usage/client
 */

import { createElement, useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { ControllerBinding, OverlayToggle, TokenUsageController } from './controller.ts'
import { en, NS, zh, type TokenUsageKey, type TokenUsageTranslator } from './locales.ts'
import { TokenUsagePanel } from './panel.tsx'
import { deriveTokenUsageViewModel } from './projection.ts'
import { tokenUsageRemoteContribution } from './remote-contribution.ts'
import type { TokenUsageRemoteFace } from '../wire.ts'

export const name = 'client-ui-token-usage'
export const inject = ['slots', 'locale'] as const

/** Stable empty-controller snapshot for useSyncExternalStore before attach. */
const IDLE_SURFACE_STATE = Object.freeze({ status: 'idle' }) as { readonly status: 'idle' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalLookup(ctx: Context, key: string): Record<string, unknown> | undefined {
  try {
    const value = (ctx as unknown as { get?: (name: never) => unknown })?.get?.(key as never)
    if (isRecord(value)) return value
  } catch {
    // Guard facade without the service; fall through to property access.
  }
  const prop = (ctx as unknown as Record<string, unknown>)[key]
  return isRecord(prop) ? prop : undefined
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

interface PaneWorkbenchFace {
  registerView(input: { descriptor: Record<string, unknown>; component: (props?: { view?: { resourceKey?: string } }) => ReactNode }): () => void
  openView(request: Record<string, unknown>): void
}

function TokenUsageSurface({ binding, t }: {
  readonly binding: ControllerBinding
  readonly t: TokenUsageTranslator
}): ReactNode {
  const controller = useSyncExternalStore(
    useCallback((listener: () => void) => binding.subscribe(listener), [binding]),
    useCallback(() => binding.getSnapshot(), [binding]),
  )
  // Subscribe to the controller state too: refresh() settles asynchronously
  // and the snapshot must be cached between emissions (stable getSnapshot).
  const state = useSyncExternalStore(
    useCallback((listener: () => void) => controller?.subscribe(listener) ?? (() => {}), [controller]),
    useCallback(() => controller?.getSnapshot() ?? IDLE_SURFACE_STATE, [controller]),
  )
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    void controller?.refresh()
  }, [controller])
  if (controller === undefined) {
    return createElement(SurfaceState, { phase: 'disabled', title: t('entry.disabledReason'), 'data-dsh-token-usage-unavailable': true })
  }
  const model = deriveTokenUsageViewModel({
    ...(state.status === 'ready' ? { usage: state.usage, balance: state.balance } : {}),
  })
  const onRefresh = (): void => {
    setRefreshing(true)
    void controller.refreshBalance().finally(() => { setRefreshing(false) })
  }
  return createElement(TokenUsagePanel, { model, t, onRefresh, refreshing })
}

function OverlaySeat({ binding, toggle, t }: {
  readonly binding: ControllerBinding
  readonly toggle: OverlayToggle
  readonly t: TokenUsageTranslator
}): ReactNode {
  const open = useSyncExternalStore(
    useCallback((listener: () => void) => toggle.subscribe(listener), [toggle]),
    useCallback(() => toggle.isOpen(), [toggle]),
  )
  const controller = useSyncExternalStore(
    useCallback((listener: () => void) => binding.subscribe(listener), [binding]),
    useCallback(() => binding.getSnapshot(), [binding]),
  )
  useEffect(() => {
    if (open) void controller?.refresh()
  }, [controller, open])
  return createElement(Modal, { open, onClose: () => { toggle.setOpen(false) }, title: t('panel.title'), closeLabel: t('overlay.close'), headless: true }, createElement('div', { 'data-dsh-token-usage-overlay': true }, createElement(TokenUsageSurface, { binding, t })))
}

export function apply(ctx: Context): () => void {
  const disposers: Array<() => void> = []
  const slots = optionalLookup(ctx, 'slots')
  const pane = optionalLookup(ctx, 'paneWorkbench') as PaneWorkbenchFace | undefined
  const locale = optionalLookup(ctx, 'locale')

  let disposed = false
  const binding = new ControllerBinding()
  const toggle = new OverlayToggle()
  const fallback = defaultTranslator()
  const localeBind = typeof locale?.bind === 'function' ? (locale.bind as (ns: string, key: TokenUsageKey) => string) : undefined
  const boundTranslator: TokenUsageTranslator = localeBind === undefined
    ? fallback
    : (key: TokenUsageKey) => {
      const translated = localeBind(NS, key)
      return translated === key ? fallback(key) : translated
    }

  if (typeof locale?.register === 'function') {
    disposers.push((locale.register as (ns: string, tables: unknown) => () => void)(NS, { zh, en }))
  }

  void resolveTokenUsageRemote(ctx).then(remote => {
    if (disposed || remote === undefined) return
    binding.attach(new TokenUsageController(remote))
  })

  const paneUsable = pane !== undefined && typeof pane.registerView === 'function' && typeof pane.openView === 'function'
  if (paneUsable) {
    disposers.push(pane.registerView({
      descriptor: {
        kind: 'workspace.token-usage',
        label: 'Tokens',
        componentKey: 'token-usage-panel',
        role: 'navigator',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: true,
      },
      component: () => createElement(TokenUsageSurface, { binding, t: boundTranslator }),
    }))
  }

  const remoteReady = (): boolean => binding.getSnapshot() !== undefined
  const openTokens = (): void => {
    if (!remoteReady()) return
    if (paneUsable) {
      pane.openView({
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
      inject: (): { readonly openTokens: () => void; readonly isReady: () => boolean; readonly disabledReason: () => string } => ({
        openTokens,
        isReady: remoteReady,
        disabledReason: () => boundTranslator('entry.disabledReason'),
      }),
    }, (props) => {
      const face = (props ?? {}) as { openTokens?: () => void; isReady?: () => boolean; disabledReason?: () => string }
      const ready = face.isReady?.() ?? false
      return createElement(Button, {
        ...{ 'data-dsh-token-usage-open': true },
        type: 'button',
        size: 'sm',
        variant: 'toolbar',
        disabled: !ready,
        title: ready ? 'Tokens' : face.disabledReason?.(),
        onClick: () => { face.openTokens?.() },
      }, 'Tokens')
    })))
    if (!paneUsable) {
      disposers.push(slots.inject('shell.overlay', () => register({
        name: 'shell.overlay',
        id: 'yeisme.token-usage.dialog',
        order: 90,
        label: 'Tokens',
      }, () => createElement(OverlaySeat, { binding, toggle, t: boundTranslator }))))
    }
  }

  return () => {
    disposed = true
    toggle.setOpen(false)
    for (const dispose of disposers.reverse()) dispose()
  }
}

const ClientUiTokenUsagePlugin = { name, inject, apply }
export default ClientUiTokenUsagePlugin

export { ControllerBinding, OverlayToggle, TokenUsageController } from './controller.ts'
export { deriveTokenUsageViewModel, formatTokens } from './projection.ts'
export type { TokenUsageViewModel } from './projection.ts'
export { TokenUsagePanel } from './panel.tsx'
export type { TokenUsagePanelProps } from './panel.tsx'
export { tokenUsageRemoteContribution } from './remote-contribution.ts'
export { en, NS, zh } from './locales.ts'
export type { TokenUsageKey, TokenUsageTranslator } from './locales.ts'
export type {
  TokenBalanceInfoV1,
  TokenBalanceSnapshotV1,
  TokenBucketsV1,
  TokenUsageProviderRowV1,
  TokenUsageRemoteFace,
  TokenUsageSessionRowV1,
  TokenUsageSnapshotV1,
} from '../wire.ts'
export { EMPTY_BUCKETS } from '../wire.ts'

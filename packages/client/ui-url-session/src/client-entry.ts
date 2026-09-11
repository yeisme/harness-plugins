/**
 * URL session 客户端接线（dsh-url-session-v1 §3）：boot 完成后读地址栏，
 * 深链选中会话；选择成功 push/replace；popstate 反向；侧栏选择单向同步 URL；
 * 缺失会话在会话视图内空态 + 返回列表；会话头部提供复制链接/新标签菜单。
 * 缺 `sessions` 或 `slots` seam 时 capability probe：不注册入口、不抛错、
 * 不伪造 open。URL 只含 origin + SessionId，永不携带 token。
 *
 * P1 链接形式为 `?s=` 别名（无需 SPA fallback）；§5.3 的 profile
 * historyFallback 打开后切 canonical `/s/<id>`。
 *
 * @module @yeisme/dsh-client-ui-url-session/client
 */

import { createElement, useSyncExternalStore, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { isValidSessionId, parseSessionLocation, sessionUrl } from './codec.ts'
import { SessionUrlSyncController } from './index.ts'
import { createSessionsAdapter, probeUrlSessionSeams } from './sessions-adapter.ts'
import { urlSessionLabels } from './labels.ts'
import { MissingSessionState } from './empty-state.tsx'
import { SessionLinkMenu } from './session-link-menu.tsx'

interface SlotsFace {
  inject(name: string, setup: () => () => void): () => void
  register(input: { name: string; id: string; order: number }, component: () => ReactNode): () => void
}

type BrowserContext = Context & { get(service: string): unknown }

/** `file:` 协议下 `location.origin` 为 "null"，归一出可用的 origin 字面量。 */
function currentOrigin(location: Location): string {
  if (location.origin !== 'null' && location.origin !== '') return location.origin
  return `${location.protocol}//${location.host}`
}

export const clientEntryName = 'client-ui-url-session'
export const clientEntryInject: readonly string[] = ['slots']

export function applyClient(ctx: BrowserContext): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {}
  const probe = probeUrlSessionSeams(ctx as { get(service: string): unknown })
  if (!probe.available || probe.service === undefined) return () => {}
  let slots: SlotsFace | undefined
  try {
    const candidate = ctx.get('slots') as SlotsFace | undefined
    if (candidate !== undefined && typeof candidate.inject === 'function' && typeof candidate.register === 'function') slots = candidate
  } catch {
    slots = undefined
  }
  if (slots === undefined) return () => {}

  const origin = currentOrigin(window.location)
  const controller = new SessionUrlSyncController(createSessionsAdapter(probe.service), {
    location: window.location,
    history: window.history,
    origin,
    // §5.3 打开 frontend-static historyFallback 后切 canonical；P1 用零服务器改动的别名。
    hasHistoryFallback: false,
  })
  const labels = urlSessionLabels(document.documentElement?.lang === 'en' ? 'en' : 'zh')
  const clipboardAvailable = typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function'
  const disposers: Array<() => void> = []

  let booted = false
  const boot = (): void => {
    if (booted) return
    booted = true
    const parsed = parseSessionLocation(window.location)
    if (parsed.sessionId === null) {
      // 地址栏未声称会话：把宿主当前会话物化成可分享链接（只写 URL，不 open）。
      controller.syncFromSelection(probe.service?.list?.getSnapshot().current)
      return
    }
    void controller.boot()
  }

  // popstate 反向：浏览器后退/前进 → 选中地址栏声称的会话（history 源不写 history）。
  const onPopState = (): void => {
    const parsed = parseSessionLocation(window.location)
    if (parsed.sessionId !== null && parsed.sessionId !== controller.currentSessionId) void controller.select(parsed.sessionId, 'history')
  }
  window.addEventListener('popstate', onPopState)
  disposers.push(() => window.removeEventListener('popstate', onPopState))

  // 侧栏/宿主选中（非本 controller 发起）→ 单向同步 URL，不重复 open。
  const unsubscribeSessions = probe.service.list?.subscribe?.(() => {
    const snapshot = probe.service?.list?.getSnapshot()
    controller.syncFromSelection(snapshot?.current)
  })
  if (unsubscribeSessions !== undefined) disposers.push(unsubscribeSessions)

  const useControllerState = (): ReturnType<typeof controller.getSnapshot> =>
    useSyncExternalStore((listener: () => void) => controller.subscribe(listener), () => controller.getSnapshot(), () => controller.getSnapshot())

  const LinkMenu = (): ReactNode => {
    const state = useControllerState()
    boot()
    const sessionId = state.phase === 'ready' ? state.sessionId : controller.currentSessionId
    const link = sessionId !== undefined && isValidSessionId(sessionId)
      ? (() => { try { return sessionUrl({ origin, sessionId, form: 'alias' }) } catch { return undefined } })()
      : undefined
    return createElement(SessionLinkMenu, {
      labels,
      link,
      clipboardAvailable,
      onOpenTab: (url: string) => { window.open(url, '_blank', 'noopener,noreferrer') },
    })
  }

  const MissingDock = (): ReactNode => {
    boot()
    const state = useControllerState()
    if (state.phase !== 'missing') return null
    return createElement(MissingSessionState, {
      sessionId: state.sessionId,
      labels,
      onBackToList: () => { controller.dismissMissing() },
    })
  }

  disposers.push(slots.inject('conversation.session.header.actions', () => slots!.register(
    { name: 'conversation.session.header.actions', id: 'dsh-url-session-link', order: 32 },
    () => createElement(LinkMenu),
  )))
  disposers.push(slots.inject('conversation.input.dock', () => slots!.register(
    { name: 'conversation.input.dock', id: 'dsh-url-session-missing', order: 5 },
    () => createElement(MissingDock),
  )))

  return () => {
    for (const dispose of disposers.reverse()) dispose()
    controller.dispose()
  }
}

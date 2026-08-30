import { TerminalPanel } from './terminal-panel.tsx'
/**
 * Terminal client entry (ModuleLoader face)：console 视图 + 命令面。
 *
 * 装配：`sessions` + `locale` 静态注入；`terminalPane` Remote 与
 * `paneWorkbench` 均 optional probe（缺席零注册/禁用+原因，不 pend 整个
 * entry）。滚回重读由绑定 session 的 ConversationSnapshot 变化事件驱动，
 * 无定时器。controller 异步解析后经 mount store 通知已挂载的视图。
 *
 * @module @yeisme/dsh-terminal/client
 */

import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { TerminalConsoleController } from './console-controller.ts'
import { TerminalConsoleView, type ConsoleSessionOption } from './console-view.tsx'
import { resolveTerminalPaneRemote, type TerminalPaneRemoteFace } from './console-remote.ts'
import { CONSOLE_NS, consoleEn, consoleZh, fallbackConsoleTranslator, interpolate, type ConsoleTranslator } from './console-locales.ts'

export const name = 'dsh-terminal-client'
export const inject = ['sessions', 'locale'] as const

interface SessionsFace {
  readonly list: {
    getSnapshot(): {
      readonly ids: readonly string[]
      readonly byId: Readonly<Record<string, { displayTitle: string; running: boolean }>>
      readonly current: string | undefined
    }
    subscribe(listener: () => void): () => void
  }
  binding(sessionId: string): { readonly session: { subscribe(listener: () => void): () => void; getSnapshot(): unknown } } | undefined
}

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
  registerCommand?(input: unknown): () => void
}

interface LocaleFace {
  register?(ns: string, tables: unknown): () => void
  bind?(ns: string, key: string): string
}

/** controller 异步挂载 store（useSyncExternalStore 源；stable 引用）。 */
class ConsoleMount {
  private controller: TerminalConsoleController | undefined
  private readonly listeners = new Set<() => void>()

  attach(controller: TerminalConsoleController): void {
    this.controller = controller
    for (const listener of this.listeners) listener()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot = (): TerminalConsoleController | undefined => this.controller
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalLookup(ctx: Context, key: string): Record<string, unknown> | undefined {
  try {
    const value = (ctx as unknown as { get?: (name: never) => unknown })?.get?.(key as never)
    if (isRecord(value)) return value
  } catch {
    // guard facade without the service
  }
  const prop = (ctx as unknown as Record<string, unknown>)[key]
  return isRecord(prop) ? prop : undefined
}

export function apply(ctx: Context): () => void {
  const disposers: Array<() => void> = []
  const sessions = (ctx as unknown as { sessions: SessionsFace }).sessions
  const locale = optionalLookup(ctx, 'locale') as LocaleFace | undefined
  const mount = new ConsoleMount()

  let disposed = false
  const controllerListeners = new Set<(sessionId: string) => void>()

  const fallback = fallbackConsoleTranslator()
  const localeBind = typeof locale?.bind === 'function' ? (key: string) => (locale.bind as (ns: string, key: string) => string)(CONSOLE_NS, key) : undefined
  const t: ConsoleTranslator = (key, params) => {
    const translated = localeBind?.(key)
    const source = translated !== undefined && translated !== key ? translated : fallback(key)
    return interpolate(source, params)
  }

  if (typeof locale?.register === 'function') {
    disposers.push(locale.register(CONSOLE_NS, { zh: consoleZh, en: consoleEn }))
  }

  // 事件驱动重读：owner session 的 ConversationSnapshot 变化（含 terminal
  // 工具调用完成）触发滚回与列表刷新。订阅随 owner 切换重建。
  let disposeOwnerSubscription: (() => void) | undefined
  const watchOwner = (sessionId: string): void => {
    disposeOwnerSubscription?.()
    disposeOwnerSubscription = undefined
    const binding = sessions.binding(sessionId)
    if (binding === undefined) return
    disposeOwnerSubscription = binding.session.subscribe(() => {
      for (const listener of controllerListeners) listener(sessionId)
    })
  }

  const refreshSignal = (listener: (sessionId: string) => void): (() => void) => {
    controllerListeners.add(listener)
    return () => { controllerListeners.delete(listener) }
  }

  const pane = optionalLookup(ctx, 'paneWorkbench') as PaneWorkbenchFace | undefined
  const paneUsable = pane !== undefined && typeof pane.registerView === 'function' && typeof pane.openView === 'function'

  const sessionOptions = (): readonly ConsoleSessionOption[] => {
    const snapshot = sessions.list.getSnapshot()
    return snapshot.ids.map(id => {
      const row = snapshot.byId[id]
      return { sessionId: id, displayTitle: row?.displayTitle ?? id, running: row?.running ?? false }
    })
  }

  const openTerminalSession = (sessionId: string, title: string): void => {
    if (mount.getSnapshot() === undefined) return
    pane?.openView({
      kind: 'dsh-terminal.session',
      resourceKey: `terminal:${sessionId}`,
      role: 'general',
      preferredRegion: 'bottom',
      retention: 'keep-alive',
      singleton: false,
      title,
    })
  }

  const openConsole = (): void => {
    if (mount.getSnapshot() === undefined) return
    pane?.openView({
      kind: 'dsh-terminal.console',
      resourceKey: 'terminal:console',
      role: 'general',
      preferredRegion: 'bottom',
      retention: 'keep-alive',
      singleton: true,
      title: t('title'),
    })
  }

  if (paneUsable) {
    disposers.push(pane.registerView({
      descriptor: {
        kind: 'dsh-terminal.console',
        label: t('title'),
        componentKey: 'terminal-console',
        role: 'general',
        preferredRegion: 'bottom',
        retention: 'keep-alive',
        singleton: true,
      },
      component: () => ConsolePanelRoot({ mount, sessions: sessionOptions(), currentSessionId: sessions.list.getSnapshot().current, t, refreshSignal, watchOwner }),
    }))
    // V3 6.8: every DSH terminal is its own keep-alive view keyed by the
    // owner-issued opaque session id; default dock is Bottom and provider
    // dispose only detaches (the PTY lifecycle stays with the owner).
    disposers.push(pane.registerView({
      descriptor: {
        kind: 'dsh-terminal.session',
        label: t('title'),
        componentKey: 'terminal-session',
        role: 'general',
        preferredRegion: 'bottom',
        retention: 'keep-alive',
        singleton: false,
      },
      presentation: { icon: 'terminal', defaultEdge: 'bottom' },
      component: () => TerminalSessionViewRoot({ mount, sessions: sessionOptions(), t }),
    }))
    if (typeof pane.registerCommand === 'function') {
      disposers.push(pane.registerCommand({
        descriptor: {
          id: 'terminal.open',
          label: t('title'),
          presentation: { launcher: true },
          slash: { name: 'terminal', hint: t('composer.placeholder'), category: 'pane' },
        },
        execute: openConsole,
      }))
      disposers.push(pane.registerCommand({
        descriptor: {
          id: 'terminal.open-session',
          label: `${t('title')} (pane)`,
          presentation: { launcher: true },
        },
        execute: () => {
          const current = sessions.list.getSnapshot().current
          if (current === undefined) return
          const row = sessionOptions().find(option => option.sessionId === current)
          openTerminalSession(current, row?.displayTitle ?? current)
        },
      }))
      disposers.push(pane.registerCommand({
        descriptor: {
          id: 'terminal.reconnect',
          label: t('reconnect'),
          presentation: { launcher: true },
        },
        execute: () => {
          openConsole()
          // 重连只同步投影（重探测 + 列表/滚回重放）；PTY 状态在官方 backend。
          void mount.getSnapshot()?.reconnect()
        },
      }))
    }
  }

  void resolveTerminalPaneRemote(ctx as unknown as Parameters<typeof resolveTerminalPaneRemote>[0]).then((remote: TerminalPaneRemoteFace | undefined) => {
    if (disposed || remote === undefined) return
    const controller = new TerminalConsoleController(remote)
    void controller.start()
    mount.attach(controller)
  })

  return () => {
    disposed = true
    disposeOwnerSubscription?.()
    mount.getSnapshot()?.dispose()
    for (const dispose of disposers.reverse()) dispose()
  }
}

function ConsolePanelRoot(props: {
  readonly mount: ConsoleMount
  readonly sessions: readonly ConsoleSessionOption[]
  readonly currentSessionId: string | undefined
  readonly t: ConsoleTranslator
  readonly refreshSignal: (listener: (sessionId: string) => void) => () => void
  readonly watchOwner: (sessionId: string) => void
}): ReactNode {
  const controller = useSyncExternalStore(
    useCallback((listener: () => void) => props.mount.subscribe(listener), [props.mount]),
    useCallback(() => props.mount.getSnapshot(), [props.mount]),
  )
  return TerminalConsoleView({
    controller,
    sessions: props.sessions,
    currentSessionId: props.currentSessionId,
    t: props.t,
    onRefreshSignal: props.refreshSignal,
    onOwnerSessionChange: props.watchOwner,
  })
}

/** V3 6.8 per-session view root: one interactive terminal per opaque id. */
function TerminalSessionViewRoot(props: {
  readonly mount: ConsoleMount
  readonly sessions: readonly ConsoleSessionOption[]
  readonly t: ConsoleTranslator
}): ReactNode {
  const view = usePaneProjectionOfSession(props.sessions)
  return TerminalPanel({ state: view?.running === false ? 'exited' : 'connected', status: view?.displayTitle })
}

function usePaneProjectionOfSession(sessions: readonly ConsoleSessionOption[]): { readonly displayTitle: string; readonly running: boolean } | undefined {
  return sessions[0]
}

const DshTerminalClientPlugin = { name, inject, apply }
export default DshTerminalClientPlugin

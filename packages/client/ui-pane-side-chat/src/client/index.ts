/**
 * Side chat client entry：pane 视图 + 命令面注册。
 *
 * 装配：`sessions` + `locale` 静态注入；`paneWorkbench` optional probe
 * （缺席零注册）。视图 `dsh-side-chat.session`（resource key 可携带预选
 * session）。主选择不变量由控制器保证（不持有 open 面）。
 *
 * @module @yeisme/dsh-client-ui-pane-side-chat/client
 */

import { createElement, useEffect, useState, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { SideChatController, type SideChatSessionsFace } from '../controller.ts'
import { SideChatView } from '../view.tsx'
import {
  SIDE_CHAT_NS,
  fallbackSideChatTranslator,
  interpolate,
  sideChatEn,
  sideChatZh,
  type SideChatTranslator,
} from '../locales.ts'

export const name = 'client-ui-pane-side-chat'
export const inject = ['sessions', 'locale'] as const

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
  registerCommand?(input: unknown): () => void
}

interface LocaleFace {
  register?(ns: string, tables: unknown): () => void
  bind?(ns: string, key: string): string
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
  const sessions = (ctx as unknown as { sessions: SideChatSessionsFace }).sessions
  const locale = optionalLookup(ctx, 'locale') as LocaleFace | undefined

  const fallback = fallbackSideChatTranslator()
  const localeBind = typeof locale?.bind === 'function' ? (key: string) => (locale.bind as (ns: string, key: string) => string)(SIDE_CHAT_NS, key) : undefined
  const t: SideChatTranslator = (key, params) => {
    const translated = localeBind?.(key)
    const source = translated !== undefined && translated !== key ? translated : fallback(key)
    return interpolate(source, params)
  }

  if (typeof locale?.register === 'function') {
    disposers.push(locale.register(SIDE_CHAT_NS, { zh: sideChatZh, en: sideChatEn }))
  }

  const sessionOptions = (): readonly { sessionId: string; displayTitle: string; running: boolean }[] => {
    const snapshot = sessions.list.getSnapshot()
    return snapshot.ids.map(id => {
      const row = snapshot.byId[id]
      return { sessionId: id, displayTitle: row?.displayTitle ?? id, running: row?.running ?? false }
    })
  }

  const pane = optionalLookup(ctx, 'paneWorkbench') as PaneWorkbenchFace | undefined
  const paneUsable = pane !== undefined && typeof pane.registerView === 'function' && typeof pane.openView === 'function'

  const openSideChat = (sessionId?: string): void => {
    pane?.openView({
      kind: 'dsh-side-chat.session',
      resourceKey: sessionId === undefined ? 'side-chat:picker' : `side-chat:${sessionId}`,
      role: 'content',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: false,
      title: t('title'),
    })
  }

  if (paneUsable) {
    disposers.push(pane.registerView({
      descriptor: {
        kind: 'dsh-side-chat.session',
        label: t('title'),
        componentKey: 'side-chat-session',
        role: 'content',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: false,
      },
      // 工厂即组件（workbench 经 createElement 渲染）：per-tab controller
      // 在实例内部创建，多 tab 各自绑定互不串扰。
      component: (props?: { view?: { resourceKey?: string } }) => createElement(SideChatTab, {
        face: sessions,
        presetSessionId: parsePreset(props?.view?.resourceKey),
        sessions: sessionOptions(),
        currentSessionId: sessions.list.getSnapshot().current,
        t,
      }),
    }))
    if (typeof pane.registerCommand === 'function') {
      disposers.push(pane.registerCommand({
        descriptor: {
          id: 'side-chat.open',
          label: t('title'),
          presentation: { launcher: true },
          slash: { name: 'side-chat', hint: t('empty.body'), category: 'pane' },
        },
        execute: () => { openSideChat() },
      }))
    }
  }

  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}

/** resource key → 预选 session（`side-chat:picker` 起步为空）。 */
function parsePreset(resourceKey: string | undefined): string | undefined {
  const preset = /^side-chat:(.+)$/.exec(resourceKey ?? '')?.[1]
  return preset !== undefined && preset !== 'picker' ? preset : undefined
}

function SideChatTab(props: {
  readonly face: SideChatSessionsFace
  readonly presetSessionId: string | undefined
  readonly sessions: readonly { sessionId: string; displayTitle: string; running: boolean }[]
  readonly currentSessionId: string | undefined
  readonly t: SideChatTranslator
}): ReactNode {
  // per-tab controller：lazy useState 保证单实例创建，dispose 于卸载 effect。
  const [controller] = useState(() => new SideChatController(props.face))
  useEffect(() => () => { controller.dispose() }, [controller])
  // resourceKey 预选：open 时携带的目标 session（effect 内附着，一次）。
  useEffect(() => {
    if (props.presetSessionId !== undefined) controller.attach(props.presetSessionId)
  }, [controller, props.presetSessionId])
  return SideChatView({
    controller,
    sessions: props.sessions,
    currentSessionId: props.currentSessionId,
    t: props.t,
  })
}

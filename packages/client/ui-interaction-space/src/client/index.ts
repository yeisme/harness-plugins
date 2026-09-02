/**
 * Interaction space client entry：pane 视图注册 + `space/ref` 会话事件消费。
 *
 * 装配：`sessions` + `locale` 静态注入；`paneWorkbench` 与
 * `conversationEvents` optional probe（各自缺席零注册、面板 fail-closed）。
 * 视图 `interaction.space`（resource key `space:<owner>:<ref>@<version>`）。
 * 主选择不变量由控制器保证（不持有 open 面）。
 *
 * @module @yeisme/dsh-client-ui-interaction-space/client
 */

import { createElement } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import {
  InteractionSpaceController,
  type OwnerDispatchFace,
  type SpaceSessionsFace,
} from '../controller.ts'
import { InteractionSpaceView } from '../view.tsx'
import { attachSharedSelectionInteraction, getSharedSelectionInteraction } from '../selection/layer.ts'

export const name = 'client-ui-interaction-space'
export const inject = ['sessions', 'locale'] as const

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
}

interface ConversationEventsFace {
  register?(definition: unknown): () => void
}

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

export interface ApplyInteractionSpaceOptions {
  /** 空间目标工件（首个打开的空间；更多空间经 openView resourceKey）。 */
  readonly resource: { readonly owner: string; readonly ref: string; readonly version: string; readonly title: string; readonly mediaType: string }
  /** 宿主 Conversation Composer seam（缺席：本地评论降级）。 */
  readonly composer?: { send(input: unknown): Promise<{ ok: boolean; error?: { message?: string } }> } | undefined
  /** 领域 owner dispatch（缺席：提案只读 + 复制出口）。 */
  readonly dispatch?: OwnerDispatchFace | undefined
}

export function apply(ctx: Context, options?: ApplyInteractionSpaceOptions): () => void {
  if (options?.resource === undefined) return () => {}
  const disposers: Array<() => void> = []
  const sessions = (ctx as unknown as { sessions?: SpaceSessionsFace }).sessions
  const pane = optionalLookup(ctx, 'paneWorkbench') as PaneWorkbenchFace | undefined
  const conversationEvents = optionalLookup(ctx, 'conversationEvents') as ConversationEventsFace | undefined

  const controller = new InteractionSpaceController({
    resource: options.resource,
    ...sessions === undefined ? {} : { sessions },
    ...options.composer === undefined ? {} : { composer: options.composer },
    ...options.dispatch === undefined ? {} : { dispatch: options.dispatch },
  })

  if (pane !== undefined && typeof pane.registerView === 'function') {
    disposers.push(pane.registerView({
      descriptor: {
        kind: 'interaction.space',
        label: '交互空间',
        componentKey: 'interaction-space',
        role: 'content',
        preferredRegion: 'right',
        retention: 'snapshot',
        singleton: false,
        presentation: { description: '以工件为中心的 agent 协作空间：锚点、附着会话、提案与审批。' },
      },
      component: (props?: { view?: { resourceKey?: string } }) => {
        void props
        return createElement(InteractionSpaceView, { controller })
      },
    }))
  }

  // Selection Interaction V2：本 pane 作为 context publisher 接入 singleton
  // 交互层（锚点/提案/时间线表面共享全局 Actions）；关闭 pane 只 detach，
  // 不清理主会话、anchor 或 owner 状态（singleton refcount 管理）。
  disposers.push(attachSharedSelectionInteraction(
    (typeof document !== 'undefined' ? document : undefined) as Document,
  ))
  const sharedLayer = getSharedSelectionInteraction()
  if (sharedLayer !== undefined) {
    disposers.push(sharedLayer.registerContextPublisher({
      id: 'interaction-space',
      capabilities: ['annotation.batch'],
    }))
  }

  // `space/ref` 事件族：agent 只投 typed directive，渲染真值在空间。
  if (conversationEvents !== undefined && typeof conversationEvents.register === 'function') {
    disposers.push(conversationEvents.register({
      name: 'space/ref',
      resolve: (event: unknown) => {
        const record = isRecord(event) ? event : undefined
        const directive = record === undefined ? undefined : (record.data ?? record) as unknown
        controller.ingestDirective(directive)
        return { node: { kind: 'space-ref', handled: true } }
      },
    }))
  }

  return () => {
    for (const dispose of disposers) dispose()
    controller.dispose()
  }
}

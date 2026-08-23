/**
 * Client 装配：capability probe + provider 注册 + shell.overlay 编辑器。
 *
 * 兼容性合同（spec：seam 不可用时诚实降级；测试钉住）：
 * 1. 先探测 `ctx.sessionGroupings`（上游 ui-workspace 的 v1alpha1 seam）。
 *    缺失时：不注册 provider、不注入任何 slot、不做任何 DOM fallback、
 *    不替换侧栏——只返回未注册结果与原因（无死按钮、无 runtime crash）。
 * 2. seam 可用时：注册 `yeisme.session-tags` provider（dispose 随插件
 *    fiber），并向 `shell.overlay` 注入编辑器 seat（空闲零渲染）。
 * 3. 编辑器 overlay 挂在既有 shell.overlay 列表 slot：不新建第二侧栏，
 *    不持有 DSH 编辑状态，mutation 只走 sessionTags.set。
 * 4. 连接 reset / 窗口聚焦经 controller 的 generation 刷新；本插件不
 *    自建连接状态机（connection 事件由宿主 runtime 提供，缺省保守轮询
 *    边界为 V1 决策：reset/focus/own-write）。
 *
 * @module @yeisme/dsh-client-ui-session-tags/client/register
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { createSessionTagsController, SessionTagsController } from './controller.ts'
import { createTagEditorController, TagEditorController } from './editor.ts'
import { createSessionTagsProvider } from './provider.ts'
import { createTagEditorOverlayEntry, type TagEditorOverlayLabels } from './TagEditorOverlay.tsx'
import type { SessionTagsRemoteFace } from './wire.ts'

/** 分组 seam 的结构形状（`ctx.sessionGroupings`）。 */
export interface SessionGroupingsRegistryLike {
  register(provider: Parameters<SessionGroupingsRegistryRegister>[0]): () => void
}
type SessionGroupingsRegistryRegister = (provider: {
  readonly id: string
  readonly label: string | (() => string)
  readonly order?: number
  getSnapshot(): unknown
  subscribe(listener: () => void): () => void
  readonly sessionActions?: readonly {
    readonly id: string
    readonly label: string | (() => string)
    open(sessionId: string): void
  }[]
}) => () => void

/** 注册结果（供测试与诊断；失败时 UI 保持零入口）。 */
export interface SessionTagsRegistration {
  readonly registered: boolean
  readonly reason?: 'session-groupings-unavailable'
  readonly controller?: SessionTagsController
  readonly editor?: TagEditorController
}

/** 宿主可注入的依赖（缺省从 ctx 的 Typert client 解析 sessionTags）。 */
export interface RegisterSessionTagsOptions {
  readonly remote?: SessionTagsRemoteFace
  readonly locale?: string
  readonly labels?: SessionTagsProviderLabelsShape
  readonly overlayLabels?: TagEditorOverlayLabels
  /** 已知 SessionId 快照源（缺省经 ctx.sessions）。 */
  readonly allSessionIds?: () => readonly string[]
}

interface SessionTagsProviderLabelsShape {
  readonly menuLabel?: string
  readonly untaggedLabel?: string
  readonly manageActionLabel?: string
}

/** 探测分组 seam：只有存在 register 函数才算可用。 */
export function hasSessionGroupingsSeam(ctx: unknown): ctx is { sessionGroupings: SessionGroupingsRegistryLike } {
  const candidate = ctx as { sessionGroupings?: unknown } | null
  const registry = candidate?.sessionGroupings
  return typeof registry === 'object' && registry !== null
    && typeof (registry as SessionGroupingsRegistryLike).register === 'function'
}

/** 解析 sessionTags Remote（Typert client 面的形状探测；缺省走 ctx.remote）。 */
function resolveRemote(ctx: ClientContext, override?: SessionTagsRemoteFace): SessionTagsRemoteFace {
  if (override !== undefined) return override
  const remote = (ctx as unknown as { remote?: Record<string, unknown> }).remote
  const sessionTags = remote?.sessionTags
  if (typeof sessionTags === 'object' && sessionTags !== null
    && typeof (sessionTags as SessionTagsRemoteFace).list === 'function'
    && typeof (sessionTags as SessionTagsRemoteFace).set === 'function') {
    return sessionTags as SessionTagsRemoteFace
  }
  throw new Error('session-tags client: sessionTags remote is not available (host sidecar missing?)')
}

/**
 * 注册 tags provider 与编辑器。seam 缺失时零注册、零 slot、零 DOM 操作。
 */
export function registerSessionTagsClient(
  ctx: ClientContext,
  options: RegisterSessionTagsOptions = {},
): SessionTagsRegistration {
  if (!hasSessionGroupingsSeam(ctx)) {
    // 诚实降级：不注册 provider、不注入 slot、不写 DOM；Host sidecar 可
    // 独立保持加载（本函数不做任何 host 侧动作）。
    return { registered: false, reason: 'session-groupings-unavailable' }
  }
  const remote = resolveRemote(ctx, options.remote)
  const controller = createSessionTagsController({ remote })
  const editor = createTagEditorController({ remote, controller })
  const allSessionIds = options.allSessionIds ?? defaultAllSessionIds(ctx)
  const provider = createSessionTagsProvider({
    controller,
    allSessionIds,
    ...(options.locale === undefined ? {} : { locale: options.locale }),
    ...(options.labels === undefined ? {} : { labels: options.labels }),
    onManageTags: sessionId => {
      editor.open(sessionId)
    },
  })

  const disposers: Array<() => void> = []
  const groupings = (ctx as unknown as { sessionGroupings: SessionGroupingsRegistryLike }).sessionGroupings
  disposers.push(groupings.register(provider as never))

  // shell.overlay 编辑器 seat：列表 slot，常驻注册、空闲零渲染。
  const slots = (ctx as unknown as {
    slots?: {
      inject(name: string, factory: () => unknown): () => void
    }
  }).slots
  if (slots !== undefined && typeof slots.inject === 'function') {
    disposers.push(slots.inject('shell.overlay', () => createTagEditorOverlayEntry(editor, options.overlayLabels)))
  }

  // 首次挂载读取 + 刷新触发（reset/focus 由宿主事件线驱动；此处仅聚焦）。
  void controller.refresh()
  const onFocus = (): void => { void controller.onWindowFocus() }
  if (typeof window !== 'undefined') window.addEventListener('focus', onFocus)

  ctx.effect(() => () => {
    if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus)
    for (const dispose of disposers.splice(0)) dispose()
    controller.dispose()
    if (editor.getSnapshot().open) editor.close()
  }, 'client-ui-session-tags: dispose provider/editor')

  return { registered: true, controller, editor }
}

/** 缺省 SessionId 快照源：ctx.sessions 列表（存在时）。 */
function defaultAllSessionIds(ctx: ClientContext): () => readonly string[] {
  const sessions = (ctx as unknown as {
    sessions?: { list?(): { ids: readonly string[] } | undefined; snapshot?(): { ids: readonly string[] } | undefined }
  }).sessions
  return () => {
    const snapshot = sessions?.snapshot?.() ?? sessions?.list?.()
    return snapshot?.ids ?? []
  }
}

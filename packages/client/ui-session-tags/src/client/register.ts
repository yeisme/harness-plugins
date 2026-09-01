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
import { createElement } from 'react'
import { createSessionTagsController, SessionTagsController } from './controller.ts'
import { createTagEditorController, TagEditorController } from './editor.ts'
import { createSessionTagsProvider } from './provider.ts'
import { createSessionFunctionsProvider, type OrganizationSessionRef } from './organization-provider.ts'
import { createSessionOrganizationController, type SessionOrganizationController } from './organization-controller.ts'
import { OrganizationEditorController } from './organization-editor.ts'
import { OrganizationEditorOverlay } from './OrganizationEditorOverlay.tsx'
import { sessionManagementRemoteContribution, sessionOrganizationRemoteContribution } from './organization-remote-contribution.ts'
import { createTagEditorOverlayEntry, type TagEditorOverlayLabels } from './TagEditorOverlay.tsx'
import type {
  SessionTagsListAnswerV1,
  SessionTagsRemoteFace,
  SessionTagsSetAnswerV1,
  SessionTagsSetInputV1,
} from './wire.ts'
import type { SessionOrganizationRemoteFace } from './organization-wire.ts'

/** 分组 seam 的结构形状（`ctx.sessionGroupings`）。 */
export interface SessionGroupingsRegistryLike {
  register(provider: Parameters<SessionGroupingsRegistryRegister>[0]): () => void
  readonly capabilities?: { readonly hierarchy?: boolean; readonly semanticColor?: boolean } | undefined
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
  readonly reason?: 'session-groupings-unavailable' | 'session-tags-remote-unavailable'
  readonly controller?: SessionTagsController
  readonly editor?: TagEditorController
  readonly organizationController?: SessionOrganizationController
  readonly organizationEditor?: OrganizationEditorController
}

/** 宿主可注入的依赖（缺省从 ctx 的 Typert client 解析 sessionTags）。 */
export interface RegisterSessionTagsOptions {
  readonly remote?: SessionTagsRemoteFace
  readonly locale?: string
  readonly labels?: SessionTagsProviderLabelsShape
  readonly overlayLabels?: TagEditorOverlayLabels
  /** 已知 SessionId 快照源（缺省经 ctx.sessions）。 */
  readonly allSessionIds?: () => readonly string[]
  readonly organizationRemote?: SessionOrganizationRemoteFace
  readonly organizationSessions?: () => readonly OrganizationSessionRef[]
  readonly onManageOrganization?: (sessionId: string) => void
}

interface SessionTagsProviderLabelsShape {
  readonly menuLabel?: string
  readonly untaggedLabel?: string
  readonly manageActionLabel?: string
}

/**
 * 探测分组 seam：只有存在 register 函数才算可用。
 *
 * 浏览器 ModuleLoader 的 guard facade 对未声明 service 的属性访问直接抛错
 * （denied read），但始终放行 `ctx.get(name)` 可选查找——所以探测顺序：
 * 1. `ctx.get('sessionGroupings')`（guard/原生 cordis 均支持，可选语义不抛错）；
 * 2. 直读 `ctx.sessionGroupings`（node 测试与无 guard 宿主）。
 * 任一路径抛错都视为 seam 不存在（诚实降级），绝不影响插件激活。
 */
export function hasSessionGroupingsSeam(ctx: unknown): ctx is { sessionGroupings: SessionGroupingsRegistryLike } {
  let registry: unknown
  const optionalGet = (ctx as { get?: unknown } | null)?.get
  if (typeof optionalGet === 'function') {
    // guard/原生 cordis：只认可选查找结果，undefined 即 seam 缺席。
    // 不再回退属性直读——那会在 guard 上触发 denied read 并上报噪音错误。
    try {
      registry = (optionalGet as (name: string) => unknown).call(ctx, 'sessionGroupings')
    } catch {
      return false
    }
  } else {
    // 无 get 通道（node 测试/无 guard 宿主）：直读属性，抛错按缺席处理。
    try {
      registry = (ctx as { sessionGroupings?: unknown } | null)?.sessionGroupings
    } catch {
      return false
    }
  }
  return typeof registry === 'object' && registry !== null
    && typeof (registry as SessionGroupingsRegistryLike).register === 'function'
}

/**
 * 命名空间方法的原生返回：`{ok:true,value}` 传输层 + 业务层 ok 双层判别。
 * 传输层失败（离线/中断/拒绝）在此抛错，由 controller 的错误路径诚实呈现。
 */
interface RemoteResultLike<T> {
  readonly ok: boolean
  readonly value?: T
  readonly error?: unknown
}

/** 解析 sessionTags Remote：优先已挂命名空间，否则经 `$mount` 自挂后取回。 */
async function resolveRemote(ctx: ClientContext, override?: SessionTagsRemoteFace): Promise<SessionTagsRemoteFace> {
  if (override !== undefined) return override
  const remote = optionalLookup(ctx, 'remote')
  const direct = isRemoteFace(remote?.sessionTags)
  if (direct) return remote.sessionTags as SessionTagsRemoteFace

  // out-of-tree 命名空间不在 Client assembly 生成清单里：走公开 $mount 自挂。
  // $mount 失败（旧 runtime 无该 API / 服务端拒绝）→ 诚实降级，返回 undefined。
  if (remote !== undefined && typeof (remote as { $mount?: unknown }).$mount === 'function') {
    try {
      await (remote as {
        $mount(contribution: unknown): Promise<() => Promise<void>>
      }).$mount(sessionManagementRemoteContribution)
    } catch {
      return undefined as unknown as SessionTagsRemoteFace
    }
    const mounted = optionalLookup(ctx, 'remote.sessionTags')
    if (mounted !== undefined) return unwrapNamespace(mounted as Record<string, unknown>)
  }
  return undefined as unknown as SessionTagsRemoteFace
}

/** guard facade 的可选查找（不抛错）；无 get 通道时回退属性直读。 */
function optionalLookup(ctx: ClientContext, name: string): Record<string, unknown> | undefined {
  let direct: unknown
  try {
    const optionalGet = (ctx as { get?: unknown } | null)?.get
    if (typeof optionalGet === 'function') {
      direct = (optionalGet as (n: string) => unknown).call(ctx, name)
    } else {
      direct = (ctx as unknown as Record<string, unknown>)[name]
    }
  } catch {
    return undefined
  }
  return direct === undefined || direct === null ? undefined : direct as Record<string, unknown>
}

function isRemoteFace(candidate: unknown): candidate is SessionTagsRemoteFace {
  return typeof candidate === 'object' && candidate !== null
    && typeof (candidate as SessionTagsRemoteFace).list === 'function'
    && typeof (candidate as SessionTagsRemoteFace).set === 'function'
}

function isOrganizationRemoteFace(candidate: unknown): candidate is SessionOrganizationRemoteFace {
  if (typeof candidate !== 'object' || candidate === null) return false
  return ['snapshot', 'setAssignment', 'putFunctionType', 'putTagCatalog', 'putRule', 'classify', 'planBatch', 'unlockAdmin', 'executeBatch', 'undoBatch']
    .every(method => typeof (candidate as Record<string, unknown>)[method] === 'function')
}

/** Resolve or self-mount the additive organization namespace. */
export async function resolveSessionOrganizationRemote(
  ctx: ClientContext,
  override?: SessionOrganizationRemoteFace,
): Promise<SessionOrganizationRemoteFace | undefined> {
  if (override !== undefined) return override
  const remote = optionalLookup(ctx, 'remote')
  if (isOrganizationRemoteFace(remote?.sessionOrganization)) return remote.sessionOrganization
  const existingMounted = optionalLookup(ctx, 'remote.sessionOrganization')
  if (existingMounted !== undefined && isOrganizationRemoteFace(existingMounted)) return unwrapOrganizationNamespace(existingMounted)
  if (remote === undefined || typeof (remote as { $mount?: unknown }).$mount !== 'function') return undefined
  try {
    await (remote as { $mount(contribution: unknown): Promise<() => Promise<void>> }).$mount(sessionOrganizationRemoteContribution)
  } catch {
    return undefined
  }
  const mounted = optionalLookup(ctx, 'remote.sessionOrganization')
  if (mounted === undefined) return undefined
  return unwrapOrganizationNamespace(mounted)
}

function unwrapOrganizationNamespace(mounted: Record<string, unknown>): SessionOrganizationRemoteFace {
  const invoke = async <T>(method: string, input?: unknown): Promise<T> => {
    const fn = mounted[method]
    if (typeof fn !== 'function') throw new Error(`sessionOrganization.${method} is unavailable`)
    const answer = await (fn as (value?: unknown) => Promise<RemoteResultLike<T>>)(input)
    if (!answer.ok) throw new Error(`sessionOrganization.${method} transport failure: ${JSON.stringify(answer.error)}`)
    return answer.value as T
  }
  return {
    snapshot: () => invoke('snapshot'),
    setAssignment: input => invoke('setAssignment', input),
    putFunctionType: input => invoke('putFunctionType', input),
    putTagCatalog: input => invoke('putTagCatalog', input),
    putRule: input => invoke('putRule', input),
    classify: input => invoke('classify', input),
    planBatch: input => invoke('planBatch', input),
    unlockAdmin: () => invoke('unlockAdmin'),
    executeBatch: input => invoke('executeBatch', input),
    undoBatch: input => invoke('undoBatch', input),
  }
}

/** 把 `$mount` 后的命名空间服务适配为 SessionTagsRemoteFace（解 RemoteResult 包装）。 */
function unwrapNamespace(namespace: Record<string, unknown>): SessionTagsRemoteFace {
  const list = namespace.list as (() => Promise<RemoteResultLike<SessionTagsListAnswerV1>>) | undefined
  const set = namespace.set as ((input: SessionTagsSetInputV1) => Promise<RemoteResultLike<SessionTagsSetAnswerV1>>) | undefined
  if (typeof list !== 'function' || typeof set !== 'function') {
    throw new Error('session-tags client: mounted sessionTags namespace lacks list/set')
  }
  return {
    async list() {
      const answered = await list()
      if (!answered.ok) throw new Error(`sessionTags.list transport failure: ${JSON.stringify(answered.error)}`)
      return answered.value as SessionTagsListAnswerV1
    },
    async set(input) {
      const answered = await set(input)
      if (!answered.ok) throw new Error(`sessionTags.set transport failure: ${JSON.stringify(answered.error)}`)
      return answered.value as SessionTagsSetAnswerV1
    },
  }
}

/**
 * 注册 tags provider 与编辑器。seam 或 sessionTags Remote 缺失时零注册、
 * 零 slot、零 DOM 操作（两者都是 mutation 可用性的硬前置：缺 remote 的
 * provider 只会制造死按钮）。
 */
export async function registerSessionTagsClient(
  ctx: ClientContext,
  options: RegisterSessionTagsOptions = {},
): Promise<SessionTagsRegistration> {
  if (!hasSessionGroupingsSeam(ctx)) {
    // 诚实降级：不注册 provider、不注入 slot、不写 DOM；Host sidecar 可
    // 独立保持加载（本函数不做任何 host 侧动作）。
    return { registered: false, reason: 'session-groupings-unavailable' }
  }
  const remote = await resolveRemote(ctx, options.remote)
  if (remote === undefined || !isRemoteFace(remote)) {
    return { registered: false, reason: 'session-tags-remote-unavailable' }
  }
  const controller = createSessionTagsController({ remote })
  const editor = createTagEditorController({ remote, controller })
  const allSessionIds = options.allSessionIds ?? defaultAllSessionIds(ctx)
  // sessions.list 是独立 SnapshotStore：其变化（会话晚到/新增/离线重拉）
  // 不经 controller 事件——把 store 的 subscribe 接进 provider 的重投影。
  const sessionsStore = optionalLookup(ctx, 'sessions')?.list
  const sessionsSubscribe = sessionsStore !== null && typeof sessionsStore === 'object' && sessionsStore !== undefined
    ? (sessionsStore as { subscribe?: unknown }).subscribe
    : undefined
  const onSessionsChanged = typeof sessionsSubscribe === 'function' && options.allSessionIds === undefined
    ? (listener: () => void) =>
      (sessionsSubscribe as (fn: () => void) => () => void)(listener)
    : undefined
  const provider = createSessionTagsProvider({
    controller,
    allSessionIds,
    ...(onSessionsChanged === undefined ? {} : { onSessionsChanged }),
    ...(options.locale === undefined ? {} : { locale: options.locale }),
    ...(options.labels === undefined ? {} : { labels: options.labels }),
    onManageTags: sessionId => {
      editor.open(sessionId)
    },
  })

  const disposers: Array<() => void> = []
  // guard facade 下未声明 service 的属性直读会抛错——统一走 optionalLookup。
  const groupings = optionalLookup(ctx, 'sessionGroupings') as SessionGroupingsRegistryLike | undefined
  if (groupings === undefined || typeof groupings.register !== 'function') {
    return { registered: false, reason: 'session-groupings-unavailable' }
  }
  disposers.push(groupings.register(provider as never))

  // shell.overlay seats use the same official list slot; missing slots keeps
  // both editors unavailable without affecting grouping projections.
  const slots = (ctx as unknown as {
    slots?: {
      inject(name: string, factory: () => unknown): () => void
      register(
        options: { name: string; id: string; order?: number; label?: string | (() => string) },
        component: () => unknown,
      ): () => void
    }
  }).slots

  const organizationRemote = await resolveSessionOrganizationRemote(ctx, options.organizationRemote)
  let organizationController: SessionOrganizationController | undefined
  let organizationEditor: OrganizationEditorController | undefined
  if (organizationRemote !== undefined && groupings.capabilities?.hierarchy === true) {
    organizationController = createSessionOrganizationController(organizationRemote)
    await organizationController.refresh()
    organizationEditor = new OrganizationEditorController(organizationRemote, organizationController)
    const organizationProvider = createSessionFunctionsProvider({
      controller: organizationController,
      sessions: options.organizationSessions ?? (() => {
        const state = organizationController?.getSnapshot()
        return state?.status === 'ready'
          ? state.snapshot.assignments.map(item => ({ sessionId: item.sessionId, workspaceRef: item.workspaceRef }))
          : []
      }),
      onManage: options.onManageOrganization ?? (sessionId => { organizationEditor?.open(sessionId) }),
      labels: { menu: 'By function', unclassified: 'Unclassified', manage: 'Organize conversation' },
    })
    disposers.push(groupings.register(organizationProvider as never))
    disposers.push(() => { organizationProvider.dispose() })
    if (slots !== undefined && typeof slots.inject === 'function' && typeof slots.register === 'function') {
      const organizationEditorRef = organizationEditor
      disposers.push(slots.inject('shell.overlay', () => slots.register({
        name: 'shell.overlay', id: 'yeisme.session-organization.editor', order: 101, label: 'Organize conversation',
      }, () => createElement(OrganizationEditorOverlay, { controller: organizationEditorRef }))))
    }
  }
  // shell.overlay 编辑器 seat：列表 slot，常驻注册、空闲零渲染。
  if (slots !== undefined && typeof slots.inject === 'function' && typeof slots.register === 'function') {
    const Entry = createTagEditorOverlayEntry(editor, options.overlayLabels)
    disposers.push(slots.inject('shell.overlay', () => slots.register({
      name: 'shell.overlay',
      id: 'yeisme.session-tags.editor',
      order: 100,
      label: options.overlayLabels?.title ?? 'Manage tags',
    }, Entry)))
  }

  // 首次挂载读取 + 刷新触发（reset/focus 由宿主事件线驱动；此处仅聚焦）。
  void controller.refresh()
  const onFocus = (): void => { void controller.onWindowFocus() }
  if (typeof window !== 'undefined') window.addEventListener('focus', onFocus)

  ctx.effect(() => () => {
    if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus)
    provider.dispose()
    for (const dispose of disposers.splice(0)) dispose()
    controller.dispose()
    organizationController?.dispose()
    organizationEditor?.close()
    if (editor.getSnapshot().open) editor.close()
  }, 'client-ui-session-tags: dispose provider/editor')

  return {
    registered: true,
    controller,
    editor,
    ...(organizationController === undefined ? {} : { organizationController }),
    ...(organizationEditor === undefined ? {} : { organizationEditor }),
  }
}

/**
 * 缺省 SessionId 快照源：ctx.sessions 列表（存在时）。
 * 真实浏览器 runtime 的形态是 `sessions.list: SnapshotStore<SessionListState>`
 * （`getSnapshot().ids`）；测试/宿主注入可能是 `snapshot()`/`list()` 函数——
 * 依序探测，全都不可用时返回空（Untagged 组为空是诚实投影，不伪造）。
 */
function defaultAllSessionIds(ctx: ClientContext): () => readonly string[] {
  const sessions = (ctx as unknown as { sessions?: { list?: unknown, snapshot?: unknown } } | undefined)?.sessions
  return () => {
    const list: unknown = sessions?.list
    if (list !== null && typeof list === 'object' && list !== undefined) {
      const store = list as { getSnapshot?: unknown }
      if (typeof store.getSnapshot === 'function') {
        const state = (store.getSnapshot as () => { ids?: readonly string[] } | undefined)()
        return state?.ids ?? []
      }
    }
    if (typeof list === 'function') {
      const called = (list as () => { ids?: readonly string[] } | undefined)()
      if (called !== undefined) return called.ids ?? []
    }
    const snapshot = (sessions?.snapshot as (() => { ids?: readonly string[] } | undefined) | undefined)?.()
    return snapshot?.ids ?? []
  }
}

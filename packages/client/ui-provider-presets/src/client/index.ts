/**
 * DSH Web provider presets client plugin（浏览器半）。
 *
 * 在 Models 设置页预留的 `settings.models.footer` 扩展 slot 注册「渠道市场」：
 * 预设渠道卡片 + 引导式添加（GET /models 拉取 + 密钥写入 host + settings
 * mutate 保存 + 可选设为默认）。全部读写经上游已暴露的 remote namespaces，
 * 不改 DSH core。
 *
 * 能力探针（仓红线）：静态 inject 只声明官方 runtime 恒有服务（locale——
 * 静态声明缺服务面会永久 pending 拖死 web boot）；`remote` 根面与
 * `remote.settings`/`remote.credentials`/`remote.llm` 三个子命名空间（0.1.2-rc.1
 * 起）经 `ctx.get` optional-service 通道探针 + `internal/service` 事件晚绑定
 * （浏览器 guard facade 拒绝未声明 inject 的属性访问），缺失即零注册——
 * rc.6 运行时下 footer slot 同样不存在，Models 页保持原生形态，无死按钮。
 *
 * @module @yeisme/dsh-client-ui-provider-presets/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { RemoteRootFace } from './wire.ts'
import { createProviderPresetsOperations } from './operations.ts'
import type { ProviderPresetsOperations } from './operations.ts'
import { ProviderPresetsStore } from './store.ts'
import { ProviderPresetsSection } from './ProviderPresetsSection.tsx'
import type { ProviderPresetsInjected, ProviderPresetsTranslator } from './ProviderPresetsSection.tsx'
import { NS, en, zh, interpolate } from './locales.ts'

export { PROVIDER_PRESETS, presetCatalogViolations } from './presets.ts'
export type { ProviderPreset, Bilingual } from './presets.ts'
export {
  createProviderPresetsOperations,
  DEFAULT_MODEL_NS,
  LLM_SETTINGS_NS,
} from './operations.ts'
export type {
  DiscoveryOutcome,
  ProviderPresetsOperations,
  ReadOutcome,
  SettingsWriteOutcome,
} from './operations.ts'
export { ProviderPresetsStore, readDefaultSelection, readUserProviders } from './store.ts'
export type { DirectoryRow, ProviderPresetsSnapshot } from './store.ts'
export { buildProviderProfile, buildSaveOps, buildSetDefaultOps, validateDraft } from './draft.ts'
export type { DraftFieldError, ProviderDraft } from './draft.ts'
export { ProviderPresetsSection } from './ProviderPresetsSection.tsx'
export type {
  ProviderPresetsInjected,
  ProviderPresetsSectionProps,
  ProviderPresetsTranslator,
} from './ProviderPresetsSection.tsx'
export { PresetAddDialog } from './PresetAddDialog.tsx'
export type { PresetAddDialogProps } from './PresetAddDialog.tsx'
export { NS, en, zh } from './locales.ts'
export type { ProviderPresetsKey } from './locales.ts'
export * from './wire.ts'

export const name = 'client-ui-provider-presets'
export const inject = ['locale'] as const

/**
 * 经 `ctx.get` 读取可选服务（浏览器 ModuleLoader 的 guard facade 会拒绝未
 * 声明 inject 的属性访问——`ctx.remote.settings` 路径被拦；`ctx.get` 是
 * 官方 optional-service 通道，直读全局服务存储，返回原始服务对象）。
 */
function readService(ctx: ClientContext, name: string): unknown {
  try {
    const get = (ctx as unknown as { get?: unknown }).get
    if (typeof get !== 'function') return undefined
    return (get as (serviceName: string) => unknown).call(ctx, name)
  } catch {
    return undefined
  }
}

/**
 * 结构探测 remote 根面：`remote` 与三个子命名空间都经 `ctx.get` 点分名读取
 *（guard facade 拦截服务对象的嵌套属性访问——`remote.settings` 属性路径被拦，
 * 点分名 `get` 是官方通道）。取回后组装成普通对象，后续属性读取不再过 guard。
 */
function readRemoteRoot(ctx: ClientContext): RemoteRootFace | undefined {
  const root = readService(ctx, 'remote')
  if (typeof root !== 'object' || root === null) return undefined
  const $on = (root as Record<string, unknown>).$on
  if (typeof $on !== 'function') return undefined
  const settings = readService(ctx, 'remote.settings')
  const credentials = readService(ctx, 'remote.credentials')
  const llm = readService(ctx, 'remote.llm')
  type MutableFace = { -readonly [K in keyof RemoteRootFace]: RemoteRootFace[K] }
  // $on 必须绑定原服务对象调用（内部读 this 状态）；解构后裸调用会以 undefined
  // 为 this 抛 "reading 'subscribe'"。
  const face = {
    $on: ((event: Parameters<RemoteRootFace['$on']>[0], listener: () => void) =>
      ($on as (this: unknown, e: Parameters<RemoteRootFace['$on']>[0], l: () => void) => () => void).call(root, event, listener)) as RemoteRootFace['$on'],
  } as MutableFace
  if (settings !== undefined) face.settings = settings as NonNullable<RemoteRootFace['settings']>
  if (credentials !== undefined) face.credentials = credentials as NonNullable<RemoteRootFace['credentials']>
  if (llm !== undefined) face.llm = llm as NonNullable<RemoteRootFace['llm']>
  return face
}

/** 结构探测 slots 面（注入 + 注册，缺一不可）。 */
function readSlots(ctx: ClientContext): {
  inject(name: string, factory: () => unknown): () => void
  register(
    options: { name: string; id: string; order?: number; label?: string | (() => string); inject?: () => unknown },
    component: unknown,
  ): () => void
} | undefined {
  const candidate = readService(ctx, 'slots')
  if (typeof candidate !== 'object' || candidate === null) return undefined
  const slots = candidate as Record<string, unknown>
  if (typeof slots.inject !== 'function' || typeof slots.register !== 'function') return undefined
  return slots as unknown as ReturnType<typeof readSlots>
}

/** 三个子命名空间是否齐备。 */
function hasRequiredFaces(remote: RemoteRootFace): boolean {
  return createProviderPresetsOperations(remote) !== undefined
}

/**
 * 绑定翻译器：优先 ctx.locale（注册过 NS 字典，模板 {name} 由 Translate
 * 插值），失败回退内置 zh 字典（宿主 locale 服务缺位只影响文案来源）。
 */
function bindTranslator(ctx: ClientContext): ProviderPresetsTranslator {
  try {
    const locale = (ctx as unknown as { locale?: { bind?: (ns: string) => (key: string, params?: Record<string, unknown>) => string } }).locale
    if (locale !== undefined && typeof locale.bind === 'function') {
      const bound = locale.bind(NS)
      return (key, params) => {
        const text = bound(key, params) || zh[key]
        return params === undefined ? text : interpolate(text, params)
      }
    }
  } catch {
    // guard facade 拒绝读取：回退内置字典
  }
  return (key, params) => {
    const text = zh[key]
    return params === undefined ? text : interpolate(text, params)
  }
}

/** 读取当前 locale 偏好（zh 为主，其余按 en 渲染）。 */
function readLocalePreference(ctx: ClientContext): 'zh' | 'en' {
  try {
    const locale = (ctx as unknown as { locale?: { getLocale?: () => { active?: unknown } } }).locale
    const active = locale?.getLocale?.().active
    if (typeof active === 'string' && active.toLowerCase().startsWith('zh')) return 'zh'
  } catch {
    // 读取失败按 en
  }
  return 'en'
}

/**
 * 挂载渠道市场：注册 footer slot 条目并订阅三类失效事件（对称释放）。
 * @param ctx - remote 面已确认可用的 client context。
 * @param remote - 探针通过后的 remote 根面。
 * @returns 卸载函数。
 */
function mountSection(ctx: ClientContext, remote: RemoteRootFace): () => void {
  const slots = readSlots(ctx)
  const operations: ProviderPresetsOperations = createProviderPresetsOperations(remote)!
  const controller = new ProviderPresetsStore(operations)
  const t = bindTranslator(ctx)
  const locale = readLocalePreference(ctx)
  const injected = (): ProviderPresetsInjected => ({ controller, operations, t, locale })
  const disposers: Array<() => void> = []
  if (slots !== undefined) {
    disposers.push(slots.inject('settings.models.footer', () =>
      slots.register(
        { name: 'settings.models.footer', id: 'provider-presets', order: 20, inject: injected },
        ProviderPresetsSection,
      )))
  }
  disposers.push(remote.$on('settings/document-updated', () => controller.refreshIfLoaded()))
  disposers.push(remote.$on('credentials/reference-updated', () => controller.refreshIfLoaded()))
  disposers.push(remote.$on('llm/adapters-updated', () => controller.refreshIfLoaded()))
  return () => {
    for (const dispose of disposers) dispose()
  }
}

/**
 * 挂载 client 面：字典先行；remote 面立即可用即挂载，否则监听
 * `internal/service`（`remote` / `remote.*` 到位即重试，成功即停听）。
 * 面始终不出现则零注册（诚实降级）。guard facade 下不走属性访问与
 * `ctx.inject` 晚绑定——`ctx.get` + 服务事件是官方 optional-service 通道。
 * @param ctx - client root context。
 */
export function apply(ctx: ClientContext): () => void {
  // 字典注册为 effect（3 参形式面向未在 LocaleNamespaceMap 声明的命名空间；
  // 返回 disposer，随插件 fiber 对称卸载）。
  ctx.effect(() => {
    const zhDispose = ctx.locale.register(NS, 'zh', zh)
    const enDispose = ctx.locale.register(NS, 'en', en)
    return () => {
      zhDispose()
      enDispose()
    }
  }, 'provider-presets: copy dictionaries')

  let mounted = false
  const tryMount = (): boolean => {
    if (mounted) return true
    const remote = readRemoteRoot(ctx)
    if (remote === undefined || !hasRequiredFaces(remote)) return false
    mounted = true
    ctx.effect(() => mountSection(ctx, remote), 'provider-presets: footer section')
    return true
  }
  if (tryMount()) return () => {}
  const offService = ctx.on('internal/service', service => {
    const name = String(service)
    if (name === 'remote' || name.startsWith('remote.')) tryMount()
  }, { global: true } as never)
  return () => { offService() }
}

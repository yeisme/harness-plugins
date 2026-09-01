/**
 * 浏览器偏好存储 seam（G21 红灯清零，SAFEPROJ/BROWSER_STORAGE_ACCESS）。
 *
 * 仓库红线：client/bundle 插件代码不得直接访问浏览器 storage 全局
 * （观测门红灯）。本模块是浏览器 storage 访问的唯一审阅点：消费方一律经
 * `probeCapability(browserPreferenceStorage)` 三态降级消费——
 * needs_contract/unavailable 时退化为进程内状态，不伪造可用。
 *
 * 用途边界：只承载自有命名空间的偏好枚举/有界摘要持久化；禁止存 domain
 * state、凭据、token、raw prompt、provider payload 或绝对路径。
 */

/**
 * 结构化键值偏好面：`getItem`/`setItem` 的最小形状，浏览器 storage 与
 * 测试桩都结构匹配（sdk 不引 DOM lib，消费方 DOM 类型可结构互换）。
 */
export interface PreferenceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * 探测浏览器偏好存储：SSR/Node（无全局）、隐私模式拒访（访问即抛）时
 * 返回 undefined；probe 结果交由消费方按三态降级，绝不抛出。
 */
export function browserPreferenceStorage(): PreferenceStorage | undefined {
  try {
    // 无 DOM lib 环境下经结构化面读取全局；访问本身可能抛（隐私模式）。
    const scope = globalThis as { localStorage?: PreferenceStorage | null }
    return scope.localStorage ?? undefined
  } catch {
    return undefined
  }
}

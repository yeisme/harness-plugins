/**
 * 工作台持久化存储 seam（G21 1.3，SAFEPROJ/BROWSER_STORAGE_ACCESS 清零）。
 *
 * 仓库红线：client 代码不直接访问浏览器 storage 全局——获取一律经
 * `@yeisme/dsh-plugin-contracts` 的 `browserPreferenceStorage`（sdk 是
 * storage 全局访问的唯一审阅点），并按 probe 三态降级。本模块在其上
 * 叠加工作台自身的两个守卫：
 *
 * 1. 受控测试环境（jsdom）不落盘：plugin 运行时测试不读写真实存储，
 *    与既有 workspace persistence 的测试隔离语义一致；
 * 2. 持久化面要求 `removeItem`（preset/managed workspace 的删除路径）：
 *    底层 storage 缺该能力即整体降级为无持久化（fail-closed，不伪造可用）。
 */

import { browserPreferenceStorage, probeCapability } from '@yeisme/dsh-plugin-contracts'
import type { PaneWorkspaceStorageV1 } from './persistence.js'

/** 探测工作台持久化存储；不可用/受限环境一律返回 undefined（不抛错）。 */
export function probeWorkbenchStorage(): PaneWorkspaceStorageV1 | undefined {
  if (typeof document !== 'undefined' && document.defaultView !== null
    && /jsdom/i.test(document.defaultView.navigator.userAgent)) return undefined
  const probed = probeCapability(browserPreferenceStorage)
  if (probed.status !== 'available') return undefined
  const candidate = probed.capability as Partial<PaneWorkspaceStorageV1>
  if (typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function'
    || typeof candidate.removeItem !== 'function') return undefined
  return candidate as PaneWorkspaceStorageV1
}

/**
 * Host 插件装配：动态注入官方 `terminals`/`agents` → terminalPane Remote。
 *
 * 装配不变量：
 * 1. 无静态 inject 依赖——官方 terminals 能力缺席（DSH < 0.1.1-rc.2）时
 *    插件照常载入，Remote 注册并返回 typed `service_unavailable`。
 * 2. `ctx.inject(['terminals','agents'], ...)` 在两个服务都出现时（重新）
 *    装配适配器；服务注销时回调 disposer 生效，Remote 随即回到
 *    service_unavailable，不持有过期引用。
 * 3. Remote 随本插件 fiber 卸载自动注销（TypertRemoteService 语义）。
 *
 * @module @yeisme/dsh-terminal-host/plugin
 */

import type { Context } from '@deepseek-ai/cordis'
import { TerminalPaneAdapter, isAgentsService, terminalsContractGaps } from './adapter.ts'
import { TerminalPaneRemoteService } from './remote.ts'
import { TERMINAL_PANE_HOST_PLUGIN_NAME } from './wire.ts'

/** Cordis 插件名。 */
export const name = TERMINAL_PANE_HOST_PLUGIN_NAME

/** 无静态依赖：官方能力全部动态探测。 */
export const inject = [] as const

/** 动态注入的最小 Cordis 面（terminals/agents 未随 0.1.0-rc.x 发布，无类型合并可引）。 */
interface DynamicInjectContext {
  inject(names: readonly string[], callback: (child: Context) => void | (() => void)): unknown
}

/** Host 插件入口：注册 terminalPane Remote 并跟随官方服务出现/消失。 */
export function apply(ctx: Context): void {
  const remote = new TerminalPaneRemoteService(ctx, new TerminalPaneAdapter({}))
  ctx.effect(() => {
    const dispose = (ctx as unknown as DynamicInjectContext).inject(['terminals', 'agents'], child => {
      const terminals = (child as unknown as Record<string, unknown>)['terminals']
      const agents = (child as unknown as Record<string, unknown>)['agents']
      if (terminalsContractGaps(terminals).length > 0) {
        // 形状漂移：保持降级适配器，probe 报缺失方法。
        remote.replaceAdapter(new TerminalPaneAdapter({ terminals }))
        return () => { remote.replaceAdapter(new TerminalPaneAdapter({})) }
      }
      if (!isAgentsService(agents)) {
        remote.replaceAdapter(new TerminalPaneAdapter({ terminals, agents: undefined }))
        return () => { remote.replaceAdapter(new TerminalPaneAdapter({})) }
      }
      remote.replaceAdapter(new TerminalPaneAdapter({ terminals, agents }))
      return () => { remote.replaceAdapter(new TerminalPaneAdapter({})) }
    })
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  }, 'dsh-terminal-host: terminalPane remote adapter lifecycle')
}

const TerminalPaneHostPlugin = { name, inject, apply }
export default TerminalPaneHostPlugin

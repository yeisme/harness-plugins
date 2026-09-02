/**
 * @yeisme/dsh-plugin-example root entry — HOST 层参考面。
 *
 * 三层最小结构（同一包内演示，真实仓形态见各层目录）：
 * - host 层：本文件 + src/host（真实仓对应 packages/host 层）；
 * - client 层：src/client（真实仓对应 packages/client 层）；
 * - bundle 层：package.json 的 dsh 声明 + cordis.patch.yml + tsdown 单文件
 *   ModuleLoader 构建（真实仓对应 packages/bundle 层）。
 *
 * Host 侧只做 capability probe + fail-closed：演示 seam 未到岗时不注册任何
 * 东西、不伪造数据源。不接管 core state，不加运行时依赖（零 dependencies）。
 *
 * @module @yeisme/dsh-plugin-example
 */

import type { Context } from '@deepseek-ai/cordis'
import { ExampleHostService } from './host/example-service.js'
import { probeCapability } from './probe.js'

export const name = 'dsh-plugin-example'
export const inject: readonly string[] = []

/**
 * 结构面：演示用可选 host seam。真实插件请探测官方 seam（参照
 * packages/host/dsh-token-usage 对 sessionProjections 的结构化探测）；
 * seam 形状不对 = 未到岗（needs_contract），不得硬造。
 */
export interface ExampleHostSourceFace {
  onExampleEvent(listener: (payload: string) => void): () => void
}

/** 结构化获取演示 seam：ctx.get 未注册名可能抛错（→ unavailable）、缺席或形状不对 → undefined。 */
function acquireHostSource(ctx: Context): ExampleHostSourceFace | undefined {
  const raw: unknown = ctx.get('exampleHostSource')
  if (typeof raw !== 'object' || raw === null) return undefined
  const candidate = raw as Record<string, unknown>
  return typeof candidate.onExampleEvent === 'function' ? (candidate as unknown as ExampleHostSourceFace) : undefined
}

/**
 * Apply host 插件：probe 演示 seam，未到岗即 fail-closed 直接返回
 * （不注册、不伪造）；到岗则挂接有界折叠服务，订阅生命周期交给
 * ctx.effect（fiber 结束即释放，dispose 对称）。
 */
export function apply(ctx: Context): void {
  const probed = probeCapability(() => acquireHostSource(ctx))
  if (probed.status !== 'available') return
  const service = new ExampleHostService()
  ctx.effect(
    () => probed.capability.onExampleEvent(payload => service.observe(payload)),
    'dsh-plugin-example: demo source feed',
  )
}

const DshPluginExamplePlugin = { name, inject, apply }
export default DshPluginExamplePlugin

export { ExampleHostService } from './host/example-service.js'
export { probeCapability, degradeReason } from './probe.js'
export type { ProbeDegradation, ProbeResult } from './probe.js'
export type { ExampleBoundedSummary, ExampleProjectionMeta, ExampleWireSnapshot } from './wire.js'
export { applyExampleActionV1, createExampleStructuredSurfaceV1, previewExampleActionV1 } from './structured-surface.js'
export type { ExampleActionPreviewV1 } from './structured-surface.js'

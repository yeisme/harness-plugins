/**
 * DSH Command Experience bundle root（Host face）。
 *
 * 可安装的 DSH bundle。Host 面保持 no-op 生命周期：命令目录投影、
 * capability probe 与 owner action adapter 均由 client 侧（`./client`）
 * 与共享核心（@yeisme/dsh-client-ui-command-experience-core）提供，
 * 官方 seam 缺失时按 probe 降级（禁用入口 + 原因），不新增 core fork。
 *
 * @module @yeisme/dsh-command-experience
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-command-experience'
export const inject: readonly string[] = []

/** No-op Host lifecycle：本 bundle 不拥有 DSH core state。 */
export function apply(_ctx: Context): void {
  // host side intentionally empty
}

const DshCommandExperiencePlugin = { name, inject, apply }
export default DshCommandExperiencePlugin

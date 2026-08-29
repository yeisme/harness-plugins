/**
 * DSH Command Experience bundle root（Host face）。
 *
 * 可安装的 DSH bundle。Host 面挂 live slash directory 与 inspect 命令注册；
 * 命令目录投影、capability probe 与 owner action adapter 均由共享核心
 * （@yeisme/dsh-client-ui-command-experience-core）提供，官方 seam 缺失时
 * 按 probe 降级（禁用入口 + 原因），不新增 core fork。
 *
 * @module @yeisme/dsh-command-experience
 */

import type { Context } from '@deepseek-ai/cordis'
import { bindSlashRuntime, type SlashBindContext } from './slash-bind.ts'

export const name = 'dsh-command-experience'
// `commands` is a wait-for inject, not an optional seam: with an empty inject
// the loader fiber can start apply before dsh-base provides the service, and
// the fail-closed skip in slash-bind would silently drop every inspect
// registration (ordo-commands / yeisme-commands use the same contract).
export const inject: readonly string[] = ['commands']

/** Live slash directory + inspect command registration. Missing seams fail closed. */
export function apply(ctx: Context): () => void {
  // Cordis Context satisfies the structural contract; slash-bind re-validates
  // every seam it touches, so the bridge stays a plain structural cast.
  return bindSlashRuntime(ctx as unknown as SlashBindContext).dispose
}

const DshCommandExperiencePlugin = { name, inject, apply }
export default DshCommandExperiencePlugin

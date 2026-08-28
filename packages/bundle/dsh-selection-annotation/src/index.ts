/**
 * @yeisme/dsh-selection-annotation root entry.
 *
 * 可安装的 DSH Web bundle。Host 面保持 no-op：会话运行时、文件写入与
 * 截图字节始终由各自 owner 拥有；浏览器侧选区工具条与紧凑 Composer
 * overlay 在 `./client` 入口注册。
 *
 * @module @yeisme/dsh-selection-annotation
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-selection-annotation'
export const inject: readonly string[] = []

/** No-op Host lifecycle：本 change 不新增 DSH core fork，也不复制 Host 私有实现。 */
export function apply(_ctx: Context): void {
  // host side intentionally empty
}

const DshSelectionAnnotationPlugin = { name, inject, apply }

export default DshSelectionAnnotationPlugin

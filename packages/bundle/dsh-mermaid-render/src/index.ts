/**
 * @yeisme/dsh-mermaid-render root entry.
 *
 * 可安装的 DSH Web bundle。Host 面保持 no-op：会话日志、markdown 投影与
 * 会话渲染器的钉死 DOM 始终由 DSH Host 拥有；浏览器侧 mermaid 嫁接在
 * `./client` 入口注册。
 *
 * @module @yeisme/dsh-mermaid-render
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-mermaid-render'
export const inject: readonly string[] = []

/** No-op Host lifecycle：本 change 不新增 DSH core fork，也不复制 Host 私有实现。 */
export function apply(_ctx: Context): void {
  // host side intentionally empty
}

const DshMermaidRenderPlugin = { name, inject, apply }

export default DshMermaidRenderPlugin

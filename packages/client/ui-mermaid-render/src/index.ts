/**
 * @yeisme/dsh-client-ui-mermaid-render node/host-side entry.
 *
 * 浏览器逻辑全部在 `./client` 入口；node 侧保持 no-op，使纯 host profile
 * 组合本包时不产生任何客户端副作用。
 *
 * @module @yeisme/dsh-client-ui-mermaid-render
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'client-ui-mermaid-render'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face
}

const ClientUiMermaidRenderPlugin = { name, inject, apply }

export default ClientUiMermaidRenderPlugin

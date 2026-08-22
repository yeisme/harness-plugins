/**
 * @yeisme/dsh-client-ui-conversation-rewrite node/host-side entry.
 *
 * 该 package 的浏览器逻辑全部在 `./client` 入口；node 侧保持 no-op，
 * 使纯 host profile 组合本包时不产生任何客户端副作用。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite
 */

import type { Context } from '@deepseek-ai/cordis'

export { lineageLabel, sessionLineageLabel } from './client/lineage.ts'
export type { RewriteLineageLabel, RewriteLineageSource, SessionLineageRow } from './client/lineage.ts'

export const name = 'client-ui-conversation-rewrite'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face
}

const ClientUiConversationRewritePlugin = { name, inject, apply }

export default ClientUiConversationRewritePlugin

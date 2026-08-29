/**
 * pane-domain bundle 的 Host 面：为已注入 typed transport 的 owner 挂载正式
 * `domain.<owner>` owner source。
 *
 * 挂载规则（与 ordo-agent-ops 的 owner source 注入模式一致）：
 * - owner adapter（真实 Sonora/Pinax/Ordo BFF 或仓库内 fixture）在 Host context
 *   上以 `domainOwnerTransport.<owner>` 提供一个 DomainOwnerEventTransport。
 * - 本插件在 apply 时把存在的 transport 逐一挂载为 `domain.<owner>` 服务；
 *   未提供 transport 的 owner 不挂载任何服务——客户端对缺失 owner source 的
 *   回退是诚实的 offline，绝不伪造空 ready 投影。
 * - 卸载顺序与挂载相反；dispose 后服务从 context 移除。
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  DOMAIN_OWNERS,
  mountDomainOwnerSource,
  type DomainOwnerEventTransport,
} from '@yeisme/dsh-client-ui-pane-domain/host'

/** owner adapter 注入 typed transport 的稳定 Host key。 */
export function paneDomainOwnerTransportKey(owner: (typeof DOMAIN_OWNERS)[number]): string {
  return `domainOwnerTransport.${owner}`
}

export const name = 'pane-domain'
export const inject: string[] = []

export function apply(ctx: Context): () => void {
  const disposers: Array<() => void> = []
  for (const owner of DOMAIN_OWNERS) {
    const transport = ctx.get(paneDomainOwnerTransportKey(owner)) as DomainOwnerEventTransport | undefined
    if (transport === undefined || typeof transport.read !== 'function' || typeof transport.subscribe !== 'function') continue
    disposers.push(mountDomainOwnerSource(ctx, owner, transport))
  }
  return () => {
    for (const dispose of [...disposers].reverse()) dispose()
  }
}

export default { name, inject, apply }

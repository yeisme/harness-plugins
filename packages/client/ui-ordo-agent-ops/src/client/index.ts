/** Compact DSH Agent Ops panel over the Host-owned Ordo read-only Remote. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { OrdoAgentOpsController } from './controller.ts'
import { OrdoAgentOpsPanel } from './OrdoAgentOpsPanel.tsx'
import type { OrdoAgentOpsPanelFace } from './slots.ts'
import { en, NS, zh, type OrdoAgentOpsKey } from './locales.ts'

export type { OrdoAgentOpsPanelProps } from './OrdoAgentOpsPanel.tsx'
export type { OrdoAgentOpsPanelFace } from './slots.ts'
export type { OrdoAgentOpsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Compact Agent Ops panel copy. */
    ordoAgentOps: OrdoAgentOpsKey
  }
}

/** Services required by the sidebar contribution and typed Remote. */
export const inject = ['slots', 'remote', 'remote.ordoAgentOps', 'locale']

/** Mount the lifecycle-owned Agent Ops controller and compact sidebar action. */
export function apply(ctx: ClientContext): void {
  const controller = new OrdoAgentOpsController(ctx.remote.ordoAgentOps)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-ordo-agent-ops: dictionaries')
  ctx.effect(() => () => { controller.dispose() }, 'ui-ordo-agent-ops: controller lifecycle')
  ctx.on('connection/reset', () => {
    controller.reset()
    void controller.refresh()
  })

  const injected = (): OrdoAgentOpsPanelFace => ({
    hooks: { state: controller.store },
    refresh: () => controller.refresh(),
  })

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'ordo-agent-ops',
    locale: NS,
    inject: injected,
  }, OrdoAgentOpsPanel))
}

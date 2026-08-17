import type { Context } from '@deepseek-ai/cordis'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createElement } from 'react'
import { PaneWorkbenchChrome } from './chrome.js'
import { PaneViewRegistry } from './view-registry.js'

export { PaneWorkbenchChrome } from './chrome.js'
export { PaneViewRegistry, PaneViewRegistrationError, markOrphanedPaneViews, parsePaneViewRegistration, parseSafePaneProjection } from './view-registry.js'
export type { PaneLocalViewFactory, PaneLocalViewProps, PaneViewRegistrationV1, PaneViewRegistryEnvironment } from './view-registry.js'

export interface PaneWorkbenchClientFace {
  registerView(input: unknown): () => void
  readonly views: PaneViewRegistry
}

export const inject = ['slots']

/** Mounts only the official additive overlay slot; it never reads or patches the DSH shell DOM. */
export function apply(ctx: ClientContext): () => void {
  const registry = new PaneViewRegistry({ capabilities: new Set(['pane.workbench.v1']) })
  const face: PaneWorkbenchClientFace = { registerView: input => registry.registerView(input), views: registry }
  ctx.provide('paneWorkbench', face)
  return ctx.slots.inject('shell.overlay' as never, () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'yeisme-pane-workbench',
    inject: () => face,
  } as never, () => createElement(PaneWorkbenchChrome, { registry })))
}

export const PaneWorkbenchClientPlugin = { inject, apply: (ctx: Context): (() => void) => apply(ctx as ClientContext) }
export default PaneWorkbenchClientPlugin

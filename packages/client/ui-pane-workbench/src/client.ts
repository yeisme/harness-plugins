import type { Context } from '@deepseek-ai/cordis'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createElement, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { PaneWorkbenchChrome } from './chrome.js'
import { PaneWorkbenchController } from './controller.js'
import {
  closePaneWorkbenchCoreView,
  DSH_TOOL_DETAILS_VIEW_KIND,
  isPaneCoreViewId,
  openPaneWorkbenchCoreView,
  PANE_CORE_HOST_CONTRACT,
  registerPaneWorkbenchCoreViews,
  type PaneCoreViewId,
} from './core-pane.js'
import { PaneCommandRegistry, PaneIntentDispatcher, type PaneIntentHandlerRegistrationV1 } from './composition.js'
import { PaneWorkspacePersistenceAdapter } from './persistence.js'
import { PaneRegionChrome, type PaneRegionChromeProps } from './region-chrome.js'
import { PanePluginRegistry, PaneRegistrationError, type PaneRuntimePluginV1 } from './registry.js'
import { PaneViewRegistry } from './view-registry.js'
import type { PaneViewSpecV1 } from './workspace.js'
import type { PaneEventEnvelopeV1 } from '@yeisme/dsh-pane-protocol'

export { PaneWorkbenchChrome } from './chrome.js'
export { PaneRegionChrome } from './region-chrome.js'
export {
  getWorkbenchFontSize,
  setWorkbenchFontSize,
  stepWorkbenchFontSize,
  WORKBENCH_FONT_SIZE_DEFAULT,
  WORKBENCH_FONT_SIZE_MAX,
  WORKBENCH_FONT_SIZE_MIN,
} from './font-scale.js'
export { PaneWorkbenchController } from './controller.js'
export {
  closePaneWorkbenchCoreView,
  DSH_TOOL_DETAILS_RESOURCE_KEY,
  DSH_TOOL_DETAILS_VIEW_KIND,
  DSH_WORKSPACE_DESIGNER_RESOURCE_KEY,
  DSH_WORKSPACE_DESIGNER_VIEW_KIND,
  isPaneCoreViewId,
  openPaneWorkbenchCoreView,
  PANE_CORE_HOST_CONTRACT,
  registerPaneWorkbenchCoreViews,
} from './core-pane.js'
export type { PaneCoreViewId } from './core-pane.js'
export {
  PANE_WORKSPACE_CLOSE_VIEW_INTENT,
  PANE_WORKSPACE_DRAFT_INTENT,
  PANE_WORKSPACE_OPEN_VIEW_INTENT,
} from './workspace.js'
export type { PaneWorkspaceIntentV1, PaneWorkspaceIntentV1Additive } from './workspace.js'
export {
  FILE_TREE_PROJECTION_CAPABILITY,
  GIT_BRANCH_ACTIONS_CAPABILITY,
  GIT_DIFF_WINDOW_CAPABILITY,
  GIT_REMOTE_ACTIONS_CAPABILITY,
  GIT_STATUS_PROJECTION_CAPABILITY_V2,
  GIT_WORKTREE_ACTIONS_CAPABILITY_V2,
  PANE_FILE_GIT_V2_CAPABILITIES,
  PANE_WORKSPACE_INTERACTION_V4_LEDGER,
  PANE_WORKSPACE_INTERACTION_V4_OWNER_FIT,
  PANE_WORKSPACE_REDUCER_OWNER,
} from './capability-ledger.js'
export { PaneViewRegistry, PaneViewRegistrationError, markOrphanedPaneViews, parsePaneViewRegistration, parseSafePaneProjection } from './view-registry.js'
export type {
  PaneLocalViewFactory,
  PaneLocalViewProps,
  PaneViewI18nRegistrationV1,
  PaneViewRegistrationV1,
  PaneViewRegistryEnvironment,
} from './view-registry.js'

export interface PaneWorkbenchClientFace {
  registerView(input: unknown): () => void
  registerPlugin(input: PaneRuntimePluginV1): () => void
  registerCommand(input: unknown): () => void
  executeCommand(id: string): Promise<unknown>
  registerIntentHandler(input: PaneIntentHandlerRegistrationV1): () => void
  dispatchIntent(input: unknown): Promise<import('@yeisme/dsh-pane-protocol').PaneActionReceiptV1>
  applyPluginEvent(pluginId: string, generation: number, event: PaneEventEnvelopeV1 | unknown): import('@yeisme/dsh-pane-protocol').PaneProjectionStateV1 | undefined
  openView(request: PaneViewSpecV1): void
  readonly views: PaneViewRegistry
  readonly plugins: PanePluginRegistry
  readonly commands: PaneCommandRegistry
  readonly intents: PaneIntentDispatcher
  readonly controller: PaneWorkbenchController
}

export interface PaneWorkbenchLauncherProps {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
}

/** @deprecated One-RC story component; production apply uses the two workspace slots. */
export function PaneWorkbenchLauncher({ registry, controller }: PaneWorkbenchLauncherProps): ReactNode {
  const visible = useSyncExternalStore(
    listener => controller.subscribe(listener),
    () => controller.isVisible,
    () => controller.isVisible,
  )
  const [hasActivated, setHasActivated] = useState(() => controller.isVisible)
  useEffect(() => {
    if (visible) setHasActivated(true)
  }, [visible])
  if (!hasActivated) {
    return createElement('aside', {
      'aria-label': 'Pane Workbench',
      'data-pane-workbench-visible': 'false',
      style: { pointerEvents: 'none' },
    },
      createElement('button', {
        type: 'button',
        'aria-expanded': false,
        style: { pointerEvents: 'auto' },
        onClick: () => controller.show(),
      }, 'Show Pane Workbench'),
    )
  }
  // Once activated the chrome stays mounted; it collapses to its own Show
  // button when the controller hides, preserving layout state across hides.
  return createElement(PaneWorkbenchChrome, { registry, controller })
}

export const inject = ['slots', 'workspaceLayout', 'sessions']

interface WorkspaceLayoutServiceLike {
  readonly corePaneVersion?: string
  attach(ownerId: string, preference: {
    rightVisible: boolean
    bottomVisible: boolean
    rightWidth: number
    bottomRatio: number
    activeRegion: 'right' | 'bottom'
  }, corePaneHost?: {
    open(id: PaneCoreViewId): void
    close(id: PaneCoreViewId): void
  }): import('./controller.js').PaneWorkspaceLayoutHandle
}

interface SlotRegistryLike {
  spec(name: string): unknown
  inject(name: string, setup: () => () => void): () => void
  register(input: unknown, component: (props: never) => ReactNode): () => void
}

const REQUIRED_LAYOUT_VERSION = '0.1.1-rc.3'

function browserStorage(): Storage | undefined {
  if (typeof document === 'undefined' || document.defaultView === null) return undefined
  if (/jsdom/i.test(document.defaultView.navigator.userAgent)) return undefined
  try {
    return document.defaultView.localStorage
  } catch {
    return undefined
  }
}

/** Mounts the two official workspace slots and never registers a production overlay. */
export function apply(ctx: ClientContext): () => void {
  const slots = ctx.get('slots') as unknown as SlotRegistryLike | undefined
  const workspaceLayout = ctx.get('workspaceLayout' as never) as unknown as WorkspaceLayoutServiceLike | undefined
  if (slots === undefined || workspaceLayout === undefined
    || workspaceLayout.corePaneVersion !== PANE_CORE_HOST_CONTRACT
    || slots.spec('shell.workspace.right') === undefined
    || slots.spec('shell.workspace.bottom') === undefined) {
    throw new Error(`Pane Workbench requires @deepseek-ai/dsh-client-ui-layout >= ${REQUIRED_LAYOUT_VERSION} with ${PANE_CORE_HOST_CONTRACT}, shell.workspace.right, shell.workspace.bottom, and ctx.workspaceLayout; legacy Details and overlay fallbacks are disabled.`)
  }
  const registry = new PaneViewRegistry({ capabilities: new Set(['pane.workbench.v1']) })
  const disposeCoreViews = registerPaneWorkbenchCoreViews(registry)
  const plugins = new PanePluginRegistry({
    generation: 1,
    dshApiVersion: REQUIRED_LAYOUT_VERSION,
    capabilities: new Set(['pane.workbench.v1', 'pane.event.v1', 'pane.intent.v1', 'pane.action.v1']),
    permissions: new Set(),
  })
  const commands = new PaneCommandRegistry()
  const intents = new PaneIntentDispatcher()
  const storage = browserStorage()
  const persistence = storage === undefined ? undefined : new PaneWorkspacePersistenceAdapter(storage)
  const controller = new PaneWorkbenchController({ registry, persistence })
  closePaneWorkbenchCoreView(controller, DSH_TOOL_DETAILS_VIEW_KIND)
  const initial = controller.getSnapshot()
  const lifecycle: Array<() => void> = [disposeCoreViews, () => controller.dispose()]
  let disposed = false
  const disposeLifecycle = (): void => {
    if (disposed) return
    disposed = true
    for (const dispose of lifecycle.reverse()) {
      try { dispose() } catch { /* teardown continues across independent owners */ }
    }
  }
  const registerPlugin = (input: PaneRuntimePluginV1): (() => void) => {
    const disposers: Array<() => void> = []
    const disposePlugin = plugins.register(input)
    try {
      for (const descriptor of input.definition.views) {
        const component = input.viewFactories[descriptor.componentKey]
        if (component === undefined) throw new PaneRegistrationError('contract_mismatch', `pane plugin ${input.definition.id} has no local factory for ${descriptor.componentKey}`)
        disposers.push(registry.registerView({ descriptor, component }))
      }
      for (const descriptor of input.definition.commands) {
        const execute = input.commandHandlers?.[descriptor.id]
        if (execute === undefined) throw new PaneRegistrationError('contract_mismatch', `pane plugin ${input.definition.id} has no local command handler for ${descriptor.id}`)
        disposers.push(commands.register({ descriptor, execute }))
      }
      for (const handler of input.intentHandlers ?? []) disposers.push(intents.register(handler))
    } catch (error) {
      for (const dispose of disposers.reverse()) dispose()
      disposePlugin()
      throw error
    }
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      for (const dispose of disposers.reverse()) dispose()
      disposePlugin()
    }
  }
  const face: PaneWorkbenchClientFace = {
    registerView: input => registry.registerView(input),
    registerPlugin,
    registerCommand: input => commands.register(input),
    executeCommand: id => commands.execute(id),
    registerIntentHandler: input => intents.register(input),
    dispatchIntent: input => intents.dispatch(input),
    applyPluginEvent: (pluginId, generation, event) => plugins.applyEvent(pluginId, generation, event),
    openView: request => controller.openView(request),
    views: registry,
    plugins,
    commands,
    intents,
    controller,
  }

  try {
    const layoutHandle = workspaceLayout.attach('yeisme-pane-workbench', {
      rightVisible: initial.regions.right.visible,
      bottomVisible: initial.regions.bottom.visible,
      rightWidth: Math.round(initial.regions.right.size * 1_500),
      bottomRatio: initial.regions.bottom.size,
      activeRegion: initial.activeRegion,
    }, {
      open: id => openPaneWorkbenchCoreView(controller, id),
      close: id => closePaneWorkbenchCoreView(controller, id),
    })
    lifecycle.push(() => layoutHandle.dispose())
    lifecycle.push(controller.bindWorkspaceLayout(layoutHandle))
    ctx.provide('paneWorkbench', face)
    const renderRegion = (region: 'right' | 'bottom') => (owner: Omit<PaneRegionChromeProps, 'region' | 'registry' | 'controller'>): ReactNode => createElement(PaneRegionChrome, {
      ...owner,
      region,
      registry,
      controller,
    })
    lifecycle.push(slots.inject('shell.workspace.right', () => slots.register({
      name: 'shell.workspace.right',
      id: 'yeisme-pane-workbench-right',
      inject: () => face,
    }, renderRegion('right') as never)))
    lifecycle.push(slots.inject('shell.workspace.bottom', () => slots.register({
      name: 'shell.workspace.bottom',
      id: 'yeisme-pane-workbench-bottom',
      inject: () => face,
    }, renderRegion('bottom') as never)))

    const sessions = ctx.get('sessions' as never) as unknown as {
      list?: { getSnapshot(): { current?: string }; subscribe(listener: () => void): () => void }
    } | undefined
    const sessionList = sessions?.list
    const syncSession = (): void => {
      controller.switchSession(sessionList?.getSnapshot().current)
      closePaneWorkbenchCoreView(controller, DSH_TOOL_DETAILS_VIEW_KIND)
    }
    syncSession()
    lifecycle.push(sessionList?.subscribe(syncSession) ?? (() => {}))
    return disposeLifecycle
  } catch (error) {
    disposeLifecycle()
    throw error
  }
}

export const PaneWorkbenchClientPlugin = { inject, apply: (ctx: Context): (() => void) => apply(ctx as ClientContext) }
export default PaneWorkbenchClientPlugin

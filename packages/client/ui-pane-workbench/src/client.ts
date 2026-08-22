import type { Context } from '@deepseek-ai/cordis'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createElement, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { PaneWorkbenchChrome } from './chrome.js'
import { PaneWorkbenchController } from './controller.js'
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
export { PaneViewRegistry, PaneViewRegistrationError, markOrphanedPaneViews, parsePaneViewRegistration, parseSafePaneProjection } from './view-registry.js'
export type { PaneLocalViewFactory, PaneLocalViewProps, PaneViewRegistrationV1, PaneViewRegistryEnvironment } from './view-registry.js'

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
  attach(ownerId: string, preference: {
    rightVisible: boolean
    bottomVisible: boolean
    rightWidth: number
    bottomRatio: number
    activeRegion: 'right' | 'bottom'
  }): import('./controller.js').PaneWorkspaceLayoutHandle
}

interface SlotRegistryLike {
  spec(name: string): unknown
  inject(name: string, setup: () => () => void): () => void
  register(input: unknown, component: (props: never) => ReactNode): () => void
}

const REQUIRED_LAYOUT_VERSION = '0.1.0-rc.9'

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
    || slots.spec('shell.workspace.right') === undefined
    || slots.spec('shell.workspace.bottom') === undefined) {
    throw new Error(`Pane Workbench requires @deepseek-ai/dsh-client-ui-layout >= ${REQUIRED_LAYOUT_VERSION} with shell.workspace.right, shell.workspace.bottom, and ctx.workspaceLayout; overlay fallback is disabled.`)
  }
  const registry = new PaneViewRegistry({ capabilities: new Set(['pane.workbench.v1']) })
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
  const initial = controller.getSnapshot()
  const layoutHandle = workspaceLayout.attach('yeisme-pane-workbench', {
    rightVisible: initial.regions.right.visible,
    bottomVisible: initial.regions.bottom.visible,
    rightWidth: Math.round(initial.regions.right.size * 1_500),
    bottomRatio: initial.regions.bottom.size,
    activeRegion: initial.activeRegion,
  })
  const unbindLayout = controller.bindWorkspaceLayout(layoutHandle)
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
  ctx.provide('paneWorkbench', face)
  const renderRegion = (region: 'right' | 'bottom') => (owner: Omit<PaneRegionChromeProps, 'region' | 'registry' | 'controller'>): ReactNode => createElement(PaneRegionChrome, {
    ...owner,
    region,
    registry,
    controller,
  })
  const disposeRight = slots.inject('shell.workspace.right', () => slots.register({
    name: 'shell.workspace.right',
    id: 'yeisme-pane-workbench-right',
    inject: () => face,
  }, renderRegion('right') as never))
  const disposeBottom = slots.inject('shell.workspace.bottom', () => slots.register({
    name: 'shell.workspace.bottom',
    id: 'yeisme-pane-workbench-bottom',
    inject: () => face,
  }, renderRegion('bottom') as never))

  const sessions = ctx.get('sessions' as never) as unknown as {
    list?: { getSnapshot(): { current?: string }; subscribe(listener: () => void): () => void }
  } | undefined
  const sessionList = sessions?.list
  const syncSession = (): void => controller.switchSession(sessionList?.getSnapshot().current)
  syncSession()
  const disposeSessions = sessionList?.subscribe(syncSession) ?? (() => {})

  return () => {
    disposeSessions()
    disposeBottom()
    disposeRight()
    unbindLayout()
    layoutHandle.dispose()
    controller.dispose()
  }
}

export const PaneWorkbenchClientPlugin = { inject, apply: (ctx: Context): (() => void) => apply(ctx as ClientContext) }
export default PaneWorkbenchClientPlugin

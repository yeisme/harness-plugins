import type { Context } from '@deepseek-ai/cordis'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createElement, type ReactNode } from 'react'
import { dispatchArtifactHandoff, probeArtifactHandoffChannel, ARTIFACT_INTENT_VOCABULARY } from './artifacts.js'
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
import { registerWorkspaceCapabilitiesCommand, registerWorkspaceCapabilitiesView } from './capabilities-view.js'
import {
  createExperienceTierTracker,
  probeWorkspaceSeams,
  type ExperienceTierTrackerV1,
} from './experience-tier.js'
import { COMMAND_SURFACE_CONTEXT_KEY } from './capability-ledger.js'
import { PaneWorkspacePersistenceAdapter } from './persistence.js'
import {
  PANE_CONVERSATION_SEARCH_CONTEXT_KEY,
  PANE_MANAGEMENT_KEYMAP_CONTEXT_KEY,
  PANE_RENDITION_RENDERER_CONTEXT_KEY,
  PANE_WORKSPACE_CONTEXT_KEY,
  PaneManagementPersistenceAdapter,
  type PaneConversationSearchHostV1,
  type PaneManagementKeymapV1,
  type PaneSafeRenditionRendererV1,
  type PaneWorkspaceContextProviderV1,
} from './management.js'
import { paneViewArtifactSource, PaneRegionChrome, type PaneArtifactHandoffContextV1, type PaneRegionChromeProps } from './region-chrome.js'
import { OfficialOverlayPaneHost } from './official-host.js'
import { PanePluginRegistry, PaneRegistrationError, type PaneRuntimePluginV1 } from './registry.js'
import { PaneViewRegistry } from './view-registry.js'
import { PANE_WORKBENCH_LOCALE_RESOURCES, setActiveLocale } from './i18n/locale.js'
import type { PaneViewSpecV1 } from './workspace.js'
import type { PaneEventEnvelopeV1 } from '@yeisme/dsh-pane-protocol'

export { PaneRegionChrome } from './region-chrome.js'
export { PaneManagementCenter } from './management-center.js'
export * from './management.js'
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
export {
  CAPABILITY_MATRIX_EVIDENCE_KINDS,
  CAPABILITY_MATRIX_EVIDENCE_SCHEMA,
  createExperienceTierTracker,
  geometryDisabledReasonKey,
  probeWorkspaceSeams,
  projectCapabilityMatrix,
  recordCapabilityMatrixEvidence,
  resolveExperienceTier,
  WORKSPACE_CAPABILITY_MATRIX_SCHEMA,
  WORKSPACE_SEAM_IDS,
  WORKSPACE_SEAM_UNLOCK_ANCHORS,
} from './experience-tier.js'
export type {
  CapabilityMatrixEvidenceRecordV1,
  ExperienceTierTrackerV1,
  WorkspaceCapabilityMatrixV1,
  WorkspaceCapabilityRowV1,
  WorkspaceDisabledReasonKey,
  WorkspaceExperienceTierV1,
  WorkspaceProbeStateV1,
  WorkspaceSeamIdV1,
  WorkspaceSeamProbeSetV1,
} from './experience-tier.js'
export {
  openWorkspaceCapabilitiesView,
  registerWorkspaceCapabilitiesCommand,
  registerWorkspaceCapabilitiesView,
  WORKSPACE_CAPABILITIES_COMMAND_ID,
  WORKSPACE_CAPABILITIES_RESOURCE_KEY,
  WORKSPACE_CAPABILITIES_VIEW_KIND,
} from './capabilities-view.js'

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
  /** Session-scoped Experience Tier projection. Re-judged on seam hot-plug; never persisted. */
  readonly experienceTier: ExperienceTierTrackerV1
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

export interface PaneWorkbenchHostProbeV1 {
  readonly available: boolean
  readonly reason: string
  readonly missing: readonly string[]
}

function readContextService<T>(ctx: Pick<ClientContext, 'get'>, name: string): T | undefined {
  try {
    return ctx.get(name as never) as T | undefined
  } catch {
    return undefined
  }
}

interface PaneLocaleRuntimeLike {
  register?: (namespace: string, dictionaries: Readonly<Record<'zh' | 'en', Readonly<Record<string, string>>>>) => () => void
  getLocale?: () => { readonly active?: string }
  getSnapshot?: () => { readonly active?: string }
  subscribe?: (listener: () => void) => () => void
}

/** Optional bridge to DSH LocaleRuntime. Older/minimal hosts keep the local English fallback. */
function bindPaneWorkbenchLocale(ctx: Pick<ClientContext, 'get'>): () => void {
  const locale = readContextService<PaneLocaleRuntimeLike>(ctx, 'locale')
  if (locale === undefined) return () => {}
  const disposers: Array<() => void> = []
  const sync = (): void => {
    const active = locale.getLocale?.().active ?? locale.getSnapshot?.().active
    if (typeof active === 'string') setActiveLocale(active)
  }
  try {
    if (typeof locale.register === 'function') {
      disposers.push(locale.register(PANE_WORKBENCH_LOCALE_RESOURCES.namespace, {
        zh: PANE_WORKBENCH_LOCALE_RESOURCES.resources.zh.resources,
        en: PANE_WORKBENCH_LOCALE_RESOURCES.resources.en.resources,
      }))
    }
    sync()
    if (typeof locale.subscribe === 'function') disposers.push(locale.subscribe(sync))
  } catch {
    for (const dispose of disposers.reverse()) dispose()
    return () => {}
  }
  return () => { for (const dispose of disposers.reverse()) dispose() }
}

export function paneWorkbenchHostUnavailableReason(missing: readonly string[]): string {
  return `Pane Workbench V2 host requires @deepseek-ai/dsh-client-ui-layout >= ${REQUIRED_LAYOUT_VERSION} with ${PANE_CORE_HOST_CONTRACT}, shell.workspace.right, shell.workspace.bottom, and ctx.workspaceLayout.`
    + (missing.length === 0 ? '' : ` Missing: ${missing.join(', ')}.`)
    + ' The official shell.overlay compatibility host will be used when Core Pane seams are unavailable.'
}

/** Capability probe for the V2 workspace host. Missing seams stay fail-closed for that path; apply() must not throw. */
export function probePaneWorkbenchHost(ctx: Pick<ClientContext, 'get'>): PaneWorkbenchHostProbeV1 {
  try {
    const missing: string[] = []
    const slots = readContextService<SlotRegistryLike>(ctx, 'slots')
    const workspaceLayout = readContextService<WorkspaceLayoutServiceLike>(ctx, 'workspaceLayout')
    if (slots === undefined) missing.push('slots')
    if (workspaceLayout === undefined) missing.push('workspaceLayout')
    if (workspaceLayout !== undefined && workspaceLayout.corePaneVersion !== PANE_CORE_HOST_CONTRACT) {
      missing.push(PANE_CORE_HOST_CONTRACT)
    }
    if (slots !== undefined) {
      let right: unknown
      let bottom: unknown
      try { right = slots.spec('shell.workspace.right') } catch { right = undefined }
      try { bottom = slots.spec('shell.workspace.bottom') } catch { bottom = undefined }
      if (right === undefined) missing.push('shell.workspace.right')
      if (bottom === undefined) missing.push('shell.workspace.bottom')
    }
    if (missing.length > 0) {
      return {
        available: false,
        reason: paneWorkbenchHostUnavailableReason(missing),
        missing,
      }
    }
    return { available: true, reason: 'workspace.core-pane.v1 host is available', missing: [] }
  } catch {
    return {
      available: false,
      reason: paneWorkbenchHostUnavailableReason(['host']),
      missing: ['host'],
    }
  }
}

function browserStorage(): Storage | undefined {
  if (typeof document === 'undefined' || document.defaultView === null) return undefined
  if (/jsdom/i.test(document.defaultView.navigator.userAgent)) return undefined
  try {
    return document.defaultView.localStorage
  } catch {
    return undefined
  }
}

interface PaneWorkbenchRuntime {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly face: PaneWorkbenchClientFace
  readonly handoff: PaneArtifactHandoffContextV1
  readonly conversationSearch?: PaneConversationSearchHostV1
  readonly keymap?: Partial<PaneManagementKeymapV1>
  readonly workspaceContext?: PaneWorkspaceContextProviderV1
  readonly lifecycle: Array<() => void>
  readonly disposeLifecycle: () => void
}

function createPaneWorkbenchRuntime(tier: ExperienceTierTrackerV1, ctx: Pick<ClientContext, 'get'>): PaneWorkbenchRuntime {
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
  const managementPersistence = storage === undefined ? undefined : new PaneManagementPersistenceAdapter(storage)
  const renditionRenderer = readContextService<PaneSafeRenditionRendererV1>(ctx, PANE_RENDITION_RENDERER_CONTEXT_KEY)
  const controller = new PaneWorkbenchController({ registry, persistence, managementPersistence, experienceTier: tier, renditionRenderer })
  const conversationSearch = readContextService<PaneConversationSearchHostV1>(ctx, PANE_CONVERSATION_SEARCH_CONTEXT_KEY)
  const keymap = readContextService<Partial<PaneManagementKeymapV1>>(ctx, PANE_MANAGEMENT_KEYMAP_CONTEXT_KEY)
  const workspaceContext = readContextService<PaneWorkspaceContextProviderV1>(ctx, PANE_WORKSPACE_CONTEXT_KEY)
  closePaneWorkbenchCoreView(controller, DSH_TOOL_DETAILS_VIEW_KIND)
  const disposeCapabilitiesView = registerWorkspaceCapabilitiesView(registry, tier)
  const disposeCapabilitiesCommand = registerWorkspaceCapabilitiesCommand(commands, controller)
  const lifecycle: Array<() => void> = [
    disposeCoreViews,
    disposeCapabilitiesView,
    disposeCapabilitiesCommand,
    bindPaneWorkbenchLocale(ctx),
    () => controller.dispose(),
    () => tier.dispose(),
  ]
  if (workspaceContext !== undefined) {
    const syncScope = (): void => {
      const context = workspaceContext.getSnapshot()
      controller.setManagementContext(context.workspaceRef, context.sessionRef)
    }
    syncScope()
    lifecycle.push(workspaceContext.subscribe?.(syncScope) ?? (() => {}))
  }
  let disposed = false
  const disposeLifecycle = (): void => {
    if (disposed) return
    disposed = true
    for (const dispose of lifecycle.reverse()) {
      try { dispose() } catch { /* teardown continues across independent owners */ }
    }
  }
  // Session artifact handoff wiring: the official seam is probed once per
  // session; menu and drag intents route through dispatchArtifactHandoff with
  // the local intent dispatcher as the contract-path fallback.
  const handoffProbe = probeArtifactHandoffChannel(ctx)
  const handoffTargets = new Map<string, readonly { readonly owner: string; readonly label: string; readonly intents: readonly string[] }[]>()
  const handoff: PaneArtifactHandoffContextV1 = {
    channel: handoffProbe.channel,
    listTargets: () => [...handoffTargets.values()].flat() as never,
    getContext: () => ({ workspaceRef: 'workspace:local', revision: String(controller.getSnapshot().generation) }),
    sourceFor: paneViewArtifactSource,
    hasAdmission: key => intents.hasAdmission(key),
    onDispatch: intent => { void dispatchArtifactHandoff(intent, { probe: handoffProbe, local: intents }) },
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
      for (const handler of input.intentHandlers ?? []) disposers.push(face.registerIntentHandler(handler))
    } catch (error) {
      for (const dispose of disposers.reverse()) dispose()
      disposePlugin()
      throw error
    }
    let pluginDisposed = false
    return () => {
      if (pluginDisposed) return
      pluginDisposed = true
      for (const dispose of disposers.reverse()) dispose()
      disposePlugin()
    }
  }
  const face: PaneWorkbenchClientFace = {
    registerView: input => registry.registerView(input),
    registerPlugin,
    registerCommand: input => commands.register(input),
    executeCommand: id => commands.execute(id),
    registerIntentHandler: input => {
      const dispose = intents.register(input)
      handoffTargets.set(input.id, (input.targetOwners ?? []).map(owner => ({
        owner,
        label: owner,
        intents: input.intents ?? [...ARTIFACT_INTENT_VOCABULARY],
      })))
      return () => {
        handoffTargets.delete(input.id)
        dispose()
      }
    },
    dispatchIntent: input => intents.dispatch(input),
    applyPluginEvent: (pluginId, generation, event) => plugins.applyEvent(pluginId, generation, event),
    openView: request => controller.openView(request),
    views: registry,
    plugins,
    commands,
    intents,
    controller,
    experienceTier: tier,
  }
  return { registry, controller, face, handoff, conversationSearch, keymap, workspaceContext, lifecycle, disposeLifecycle }
}

function bindSessionSync(ctx: ClientContext, controller: PaneWorkbenchController, lifecycle: Array<() => void>): void {
  const sessions = readContextService<{
    list?: { getSnapshot(): { current?: string }; subscribe(listener: () => void): () => void }
  }>(ctx, 'sessions')
  const sessionList = sessions?.list
  const syncSession = (): void => {
    controller.switchSession(sessionList?.getSnapshot().current)
    closePaneWorkbenchCoreView(controller, DSH_TOOL_DETAILS_VIEW_KIND)
  }
  syncSession()
  lifecycle.push(sessionList?.subscribe(syncSession) ?? (() => {}))
}

/** Seam hot-plug invalidation: re-judge the tier when the command surface announces a change. */
function bindExperienceTierHotplug(ctx: ClientContext, tier: ExperienceTierTrackerV1, lifecycle: Array<() => void>): void {
  const commands = readContextService<{ subscribe?: (listener: () => void) => () => void }>(ctx, COMMAND_SURFACE_CONTEXT_KEY)
  const unsubscribe = typeof commands?.subscribe === 'function' ? commands.subscribe(() => tier.invalidate()) : undefined
  lifecycle.push(unsubscribe ?? (() => {}))
}

/** Attaches the Core Pane chrome (layout owner + both workspace slots) for an existing runtime. Unwinds itself on failure. */
function attachCoreChrome(
  runtime: PaneWorkbenchRuntime,
  slots: SlotRegistryLike,
  workspaceLayout: WorkspaceLayoutServiceLike,
): () => void {
  const { registry, controller, face, lifecycle } = runtime
  const initial = controller.getSnapshot()
  const chromeLifecycle: Array<() => void> = []
  const disposeChrome = (): void => {
    for (const dispose of chromeLifecycle.reverse()) {
      try { dispose() } catch { /* chrome teardown continues across slots */ }
    }
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
    chromeLifecycle.push(() => layoutHandle.dispose())
    chromeLifecycle.push(controller.bindWorkspaceLayout(layoutHandle))
    const renderRegion = (region: 'right' | 'bottom') => (owner: Omit<PaneRegionChromeProps, 'region' | 'registry' | 'controller'>): ReactNode => createElement(PaneRegionChrome, {
      ...owner,
      region,
      registry,
      controller,
      handoff: runtime.handoff,
      conversationSearch: runtime.conversationSearch,
      keymap: runtime.keymap,
      workspaceContext: runtime.workspaceContext,
    })
    chromeLifecycle.push(slots.inject('shell.workspace.right', () => slots.register({
      name: 'shell.workspace.right',
      id: 'yeisme-pane-workbench-right',
      inject: () => face,
    }, renderRegion('right') as never)))
    chromeLifecycle.push(slots.inject('shell.workspace.bottom', () => slots.register({
      name: 'shell.workspace.bottom',
      id: 'yeisme-pane-workbench-bottom',
      inject: () => face,
    }, renderRegion('bottom') as never)))
    lifecycle.push(disposeChrome)
    return disposeChrome
  } catch (error) {
    disposeChrome()
    throw error
  }
}

function mountCorePaneHost(
  ctx: ClientContext,
  slots: SlotRegistryLike,
  workspaceLayout: WorkspaceLayoutServiceLike,
  tier: ExperienceTierTrackerV1,
): () => void {
  const runtime = createPaneWorkbenchRuntime(tier, ctx)
  const { controller, face, lifecycle, disposeLifecycle } = runtime
  try {
    ctx.provide('paneWorkbench', face)
    attachCoreChrome(runtime, slots, workspaceLayout)
    bindSessionSync(ctx, controller, lifecycle)
    bindExperienceTierHotplug(ctx, tier, lifecycle)
    return disposeLifecycle
  } catch (error) {
    disposeLifecycle()
    throw error
  }
}

/**
 * Tier 0 overlay mount. The collapse is render-time only — canonical state is
 * never rewritten — so a Tier 1 layout round-trips losslessly. A seam hot-plug
 * watcher re-judges the tier; once the Core seams probe available, the chrome
 * upgrades in place to the Core host while keeping the same runtime (views,
 * active tab, pinned/preview state all survive).
 */
function mountOverlayPaneHost(ctx: ClientContext, slots: SlotRegistryLike, tier: ExperienceTierTrackerV1): () => void {
  const runtime = createPaneWorkbenchRuntime(tier, ctx)
  const { registry, controller, face, lifecycle, disposeLifecycle } = runtime
  try {
    ctx.provide('paneWorkbench', face)
    let overlayChrome: (() => void) | undefined = slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'yeisme-pane-workbench-overlay', order: 60, inject: () => face }, (() => createElement(OfficialOverlayPaneHost, { registry, controller, handoff: runtime.handoff, conversationSearch: runtime.conversationSearch, keymap: runtime.keymap, workspaceContext: runtime.workspaceContext })) as never))
    lifecycle.push(() => { overlayChrome?.(); overlayChrome = undefined })
    // Seam hot-plug watcher: a workspace slot announcement re-judges the tier.
    // Injectors that fire setup while the slot is still undeclared are guarded by spec().
    lifecycle.push(slots.inject('shell.workspace.right', () => {
      let declared: unknown
      try { declared = slots.spec('shell.workspace.right') } catch { declared = undefined }
      if (declared !== undefined) tier.invalidate()
      return () => {}
    }))
    lifecycle.push(tier.subscribe(() => {
      if (overlayChrome === undefined || tier.getSnapshot().tier === 0) return
      if (!probePaneWorkbenchHost(ctx).available) return
      const workspaceLayout = readContextService<WorkspaceLayoutServiceLike>(ctx, 'workspaceLayout')
      if (workspaceLayout === undefined) return
      try {
        attachCoreChrome(runtime, slots, workspaceLayout)
      } catch {
        return // stay on the overlay host; the next invalidation retries the upgrade
      }
      overlayChrome()
      overlayChrome = undefined
      focusActiveTabAfterUpgrade(controller)
    }))
    bindSessionSync(ctx, controller, lifecycle)
    bindExperienceTierHotplug(ctx, tier, lifecycle)
    return disposeLifecycle
  } catch (error) { disposeLifecycle(); throw error }
}

function focusActiveTabAfterUpgrade(controller: PaneWorkbenchController): void {
  if (typeof document === 'undefined') return
  const state = controller.getSnapshot()
  const activeId = state.activeGroupId === undefined ? undefined : state.groups[state.activeGroupId]?.activeTabId
  if (activeId === undefined) return
  setTimeout(() => document.getElementById(`pane-tab-${activeId}`)?.focus(), 0)
}

/**
 * Fail-closed detector (dsh-pane-agents-host-compat-v1): both workspace slots
 * declared but the core-pane contract missing is a contradictory host — the
 * plugin stops mounting instead of presenting a half-functional workbench.
 */
export function hasPartialWorkspaceHost(probe: PaneWorkbenchHostProbeV1): boolean {
  return !probe.available
    && !probe.missing.includes('shell.workspace.right')
    && !probe.missing.includes('shell.workspace.bottom')
    && (probe.missing.includes(PANE_CORE_HOST_CONTRACT) || probe.missing.includes('workspaceLayout'))
}

/** Mounts Core Pane seams, or the official overlay seam on pre-Core DSH. */
export function apply(ctx: ClientContext): () => void {
  const existing = readContextService<PaneWorkbenchClientFace>(ctx, 'paneWorkbench')
  if (existing !== undefined && typeof existing.openView === 'function' && existing.controller !== undefined) {
    return () => {}
  }
  const slots = readContextService<SlotRegistryLike>(ctx, 'slots')
  const coreProbe = probePaneWorkbenchHost(ctx)
  if (slots === undefined) throw new Error(coreProbe.reason)
  // Session-scoped tier judgement: probed once at apply, re-judged on hot-plug, never persisted.
  const tier = createExperienceTierTracker({ probe: () => probeWorkspaceSeams(ctx, probePaneWorkbenchHost(ctx)) })
  tier.getSnapshot()
  if (!coreProbe.available) {
    if (hasPartialWorkspaceHost(coreProbe)) return () => {}
    return mountOverlayPaneHost(ctx, slots, tier)
  }
  const workspaceLayout = readContextService<WorkspaceLayoutServiceLike>(ctx, 'workspaceLayout')
  if (workspaceLayout === undefined) throw new Error(coreProbe.reason)
  return mountCorePaneHost(ctx, slots, workspaceLayout, tier)
}

export const PaneWorkbenchClientPlugin = { inject, apply: (ctx: Context): (() => void) => apply(ctx as ClientContext) }
export default PaneWorkbenchClientPlugin

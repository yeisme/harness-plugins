/**
 * DSH Web AI Drama Director client entry.
 *
 * Real wiring: six drama views register into the Pane Workbench runtime
 * (`registerView`, exact disposers), the /drama command group is contributed
 * as pane command descriptors (`slash.name: 'drama'`, category work) that the
 * command-experience live `/` directory projects, the Director preset applies
 * as a local single-region tab commit, and Workbench handoffs pass a strict
 * consumption gate. Every dependency is probed; missing seams fail closed
 * with a standard reason. No window/document-level listeners, no polling,
 * no fake hosts.
 *
 * @module @yeisme/dsh-client-ui-ai-drama-director/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ArtifactIntentV1, ArtifactRefV1, PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioRuntimeV1 } from '@yeisme/dsh-client-ui-creator-studio/runtime'
import {
  BRIDGE_V2_CONTRACT,
  applyDramaKey,
  createDramaInteractionState,
  createDramaPaneViews,
  dramaHelpCopy,
  mapDramaCommandError,
  type BridgeV2Intent,
  type DramaCommandEntryV1,
  type DramaCommandIdV1,
  type DramaCommandResultV1,
  type DramaInteractionState,
  type DramaPaneId,
  type DramaShowControlPaneId,
  type DramaPaneViewV1,
  type DramaCommandRequestV1,
  type DramaShowControlRemoteV1,
} from '@yeisme/dsh-ai-drama-director'
import {
  createDramaContextStore,
  type DramaContextSnapshotV1,
  type DramaContextStore,
} from './context.js'
import {
  createLegacyCreatorStudioRuntime,
  creatorProjectionIdentity,
  type DramaCreatorRuntimeV1,
  type LegacyCreatorStudioRuntimeV1,
} from './creator-runtime.js'
import {
  createDramaEvidenceEmitter,
  REVIEW_COMPLETED_EVIDENCE,
  handoffRejectionEvidence,
  type DramaEvidenceEmitter,
  type DramaEvidenceSink,
} from './evidence.js'
import {
  createDramaHandoffGate,
  resolveDramaHandoffTarget,
  type DramaHandoffGateResult,
} from './handoff-gate.js'
import {
  type WorkbenchLaunchActivationV1,
} from './launch-adapter.js'
import {
  createDramaKeymap,
  dramaKeyEventForAction,
  type DramaKeymap,
  type DramaViewKeyAction,
} from './keymap.js'
import {
  applyDirectorPreset,
  applyShowControlPreset,
  DRAMA_SHOW_CONTROL_DEPRECATION,
  buildDramaViewOpenRequest,
  buildShowControlViewOpenRequest,
  persistDirectorPresetVariant,
  resolveDramaPresetService,
  type DramaPresetPersistResultV1,
  type DramaPresetApplyResultV1,
  type DramaShowControlPresetApplyResultV1,
} from './preset.js'
import {
  dramaCommandAvailability,
  dramaViewAvailability,
  probeDramaCapability,
  DRAMA_SLASH_CONTRIBUTIONS,
  type CreatorStudioProjectionTransport,
  type DramaAvailabilityV1,
  type DramaCapabilityProbeResultV1,
  type DramaHostTransport,
  type DramaPaneWorkbenchFace,
} from './probe.js'
import { DramaShowControlController, type DramaSelectionAnnotationOwnerV1 } from './show-control-controller.js'
import {
  createDramaShowControlViewFactories,
  DRAMA_SHOW_CONTROL_VIEW_REGISTRATIONS,
} from './show-control-views.js'
import {
  createDramaViewFactories,
  DRAMA_VIEW_REGISTRATIONS,
  type DramaClientUiSnapshotV1,
} from './views.js'
import {
  createPipelineWorkbenchView,
  pipelineWorkbenchViewDescriptor,
  probePipelineScene3DRemote,
  probePipelineWorkbenchOwner,
  PIPELINE_WORKBENCH_UNAVAILABLE_REASON,
} from './pipeline/workbench-pane.js'
import type { PipelineWorkbenchOwnerFaceV1 } from './pipeline/workbench-controller.js'
import type { Scene3DDirectorRemote } from '@yeisme/dsh-client-ui-3d-director'
import {
  createPipelinePaneLinkBus,
  PIPELINE_PANE_LINK_SERVICE,
  type PipelinePaneLinkBusV1,
} from './pipeline/pane-link-bus.js'
import { mountPipelineRemotes } from './pipeline/remote-mount.js'
import { registerPipelineCapsuleSlot } from './capsule-slot.js'

export {
  deriveDecisionTokenView,
  buildDecisionRequest,
  refreshDecisionOutcome,
  type DecisionActionKind,
  type DecisionDescriptorLike,
  type DecisionTokenViewV1,
} from './decision-token.ts'
export {
  deriveExceptionFirstProjection,
  type ExceptionFirstProjectionInput,
  type ExceptionFirstProjectionV1,
  type ExceptionProjectionState,
} from './exception-projection.ts'
export {
  deriveDramaScenePackageExceptionView,
  type OpcSceneViewInput,
  type OpcSceneViewState,
  type OpcSceneCardKind,
  type OpcSceneProjectedActionV1,
  type OpcSceneExceptionCardV1,
  type OpcSceneProjectedReframeV1,
  type OpcSceneRoleLabelV1,
  type OpcSceneRoleDetailV1,
  type OpcSceneContextSectionV1,
  type DramaScenePackageExceptionView,
} from './opc-scene-view.ts'
export {
  DramaScenePackageContextView,
  OpcSceneExceptionCardsView,
  OpcSceneReframeView,
  OpcSceneDeliveryHandoffView,
  type OpcSceneSurfaceProps,
} from './opc-scene-views.tsx'
export { DramaClientRegistry } from '@yeisme/dsh-ai-drama-director'
export type {
  DramaClientRegistrationV1,
  DramaCommandEntryV1,
  DramaPaneViewV1,
  DramaPaneId,
} from '@yeisme/dsh-ai-drama-director'

export {
  probeDramaCapability,
  dramaCommandAvailability,
  dramaViewAvailability,
  DRAMA_PROBE_REASONS,
  DRAMA_VIEW_DEPENDENCIES,
  DRAMA_COMMAND_DEPENDENCIES,
} from './probe.js'
export { dramaOpcSceneSurfaceAvailability } from './probe.js'
export { createDramaContextStore } from './context.js'
export * from './show-control-controller.js'
export * from './show-control-views.js'
export {
  createLegacyCreatorStudioRuntime,
  creatorProjectionIdentity,
} from './creator-runtime.js'
export type {
  DramaCreatorRuntimeV1,
  LegacyCreatorStudioRuntimeV1,
} from './creator-runtime.js'
export { createDramaEvidenceEmitter } from './evidence.js'
export { createDramaHandoffGate, resolveDramaHandoffTarget, DRAMA_HANDOFF_TARGET_VIEWS } from './handoff-gate.js'
export {
  createWorkbenchLaunchAdapter,
  validateWorkbenchLaunchDescriptor,
  bridgeLensPreview,
  describeWorkbenchLaunch,
  WORKBENCH_LAUNCH_REF_PATTERN,
} from './launch-adapter.js'
export type {
  WorkbenchLaunchAdapter,
  WorkbenchLaunchActivationV1,
  WorkbenchLaunchActivationState,
  WorkbenchLaunchDescriptorInputV2,
  WorkbenchLaunchRequest,
} from './launch-adapter.js'
export { createDramaKeymap, DRAMA_KEYMAP_OVERRIDES, detectDramaKeymapConflicts } from './keymap.js'
export { createBoundedDedupStore, createDramaNonceStore } from './nonce-store.js'
export {
  applyDirectorPreset,
  applyShowControlPreset,
  buildDramaViewOpenRequest,
  buildShowControlViewOpenRequest,
  persistDirectorPresetVariant,
  DRAMA_VIEW_KINDS,
  DRAMA_DEFAULT_VISIBLE_TAB_LIMIT,
} from './preset.js'
export { DRAMA_VIEW_REGISTRATIONS, dramaViewDescriptor } from './views.js'
export * as pipeline from './pipeline/index.js'
export {
  createPipelineWorkbenchView,
  pipelineWorkbenchViewDescriptor,
  probePipelineScene3DRemote,
  probePipelineWorkbenchOwner,
  PIPELINE_WORKBENCH_PANE_KIND,
} from './pipeline/workbench-pane.js'
export { createPipelineFixtureOwner, PIPELINE_FIXTURE_OWNER_SERVICE } from './pipeline/fixture-owner.js'
export type { PipelineFixtureOwnerV1 } from './pipeline/fixture-owner.js'
export {
  PipelineWorkbenchController,
  PIPELINE_WORKBENCH_NO_CHANNEL_REASON,
} from './pipeline/workbench-controller.js'
export type {
  PipelineWorkbenchOwnerFaceV1,
  PipelineWorkbenchRunActionRequestV1,
  PipelineWorkbenchViewStateV1,
} from './pipeline/workbench-controller.js'
export {
  registerPipelineCapsuleSlot,
  buildPipelineCapsuleOpenRequest,
  decodePipelineCapsuleProjection,
  minimalPipelineCapsule,
  pipelineCapsuleSlotDeclared,
  resolvePipelineCapsuleSource,
  pipelineCapsuleSlotStyles,
  PIPELINE_CAPSULE_REASONS,
  PIPELINE_CAPSULE_SLOT,
  PIPELINE_CAPSULE_SLOT_ENTRY_ID,
  PIPELINE_CAPSULE_SLOT_ORDER,
} from './capsule-slot.js'
export type {
  PipelineCapsuleSlotDeps,
  PipelineCapsuleSlotHandle,
  PipelineCapsuleSlotPhase,
  PipelineCapsuleSlotSnapshotV1,
  PipelineCapsuleSourceKind,
  PipelineCapsuleSourceV1,
} from './capsule-slot.js'

export const name = 'client-ui-ai-drama-director'
/**
 * Required services (same shape the Creator Studio client declares): `remote`
 * authorizes the typed namespace property reads (`remote.creativePipeline`,
 * `remote.scene3dDirector`) after this plugin's own `$mount` defines them —
 * without the inject, cordis guards reject those reads ("cannot get property
 * without inject") and the pane renders its probe-only disables forever.
 * `paneWorkbench`/`dramaDirector` stay OPTIONAL (probed, honest disables).
 */
export const inject = ['slots', 'remote', 'locale'] as const

interface DramaCommandSpecV1 {
  readonly id: string
  readonly command?: DramaCommandIdV1
  readonly label: string
  readonly order: number
  readonly launcher?: boolean
  readonly slash?: {
    readonly name: string
    readonly aliases?: readonly string[]
    readonly hint?: string
    readonly category?: 'work'
  }
}

const DRAMA_COMMAND_SPECS: readonly DramaCommandSpecV1[] = [
  {
    id: 'drama',
    label: 'Drama Director',
    order: 0,
    launcher: true,
    slash: {
      name: DRAMA_SLASH_CONTRIBUTIONS.name,
      aliases: [...DRAMA_SLASH_CONTRIBUTIONS.aliases],
      hint: '[new|open|plan|generate|review|repair|handoff|show|inbox|assets|delivery]',
      category: 'work',
    },
  },
  { id: 'drama.help', label: 'Drama Help', order: 5 },
  { id: 'drama.open', label: 'Drama Open', order: 10 },
  { id: 'drama.new', command: 'new', label: 'Drama New', order: 20 },
  { id: 'drama.plan', command: 'plan', label: 'Drama Plan', order: 30 },
  { id: 'drama.generate', command: 'generate', label: 'Drama Generate', order: 40 },
  { id: 'drama.review', command: 'review', label: 'Drama Review', order: 50 },
  { id: 'drama.repair', command: 'repair', label: 'Drama Repair', order: 60 },
  { id: 'drama.evidence', command: 'evidence', label: 'Drama Evidence', order: 70 },
  { id: 'drama.handoff', command: 'handoff', label: 'Open in Workbench', order: 80 },
  { id: 'drama.show', label: 'Show Control', order: 90 },
  { id: 'drama.inbox', label: 'Review Inbox', order: 100 },
  { id: 'drama.assets', label: 'Asset Wall', order: 110 },
  { id: 'drama.delivery', label: 'Delivery', order: 120 },
]

/** Client face published on the context for the capability matrix and tests. */
export interface DramaDirectorClientFace {
  readonly probe: DramaCapabilityProbeResultV1
  readonly keymap: DramaKeymap
  evidenceSnapshot(): ReturnType<DramaEvidenceEmitter['snapshot']>
  contextSnapshot(): DramaContextSnapshotV1
  commandEntries(): readonly DramaCommandEntryV1[]
  openDramaView(view: DramaPaneId): void
  openShowControlView(view: DramaShowControlPaneId): void
  applyPreset(): DramaPresetApplyResultV1 | undefined
  applyShowControlPreset(): DramaShowControlPresetApplyResultV1 | undefined
  savePresetVariant(input: { readonly name: string; readonly scope: string; readonly draft: unknown }): Promise<DramaPresetPersistResultV1>
  consumeHandoff(input: unknown): Promise<DramaHandoffGateResult>
  /**
   * Activates the host-approved Workbench V2 bridge launch channel. Falls
   * back to an explicit `disabled` activation when the transport does not
   * offer the channel — never a composed URL.
   */
  activateWorkbenchLaunch(intent?: BridgeV2Intent): Promise<WorkbenchLaunchActivationV1>
}

type ContextService = Pick<ClientContext, 'get' | 'provide'>

function readContextService<T>(ctx: Pick<ClientContext, 'get'>, name: string): T | undefined {
  try {
    return ctx.get(name as never) as T | undefined
  } catch {
    return undefined
  }
}

function commandDescriptor(spec: DramaCommandSpecV1): Record<string, unknown> {
  return {
    id: spec.id,
    label: spec.label,
    presentation: {
      group: 'drama',
      order: spec.order,
      description: spec.label,
      ...(spec.launcher === true ? { launcher: true } : {}),
    },
    ...(spec.slash === undefined ? {} : { slash: spec.slash }),
  }
}

function toCommandEntries(probe: DramaCapabilityProbeResultV1): readonly DramaCommandEntryV1[] {
  return DRAMA_COMMAND_SPECS.map((spec) => {
    const availability = dramaCommandAvailability(probe, spec.id)
    return {
      id: spec.id,
      label: spec.label,
      disabled: availability.disabled,
      ...(availability.reason === undefined ? {} : { reason: availability.reason }),
    }
  })
}

function isCommandResult(value: unknown): value is DramaCommandResultV1 {
  if (value === null || typeof value !== 'object') return false
  const result = value as Partial<DramaCommandResultV1>
  return typeof result.kind === 'string' && typeof result.reason === 'string'
}

interface DramaClientRuntime {
  readonly face: DramaDirectorClientFace
  readonly model: Parameters<typeof createDramaViewFactories>[0]
  readonly dispose: () => void
}

function createRuntime(input: {
  readonly ctx: ContextService
  readonly pane: DramaPaneWorkbenchFace
  readonly probe: DramaCapabilityProbeResultV1
  readonly emitter: DramaEvidenceEmitter
  readonly contextStore: DramaContextStore
  readonly dramaHost?: DramaHostTransport
  readonly creatorRuntime?: DramaCreatorRuntimeV1
  readonly showControlController?: DramaShowControlController
}): DramaClientRuntime {
  const { ctx, pane, probe, emitter, contextStore } = input
  const keymap = createDramaKeymap()
  const disposers: Array<() => void> = []
  const listeners = new Set<() => void>()

  let interaction: DramaInteractionState = createDramaInteractionState()
  let openedSecondary: DramaPaneId[] = []
  let lastMessage: string | undefined
  let lastLaunch: WorkbenchLaunchActivationV1 | undefined
  let firstOpenEmitted = false
  let uiSnapshot: DramaClientUiSnapshotV1 = {
    context: contextStore.getSnapshot(),
    ...(input.creatorRuntime === undefined ? {} : {
      creator: input.creatorRuntime.getSnapshot(),
      creatorMode: input.creatorRuntime.mode,
    }),
    projectionIdentity: creatorProjectionIdentity(
      contextStore.getSnapshot().context?.contextRevision,
      input.creatorRuntime?.getSnapshot(),
    ),
  }

  const emitChange = (): void => {
    uiSnapshot = {
      context: contextStore.getSnapshot(),
      ...(input.creatorRuntime === undefined ? {} : {
        creator: input.creatorRuntime.getSnapshot(),
        creatorMode: input.creatorRuntime.mode,
      }),
      projectionIdentity: creatorProjectionIdentity(
        contextStore.getSnapshot().context?.contextRevision,
        input.creatorRuntime?.getSnapshot(),
      ),
      ...(lastMessage === undefined ? {} : { lastMessage }),
      ...(lastLaunch === undefined ? {} : { lastLaunch }),
    }
    for (const listener of listeners) listener()
  }

  const evidenceForLaunch = (activation: WorkbenchLaunchActivationV1): void => {
    if (activation.state === 'launched') emitter.emit('handoff_opened', { reasonCategory: 'bridge_v2' })
    else if (activation.state === 'legacy_bridge') emitter.emit('handoff_opened', { reasonCategory: 'legacy_bridge' })
    else if (activation.state === 'disabled') emitter.emit('command_needs_contract', { reasonCategory: activation.disabledReason ?? 'bridge_disabled' })
    else emitter.emit('command_unknown', { reasonCategory: 'handoff' })
  }

  const activateWorkbenchLaunch = async (intent: BridgeV2Intent): Promise<WorkbenchLaunchActivationV1> => {
    // The standalone target is retired. Cached capabilities must never reopen it.
    const activation: WorkbenchLaunchActivationV1 = {
      state: 'disabled', legacy: false, contractVersion: BRIDGE_V2_CONTRACT,
      intent, disabledReason: 'target_unavailable',
    }
    lastLaunch = activation
    setMessage("Standalone Workbench has been retired. Continue in the DSH project panes.")
    evidenceForLaunch(activation)
    return activation
  }

  // G21 dispose 收口：上游 store 订阅收纳进具名 unsubscribe 句柄，
  // 经 disposers 在 runtime dispose 时显式释放（不再依赖裸退订函数）。
  const contextSignal = {
    unsubscribe: contextStore.subscribe(() => {
      const context = contextStore.getSnapshot().context
      input.showControlController?.bind(context?.showRef, context?.contextRevision)
      emitChange()
    }),
  }
  disposers.push(() => { contextSignal.unsubscribe() })
  if (input.creatorRuntime !== undefined) {
    const runtimeSignal = { unsubscribe: input.creatorRuntime.subscribe(() => emitChange()) }
    disposers.push(() => { runtimeSignal.unsubscribe() })
  }

  const commands = toCommandEntries(probe)

  const setMessage = (message: string | undefined): void => {
    lastMessage = message
    emitChange()
  }

  const noteFirstOpen = (): void => {
    if (firstOpenEmitted) return
    firstOpenEmitted = true
    emitter.emit('command_opened', { reasonCategory: 'first_open' })
  }

  const openView = (view: DramaPaneId): void => {
    const availability = dramaViewAvailability(probe, view)
    if (availability.disabled) {
      setMessage(availability.reason)
      return
    }
    if ((view === 'Story' || view === 'Visual' || view === 'Audio') && !openedSecondary.includes(view)) {
      openedSecondary = [...openedSecondary, view]
    }
    pane.openView(buildDramaViewOpenRequest(view))
    noteFirstOpen()
  }

  const openShowControlView = (view: DramaShowControlPaneId): void => {
    const availability = dramaCommandAvailability(probe, view === 'ShowBoard' ? 'drama.show' : view === 'ReviewInbox' ? 'drama.inbox' : view === 'AssetWall' ? 'drama.assets' : 'drama.delivery')
    if (availability.disabled) {
      setMessage(availability.reason)
      return
    }
    pane.openView(buildShowControlViewOpenRequest(view))
    noteFirstOpen()
  }

  const applyPreset = (): DramaPresetApplyResultV1 => {
    const result = applyDirectorPreset(pane)
    emitter.emit('command_opened', { reasonCategory: 'preset' })
    noteFirstOpen()
    return result
  }

  const applyShowPreset = (): DramaShowControlPresetApplyResultV1 | undefined => {
    const availability = dramaCommandAvailability(probe, 'drama.show')
    if (availability.disabled) {
      setMessage(availability.reason)
      return undefined
    }
    // V3 exception-director 1.1/3.2: explicit legacy/advanced opens only.
    setMessage(DRAMA_SHOW_CONTROL_DEPRECATION)
    const result = applyShowControlPreset(pane)
    emitter.emit('command_opened', { reasonCategory: 'show_control_preset' })
    noteFirstOpen()
    return result
  }

  const evidenceForResult = (command: DramaCommandIdV1, result: DramaCommandResultV1): void => {
    if (command === 'review' && result.kind === 'submitted') {
      emitter.emit(REVIEW_COMPLETED_EVIDENCE.kind, { reasonCategory: REVIEW_COMPLETED_EVIDENCE.reasonCategory })
      return
    }
    if (result.kind === 'submitted' || result.kind === 'opened' || result.kind === 'proposal_created') {
      emitter.emit('command_submitted', { reasonCategory: command })
      return
    }
    if (result.kind === 'unknown') emitter.emit('command_unknown', { reasonCategory: command })
    else if (result.kind === 'reconcile_required') emitter.emit('command_reconcile', { reasonCategory: command })
    else emitter.emit('command_needs_contract', { reasonCategory: command })
  }

  const dispatchDramaCommand = async (spec: DramaCommandSpecV1): Promise<void> => {
    const availability = dramaCommandAvailability(probe, spec.id)
    if (availability.disabled) {
      setMessage(availability.reason)
      return
    }
    const transport = input.dramaHost
    if (transport?.dispatch === undefined) {
      setMessage('missing drama owner projection')
      emitter.emit('command_needs_contract', { reasonCategory: spec.command ?? 'drama' })
      return
    }
    const contextSnapshot = contextStore.getSnapshot()
    const context = contextSnapshot.context
    if (context === undefined) {
      setMessage(contextSnapshot.mutationReason ?? contextSnapshot.reason)
      emitter.emit('command_needs_contract', { reasonCategory: spec.command ?? 'drama' })
      return
    }
    const isMutation = spec.command !== undefined
      && ['generate', 'review', 'repair', 'handoff'].includes(spec.command)
    if (isMutation && !contextSnapshot.mutationsEnabled) {
      // unknown/partial/stale context: mutations stay disabled, never retried.
      setMessage(contextSnapshot.mutationReason ?? 'context requires reconcile before mutation')
      emitter.emit('command_reconcile', { reasonCategory: spec.command ?? 'drama' })
      return
    }

    if (spec.command === 'handoff') {
      const intent: BridgeV2Intent = context.episodeRef === undefined ? 'open_show' : 'open_episode'
      await activateWorkbenchLaunch(intent)
      return
    }

    const request: DramaCommandRequestV1 = {
      schema: 'drama.command-request.v1',
      command: spec.command ?? 'drama',
      selector: `show:${context.showRef}`,
      contextRevision: context.contextRevision,
    }
    const raw = await transport.dispatch(request)
    if (!isCommandResult(raw)) {
      setMessage('drama owner returned an unreadable result')
      emitter.emit('command_unknown', { reasonCategory: spec.command ?? 'drama' })
      return
    }
    const copy = mapDramaCommandError(raw)
    setMessage(`${copy.title}: ${copy.message}`)
    evidenceForResult(request.command, raw)
  }

  const runCommand = (commandId: string): void => {
    const spec = DRAMA_COMMAND_SPECS.find(item => item.id === commandId)
    if (spec === undefined) return
    if (commandId === 'drama' || commandId === 'drama.open') {
      applyPreset()
      return
    }
    if (commandId === 'drama.help') {
      const help = dramaHelpCopy()
      setMessage(`${help.title}: ${help.commands.join('  ')}`)
      emitter.emit('command_opened', { reasonCategory: 'help' })
      return
    }
    if (commandId === 'drama.show') {
      applyShowPreset()
      return
    }
    if (commandId === 'drama.inbox' || commandId === 'drama.assets' || commandId === 'drama.delivery') {
      openShowControlView(commandId === 'drama.inbox' ? 'ReviewInbox' : commandId === 'drama.assets' ? 'AssetWall' : 'Delivery')
      return
    }
    void dispatchDramaCommand(spec)
  }

  const handleViewKey = (_view: DramaPaneId, action: DramaViewKeyAction): void => {
    if (action.type === 'toggle-palette') {
      openView('Context')
      interaction = { ...interaction, focusZone: 'command' }
      emitChange()
      return
    }
    const keyEvent = dramaKeyEventForAction(action)
    if (keyEvent === undefined) return
    const panes: readonly DramaPaneViewV1[] = createDramaPaneViews(
      openedSecondary.filter((id): id is 'Story' | 'Visual' | 'Audio' => id === 'Story' || id === 'Visual' || id === 'Audio'),
    )
    interaction = applyDramaKey(interaction, keyEvent, commands, panes)
    if (action.type === 'execute-focused' && interaction.focusZone === 'command') {
      const entry = commands[interaction.focusedCommandIndex]
      if (entry !== undefined && !entry.disabled) runCommand(entry.id)
    }
    if (action.type === 'execute-focused' && interaction.focusZone === 'handoff') runCommand('drama.handoff')
    emitChange()
  }

  const dispatchArtifactIntent = (intent: ArtifactIntentV1): void => {
    if (pane.dispatchIntent !== undefined) {
      void pane.dispatchIntent(intent).then((receipt: PaneActionReceiptV1) => {
        setMessage(receipt.summary ?? receipt.reconcileReason ?? receipt.receiptRef)
      }).catch(() => setMessage('artifact intent settlement is unknown; no automatic retry'))
      return
    }
    if (intent.intent === 'open' || intent.intent === 'compare') {
      pane.openView({
        kind: 'creator.media',
        resourceKey: `creator:media:${intent.source.owner}:${intent.source.ref}:${intent.source.version}`,
        role: 'content',
        preferredRegion: 'right',
        retention: 'snapshot',
        singleton: false,
        preview: intent.intent === 'open',
        pinned: intent.intent === 'compare',
        title: intent.source.title,
        metadata: { artifact: intent.source },
      })
      return
    }
    setMessage('artifact handoff requires the shared pane intent runtime')
  }

  const openArtifact = (artifact: ArtifactRefV1, compare = false): void => {
    pane.openView({
      kind: 'creator.media',
      resourceKey: `creator:media:${artifact.owner}:${artifact.ref}:${artifact.version}`,
      role: 'content',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: false,
      preview: !compare,
      pinned: compare,
      title: artifact.title,
      metadata: { artifact },
    })
  }

  const model = {
    getSnapshot: () => uiSnapshot,
    getAvailability: (view: DramaPaneId): DramaAvailabilityV1 => dramaViewAvailability(probe, view),
    getCommands: () => commands,
    getKeymap: () => keymap,
    getCreatorRuntime: () => input.creatorRuntime,
    refreshCreator: () => input.creatorRuntime?.refresh() ?? Promise.resolve(),
    reconcile: async () => {
      const context = await contextStore.reconcile()
      input.showControlController?.bind(context.context?.showRef, context.context?.contextRevision)
      await input.creatorRuntime?.refresh()
      await input.showControlController?.refresh()
    },
    dispatchArtifactIntent,
    openArtifact,
    handleViewKey,
    runCommand,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  const factories = createDramaViewFactories(model)
  for (const { descriptor } of DRAMA_VIEW_REGISTRATIONS) {
    disposers.push(pane.registerView({
      descriptor,
      component: factories[descriptor.componentKey],
    }))
  }

  const showControlFactories = createDramaShowControlViewFactories({
    ...(input.showControlController === undefined ? { disabledReason: probe.showControl.reason } : { controller: input.showControlController }),
    refresh: () => input.showControlController?.refresh() ?? Promise.resolve(),
    openArtifact,
  })
  for (const { descriptor } of DRAMA_SHOW_CONTROL_VIEW_REGISTRATIONS) {
    disposers.push(pane.registerView({ descriptor, component: showControlFactories[descriptor.componentKey] }))
  }

  if (typeof pane.registerCommand === 'function') {
    for (const spec of DRAMA_COMMAND_SPECS) {
      disposers.push(pane.registerCommand({
        descriptor: commandDescriptor(spec),
        execute: () => runCommand(spec.id),
      }))
    }
    if (probe.commandExperience.available) {
      emitter.emit('command_opened', { reasonCategory: 'discovery' })
    }
  }

  const gate = createDramaHandoffGate({ emitter })
  const presetService = resolveDramaPresetService(key => readContextService(ctx, key), pane)

  const face: DramaDirectorClientFace = {
    probe,
    keymap,
    evidenceSnapshot: () => emitter.snapshot(),
    contextSnapshot: () => contextStore.getSnapshot(),
    commandEntries: () => commands,
    openDramaView: openView,
    openShowControlView,
    applyPreset,
    applyShowControlPreset: applyShowPreset,
    savePresetVariant: saveInput => persistDirectorPresetVariant(presetService, saveInput),
    activateWorkbenchLaunch: (intent: BridgeV2Intent = 'open_show') => activateWorkbenchLaunch(intent),
    consumeHandoff: async (handoffInput: unknown): Promise<DramaHandoffGateResult> => {
      const result = gate.consume(handoffInput)
      if (!result.ok) {
        setMessage(result.reason)
        return result
      }
      const target = resolveDramaHandoffTarget(result.intent, view => dramaViewAvailability(probe, view))
      if (!target.ok) {
        const evidence = handoffRejectionEvidence(target.category)
        emitter.emit(evidence.kind, { reasonCategory: evidence.reasonCategory })
        setMessage(target.reason)
        return { ok: false, category: target.category, reason: target.reason }
      }
      // The target re-resolves owner data; handoff payload content is never rendered.
      await contextStore.reconcile()
      openView(target.view)
      emitter.emit('handoff_opened', { reasonCategory: result.intent })
      return result
    },
  }

  let disposed = false
  return {
    face,
    model,
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const dispose of disposers.reverse()) dispose()
      listeners.clear()
    },
  }
}

/**
 * Mounts the Drama Director client face and returns an exact, idempotent
 * disposer. A second apply on an already-mounted context is a no-op; after
 * dispose, apply rebuilds cleanly (HMR-safe).
 *
 * Real-host ordering (task 3.2 staging composition fix): this bundle's client
 * entry declares `immediately`, so it can apply BEFORE sibling client plugins
 * provide `paneWorkbench` / the slots service — a one-shot probe would then
 * strand the pack in the probe-only branch with the Pipeline Workbench pane
 * never registered in the launcher. The mount is therefore re-run when either
 * sibling service arrives later (the same `internal/service` pattern the
 * Creator Studio client uses); each mount fully disposes the previous one, so
 * nothing registers twice and a missing pane still degrades honestly.
 */
export async function apply(ctx: ClientContext): Promise<() => void> {
  const existing = readContextService<DramaDirectorClientFace>(ctx, 'dramaDirector')
  if (existing !== undefined) return () => {}

  // Professional-pane link bus (task 3.2 emission wiring): provided for the
  // plugin's whole lifetime — including the probe-only branch — so
  // independent panes (the Scaena 镜头表 pane) can always resolve it. Without
  // a mounted workbench controller entries simply have no listener
  // (fail-closed, never buffered for a future consumer).
  const paneLinkBus = createPipelinePaneLinkBus()
  const unprovideBus = provide(ctx, PIPELINE_PANE_LINK_SERVICE, paneLinkBus)

  let disposed = false
  let generation = 0
  let mounted: (() => void) | undefined
  /** Last registration signature; guards no-op re-mounts (see mount()). */
  let lastSignature: string | undefined
  // Pipeline Remote namespaces (creativePipeline / scene3dDirector): the
  // `remote` service can arrive after this immediately client entry applied,
  // so the mount is (re-)attempted inside every mount cycle until it sticks —
  // the SAME one-shot namespace seam the Creator Studio client uses. Absent
  // `remote`/`$mount` → undefined → the pane renders its honest probe-only
  // disables.
  let remoteMount: Awaited<ReturnType<typeof mountPipelineRemotes>> | undefined
  // The Remote namespace mount is deliberately NEVER awaited inside the mount
  // cycle: `$mount` can queue behind the gateway connection, and view/command
  // registration must not block on transport arrival. When the namespaces
  // land, the re-mount re-probes the owner faces and re-registers the
  // pipeline pane with the now-mounted projection source.
  const ensureRemoteMount = async (): Promise<void> => {
    if (remoteMount !== undefined) return
    const remotes = await mountPipelineRemotes(ctx)
    if (disposed || remotes === undefined || remoteMount !== undefined) return
    remoteMount = remotes
    void mount()
  }
  const mount = async (): Promise<void> => {
    const current = ++generation
    void ensureRemoteMount()
    const { probe, pane, dramaHost, creatorRuntime, creatorStudio, showControl, selectionAnnotation } = await probeDramaCapability(ctx)
    if (disposed || current !== generation) return
    // Registration signature: a re-mount only re-registers when a seam
    // AVAILABILITY actually flipped (pane face, pipeline owner projection, or
    // scene3dDirector remote). Unchanged signature keeps the LIVE registration
    // — re-registering an already-open pane would reset its local state
    // (selection, drafts) for no observable gain.
    const pipelineOwner = probePipelineWorkbenchOwner(ctx)
    const scene3dRemote = probePipelineScene3DRemote(ctx)
    const signature = `${pane !== undefined}:${pipelineOwner !== undefined}:${scene3dRemote !== undefined}`
    if (mounted !== undefined && signature === lastSignature) return
    lastSignature = signature
    mounted?.()
    mounted = undefined
    mounted = pane === undefined
      ? mountProbeOnlyFace(ctx, { probe, paneLinkBus })
      : mountResolvedFace(ctx, {
        probe,
        pane,
        dramaHost,
        creatorRuntime,
        creatorStudio,
        showControl,
        selectionAnnotation,
        paneLinkBus,
        pipelineOwner,
        scene3dRemote,
      })
  }
  const serviceEvents = ctx.on?.('internal/service', name => {
    if (!disposed && (name === 'paneWorkbench' || name === 'slots' || name === 'remote')) void mount()
  }, { global: true })
  await mount()
  return () => {
    if (disposed) return
    disposed = true
    serviceEvents?.()
    mounted?.()
    mounted = undefined
    remoteMount?.dispose()
    paneLinkBus.dispose()
    unprovideBus()
  }
}

/** Fail-closed mount without the Pane Workbench face: probe-only service + slot-gated capsule. */
function mountProbeOnlyFace(
  ctx: ClientContext,
  deps: { readonly probe: DramaCapabilityProbeResultV1; readonly paneLinkBus: PipelinePaneLinkBusV1 },
): () => void {
  // Fail closed: no view/command registration without the Pane Workbench
  // face. The probe projection stays visible for the capability matrix.
  const sink = readContextService<DramaEvidenceSink>(ctx, 'dramaEvidenceSink')
  const emitter = createDramaEvidenceEmitter(sink)
  const probeOnlyFace: Pick<DramaDirectorClientFace, 'probe' | 'keymap' | 'evidenceSnapshot'> = {
    probe: deps.probe,
    keymap: createDramaKeymap(),
    evidenceSnapshot: () => emitter.snapshot(),
  }
  // The header capsule still registers (slot-gated): without the pane face
  // its surface switch renders disabled with the probe reason.
  const capsuleSlot = registerPipelineCapsuleSlot(ctx, {})
  const unprovide = provide(ctx, 'dramaDirector', probeOnlyFace)
  return () => {
    capsuleSlot.dispose()
    unprovide()
  }
}

interface ResolvedMountDeps {
  readonly probe: DramaCapabilityProbeResultV1
  readonly pane: DramaPaneWorkbenchFace
  readonly dramaHost: DramaHostTransport | undefined
  readonly creatorRuntime: CreatorStudioRuntimeV1 | undefined
  readonly creatorStudio: CreatorStudioProjectionTransport | undefined
  readonly showControl: DramaShowControlRemoteV1 | undefined
  readonly selectionAnnotation: DramaSelectionAnnotationOwnerV1 | undefined
  readonly paneLinkBus: PipelinePaneLinkBusV1
  /** Probed at mount time (re-probed per mount cycle; fixed per registration). */
  readonly pipelineOwner: PipelineWorkbenchOwnerFaceV1 | undefined
  readonly scene3dRemote: Scene3DDirectorRemote | undefined
}

/** Full mount: runtime face + pipeline workbench pane + header capsule. */
function mountResolvedFace(ctx: ClientContext, deps: ResolvedMountDeps): () => void {
  const { probe, pane, dramaHost, creatorRuntime, creatorStudio, showControl, selectionAnnotation, paneLinkBus, pipelineOwner, scene3dRemote } = deps
  const sink = readContextService<DramaEvidenceSink>(ctx, 'dramaEvidenceSink')
  const emitter = createDramaEvidenceEmitter(sink)
  const contextStore = createDramaContextStore({
    ...(dramaHost === undefined ? {} : { transport: dramaHost }),
    emitter,
  })
  const legacyCreatorRuntime: LegacyCreatorStudioRuntimeV1 | undefined = creatorRuntime === undefined && creatorStudio !== undefined
    ? createLegacyCreatorStudioRuntime(creatorStudio)
    : undefined
  const resolvedCreatorRuntime: CreatorStudioRuntimeV1 | LegacyCreatorStudioRuntimeV1 | undefined = creatorRuntime ?? legacyCreatorRuntime
  const showControlController = showControl === undefined ? undefined : new DramaShowControlController(showControl, selectionAnnotation)
  const runtime = createRuntime({
    ctx,
    pane,
    probe,
    emitter,
    contextStore,
    ...(dramaHost === undefined ? {} : { dramaHost }),
    ...(resolvedCreatorRuntime === undefined ? {} : { creatorRuntime: resolvedCreatorRuntime }),
    ...(showControlController === undefined ? {} : { showControlController }),
  })
  const unprovide = provide(ctx, 'dramaDirector', runtime.face)

  // Pipeline workbench pane (dsh-creative-pipeline-visual-workbench-v1, D6):
  // registered whenever the Pane Workbench face exists; the view itself is
  // probe-first and renders a disabled, reasoned surface until a pipeline
  // owner projection source (or an explicit fixture owner) is available.
  // Priority-6 seam: the embedded Shot-anchored 3D viewport probes the
  // scene3dDirector remote separately (probed by the caller per mount cycle);
  // absent → the Inspector entry renders disabled with the probe reason.
  const unregisterPipelineWorkbench = pane.registerView({
    descriptor: pipelineWorkbenchViewDescriptor(),
    component: createPipelineWorkbenchView(
      pipelineOwner === undefined
        ? { disabledReason: PIPELINE_WORKBENCH_UNAVAILABLE_REASON, paneLinkBus }
        : {
          owner: pipelineOwner,
          ...(scene3dRemote === undefined ? {} : { scene3dRemote }),
          paneLinkBus,
        },
    ),
  })

  // Header capsule (real-render wave): declaration-gated slot contribution on
  // the official session header actions slot; probe-first data source
  // (remote.creativePipeline → creativePipelineFixture → static capsule).
  const capsuleSlot = registerPipelineCapsuleSlot(ctx, { pane })

  // Initial context resolution is best-effort; failures degrade to a
  // disabled, reasoned state instead of throwing out of apply().
  void contextStore.refresh().then(context => {
    showControlController?.bind(context.context?.showRef, context.context?.contextRevision)
    if (context.context?.showRef !== undefined) void showControlController?.refresh()
  })
  if (legacyCreatorRuntime !== undefined) void legacyCreatorRuntime.refresh()

  if (probe.available) emitter.emit('pack_installed', { reasonCategory: 'capability_ready' })

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    capsuleSlot.dispose()
    unregisterPipelineWorkbench()
    unprovide()
    runtime.dispose()
    legacyCreatorRuntime?.dispose()
    showControlController?.dispose()
  }
}

function provide(ctx: ContextService, serviceName: string, value: unknown): () => void {
  try {
    return ctx.provide(serviceName as never, value) as () => void
  } catch {
    return () => {}
  }
}

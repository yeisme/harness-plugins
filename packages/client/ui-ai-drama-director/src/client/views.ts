/**
 * Drama pane view descriptors and local components.
 *
 * Components are honest shells over the probe + context model: a disabled
 * dependency renders the standard reason instead of data, and no view
 * fabricates host regions, owner data, or projections. Keyboard handling is
 * element-scoped (`onKeyDown` on the view root) and resolves through the
 * shared keymap face — no window/document listeners.
 */

import { createElement, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DramaCommandEntryV1, DramaPaneId } from '@yeisme/dsh-ai-drama-director'
import type { ArtifactIntentV1, ArtifactRefV1 } from '@yeisme/dsh-pane-protocol'
import type {
  CreatorOwnerProjectionV1,
  CreatorStudioOwner,
  CreatorStudioTask,
} from '@yeisme/dsh-creator-studio-host/contracts'
import {
  CreatorActionComposer,
  CreatorGenerationView,
  CreatorResourceCard,
  CreatorReviewList,
  creatorStudioStyles,
} from '@yeisme/dsh-client-ui-creator-studio/projection-components'
import type { CreatorStudioViewState } from '@yeisme/dsh-client-ui-creator-studio/runtime'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'
import type { DramaContextSnapshotV1 } from './context.js'
import type { DramaKeymap, DramaViewKeyAction } from './keymap.js'
import { toCommandKeyEvent } from './keymap.js'
import type { DramaAvailabilityV1 } from './probe.js'
import { DRAMA_VIEW_KINDS } from './preset.js'
import type { WorkbenchLaunchActivationV1 } from './launch-adapter.js'
import type { DramaCreatorRuntimeV1 } from './creator-runtime.js'

/** Versioned UI snapshot; identity changes on every model update. */
export interface DramaClientUiSnapshotV1 {
  readonly context: DramaContextSnapshotV1
  readonly creator?: CreatorStudioViewState
  readonly creatorMode?: DramaCreatorRuntimeV1['mode']
  /** Remount fence for selection, drafts, temporary forms, and old receipts. */
  readonly projectionIdentity: string
  readonly lastMessage?: string
  /** Safe launch projection summary (lens, intent, contract, expiry, reason). */
  readonly lastLaunch?: WorkbenchLaunchActivationV1
}

/** UI model the view components read; implemented by the composition root. */
export interface DramaViewModel {
  getSnapshot(): DramaClientUiSnapshotV1
  getAvailability(view: DramaPaneId): DramaAvailabilityV1
  getCommands(): readonly DramaCommandEntryV1[]
  getKeymap(): DramaKeymap
  getCreatorRuntime(): DramaCreatorRuntimeV1 | undefined
  refreshCreator(): Promise<void>
  reconcile(): Promise<void>
  dispatchArtifactIntent(intent: ArtifactIntentV1): void
  openArtifact(artifact: ArtifactRefV1, compare?: boolean): void
  /** Feeds a resolved key action into the interaction model. */
  handleViewKey(view: DramaPaneId, action: DramaViewKeyAction): void
  /** Runs a pane command id ('drama.review', ...) honoring disabled state. */
  runCommand(commandId: string): void
  subscribe(listener: () => void): () => void
}

export interface DramaViewDescriptorSpec {
  readonly kind: string
  readonly label: string
  readonly componentKey: string
  readonly role: 'content'
  readonly preferredRegion: 'right'
  readonly retention: 'keep-alive'
  readonly singleton: true
  readonly presentation: {
    readonly icon: string
    readonly group: string
    readonly description: string
    readonly order: number
    readonly launcher: true
  }
}

export interface DramaViewRegistrationSpec {
  readonly id: DramaPaneId
  readonly descriptor: DramaViewDescriptorSpec
}

const VIEW_PRESENTATION: Readonly<Record<DramaPaneId, { icon: string; description: string; order: number }>> = {
  Context: { icon: 'folder', description: 'Current show/episode context, freshness, and reconcile entry', order: 10 },
  Review: { icon: 'check', description: 'Review queue with owner decision surface', order: 20 },
  Run: { icon: 'terminal', description: 'Generation run status, receipts, and reconcile state', order: 30 },
  Story: { icon: 'file', description: 'Episode plan and structure projection', order: 40 },
  Visual: { icon: 'media', description: 'Visual asset references', order: 50 },
  Audio: { icon: 'media', description: 'Audio asset references', order: 60 },
}

export function dramaViewDescriptor(id: DramaPaneId): DramaViewDescriptorSpec {
  const presentation = VIEW_PRESENTATION[id]
  return {
    kind: DRAMA_VIEW_KINDS[id],
    label: `Drama ${id}`,
    componentKey: `drama-${id.toLowerCase()}`,
    role: 'content',
    preferredRegion: 'right',
    retention: 'keep-alive',
    singleton: true,
    presentation: {
      icon: presentation.icon,
      group: 'drama',
      description: presentation.description,
      order: presentation.order,
      launcher: true,
    },
  }
}

export const DRAMA_VIEW_REGISTRATIONS: readonly DramaViewRegistrationSpec[] = [
  'Context',
  'Story',
  'Visual',
  'Audio',
  'Run',
  'Review',
].map((id) => ({ id: id as DramaPaneId, descriptor: dramaViewDescriptor(id as DramaPaneId) }))

const DRAMA_STYLES = `
[data-drama-view]{height:100%;outline:none}
[data-drama-view]:focus-visible{outline:2px solid var(--vk-accent);outline-offset:-2px}
[data-drama-view] .dv-badge{flex:none;padding:1px 6px;border-radius:999px;background:var(--vk-bg-layer-2);color:var(--vk-text-tertiary);font-size:10px;text-transform:uppercase;letter-spacing:.04em}
[data-drama-view] .dv-badge[data-freshness='fresh']{background:color-mix(in srgb,var(--vk-tone-positive) 16%,transparent);color:var(--vk-tone-positive)}
[data-drama-view] .dv-badge[data-freshness='stale'],[data-drama-view] .dv-badge[data-freshness='gap']{background:color-mix(in srgb,var(--vk-tone-warn) 16%,transparent);color:var(--vk-tone-warn)}
[data-drama-view] .dv-badge[data-freshness='offline']{background:color-mix(in srgb,var(--vk-tone-critical) 16%,transparent);color:var(--vk-tone-critical)}
[data-drama-view] .dv-row{display:flex;min-width:0;gap:8px;align-items:baseline}
[data-drama-view] .dv-key{flex:none;width:88px;color:var(--vk-text-quaternary);font-size:11px}
[data-drama-view] .dv-val{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-secondary)}
[data-drama-view] .dv-message{color:var(--vk-text-tertiary);font-size:12px}
[data-drama-view] .dv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:10px}
[data-drama-view] .dv-stage-track{display:grid;grid-template-columns:repeat(6,minmax(72px,1fr));gap:6px;overflow-x:auto}
[data-drama-view] .dv-stage{display:grid;gap:4px;min-width:72px;padding:8px;border:1px solid var(--vk-border-subtle);border-radius:8px;background:var(--vk-bg-layer-1)}
[data-drama-view] .dv-stage strong{font-size:11px}.dv-stage small{font-size:10px;color:var(--vk-text-tertiary)}
[data-drama-view] .dv-stage progress{width:100%;accent-color:var(--vk-accent)}
[data-drama-view] .dv-owner-stack{display:grid;gap:12px}
[data-drama-view] .dv-alert{padding:8px;border:1px solid color-mix(in srgb,var(--vk-tone-warn) 35%,var(--vk-border-subtle));border-radius:8px;color:var(--vk-tone-warn);font-size:12px}
[data-drama-view] .dv-receipt{display:grid;gap:2px;padding:8px;border-radius:8px;background:var(--vk-bg-layer-2);font-size:11px;color:var(--vk-text-secondary)}
@media(max-width:390px){[data-drama-view] .dv-grid{grid-template-columns:1fr}[data-drama-view] .dv-key{width:72px}}
`

function bounded(value: string | undefined): string {
  if (value === undefined) return '—'
  return value.length <= 80 ? value : `${value.slice(0, 77)}…`
}

function ContextRows({ context }: { readonly context: DramaContextSnapshotV1 }): ReactNode {
  const value = context.context
  if (value === undefined) return null
  const rows: Array<[string, string | undefined]> = [
    ['show', value.showRef],
    ['episode', value.episodeRef],
    ['revision', value.contextRevision],
  ]
  return createElement('div', { 'data-drama-context-summary': true },
    rows.map(([key, ref]) => createElement('div', { key, className: 'dv-row' },
      createElement('span', { className: 'dv-key' }, key),
      createElement('span', { className: 'dv-val' }, bounded(ref)),
    )))
}

/** Workbench launch summary row: lens, intent, contract, expiry — never a URL or envelope. */
function LaunchRow({ launch }: { readonly launch: WorkbenchLaunchActivationV1 }): ReactNode {
  const detail = launch.state === 'launched'
    ? `${launch.lensLabel} · ${launch.intent} · expires ${new Date(launch.expiresAtUnixMs ?? 0).toISOString().slice(11, 19)}Z`
    : launch.state === 'legacy_bridge'
      ? 'legacy V1 bridge'
      : launch.state === 'disabled'
        ? `disabled (${launch.disabledReason ?? 'unknown reason'})`
        : 'outcome unknown — no auto retry'
  return createElement('div', { className: 'dv-row', 'data-drama-launch-summary': launch.state },
    createElement('span', { className: 'dv-key' }, 'workbench'),
    createElement('span', { className: 'dv-val' }, bounded(detail)),
  )
}

function ownerProjection(state: CreatorStudioViewState | undefined, owner: CreatorStudioOwner): CreatorOwnerProjectionV1 | undefined {
  return state?.snapshot?.owners.find(item => item.owner === owner)
}

function projectionMutationReason(
  snapshot: DramaClientUiSnapshotV1,
  runtime: DramaCreatorRuntimeV1 | undefined,
): string | undefined {
  if (runtime === undefined) return 'Creator Studio runtime is unavailable.'
  if (runtime.mode === 'legacy-readonly') return 'Legacy Creator projection is read-only; install the shared runtime to unlock owner actions.'
  const creator = snapshot.creator
  const studio = creator?.snapshot
  if (creator === undefined || studio === null || studio === undefined) return 'Creator Studio projection has not resolved yet.'
  if (creator.phase !== 'ready') return `Creator Studio projection is ${creator.phase}; refresh or reconcile before mutation.`
  if (studio.status !== 'ready' || studio.freshness !== 'fresh') return `Creator Studio projection is ${studio.status}/${studio.freshness}; owner reconcile is required.`
  if (!snapshot.context.mutationsEnabled) return snapshot.context.mutationReason ?? 'Drama context requires reconcile before mutation.'
  const drama = snapshot.context.context
  const context = studio.context
  if (drama !== undefined && context !== undefined) {
    if (drama.workspaceRef !== context.workspaceRef) return 'Drama and Creator projections are bound to different workspaces.'
    if (drama.projectRef !== undefined && context.projectRef !== undefined && drama.projectRef !== context.projectRef) {
      return 'Drama and Creator projections are bound to different projects.'
    }
  }
  if (creator.lastReceipt?.status === 'unknown' || creator.lastReceipt?.status === 'reconcile_required') {
    return creator.lastReceipt.reconcileReason ?? 'The last owner settlement is uncertain; reconcile before another mutation.'
  }
  return undefined
}

function CreatorProjectionState({ state, mode }: { readonly state: CreatorStudioViewState | undefined; readonly mode: DramaCreatorRuntimeV1['mode'] | undefined }): ReactNode {
  if (state === undefined) return createElement(SurfaceState, { phase: 'disabled', title: 'Creator projection unavailable', description: 'Install Creator Studio to unlock this pane.' })
  if (state.phase === 'loading' && state.snapshot === null) return createElement(SurfaceState, { phase: 'loading', title: 'Loading Creator projection' })
  if (state.phase === 'error' && state.snapshot === null) return createElement(SurfaceState, { phase: 'error', title: 'Creator projection failed', description: state.errorCode ?? undefined })
  if (state.snapshot === null) return createElement(SurfaceState, { phase: 'empty', title: 'Creator projection is empty' })
  if (mode === 'legacy-readonly') return createElement('p', { className: 'dv-alert', role: 'status' }, 'Legacy read-only compatibility mode · explicit refresh only · owner actions disabled.')
  if (state.phase !== 'ready' || state.snapshot.freshness !== 'fresh' || state.snapshot.status !== 'ready') {
    return createElement('p', { className: 'dv-alert', role: 'status' }, `${state.snapshot.safeMessage} Mutations remain disabled until owner reconcile.`)
  }
  return null
}

function ContextOperationalProjection({ snapshot }: { readonly snapshot: DramaClientUiSnapshotV1 }): ReactNode {
  const studio = snapshot.creator?.snapshot
  if (studio === null || studio === undefined) return null
  const production = studio.production
  const nextAction = studio.owners
    .filter(owner => owner.status === 'ready' && owner.freshness === 'fresh')
    .flatMap(owner => owner.actions.map(action => `${owner.owner}: ${action.label}`))[0]
  return createElement('div', { className: 'dv-owner-stack', 'data-drama-operational-context': true },
    createElement(SurfaceSection, {
      title: production?.title ?? 'Current production',
      description: production === undefined ? studio.safeMessage : `Current stage: ${production.currentStage}`,
      meta: createElement('span', { className: 'dv-badge', 'data-freshness': studio.freshness }, `${studio.status} · ${studio.freshness}`),
    },
    production === undefined ? createElement(SurfaceState, { phase: 'partial', title: 'Production stages unavailable' })
      : createElement('div', { className: 'dv-stage-track', 'aria-label': 'Six-stage episode progress' },
        production.stages.map(stage => createElement('div', { className: 'dv-stage', key: stage.id, 'data-status': stage.status },
          createElement('strong', null, stage.label),
          createElement('small', null, `${stage.status}${stage.itemCount === undefined ? '' : ` · ${stage.itemCount}`}`),
          createElement('progress', { max: 1, value: stage.progress, 'aria-label': `${stage.label} ${Math.round(stage.progress * 100)}%` }),
        )),
      ),
    production?.blockers.length === 0 ? null : createElement('div', { className: 'dv-owner-stack', 'aria-label': 'Production blockers' },
      production?.blockers.map(blocker => createElement('div', { className: 'dv-alert', key: blocker.ref }, `${blocker.title} · ${blocker.summary}`)),
    ),
    createElement('div', { className: 'dv-row' }, createElement('span', { className: 'dv-key' }, 'next action'), createElement('span', { className: 'dv-val' }, bounded(nextAction))),
    ),
  )
}

function OwnerOperationalProjection(props: {
  readonly owners: readonly { readonly owner: CreatorStudioOwner; readonly task: CreatorStudioTask }[]
  readonly snapshot: DramaClientUiSnapshotV1
  readonly model: DramaViewModel
}): ReactNode {
  const { snapshot, model } = props
  const state = snapshot.creator
  const studio = state?.snapshot
  const runtime = model.getCreatorRuntime()
  const mutationReason = projectionMutationReason(snapshot, runtime)
  if (studio === null || studio === undefined || state === undefined) return null
  return createElement('div', { className: 'dv-owner-stack', 'data-creator-studio': true },
    createElement('style', null, creatorStudioStyles),
    props.owners.map(({ owner: ownerId, task }) => {
      const owner = ownerProjection(state, ownerId)
      if (owner === undefined) return createElement(SurfaceState, { key: ownerId, phase: 'partial', title: `${ownerId} projection unavailable` })
      return createElement(SurfaceSection, {
        key: `${owner.snapshotRef}:${ownerId}`,
        className: 'cs-section',
        title: ownerId,
        description: owner.summary,
        meta: createElement('div', { className: 'cs-badges' },
          createElement('span', { className: 'cs-badge' }, owner.transport),
          createElement('span', { className: 'cs-badge' }, owner.freshness),
        ),
      },
      owner.resources.length === 0
        ? createElement(SurfaceState, { phase: 'empty', title: `${ownerId} has no projected resources` })
        : createElement('div', { className: 'cs-resource-grid ys-grid' }, owner.resources.map(resource => createElement(CreatorResourceCard, {
          key: `${resource.ref}:${resource.version}`,
          resource,
          owner: ownerId,
          ...(studio.context?.projectRef === undefined ? {} : { projectRef: studio.context.projectRef }),
          onIntent: (intent: ArtifactIntentV1) => model.dispatchArtifactIntent(intent),
        }))),
      mutationReason === undefined && runtime?.mode === 'shared'
        ? createElement(CreatorActionComposer, {
          key: snapshot.projectionIdentity,
          owner,
          task,
          snapshot: studio,
          state,
          controller: runtime,
        })
        : createElement('p', { className: 'dv-alert', role: 'status' }, mutationReason),
      )
    }),
  )
}

function RunOperationalProjection({ snapshot }: { readonly snapshot: DramaClientUiSnapshotV1 }): ReactNode {
  const studio = snapshot.creator?.snapshot
  if (studio === null || studio === undefined) return null
  return createElement('div', { 'data-creator-studio': true },
    createElement('style', null, creatorStudioStyles),
    createElement(CreatorGenerationView, { snapshot: studio }),
    snapshot.creator?.lastReceipt === null || snapshot.creator?.lastReceipt === undefined ? null
      : createElement('div', { className: 'dv-receipt', 'data-status': snapshot.creator.lastReceipt.status },
        createElement('strong', null, `${snapshot.creator.lastReceipt.status} · ${snapshot.creator.lastReceipt.receiptRef}`),
        createElement('span', null, snapshot.creator.lastReceipt.summary ?? snapshot.creator.lastReceipt.reconcileReason ?? 'Owner receipt recorded.'),
      ),
  )
}

function ReviewOperationalProjection({ snapshot, model }: { readonly snapshot: DramaClientUiSnapshotV1; readonly model: DramaViewModel }): ReactNode {
  const state = snapshot.creator
  const studio = state?.snapshot
  const runtime = model.getCreatorRuntime()
  if (studio === null || studio === undefined || state === undefined) return null
  const mutationReason = projectionMutationReason(snapshot, runtime)
  return createElement('div', { className: 'dv-owner-stack', 'data-creator-studio': true },
    createElement('style', null, creatorStudioStyles),
    createElement(CreatorReviewList, { snapshot: studio }),
    createElement(SurfaceSection, {
      className: 'cs-section',
      title: 'Artifact preview and compare',
      description: 'Artifact and version keys remain independent for every review target.',
      meta: createElement('span', { className: 'cs-badge' }, studio.reviews.filter(review => review.artifact !== undefined).length),
    },
    studio.reviews.filter(review => review.artifact !== undefined).map(review => createElement('div', { className: 'ys-row', key: `${review.ref}:${review.artifact!.version}` },
      createElement('span', { className: 'ys-row-main' }, createElement('strong', null, review.title), createElement('small', null, `${review.artifact!.ref}@${review.artifact!.version}`)),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => model.openArtifact(review.artifact!) }, 'Open'),
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => model.openArtifact(review.artifact!, true) }, 'Compare'),
    )),
    ),
    studio.approvals === undefined ? null : createElement(SurfaceSection, {
      className: 'cs-section', title: 'Owner approvals', description: studio.operations?.safeMessage ?? 'Approval projection', meta: createElement('span', { className: 'cs-badge' }, studio.approvals.length),
    }, studio.approvals.length === 0
      ? createElement(SurfaceState, { phase: 'empty', title: 'No pending approvals' })
      : createElement('ul', { className: 'cs-list ys-list' }, studio.approvals.map(approval => createElement('li', { key: approval.ref },
        createElement('span', { className: 'ys-row-main' }, createElement('strong', null, approval.title), createElement('small', null, `${approval.targetRef}@${approval.targetVersion}`)),
        createElement(Button, {
          type: 'button', size: 'sm', variant: 'toolbar', disabled: mutationReason !== undefined || approval.status !== 'pending' || Date.parse(approval.expiresAt) <= Date.now() || state.pendingApprovalRef !== null,
          title: mutationReason,
          onClick: () => { if (runtime?.mode === 'shared') void runtime.decideApproval(approval.ref) },
        }, state.pendingApprovalRef === approval.ref ? 'Submitting…' : 'Approve'),
      ))),
    ),
    mutationReason === undefined ? null : createElement('p', { className: 'dv-alert', role: 'status' }, mutationReason),
  )
}

function OperationalPaneBody({ view, snapshot, model }: { readonly view: DramaPaneId; readonly snapshot: DramaClientUiSnapshotV1; readonly model: DramaViewModel }): ReactNode {
  const stateProjection = createElement(CreatorProjectionState, { state: snapshot.creator, mode: snapshot.creatorMode })
  const operational = view === 'Context'
    ? createElement(ContextOperationalProjection, { snapshot })
    : view === 'Story'
      ? createElement(OwnerOperationalProjection, { owners: [{ owner: 'auctra', task: 'text' }], snapshot, model })
      : view === 'Visual'
        ? createElement(OwnerOperationalProjection, { owners: [{ owner: 'eikona', task: 'image' }, { owner: 'scaena', task: 'video' }], snapshot, model })
        : view === 'Audio'
          ? createElement(OwnerOperationalProjection, { owners: [{ owner: 'sonora', task: 'audio' }], snapshot, model })
          : view === 'Run'
            ? createElement(RunOperationalProjection, { snapshot })
            : createElement(ReviewOperationalProjection, { snapshot, model })
  return createElement('div', { className: 'ys-body dv-owner-stack', key: snapshot.projectionIdentity },
    view === 'Context' ? createElement(ContextRows, { context: snapshot.context }) : null,
    stateProjection,
    operational,
    snapshot.lastLaunch === undefined ? null : createElement(LaunchRow, { launch: snapshot.lastLaunch }),
  )
}

function DramaViewShell(props: {
  readonly view: DramaPaneId
  readonly model: DramaViewModel
}): ReactNode {
  const { view, model } = props
  const snapshot = useSyncExternalStore(model.subscribe, model.getSnapshot)
  const availability = model.getAvailability(view)
  const freshness = snapshot.context.context?.freshness
  const keymap = model.getKeymap()

  const onKeyDown = (event: {
    readonly key: string
    readonly ctrlKey: boolean
    readonly metaKey: boolean
    readonly altKey: boolean
    readonly shiftKey: boolean
    preventDefault(): void
  }): void => {
    const action = keymap.resolveViewKey(toCommandKeyEvent(event))
    if (action.type === 'unhandled') return
    event.preventDefault()
    model.handleViewKey(view, action)
  }

  const commands = model.getCommands()
  const reviewEntry = commands.find(entry => entry.id === 'drama.review')
  const handoffEntry = commands.find(entry => entry.id === 'drama.handoff')

  return createElement(Surface, {
    kind: 'workspace',
    'data-drama-view': view,
    tabIndex: 0,
    onKeyDown,
    'aria-label': `Drama ${view}`,
  },
  createElement('style', { 'data-drama-view-styles': true }, DRAMA_STYLES),
  createElement(SurfaceContextBar, {
    title: `Drama ${view}`,
    status: createElement('div', null,
      freshness === undefined ? null : createElement('span', { className: 'dv-badge', 'data-freshness': freshness }, freshness),
      keymap.conflicts.length > 0
        ? createElement('span', { className: 'dv-badge', title: keymap.conflicts[0]?.reason }, 'key conflict')
        : null,
    ),
  }),
  availability.disabled
    ? createElement('div', { className: 'ys-body' }, createElement(SurfaceState, {
      phase: 'disabled',
      title: `Drama ${view} unavailable`,
      description: availability.reason,
    }))
    : createElement(OperationalPaneBody, { view, snapshot, model }),
  snapshot.lastMessage === undefined
    ? null
    : createElement('div', { className: 'ys-body dv-message', role: 'status' }, snapshot.lastMessage),
  createElement(SurfaceActionBar, null,
    createElement(Button, {
      type: 'button',
      size: 'sm',
      variant: 'toolbar',
      disabled: snapshot.creator?.phase === 'loading',
      onClick: () => { void model.refreshCreator() },
    }, snapshot.creatorMode === 'legacy-readonly' ? 'Refresh read-only projection' : 'Refresh projection'),
    createElement(Button, {
      type: 'button',
      size: 'sm',
      variant: 'toolbar',
      onClick: () => { void model.reconcile() },
    }, 'Reconcile'),
    view === 'Review'
      ? createElement(Button, {
        type: 'button',
        disabled: reviewEntry?.disabled !== false,
        title: reviewEntry?.disabled ? reviewEntry.reason : 'Submit the focused review decision',
        onClick: () => model.runCommand('drama.review'),
      }, 'Complete review')
      : null,
    createElement(Button, {
      type: 'button',
      disabled: handoffEntry?.disabled !== false,
      title: handoffEntry?.disabled ? handoffEntry.reason : 'Open in Workbench',
      onClick: () => model.runCommand('drama.handoff'),
    }, 'Open in Workbench'),
  ))
}

/** Builds the componentKey → factory map handed to pane.registerView(). */
export function createDramaViewFactories(
  model: DramaViewModel,
): Readonly<Record<string, (props?: unknown) => ReactNode>> {
  return Object.fromEntries(DRAMA_VIEW_REGISTRATIONS.map(({ id, descriptor }) => {
    const factory = (): ReactNode => createElement(DramaViewShell, { view: id, model })
    return [descriptor.componentKey, factory] as const
  }))
}

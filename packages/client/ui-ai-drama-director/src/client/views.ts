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
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'
import type { DramaContextSnapshotV1 } from './context.js'
import type { DramaKeymap, DramaViewKeyAction } from './keymap.js'
import { toCommandKeyEvent } from './keymap.js'
import type { DramaAvailabilityV1 } from './probe.js'
import { DRAMA_VIEW_KINDS } from './preset.js'
import type { WorkbenchLaunchActivationV1 } from './launch-adapter.js'

/** Versioned UI snapshot; identity changes on every model update. */
export interface DramaClientUiSnapshotV1 {
  readonly context: DramaContextSnapshotV1
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
    : createElement('div', { className: 'ys-body' },
      view === 'Context' ? createElement(ContextRows, { context: snapshot.context }) : null,
      snapshot.lastLaunch === undefined ? null : createElement(LaunchRow, { launch: snapshot.lastLaunch }),
      view !== 'Context' && snapshot.context.context === undefined
        ? createElement('div', { className: 'dv-row' },
          createElement('span', { className: 'dv-val' }, snapshot.context.reason))
        : null,
    ),
  snapshot.lastMessage === undefined
    ? null
    : createElement('div', { className: 'ys-body dv-message', role: 'status' }, snapshot.lastMessage),
  createElement(SurfaceActionBar, null,
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

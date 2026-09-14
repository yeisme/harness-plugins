/**
 * Session-header pipeline capsule slot (real-render wave).
 *
 * Mounts the Agent ⇄ Workbench capsule (`WorkSurfaceCapsule`) into the
 * official conversation session header actions slot
 * (`conversation.session.header.actions`, declared by
 * `@deepseek-ai/dsh-client-ui-conversation`), so the capsule exists on the
 * real DSH host chrome instead of only inside the pipeline pane.
 *
 * Probe-first, fail-closed:
 * - the slots service AND the slot declaration must both probe; otherwise the
 *   capsule is never registered (no dead surface) and the handle records the
 *   bounded reason for debug;
 * - the capsule projection source resolves in order: the real
 *   `remote.creativePipeline` owner gateway, then the explicitly provided
 *   `creativePipelineFixture` service (fixture evidence tier), then a minimal
 *   static capsule (surface workbench, no run state, explicit placeholder
 *   text) so the surface-switch entry stays available while the pipeline
 *   pane itself reports its own disabled reason — no fabricated run or
 *   review state;
 * - every rendered capsule — owner, fixture, or static — passes
 *   `decodeWorkSurfaceCapsuleV1`; a contract violation renders nothing and
 *   records the decode reason.
 *
 * Switch semantics: `workbench` opens/focuses the singleton
 * `creator.pipeline` pane through the Pane Workbench face. `agent` is local
 * surface state only: this pack has no Agent pane (the six Director panes
 * are Context/Review/Run/Story/Visual/Audio), and the capsule is rendered
 * inside the session header — the conversation IS the Agent surface — so no
 * navigation is fabricated for it. When the Pane Workbench face is missing
 * the switch renders as a disabled control with the probe reason.
 *
 * @module @yeisme/dsh-client-ui-ai-drama-director/client/capsule-slot
 */

import { createElement, useEffect, useState, type ReactNode } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import {
  decodeWorkSurfaceCapsuleV1,
  type CreativeWorkSurfaceKindV1,
  type WorkSurfaceCapsuleV1,
} from '@yeisme/dsh-plugin-contracts'
import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'
import { WorkSurfaceCapsule } from './pipeline/capsule.js'
import { PIPELINE_FIXTURE_OWNER_SERVICE } from './pipeline/fixture-owner.js'
import { PIPELINE_WORKBENCH_PANE_KIND } from './pipeline/workbench-pane.js'
import type { DramaPaneWorkbenchFace } from './probe.js'

/** Official session header actions slot (dsh-client-ui-conversation SlotMap). */
export const PIPELINE_CAPSULE_SLOT = 'conversation.session.header.actions' as const
/** This pack's entry id inside the slot. */
export const PIPELINE_CAPSULE_SLOT_ENTRY_ID = 'drama.pipeline.capsule' as const
/** List order among header action entries (existing entries use 20/32/34). */
export const PIPELINE_CAPSULE_SLOT_ORDER = 36 as const

export const PIPELINE_CAPSULE_REASONS = {
  slots: 'slots service is unavailable; the pipeline capsule stays out of the session header',
  declaration: 'conversation session header actions slot is not declared by this host; the pipeline capsule stays unregistered',
  rejected: 'the host rejected the pipeline capsule slot registration; the capsule stays unregistered',
  pane: 'Pane Workbench face is unavailable; surface switching stays disabled',
  source: 'missing creative-pipeline owner projection; the capsule renders without run state',
  staticDecode: 'the static capsule failed the contract decoder; the capsule is not rendered',
  readFailed: 'pipeline owner projection read failed; the capsule is not rendered',
} as const

/** Structural view of the slots service face used by this module. */
interface SlotsFace {
  inject(name: string, setup: () => () => void): () => void
  register(input: Record<string, unknown>, component: (props: never) => ReactNode): () => void
  spec?(name: string): unknown
}

/** Minimal projection source: anything with a snapshot lane (owner or fixture). */
export interface PipelineCapsuleSourceV1 {
  snapshot(): Promise<unknown>
}

export type PipelineCapsuleSourceKind = 'remote' | 'fixture'

export interface PipelineCapsuleSlotDeps {
  /** Pane Workbench face used for the workbench switch; absence disables switching with a reason. */
  readonly pane?: DramaPaneWorkbenchFace
}

export type PipelineCapsuleSlotPhase = 'loading' | 'remote' | 'fixture' | 'static' | 'unavailable'

export interface PipelineCapsuleSlotSnapshotV1 {
  /** True once the slot contribution was claimed on the host. */
  readonly registered: boolean
  readonly phase: PipelineCapsuleSlotPhase
  /** Bounded debug reason for unavailable/static phases and registration skips. */
  readonly reason?: string
}

export interface PipelineCapsuleSlotHandle {
  snapshot(): PipelineCapsuleSlotSnapshotV1
  /** Idempotent: reverts the slot claim; later calls are no-ops. */
  dispose(): void
}

/** Scoped capsule chrome for the header seat; tokens come from buildPanelStyles. */
export const pipelineCapsuleSlotStyles = buildPanelStyles({
  scope: 'pipeline-capsule-slot',
  extra: `
[data-pipeline-capsule-slot]{display:inline-flex;align-items:center;background:transparent}
[data-pipeline-capsule-slot] .plw-capsule{display:flex;align-items:center;gap:var(--vk-gap-sm);min-height:34px;padding:2px 6px;background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg)}
[data-pipeline-capsule-slot] .plw-capsule-segments{display:flex;align-items:center;gap:2px}
[data-pipeline-capsule-slot] .plw-capsule-segment{min-height:28px;padding:0 10px;color:var(--vk-text-secondary);background:transparent;border:1px solid transparent;border-radius:var(--vk-radius-md);cursor:pointer;font-size:var(--vk-font-small)}
[data-pipeline-capsule-slot] .plw-capsule-segment:hover{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
[data-pipeline-capsule-slot] .plw-capsule-segment[data-active='true']{color:var(--vk-text-primary);background:color-mix(in srgb,var(--vk-accent) 18%,transparent);border-color:color-mix(in srgb,var(--vk-accent) 50%,var(--vk-border-l2))}
[data-pipeline-capsule-slot] .plw-capsule-divider{color:var(--vk-text-quaternary);font-size:var(--vk-font-small)}
[data-pipeline-capsule-slot] .plw-capsule-dot{width:7px;height:7px;border-radius:50%;background:var(--vk-tone-warn)}
[data-pipeline-capsule-slot] .plw-capsule-badge{padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--vk-tone-warn) 16%,transparent);color:var(--vk-tone-warn);font-size:10px;white-space:nowrap}
[data-pipeline-capsule-slot] .plw-capsule-run{display:inline-flex;align-items:center;gap:var(--vk-gap-xs);font-size:var(--vk-font-small);color:var(--vk-text-secondary);white-space:nowrap}
[data-pipeline-capsule-slot] .plw-capsule-menu-trigger{display:grid;place-items:center;min-width:24px;min-height:24px;padding:0;color:var(--vk-text-tertiary);background:transparent;border:0;border-radius:var(--vk-radius-sm);cursor:pointer}
[data-pipeline-capsule-slot] .plw-capsule-menu-trigger:hover{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
[data-pipeline-capsule-slot] .plw-capsule-switch-disabled{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;color:var(--vk-text-tertiary);background:transparent;border:1px dashed var(--vk-border-l2);border-radius:var(--vk-radius-md);font-size:var(--vk-font-small);cursor:default}
@media(pointer:coarse){[data-pipeline-capsule-slot] .plw-capsule-segment,[data-pipeline-capsule-slot] .plw-capsule-menu-trigger,[data-pipeline-capsule-slot] .plw-capsule-switch-disabled{min-height:var(--vk-ctrl-touch);min-width:var(--vk-ctrl-touch)}}
`,
})

type ContextReader = Pick<ClientContext, 'get'>

function readContextService<T>(ctx: ContextReader, name: string): T | undefined {
  try {
    return ctx.get(name as never) as T | undefined
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isCapsuleSource(value: unknown): value is PipelineCapsuleSourceV1 {
  return isRecord(value) && typeof value.snapshot === 'function'
}

function probeSlots(ctx: ContextReader): SlotsFace | undefined {
  const face = readContextService<unknown>(ctx, 'slots')
  if (!isRecord(face) || typeof face.inject !== 'function' || typeof face.register !== 'function') return undefined
  return face as unknown as SlotsFace
}

/** Declaration gate: no declared header-actions slot, no registration attempt. */
export function pipelineCapsuleSlotDeclared(slots: SlotsFace): boolean {
  if (typeof slots.spec !== 'function') return false
  try {
    return slots.spec(PIPELINE_CAPSULE_SLOT) !== undefined
  } catch {
    return false
  }
}

/**
 * Capsule projection source probe: real owner gateway first, then the
 * explicitly named fixture service. Missing both → the static capsule tier.
 */
export function resolvePipelineCapsuleSource(
  ctx: ContextReader,
): { readonly source: PipelineCapsuleSourceV1; readonly kind: PipelineCapsuleSourceKind } | undefined {
  const remote = readContextService<unknown>(ctx, 'remote')
  // Guarded member read: the typed remote can guard namespace properties
  // behind the caller's service inject; guarded reads degrade, never throw.
  let member: unknown
  try {
    member = isRecord(remote) ? (remote as Record<string, unknown>).creativePipeline : undefined
  } catch {
    member = undefined
  }
  if (isCapsuleSource(member)) return { source: member, kind: 'remote' }
  const direct = readContextService<unknown>(ctx, 'remote.creativePipeline')
  if (isCapsuleSource(direct)) return { source: direct, kind: 'remote' }
  const fixture = readContextService<unknown>(ctx, PIPELINE_FIXTURE_OWNER_SERVICE)
  if (isCapsuleSource(fixture)) return { source: fixture, kind: 'fixture' }
  return undefined
}

/** Open/focus request for the singleton pipeline workbench pane. */
export function buildPipelineCapsuleOpenRequest(): Record<string, unknown> {
  return {
    kind: PIPELINE_WORKBENCH_PANE_KIND,
    resourceKey: 'creator:pipeline',
    viewId: 'creator:pipeline',
    role: 'content',
    preferredRegion: 'right',
    retention: 'keep-alive',
    singleton: true,
    pinned: true,
    title: 'Pipeline',
  }
}

function staticCapsuleRaw(): unknown {
  return {
    contract_version: 'dsh.creative-pipeline.v1',
    project_ref: 'project:none',
    surface: 'workbench',
    unsaved_draft: false,
    pending_review: false,
    menu: {
      project: { text: 'No pipeline projection', truncated: false },
      surface: 'workbench',
      work_context: { text: 'No pipeline projection', truncated: false },
      run_state: 'unknown',
      next_action: { text: 'Open the pipeline workbench for details', truncated: false },
    },
  }
}

/**
 * Minimal static capsule for the no-source tier. Built as raw data and passed
 * through the same fail-closed decoder as owner projections; returns undefined
 * when the contract ever rejects it.
 */
export function minimalPipelineCapsule(): WorkSurfaceCapsuleV1 | undefined {
  const decoded = decodeWorkSurfaceCapsuleV1(staticCapsuleRaw())
  return decoded.ok ? decoded.value : undefined
}

type CapsuleDecodeResult =
  | { readonly ok: true; readonly value: WorkSurfaceCapsuleV1 }
  | { readonly ok: false; readonly reason: string }

/** Fail-closed envelope capsule decode: any violation rejects the whole capsule. */
export function decodePipelineCapsuleProjection(input: unknown): CapsuleDecodeResult {
  if (!isRecord(input)) return { ok: false, reason: 'pipeline snapshot must be an object' }
  const decoded = decodeWorkSurfaceCapsuleV1(input.capsule)
  if (!decoded.ok) return { ok: false, reason: `${decoded.code}: ${decoded.reason}` }
  return { ok: true, value: decoded.value }
}

interface CapsuleEntryInput {
  readonly pane?: DramaPaneWorkbenchFace
  readonly source?: PipelineCapsuleSourceV1
  readonly sourceKind?: PipelineCapsuleSourceKind
  readonly report: (next: { readonly phase: PipelineCapsuleSlotPhase; readonly reason?: string }) => void
}

/** Builds the slot entry component. Deps are fixed for the component's lifetime. */
function createCapsuleSlotEntry(input: CapsuleEntryInput): (props: never) => ReactNode {
  const { pane, source, sourceKind, report } = input
  return function PipelineCapsuleSlotEntry(): ReactNode {
    const [loaded, setLoaded] = useState<WorkSurfaceCapsuleV1 | undefined>(undefined)
    const [failure, setFailure] = useState<string | undefined>(undefined)
    const [surfaceOverride, setSurfaceOverride] = useState<CreativeWorkSurfaceKindV1 | undefined>(undefined)

    useEffect(() => {
      let active = true
      if (source === undefined) {
        const capsule = minimalPipelineCapsule()
        if (capsule === undefined) {
          setFailure(PIPELINE_CAPSULE_REASONS.staticDecode)
          report({ phase: 'unavailable', reason: PIPELINE_CAPSULE_REASONS.staticDecode })
        } else {
          setLoaded(capsule)
          report({ phase: 'static', reason: PIPELINE_CAPSULE_REASONS.source })
        }
        return () => { active = false }
      }
      void source.snapshot().then(raw => {
        if (!active) return
        const decoded = decodePipelineCapsuleProjection(raw)
        if (!decoded.ok) {
          setFailure(decoded.reason)
          report({ phase: 'unavailable', reason: decoded.reason })
          return
        }
        setLoaded(decoded.value)
        report({ phase: sourceKind ?? 'remote' })
      }).catch(() => {
        if (!active) return
        setFailure(PIPELINE_CAPSULE_REASONS.readFailed)
        report({ phase: 'unavailable', reason: PIPELINE_CAPSULE_REASONS.readFailed })
      })
      return () => { active = false }
    }, [])

    if (failure !== undefined || loaded === undefined) {
      // Loading or fail-closed: render nothing rather than a dead surface.
      return null
    }

    const capsule: WorkSurfaceCapsuleV1 = surfaceOverride === undefined || surfaceOverride === loaded.surface
      ? loaded
      : { ...loaded, surface: surfaceOverride, menu: { ...loaded.menu, surface: surfaceOverride } }

    const onSwitchSurface = (surface: CreativeWorkSurfaceKindV1): void => {
      if (pane === undefined) return
      setSurfaceOverride(surface)
      if (surface === 'workbench') pane.openView(buildPipelineCapsuleOpenRequest())
      // 'agent': no Agent pane exists in this pack and the capsule already
      // renders inside the session (Agent surface) header, so the switch is
      // local surface state only — no navigation is fabricated.
    }

    return createElement(
      'span',
      { 'data-pipeline-capsule-slot': '' },
      createElement('style', null, pipelineCapsuleSlotStyles),
      pane === undefined
        ? createElement('button', {
          type: 'button',
          className: 'plw-capsule-switch-disabled',
          disabled: true,
          'aria-disabled': true,
          title: PIPELINE_CAPSULE_REASONS.pane,
        }, 'Agent ⇄ Workbench')
        : createElement(WorkSurfaceCapsule, { capsule, onSwitchSurface }),
    )
  }
}

/**
 * Registers the pipeline capsule into the official session header actions
 * slot. Never throws: missing seams skip registration with a recorded reason,
 * and the returned disposer is exact and idempotent.
 */
export function registerPipelineCapsuleSlot(
  ctx: ContextReader,
  deps: PipelineCapsuleSlotDeps = {},
): PipelineCapsuleSlotHandle {
  let state: PipelineCapsuleSlotSnapshotV1 = { registered: false, phase: 'loading' }
  let disposed = false
  const report = (next: { readonly phase: PipelineCapsuleSlotPhase; readonly reason?: string }): void => {
    state = {
      registered: state.registered,
      phase: next.phase,
      ...(next.reason === undefined ? {} : { reason: next.reason }),
    }
  }

  const slots = probeSlots(ctx)
  if (slots === undefined) {
    state = { registered: false, phase: 'unavailable', reason: PIPELINE_CAPSULE_REASONS.slots }
    return { snapshot: () => state, dispose: () => {} }
  }
  if (!pipelineCapsuleSlotDeclared(slots)) {
    state = { registered: false, phase: 'unavailable', reason: PIPELINE_CAPSULE_REASONS.declaration }
    return { snapshot: () => state, dispose: () => {} }
  }

  const resolved = resolvePipelineCapsuleSource(ctx)
  const entry = createCapsuleSlotEntry({
    ...(deps.pane === undefined ? {} : { pane: deps.pane }),
    ...(resolved === undefined ? {} : { source: resolved.source, sourceKind: resolved.kind }),
    report,
  })

  let unclaim: () => void = () => {}
  try {
    unclaim = slots.inject(PIPELINE_CAPSULE_SLOT, () => slots.register(
      { name: PIPELINE_CAPSULE_SLOT, id: PIPELINE_CAPSULE_SLOT_ENTRY_ID, order: PIPELINE_CAPSULE_SLOT_ORDER },
      entry,
    ))
    state = { ...state, registered: true }
  } catch {
    state = { registered: false, phase: 'unavailable', reason: PIPELINE_CAPSULE_REASONS.rejected }
  }

  return {
    snapshot: () => state,
    dispose: () => {
      if (disposed) return
      disposed = true
      try {
        unclaim()
      } catch {
        /* teardown continues across host rejection */
      }
    },
  }
}

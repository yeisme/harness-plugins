/**
 * Real capability probe composition for the Drama Director client.
 *
 * Probes the Pane Workbench injection face, the Creator Studio projection
 * transport, the drama host transport, and the command-experience slash
 * directory. Every missing dependency maps to concrete view/command disables
 * with a standard reason; nothing is hard-coded and nothing fakes a host.
 *
 * The upstream command-experience router seam is an enhancement probe only:
 * it never gates registration.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { isReservedSlashName } from '@yeisme/dsh-client-ui-command-experience-core'
import type { DramaPaneId } from '@yeisme/dsh-ai-drama-director'

/** Minimal Pane Workbench client face consumed by this plugin. */
export interface DramaPaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
  registerCommand?(input: unknown): () => void
  executeCommand?(id: string): Promise<unknown>
  readonly views?: {
    snapshot(): readonly unknown[]
    subscribe(listener: () => void): () => void
    has?(kind: string): boolean
  }
  readonly commands?: {
    snapshot(): readonly { readonly descriptor: { readonly id: string } }[]
    subscribe(listener: () => void): () => void
  }
  readonly controller?: {
    dispatch(intent: unknown): unknown
  }
}

/** Drama host transport: the only channel that returns DramaContextV1. */
export interface DramaHostTransport {
  snapshot(): Promise<unknown>
  dispatch?(request: unknown): Promise<unknown>
  requestHandoff?(input: unknown): Promise<unknown>
  /** Host-approved Workbench V2 bridge launch channel (additive, optional). */
  requestBridgeLaunch?(input: unknown): Promise<unknown>
}

/** Creator Studio projection transport (read-only snapshot lane). */
export interface CreatorStudioProjectionTransport {
  snapshot(): Promise<unknown>
}

/** command-experience live slash directory face (`slashDirectory`). */
export interface DramaSlashDirectoryFace {
  snapshot(): unknown
  subscribe(listener: () => void): () => void
}

export type DramaDependency = 'paneWorkbench' | 'creatorStudio' | 'dramaHost'

export interface DramaProbeEntryV1 {
  readonly available: boolean
  readonly reason: string
}

export interface DramaCapabilityProbeResultV1 {
  /** True only when paneWorkbench + creatorStudio + dramaHost all probe. */
  readonly available: boolean
  readonly paneWorkbench: DramaProbeEntryV1
  readonly creatorStudio: DramaProbeEntryV1
  readonly dramaHost: DramaProbeEntryV1
  readonly commandExperience: DramaProbeEntryV1
  /** Enhancement-only upstream seam probe; never a registration gate. */
  readonly commandRouter: DramaProbeEntryV1
  /** Self-check: contributed slash names that collide with reserved P0 names. */
  readonly slashConflicts: readonly string[]
}

export interface DramaProbeResolution {
  readonly probe: DramaCapabilityProbeResultV1
  readonly pane?: DramaPaneWorkbenchFace
  readonly creatorStudio?: CreatorStudioProjectionTransport
  readonly dramaHost?: DramaHostTransport
  readonly slashDirectory?: DramaSlashDirectoryFace
}

export const DRAMA_PROBE_REASONS = {
  paneWorkbench: 'Pane Workbench face is unavailable; drama views and commands stay disabled',
  creatorStudio: 'missing creator-studio projection',
  dramaHost: 'missing drama owner projection',
  commandExperience: 'command-experience slash directory is unavailable; /drama stays out of the / menu',
  commandRouter: 'upstream command-experience router seam is unavailable; enhancement projection skipped',
  ready: 'drama capability is ready',
} as const

/**
 * Declared view → dependency map. Review/Run/Story/Visual/Audio render
 * studio-backed projections; Context reads the drama owner projection.
 */
export const DRAMA_VIEW_DEPENDENCIES: Readonly<Record<DramaPaneId, readonly DramaDependency[]>> = {
  Context: ['dramaHost'],
  Review: ['dramaHost', 'creatorStudio'],
  Run: ['dramaHost', 'creatorStudio'],
  Story: ['creatorStudio'],
  Visual: ['creatorStudio'],
  Audio: ['creatorStudio'],
}

export interface DramaAvailabilityV1 {
  readonly disabled: boolean
  readonly reason?: string
}

function dependencyAvailability(
  probe: DramaCapabilityProbeResultV1,
  dependencies: readonly DramaDependency[],
): DramaAvailabilityV1 {
  for (const dependency of dependencies) {
    const entry = probe[dependency]
    if (!entry.available) return { disabled: true, reason: entry.reason }
  }
  return { disabled: false }
}

/** Per-view disabled state derived from the probe; missing pane disables all. */
export function dramaViewAvailability(
  probe: DramaCapabilityProbeResultV1,
  view: DramaPaneId,
): DramaAvailabilityV1 {
  if (!probe.paneWorkbench.available) return { disabled: true, reason: probe.paneWorkbench.reason }
  return dependencyAvailability(probe, DRAMA_VIEW_DEPENDENCIES[view])
}

export const DRAMA_COMMAND_DEPENDENCIES: Readonly<Record<string, readonly DramaDependency[]>> = {
  drama: [],
  'drama.help': [],
  'drama.open': [],
  'drama.new': ['dramaHost'],
  'drama.plan': ['dramaHost'],
  'drama.evidence': ['dramaHost'],
  'drama.generate': ['dramaHost'],
  'drama.review': ['dramaHost', 'creatorStudio'],
  'drama.repair': ['dramaHost'],
  'drama.handoff': ['dramaHost'],
}

/** Per-command disabled state; command-experience absence gates the / menu only. */
export function dramaCommandAvailability(
  probe: DramaCapabilityProbeResultV1,
  commandId: string,
): DramaAvailabilityV1 {
  if (!probe.paneWorkbench.available) return { disabled: true, reason: probe.paneWorkbench.reason }
  const dependencies = DRAMA_COMMAND_DEPENDENCIES[commandId]
  if (dependencies === undefined) return { disabled: true, reason: 'unknown drama command' }
  return dependencyAvailability(probe, dependencies)
}

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

function isPaneWorkbenchFace(value: unknown): value is DramaPaneWorkbenchFace {
  return isRecord(value)
    && typeof value.registerView === 'function'
    && typeof value.openView === 'function'
}

function isDramaHostTransport(value: unknown): value is DramaHostTransport {
  return isRecord(value) && typeof value.snapshot === 'function'
}

function isProjectionTransport(value: unknown): value is CreatorStudioProjectionTransport {
  return isRecord(value) && typeof value.snapshot === 'function'
}

function isSlashDirectory(value: unknown): value is DramaSlashDirectoryFace {
  return isRecord(value) && typeof value.snapshot === 'function' && typeof value.subscribe === 'function'
}

function resolveRemoteMember(ctx: ContextReader, name: string): unknown {
  const direct = readContextService<unknown>(ctx, `remote.${name}`)
  if (direct !== undefined) return direct
  const remote = readContextService<unknown>(ctx, 'remote')
  if (isRecord(remote)) return remote[name]
  return undefined
}

/** Slash names this client contributes; reserved P0 collisions stay disabled. */
export const DRAMA_SLASH_CONTRIBUTIONS = {
  name: 'drama',
  aliases: ['director'],
} as const

function probeSlashConflicts(): readonly string[] {
  const conflicts: string[] = []
  if (isReservedSlashName(DRAMA_SLASH_CONTRIBUTIONS.name)) conflicts.push(DRAMA_SLASH_CONTRIBUTIONS.name)
  for (const alias of DRAMA_SLASH_CONTRIBUTIONS.aliases) {
    if (isReservedSlashName(alias)) conflicts.push(alias)
  }
  return conflicts
}

/**
 * Composes the real probe. Never throws; a missing face yields a disabled
 * entry with a reason instead of an error.
 */
export async function probeDramaCapability(ctx: ContextReader): Promise<DramaProbeResolution> {
  const pane = readContextService<unknown>(ctx, 'paneWorkbench')
  const paneOk = isPaneWorkbenchFace(pane)

  const creatorCandidate = resolveRemoteMember(ctx, 'creatorStudio')
  const creatorOk = isProjectionTransport(creatorCandidate)

  const dramaCandidate = resolveRemoteMember(ctx, 'dramaDirector')
  const dramaOk = isDramaHostTransport(dramaCandidate)

  const slash = readContextService<unknown>(ctx, 'slashDirectory')
  const slashOk = isSlashDirectory(slash)

  // Enhancement-only: the upstream router seam is still exploration-stage.
  const router = readContextService<unknown>(ctx, 'commandExperienceRouter')
  const routerOk = isRecord(router)

  const probe: DramaCapabilityProbeResultV1 = {
    available: paneOk && creatorOk && dramaOk,
    paneWorkbench: {
      available: paneOk,
      reason: paneOk ? 'pane workbench face is available' : DRAMA_PROBE_REASONS.paneWorkbench,
    },
    creatorStudio: {
      available: creatorOk,
      reason: creatorOk ? 'creator-studio projection transport is available' : DRAMA_PROBE_REASONS.creatorStudio,
    },
    dramaHost: {
      available: dramaOk,
      reason: dramaOk ? 'drama host transport is available' : DRAMA_PROBE_REASONS.dramaHost,
    },
    commandExperience: {
      available: slashOk,
      reason: slashOk ? 'command-experience slash directory is available' : DRAMA_PROBE_REASONS.commandExperience,
    },
    commandRouter: {
      available: routerOk,
      reason: routerOk ? 'command-experience router seam is available' : DRAMA_PROBE_REASONS.commandRouter,
    },
    slashConflicts: probeSlashConflicts(),
  }

  return {
    probe,
    ...(paneOk ? { pane: pane as DramaPaneWorkbenchFace } : {}),
    ...(creatorOk ? { creatorStudio: creatorCandidate as CreatorStudioProjectionTransport } : {}),
    ...(dramaOk ? { dramaHost: dramaCandidate as DramaHostTransport } : {}),
    ...(slashOk ? { slashDirectory: slash as DramaSlashDirectoryFace } : {}),
  }
}

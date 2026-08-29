/**
 * Director preset application and persistence receipt handling.
 *
 * Applying the preset is a local, atomic layout commit: the three
 * first-support views open as an ordered tab set (Context active) in a
 * single region. Tier 0 collapse is the overlay host's render-layer concern;
 * this module never fabricates regions or splits. Secondary views
 * (Story/Visual/Audio) stay on-demand.
 *
 * Persistence is decoupled from application: saving a variant goes through
 * the preset service and honors ok/rejected/permission_denied receipts. A
 * denied write disables the save entry with the owner reason but never
 * blocks or rolls back the applied layout.
 */

import {
  DRAMA_FIRST_SUPPORT_PANES,
  DRAMA_SECONDARY_PANES,
  type DramaPaneId,
} from '@yeisme/dsh-ai-drama-director'
import type { DramaPaneWorkbenchFace } from './probe.js'

/** Drama view kinds registered into the Pane Workbench registry. */
export const DRAMA_VIEW_KINDS: Readonly<Record<DramaPaneId, string>> = {
  Context: 'drama.context',
  Story: 'drama.story',
  Visual: 'drama.visual',
  Audio: 'drama.audio',
  Run: 'drama.run',
  Review: 'drama.review',
}

/** Default visible tab budget for the Director preset (V2 visible cap). */
export const DRAMA_DEFAULT_VISIBLE_TAB_LIMIT = 4

export interface DramaViewOpenRequestV1 {
  readonly kind: string
  readonly resourceKey: string
  readonly viewId: string
  readonly role: 'content'
  readonly preferredRegion: 'right'
  readonly retention: 'keep-alive'
  readonly singleton: true
  readonly pinned: true
  readonly title: string
}

/**
 * Stable view ids and resource keys make re-application idempotent: the
 * workbench reducer reuses the existing tab and only re-activates it.
 */
export function buildDramaViewOpenRequest(id: DramaPaneId): DramaViewOpenRequestV1 {
  const kind = DRAMA_VIEW_KINDS[id]
  return {
    kind,
    resourceKey: `drama:${id.toLowerCase()}`,
    viewId: `drama:${id.toLowerCase()}`,
    role: 'content',
    preferredRegion: 'right',
    retention: 'keep-alive',
    singleton: true,
    pinned: true,
    title: id,
  }
}

export interface DramaPresetApplyResultV1 {
  readonly applied: readonly DramaPaneId[]
  readonly active: DramaPaneId
  readonly collapsed: 'single-region-tabs'
}

/**
 * Applies the default Director preset: Context/Review/Run become the ordered
 * tab set of one group (no region fabrication), with Context re-activated at
 * the end so focus lands on it.
 */
export function applyDirectorPreset(pane: DramaPaneWorkbenchFace): DramaPresetApplyResultV1 {
  for (const id of DRAMA_FIRST_SUPPORT_PANES) {
    pane.openView(buildDramaViewOpenRequest(id))
  }
  // Re-opening the singleton Context tab only activates it (reducer reuse
  // path), landing focus on Context without duplicating the tab.
  pane.openView(buildDramaViewOpenRequest('Context'))
  return {
    applied: [...DRAMA_FIRST_SUPPORT_PANES],
    active: 'Context',
    collapsed: 'single-region-tabs',
  }
}

/** Secondary views open on demand only; the default preset never opens them. */
export function openDramaSecondaryView(pane: DramaPaneWorkbenchFace, id: (typeof DRAMA_SECONDARY_PANES)[number]): void {
  pane.openView(buildDramaViewOpenRequest(id))
}

export interface DramaPresetReceiptV1 {
  readonly status: 'ok' | 'rejected' | 'permission_denied'
  readonly action: 'create' | 'update' | 'delete' | 'reset'
  readonly id?: string
  readonly reason?: string
}

/** Structural preset service face (`PaneWorkspacePresetServiceV1` subset). */
export interface DramaPresetServiceLike {
  create(name: string, scope: string, draft: unknown): Promise<DramaPresetReceiptV1>
  update(id: string, draft: unknown): Promise<DramaPresetReceiptV1>
  delete(id: string): Promise<DramaPresetReceiptV1>
  reset(scope: string): Promise<DramaPresetReceiptV1>
}

export interface DramaPresetPersistResultV1 {
  readonly receipt?: DramaPresetReceiptV1
  /** True when the save entry must render disabled with `reason`. */
  readonly writeDisabled: boolean
  readonly reason?: string
}

export const DRAMA_PRESET_SERVICE_UNAVAILABLE = 'workspace preset service is unavailable'

/**
 * Saves a Director preset variant through the preset service. Receipts are
 * honored exactly: ok enables further writes; rejected/permission_denied
 * disable the write entry with the owner reason. The applied layout is
 * never touched here.
 */
export async function persistDirectorPresetVariant(
  service: DramaPresetServiceLike | undefined,
  input: { readonly name: string; readonly scope: string; readonly draft: unknown },
): Promise<DramaPresetPersistResultV1> {
  if (service === undefined) {
    return { writeDisabled: true, reason: DRAMA_PRESET_SERVICE_UNAVAILABLE }
  }
  let receipt: DramaPresetReceiptV1
  try {
    receipt = await service.create(input.name, input.scope, input.draft)
  } catch {
    return { writeDisabled: true, reason: 'preset write failed; no partial state was committed' }
  }
  if (receipt.status === 'ok') return { receipt, writeDisabled: false }
  return {
    receipt,
    writeDisabled: true,
    reason: receipt.reason ?? `preset write ${receipt.status}`,
  }
}

/** Probes the preset service face without requiring it. */
export function resolveDramaPresetService(
  get: (name: string) => unknown,
  pane: DramaPaneWorkbenchFace | undefined,
): DramaPresetServiceLike | undefined {
  const candidates: unknown[] = [
    (pane as { readonly presets?: unknown } | undefined)?.presets,
    (() => {
      try {
        return get('paneWorkspacePresets')
      } catch {
        return undefined
      }
    })(),
  ]
  for (const candidate of candidates) {
    if (candidate === null || typeof candidate !== 'object') continue
    const service = candidate as Partial<DramaPresetServiceLike>
    if (
      typeof service.create === 'function'
      && typeof service.update === 'function'
      && typeof service.delete === 'function'
      && typeof service.reset === 'function'
    ) {
      return service as DramaPresetServiceLike
    }
  }
  return undefined
}

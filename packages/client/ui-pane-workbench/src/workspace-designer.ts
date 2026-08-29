import type { PaneGroupV1, PaneRegionId, PaneWorkspaceV1 } from './workspace.js'
import {
  inspectWorkspaceApplyUx,
  restoreWorkspaceFromRollback,
  saveWorkspaceDraftWithUx,
  submitWorkspaceApply,
  type WorkspaceApplyReceiptV1,
  type WorkspaceApplyRollbackEntryV1,
  type WorkspaceApplyUxOptionsV1,
  type WorkspaceApplyUxV1,
} from './workspace-apply-ux.js'
import {
  createPaneWorkspaceDraft,
  serializePaneWorkspaceDraft,
  type PaneWorkspaceDraftScopeV1,
  type PaneWorkspaceDraftV1,
  type PaneWorkspaceMotionPreferenceV1,
  type PaneWorkspaceProviderPlacementV1,
} from './workspace-draft.js'

export const DESIGNER_HISTORY_LIMIT = 20

/**
 * Typical `registerPaneWorkbenchCoreViews` palette:
 * appear — `dsh.explorer`, `dsh.source-control`
 * hidden — `dsh.workspace-designer`, `dsh.tool-details`, `file.preview`
 * Capability-denied kinds never enter the registry snapshot.
 */
export interface DesignerPaletteRegistrationV1 {
  readonly descriptor: {
    readonly kind: string
    readonly label: string
    readonly role: PaneGroupV1['role']
    readonly preferredRegion: 'right' | 'bottom' | 'either'
    readonly singleton: boolean
  }
  readonly showInPicker?: boolean
}

export interface DesignerPaletteEntryV1 {
  readonly kind: string
  readonly label: string
  readonly region: PaneRegionId
  readonly role: PaneGroupV1['role']
  readonly singleton?: boolean
}

export function designerPaletteRegion(preferred: 'right' | 'bottom' | 'either'): PaneRegionId {
  return preferred === 'bottom' ? 'bottom' : 'right'
}

export function listDesignerPaletteEntries(
  registrations: readonly DesignerPaletteRegistrationV1[],
): readonly DesignerPaletteEntryV1[] {
  return registrations
    .filter(registration => registration.showInPicker !== false)
    .map(registration => ({
      kind: registration.descriptor.kind,
      label: registration.descriptor.label,
      region: designerPaletteRegion(registration.descriptor.preferredRegion),
      role: registration.descriptor.role,
      ...(registration.descriptor.singleton ? { singleton: true } : {}),
    }))
}

export function placementFromDesignerPaletteEntry(
  entry: DesignerPaletteEntryV1,
): PaneWorkspaceProviderPlacementV1 {
  return {
    kind: entry.kind,
    region: entry.region,
    role: entry.role,
    ...(entry.singleton === true ? { singleton: true } : {}),
  }
}

export type DesignerMutationKindV1 =
  | 'place'
  | 'split'
  | 'ratio'
  | 'rail'
  | 'tab_policy'
  | 'motion'
  | 'scope'

export interface DesignerSessionV1 {
  readonly draft: PaneWorkspaceDraftV1
  readonly past: readonly PaneWorkspaceDraftV1[]
  readonly future: readonly PaneWorkspaceDraftV1[]
  readonly selectedPlacement?: number
  readonly dirty: boolean
  readonly lastReceipt?: WorkspaceApplyReceiptV1
  readonly rollback?: WorkspaceApplyRollbackEntryV1
}

export function createDesignerSession(workspace: PaneWorkspaceV1): DesignerSessionV1 {
  return {
    draft: createPaneWorkspaceDraft(workspace),
    past: [],
    future: [],
    dirty: false,
  }
}

function push(session: DesignerSessionV1, draft: PaneWorkspaceDraftV1): DesignerSessionV1 {
  return {
    ...session,
    draft: serializePaneWorkspaceDraft(draft),
    past: [session.draft, ...session.past].slice(0, DESIGNER_HISTORY_LIMIT),
    future: [],
    dirty: true,
  }
}

export function placeDesignerProvider(
  session: DesignerSessionV1,
  placement: PaneWorkspaceProviderPlacementV1,
): DesignerSessionV1 {
  return push(session, {
    ...session.draft,
    providerPlacements: [...session.draft.providerPlacements, placement],
  })
}

export function setDesignerSplitRatio(
  session: DesignerSessionV1,
  region: PaneRegionId,
  ratio: number,
): DesignerSessionV1 {
  const current = session.draft.regions[region]
  if (current.root.type !== 'split') return session
  return push(session, {
    ...session.draft,
    regions: {
      ...session.draft.regions,
      [region]: { ...current, root: { ...current.root, ratio } },
    },
  })
}

export function setDesignerRailOrder(session: DesignerSessionV1, railOrder: readonly string[]): DesignerSessionV1 {
  return push(session, { ...session.draft, railOrder })
}

export function setDesignerMotion(session: DesignerSessionV1, motionPreference: PaneWorkspaceMotionPreferenceV1): DesignerSessionV1 {
  return push(session, { ...session.draft, motionPreference })
}

export function setDesignerScope(session: DesignerSessionV1, scope: PaneWorkspaceDraftScopeV1): DesignerSessionV1 {
  return push(session, { ...session.draft, scope })
}

export function undoDesigner(session: DesignerSessionV1): DesignerSessionV1 {
  const previous = session.past[0]
  if (previous === undefined) return session
  return {
    ...session,
    draft: previous,
    past: session.past.slice(1),
    future: [session.draft, ...session.future].slice(0, DESIGNER_HISTORY_LIMIT),
    dirty: session.past.length > 1,
  }
}

export function redoDesigner(session: DesignerSessionV1): DesignerSessionV1 {
  const next = session.future[0]
  if (next === undefined) return session
  return {
    ...session,
    draft: next,
    past: [session.draft, ...session.past].slice(0, DESIGNER_HISTORY_LIMIT),
    future: session.future.slice(1),
    dirty: true,
  }
}

export function discardDesigner(workspace: PaneWorkspaceV1): DesignerSessionV1 {
  return createDesignerSession(workspace)
}

export function rebaseDesigner(workspace: PaneWorkspaceV1, session: DesignerSessionV1): DesignerSessionV1 {
  return {
    ...session,
    draft: createPaneWorkspaceDraft(workspace, {
      scope: session.draft.scope,
      providerPlacements: session.draft.providerPlacements,
      railOrder: session.draft.railOrder,
      tabPolicy: session.draft.tabPolicy,
      motionPreference: session.draft.motionPreference,
    }),
    past: [],
    future: [],
    dirty: true,
  }
}

export function focusDesignerIssue(session: DesignerSessionV1, index: number): DesignerSessionV1 {
  return { ...session, selectedPlacement: index }
}

export function inspectDesignerApplyUx(
  workspace: PaneWorkspaceV1,
  session: DesignerSessionV1,
  options: WorkspaceApplyUxOptionsV1 = {},
): WorkspaceApplyUxV1 {
  return inspectWorkspaceApplyUx(workspace, session.draft, options, {
    lastReceipt: session.lastReceipt,
    rollback: session.rollback,
  })
}

export function applyDesignerWorkspace(
  workspace: PaneWorkspaceV1,
  session: DesignerSessionV1,
  options: WorkspaceApplyUxOptionsV1 = {},
): { readonly workspace: PaneWorkspaceV1; readonly session: DesignerSessionV1 } {
  const submitted = submitWorkspaceApply(workspace, session.draft, options)
  return {
    workspace: submitted.workspace,
    session: {
      ...session,
      lastReceipt: submitted.receipt,
      rollback: submitted.rollback,
      dirty: submitted.receipt.status === 'accepted' ? false : session.dirty,
    },
  }
}

export async function saveDesignerWorkspace(
  session: DesignerSessionV1,
  options: WorkspaceApplyUxOptionsV1 = {},
): Promise<DesignerSessionV1> {
  const receipt = await saveWorkspaceDraftWithUx(session.draft, options)
  return { ...session, lastReceipt: receipt }
}

export function rollbackDesignerWorkspace(
  session: DesignerSessionV1,
): { readonly workspace?: PaneWorkspaceV1; readonly session: DesignerSessionV1 } {
  if (session.rollback === undefined) return { session }
  return {
    workspace: restoreWorkspaceFromRollback(session.rollback),
    session: {
      ...session,
      lastReceipt: { action: 'apply', status: 'accepted', reason: 'rolled_back' },
    },
  }
}

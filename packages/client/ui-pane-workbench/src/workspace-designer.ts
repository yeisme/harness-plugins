import type { PaneRegionId, PaneWorkspaceV1 } from './workspace.js'
import {
  createPaneWorkspaceDraft,
  serializePaneWorkspaceDraft,
  type PaneWorkspaceDraftScopeV1,
  type PaneWorkspaceDraftV1,
  type PaneWorkspaceMotionPreferenceV1,
  type PaneWorkspaceProviderPlacementV1,
} from './workspace-draft.js'

export const DESIGNER_HISTORY_LIMIT = 20

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
    draft: serializePaneWorkspaceDraft(draft),
    past: [session.draft, ...session.past].slice(0, DESIGNER_HISTORY_LIMIT),
    future: [],
    selectedPlacement: session.selectedPlacement,
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
    draft: previous,
    past: session.past.slice(1),
    future: [session.draft, ...session.future].slice(0, DESIGNER_HISTORY_LIMIT),
    selectedPlacement: session.selectedPlacement,
    dirty: session.past.length > 1,
  }
}

export function redoDesigner(session: DesignerSessionV1): DesignerSessionV1 {
  const next = session.future[0]
  if (next === undefined) return session
  return {
    draft: next,
    past: [session.draft, ...session.past].slice(0, DESIGNER_HISTORY_LIMIT),
    future: session.future.slice(1),
    selectedPlacement: session.selectedPlacement,
    dirty: true,
  }
}

export function discardDesigner(workspace: PaneWorkspaceV1): DesignerSessionV1 {
  return createDesignerSession(workspace)
}

export function rebaseDesigner(workspace: PaneWorkspaceV1, session: DesignerSessionV1): DesignerSessionV1 {
  return {
    draft: createPaneWorkspaceDraft(workspace, {
      scope: session.draft.scope,
      providerPlacements: session.draft.providerPlacements,
      railOrder: session.draft.railOrder,
      tabPolicy: session.draft.tabPolicy,
      motionPreference: session.draft.motionPreference,
    }),
    past: [],
    future: [],
    selectedPlacement: session.selectedPlacement,
    dirty: true,
  }
}

export function focusDesignerIssue(session: DesignerSessionV1, index: number): DesignerSessionV1 {
  return { ...session, selectedPlacement: index }
}

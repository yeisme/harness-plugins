import type {
  PaneGroupV1,
  PaneRegionId,
  PaneWorkspaceV1,
} from './workspace.js'

export const PANE_PROJECTION_BREAKPOINTS = Object.freeze({
  wideMinWidth: 1_200,
  compactMinWidth: 600,
})

export type PaneContainerMode = 'wide' | 'compact' | 'sheet'

export interface PaneRegionProjectionV1 {
  readonly region: PaneRegionId
  readonly visible: boolean
  readonly active: boolean
  readonly size: number
  readonly groupIds: readonly string[]
}

export interface PaneWorkspaceProjectionV1 {
  readonly mode: PaneContainerMode
  readonly activeRegion: PaneRegionId
  readonly activeGroupId?: string
  readonly visibleGroupIds: readonly string[]
  readonly canonicalGroupIds: readonly string[]
  readonly regions: Readonly<Record<PaneRegionId, PaneRegionProjectionV1>>
}

function groupIds(node: PaneWorkspaceV1['regions']['right']['root'], output: string[] = []): string[] {
  if (node.type === 'group') {
    output.push(node.groupId)
    return output
  }
  groupIds(node.first, output)
  groupIds(node.second, output)
  return output
}

function groupFor(state: PaneWorkspaceV1, groupId: string | undefined): PaneGroupV1 | undefined {
  return groupId === undefined ? undefined : state.groups[groupId]
}

function chooseActiveRegion(state: PaneWorkspaceV1): PaneRegionId {
  if (state.maximizedGroupId !== undefined) {
    const group = groupFor(state, state.maximizedGroupId)
    if (group !== undefined) return group.region
  }
  if (state.regions[state.activeRegion].visible) return state.activeRegion
  if (state.regions.right.visible) return 'right'
  if (state.regions.bottom.visible) return 'bottom'
  return state.activeRegion
}

/**
 * Projects canonical layout into a container-specific view. This function
 * never moves groups or tabs; returning from sheet/compact therefore restores
 * the exact desktop tree.
 */
export function projectPaneWorkspace(state: PaneWorkspaceV1, width: number): PaneWorkspaceProjectionV1 {
  const mode: PaneContainerMode = width >= PANE_PROJECTION_BREAKPOINTS.wideMinWidth
    ? 'wide'
    : width >= PANE_PROJECTION_BREAKPOINTS.compactMinWidth ? 'compact' : 'sheet'
  const activeRegion = chooseActiveRegion(state)
  const canonical = {
    right: groupIds(state.regions.right.root),
    bottom: groupIds(state.regions.bottom.root),
  }
  const canonicalGroupIds = [...canonical.right, ...canonical.bottom]
  const maximized = state.maximizedGroupId
  const visibleRegions: PaneRegionId[] = mode === 'wide'
    ? (['right', 'bottom'] as const).filter(region => state.regions[region].visible)
    : state.regions[activeRegion].visible ? [activeRegion] : []
  const projectedGroups = visibleRegions.flatMap(region => {
    const ids = canonical[region]
    if (maximized !== undefined) return ids.includes(maximized) ? [maximized] : []
    if (mode === 'sheet') {
      const activeGroup = groupFor(state, state.activeGroupId)
      return activeGroup?.region === region ? [activeGroup.id] : ids.slice(0, 1)
    }
    return ids
  })
  const visibleGroupIds = [...new Set(projectedGroups)]
  return {
    mode,
    activeRegion,
    activeGroupId: state.activeGroupId,
    visibleGroupIds,
    canonicalGroupIds,
    regions: {
      right: {
        region: 'right',
        visible: visibleRegions.includes('right'),
        active: activeRegion === 'right',
        size: state.regions.right.size,
        groupIds: visibleRegions.includes('right') ? canonical.right.filter(id => visibleGroupIds.includes(id)) : [],
      },
      bottom: {
        region: 'bottom',
        visible: visibleRegions.includes('bottom'),
        active: activeRegion === 'bottom',
        size: state.regions.bottom.size,
        groupIds: visibleRegions.includes('bottom') ? canonical.bottom.filter(id => visibleGroupIds.includes(id)) : [],
      },
    },
  }
}


import type { JsonValue, PaneViewDescriptorV1 } from '@yeisme/dsh-pane-protocol'
import type { PaneWorkspaceDraftIssueV1, PaneWorkspaceDraftV1 } from './workspace-draft.js'

export const PANE_WORKSPACE_SCHEMA = 'pane.workspace.v1alpha1' as const

export type PaneRegionId = 'right' | 'bottom'
export type PaneSplitOrientation = 'horizontal' | 'vertical'
export type PaneSplitEdge = 'left' | 'right' | 'top' | 'bottom'
export type PaneViewClosePolicy = 'allow' | 'confirm' | 'deny'

export const PANE_WORKSPACE_LIMITS = Object.freeze({
  maxSplitDepth: 2,
  maxVisibleGroups: 4,
  maxHistory: 20,
  minSplitRatio: 0.15,
  maxSplitRatio: 0.85,
  minRegionRatio: 0.16,
  maxRegionRatio: 0.8,
})

export type PaneViewRuntimeStatus = 'ready' | 'orphaned' | 'conflict' | 'stale'
export type PaneBulkCloseMode = 'others' | 'right' | 'unpinned' | 'group'

export interface PaneViewSpecV1 {
  readonly kind: string
  readonly resourceKey: string
  readonly role: PaneViewDescriptorV1['role']
  readonly preferredRegion: PaneViewDescriptorV1['preferredRegion']
  readonly retention: PaneViewDescriptorV1['retention']
  readonly singleton: boolean
  readonly componentKey?: string
  readonly viewId?: string
  readonly targetGroupId?: string
  readonly title?: string
  readonly preview?: boolean
  readonly pinned?: boolean
  readonly dirty?: boolean
  readonly duplicate?: boolean
  readonly closePolicy?: PaneViewClosePolicy
  readonly attention?: boolean
  readonly offline?: boolean
  readonly stale?: boolean
  readonly resourceVersion?: string
  readonly instanceLabel?: string
  readonly metadata?: Readonly<Record<string, JsonValue>>
}

export interface PaneViewInstanceV1 {
  readonly id: string
  readonly kind: string
  readonly resourceKey: string
  readonly role: PaneViewDescriptorV1['role']
  readonly region: PaneRegionId
  readonly groupId: string
  readonly title: string
  readonly retention: PaneViewDescriptorV1['retention']
  readonly singleton: boolean
  readonly preview: boolean
  readonly pinned: boolean
  readonly dirty: boolean
  readonly duplicate: boolean
  readonly closePolicy: PaneViewClosePolicy
  readonly status: PaneViewRuntimeStatus
  readonly attention: boolean
  readonly offline: boolean
  readonly stale: boolean
  readonly resourceVersion?: string
  readonly instanceLabel?: string
  readonly metadata?: Readonly<Record<string, JsonValue>>
}

export interface PaneGroupV1 {
  readonly id: string
  readonly region: PaneRegionId
  readonly role: PaneViewDescriptorV1['role']
  readonly locked: boolean
  readonly tabs: readonly string[]
  readonly activeTabId?: string
}

export type PaneSplitNodeV1 =
  | { readonly type: 'group'; readonly groupId: string }
  | {
    readonly type: 'split'
    readonly id: string
    readonly orientation: PaneSplitOrientation
    readonly ratio: number
    readonly first: PaneSplitNodeV1
    readonly second: PaneSplitNodeV1
  }

export interface PaneRegionStateV1 {
  readonly id: PaneRegionId
  readonly visible: boolean
  readonly size: number
  readonly root: PaneSplitNodeV1
}

export interface PaneWorkspaceSnapshotV1 {
  readonly regions: Readonly<Record<PaneRegionId, PaneRegionStateV1>>
  readonly groups: Readonly<Record<string, PaneGroupV1>>
  readonly views: Readonly<Record<string, PaneViewInstanceV1>>
  readonly activeRegion: PaneRegionId
  readonly activeGroupId?: string
  readonly maximizedGroupId?: string
}

export interface PaneWorkspaceV1 extends PaneWorkspaceSnapshotV1 {
  readonly schema: typeof PANE_WORKSPACE_SCHEMA
  readonly generation: number
  readonly history: readonly PaneWorkspaceSnapshotV1[]
}

export const PANE_WORKSPACE_OPEN_VIEW_INTENT = 'open_view' as const
export const PANE_WORKSPACE_CLOSE_VIEW_INTENT = 'close_view' as const
/** Additive Designer batch intent. Validation and atomic apply live in workspace-apply. */
export const PANE_WORKSPACE_DRAFT_INTENT = 'apply_workspace_draft' as const

export type PaneWorkspaceIntentV1 =
  | { readonly type: typeof PANE_WORKSPACE_OPEN_VIEW_INTENT; readonly request: PaneViewSpecV1 }
  | { readonly type: 'activate_view'; readonly viewId: string }
  | { readonly type: 'pin_view'; readonly viewId: string; readonly pinned?: boolean }
  | { readonly type: 'set_view_dirty'; readonly viewId: string; readonly dirty: boolean }
  | { readonly type: typeof PANE_WORKSPACE_CLOSE_VIEW_INTENT; readonly viewId: string; readonly decision?: 'allow' | 'confirm' | 'deny' }
  | {
    readonly type: 'bulk_close'
    readonly groupId: string
    readonly mode: PaneBulkCloseMode
    readonly sourceViewId?: string
    readonly decision?: 'allow' | 'confirm' | 'deny'
  }
  | { readonly type: 'reorder_view'; readonly viewId: string; readonly targetGroupId: string; readonly index: number }
  | { readonly type: 'move_view'; readonly viewId: string; readonly targetGroupId: string; readonly index?: number }
  | { readonly type: 'split_with_view'; readonly viewId: string; readonly targetGroupId: string; readonly edge: PaneSplitEdge }
  | { readonly type: 'move_group'; readonly groupId: string; readonly targetRegion: PaneRegionId }
  | { readonly type: 'lock_group'; readonly groupId: string; readonly locked: boolean }
  | { readonly type: 'resize_split'; readonly region: PaneRegionId; readonly splitId: string; readonly ratio: number }
  | { readonly type: 'resize_region'; readonly region: PaneRegionId; readonly size: number }
  | { readonly type: 'set_region_visibility'; readonly region: PaneRegionId; readonly visible: boolean }
  | { readonly type: 'maximize_group'; readonly groupId: string }
  | { readonly type: 'restore_layout' }
  | { readonly type: 'reset_layout' }
  | { readonly type: 'undo_layout' }

export type PaneWorkspaceDraftIntentV1 = {
  readonly type: typeof PANE_WORKSPACE_DRAFT_INTENT
  readonly draft: PaneWorkspaceDraftV1
  readonly expectedGeneration: number
}

/** Parallel V4 intent surface. Live reducer accepts the additive draft intent. */
export type PaneWorkspaceIntentV1Additive = PaneWorkspaceIntentV1 | PaneWorkspaceDraftIntentV1

export interface PaneWorkspaceEffectV1 {
  readonly type: 'announce'
  readonly message: string
  readonly politeness: 'polite' | 'assertive'
}

export interface PaneWorkspaceReducerResultV1 {
  readonly state: PaneWorkspaceV1
  readonly accepted: boolean
  readonly reason?: string
  readonly effects: readonly PaneWorkspaceEffectV1[]
}

interface MutableSnapshot {
  regions: Record<PaneRegionId, { id: PaneRegionId; visible: boolean; size: number; root: PaneSplitNodeV1 }>
  groups: Record<string, PaneGroupV1>
  views: Record<string, PaneViewInstanceV1>
  activeRegion: PaneRegionId
  activeGroupId?: string
  maximizedGroupId?: string
}

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 && ID_PATTERN.test(value)
}

function safeResourceKey(value: unknown): value is string {
  if (!safeId(value)) return false
  return !value.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(value) && !/^\\\\/.test(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : (min + max) / 2))
}

function defaultGroup(id: string, region: PaneRegionId, role: PaneGroupV1['role'], locked = false): PaneGroupV1 {
  return { id, region, role, locked, tabs: [] }
}

function defaultSnapshot(): MutableSnapshot {
  const navigator = defaultGroup('group:right:navigator', 'right', 'navigator', true)
  const content = defaultGroup('group:right:content', 'right', 'content')
  const utility = defaultGroup('group:bottom:utility', 'bottom', 'utility')
  return {
    regions: {
      right: {
        id: 'right',
        visible: false,
        size: 0.32,
        root: {
          type: 'split',
          id: 'split:right:root',
          orientation: 'horizontal',
          ratio: 0.68,
          first: { type: 'group', groupId: content.id },
          second: { type: 'group', groupId: navigator.id },
        },
      },
      bottom: {
        id: 'bottom',
        visible: false,
        size: 0.34,
        root: { type: 'group', groupId: utility.id },
      },
    },
    groups: { [navigator.id]: navigator, [content.id]: content, [utility.id]: utility },
    views: {},
    activeRegion: 'right',
    activeGroupId: content.id,
  }
}

function cloneNode(node: PaneSplitNodeV1): PaneSplitNodeV1 {
  return node.type === 'group'
    ? { type: 'group', groupId: node.groupId }
    : {
      type: 'split',
      id: node.id,
      orientation: node.orientation,
      ratio: node.ratio,
      first: cloneNode(node.first),
      second: cloneNode(node.second),
    }
}

function cloneSnapshot(snapshot: PaneWorkspaceSnapshotV1): MutableSnapshot {
  return {
    regions: {
      right: { ...snapshot.regions.right, root: cloneNode(snapshot.regions.right.root) },
      bottom: { ...snapshot.regions.bottom, root: cloneNode(snapshot.regions.bottom.root) },
    },
    groups: Object.fromEntries(Object.entries(snapshot.groups).map(([id, group]) => [id, { ...group, tabs: [...group.tabs] }])),
    views: Object.fromEntries(Object.entries(snapshot.views).map(([id, view]) => [id, {
      ...view,
      metadata: view.metadata === undefined ? undefined : { ...view.metadata },
    }])),
    activeRegion: snapshot.activeRegion,
    activeGroupId: snapshot.activeGroupId,
    maximizedGroupId: snapshot.maximizedGroupId,
  }
}

function snapshotOf(state: PaneWorkspaceV1 | MutableSnapshot): PaneWorkspaceSnapshotV1 {
  return {
    regions: {
      right: { ...state.regions.right, root: cloneNode(state.regions.right.root) },
      bottom: { ...state.regions.bottom, root: cloneNode(state.regions.bottom.root) },
    },
    groups: Object.fromEntries(Object.entries(state.groups).map(([id, group]) => [id, { ...group, tabs: [...group.tabs] }])),
    views: Object.fromEntries(Object.entries(state.views).map(([id, view]) => [id, {
      ...view,
      metadata: view.metadata === undefined ? undefined : { ...view.metadata },
    }])),
    activeRegion: state.activeRegion,
    activeGroupId: state.activeGroupId,
    maximizedGroupId: state.maximizedGroupId,
  }
}

function materialize(generation: number, snapshot: PaneWorkspaceSnapshotV1, history: readonly PaneWorkspaceSnapshotV1[] = []): PaneWorkspaceV1 {
  const normalized = normalizeSnapshot(snapshot)
  return {
    schema: PANE_WORKSPACE_SCHEMA,
    generation,
    ...normalized,
    history: history.slice(0, PANE_WORKSPACE_LIMITS.maxHistory).map(item => normalizeSnapshot(item)),
  }
}

function groupIdsInTree(node: PaneSplitNodeV1, output: string[] = []): string[] {
  if (node.type === 'group') {
    output.push(node.groupId)
    return output
  }
  groupIdsInTree(node.first, output)
  groupIdsInTree(node.second, output)
  return output
}

function splitDepth(node: PaneSplitNodeV1): number {
  return node.type === 'group' ? 0 : 1 + Math.max(splitDepth(node.first), splitDepth(node.second))
}

function containsGroup(node: PaneSplitNodeV1, groupId: string): boolean {
  return groupIdsInTree(node).includes(groupId)
}

function replaceNode(node: PaneSplitNodeV1, predicate: (candidate: PaneSplitNodeV1) => boolean, replacement: PaneSplitNodeV1): PaneSplitNodeV1 {
  if (predicate(node)) return replacement
  if (node.type === 'group') return node
  return {
    ...node,
    first: replaceNode(node.first, predicate, replacement),
    second: replaceNode(node.second, predicate, replacement),
  }
}

function removeGroupNode(node: PaneSplitNodeV1, groupId: string): PaneSplitNodeV1 | undefined {
  if (node.type === 'group') return node.groupId === groupId ? undefined : node
  const first = removeGroupNode(node.first, groupId)
  const second = removeGroupNode(node.second, groupId)
  if (first === undefined) return second
  if (second === undefined) return first
  return { ...node, first, second }
}

function findSplit(node: PaneSplitNodeV1, splitId: string): PaneSplitNodeV1 | undefined {
  if (node.type === 'group') return undefined
  if (node.id === splitId) return node
  return findSplit(node.first, splitId) ?? findSplit(node.second, splitId)
}

function normalizeSnapshot(input: PaneWorkspaceSnapshotV1): PaneWorkspaceSnapshotV1 {
  const groups: Record<string, PaneGroupV1> = {}
  const views: Record<string, PaneViewInstanceV1> = {}

  for (const [id, group] of Object.entries(input.groups)) {
    if (!safeId(id) || !safeId(group.id) || id !== group.id) continue
    if (!['right', 'bottom'].includes(group.region)) continue
    const tabs: string[] = []
    for (const viewId of group.tabs) {
      if (safeId(viewId) && !tabs.includes(viewId)) tabs.push(viewId)
    }
    groups[id] = {
      id,
      region: group.region,
      role: group.role,
      locked: Boolean(group.locked),
      tabs,
      activeTabId: tabs.includes(group.activeTabId ?? '') ? group.activeTabId : tabs[0],
    }
  }

  for (const [id, view] of Object.entries(input.views)) {
    const group = groups[view.groupId]
    if (!safeId(id) || !safeId(view.id) || id !== view.id || group === undefined) continue
    if (!safeResourceKey(view.resourceKey)) continue
    views[id] = {
      ...view,
      id,
      region: group.region,
      groupId: group.id,
      title: view.title.slice(0, 160),
      preview: Boolean(view.preview) && !Boolean(view.pinned) && !Boolean(view.dirty),
      pinned: Boolean(view.pinned),
      dirty: Boolean(view.dirty),
      duplicate: Boolean(view.duplicate),
      closePolicy: view.closePolicy ?? 'allow',
      status: view.status === 'orphaned'
        ? 'orphaned'
        : view.status === 'conflict'
          ? 'conflict'
          : view.status === 'stale'
            ? 'stale'
            : 'ready',
      attention: Boolean(view.attention),
      offline: Boolean(view.offline),
      stale: Boolean(view.stale) || view.status === 'stale',
      resourceVersion: typeof view.resourceVersion === 'string' ? view.resourceVersion.slice(0, 80) : undefined,
      instanceLabel: typeof view.instanceLabel === 'string' ? view.instanceLabel.slice(0, 40) : undefined,
    }
  }

  for (const group of Object.values(groups)) {
    const tabs = group.tabs.filter(viewId => views[viewId]?.groupId === group.id)
    groups[group.id] = { ...group, tabs, activeTabId: tabs.includes(group.activeTabId ?? '') ? group.activeTabId : tabs[0] }
  }

  const roots: Record<PaneRegionId, PaneSplitNodeV1 | undefined> = {
    right: normalizeTree(input.regions.right?.root, 'right', groups, new Set(), 0),
    bottom: normalizeTree(input.regions.bottom?.root, 'bottom', groups, new Set(), 0),
  }
  const rightRoot = roots.right ?? { type: 'group', groupId: 'group:right:content' as const }
  const bottomRoot = roots.bottom ?? { type: 'group', groupId: 'group:bottom:utility' as const }
  if (groups['group:right:content'] === undefined && !containsGroup(rightRoot, 'group:right:content')) {
    groups['group:right:content'] = defaultGroup('group:right:content', 'right', 'content')
  }
  if (groups['group:bottom:utility'] === undefined && !containsGroup(bottomRoot, 'group:bottom:utility')) {
    groups['group:bottom:utility'] = defaultGroup('group:bottom:utility', 'bottom', 'utility')
  }

  const visible = [...groupIdsInTree(rightRoot), ...groupIdsInTree(bottomRoot)]
  const allowed = new Set(visible.slice(0, PANE_WORKSPACE_LIMITS.maxVisibleGroups))
  const trim = (node: PaneSplitNodeV1): PaneSplitNodeV1 | undefined => {
    if (node.type === 'group') return allowed.has(node.groupId) ? node : undefined
    const first = trim(node.first)
    const second = trim(node.second)
    if (first === undefined) return second
    if (second === undefined) return first
    return { ...node, first, second }
  }
  const trimmedRight = trim(rightRoot) ?? { type: 'group', groupId: 'group:right:content' as const }
  const trimmedBottom = trim(bottomRoot) ?? { type: 'group', groupId: 'group:bottom:utility' as const }
  const retained = new Set([...groupIdsInTree(trimmedRight), ...groupIdsInTree(trimmedBottom)])
  for (const id of Object.keys(groups)) if (!retained.has(id)) delete groups[id]
  for (const id of Object.keys(views)) if (!retained.has(views[id]!.groupId)) delete views[id]
  for (const group of Object.values(groups)) {
    const tabs = group.tabs.filter(viewId => views[viewId] !== undefined)
    groups[group.id] = { ...group, tabs, activeTabId: tabs.includes(group.activeTabId ?? '') ? group.activeTabId : tabs[0] }
  }

  const activeGroupId = input.activeGroupId !== undefined && retained.has(input.activeGroupId)
    ? input.activeGroupId
    : groupIdsInTree(trimmedRight)[0] ?? groupIdsInTree(trimmedBottom)[0]
  const maximizedGroupId = input.maximizedGroupId !== undefined && retained.has(input.maximizedGroupId)
    ? input.maximizedGroupId
    : undefined

  return {
    regions: {
      right: {
        id: 'right',
        visible: Boolean(input.regions.right?.visible),
        size: clamp(input.regions.right?.size ?? 0.32, PANE_WORKSPACE_LIMITS.minRegionRatio, PANE_WORKSPACE_LIMITS.maxRegionRatio),
        root: trimmedRight,
      },
      bottom: {
        id: 'bottom',
        visible: Boolean(input.regions.bottom?.visible),
        size: clamp(input.regions.bottom?.size ?? 0.35, PANE_WORKSPACE_LIMITS.minRegionRatio, PANE_WORKSPACE_LIMITS.maxRegionRatio),
        root: trimmedBottom,
      },
    },
    groups,
    views,
    activeRegion: input.activeRegion === 'bottom' ? 'bottom' : 'right',
    activeGroupId,
    maximizedGroupId,
  }
}

function normalizeTree(
  input: unknown,
  region: PaneRegionId,
  groups: Readonly<Record<string, PaneGroupV1>>,
  seen: Set<string>,
  depth: number,
): PaneSplitNodeV1 | undefined {
  if (!isRecord(input) || depth > PANE_WORKSPACE_LIMITS.maxSplitDepth) return undefined
  if (input.type === 'group' && safeId(input.groupId)) {
    const group = groups[input.groupId]
    if (group?.region === region && !seen.has(input.groupId)) {
      seen.add(input.groupId)
      return { type: 'group', groupId: input.groupId }
    }
    return undefined
  }
  if (input.type !== 'split' || !safeId(input.id)) return undefined
  const first = normalizeTree(input.first, region, groups, seen, depth + 1)
  const second = normalizeTree(input.second, region, groups, seen, depth + 1)
  if (first === undefined) return second
  if (second === undefined) return first
  const defaultRightRoot = region === 'right'
    && depth === 0
    && input.id === 'split:right:root'
    && first.type === 'group'
    && first.groupId === 'group:right:content'
    && second.type === 'group'
    && second.groupId === 'group:right:navigator'
  const orientation = defaultRightRoot
    ? 'horizontal'
    : input.orientation === 'vertical' ? 'vertical' : 'horizontal'
  return {
    type: 'split',
    id: input.id,
    orientation,
    ratio: clamp(Number(input.ratio), PANE_WORKSPACE_LIMITS.minSplitRatio, PANE_WORKSPACE_LIMITS.maxSplitRatio),
    first,
    second,
  }
}

export function createPaneWorkspace(generation = 1): PaneWorkspaceV1 {
  return materialize(generation, defaultSnapshot())
}

export const createDefaultPaneWorkspace = createPaneWorkspace

export function normalizePaneWorkspace(input: unknown, generation = 1): PaneWorkspaceV1 {
  if (!isRecord(input)) return createPaneWorkspace(generation)
  const snapshot = normalizeSnapshot({
    regions: isRecord(input.regions) ? input.regions as PaneWorkspaceSnapshotV1['regions'] : defaultSnapshot().regions,
    groups: isRecord(input.groups) ? input.groups as PaneWorkspaceSnapshotV1['groups'] : defaultSnapshot().groups,
    views: isRecord(input.views) ? input.views as PaneWorkspaceSnapshotV1['views'] : {},
    activeRegion: input.activeRegion === 'bottom' ? 'bottom' : 'right',
    activeGroupId: typeof input.activeGroupId === 'string' ? input.activeGroupId : undefined,
    maximizedGroupId: typeof input.maximizedGroupId === 'string' ? input.maximizedGroupId : undefined,
  })
  return materialize(typeof input.generation === 'number' && Number.isSafeInteger(input.generation) ? input.generation : generation, snapshot)
}

function groupFor(state: PaneWorkspaceSnapshotV1, groupId: string): PaneGroupV1 | undefined {
  return state.groups[groupId]
}

function viewFor(state: PaneWorkspaceSnapshotV1, viewId: string): PaneViewInstanceV1 | undefined {
  return state.views[viewId]
}

function groupAccepts(group: PaneGroupV1, spec: PaneViewSpecV1): boolean {
  if (group.locked) return group.role === spec.role
  return group.role === spec.role || group.role === 'general'
}

function regionPriority(state: PaneWorkspaceSnapshotV1, preferred: PaneViewSpecV1['preferredRegion']): PaneRegionId[] {
  if (preferred === 'right') return ['right', 'bottom']
  if (preferred === 'bottom') return ['bottom', 'right']
  return state.activeRegion === 'bottom' ? ['bottom', 'right'] : ['right', 'bottom']
}

function allGroupIds(state: PaneWorkspaceSnapshotV1): string[] {
  return [...groupIdsInTree(state.regions.right.root), ...groupIdsInTree(state.regions.bottom.root)]
}

function visibleGroupCount(state: PaneWorkspaceSnapshotV1): number {
  return (state.regions.right.visible ? groupIdsInTree(state.regions.right.root).length : 0)
    + (state.regions.bottom.visible ? groupIdsInTree(state.regions.bottom.root).length : 0)
}

function nextId(prefix: string, values: Iterable<string>): string {
  const used = new Set(values)
  let index = 1
  let candidate = `${prefix}:${index}`
  while (used.has(candidate)) candidate = `${prefix}:${++index}`
  return candidate
}

function splitRatioFor(role: PaneViewSpecV1['role'], targetRole: PaneGroupV1['role']): number {
  if ((role === 'navigator' && targetRole === 'content') || (role === 'content' && targetRole === 'navigator')) return 0.32
  if ((role === 'content' && targetRole === 'inspector') || (role === 'inspector' && targetRole === 'content')) return 0.65
  return 0.5
}

function insertSplit(
  snapshot: MutableSnapshot,
  region: PaneRegionId,
  targetGroupId: string,
  newGroupId: string,
  edge: PaneSplitEdge,
): boolean {
  const regionState = snapshot.regions[region]
  if (!containsGroup(regionState.root, targetGroupId) || splitDepth(regionState.root) >= PANE_WORKSPACE_LIMITS.maxSplitDepth) return false
  const target = snapshot.groups[targetGroupId]
  const newGroup = snapshot.groups[newGroupId]
  if (target === undefined || newGroup === undefined) return false
  const horizontal = edge === 'left' || edge === 'right'
  const newLeaf: PaneSplitNodeV1 = { type: 'group', groupId: newGroupId }
  const oldLeaf: PaneSplitNodeV1 = { type: 'group', groupId: targetGroupId }
  const first = edge === 'left' || edge === 'top' ? newLeaf : oldLeaf
  const second = edge === 'left' || edge === 'top' ? oldLeaf : newLeaf
  const replacement: PaneSplitNodeV1 = {
    type: 'split',
    id: nextId(`split:${region}`, collectNodeIds(regionState.root)),
    orientation: horizontal ? 'horizontal' : 'vertical',
    ratio: splitRatioFor(newGroup.role, target.role),
    first,
    second,
  }
  regionState.root = replaceNode(regionState.root, node => node.type === 'group' && node.groupId === targetGroupId, replacement)
  return true
}

function collectNodeIds(node: PaneSplitNodeV1, output: string[] = []): string[] {
  if (node.type === 'group') output.push(node.groupId)
  else {
    output.push(node.id)
    collectNodeIds(node.first, output)
    collectNodeIds(node.second, output)
  }
  return output
}

function removeGroup(snapshot: MutableSnapshot, groupId: string): boolean {
  const group = snapshot.groups[groupId]
  if (group === undefined || group.locked) return false
  const root = snapshot.regions[group.region].root
  const nextRoot = removeGroupNode(root, groupId)
  if (nextRoot === undefined) return false
  snapshot.regions[group.region] = { ...snapshot.regions[group.region], root: nextRoot }
  delete snapshot.groups[groupId]
  for (const viewId of group.tabs) delete snapshot.views[viewId]
  if (snapshot.activeGroupId === groupId) snapshot.activeGroupId = groupIdsInTree(nextRoot)[0]
  if (snapshot.maximizedGroupId === groupId) snapshot.maximizedGroupId = undefined
  return true
}

function removeViewFromGroup(snapshot: MutableSnapshot, viewId: string): PaneGroupV1 | undefined {
  const view = snapshot.views[viewId]
  if (view === undefined) return undefined
  const group = snapshot.groups[view.groupId]
  if (group === undefined) return undefined
  const tabs = group.tabs.filter(id => id !== viewId)
  snapshot.groups[group.id] = { ...group, tabs, activeTabId: group.activeTabId === viewId ? tabs[0] : group.activeTabId }
  return group
}

function addViewToGroup(snapshot: MutableSnapshot, view: PaneViewInstanceV1, groupId: string, index?: number): void {
  const group = snapshot.groups[groupId]
  if (group === undefined) return
  const tabs = [...group.tabs.filter(id => id !== view.id)]
  const lastPinned = tabs.reduce((last, id, current) => snapshot.views[id]?.pinned ? current : last, -1)
  const defaultIndex = view.pinned ? lastPinned + 1 : tabs.length
  const targetIndex = index === undefined ? defaultIndex : Math.max(0, Math.min(index, tabs.length))
  tabs.splice(targetIndex, 0, view.id)
  snapshot.groups[groupId] = { ...group, tabs, activeTabId: view.id }
  snapshot.views[view.id] = { ...view, groupId, region: group.region }
}

function commit(
  state: PaneWorkspaceV1,
  snapshot: MutableSnapshot,
  history = true,
): PaneWorkspaceV1 {
  const current = snapshotOf(state)
  const next = materialize(state.generation, snapshot, history ? [current, ...state.history] : state.history)
  if (JSON.stringify(current) === JSON.stringify(snapshotOf(next))) return state
  return next
}

function result(state: PaneWorkspaceV1, accepted: boolean, reason?: string, message?: string): PaneWorkspaceReducerResultV1 {
  return {
    state,
    accepted,
    reason,
    effects: message === undefined ? [] : [{ type: 'announce', message, politeness: 'polite' }],
  }
}

function activate(snapshot: MutableSnapshot, viewId: string): boolean {
  const view = snapshot.views[viewId]
  const group = view === undefined ? undefined : snapshot.groups[view.groupId]
  if (view === undefined || group === undefined) return false
  snapshot.groups[group.id] = { ...group, activeTabId: viewId }
  snapshot.activeGroupId = group.id
  snapshot.activeRegion = group.region
  snapshot.regions[group.region] = { ...snapshot.regions[group.region], visible: true }
  return true
}

function findExistingView(state: PaneWorkspaceSnapshotV1, request: PaneViewSpecV1): PaneViewInstanceV1 | undefined {
  return Object.values(state.views).find(view => view.kind === request.kind && (
    (view.resourceKey === request.resourceKey
      && (request.resourceVersion === undefined || view.resourceVersion === undefined || view.resourceVersion === request.resourceVersion))
    || (request.singleton && view.singleton)
  ))
}

export type PaneTabSegmentId = 'pinned' | 'working'

export interface PaneTabSegmentV1 {
  readonly id: PaneTabSegmentId
  readonly viewIds: readonly string[]
}

export interface PaneTabPresentationV1 {
  readonly viewId: string
  readonly title: string
  readonly accessibleName: string
  readonly icon: 'file' | 'terminal' | 'git-branch' | 'folder' | 'window'
  readonly preview: boolean
  readonly pinned: boolean
  readonly dirty: boolean
  readonly attention: boolean
  readonly offline: boolean
  readonly stale: boolean
  readonly orphaned: boolean
  readonly conflict: boolean
  readonly closePolicy: PaneViewClosePolicy
  readonly instanceLabel?: string
  readonly statusTokens: readonly string[]
}

export function segmentPaneTabs(group: PaneGroupV1, views: Readonly<Record<string, PaneViewInstanceV1>>): readonly PaneTabSegmentV1[] {
  const pinned: string[] = []
  const working: string[] = []
  for (const viewId of group.tabs) {
    const view = views[viewId]
    if (view === undefined) continue
    if (view.pinned) pinned.push(viewId)
    else working.push(viewId)
  }
  return [
    { id: 'pinned', viewIds: pinned },
    { id: 'working', viewIds: working },
  ]
}

export const PANE_TAB_OVERFLOW_THRESHOLD = 30
export const PANE_TAB_MIN_WIDTH = 88
export const PANE_TAB_PREFERRED_WIDTH = 136
export const PANE_TAB_MAX_WIDTH = 220
export const PANE_TAB_OVERFLOW_CONTROL_WIDTH = 44

export interface PaneTabOverflowPlanV1 {
  readonly visibleIds: readonly string[]
  readonly overflowIds: readonly string[]
  readonly measuredCount: number
  readonly observerCount: number
}

export function planPaneTabOverflow(
  group: PaneGroupV1,
  views: Readonly<Record<string, PaneViewInstanceV1>>,
  availableWidth: number,
  options: { readonly tabWidth?: number; readonly overflowControlWidth?: number } = {},
): PaneTabOverflowPlanV1 {
  const tabWidth = options.tabWidth ?? PANE_TAB_PREFERRED_WIDTH
  const overflowControlWidth = options.overflowControlWidth ?? PANE_TAB_OVERFLOW_CONTROL_WIDTH
  const ordered = segmentPaneTabs(group, views).flatMap(segment => segment.viewIds)
  const activeId = group.activeTabId
  const priority = (viewId: string): number => {
    const view = views[viewId]
    if (view === undefined) return 0
    if (view.id === activeId) return 400
    if (view.pinned) return 300
    if (view.dirty) return 200
    if (view.attention) return 150
    return 50
  }
  const ranked = [...ordered].sort((left, right) => priority(right) - priority(left) || ordered.indexOf(left) - ordered.indexOf(right))
  const budget = Math.max(PANE_TAB_MIN_WIDTH, availableWidth)
  const maxVisible = Math.max(1, Math.floor((budget - overflowControlWidth) / Math.max(PANE_TAB_MIN_WIDTH, tabWidth)))
  const keep = new Set<string>()
  for (const viewId of ordered) {
    const view = views[viewId]
    if (view === undefined) continue
    if (view.id === activeId || view.pinned || view.dirty || view.attention) keep.add(viewId)
  }
  for (const viewId of ranked) {
    if (keep.size >= maxVisible) break
    keep.add(viewId)
  }
  const visibleIds = ordered.filter(id => keep.has(id))
  const overflowIds = ordered.filter(id => !keep.has(id))
  const measuredCount = Math.min(ordered.length, PANE_TAB_OVERFLOW_THRESHOLD)
  return {
    visibleIds,
    overflowIds,
    measuredCount,
    observerCount: overflowIds.length > 0 ? 1 : 0,
  }
}

export function filterOverflowTabs(
  overflowIds: readonly string[],
  views: Readonly<Record<string, PaneViewInstanceV1>>,
  query: string,
): readonly string[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return overflowIds
  return overflowIds.filter(id => {
    const view = views[id]
    if (view === undefined) return false
    const presentation = presentPaneTab(view)
    return [view.title, view.kind, view.instanceLabel, ...presentation.statusTokens]
      .some(token => token !== undefined && token.toLowerCase().includes(needle))
  })
}

export function presentPaneTab(view: PaneViewInstanceV1): PaneTabPresentationV1 {
  const tokens: string[] = []
  if (view.preview) tokens.push('preview')
  if (view.pinned) tokens.push('pinned')
  if (view.dirty) tokens.push('dirty')
  if (view.attention) tokens.push('attention')
  if (view.offline) tokens.push('offline')
  if (view.stale || view.status === 'stale') tokens.push('stale')
  if (view.status === 'orphaned') tokens.push('orphaned')
  if (view.status === 'conflict') tokens.push('conflict')
  if (view.closePolicy !== 'allow') tokens.push(`close:${view.closePolicy}`)
  const icon = view.kind.startsWith('file.') ? 'file'
    : view.kind.startsWith('terminal.') ? 'terminal'
      : view.kind.startsWith('git.') ? 'git-branch'
        : view.kind.startsWith('explorer.') ? 'folder'
          : 'window'
  const accessibleName = [view.title, view.instanceLabel, ...tokens].filter(Boolean).join(', ')
  return {
    viewId: view.id,
    title: view.title,
    accessibleName,
    icon,
    preview: view.preview,
    pinned: view.pinned,
    dirty: view.dirty,
    attention: view.attention,
    offline: view.offline,
    stale: view.stale || view.status === 'stale',
    orphaned: view.status === 'orphaned',
    conflict: view.status === 'conflict',
    closePolicy: view.closePolicy,
    instanceLabel: view.instanceLabel,
    statusTokens: tokens,
  }
}

export interface PaneBulkClosePreflightV1 {
  readonly mode: PaneBulkCloseMode
  readonly groupId: string
  readonly targetIds: readonly string[]
  readonly accepted: boolean
  readonly reason?: 'close_denied' | 'confirmation_required' | 'unknown_view' | 'empty'
  readonly blockerViewId?: string
}

export function collectBulkCloseTargets(
  state: PaneWorkspaceSnapshotV1,
  groupId: string,
  mode: PaneBulkCloseMode,
  sourceViewId?: string,
): readonly string[] {
  const group = state.groups[groupId]
  if (group === undefined) return []
  const sourceIndex = sourceViewId === undefined ? -1 : group.tabs.indexOf(sourceViewId)
  return group.tabs.filter(viewId => {
    const view = state.views[viewId]
    if (view === undefined) return false
    if (mode === 'group') return true
    if (mode === 'others') return viewId !== sourceViewId
    if (mode === 'unpinned') return !view.pinned
    if (mode === 'right') return sourceIndex >= 0 && group.tabs.indexOf(viewId) > sourceIndex
    return false
  })
}

export function preflightBulkClose(
  state: PaneWorkspaceSnapshotV1,
  groupId: string,
  mode: PaneBulkCloseMode,
  sourceViewId?: string,
  decision?: 'allow' | 'confirm' | 'deny',
): PaneBulkClosePreflightV1 {
  const targetIds = collectBulkCloseTargets(state, groupId, mode, sourceViewId)
  if (targetIds.length === 0) return { mode, groupId, targetIds, accepted: false, reason: 'empty' }
  // 批量关闭必须先聚合全部目标的 deny/unknown，再处理 confirm。任一失败则整批拒绝，避免部分关闭留下残缺 group。
  for (const viewId of targetIds) {
    const view = state.views[viewId]
    if (view === undefined) return { mode, groupId, targetIds, accepted: false, reason: 'unknown_view', blockerViewId: viewId }
    if (view.closePolicy === 'deny' && decision !== 'allow') {
      return { mode, groupId, targetIds, accepted: false, reason: 'close_denied', blockerViewId: viewId }
    }
  }
  for (const viewId of targetIds) {
    const view = state.views[viewId]
    if (view === undefined) return { mode, groupId, targetIds, accepted: false, reason: 'unknown_view', blockerViewId: viewId }
    if ((view.dirty || view.closePolicy === 'confirm') && decision !== 'allow') {
      return { mode, groupId, targetIds, accepted: false, reason: decision === 'deny' ? 'close_denied' : 'confirmation_required', blockerViewId: viewId }
    }
  }
  return { mode, groupId, targetIds, accepted: true }
}

function chooseOpenGroup(state: PaneWorkspaceSnapshotV1, request: PaneViewSpecV1): PaneGroupV1 | undefined {
  if (request.targetGroupId !== undefined) {
    const target = state.groups[request.targetGroupId]
    if (target !== undefined && groupAccepts(target, request)) return target
  }

  const regions = regionPriority(state, request.preferredRegion)
  if (state.activeGroupId !== undefined) {
    const active = state.groups[state.activeGroupId]
    if (active !== undefined && groupAccepts(active, request) && regions.includes(active.region)) return active
  }
  for (const region of regions) {
    const candidates = Object.values(state.groups)
      .filter(group => group.region === region && groupAccepts(group, request))
      .sort((left, right) => Number(left.locked) - Number(right.locked) || left.id.localeCompare(right.id))
    if (candidates[0] !== undefined) return candidates[0]
  }
  return undefined
}

function createOpenGroup(snapshot: MutableSnapshot, request: PaneViewSpecV1): PaneGroupV1 | undefined {
  if (visibleGroupCount(snapshot) >= PANE_WORKSPACE_LIMITS.maxVisibleGroups) return undefined
  const region = regionPriority(snapshot, request.preferredRegion)[0]
  const id = nextId(`group:${region}:${request.role}`, Object.keys(snapshot.groups))
  const group = defaultGroup(id, region, request.role)
  snapshot.groups[id] = group
  snapshot.regions[region] = { ...snapshot.regions[region], visible: true }
  const target = Object.values(snapshot.groups).find(candidate => candidate.id !== id && candidate.region === region && candidate.role === request.role)
  if (target === undefined) {
    const root = snapshot.regions[region].root
    snapshot.regions[region] = {
      ...snapshot.regions[region],
      root: {
        type: 'split',
        id: nextId(`split:${region}`, collectNodeIds(root)),
        orientation: region === 'right' ? 'horizontal' : 'vertical',
        ratio: 0.68,
        first: request.role === 'navigator' ? root : { type: 'group', groupId: id },
        second: request.role === 'navigator' ? { type: 'group', groupId: id } : root,
      },
    }
  } else if (!insertSplit(snapshot, region, target.id, id, region === 'right' ? 'right' : 'bottom')) {
    delete snapshot.groups[id]
    return undefined
  }
  return group
}

function applyOpenView(state: PaneWorkspaceV1, request: PaneViewSpecV1): PaneWorkspaceReducerResultV1 {
  if (!safeId(request.kind) || !safeResourceKey(request.resourceKey)) return result(state, false, 'invalid_view_ref', 'View could not be opened because its reference is invalid.')
  const existing = findExistingView(state, request)
  if (existing !== undefined && (request.singleton || !request.duplicate)) {
    const snapshot = cloneSnapshot(state)
    activate(snapshot, existing.id)
    if (request.pinned || request.dirty || request.attention !== undefined || request.offline !== undefined || request.stale !== undefined) {
      snapshot.views[existing.id] = {
        ...existing,
        pinned: request.pinned || request.dirty || existing.pinned,
        preview: (request.pinned || request.dirty) ? false : existing.preview,
        dirty: Boolean(request.dirty) || existing.dirty,
        attention: request.attention ?? existing.attention,
        offline: request.offline ?? existing.offline,
        stale: request.stale ?? existing.stale,
        status: request.stale ? 'stale' : existing.status,
        resourceVersion: request.resourceVersion ?? existing.resourceVersion,
      }
    }
    return result(commit(state, snapshot, false), true, 'reused', `${existing.title} is already open.`)
  }

  const snapshot = cloneSnapshot(state)
  let group = chooseOpenGroup(state, request)
  if (group === undefined) group = createOpenGroup(snapshot, request)
  if (group === undefined) return result(state, false, 'pane_limit', 'No pane can accept this view.')

  const preview = Boolean(request.preview) && !Boolean(request.pinned) && !Boolean(request.dirty)
  if (preview) {
    const oldPreview = group.tabs.map(id => snapshot.views[id]).find(view => view?.preview)
    if (oldPreview !== undefined && oldPreview.id !== request.viewId) {
      delete snapshot.views[oldPreview.id]
      snapshot.groups[group.id] = { ...snapshot.groups[group.id]!, tabs: snapshot.groups[group.id]!.tabs.filter(id => id !== oldPreview.id) }
    }
  }
  const viewId = request.viewId && safeId(request.viewId) && snapshot.views[request.viewId] === undefined
    ? request.viewId
    : nextId(`view:${request.kind}`, Object.keys(snapshot.views))
  const duplicateCount = request.duplicate
    ? Object.values(snapshot.views).filter(candidate => candidate.kind === request.kind && candidate.resourceKey === request.resourceKey).length + 1
    : 0
  const view: PaneViewInstanceV1 = {
    id: viewId,
    kind: request.kind,
    resourceKey: request.resourceKey,
    role: request.role,
    region: group.region,
    groupId: group.id,
    title: (request.title ?? request.resourceKey).slice(0, 160),
    retention: request.retention,
    singleton: request.singleton,
    preview,
    pinned: Boolean(request.pinned) || Boolean(request.dirty),
    dirty: Boolean(request.dirty),
    duplicate: Boolean(request.duplicate),
    closePolicy: request.closePolicy ?? 'allow',
    status: request.stale ? 'stale' : 'ready',
    attention: Boolean(request.attention),
    offline: Boolean(request.offline),
    stale: Boolean(request.stale),
    resourceVersion: request.resourceVersion,
    instanceLabel: request.instanceLabel ?? (request.duplicate ? `${duplicateCount}` : undefined),
    metadata: request.metadata,
  }
  addViewToGroup(snapshot, view, group.id)
  snapshot.activeRegion = group.region
  snapshot.activeGroupId = group.id
  snapshot.regions[group.region] = { ...snapshot.regions[group.region], visible: true }
  const next = commit(state, snapshot)
  return result(next, true, existing === undefined ? 'opened' : 'duplicated', `${view.title} opened in ${group.role} pane.`)
}

function applyCloseView(state: PaneWorkspaceV1, intent: Extract<PaneWorkspaceIntentV1, { type: 'close_view' }>): PaneWorkspaceReducerResultV1 {
  const view = viewFor(state, intent.viewId)
  if (view === undefined) return result(state, false, 'unknown_view')
  if (view.dirty && intent.decision !== 'allow') {
    return result(state, false, intent.decision === 'deny' ? 'close_denied' : 'confirmation_required', 'This view has unsaved changes.')
  }
  if (view.closePolicy === 'deny' && intent.decision !== 'allow') return result(state, false, 'close_denied', 'The view owner does not allow closing this view yet.')
  const snapshot = cloneSnapshot(state)
  const group = snapshot.groups[view.groupId]
  removeViewFromGroup(snapshot, view.id)
  delete snapshot.views[view.id]
  if (group !== undefined && group.tabs.length <= 1 && !group.locked) removeGroup(snapshot, group.id)
  const next = commit(state, snapshot)
  return result(next, true, 'closed', `${view.title} closed.`)
}

function applyBulkClose(state: PaneWorkspaceV1, intent: Extract<PaneWorkspaceIntentV1, { type: 'bulk_close' }>): PaneWorkspaceReducerResultV1 {
  const preflight = preflightBulkClose(state, intent.groupId, intent.mode, intent.sourceViewId, intent.decision)
  if (!preflight.accepted) {
    const blocker = preflight.blockerViewId === undefined ? undefined : state.views[preflight.blockerViewId]
    return result(state, false, preflight.reason, blocker === undefined ? 'No tabs can be closed.' : `${blocker.title} blocks bulk close.`)
  }
  const snapshot = cloneSnapshot(state)
  for (const viewId of preflight.targetIds) {
    removeViewFromGroup(snapshot, viewId)
    delete snapshot.views[viewId]
  }
  const group = snapshot.groups[intent.groupId]
  if (group !== undefined && group.tabs.length === 0 && !group.locked) removeGroup(snapshot, group.id)
  return result(commit(state, snapshot), true, 'closed', `${preflight.targetIds.length} tabs closed.`)
}

function applyMoveView(state: PaneWorkspaceV1, intent: Extract<PaneWorkspaceIntentV1, { type: 'move_view' | 'reorder_view' }>): PaneWorkspaceReducerResultV1 {
  const view = viewFor(state, intent.viewId)
  const target = groupFor(state, intent.targetGroupId)
  if (view === undefined || target === undefined || target.locked && target.role !== view.role) return result(state, false, 'invalid_move')
  const snapshot = cloneSnapshot(state)
  const oldGroup = snapshot.groups[view.groupId]
  if (oldGroup === undefined) return result(state, false, 'invalid_move')
  const index = 'index' in intent ? intent.index : undefined
  removeViewFromGroup(snapshot, view.id)
  addViewToGroup(snapshot, { ...view, region: target.region, groupId: target.id }, target.id, index)
  if (oldGroup.id !== target.id && oldGroup.tabs.length <= 1 && !oldGroup.locked) removeGroup(snapshot, oldGroup.id)
  activate(snapshot, view.id)
  return result(commit(state, snapshot), true, 'moved', `${view.title} moved to ${target.role} pane.`)
}

function applySplitWithView(state: PaneWorkspaceV1, intent: Extract<PaneWorkspaceIntentV1, { type: 'split_with_view' }>): PaneWorkspaceReducerResultV1 {
  const view = viewFor(state, intent.viewId)
  const target = groupFor(state, intent.targetGroupId)
  if (view === undefined || target === undefined || visibleGroupCount(state) >= PANE_WORKSPACE_LIMITS.maxVisibleGroups) return result(state, false, 'pane_limit')
  const snapshot = cloneSnapshot(state)
  const newGroupId = nextId(`group:${target.region}:${view.role}`, Object.keys(snapshot.groups))
  snapshot.groups[newGroupId] = defaultGroup(newGroupId, target.region, view.role)
  if (!insertSplit(snapshot, target.region, target.id, newGroupId, intent.edge)) {
    delete snapshot.groups[newGroupId]
    return result(state, false, 'split_limit', 'This pane cannot be split further.')
  }
  const oldGroup = snapshot.groups[view.groupId]
  removeViewFromGroup(snapshot, view.id)
  addViewToGroup(snapshot, { ...view, groupId: newGroupId, region: target.region }, newGroupId)
  if (oldGroup !== undefined && oldGroup.tabs.length <= 1 && !oldGroup.locked) removeGroup(snapshot, oldGroup.id)
  activate(snapshot, view.id)
  return result(commit(state, snapshot), true, 'split', `${view.title} moved into a new pane.`)
}

function draftIssue(code: string, message: string): PaneWorkspaceDraftIssueV1 {
  return { severity: 'error', code, message }
}

export interface ApplyWorkspaceDraftValidationV1 {
  readonly ok: boolean
  readonly blockers: readonly PaneWorkspaceDraftIssueV1[]
  readonly warnings: readonly PaneWorkspaceDraftIssueV1[]
}

/**
 * 原子 Apply 必须先聚合全部 blocker。generation 漂移、depth/group/size、
 * capability、core/dirty/deny 任一失败都不得部分改 layout。
 */
export function validateApplyWorkspaceDraft(
  state: PaneWorkspaceV1,
  intent: PaneWorkspaceDraftIntentV1,
): ApplyWorkspaceDraftValidationV1 {
  const blockers: PaneWorkspaceDraftIssueV1[] = []
  const warnings = [...intent.draft.validation.warnings]
  if (intent.expectedGeneration !== state.generation || intent.draft.baseGeneration !== state.generation) {
    blockers.push(draftIssue('generation_drift', 'Draft base generation no longer matches the live workspace.'))
  }
  if (!intent.draft.validation.ok) blockers.push(...intent.draft.validation.errors)
  for (const region of ['right', 'bottom'] as const) {
    const size = intent.draft.regions[region].size
    if (size < PANE_WORKSPACE_LIMITS.minRegionRatio || size > PANE_WORKSPACE_LIMITS.maxRegionRatio) {
      blockers.push(draftIssue('size', `${region} size is outside the allowed ratio.`))
    }
  }
  const liveProtected = Object.values(state.views).filter(view => view.closePolicy === 'deny' || view.dirty)
  if (liveProtected.length > 0 && intent.draft.providerPlacements.every(placement => placement.kind !== 'keep-in-place')) {
    const closer = liveProtected[0]
    if (closer !== undefined && intent.draft.groups[closer.groupId] === undefined) {
      blockers.push(draftIssue(closer.closePolicy === 'deny' ? 'deny' : 'dirty', `${closer.title} must stay in place.`))
    }
  }
  return { ok: blockers.length === 0, blockers, warnings }
}

export function applyWorkspaceDraft(
  state: PaneWorkspaceV1,
  intent: PaneWorkspaceDraftIntentV1,
): PaneWorkspaceReducerResultV1 {
  const report = validateApplyWorkspaceDraft(state, intent)
  if (!report.ok) {
    return result(state, false, report.blockers[0]?.code ?? 'apply_blocked', report.blockers[0]?.message ?? 'Workspace draft was not applied.')
  }
  const snapshot = cloneSnapshot(state)
  snapshot.regions.right = { ...snapshot.regions.right, ...intent.draft.regions.right, root: intent.draft.regions.right.root }
  snapshot.regions.bottom = { ...snapshot.regions.bottom, ...intent.draft.regions.bottom, root: intent.draft.regions.bottom.root }
  return result(commit(state, snapshot), true, 'applied', 'Workspace draft applied.')
}

export function createApplyWorkspaceDraftIntent(
  draft: PaneWorkspaceDraftV1,
  expectedGeneration: number,
): PaneWorkspaceDraftIntentV1 {
  return {
    type: PANE_WORKSPACE_DRAFT_INTENT,
    draft,
    expectedGeneration,
  }
}

export function reducePaneWorkspace(state: PaneWorkspaceV1, intent: PaneWorkspaceIntentV1Additive): PaneWorkspaceReducerResultV1 {
  switch (intent.type) {
    case PANE_WORKSPACE_DRAFT_INTENT:
      return applyWorkspaceDraft(state, intent)
    case 'open_view': return applyOpenView(state, intent.request)
    case 'close_view': return applyCloseView(state, intent)
    case 'bulk_close': return applyBulkClose(state, intent)
    case 'move_view':
    case 'reorder_view': return applyMoveView(state, intent)
    case 'split_with_view': return applySplitWithView(state, intent)
    case 'activate_view': {
      const snapshot = cloneSnapshot(state)
      return activate(snapshot, intent.viewId) ? result(commit(state, snapshot, false), true) : result(state, false, 'unknown_view')
    }
    case 'pin_view': {
      const view = viewFor(state, intent.viewId)
      if (view === undefined) return result(state, false, 'unknown_view')
      const snapshot = cloneSnapshot(state)
      const pinned = intent.pinned ?? !view.pinned
      const nextView = { ...view, pinned, preview: pinned ? false : view.preview }
      snapshot.views[view.id] = nextView
      const group = snapshot.groups[view.groupId]
      if (group !== undefined) {
        const tabs = group.tabs.filter(id => id !== view.id)
        const lastPinned = tabs.reduce((last, id, current) => snapshot.views[id]?.pinned ? current : last, -1)
        tabs.splice(pinned ? lastPinned + 1 : lastPinned + 1, 0, view.id)
        snapshot.groups[group.id] = { ...group, tabs }
      }
      return result(commit(state, snapshot, false), true, pinned ? 'pinned' : 'unpinned')
    }
    case 'set_view_dirty': {
      const view = viewFor(state, intent.viewId)
      if (view === undefined) return result(state, false, 'unknown_view')
      const snapshot = cloneSnapshot(state)
      snapshot.views[view.id] = { ...view, dirty: intent.dirty, pinned: intent.dirty || view.pinned, preview: intent.dirty ? false : view.preview }
      return result(commit(state, snapshot, false), true, intent.dirty ? 'dirty' : 'clean')
    }
    case 'move_group': {
      const group = groupFor(state, intent.groupId)
      if (group === undefined || group.region === intent.targetRegion || visibleGroupCount(state) >= PANE_WORKSPACE_LIMITS.maxVisibleGroups) return result(state, false, 'invalid_move')
      const snapshot = cloneSnapshot(state)
      const oldRoot = snapshot.regions[group.region].root
      const nextOldRoot = removeGroupNode(oldRoot, group.id)
      if (nextOldRoot === undefined) return result(state, false, 'invalid_move')
      snapshot.regions[group.region] = { ...snapshot.regions[group.region], root: nextOldRoot }
      snapshot.groups[group.id] = { ...group, region: intent.targetRegion }
      const targetRegion = snapshot.regions[intent.targetRegion]
      snapshot.regions[intent.targetRegion] = {
        ...targetRegion,
        visible: true,
        root: {
          type: 'split',
          id: nextId(`split:${intent.targetRegion}`, collectNodeIds(targetRegion.root)),
          orientation: 'vertical',
          ratio: 0.5,
          first: targetRegion.root,
          second: { type: 'group', groupId: group.id },
        },
      }
      for (const viewId of group.tabs) snapshot.views[viewId] = { ...snapshot.views[viewId]!, region: intent.targetRegion }
      activate(snapshot, group.activeTabId ?? group.tabs[0] ?? '')
      return result(commit(state, snapshot), true, 'moved', `Pane group moved to ${intent.targetRegion}.`)
    }
    case 'lock_group': {
      const group = groupFor(state, intent.groupId)
      if (group === undefined) return result(state, false, 'unknown_group')
      const snapshot = cloneSnapshot(state)
      snapshot.groups[group.id] = { ...group, locked: intent.locked }
      return result(commit(state, snapshot, false), true, intent.locked ? 'locked' : 'unlocked')
    }
    case 'resize_split': {
      const region = state.regions[intent.region]
      const split = findSplit(region.root, intent.splitId)
      if (split === undefined || split.type !== 'split') return result(state, false, 'unknown_split')
      const snapshot = cloneSnapshot(state)
      snapshot.regions[intent.region] = {
        ...snapshot.regions[intent.region],
        root: replaceNode(snapshot.regions[intent.region].root, node => node.type === 'split' && node.id === intent.splitId, {
          type: 'split',
          id: split.id,
          orientation: split.orientation,
          ratio: clamp(intent.ratio, PANE_WORKSPACE_LIMITS.minSplitRatio, PANE_WORKSPACE_LIMITS.maxSplitRatio),
          first: split.first,
          second: split.second,
        }),
      }
      return result(commit(state, snapshot), true, 'resized')
    }
    case 'resize_region': {
      const snapshot = cloneSnapshot(state)
      snapshot.regions[intent.region] = { ...snapshot.regions[intent.region], size: clamp(intent.size, PANE_WORKSPACE_LIMITS.minRegionRatio, PANE_WORKSPACE_LIMITS.maxRegionRatio) }
      return result(commit(state, snapshot), true, 'resized')
    }
    case 'set_region_visibility': {
      const snapshot = cloneSnapshot(state)
      snapshot.regions[intent.region] = { ...snapshot.regions[intent.region], visible: intent.visible }
      if (intent.visible) snapshot.activeRegion = intent.region
      return result(commit(state, snapshot), true, intent.visible ? 'shown' : 'hidden')
    }
    case 'maximize_group': {
      if (groupFor(state, intent.groupId) === undefined) return result(state, false, 'unknown_group')
      const snapshot = cloneSnapshot(state)
      snapshot.maximizedGroupId = intent.groupId
      activate(snapshot, snapshot.groups[intent.groupId]?.activeTabId ?? '')
      return result(commit(state, snapshot, false), true, 'maximized')
    }
    case 'restore_layout': {
      if (state.maximizedGroupId === undefined) return result(state, true, 'already_restored')
      const snapshot = cloneSnapshot(state)
      snapshot.maximizedGroupId = undefined
      return result(commit(state, snapshot, false), true, 'restored')
    }
    case 'reset_layout': return result(materialize(state.generation, defaultSnapshot(), [snapshotOf(state), ...state.history]), true, 'reset', 'Pane layout reset.')
    case 'undo_layout': {
      const previous = state.history[0]
      if (previous === undefined) return result(state, false, 'no_history')
      return result(materialize(state.generation, previous, state.history.slice(1)), true, 'undone', 'Previous pane layout restored.')
    }
  }
}

export const applyPaneWorkspaceIntent = reducePaneWorkspace

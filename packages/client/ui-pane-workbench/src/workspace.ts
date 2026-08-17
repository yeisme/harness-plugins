import type { JsonValue, PaneViewDescriptorV1 } from '@yeisme/dsh-pane-protocol'

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
  readonly status: 'ready' | 'orphaned'
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

export type PaneWorkspaceIntentV1 =
  | { readonly type: 'open_view'; readonly request: PaneViewSpecV1 }
  | { readonly type: 'activate_view'; readonly viewId: string }
  | { readonly type: 'pin_view'; readonly viewId: string; readonly pinned?: boolean }
  | { readonly type: 'set_view_dirty'; readonly viewId: string; readonly dirty: boolean }
  | { readonly type: 'close_view'; readonly viewId: string; readonly decision?: 'allow' | 'confirm' | 'deny' }
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

function regionOrientation(region: PaneRegionId): PaneSplitOrientation {
  return region === 'right' ? 'horizontal' : 'vertical'
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
        visible: true,
        size: 0.32,
        root: {
          type: 'split',
          id: 'split:right:root',
          orientation: 'horizontal',
          ratio: 0.32,
          first: { type: 'group', groupId: navigator.id },
          second: { type: 'group', groupId: content.id },
        },
      },
      bottom: {
        id: 'bottom',
        visible: false,
        size: 0.35,
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
      status: view.status === 'orphaned' ? 'orphaned' : 'ready',
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
  const orientation = input.orientation === 'vertical' ? 'vertical' : 'horizontal'
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
  const targetIndex = index === undefined ? tabs.length : Math.max(0, Math.min(index, tabs.length))
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
    view.resourceKey === request.resourceKey || (request.singleton && view.singleton)
  ))
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
    const orientation = regionOrientation(region)
    snapshot.regions[region] = {
      ...snapshot.regions[region],
      root: {
        type: 'split',
        id: nextId(`split:${region}`, collectNodeIds(root)),
        orientation,
        ratio: 0.5,
        first: root,
        second: { type: 'group', groupId: id },
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
    if (request.pinned || request.dirty) snapshot.views[existing.id] = { ...existing, pinned: true, preview: false, dirty: Boolean(request.dirty) || existing.dirty }
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
    status: 'ready',
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

export function reducePaneWorkspace(state: PaneWorkspaceV1, intent: PaneWorkspaceIntentV1): PaneWorkspaceReducerResultV1 {
  switch (intent.type) {
    case 'open_view': return applyOpenView(state, intent.request)
    case 'close_view': return applyCloseView(state, intent)
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
      snapshot.views[view.id] = { ...view, pinned, preview: pinned ? false : view.preview }
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
          orientation: regionOrientation(intent.targetRegion),
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

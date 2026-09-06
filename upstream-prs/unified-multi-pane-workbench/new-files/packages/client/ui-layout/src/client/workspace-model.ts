/** Browser presentation state only. No conversation content or business actions. */
export interface PaneReference {
  id: string
  kind: string
  title: string
  icon?: string | undefined
  sessionId?: string | undefined
  workspaceId?: string | undefined
  workspaceTitle?: string | undefined
  resourceKey?: string | undefined
  pinned: boolean
}

export interface PaneGroup { id: string; panes: string[]; active: string | null }
export type LayoutNode = { type: 'group'; id: string } | {
  type: 'split'; id: string; axis: 'horizontal' | 'vertical'; ratio: number
  first: LayoutNode; second: LayoutNode
}
export interface Box { x: number; y: number; width: number; height: number }
export interface FloatingGroup extends Box { groupId: string }
export interface WorkspaceSnapshot {
  version: 1
  workspaceId: string
  root: LayoutNode | null
  groups: Record<string, PaneGroup>
  panes: Record<string, PaneReference>
  floating: FloatingGroup[]
  focused: string | null
  maximized: string | null
}
export type DockEdge = 'left' | 'right' | 'top' | 'bottom'
export type PaneDestination = { type: 'tab'; groupId: string; index?: number }
  | { type: 'split'; groupId: string; edge: DockEdge }
  | { type: 'float'; box: Box }
  | { type: 'root' }

export const MIN_PANE_WIDTH = 280
export const MIN_PANE_HEIGHT = 180

export function emptyWorkspace(workspaceId: string): WorkspaceSnapshot {
  return { version: 1, workspaceId, root: null, groups: {}, panes: {}, floating: [], focused: null, maximized: null }
}

function fresh(prefix: string, state: WorkspaceSnapshot): string {
  const taken = new Set([...Object.keys(state.groups), ...Object.keys(state.panes)])
  visit(state.root, n => taken.add(n.id))
  let i = 1
  while (taken.has(`${prefix}:${i}`)) i++
  return `${prefix}:${i}`
}
function visit(node: LayoutNode | null, fn: (node: LayoutNode) => void): void {
  if (node === null) return
  fn(node)
  if (node.type === 'split') { visit(node.first, fn); visit(node.second, fn) }
}
function replace(node: LayoutNode | null, id: string, next: LayoutNode | null): LayoutNode | null {
  if (node === null || node.id === id) return node === null ? null : next
  if (node.type === 'group') return node
  const first = replace(node.first, id, next)
  const second = replace(node.second, id, next)
  if (first === null) return second
  if (second === null) return first
  return { ...node, first, second }
}
export function groupForPane(state: WorkspaceSnapshot, paneId: string): PaneGroup | undefined {
  return Object.values(state.groups).find(g => g.panes.includes(paneId))
}
function prune(state: WorkspaceSnapshot): void {
  for (const group of Object.values(state.groups)) {
    if (group.panes.length > 0) continue
    state.root = replace(state.root, group.id, null)
    state.floating = state.floating.filter(f => f.groupId !== group.id)
    delete state.groups[group.id]
  }
  if (state.focused !== null && state.groups[state.focused] === undefined) state.focused = Object.keys(state.groups)[0] ?? null
  if (state.maximized !== null && state.groups[state.maximized] === undefined) state.maximized = null
}
function newGroup(state: WorkspaceSnapshot, panes: string[]): PaneGroup {
  const group = { id: fresh('group', state), panes, active: panes[0] ?? null }
  state.groups[group.id] = group
  return group
}
function removeFromGroup(group: PaneGroup, paneId: string): void {
  const index = group.panes.indexOf(paneId)
  group.panes = group.panes.filter(id => id !== paneId)
  if (group.active === paneId) group.active = group.panes[Math.min(index, group.panes.length - 1)] ?? null
}

/** Focus is presentation-only; selecting a Pane never switches another Session binding. */
export function focusPane(input: WorkspaceSnapshot, paneId: string): WorkspaceSnapshot {
  const found = groupForPane(input, paneId)
  if (found === undefined) return input
  const state = structuredClone(input)
  state.groups[found.id]!.active = paneId
  state.focused = found.id
  if (state.maximized !== null && state.maximized !== found.id) state.maximized = null
  const float = state.floating.find(f => f.groupId === found.id)
  if (float !== undefined) state.floating = [...state.floating.filter(f => f !== float), float]
  return state
}

/** Preview replacement only removes an unpinned conversation view, never its Session. */
export function openPane(input: WorkspaceSnapshot, reference: PaneReference): WorkspaceSnapshot {
  const existing = Object.values(input.panes).find(p => p.id === reference.id
    || (reference.kind === 'conversation' && p.kind === 'conversation' && p.sessionId === reference.sessionId))
  if (existing !== undefined) return focusPane(input, existing.id)
  const state = structuredClone(input)
  let group = state.focused === null ? undefined : state.groups[state.focused]
  if (group === undefined) {
    group = newGroup(state, [])
    state.root = { type: 'group', id: group.id }
  }
  if (reference.kind === 'conversation' && !reference.pinned) {
    const preview = group.panes.find(id => state.panes[id]?.kind === 'conversation' && !state.panes[id]?.pinned)
    if (preview !== undefined) {
      const index = group.panes.indexOf(preview)
      group.panes.splice(index, 1, reference.id)
      delete state.panes[preview]
    } else group.panes.push(reference.id)
  } else group.panes.push(reference.id)
  state.panes[reference.id] = { ...reference }
  group.active = reference.id
  state.focused = group.id
  return state
}

/** Atomic drop: invalid destinations return the original state unchanged. */
export function movePane(input: WorkspaceSnapshot, paneId: string, destination: PaneDestination): WorkspaceSnapshot {
  const source = groupForPane(input, paneId)
  if (source === undefined) return input
  if (destination.type !== 'float' && destination.type !== 'root' && input.groups[destination.groupId] === undefined) return input
  if (destination.type === 'root' && input.root !== null) return input
  if (destination.type === 'split' && source.id === destination.groupId && source.panes.length === 1) return input
  const state = structuredClone(input)
  removeFromGroup(state.groups[source.id]!, paneId)
  state.panes[paneId]!.pinned = true
  let group: PaneGroup
  if (destination.type === 'tab') {
    group = state.groups[destination.groupId]!
    const index = Math.max(0, Math.min(destination.index ?? group.panes.length, group.panes.length))
    group.panes.splice(index, 0, paneId)
    group.active = paneId
  } else {
    group = newGroup(state, [paneId])
    if (destination.type === 'root') {
      state.root = { type: 'group', id: group.id }
    } else if (destination.type === 'float') {
      state.floating.push({ ...destination.box, groupId: group.id })
    } else {
      const leaf: LayoutNode = { type: 'group', id: group.id }
      const target: LayoutNode = { type: 'group', id: destination.groupId }
      const before = destination.edge === 'left' || destination.edge === 'top'
      const split: LayoutNode = {
        type: 'split', id: fresh('split', state), ratio: 0.5,
        axis: destination.edge === 'left' || destination.edge === 'right' ? 'horizontal' : 'vertical',
        first: before ? leaf : target, second: before ? target : leaf,
      }
      // Floating groups accept tabs; splitting a floating group first docks it.
      const float = state.floating.find(f => f.groupId === destination.groupId)
      if (float !== undefined) return input
      state.root = replace(state.root, destination.groupId, split)
    }
  }
  state.focused = group.id
  state.maximized = null
  prune(state)
  return state
}

/** Move a whole floating group without changing Pane identities or their relative order. */
export function dockGroup(input: WorkspaceSnapshot, groupId: string, destination: PaneDestination): WorkspaceSnapshot {
  const group = input.groups[groupId]
  if (!group || !input.floating.some(f => f.groupId === groupId) || destination.type === 'float') return input
  if (destination.type !== 'root' && destination.groupId === groupId) return input
  let state = movePane(input, group.panes[0]!, destination)
  if (state === input) return input
  const target = groupForPane(state, group.panes[0]!)!
  const insertion = target.panes.indexOf(group.panes[0]!)
  for (const [offset, id] of group.panes.slice(1).entries()) state = movePane(state, id, { type: 'tab', groupId: target.id, index: insertion + offset + 1 })
  return focusPane(state, group.active ?? group.panes[0]!)
}

export function closePane(input: WorkspaceSnapshot, paneId: string): WorkspaceSnapshot {
  const found = groupForPane(input, paneId)
  if (found === undefined) return input
  const state = structuredClone(input)
  removeFromGroup(state.groups[found.id]!, paneId)
  delete state.panes[paneId]
  prune(state)
  return state
}

export function minimumSize(node: LayoutNode, state: WorkspaceSnapshot): { width: number; height: number } {
  if (node.type === 'group') return { width: MIN_PANE_WIDTH, height: MIN_PANE_HEIGHT }
  const a = minimumSize(node.first, state), b = minimumSize(node.second, state)
  return node.axis === 'horizontal'
    ? { width: a.width + b.width + 4, height: Math.max(a.height, b.height) }
    : { width: Math.max(a.width, b.width), height: a.height + b.height + 4 }
}

function comfortableWidth(node: LayoutNode, state: WorkspaceSnapshot): number {
  if (node.type === 'group') return state.groups[node.id]?.panes.some(id => state.panes[id]?.kind === 'conversation') ? 400 : 320
  const a = comfortableWidth(node.first, state), b = comfortableWidth(node.second, state)
  return node.axis === 'horizontal' ? a + b + 4 : Math.max(a, b)
}

/** Responsive presentation only: saved topology and preferred ratios stay intact. */
export function layoutAxis(node: Extract<LayoutNode, { type: 'split' }>, state: WorkspaceSnapshot, box: Box): 'horizontal' | 'vertical' {
  const a = minimumSize(node.first, state), b = minimumSize(node.second, state)
  const readableWidth = comfortableWidth(node.first, state) + comfortableWidth(node.second, state) + 4
  if (node.axis === 'horizontal' && box.width < readableWidth
    && box.height >= a.height + b.height + 4) return 'vertical'
  if (node.axis === 'vertical' && box.height < a.height + b.height + 4
    && box.width >= readableWidth) return 'horizontal'
  return node.axis
}

/** One geometry projection feeds rendering, resize limits, and coordinate hit testing. */
export function layoutBoxes(state: WorkspaceSnapshot, viewport: Box): Record<string, Box> {
  const boxes: Record<string, Box> = {}
  const walk = (node: LayoutNode, box: Box): void => {
    boxes[node.id] = box
    if (node.type === 'group') return
    const horizontal = layoutAxis(node, state, box) === 'horizontal'
    const size = horizontal ? box.width : box.height
    const available = Math.max(0, size - 4)
    const a = minimumSize(node.first, state), b = minimumSize(node.second, state)
    const minA = horizontal ? a.width : a.height, minB = horizontal ? b.width : b.height
    const preferred = available * node.ratio
    const firstSize = available >= minA + minB ? Math.max(minA, Math.min(preferred, available - minB)) : preferred
    walk(node.first, horizontal ? { ...box, width: firstSize } : { ...box, height: firstSize })
    walk(node.second, horizontal
      ? { ...box, x: box.x + firstSize + 4, width: Math.max(0, size - firstSize - 4) }
      : { ...box, y: box.y + firstSize + 4, height: Math.max(0, size - firstSize - 4) })
  }
  if (state.root !== null) walk(state.root, viewport)
  for (const float of state.floating) boxes[float.groupId] = clampBox(float, viewport)
  if (state.maximized !== null) boxes[state.maximized] = viewport
  return boxes
}

export function clampBox(box: Box, viewport: Box): Box {
  const width = Math.min(viewport.width, Math.max(MIN_PANE_WIDTH, box.width))
  const height = Math.min(viewport.height, Math.max(MIN_PANE_HEIGHT, box.height))
  return { width, height,
    x: Math.max(viewport.x, Math.min(box.x, viewport.x + viewport.width - width)),
    y: Math.max(viewport.y, Math.min(box.y, viewport.y + viewport.height - height)) }
}

/** Strict browser-storage boundary. Reject corrupt graphs and duplicate references. */
export function readWorkspace(raw: string, workspaceId: string): WorkspaceSnapshot | undefined {
  try {
    const state = JSON.parse(raw) as WorkspaceSnapshot
    if (state.version !== 1 || state.workspaceId !== workspaceId || !state.groups || !state.panes || !Array.isArray(state.floating)) return undefined
    const nodes = new Set<string>(), groups = new Set<string>(), panes = new Set<string>(), sessions = new Set<string>()
    const check = (node: LayoutNode, depth = 0): boolean => {
      if (!node || typeof node.id !== 'string' || nodes.has(node.id) || depth > 32) return false
      nodes.add(node.id)
      if (node.type === 'group') { groups.add(node.id); return true }
      return node.type === 'split' && ['horizontal', 'vertical'].includes(node.axis)
        && Number.isFinite(node.ratio) && node.ratio > 0 && node.ratio < 1
        && check(node.first, depth + 1) && check(node.second, depth + 1)
    }
    if (state.root !== null && !check(state.root)) return undefined
    for (const f of state.floating) {
      if (groups.has(f.groupId) || ![f.x, f.y, f.width, f.height].every(Number.isFinite) || f.width <= 0 || f.height <= 0) return undefined
      groups.add(f.groupId)
    }
    for (const [id, group] of Object.entries(state.groups)) {
      if (id !== group.id || !groups.has(id) || !Array.isArray(group.panes) || group.panes.length === 0 || !group.panes.includes(group.active!)) return undefined
      for (const paneId of group.panes) {
        const p = state.panes[paneId]
        if (panes.has(paneId) || !p || p.id !== paneId || typeof p.kind !== 'string' || typeof p.title !== 'string' || typeof p.pinned !== 'boolean') return undefined
        if (p.kind === 'conversation' && typeof p.sessionId !== 'string') return undefined
        if (p.kind === 'conversation') {
          if (sessions.has(p.sessionId!)) return undefined
          sessions.add(p.sessionId!)
        }
        panes.add(paneId)
      }
    }
    if (groups.size !== Object.keys(state.groups).length || panes.size !== Object.keys(state.panes).length) return undefined
    if (state.focused !== null && !groups.has(state.focused)) return undefined
    if (state.maximized !== null && !groups.has(state.maximized)) return undefined
    return state
  } catch { return undefined }
}

/** Whitelisted record: even a caller's extra fields never copy drafts or payloads to storage. */
export function serializeWorkspace(state: WorkspaceSnapshot): string {
  const panes = Object.fromEntries(Object.entries(state.panes).map(([id, p]) => [id, {
    id: p.id, kind: p.kind, title: p.title, icon: p.icon, sessionId: p.sessionId,
    workspaceId: p.workspaceId, workspaceTitle: p.workspaceTitle, resourceKey: p.resourceKey, pinned: p.pinned,
  }]))
  return JSON.stringify({ version: 1, workspaceId: state.workspaceId, root: state.root,
    groups: state.groups, panes, floating: state.floating, focused: state.focused, maximized: state.maximized })
}

export const EXPLORER_TREE_CACHE_LIMIT = 4_096
export const EXPLORER_TREE_ROW_HEIGHT_DESKTOP = 28
export const EXPLORER_TREE_ROW_HEIGHT_COARSE = 44

export type ExplorerTreeFreshnessV1 = 'fresh' | 'stale' | 'offline' | 'unknown' | 'contract_mismatch' | 'reconcile_required'
export type ExplorerTreeNodeKindV1 = 'file' | 'directory' | 'symlink'

export interface ExplorerTreeNodeV1 {
  readonly ref: string
  readonly parentRef?: string
  readonly name: string
  readonly kind: ExplorerTreeNodeKindV1
  readonly version: string
  readonly hasChildren: boolean
  readonly capabilities: readonly string[]
  readonly freshness: ExplorerTreeFreshnessV1
  readonly gitDecoration?: string
  readonly hidden?: boolean
  readonly ignored?: boolean
  readonly sensitive?: boolean
  readonly availability?: {
    readonly inspect?: 'available' | 'disabled' | 'unavailable' | 'stale'
    readonly preview?: 'available' | 'disabled' | 'unavailable' | 'stale'
    readonly download?: 'available' | 'disabled' | 'unavailable' | 'stale'
    readonly mutate?: 'available' | 'disabled' | 'unavailable' | 'stale'
    readonly reason?: string
  }
  readonly symlink?: { readonly broken: boolean; readonly outOfScope: boolean; readonly targetRef?: string }
}

export interface ExplorerTreeWatchEventV1 {
  readonly cursor: string
  readonly sequence: number
  readonly op: 'created' | 'changed' | 'deleted' | 'renamed'
  readonly entryRef: string
  readonly parentRef?: string
  readonly version?: string
}

export interface ExplorerScrollAnchorV1 {
  readonly ref: string
  readonly offset: number
}

export interface ExplorerTreeStateV1 {
  readonly roots: readonly string[]
  readonly nodes: Readonly<Record<string, ExplorerTreeNodeV1>>
  readonly children: Readonly<Record<string, readonly string[]>>
  readonly expandedRefs: readonly string[]
  readonly selectedRef?: string
  readonly primaryRef?: string
  readonly checkedRefs: readonly string[]
  readonly focusedRef?: string
  readonly filter: string
  readonly loadingRefs: readonly string[]
  readonly errors: Readonly<Record<string, string>>
  readonly freshness: ExplorerTreeFreshnessV1
  readonly cursor?: string
  readonly sequence: number
  readonly scrollAnchor?: ExplorerScrollAnchorV1
}

export type ExplorerTreeIntentV1 =
  | { readonly type: 'hydrate_roots'; readonly nodes: readonly ExplorerTreeNodeV1[] }
  | { readonly type: 'children_loading'; readonly ref: string }
  | { readonly type: 'children_ready'; readonly ref: string; readonly nodes: readonly ExplorerTreeNodeV1[] }
  | { readonly type: 'children_error'; readonly ref: string; readonly reason: string }
  | { readonly type: 'expand'; readonly ref: string }
  | { readonly type: 'collapse'; readonly ref: string }
  | { readonly type: 'select'; readonly ref?: string }
  | { readonly type: 'set_primary'; readonly ref?: string }
  | { readonly type: 'toggle_checked'; readonly ref: string }
  | { readonly type: 'focus'; readonly ref?: string }
  | { readonly type: 'filter'; readonly query: string }
  | { readonly type: 'watch'; readonly event: ExplorerTreeWatchEventV1 }
  | { readonly type: 'set_scroll_anchor'; readonly anchor: ExplorerScrollAnchorV1 }
  | { readonly type: 'retry'; readonly ref: string }

export interface ExplorerTreeRowV1 {
  readonly ref: string
  readonly depth: number
  readonly expanded: boolean
  readonly selected: boolean
  readonly checked: boolean
  readonly primary: boolean
  readonly focused: boolean
  readonly loading: boolean
  readonly error?: string
  readonly node: ExplorerTreeNodeV1
}

const OPAQUE = /^[A-Za-z0-9._~:-]{1,160}$/

export function createExplorerTreeState(): ExplorerTreeStateV1 {
  return {
    roots: [],
    nodes: {},
    children: {},
    expandedRefs: [],
    selectedRef: undefined,
    primaryRef: undefined,
    checkedRefs: [],
    focusedRef: undefined,
    filter: '',
    loadingRefs: [],
    errors: {},
    freshness: 'unknown',
    sequence: 0,
  }
}

function looksUnsafe(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\') || /file:\/\/|authorization|cookie|token/i.test(value)
}

export function isSafeExplorerTreeNode(node: ExplorerTreeNodeV1): boolean {
  if (!OPAQUE.test(node.ref) || looksUnsafe(node.ref) || looksUnsafe(node.name) || node.version.length === 0) return false
  if (node.parentRef !== undefined && (!OPAQUE.test(node.parentRef) || looksUnsafe(node.parentRef))) return false
  return node.name.length > 0 && node.name.length <= 200 && !node.name.includes('/') && !node.name.includes('\\')
}

function acceptNodes(nodes: readonly ExplorerTreeNodeV1[]): {
  readonly accepted: ExplorerTreeNodeV1[]
  readonly rejected: number
} {
  const accepted: ExplorerTreeNodeV1[] = []
  let rejected = 0
  for (const node of nodes) {
    if (isSafeExplorerTreeNode(node)) accepted.push(node)
    else rejected += 1
  }
  return { accepted, rejected }
}

function evictCache(state: ExplorerTreeStateV1): ExplorerTreeStateV1 {
  const keys = Object.keys(state.nodes)
  if (keys.length <= EXPLORER_TREE_CACHE_LIMIT) return state
  const keep = new Set<string>([...state.roots, ...state.expandedRefs, ...state.checkedRefs, state.primaryRef ?? '', state.selectedRef ?? '', state.focusedRef ?? '', state.scrollAnchor?.ref ?? ''])
  for (const ref of state.expandedRefs) {
    for (const child of state.children[ref] ?? []) keep.add(child)
  }
  const nodes: Record<string, ExplorerTreeNodeV1> = {}
  const children: Record<string, readonly string[]> = {}
  for (const [ref, node] of Object.entries(state.nodes)) {
    if (keep.has(ref) || keep.has(node.parentRef ?? '')) nodes[ref] = node
  }
  for (const [ref, list] of Object.entries(state.children)) {
    if (nodes[ref] !== undefined) children[ref] = list.filter(item => nodes[item] !== undefined)
  }
  return { ...state, nodes, children }
}

function mergeNodes(state: ExplorerTreeStateV1, nodes: readonly ExplorerTreeNodeV1[]): ExplorerTreeStateV1 {
  const nextNodes = { ...state.nodes }
  for (const node of nodes) nextNodes[node.ref] = node
  return evictCache({ ...state, nodes: nextNodes })
}

function setChildren(state: ExplorerTreeStateV1, parent: string, nodes: readonly ExplorerTreeNodeV1[]): ExplorerTreeStateV1 {
  const merged = mergeNodes(state, nodes)
  const { [parent]: _removed, ...errors } = merged.errors
  return {
    ...merged,
    children: { ...merged.children, [parent]: nodes.map(node => node.ref) },
    loadingRefs: merged.loadingRefs.filter(ref => ref !== parent),
    errors,
  }
}

export function flattenExplorerTree(state: ExplorerTreeStateV1): readonly ExplorerTreeRowV1[] {
  const rows: ExplorerTreeRowV1[] = []
  const needle = state.filter.trim().toLowerCase()
  const visit = (refs: readonly string[], depth: number): void => {
    for (const ref of refs) {
      const node = state.nodes[ref]
      if (node === undefined) continue
      const expanded = state.expandedRefs.includes(ref)
      const matches = needle.length === 0 || node.name.toLowerCase().includes(needle)
      if (matches || expanded) {
        rows.push({
          ref,
          depth,
          expanded,
          selected: state.selectedRef === ref,
          checked: state.checkedRefs.includes(ref),
          primary: state.primaryRef === ref,
          focused: state.focusedRef === ref,
          loading: state.loadingRefs.includes(ref),
          error: state.errors[ref],
          node,
        })
      }
      if (expanded) visit(state.children[ref] ?? [], depth + 1)
    }
  }
  visit(state.roots, 0)
  return rows
}

export function reduceExplorerTree(state: ExplorerTreeStateV1, intent: ExplorerTreeIntentV1): ExplorerTreeStateV1 {
  switch (intent.type) {
    case 'hydrate_roots': {
      const { accepted, rejected } = acceptNodes(intent.nodes)
      return evictCache({
        ...state,
        roots: accepted.map(node => node.ref),
        nodes: Object.fromEntries(accepted.map(node => [node.ref, node])),
        children: { ...state.children, root: accepted.map(node => node.ref) },
        freshness: rejected > 0 ? 'contract_mismatch' : 'fresh',
        focusedRef: state.focusedRef !== undefined && accepted.some(node => node.ref === state.focusedRef)
          ? state.focusedRef
          : accepted[0]?.ref,
      })
    }
    case 'children_loading':
      return {
        ...state,
        loadingRefs: state.loadingRefs.includes(intent.ref) ? state.loadingRefs : [...state.loadingRefs, intent.ref],
      }
    case 'children_ready': {
      const { accepted, rejected } = acceptNodes(intent.nodes)
      const next = setChildren(state, intent.ref, accepted)
      return {
        ...next,
        freshness: rejected > 0 ? 'contract_mismatch' : next.freshness === 'reconcile_required' ? next.freshness : 'fresh',
        scrollAnchor: state.scrollAnchor,
        expandedRefs: state.expandedRefs,
        selectedRef: state.selectedRef,
        focusedRef: state.focusedRef,
      }
    }
    case 'children_error':
      return {
        ...state,
        loadingRefs: state.loadingRefs.filter(ref => ref !== intent.ref),
        errors: { ...state.errors, [intent.ref]: intent.reason },
      }
    case 'expand':
      if (!state.nodes[intent.ref]?.hasChildren || state.expandedRefs.includes(intent.ref)) return state
      return { ...state, expandedRefs: [...state.expandedRefs, intent.ref] }
    case 'collapse':
      return { ...state, expandedRefs: state.expandedRefs.filter(ref => ref !== intent.ref) }
    case 'select':
      return { ...state, selectedRef: intent.ref, focusedRef: intent.ref ?? state.focusedRef }
    case 'set_primary':
      return { ...state, primaryRef: intent.ref, selectedRef: intent.ref, focusedRef: intent.ref ?? state.focusedRef }
    case 'toggle_checked':
      return { ...state, checkedRefs: state.checkedRefs.includes(intent.ref) ? state.checkedRefs.filter(ref => ref !== intent.ref) : [...state.checkedRefs, intent.ref] }
    case 'focus':
      return { ...state, focusedRef: intent.ref }
    case 'filter':
      return { ...state, filter: intent.query }
    case 'set_scroll_anchor':
      return { ...state, scrollAnchor: intent.anchor }
    case 'retry': {
      const { [intent.ref]: _removed, ...errors } = state.errors
      return {
        ...state,
        errors,
        loadingRefs: state.loadingRefs.includes(intent.ref) ? state.loadingRefs : [...state.loadingRefs, intent.ref],
      }
    }
    case 'watch':
      return applyWatch(state, intent.event)
  }
}

/**
 * 监视事件按 sequence 折叠。出现 cursor gap 时只标 reconcile_required，
 * 不得重排 expanded/selection/focus，也不得把滚动锚点重置到根。
 */
function applyWatch(state: ExplorerTreeStateV1, event: ExplorerTreeWatchEventV1): ExplorerTreeStateV1 {
  if (event.entryRef.length === 0 || looksUnsafe(event.entryRef) || looksUnsafe(event.cursor)) {
    return { ...state, freshness: 'contract_mismatch' }
  }
  if (state.sequence > 0 && event.sequence > state.sequence + 1) {
    return { ...state, freshness: 'reconcile_required', cursor: event.cursor }
  }
  if (event.sequence < state.sequence) return state
  const node = state.nodes[event.entryRef]
  if (event.op === 'deleted') {
    const { [event.entryRef]: _removed, ...nodes } = state.nodes
    const children = { ...state.children }
    const parent = event.parentRef ?? node?.parentRef
    if (parent !== undefined && children[parent] !== undefined) {
      children[parent] = children[parent]!.filter(ref => ref !== event.entryRef)
    }
    return {
      ...state,
      nodes,
      children,
      sequence: event.sequence,
      cursor: event.cursor,
      selectedRef: state.selectedRef === event.entryRef ? undefined : state.selectedRef,
      primaryRef: state.primaryRef === event.entryRef ? undefined : state.primaryRef,
      checkedRefs: state.checkedRefs.filter(ref => ref !== event.entryRef),
      focusedRef: state.focusedRef === event.entryRef ? state.selectedRef : state.focusedRef,
      scrollAnchor: state.scrollAnchor?.ref === event.entryRef ? state.scrollAnchor : state.scrollAnchor,
    }
  }
  if (node === undefined) {
    return { ...state, sequence: event.sequence, cursor: event.cursor }
  }
  return {
    ...state,
    sequence: event.sequence,
    cursor: event.cursor,
    nodes: {
      ...state.nodes,
      [event.entryRef]: {
        ...node,
        version: event.version ?? node.version,
        freshness: 'stale',
      },
    },
  }
}

export function explorerRowHeight(pointer: 'fine' | 'coarse'): number {
  return pointer === 'coarse' ? EXPLORER_TREE_ROW_HEIGHT_COARSE : EXPLORER_TREE_ROW_HEIGHT_DESKTOP
}

export function moveExplorerFocus(
  state: ExplorerTreeStateV1,
  direction: 'up' | 'down' | 'home' | 'end' | 'pageUp' | 'pageDown',
  pageSize = 10,
): ExplorerTreeStateV1 {
  const rows = flattenExplorerTree(state)
  if (rows.length === 0) return state
  const current = rows.findIndex(row => row.ref === state.focusedRef)
  const index = current < 0 ? 0 : current
  const nextIndex = direction === 'home' ? 0
    : direction === 'end' ? rows.length - 1
      : direction === 'up' ? Math.max(0, index - 1)
        : direction === 'down' ? Math.min(rows.length - 1, index + 1)
          : direction === 'pageUp' ? Math.max(0, index - pageSize)
            : Math.min(rows.length - 1, index + pageSize)
  return { ...state, focusedRef: rows[nextIndex]!.ref }
}

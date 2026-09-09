import { describe, expect, it } from 'vitest'
import {
  EXPLORER_FILE_WATCH_CAPABILITY,
  createExplorerWatchController,
  hasExplorerWatchCapability,
  type ExplorerWatchEventStreamV1,
} from '../src/explorer/explorer-watch.js'
import {
  createExplorerTreeState,
  reduceExplorerTree,
  type ExplorerTreeNodeV1,
  type ExplorerTreeStateV1,
  type ExplorerTreeWatchEventV1,
} from '../src/explorer/tree-state.js'

function node(partial: Partial<ExplorerTreeNodeV1> & Pick<ExplorerTreeNodeV1, 'ref' | 'name'>): ExplorerTreeNodeV1 {
  return { kind: 'file', version: 'v1', hasChildren: false, capabilities: ['open'], freshness: 'fresh', ...partial }
}

function dir(ref: string, name: string): ExplorerTreeNodeV1 {
  return node({ ref, name, kind: 'directory', hasChildren: true })
}

interface FakeStream extends ExplorerWatchEventStreamV1 {
  emit(event: ExplorerTreeWatchEventV1): void
  listenerCount(): number
}

function fakeStream(): FakeStream {
  const listeners = new Set<(event: ExplorerTreeWatchEventV1) => void>()
  let cursor = 'c0'
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    snapshotCursor: () => cursor,
    emit(event) {
      cursor = event.cursor
      for (const listener of [...listeners]) listener(event)
    },
    listenerCount: () => listeners.size,
  }
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

interface Harness {
  readonly controller: ReturnType<typeof createExplorerWatchController>
  readonly stream: FakeStream
  readonly state: () => ExplorerTreeStateV1
  readonly userSelect: (ref: string) => void
  readonly counts: { roots: number; children: readonly string[] }
  readonly setRoots: (nodes: readonly ExplorerTreeNodeV1[]) => void
  readonly setChildren: (ref: string, nodes: readonly ExplorerTreeNodeV1[]) => void
  readonly deferRoots: () => void
  readonly resolveRoots: (nodes: readonly ExplorerTreeNodeV1[]) => void
}

function harness(initial: ExplorerTreeStateV1): Harness {
  const stream = fakeStream()
  let state = initial
  let rootsValue: readonly ExplorerTreeNodeV1[] = initial.roots.map(ref => initial.nodes[ref]!).filter(item => item !== undefined)
  let pendingRoots: ReturnType<typeof deferred<readonly ExplorerTreeNodeV1[]>> | undefined
  const childrenByRef = new Map<string, readonly ExplorerTreeNodeV1[]>()
  const counts = { roots: 0, children: [] as string[] }
  const controller = createExplorerWatchController({
    source: { capabilities: [EXPLORER_FILE_WATCH_CAPABILITY], watch: () => stream },
    getRoots: () => {
      counts.roots += 1
      return pendingRoots === undefined ? Promise.resolve(rootsValue) : pendingRoots.promise
    },
    listChildren: ref => {
      counts.children.push(ref)
      return Promise.resolve(childrenByRef.get(ref) ?? [])
    },
    getState: () => state,
    setState: next => { state = next },
  })
  return {
    controller,
    stream,
    state: () => state,
    userSelect: ref => { state = reduceExplorerTree(state, { type: 'select', ref }) },
    counts,
    setRoots: nodes => {
      rootsValue = nodes
      if (pendingRoots !== undefined) {
        const pending = pendingRoots
        pendingRoots = undefined
        pending.resolve(nodes)
      }
    },
    setChildren: (ref, nodes) => { childrenByRef.set(ref, nodes) },
    deferRoots: () => { pendingRoots = deferred<readonly ExplorerTreeNodeV1[]>() },
    resolveRoots: nodes => {
      rootsValue = nodes
      if (pendingRoots !== undefined) {
        const pending = pendingRoots
        pendingRoots = undefined
        pending.resolve(nodes)
      }
    },
  }
}

function browsing(): ExplorerTreeStateV1 {
  let state = reduceExplorerTree(createExplorerTreeState(), {
    type: 'hydrate_roots',
    nodes: [dir('dir:src', 'src'), node({ ref: 'file:readme', name: 'README.md' })],
  })
  state = reduceExplorerTree(state, { type: 'children_ready', ref: 'dir:src', nodes: [
    node({ ref: 'file:old', name: 'old-name.ts', parentRef: 'dir:src' }),
    node({ ref: 'file:keep', name: 'keep.ts', parentRef: 'dir:src' }),
  ] })
  state = reduceExplorerTree(state, { type: 'expand', ref: 'dir:src' })
  state = reduceExplorerTree(state, { type: 'select', ref: 'file:keep' })
  state = reduceExplorerTree(state, { type: 'set_scroll_anchor', anchor: { ref: 'file:keep', offset: 96 } })
  return state
}

async function flush(): Promise<void> {
  for (let index = 0; index < 6; index += 1) await Promise.resolve()
}

describe('ExplorerWatchController capability probe (1.1)', () => {
  it('stays unbound and honest when the owner watch capability is absent', async () => {
    const stream = fakeStream()
    let rootsCalls = 0
    const controller = createExplorerWatchController({
      source: { watch: () => stream },
      getRoots: async () => { rootsCalls += 1; return [] },
      listChildren: async () => [],
      getState: () => createExplorerTreeState(),
      setState: () => {},
    })
    expect(hasExplorerWatchCapability({ watch: () => stream })).toBe(false)
    expect(hasExplorerWatchCapability({ capabilities: [EXPLORER_FILE_WATCH_CAPABILITY] })).toBe(false)
    expect(hasExplorerWatchCapability({ capabilities: [EXPLORER_FILE_WATCH_CAPABILITY], watch: () => stream })).toBe(true)
    expect(hasExplorerWatchCapability(undefined)).toBe(false)
    expect(controller.available).toBe(false)
    expect(controller.disabledReason).toContain(EXPLORER_FILE_WATCH_CAPABILITY)
    expect(stream.listenerCount()).toBe(0)
    await controller.reconcile()
    expect(rootsCalls).toBe(0)
    controller.dispose()
  })

  it('binds the stream when the capability is present and stops on dispose', async () => {
    const rig = harness(browsing())
    expect(rig.controller.available).toBe(true)
    expect(rig.controller.disabledReason).toBeUndefined()
    expect(rig.stream.listenerCount()).toBe(1)
    rig.controller.dispose()
    expect(rig.stream.listenerCount()).toBe(0)
    rig.stream.emit({ cursor: 'c1', sequence: 1, op: 'changed', entryRef: 'file:readme' })
    expect(rig.state().sequence).toBe(0)
  })
})

describe('Explorer owner watch increments (1.1)', () => {
  it('folds contiguous events without owner reads', async () => {
    const rig = harness(browsing())
    rig.stream.emit({ cursor: 'c1', sequence: 1, op: 'changed', entryRef: 'file:readme', version: 'v2' })
    rig.stream.emit({ cursor: 'c2', sequence: 2, op: 'changed', entryRef: 'file:readme', version: 'v3' })
    await flush()
    const state = rig.state()
    expect(state.sequence).toBe(2)
    expect(state.nodes['file:readme']?.version).toBe('v3')
    expect(state.nodes['file:readme']?.freshness).toBe('stale')
    expect(state.freshness).toBe('fresh')
    expect(rig.counts.roots).toBe(0)
    expect(rig.counts.children).toEqual([])
  })

  it('applies a rename through one targeted owner re-list and preserves user position', async () => {
    const rig = harness(browsing())
    // External rename: the owner swaps the opaque ref and the display name.
    rig.setChildren('dir:src', [
      node({ ref: 'file:new', name: 'new-name.ts', parentRef: 'dir:src', version: 'v2' }),
      node({ ref: 'file:keep', name: 'keep.ts', parentRef: 'dir:src' }),
    ])
    rig.stream.emit({ cursor: 'c1', sequence: 1, op: 'deleted', entryRef: 'file:old', parentRef: 'dir:src' })
    rig.stream.emit({ cursor: 'c2', sequence: 2, op: 'renamed', entryRef: 'file:new', parentRef: 'dir:src' })
    await flush()
    const state = rig.state()
    expect(state.nodes['file:old']).toBeUndefined()
    expect(state.nodes['file:new']?.name).toBe('new-name.ts')
    expect(state.expandedRefs).toEqual(['dir:src'])
    expect(state.selectedRef).toBe('file:keep')
    expect(state.focusedRef).toBe('file:keep')
    expect(state.scrollAnchor).toEqual({ ref: 'file:keep', offset: 96 })
    expect(rig.counts.children).toEqual(['dir:src'])
    expect(rig.counts.roots).toBe(0)
  })

  it('keeps a collapsed-but-loaded parent fresh through the targeted re-list', async () => {
    let state = reduceExplorerTree(createExplorerTreeState(), {
      type: 'hydrate_roots',
      nodes: [dir('dir:lib', 'lib')],
    })
    state = reduceExplorerTree(state, { type: 'children_ready', ref: 'dir:lib', nodes: [node({ ref: 'file:one', name: 'one.ts', parentRef: 'dir:lib' })] })
    const rig = harness(state)
    rig.setChildren('dir:lib', [node({ ref: 'file:one', name: 'one.ts', parentRef: 'dir:lib' }), node({ ref: 'file:two', name: 'two.ts', parentRef: 'dir:lib' })])
    rig.stream.emit({ cursor: 'c1', sequence: 1, op: 'created', entryRef: 'file:two', parentRef: 'dir:lib' })
    await flush()
    expect(rig.state().nodes['file:two']?.name).toBe('two.ts')
    expect(rig.counts.children).toEqual(['dir:lib'])
  })

  it('detects a cursor gap, marks stale, and reconciles once authoritatively', async () => {
    const rig = harness(browsing())
    // Authoritative world moved on: a new root file appeared, one child changed.
    rig.setRoots([dir('dir:src', 'src'), node({ ref: 'file:readme', name: 'README.md' }), node({ ref: 'file:added', name: 'added.ts' })])
    rig.setChildren('dir:src', [node({ ref: 'file:keep', name: 'keep.ts', parentRef: 'dir:src', version: 'v9' })])
    rig.stream.emit({ cursor: 'c1', sequence: 1, op: 'changed', entryRef: 'file:readme' })
    rig.stream.emit({ cursor: 'c4', sequence: 4, op: 'changed', entryRef: 'file:readme' })
    const flagged = rig.state()
    expect(flagged.freshness).toBe('reconcile_required')
    expect(flagged.selectedRef).toBe('file:keep')
    expect(flagged.scrollAnchor).toEqual({ ref: 'file:keep', offset: 96 })
    expect(flagged.expandedRefs).toEqual(['dir:src'])
    await rig.controller.reconcile()
    const state = rig.state()
    expect(state.freshness).toBe('fresh')
    expect(state.roots).toContain('file:added')
    expect(state.nodes['file:keep']?.version).toBe('v9')
    expect(state.selectedRef).toBe('file:keep')
    expect(state.focusedRef).toBe('file:keep')
    expect(state.scrollAnchor).toEqual({ ref: 'file:keep', offset: 96 })
    expect(state.expandedRefs).toEqual(['dir:src'])
    expect(state.sequence).toBe(4)
    expect(rig.counts.roots).toBe(1)
    expect(rig.counts.children).toEqual(['dir:src'])
    // The next contiguous event folds cleanly: no re-flag, no extra read.
    rig.stream.emit({ cursor: 'c5', sequence: 5, op: 'changed', entryRef: 'file:readme' })
    await flush()
    expect(rig.state().freshness).toBe('fresh')
    expect(rig.counts.roots).toBe(1)
  })

  it('coalesces concurrent gap triggers into one authoritative read', async () => {
    const rig = harness(browsing())
    rig.deferRoots()
    rig.stream.emit({ cursor: 'c1', sequence: 1, op: 'changed', entryRef: 'file:readme' })
    rig.stream.emit({ cursor: 'c9', sequence: 9, op: 'changed', entryRef: 'file:readme' })
    rig.stream.emit({ cursor: 'c12', sequence: 12, op: 'changed', entryRef: 'file:readme' })
    expect(rig.counts.roots).toBe(1)
    rig.resolveRoots([dir('dir:src', 'src'), node({ ref: 'file:readme', name: 'README.md' })])
    await flush()
    expect(rig.state().freshness).toBe('fresh')
    expect(rig.counts.roots).toBe(1)
    expect(rig.counts.children).toEqual(['dir:src'])
  })

  it('never overwrites a selection made while the reconcile read is in flight', async () => {
    const rig = harness(browsing())
    rig.setChildren('dir:src', [node({ ref: 'file:keep', name: 'keep.ts', parentRef: 'dir:src' })])
    rig.deferRoots()
    rig.stream.emit({ cursor: 'c1', sequence: 1, op: 'changed', entryRef: 'file:readme' })
    rig.stream.emit({ cursor: 'c5', sequence: 5, op: 'changed', entryRef: 'file:readme' })
    rig.userSelect('file:readme')
    rig.resolveRoots([dir('dir:src', 'src'), node({ ref: 'file:readme', name: 'README.md' })])
    await rig.controller.reconcile()
    const state = rig.state()
    expect(state.freshness).toBe('fresh')
    expect(state.selectedRef).toBe('file:readme')
    expect(state.scrollAnchor).toEqual({ ref: 'file:keep', offset: 96 })
  })

  it('absorbs contiguous events landing during an in-flight read and re-reads only on a fresh gap', async () => {
    const rig = harness(browsing())
    rig.setChildren('dir:src', [node({ ref: 'file:keep', name: 'keep.ts', parentRef: 'dir:src' })])
    rig.deferRoots()
    rig.stream.emit({ cursor: 'c1', sequence: 1, op: 'changed', entryRef: 'file:readme' })
    rig.stream.emit({ cursor: 'c5', sequence: 5, op: 'changed', entryRef: 'file:readme' })
    // Contiguous event while the authoritative read is pending: absorbed by it.
    rig.stream.emit({ cursor: 'c6', sequence: 6, op: 'changed', entryRef: 'file:readme' })
    rig.resolveRoots([dir('dir:src', 'src'), node({ ref: 'file:readme', name: 'README.md', version: 'v6' })])
    await flush()
    expect(rig.counts.roots).toBe(1)
    expect(rig.state().freshness).toBe('fresh')
    expect(rig.state().nodes['file:readme']?.version).toBe('v6')
    // A fresh gap during the next read schedules exactly one more, then stops.
    rig.deferRoots()
    rig.stream.emit({ cursor: 'c9', sequence: 9, op: 'changed', entryRef: 'file:readme' })
    rig.stream.emit({ cursor: 'c20', sequence: 20, op: 'changed', entryRef: 'file:readme' })
    rig.stream.emit({ cursor: 'c30', sequence: 30, op: 'changed', entryRef: 'file:readme' })
    rig.resolveRoots([dir('dir:src', 'src'), node({ ref: 'file:readme', name: 'README.md', version: 'v30' })])
    await flush()
    expect(rig.counts.roots).toBe(2)
    expect(rig.state().freshness).toBe('fresh')
    // Idle world: no timers, no further reads.
    await flush()
    await flush()
    expect(rig.counts.roots).toBe(2)
  })

  it('marks contract mismatch on unsafe refs and never schedules an owner read', async () => {
    const rig = harness(browsing())
    rig.stream.emit({ cursor: 'c1', sequence: 1, op: 'changed', entryRef: '/etc/passwd' })
    await flush()
    expect(rig.state().freshness).toBe('contract_mismatch')
    expect(rig.counts.roots).toBe(0)
    expect(rig.counts.children).toEqual([])
  })
})

describe('reconcile_apply reducer boundaries (1.1)', () => {
  it('drops vanished selection, anchor and expansion honestly without resetting the scroll to the root', () => {
    let state = browsing()
    state = { ...state, expandedRefs: ['dir:src', 'dir:gone'] }
    const next = reduceExplorerTree(state, {
      type: 'reconcile_apply',
      roots: [dir('dir:src', 'src'), node({ ref: 'file:readme', name: 'README.md' })],
      childrenByRef: { 'dir:src': [node({ ref: 'file:keep', name: 'keep.ts', parentRef: 'dir:src' })] },
      baselineSequence: 7,
      baselineCursor: 'c7',
    })
    expect(next.freshness).toBe('fresh')
    expect(next.expandedRefs).toEqual(['dir:src'])
    expect(next.selectedRef).toBe('file:keep')
    expect(next.focusedRef).toBe('file:keep')
    expect(next.scrollAnchor).toEqual({ ref: 'file:keep', offset: 96 })
    expect(next.sequence).toBe(7)
    expect(next.cursor).toBe('c7')
    // Selection that vanished is cleared, the anchor is dropped, not re-aimed at the first row.
    const vanished = reduceExplorerTree(browsing(), {
      type: 'reconcile_apply',
      roots: [node({ ref: 'file:readme', name: 'README.md' })],
      childrenByRef: {},
      baselineSequence: 8,
    })
    expect(vanished.selectedRef).toBeUndefined()
    expect(vanished.scrollAnchor).toBeUndefined()
    expect(vanished.expandedRefs).toEqual([])
    expect(vanished.focusedRef).toBe('file:readme')
    expect(vanished.children['dir:src']).toBeUndefined()
  })

  it('rejects unsafe authoritative rows as contract mismatch while keeping safe rows', () => {
    const next = reduceExplorerTree(browsing(), {
      type: 'reconcile_apply',
      roots: [dir('dir:src', 'src'), node({ ref: '/etc/passwd', name: 'passwd' })],
      childrenByRef: {},
      baselineSequence: 3,
    })
    expect(next.freshness).toBe('contract_mismatch')
    expect(next.roots).toEqual(['dir:src'])
    expect(next.nodes['/etc/passwd']).toBeUndefined()
  })
})

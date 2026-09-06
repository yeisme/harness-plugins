import { notifySubscribers } from '@deepseek-ai/dsh-client-store'
import {
  clampBox, closePane, dockGroup, emptyWorkspace, focusPane, groupForPane, layoutAxis, layoutBoxes, minimumSize,
  movePane, openPane, readWorkspace, serializeWorkspace,
  type Box, type LayoutNode, type PaneDestination, type PaneReference, type WorkspaceSnapshot,
} from './workspace-model.ts'

export interface WorkspaceViewRegistration {
  kind: string
  title: string
  icon?: string
  /** The plugin declares this keyed slot; layout is the sole render owner. */
  rendererKey: string
  beforeClose?: (paneId: string) => boolean | Promise<boolean>
}
export interface WorkspacePresentation {
  layout: WorkspaceSnapshot
  catalog: WorkspaceViewRegistration[]
  presets: string[]
  error: 'storage' | 'invalid-layout' | 'protected' | 'command' | null
  catalogOpen: boolean
  legacyLayouts: Array<{ id: string; title: string }>
  commands: Array<{ id: string; title: string }>
}
export interface WorkspaceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
export interface WorkspaceLayoutFace {
  readonly version: 'workspace.unified.v1'
  readonly source: { getSnapshot(): WorkspacePresentation; subscribe(listener: () => void): () => void }
  registerView(view: WorkspaceViewRegistration): () => void
  openPane(reference: PaneReference): void
  movePane(paneId: string, destination: PaneDestination): void
  dropPane(paneId: string, destination: PaneDestination, reference?: PaneReference): void
  dockGroup(groupId: string, destination: PaneDestination): void
  closePane(paneId: string): Promise<void>
  focusPane(paneId: string): void
  updatePane(paneId: string, update: Partial<Pick<PaneReference, 'title' | 'workspaceTitle'>>): void
  pinPane(paneId: string): void
  switchWorkspace(workspaceId: string): void
  savePreset(name: string): void
  restorePreset(name: string): void
  reset(): void
  showCatalog(open: boolean): void
  registerLegacyLayout(id: string, title: string, load: () => WorkspaceSnapshot): () => void
  importLegacyLayout(id: string): void
  registerCommand(id: string, title: string, execute: () => Promise<unknown>): () => void
  executeCommand(id: string): Promise<void>
  maximize(groupId: string): void
  commitGeometry(layout: WorkspaceSnapshot): void
}

/** Single browser layout owner. Legacy adapters submit intents, never a second tree. */
export class WorkspaceLayoutController implements WorkspaceLayoutFace {
  readonly version = 'workspace.unified.v1' as const
  private snapshot: WorkspacePresentation = { layout: emptyWorkspace('unassigned'), catalog: [], presets: [], error: null, catalogOpen: false, legacyLayouts: [], commands: [] }
  private readonly commands = new Map<string, { title: string; execute: () => Promise<unknown> }>()
  private readonly legacy = new Map<string, { title: string; load: () => WorkspaceSnapshot }>()
  private readonly listeners = new Set<() => void>()
  private readonly registrations = new Map<string, WorkspaceViewRegistration>()
  private readonly projectMemory = new Map<string, WorkspaceSnapshot>()
  private readonly namedMemory = new Map<string, Record<string, WorkspaceSnapshot>>()
  readonly source = {
    getSnapshot: (): WorkspacePresentation => this.snapshot,
    subscribe: (listener: () => void): (() => void) => {
      this.listeners.add(listener)
      return () => { this.listeners.delete(listener) }
    },
  }
  constructor(private readonly storage?: WorkspaceStorage) {
    try {
      const project = storage?.getItem('dsh.workspace.unified.v1:active-project')
      if (project) this.switchWorkspace(project)
    } catch { this.snapshot.error = 'storage' }
  }
  private key(project: string): string { return `dsh.workspace.unified.v1:${encodeURIComponent(project)}` }
  private publish(update: Partial<WorkspacePresentation>): void {
    this.snapshot = { ...this.snapshot, ...update }
    notifySubscribers(this.listeners, '[workspace-layout] presentation')
  }
  private commit(layout: WorkspaceSnapshot): void {
    if (layout === this.snapshot.layout) return
    const encoded = serializeWorkspace(layout)
    if (readWorkspace(encoded, layout.workspaceId) === undefined) { this.publish({ error: 'invalid-layout' }); return }
    this.projectMemory.set(layout.workspaceId, layout)
    let error: WorkspacePresentation['error'] = null
    try { this.storage?.setItem(this.key(layout.workspaceId), encoded) } catch { error = 'storage' }
    this.publish({ layout, error })
  }
  registerView(view: WorkspaceViewRegistration): () => void {
    if (this.registrations.has(view.kind)) throw new Error(`workspace-layout: duplicate view kind ${view.kind}`)
    this.registrations.set(view.kind, view)
    this.publish({ catalog: [...this.registrations.values()] })
    return () => {
      if (this.registrations.get(view.kind) !== view) return
      this.registrations.delete(view.kind)
      this.publish({ catalog: [...this.registrations.values()] })
    }
  }
  openPane(reference: PaneReference): void {
    const before = this.snapshot.layout
    let next = openPane(before, reference)
    // The first tool gets the right-hand 40% without removing the conversation.
    if (reference.kind !== 'conversation' && Object.values(before.panes).length > 0
      && Object.values(before.panes).every(p => p.kind === 'conversation') && before.root?.type === 'group') {
      next = movePane(next, reference.id, { type: 'split', groupId: before.root.id, edge: 'right' })
      if (next.root?.type === 'split') next.root.ratio = 0.6
    }
    this.commit(next)
  }
  movePane(paneId: string, destination: PaneDestination): void { this.commit(movePane(this.snapshot.layout, paneId, destination)) }
  dockGroup(groupId: string, destination: PaneDestination): void { this.commit(dockGroup(this.snapshot.layout, groupId, destination)) }
  dropPane(paneId: string, destination: PaneDestination, reference?: PaneReference): void {
    const before = this.snapshot.layout
    const next = reference !== undefined && before.panes[paneId] === undefined ? openPane(before, reference) : before
    const moved = movePane(next, paneId, destination)
    // A refused split must not leave a newly created sidebar preview behind.
    if (moved === next && destination.type !== 'tab') return
    this.commit(moved)
  }
  focusPane(paneId: string): void { this.commit(focusPane(this.snapshot.layout, paneId)) }
  updatePane(paneId: string, update: Partial<Pick<PaneReference, 'title' | 'workspaceTitle'>>): void {
    const pane = this.snapshot.layout.panes[paneId]
    if (!pane || Object.entries(update).every(([key, value]) => pane[key as keyof PaneReference] === value)) return
    const next = structuredClone(this.snapshot.layout)
    next.panes[paneId] = { ...pane, ...update }
    this.commit(next)
  }
  pinPane(paneId: string): void {
    if (this.snapshot.layout.panes[paneId] === undefined) return
    const next = structuredClone(this.snapshot.layout)
    next.panes[paneId]!.pinned = true
    this.commit(next)
  }
  async closePane(paneId: string): Promise<void> {
    const pane = this.snapshot.layout.panes[paneId]
    if (pane === undefined) return
    try {
      if (await this.registrations.get(pane.kind)?.beforeClose?.(paneId) === false) { this.publish({ error: 'protected' }); return }
    } catch { this.publish({ error: 'protected' }); return }
    // A delayed save prompt must not close a new replacement identity.
    if (this.snapshot.layout.panes[paneId] !== pane) return
    this.commit(closePane(this.snapshot.layout, paneId))
  }
  private protectReplacement(next: WorkspaceSnapshot | undefined, apply: () => void): void {
    const before = this.snapshot.layout
    const pending: Array<Promise<boolean>> = []
    try {
      for (const pane of Object.values(before.panes)) {
        if (next?.panes[pane.id]?.kind === pane.kind && next.panes[pane.id]?.resourceKey === pane.resourceKey
          && next.panes[pane.id]?.sessionId === pane.sessionId && next.panes[pane.id]?.workspaceId === pane.workspaceId) continue
        const allowed = this.registrations.get(pane.kind)?.beforeClose?.(pane.id)
        if (allowed === false) { this.publish({ error: 'protected' }); return }
        if (allowed && typeof allowed !== 'boolean') pending.push(Promise.resolve(allowed).catch(() => false))
      }
    } catch { this.publish({ error: 'protected' }); return }
    if (pending.length === 0) { apply(); return }
    void Promise.all(pending).then(results => {
      if (this.snapshot.layout !== before) return
      if (results.some(allowed => !allowed)) this.publish({ error: 'protected' })
      else apply()
    }, () => { this.publish({ error: 'protected' }) })
  }
  switchWorkspace(workspaceId: string): void {
    if (workspaceId === this.snapshot.layout.workspaceId) return
    this.protectReplacement(undefined, () => this.switchWorkspaceUnchecked(workspaceId))
  }
  private switchWorkspaceUnchecked(workspaceId: string): void {
    let layout = this.projectMemory.get(workspaceId)
    let error: WorkspacePresentation['error'] = null
    try {
      this.storage?.setItem('dsh.workspace.unified.v1:active-project', workspaceId)
      const raw = this.storage?.getItem(this.key(workspaceId))
      if (layout === undefined && raw) {
        layout = readWorkspace(raw, workspaceId)
        if (layout === undefined) error = 'invalid-layout'
      }
      if (!this.namedMemory.has(workspaceId)) {
        const names: unknown = JSON.parse(this.storage?.getItem(`${this.key(workspaceId)}:presets`) ?? '{}')
        const valid: Record<string, WorkspaceSnapshot> = Object.create(null) as Record<string, WorkspaceSnapshot>
        if (names && typeof names === 'object' && !Array.isArray(names)) {
          for (const [name, value] of Object.entries(names)) {
            const parsed = readWorkspace(JSON.stringify(value), workspaceId)
            if (parsed !== undefined) valid[name] = parsed
          }
        }
        this.namedMemory.set(workspaceId, valid)
      }
    } catch { error = 'storage' }
    this.publish({ layout: layout ?? emptyWorkspace(workspaceId), presets: Object.keys(this.namedMemory.get(workspaceId) ?? {}), error })
  }
  savePreset(name: string): void {
    name = name.trim()
    if (!name || name.length > 80) return
    const project = this.snapshot.layout.workspaceId
    const presets = { ...this.namedMemory.get(project), [name]: this.snapshot.layout }
    this.namedMemory.set(project, presets)
    let error: WorkspacePresentation['error'] = null
    try { this.storage?.setItem(`${this.key(project)}:presets`, JSON.stringify(Object.fromEntries(
      Object.entries(presets).map(([key, layout]) => [key, JSON.parse(serializeWorkspace(layout)) as unknown]),
    ))) } catch { error = 'storage' }
    this.publish({ presets: Object.keys(presets), error })
  }
  restorePreset(name: string): void {
    const layout = this.namedMemory.get(this.snapshot.layout.workspaceId)?.[name]
    if (layout !== undefined) this.protectReplacement(layout, () => this.commit(layout))
  }
  reset(): void {
    const empty = emptyWorkspace(this.snapshot.layout.workspaceId)
    this.protectReplacement(empty, () => this.commit(empty))
  }
  showCatalog(open: boolean): void { this.publish({ catalogOpen: open }) }
  registerCommand(id: string, title: string, execute: () => Promise<unknown>): () => void {
    const record = { title, execute }
    this.commands.set(id, record)
    const publish = () => this.publish({ commands: [...this.commands].map(([key, value]) => ({ id: key, title: value.title })) })
    publish()
    return () => { if (this.commands.get(id) === record) { this.commands.delete(id); publish() } }
  }
  async executeCommand(id: string): Promise<void> {
    const record = this.commands.get(id)
    if (!record) { this.publish({ error: 'command' }); return }
    try { await record.execute() } catch { this.publish({ error: 'command' }) }
  }
  registerLegacyLayout(id: string, title: string, load: () => WorkspaceSnapshot): () => void {
    const record = { title, load }
    this.legacy.set(id, record)
    const publish = () => this.publish({ legacyLayouts: [...this.legacy].map(([key, value]) => ({ id: key, title: value.title })) })
    publish()
    return () => { if (this.legacy.get(id) === record) { this.legacy.delete(id); publish() } }
  }
  importLegacyLayout(id: string): void {
    const record = this.legacy.get(id)
    if (!record) return
    try {
      const candidate = { ...record.load(), workspaceId: this.snapshot.layout.workspaceId }
      const parsed = readWorkspace(serializeWorkspace(candidate), candidate.workspaceId)
      if (!parsed) { this.publish({ error: 'invalid-layout' }); return }
      this.protectReplacement(parsed, () => {
        this.savePreset(`legacy-backup:${new Date().toISOString()}`)
        this.commit(parsed)
      })
    } catch { this.publish({ error: 'invalid-layout' }) }
  }
  maximize(groupId: string): void {
    if (!this.snapshot.layout.groups[groupId]) return
    this.commit({ ...this.snapshot.layout, focused: groupId, maximized: this.snapshot.layout.maximized === groupId ? null : groupId })
  }
  commitGeometry(layout: WorkspaceSnapshot): void {
    // A gesture cannot overwrite a concurrent plugin close/open or project switch.
    const live = this.snapshot.layout
    if (layout.workspaceId !== live.workspaceId || JSON.stringify(layout.panes) !== JSON.stringify(live.panes)) return
    this.commit(layout)
  }
}

/** Pointer destinations use coordinates, never the element retaining pointer capture. */
export function hitTestLayout(state: WorkspaceSnapshot, viewport: Box, x: number, y: number, sourceId?: string, options: { float?: boolean; bodyMerge?: boolean; previous?: PaneDestination | undefined } = {}): {
  destination?: PaneDestination; preview?: Box; reason?: 'space' | 'outside' | 'same' | 'floating-split'
} {
  if (x < viewport.x || y < viewport.y || x > viewport.x + viewport.width || y > viewport.y + viewport.height) return { reason: 'outside' }
  const floatingBox = clampBox({ x: x - 100, y: y - 18, width: Math.min(520, viewport.width * .65), height: Math.min(440, viewport.height * .7) }, viewport)
  if (options.float) return { destination: { type: 'float', box: floatingBox }, preview: floatingBox }
  if (state.root === null && state.floating.length === 0) {
    return { destination: { type: 'root' }, preview: viewport }
  }
  const boxes = layoutBoxes(state, viewport)
  const floatingIds = state.floating.map(f => f.groupId)
  const ids = [...floatingIds].reverse().concat(Object.keys(state.groups).filter(id => !floatingIds.includes(id)))
  for (const id of ids) {
    if (state.maximized !== null && state.maximized !== id) continue
    const b = boxes[id]
    if (!b || x < b.x || y < b.y || x > b.x + b.width || y > b.y + b.height) continue
    if (y < b.y + 36) {
      const count = state.groups[id]!.panes.length
      const index = Math.min(count, Math.max(0, Math.floor((x - b.x) / Math.max(80, Math.min(160, (b.width - 64) / Math.max(1, count))))))
      return { destination: { type: 'tab', groupId: id, index }, preview: { ...b, height: 36 } }
    }
    // Broad proportional zones, with a small exit tolerance so the target does
    // not flicker when the pointer rests on a magnetic boundary.
    const magnetX = Math.min(180, Math.max(64, b.width * .22))
    const magnetY = Math.min(132, Math.max(56, (b.height - 36) * .22))
    const distances = [
      ['left', x - b.x, magnetX], ['right', b.x + b.width - x, magnetX],
      ['top', y - b.y - 36, magnetY], ['bottom', b.y + b.height - y, magnetY],
    ] as const
    const previous = options.previous?.type === 'split' && options.previous.groupId === id ? options.previous.edge : undefined
    const sticky = distances.find(([edge, distance, zone]) => edge === previous && distance <= zone + 18)
    const nearest = distances.filter(([, distance, zone]) => distance <= zone).sort((a, b) => a[1] / a[2] - b[1] / b[2])[0]
    const candidate = sticky && (!nearest || nearest[1] / nearest[2] >= sticky[1] / sticky[2] - .18) ? sticky : nearest
    const edge = candidate?.[0]
    if (edge) {
      if (floatingIds.includes(id)) return { reason: 'floating-split' }
      if (sourceId !== undefined && groupForPane(state, sourceId)?.id === id && state.groups[id]!.panes.length === 1) return { reason: 'same' }
      const horizontal = edge === 'left' || edge === 'right'
      if (horizontal ? b.width < 564 : b.height < 364) return { reason: 'space' }
      const preview = { ...b }
      if (horizontal) { preview.width = (b.width - 4) / 2; if (edge === 'right') preview.x += preview.width + 4 }
      else { preview.height = (b.height - 4) / 2; if (edge === 'bottom') preview.y += preview.height + 4 }
      return { destination: { type: 'split', groupId: id, edge }, preview }
    }
    // Dropping into another group's body joins it without aiming at tiny tabs.
    if (options.bodyMerge !== false && (sourceId === undefined || groupForPane(state, sourceId)?.id !== id)) {
      return { destination: { type: 'tab', groupId: id }, preview: b }
    }
    break
  }
  return { destination: { type: 'float', box: floatingBox }, preview: floatingBox }
}

/** Resize one split against the entire descendant minimum, not just its immediate leaves. */
export function resizeSplit(input: WorkspaceSnapshot, id: string, point: number, viewport: Box): WorkspaceSnapshot {
  const state = structuredClone(input)
  const boxes = layoutBoxes(state, viewport)
  const walk = (node: LayoutNode): void => {
    if (node.type !== 'split') return
    if (node.id !== id) { walk(node.first); walk(node.second); return }
    const box = boxes[id]!
    const horizontal = layoutAxis(node, state, box) === 'horizontal'
    const available = (horizontal ? box.width : box.height) - 4
    const a = minimumSize(node.first, state), b = minimumSize(node.second, state)
    const minA = horizontal ? a.width : a.height, minB = horizontal ? b.width : b.height
    if (available < minA + minB) return
    const offset = point - (horizontal ? box.x : box.y)
    node.ratio = Math.max(minA, Math.min(offset, available - minB)) / available
  }
  if (state.root) walk(state.root)
  return state
}

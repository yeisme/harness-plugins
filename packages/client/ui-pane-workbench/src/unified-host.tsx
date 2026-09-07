import { createElement, type ComponentType, type ReactNode } from 'react'
import type { PaneWorkbenchControllerOptions } from './controller.js'
import type { PaneLocalViewProps, PaneViewRegistry } from './view-registry.js'
import { createPaneWorkspace, type PaneGroupV1, type PaneSplitNodeV1, type PaneViewInstanceV1, type PaneViewSpecV1, type PaneWorkspaceIntentV1Additive, type PaneWorkspaceV1 } from './workspace.js'
import { PANE_WORKSPACE_STORAGE_NAMESPACE, restorePaneWorkspace } from './persistence.js'
import type { PaneCommandRegistry } from './composition.js'
import type { PaneWorkbenchController } from './controller.js'
import { PaneViewContent } from './chrome/view-host.js'
import { REGION_STYLES } from './chrome/shared.js'
import { isUnifiedHostCatalogView } from './core-pane.js'
import { probeWorkbenchStorage } from './browser-storage.js'

interface PaneRef {
  id: string; kind: string; title: string; icon?: string | undefined; pinned: boolean
  resourceKey?: string | undefined; sessionId?: string | undefined; workspaceId?: string | undefined; workspaceTitle?: string | undefined
}
type HostNode = { type: 'group'; id: string } | { type: 'split'; id: string; axis: 'horizontal' | 'vertical'; ratio: number; first: HostNode; second: HostNode }
interface HostLayout {
  workspaceId: string; panes: Record<string, PaneRef>; groups: Record<string, { id: string; panes: string[]; active: string | null }>
  root: HostNode | null; focused: string | null; maximized: string | null; floating: Array<{ groupId: string }>
}
/** Structural probe keeps released hosts and existing plugin entrypoints compatible. */
export interface UnifiedWorkspaceHost {
  version: 'workspace.unified.v1'
  source: { getSnapshot(): { layout: HostLayout }; subscribe(listener: () => void): () => void }
  registerView(input: { kind: string; title: string; icon?: string | undefined; rendererKey: string; beforeClose?: (id: string) => boolean | Promise<boolean> }): () => void
  openPane(pane: PaneRef): void
  focusPane(id: string): void
  updatePane?(id: string, update: { title?: string }): void
  closePane(id: string): Promise<void>
  pinPane(id: string): void
  movePane(id: string, target: { type: 'tab'; groupId: string; index?: number | undefined } | { type: 'split'; groupId: string; edge: 'left' | 'right' | 'top' | 'bottom' }): void
  maximize(id: string): void
  reset(): void
  registerLegacyLayout?(id: string, title: string, load: () => HostLayout & { version: 1 }): () => void
  registerCommand?(id: string, title: string, execute: () => Promise<unknown>): () => void
}
export function isUnifiedWorkspaceHost(value: unknown): value is UnifiedWorkspaceHost {
  const v = value as Partial<UnifiedWorkspaceHost> | undefined
  return v?.version === 'workspace.unified.v1' && typeof v.source?.getSnapshot === 'function'
    && typeof v.registerView === 'function' && typeof v.openPane === 'function' && typeof v.movePane === 'function'
}
interface SlotFace {
  inject(name: string, callback: () => () => void): () => void
  register(input: unknown, component: (props: never) => ReactNode): () => void
}

/** Compatibility projection, never a second writable layout. Owner metadata stays transient. */
export function createUnifiedHostAdapter(host: UnifiedWorkspaceHost, registry: PaneViewRegistry, context: () => Partial<PaneRef>, commands?: PaneCommandRegistry) {
  const requests = new Map<string, PaneViewSpecV1>()
  const listeners = new Set<() => void>()
  let revision = 0
  const mapNode = (node: HostNode): PaneSplitNodeV1 => node.type === 'group'
    ? { type: 'group', groupId: node.id }
    : { type: 'split', id: node.id, orientation: node.axis, ratio: node.ratio, first: mapNode(node.first), second: mapNode(node.second) }
  const viewOf = (pane: PaneRef, groupId: string): PaneViewInstanceV1 => {
    const request = requests.get(pane.id)
    const descriptor = registry.get(pane.kind)?.descriptor
    return {
      id: pane.id, kind: pane.kind, resourceKey: pane.resourceKey ?? pane.id,
      role: request?.role ?? descriptor?.role ?? 'general', region: 'right', groupId, title: pane.title,
      retention: request?.retention ?? descriptor?.retention ?? 'keep-alive', singleton: request?.singleton ?? descriptor?.singleton ?? true,
      preview: !pane.pinned, pinned: pane.pinned, dirty: request?.dirty ?? false,
      duplicate: false, closePolicy: request?.closePolicy ?? 'allow',
      status: descriptor ? 'ready' : 'orphaned', attention: request?.attention ?? false,
      offline: request?.offline ?? false, stale: request?.stale ?? false,
      ...(request?.metadata === undefined ? {} : { metadata: request.metadata }),
    }
  }
  const project = (): PaneWorkspaceV1 => {
    const layout = host.source.getSnapshot().layout
    const base = createPaneWorkspace()
    const groups: Record<string, PaneGroupV1> = {}
    const views: Record<string, PaneViewInstanceV1> = {}
    for (const group of Object.values(layout.groups)) {
      groups[group.id] = { id: group.id, region: 'right', role: 'general', locked: false, tabs: group.panes,
        ...(group.active === null ? {} : { activeTabId: group.active }) }
      for (const id of group.panes) views[id] = viewOf(layout.panes[id]!, group.id)
    }
    return { ...base, generation: revision, views, groups: { ...base.groups, ...groups },
      regions: { ...base.regions, right: { ...base.regions.right, visible: Object.keys(views).length > 0, root: layout.root === null ? base.regions.right.root : mapNode(layout.root) } },
      ...(layout.focused === null ? {} : { activeGroupId: layout.focused }),
      ...(layout.maximized === null ? {} : { maximizedGroupId: layout.maximized }),
    }
  }
  let snapshot = project()
  const publish = () => {
    revision++
    snapshot = project()
    for (const listener of listeners) { try { listener() } catch { /* One consumer cannot starve the other projections. */ } }
  }
  const offHost = host.source.subscribe(publish)
  const offRegistry = registry.subscribe(publish)
  const dispatch = (intent: PaneWorkspaceIntentV1Additive) => {
    let accepted = true
    let reason: string | undefined
    switch (intent.type) {
      case 'open_view': {
        const request = intent.request
        const descriptor = registry.get(request.kind)
        if (!descriptor) { accepted = false; reason = 'View provider is unavailable.'; break }
        const existing = Object.values(host.source.getSnapshot().layout.panes).find(p => p.kind === request.kind && (request.singleton || p.resourceKey === request.resourceKey))
        const id = existing?.id ?? request.viewId ?? `plugin:${request.kind}:${encodeURIComponent(request.resourceKey)}`
        requests.set(id, request)
        host.openPane({ ...context(), id, kind: request.kind, resourceKey: request.resourceKey,
          title: request.title ?? descriptor.descriptor.label, icon: descriptor.presentation?.icon,
          pinned: request.pinned ?? !request.preview })
        break
      }
      case 'activate_view': host.focusPane(intent.viewId); break
      case 'pin_view': host.pinPane(intent.viewId); break
      case 'move_view': case 'reorder_view': host.movePane(intent.viewId, { type: 'tab', groupId: intent.targetGroupId, index: intent.index }); break
      case 'split_with_view': host.movePane(intent.viewId, { type: 'split', groupId: intent.targetGroupId, edge: intent.edge }); break
      case 'maximize_group': host.maximize(intent.groupId); break
      case 'close_view': {
        const request = requests.get(intent.viewId)
        if (intent.decision === 'deny') { accepted = false; reason = 'View close was declined.'; break }
        if (request && request.closePolicy !== 'deny' && (intent.decision === 'allow' || intent.decision === 'confirm')) requests.set(intent.viewId, { ...request, dirty: false, closePolicy: 'allow' })
        void host.closePane(intent.viewId)
        break
      }
      case 'set_view_dirty': {
        const pane = host.source.getSnapshot().layout.panes[intent.viewId]
        const descriptor = pane && registry.get(pane.kind)?.descriptor
        const request = requests.get(intent.viewId) ?? (pane && descriptor ? { kind: pane.kind, resourceKey: pane.resourceKey ?? pane.id, role: descriptor.role, preferredRegion: descriptor.preferredRegion, retention: descriptor.retention, singleton: descriptor.singleton } : undefined)
        if (request) { requests.set(intent.viewId, { ...request, dirty: intent.dirty }); publish() }
        break
      }
      case 'update_view_presentation':
        if (intent.title !== undefined) host.updatePane?.(intent.viewId, { title: intent.title })
        break
      case 'set_region_visibility':
        // Old launchers reveal their view with open_view; region hiding cannot hide the conversation.
        if (!intent.visible) { accepted = false; reason = 'Close the desired panes from the host workspace.' }
        break
      case 'reset_layout': host.reset(); break
      default: accepted = false; reason = 'Use the host workspace for this layout operation.'
    }
    return { state: snapshot, accepted, ...(reason ? { reason } : {}), effects: [] }
  }
  const delegate: NonNullable<PaneWorkbenchControllerOptions['layoutDelegate']> = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, dispatch,
  }
  const mount = (slots: SlotFace, controller?: PaneWorkbenchController): (() => void) => slots.inject('workspace.pane', () => {
    const legacyDisposers: Array<() => void> = []
    let commandDisposers: Array<() => void> = []
    const syncCommands = () => {
      for (const dispose of commandDisposers) dispose()
      commandDisposers = commands?.snapshot().flatMap(command => {
        const dispose = host.registerCommand?.(command.descriptor.id, command.descriptor.label, () => commands.execute(command.descriptor.id))
        return dispose ? [dispose] : []
      }) ?? []
    }
    const offCommands = commands?.subscribe(syncCommands)
    syncCommands()
    // Discovery is read-only. Unknown project ownership requires an explicit import choice.
    try {
      const storage = probeWorkbenchStorage()
      const keys = new Set<string>([`${PANE_WORKSPACE_STORAGE_NAMESPACE}:session`])
      if (storage?.key && Number.isSafeInteger(storage.length)) {
        for (let i = 0; i < Math.min(storage.length!, 4096); i++) {
          const key = storage.key(i)
          if (key) keys.add(key)
        }
      }
      for (const key of keys) {
        if (!key?.startsWith(`${PANE_WORKSPACE_STORAGE_NAMESPACE}:`)) continue
        if (key !== `${PANE_WORKSPACE_STORAGE_NAMESPACE}:session` && !key.startsWith(`${PANE_WORKSPACE_STORAGE_NAMESPACE}:preset:`)) continue
        const raw = storage?.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw) as { schema?: string }
        if (!['pane.workspace.persisted.v1alpha1', 'pane.workspace.persisted.v2'].includes(parsed.schema ?? '')) continue
        const dispose = host.registerLegacyLayout?.(key, key.slice(PANE_WORKSPACE_STORAGE_NAMESPACE.length + 1), () => convertLegacyWorkspace(restorePaneWorkspace(parsed)))
        if (dispose) legacyDisposers.push(dispose)
      }
    } catch { /* Storage denial keeps the live host layout usable. */ }
    const registered = new Map<string, { registration: unknown; dispose: () => void }>()
    const sync = () => {
      const current = registry.snapshot().filter(isUnifiedHostCatalogView)
      for (const [kind, record] of registered) {
        if (current.find(v => v.descriptor.kind === kind) === record.registration) continue
        record.dispose(); registered.delete(kind)
      }
      for (const registration of current) {
        const { kind, label } = registration.descriptor
        if (registered.has(kind)) continue
        const rendererKey = `yeisme:${kind}`
        const offSlot = slots.register({ name: 'workspace.pane', key: rendererKey }, (({ pane }: { pane: PaneRef }) => {
          const layout = host.source.getSnapshot().layout
          const group = Object.values(layout.groups).find(g => g.panes.includes(pane.id))
          const view = viewOf(pane, group?.id ?? '')
          const content = controller
            ? createElement(PaneViewContent, { view, registration, registry, controller, onClose: id => { void host.closePane(id) } })
            : createElement(registration.component as ComponentType<PaneLocalViewProps>, { view, registry, projection: view.metadata, retry: publish })
          return createElement('div', { className: 'pwr-root', 'data-unified-pane-content': true },
            createElement('style', null, `${REGION_STYLES}\n[data-unified-pane-content]>[data-pane-view-generation]{height:100%;min-height:0;overflow:auto}`), content)
        }) as never)
        const offView = host.registerView({ kind, title: label, rendererKey, icon: registration.presentation?.icon,
          beforeClose: id => {
            const request = requests.get(id)
            // Preserve the provider's save protection. No implicit discard or run cancellation.
            return !(request?.dirty || request?.closePolicy === 'deny' || request?.closePolicy === 'confirm')
          },
        })
        registered.set(kind, { registration, dispose: () => { offView(); offSlot() } })
      }
    }
    const off = registry.subscribe(sync)
    sync()
    return () => { off(); offCommands?.(); for (const dispose of commandDisposers) dispose(); for (const record of registered.values()) record.dispose(); for (const dispose of legacyDisposers) dispose() }
  })
  return { delegate, mount, dispose: () => { offHost(); offRegistry(); listeners.clear() } }
}

/** Preserve the old split topology, while importing only safe view references. */
export function convertLegacyWorkspace(old: PaneWorkspaceV1): HostLayout & { version: 1 } {
  const groups: HostLayout['groups'] = {}, panes: HostLayout['panes'] = {}
  const node = (source: PaneSplitNodeV1): HostNode | null => {
    if (source.type === 'group') {
      const group = old.groups[source.groupId]
      const ids = group?.tabs.filter(id => old.views[id] !== undefined) ?? []
      if (!group || ids.length === 0) return null
      groups[group.id] = { id: group.id, panes: [...ids], active: group.activeTabId && ids.includes(group.activeTabId) ? group.activeTabId : ids[0]! }
      for (const id of ids) {
        const view = old.views[id]!
        const kind = view.kind === 'file.tree' || view.kind === 'desktop.files' ? 'dsh.explorer' : view.kind
        panes[id] = { id, kind, title: view.title, resourceKey: view.resourceKey, pinned: view.pinned }
      }
      return { type: 'group', id: group.id }
    }
    const first = node(source.first), second = node(source.second)
    if (!first) return second
    if (!second) return first
    return { type: 'split', id: source.id, axis: source.orientation, ratio: source.ratio, first, second }
  }
  const right = node(old.regions.right.root), bottom = node(old.regions.bottom.root)
  const root: HostNode | null = right && bottom
    ? { type: 'split', id: 'legacy:regions', axis: 'vertical', ratio: .65, first: right, second: bottom }
    : right ?? bottom
  return { version: 1, workspaceId: 'unassigned', root, groups, panes, floating: [],
    focused: old.activeGroupId && groups[old.activeGroupId] ? old.activeGroupId : Object.keys(groups)[0] ?? null,
    maximized: null }
}

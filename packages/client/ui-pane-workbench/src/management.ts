import { JsonValueSchema, type JsonValue, type PaneViewDescriptorV1 } from '@yeisme/dsh-pane-protocol'
import type { ReactNode } from 'react'
import { t } from './i18n/locale.js'
import type { PaneWorkspaceStorageV1 } from './persistence.js'
import type { PaneViewRegistrationV1 } from './view-registry.js'
import type {
  PaneRegionId,
  PaneViewInstanceV1,
  PaneViewSpecV1,
  PaneWorkspaceSnapshotV1,
} from './workspace.js'

export const PANE_MANAGEMENT_SCHEMA = 'pane.management.v1' as const
export const PANE_CLOSED_HISTORY_SCHEMA = 'pane.closed-history.v1' as const
export const PANE_MANAGEMENT_STORAGE_NAMESPACE = 'yeisme.dsh.pane-management' as const
export const PANE_RESTORE_STATE_MAX_BYTES = 16 * 1_024
export const PANE_HISTORY_MAX_BATCHES = 50
export const PANE_HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000
export const PANE_CONVERSATION_SEARCH_CONTEXT_KEY = 'dsh.paneConversationSearch' as const
export const PANE_WORKSPACE_CONTEXT_KEY = 'dsh.paneWorkspaceContext' as const
export const PANE_MANAGEMENT_KEYMAP_CONTEXT_KEY = 'dsh.paneManagementKeymap' as const
export const PANE_RENDITION_RENDERER_CONTEXT_KEY = 'dsh.paneRenditionRenderer' as const

export type PaneManagementMode = 'open' | 'manage'
export type PaneManagementScopeKind = 'workspace' | 'session'
export type PaneManagementEntrySource = 'pane' | 'tab' | 'history' | 'conversation'

export interface PaneManagementKeymapV1 {
  readonly openCenter: readonly string[]
  readonly closeActive: readonly string[]
  readonly closeUnpinned: readonly string[]
  readonly restoreClosed: readonly string[]
}

export type PaneManagementShortcutAction = 'open_center' | 'close_active' | 'close_unpinned' | 'restore_closed'

export const DEFAULT_PANE_MANAGEMENT_KEYMAP: PaneManagementKeymapV1 = Object.freeze({
  openCenter: ['ctrl+p', 'meta+p'],
  closeActive: ['ctrl+w', 'meta+w'],
  closeUnpinned: ['ctrl+shift+w', 'meta+shift+w'],
  restoreClosed: ['ctrl+shift+t', 'meta+shift+t'],
})

export function resolvePaneManagementKeymap(overrides?: Partial<PaneManagementKeymapV1>): PaneManagementKeymapV1 {
  return {
    openCenter: overrides?.openCenter ?? DEFAULT_PANE_MANAGEMENT_KEYMAP.openCenter,
    closeActive: overrides?.closeActive ?? DEFAULT_PANE_MANAGEMENT_KEYMAP.closeActive,
    closeUnpinned: overrides?.closeUnpinned ?? DEFAULT_PANE_MANAGEMENT_KEYMAP.closeUnpinned,
    restoreClosed: overrides?.restoreClosed ?? DEFAULT_PANE_MANAGEMENT_KEYMAP.restoreClosed,
  }
}

export function formatPaneManagementKeyEvent(event: {
  readonly key: string
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
  readonly altKey?: boolean
  readonly shiftKey?: boolean
}): string {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('ctrl')
  if (event.metaKey) parts.push('meta')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  parts.push(event.key.toLowerCase())
  return parts.join('+')
}

export function resolvePaneManagementShortcut(
  event: Parameters<typeof formatPaneManagementKeyEvent>[0],
  overrides?: Partial<PaneManagementKeymapV1>,
): PaneManagementShortcutAction | undefined {
  const binding = formatPaneManagementKeyEvent(event)
  const keymap = resolvePaneManagementKeymap(overrides)
  if (keymap.openCenter.some(value => value.toLowerCase() === binding)) return 'open_center'
  if (keymap.closeUnpinned.some(value => value.toLowerCase() === binding)) return 'close_unpinned'
  if (keymap.closeActive.some(value => value.toLowerCase() === binding)) return 'close_active'
  if (keymap.restoreClosed.some(value => value.toLowerCase() === binding)) return 'restore_closed'
  return undefined
}

export interface PaneManagementScopeV1 {
  readonly kind: PaneManagementScopeKind
  readonly ref: string
}

export interface PaneCustomGroupV1 {
  readonly id: string
  readonly label: string
  readonly order: number
  readonly pinned: boolean
  readonly paneKinds: readonly string[]
}

export interface PaneManagementProfileV1 {
  readonly schema: typeof PANE_MANAGEMENT_SCHEMA
  readonly groups: readonly PaneCustomGroupV1[]
  readonly favoritePaneKinds: readonly string[]
  readonly recentPaneKinds: readonly string[]
}

export interface PaneWorkspaceManagementV1 {
  readonly schema: typeof PANE_MANAGEMENT_SCHEMA
  readonly scope: PaneManagementScopeV1
  readonly groupMembership: Readonly<Record<string, readonly string[]>>
  readonly pinnedResourceKeys: readonly string[]
}

export interface PaneManagementSnapshotV1 {
  readonly scope: PaneManagementScopeV1
  readonly profile: PaneManagementProfileV1
  readonly workspace: PaneWorkspaceManagementV1
  readonly history: readonly PaneClosedHistoryBatchV1[]
  readonly lastClosedBatch?: PaneClosedHistoryBatchV1
}

export interface PaneRestoreStateV1 {
  readonly state?: JsonValue
  readonly renditionRef?: string
}

/** Local Host renderer for provider-approved opaque cached renditions. Pane never dereferences the ref itself. */
export interface PaneSafeRenditionRendererV1 {
  readonly capability: 'pane.safe-rendition-renderer.v1'
  render(input: {
    readonly renditionRef: string
    readonly kind: string
    readonly resourceKey: string
    readonly resourceVersion?: string
  }): ReactNode
}

export interface PaneClosedHistoryEntryV1 {
  readonly view: PaneViewSpecV1
  readonly groupId: string
  readonly region: PaneRegionId
  readonly index: number
  readonly wasActive: boolean
  readonly restore?: PaneRestoreStateV1
}

export interface PaneClosedHistoryBatchV1 {
  readonly id: string
  readonly closedAt: string
  readonly scope: PaneManagementScopeV1
  readonly pinned: boolean
  readonly entries: readonly PaneClosedHistoryEntryV1[]
}

export interface PaneClosedHistoryEnvelopeV1 {
  readonly schema: typeof PANE_CLOSED_HISTORY_SCHEMA
  readonly scope: PaneManagementScopeV1
  readonly batches: readonly PaneClosedHistoryBatchV1[]
}

export interface PaneManagementEntryV1 {
  readonly key: string
  readonly source: PaneManagementEntrySource
  readonly title: string
  readonly kind: string
  readonly groupId: string
  readonly owner?: string
  readonly order?: number
  readonly role?: PaneViewDescriptorV1['role']
  readonly region?: PaneRegionId
  readonly viewId?: string
  readonly historyBatchId?: string
  readonly workspaceRef?: string
  readonly pinned: boolean
  readonly active: boolean
  readonly opened: boolean
  readonly recent: boolean
  readonly statusTokens: readonly string[]
  readonly keywords: readonly string[]
  readonly descriptor?: PaneViewDescriptorV1
  /** Resolved pane description: local i18n key → descriptor presentation → instance preview. */
  readonly description?: string
  /** Host-provided freshness for history (closedAt) and conversation (updatedAt) rows. */
  readonly updatedAt?: string
}

export interface PaneManagementFiltersV1 {
  readonly sources?: ReadonlySet<PaneManagementEntrySource>
  readonly groupIds?: ReadonlySet<string>
  readonly regions?: ReadonlySet<PaneRegionId>
  readonly owners?: ReadonlySet<string>
  readonly kinds?: ReadonlySet<string>
  readonly statuses?: ReadonlySet<string>
  readonly pinned?: boolean
}

export interface PaneWorkspaceContextV1 {
  readonly workspaceRef?: string
  readonly sessionRef?: string
  readonly revision: string
}

export interface PaneWorkspaceSearchTargetV1 {
  readonly workspaceRef: string
  readonly label: string
}

export interface PaneWorkspaceSearchItemV1 {
  readonly workspaceRef: string
  readonly ref: string
  readonly source: 'tab' | 'history'
  readonly title: string
  readonly kind: string
  readonly groupId?: string
  readonly owner?: string
  readonly region?: PaneRegionId
  readonly pinned?: boolean
  readonly statusTokens?: readonly string[]
  /** Host-approved bounded summary; clients truncate beyond PANE_DESCRIPTION_MAX. */
  readonly description?: string
}

export interface PaneWorkspaceSearchPageV1 {
  readonly items: readonly PaneWorkspaceSearchItemV1[]
  readonly nextCursor?: string
  readonly status: 'ready' | 'partial' | 'permission_denied' | 'offline' | 'contract_mismatch'
  readonly reason?: string
}

export interface PaneWorkspaceContextProviderV1 {
  getSnapshot(): PaneWorkspaceContextV1
  subscribe?(listener: () => void): () => void
  listWorkspaces?(): readonly PaneWorkspaceSearchTargetV1[]
  search?(request: {
    readonly workspaceRefs: readonly string[]
    readonly query: string
    readonly cursor?: string
    readonly limit: number
  }, signal?: AbortSignal): Promise<PaneWorkspaceSearchPageV1>
  open?(item: PaneWorkspaceSearchItemV1): void | Promise<void>
}

export interface PaneConversationSearchRequestV1 {
  readonly workspaceRef: string
  readonly sessionRef?: string
  readonly query: string
  readonly cursor?: string
  readonly limit: number
}

export interface PaneConversationSearchItemV1 {
  readonly sessionRef: string
  readonly messageRef: string
  readonly title: string
  readonly snippet: string
  readonly updatedAt?: string
}

export interface PaneConversationSearchPageV1 {
  readonly items: readonly PaneConversationSearchItemV1[]
  readonly nextCursor?: string
  readonly status: 'ready' | 'partial' | 'permission_denied' | 'offline' | 'contract_mismatch'
  readonly reason?: string
}

export interface PaneConversationSearchHostV1 {
  readonly capability: 'pane.conversation-search.v1'
  search(request: PaneConversationSearchRequestV1, signal?: AbortSignal): Promise<PaneConversationSearchPageV1>
  open(item: PaneConversationSearchItemV1): void | Promise<void>
}

const EMPTY_PROFILE: PaneManagementProfileV1 = Object.freeze({
  schema: PANE_MANAGEMENT_SCHEMA,
  groups: [],
  favoritePaneKinds: [],
  recentPaneKinds: [],
})

const UNSAFE_RESTORE_KEYS = new Set([
  'authorization', 'body', 'content', 'cookie', 'credential', 'dom', 'privatearguments',
  'providerpayload', 'rawprompt', 'secret', 'terminaloutput', 'token',
])
const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/
const EXECUTABLE_URL = /^(?:https?|file|javascript|data):/i
const SAFE_REF = /^[a-z0-9][a-z0-9._:/-]*$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function unique(values: readonly string[], max = 200): readonly string[] {
  return [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))].slice(0, max)
}

function validLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 80
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 && SAFE_REF.test(value)
}

function validScope(input: unknown): input is PaneManagementScopeV1 {
  return isRecord(input) && (input.kind === 'workspace' || input.kind === 'session') && validId(input.ref)
}

function inspectRestoreValue(value: JsonValue, path: readonly string[] = []): boolean {
  if (typeof value === 'string') return !ABSOLUTE_PATH.test(value) && !EXECUTABLE_URL.test(value)
  if (Array.isArray(value)) return value.every(item => inspectRestoreValue(item, path))
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).every(([key, child]) => (
      !UNSAFE_RESTORE_KEYS.has(key.toLowerCase()) && inspectRestoreValue(child, [...path, key])
    ))
  }
  return true
}

export function sanitizePaneRestoreState(input: unknown): JsonValue | undefined {
  const parsed = JsonValueSchema.safeParse(input)
  if (!parsed.success || !inspectRestoreValue(parsed.data)) return undefined
  try {
    if (new TextEncoder().encode(JSON.stringify(parsed.data)).byteLength > PANE_RESTORE_STATE_MAX_BYTES) return undefined
  } catch {
    return undefined
  }
  return parsed.data
}

export function sanitizePaneRenditionRef(input: unknown): string | undefined {
  if (typeof input !== 'string' || input.length === 0 || input.length > 512) return undefined
  if (!SAFE_REF.test(input) || ABSOLUTE_PATH.test(input) || EXECUTABLE_URL.test(input)) return undefined
  return input
}

export const PANE_DESCRIPTION_MAX = 240

function boundedDescription(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) return undefined
  return value.length > PANE_DESCRIPTION_MAX ? value.slice(0, PANE_DESCRIPTION_MAX - 1) + '…' : value
}

/** Shared display-side bound for entry descriptions, including host-provided ones. */
export function boundedPaneDescription(value: string | undefined): string | undefined {
  return boundedDescription(value)
}

/** Resolves a pane description from the local i18n key first, then the descriptor presentation summary. */
export function resolvePaneDescription(registration: PaneViewRegistrationV1 | undefined): string | undefined {
  const key = registration?.i18n?.descriptionKey
  if (key !== undefined) {
    const translated = t(key)
    if (translated !== key) return translated
  }
  return registration?.descriptor.presentation?.description
}

function groupOfDescriptor(descriptor: PaneViewDescriptorV1): string {
  const explicit = descriptor.presentation?.group ?? descriptor.presentation?.task
  if (explicit !== undefined) return explicit
  const kind = descriptor.kind.toLowerCase()
  if (kind.includes('agent') || kind.includes('subagent')) return 'agents'
  if (/(creator|drama|image|audio|video|media|studio)/.test(kind)) return 'creator'
  if (/(file|git|terminal|explorer|browser|mcp|tool)/.test(kind)) return 'development'
  if (/(document|readme|context|knowledge|note)/.test(kind)) return 'knowledge'
  if (descriptor.role === 'utility' || descriptor.role === 'inspector') return 'system'
  return 'other'
}

function statusTokens(view: PaneViewInstanceV1): readonly string[] {
  const tokens: string[] = [view.status]
  if (view.pinned) tokens.push('pinned')
  if (view.dirty) tokens.push('dirty')
  if (view.attention) tokens.push('attention')
  if (view.offline) tokens.push('offline')
  if (view.stale) tokens.push('stale')
  const lifecycle = view.metadata?.lifecycle ?? view.metadata?.status
  if (typeof lifecycle === 'string') tokens.push(lifecycle)
  return unique(tokens, 20)
}

function historyViewSpec(view: PaneViewInstanceV1): PaneViewSpecV1 {
  return {
    kind: view.kind,
    resourceKey: view.resourceKey,
    role: view.role,
    preferredRegion: view.region,
    retention: view.retention,
    singleton: view.singleton,
    viewId: view.id,
    title: view.title,
    preview: view.preview,
    pinned: view.pinned,
    dirty: false,
    duplicate: view.duplicate,
    closePolicy: view.closePolicy,
    attention: view.attention,
    offline: view.offline,
    stale: view.stale,
    resourceVersion: view.resourceVersion,
    instanceLabel: view.instanceLabel,
  }
}

let batchCounter = 0

export function createClosedHistoryBatch(input: {
  readonly state: PaneWorkspaceSnapshotV1
  readonly viewIds: readonly string[]
  readonly scope: PaneManagementScopeV1
  readonly restoreByViewId?: Readonly<Record<string, PaneRestoreStateV1 | undefined>>
  readonly now?: Date
}): PaneClosedHistoryBatchV1 | undefined {
  const entries: PaneClosedHistoryEntryV1[] = []
  for (const viewId of input.viewIds) {
    const view = input.state.views[viewId]
    const group = view === undefined ? undefined : input.state.groups[view.groupId]
    if (view === undefined || group === undefined) continue
    const candidate = input.restoreByViewId?.[viewId]
    const state = sanitizePaneRestoreState(candidate?.state)
    const renditionRef = sanitizePaneRenditionRef(candidate?.renditionRef)
    entries.push({
      view: historyViewSpec(view),
      groupId: group.id,
      region: group.region,
      index: group.tabs.indexOf(view.id),
      wasActive: group.activeTabId === view.id,
      ...state === undefined && renditionRef === undefined ? {} : { restore: { state, renditionRef } },
    })
  }
  if (entries.length === 0) return undefined
  const now = input.now ?? new Date()
  batchCounter += 1
  return {
    id: `closed:${now.getTime().toString(36)}:${batchCounter.toString(36)}`,
    closedAt: now.toISOString(),
    scope: input.scope,
    pinned: entries.some(entry => Boolean(entry.view.pinned)),
    entries,
  }
}

export function pruneClosedHistory(
  batches: readonly PaneClosedHistoryBatchV1[],
  now = Date.now(),
): readonly PaneClosedHistoryBatchV1[] {
  const fresh = batches.filter(batch => {
    const closedAt = Date.parse(batch.closedAt)
    return Number.isFinite(closedAt) && now - closedAt <= PANE_HISTORY_MAX_AGE_MS
  })
  if (fresh.length <= PANE_HISTORY_MAX_BATCHES) return fresh
  const pinned = fresh.filter(batch => batch.pinned)
  const unpinned = fresh.filter(batch => !batch.pinned)
  const keepUnpinned = Math.max(0, PANE_HISTORY_MAX_BATCHES - pinned.length)
  return [...pinned, ...unpinned.slice(0, keepUnpinned)]
    .sort((left, right) => right.closedAt.localeCompare(left.closedAt))
    .slice(0, PANE_HISTORY_MAX_BATCHES)
}

function parseGroup(input: unknown): PaneCustomGroupV1 | undefined {
  if (!isRecord(input) || !validId(input.id) || !validLabel(input.label) || !Number.isFinite(input.order)) return undefined
  return {
    id: input.id,
    label: input.label.trim(),
    order: Number(input.order),
    pinned: input.pinned === true,
    paneKinds: unique(Array.isArray(input.paneKinds) ? input.paneKinds.filter(validId) : [], 200),
  }
}

function parseProfile(input: unknown): PaneManagementProfileV1 {
  if (!isRecord(input) || input.schema !== PANE_MANAGEMENT_SCHEMA) return EMPTY_PROFILE
  const groups = Array.isArray(input.groups) ? input.groups.map(parseGroup).filter(group => group !== undefined) : []
  return {
    schema: PANE_MANAGEMENT_SCHEMA,
    groups,
    favoritePaneKinds: unique(Array.isArray(input.favoritePaneKinds) ? input.favoritePaneKinds.filter(validId) : [], 200),
    recentPaneKinds: unique(Array.isArray(input.recentPaneKinds) ? input.recentPaneKinds.filter(validId) : [], 20),
  }
}

function parseWorkspaceManagement(input: unknown, fallbackScope: PaneManagementScopeV1): PaneWorkspaceManagementV1 {
  if (!isRecord(input) || input.schema !== PANE_MANAGEMENT_SCHEMA || !validScope(input.scope)) {
    return { schema: PANE_MANAGEMENT_SCHEMA, scope: fallbackScope, groupMembership: {}, pinnedResourceKeys: [] }
  }
  const membership = isRecord(input.groupMembership)
    ? Object.fromEntries(Object.entries(input.groupMembership).flatMap(([id, values]) => (
      validId(id) && Array.isArray(values) ? [[id, unique(values.filter(validId), 200)]] : []
    )))
    : {}
  return {
    schema: PANE_MANAGEMENT_SCHEMA,
    scope: input.scope,
    groupMembership: membership,
    pinnedResourceKeys: unique(Array.isArray(input.pinnedResourceKeys) ? input.pinnedResourceKeys.filter(validId) : [], 500),
  }
}

function parseHistory(input: unknown, scope: PaneManagementScopeV1): PaneClosedHistoryEnvelopeV1 {
  if (!isRecord(input) || input.schema !== PANE_CLOSED_HISTORY_SCHEMA || !validScope(input.scope) || !Array.isArray(input.batches)) {
    return { schema: PANE_CLOSED_HISTORY_SCHEMA, scope, batches: [] }
  }
  const batches = input.batches.flatMap(candidate => {
    if (!isRecord(candidate) || !validId(candidate.id) || typeof candidate.closedAt !== 'string' || !validScope(candidate.scope) || !Array.isArray(candidate.entries)) return []
    const entries = candidate.entries.flatMap(raw => {
      if (!isRecord(raw) || !isRecord(raw.view) || !validId(raw.groupId) || (raw.region !== 'right' && raw.region !== 'bottom') || typeof raw.index !== 'number' || !Number.isInteger(raw.index)) return []
      const view = raw.view as unknown as PaneViewSpecV1
      if (!validId(view.kind) || !validId(view.resourceKey) || typeof view.title !== 'string') return []
      const restore = isRecord(raw.restore) ? {
        state: sanitizePaneRestoreState(raw.restore.state),
        renditionRef: sanitizePaneRenditionRef(raw.restore.renditionRef),
      } : undefined
      return [{
        view,
        groupId: raw.groupId,
        region: raw.region,
        index: Number(raw.index),
        wasActive: raw.wasActive === true,
        ...(restore?.state === undefined && restore?.renditionRef === undefined ? {} : { restore }),
      } satisfies PaneClosedHistoryEntryV1]
    })
    if (entries.length === 0) return []
    return [{
      id: candidate.id,
      closedAt: candidate.closedAt,
      scope: candidate.scope,
      pinned: candidate.pinned === true,
      entries,
    } satisfies PaneClosedHistoryBatchV1]
  })
  return { schema: PANE_CLOSED_HISTORY_SCHEMA, scope: input.scope, batches: pruneClosedHistory(batches) }
}

function scopeKey(scope: PaneManagementScopeV1): string {
  let hash = 2_166_136_261
  for (const char of `${scope.kind}:${scope.ref}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619)
  return `${scope.kind}:${(hash >>> 0).toString(36)}`
}

export class PaneManagementPersistenceAdapter {
  constructor(
    private readonly storage: PaneWorkspaceStorageV1,
    private readonly namespace = PANE_MANAGEMENT_STORAGE_NAMESPACE,
  ) {}

  loadProfile(): PaneManagementProfileV1 {
    return parseProfile(this.read(`${this.namespace}:profile`))
  }

  saveProfile(profile: PaneManagementProfileV1): boolean {
    return this.write(`${this.namespace}:profile`, parseProfile(profile))
  }

  loadWorkspace(scope: PaneManagementScopeV1): PaneWorkspaceManagementV1 {
    return parseWorkspaceManagement(this.read(`${this.namespace}:workspace:${scopeKey(scope)}`), scope)
  }

  saveWorkspace(value: PaneWorkspaceManagementV1): boolean {
    return this.write(`${this.namespace}:workspace:${scopeKey(value.scope)}`, parseWorkspaceManagement(value, value.scope))
  }

  loadHistory(scope: PaneManagementScopeV1): PaneClosedHistoryEnvelopeV1 {
    return parseHistory(this.read(`${this.namespace}:history:${scopeKey(scope)}`), scope)
  }

  saveHistory(scope: PaneManagementScopeV1, batches: readonly PaneClosedHistoryBatchV1[]): boolean {
    return this.write(`${this.namespace}:history:${scopeKey(scope)}`, {
      schema: PANE_CLOSED_HISTORY_SCHEMA,
      scope,
      batches: pruneClosedHistory(batches),
    } satisfies PaneClosedHistoryEnvelopeV1)
  }

  seedScope(from: PaneManagementScopeV1, to: PaneManagementScopeV1): void {
    const targetHistory = this.loadHistory(to)
    if (targetHistory.batches.length === 0) this.saveHistory(to, this.loadHistory(from).batches.map(batch => ({ ...batch, scope: to })))
    const targetWorkspace = this.loadWorkspace(to)
    if (Object.keys(targetWorkspace.groupMembership).length === 0 && targetWorkspace.pinnedResourceKeys.length === 0) {
      const source = this.loadWorkspace(from)
      this.saveWorkspace({ ...source, scope: to })
    }
  }

  private read(key: string): unknown {
    try {
      const raw = this.storage.getItem(key)
      return typeof raw === 'string' ? JSON.parse(raw) as unknown : undefined
    } catch {
      return undefined
    }
  }

  private write(key: string, value: unknown): boolean {
    try {
      this.storage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }
}

export function upsertCustomGroup(
  profile: PaneManagementProfileV1,
  input: { readonly id?: string; readonly label: string; readonly paneKinds?: readonly string[] },
): PaneManagementProfileV1 {
  const label = input.label.trim().slice(0, 80)
  if (label.length === 0) return profile
  const id = input.id && validId(input.id) ? input.id : `group:${slug(label)}:${profile.groups.length + 1}`
  const existing = profile.groups.find(group => group.id === id)
  const group: PaneCustomGroupV1 = {
    id,
    label,
    order: existing?.order ?? profile.groups.length,
    pinned: existing?.pinned ?? false,
    paneKinds: unique(input.paneKinds ?? existing?.paneKinds ?? [], 200),
  }
  return { ...profile, groups: [...profile.groups.filter(item => item.id !== id), group].sort((a, b) => a.order - b.order) }
}

export function removeCustomGroup(profile: PaneManagementProfileV1, groupId: string): PaneManagementProfileV1 {
  return { ...profile, groups: profile.groups.filter(group => group.id !== groupId) }
}

export function updateCustomGroup(
  profile: PaneManagementProfileV1,
  groupId: string,
  patch: { readonly label?: string; readonly pinned?: boolean; readonly move?: -1 | 1 },
): PaneManagementProfileV1 {
  const index = profile.groups.findIndex(group => group.id === groupId)
  if (index < 0) return profile
  const groups = [...profile.groups]
  const current = groups[index]!
  const label = patch.label === undefined ? current.label : patch.label.trim().slice(0, 80)
  groups[index] = { ...current, label: label.length === 0 ? current.label : label, pinned: patch.pinned ?? current.pinned }
  if (patch.move !== undefined) {
    const target = Math.max(0, Math.min(groups.length - 1, index + patch.move))
    const [moved] = groups.splice(index, 1)
    if (moved !== undefined) groups.splice(target, 0, moved)
  }
  return { ...profile, groups: groups.map((group, order) => ({ ...group, order })) }
}

export function togglePaneFavorite(profile: PaneManagementProfileV1, kind: string): PaneManagementProfileV1 {
  const set = new Set(profile.favoritePaneKinds)
  if (set.has(kind)) set.delete(kind)
  else set.add(kind)
  return { ...profile, favoritePaneKinds: [...set] }
}

export function noteRecentPane(profile: PaneManagementProfileV1, kind: string): PaneManagementProfileV1 {
  return { ...profile, recentPaneKinds: [kind, ...profile.recentPaneKinds.filter(item => item !== kind)].slice(0, 20) }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'custom'
}

export function buildPaneManagementEntries(input: {
  readonly registrations: readonly PaneViewRegistrationV1[]
  readonly state: PaneWorkspaceSnapshotV1
  readonly history: readonly PaneClosedHistoryBatchV1[]
  readonly profile: PaneManagementProfileV1
  readonly workspace?: PaneWorkspaceManagementV1
}): readonly PaneManagementEntryV1[] {
  const activeId = input.state.activeGroupId === undefined ? undefined : input.state.groups[input.state.activeGroupId]?.activeTabId
  const recent = new Set(input.profile.recentPaneKinds)
  const favorite = new Set(input.profile.favoritePaneKinds)
  const byKind = new Map(input.registrations.map(registration => [registration.descriptor.kind, registration]))
  const entries: PaneManagementEntryV1[] = []

  for (const view of Object.values(input.state.views)) {
    const registration = byKind.get(view.kind)
    entries.push({
      key: `tab:${view.id}`,
      source: 'tab',
      title: view.title,
      kind: view.kind,
      groupId: registration === undefined ? fallbackGroupForView(view) : groupOfDescriptor(registration.descriptor),
      owner: registration?.descriptor.presentation?.owner,
      order: registration?.descriptor.presentation?.order,
      role: view.role,
      region: view.region,
      viewId: view.id,
      pinned: view.pinned,
      active: view.id === activeId,
      opened: true,
      recent: recent.has(view.kind),
      statusTokens: statusTokens(view),
      keywords: unique([view.title, view.kind, view.instanceLabel ?? '', ...(registration?.descriptor.presentation?.keywords ?? [])], 40),
      descriptor: registration?.descriptor,
      description: boundedDescription(resolvePaneDescription(registration)),
    })
  }

  for (const registration of input.registrations) {
    if (registration.showInPicker === false) continue
    const descriptor = registration.descriptor
    entries.push({
      key: `pane:${descriptor.kind}`,
      source: 'pane',
      title: descriptor.label,
      kind: descriptor.kind,
      groupId: groupOfDescriptor(descriptor),
      owner: descriptor.presentation?.owner,
      order: descriptor.presentation?.order,
      role: descriptor.role,
      pinned: favorite.has(descriptor.kind),
      active: false,
      opened: Object.values(input.state.views).some(view => view.kind === descriptor.kind),
      recent: recent.has(descriptor.kind),
      statusTokens: [],
      keywords: unique([descriptor.label, descriptor.kind, ...(descriptor.presentation?.keywords ?? [])], 40),
      descriptor,
      description: boundedDescription(resolvePaneDescription(registration)),
    })
  }

  for (const group of input.profile.groups) {
    const kinds = unique([...(group.paneKinds ?? []), ...(input.workspace?.groupMembership[group.id] ?? [])], 200)
    for (const kind of kinds) {
      const registration = byKind.get(kind)
      if (registration === undefined || registration.showInPicker === false) continue
      const descriptor = registration.descriptor
      entries.push({
        key: `pane:${kind}:group:${group.id}`,
        source: 'pane',
        title: descriptor.label,
        kind,
        groupId: group.id,
        owner: descriptor.presentation?.owner,
        order: descriptor.presentation?.order,
        role: descriptor.role,
        pinned: favorite.has(kind),
        active: false,
        opened: Object.values(input.state.views).some(view => view.kind === kind),
        recent: recent.has(kind),
        statusTokens: [],
        keywords: unique([descriptor.label, descriptor.kind, group.label, ...(descriptor.presentation?.keywords ?? [])], 40),
        descriptor,
        description: boundedDescription(resolvePaneDescription(registration)),
      })
    }
  }

  for (const batch of input.history) {
    for (const entry of batch.entries) {
      entries.push({
        key: `history:${batch.id}:${entry.view.viewId ?? entry.view.resourceKey}`,
        source: 'history',
        title: entry.view.title ?? entry.view.resourceKey,
        kind: entry.view.kind,
        groupId: 'history',
        role: entry.view.role,
        region: entry.region,
        historyBatchId: batch.id,
        pinned: Boolean(entry.view.pinned),
        active: false,
        opened: false,
        recent: true,
        statusTokens: ['closed'],
        keywords: unique([entry.view.title ?? '', entry.view.kind, entry.view.resourceKey, 'closed'], 20),
        description: boundedDescription(resolvePaneDescription(byKind.get(entry.view.kind))),
        updatedAt: batch.closedAt,
      })
    }
  }
  return entries
}

function fallbackGroupForView(view: PaneViewInstanceV1): string {
  const kind = view.kind.toLowerCase()
  if (kind.includes('agent')) return 'agents'
  if (/(creator|drama|media|image|audio|video)/.test(kind)) return 'creator'
  if (/(file|git|terminal|explorer|browser|mcp|tool)/.test(kind)) return 'development'
  if (/(document|readme|context|knowledge|note)/.test(kind)) return 'knowledge'
  return view.role === 'utility' || view.role === 'inspector' ? 'system' : 'other'
}

export function filterAndRankPaneEntries(
  entries: readonly PaneManagementEntryV1[],
  query: string,
  filters: PaneManagementFiltersV1 = {},
): readonly PaneManagementEntryV1[] {
  const needle = query.trim().replace(/^@conversation\s*/i, '').toLocaleLowerCase()
  const matches = entries.filter(entry => {
    if (filters.sources !== undefined && !filters.sources.has(entry.source)) return false
    if (filters.groupIds !== undefined && !filters.groupIds.has(entry.groupId)) return false
    if (filters.regions !== undefined && (entry.region === undefined || !filters.regions.has(entry.region))) return false
    if (filters.owners !== undefined && (entry.owner === undefined || !filters.owners.has(entry.owner))) return false
    if (filters.kinds !== undefined && !filters.kinds.has(entry.kind)) return false
    if (filters.pinned !== undefined && entry.pinned !== filters.pinned) return false
    if (filters.statuses !== undefined && !entry.statusTokens.some(status => filters.statuses!.has(status))) return false
    if (needle.length === 0) return true
    return [entry.title, entry.kind, entry.owner, entry.groupId, entry.description, ...entry.keywords, ...entry.statusTokens]
      .some(value => value?.toLocaleLowerCase().includes(needle) === true)
  })
  return matches.sort((left, right) => {
    const score = (entry: PaneManagementEntryV1): number => {
      const exact = needle.length > 0 && (entry.title.toLocaleLowerCase() === needle || entry.kind.toLocaleLowerCase() === needle)
      return Number(exact) * 10_000
        + Number(entry.active) * 5_000
        + Number(entry.source === 'tab') * 3_000
        + Number(entry.pinned) * 2_000
        + Number(entry.recent) * 1_000
        + Number(entry.source === 'pane') * 500
        + Number(entry.source === 'history') * 100
    }
    return score(right) - score(left)
      || (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
      || left.title.localeCompare(right.title)
  }).slice(0, 200)
}

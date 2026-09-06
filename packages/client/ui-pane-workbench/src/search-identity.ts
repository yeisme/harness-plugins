import type { PaneCommandRegistrationV1 } from './composition.js'
import { isWorkbenchIconName, type WorkbenchIconName } from './icon.js'
import type { PaneConversationSearchItemV1, PaneManagementProfileV1, PaneWorkspaceSearchItemV1 } from './management.js'
import type { PaneViewRegistrationV1 } from './view-registry.js'
import type { PaneViewInstanceV1, PaneWorkspaceV1 } from './workspace.js'

/**
 * Runtime inventory (task 1.1). Historical OpenSpec completion is not runtime:
 * - Local pane catalog: `PaneViewRegistry` + `buildPaneManagementEntries` (available).
 * - Commands: `PaneCommandRegistry` exists but is not in the current search overlay.
 * - Open tabs: `PaneWorkbenchController` workspace snapshot (available).
 * - Closed-tab history: management persistence (available; not conversation history).
 * - Conversation body: optional `PaneConversationSearchHostV1` (probe required).
 * - Cross-workspace catalog: optional `PaneWorkspaceContextProviderV1.search` (single-workspace
 *   requests must not be given a forged global ref).
 * Duplicate-target baseline: a pane row and an open-only command with the same owner/view/resource
 * currently both render; namesakes with different targets also both render.
 */

export const WORKSPACE_SEARCH_IDENTITY_SCHEMA = 'workspace.search.identity.v1' as const

export type WorkspaceSearchKindV1 = 'session' | 'pane' | 'command'
export type WorkspaceSearchAvailabilityV1 = 'available' | 'unknown' | 'unavailable' | 'busy'
export type WorkspaceSearchGroupIdV1 =
  | 'recent'
  | 'opened'
  | 'frequent'
  | 'session'
  | 'pane'
  | 'command'
  | 'compatibility'

export interface WorkspaceSearchOpenTargetV1 {
  readonly type: WorkspaceSearchKindV1
  readonly owner: string
  readonly viewKind?: string
  readonly resourceKey?: string
  readonly sessionRef?: string
  readonly messageRef?: string
  readonly commandId?: string
  readonly viewId?: string
}

export interface WorkspaceSearchMatchSpanV1 {
  readonly start: number
  readonly end: number
}

export interface WorkspaceSearchMatchV1 {
  readonly layer: 'exact' | 'prefix' | 'token' | 'fallback'
  readonly field: 'title' | 'id' | 'alias' | 'keyword' | 'description'
  readonly spans: readonly WorkspaceSearchMatchSpanV1[]
}

export interface WorkspaceSearchCandidateV1 {
  readonly kind: WorkspaceSearchKindV1
  readonly stableKey: string
  readonly title: string
  readonly description?: string
  readonly semanticIcon: WorkbenchIconName
  readonly ownerRef: string
  readonly projectRef?: string
  readonly openTarget: WorkspaceSearchOpenTargetV1
  readonly availability: WorkspaceSearchAvailabilityV1
  readonly reason?: string
  readonly aliases: readonly string[]
  readonly keywords: readonly string[]
  readonly commandId?: string
  readonly opened: boolean
  readonly recent: boolean
  readonly frequent: boolean
  readonly compatibility: boolean
  readonly sideEffect: boolean
  readonly openOnly: boolean
  readonly mergedCommandIds: readonly string[]
  readonly snippet?: string
  readonly messageRef?: string
  readonly status?: string
  readonly updatedAt?: string
}

export function workspaceSearchOwner(value: string | undefined, fallback = 'pane.workbench'): string {
  return value !== undefined && value.length > 0 ? value : fallback
}

export function workspaceSearchStableKey(
  kind: WorkspaceSearchKindV1,
  owner: string,
  identity: string,
  resourceKey?: string,
): string {
  const ownerRef = workspaceSearchOwner(owner)
  if (kind === 'session') return `session:${ownerRef}:${identity}`
  if (kind === 'command') return `command:${ownerRef}:${identity}`
  return `pane:${ownerRef}:${identity}:${resourceKey !== undefined && resourceKey.length > 0 ? resourceKey : '-'}`
}

export function semanticIconForViewKind(kind: string, explicit?: string): WorkbenchIconName {
  if (explicit !== undefined && isWorkbenchIconName(explicit)) return explicit
  const needle = kind.toLowerCase()
  if (needle.includes('git')) return 'git'
  if (needle.includes('agent')) return 'agents'
  if (needle.includes('terminal')) return 'terminal'
  if (needle.includes('file') || needle.includes('explorer')) return 'file'
  if (needle.includes('media') || needle.includes('image') || needle.includes('video') || needle.includes('audio')) return 'media'
  if (needle.includes('search')) return 'search'
  if (needle.includes('session') || needle.includes('conversation') || needle.includes('message')) return 'message'
  return 'window'
}

function unique(values: readonly (string | undefined)[], max = 40): readonly string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))].slice(0, max)
}

function paneResourceKey(kind: string, resourceKey?: string): string {
  return resourceKey !== undefined && resourceKey.length > 0 ? resourceKey : `view:${kind}`
}

function commandOpenHint(registration: PaneCommandRegistrationV1): {
  readonly openOnly: boolean
  readonly sideEffect: boolean
  readonly compatibility: boolean
  readonly viewKind?: string
  readonly resourceKey?: string
} {
  const task = registration.descriptor.presentation?.task
  const openOnly = task === 'open-only'
  const sideEffect = task === 'side-effect' || (registration.descriptor.permission !== undefined && !openOnly)
  const compatibility = registration.descriptor.presentation?.group === 'compatibility'
  const viewKind = typeof registration.descriptor.presentation?.icon === 'string' && registration.descriptor.presentation.icon.includes('.')
    ? registration.descriptor.presentation.icon
    : undefined
  return {
    openOnly,
    sideEffect,
    compatibility,
    ...(viewKind === undefined ? {} : { viewKind }),
  }
}

export function collectWorkspaceSearchCandidates(input: {
  readonly registrations: readonly PaneViewRegistrationV1[]
  readonly commands?: readonly PaneCommandRegistrationV1[]
  readonly state: PaneWorkspaceV1
  readonly profile: PaneManagementProfileV1
  readonly recentRefs?: readonly string[]
  readonly frequentKinds?: readonly string[]
  readonly projectRef?: string
  readonly conversationItems?: readonly PaneConversationSearchItemV1[]
  readonly workspaceItems?: readonly PaneWorkspaceSearchItemV1[]
  readonly conversationOwner?: string
  readonly workspaceOwner?: string
}): readonly WorkspaceSearchCandidateV1[] {
  const recentKinds = new Set(input.profile.recentPaneKinds)
  const frequentKinds = new Set(input.frequentKinds ?? input.profile.favoritePaneKinds)
  const recentRefs = new Set(input.recentRefs ?? [])
  const byKind = new Map(input.registrations.map(registration => [registration.descriptor.kind, registration]))
  const candidates: WorkspaceSearchCandidateV1[] = []

  for (const view of Object.values(input.state.views)) {
    const registration = byKind.get(view.kind)
    const owner = workspaceSearchOwner(registration?.descriptor.presentation?.owner)
    const resourceKey = paneResourceKey(view.kind, view.resourceKey)
    const stableKey = workspaceSearchStableKey('pane', owner, view.kind, resourceKey)
    const status = view.dirty ? 'dirty' : view.offline ? 'offline' : view.stale ? 'stale' : view.status
    candidates.push({
      kind: 'pane',
      stableKey,
      title: view.title,
      ...(registration?.descriptor.presentation?.description === undefined ? {} : { description: registration.descriptor.presentation.description }),
      semanticIcon: semanticIconForViewKind(view.kind, registration?.presentation?.icon),
      ownerRef: owner,
      ...(input.projectRef === undefined ? {} : { projectRef: input.projectRef }),
      openTarget: { type: 'pane', owner, viewKind: view.kind, resourceKey, viewId: view.id },
      availability: view.status === 'orphaned' ? 'unavailable' : 'available',
      ...(view.status === 'orphaned' ? { reason: 'provider_missing' } : {}),
      aliases: unique([view.kind, registration?.descriptor.label]),
      keywords: unique([...(registration?.descriptor.presentation?.keywords ?? []), view.resourceKey]),
      opened: true,
      recent: recentRefs.has(stableKey) || recentKinds.has(view.kind),
      frequent: frequentKinds.has(view.kind),
      compatibility: registration?.showInPicker === false,
      sideEffect: false,
      openOnly: false,
      mergedCommandIds: [],
      status,
    })
  }

  for (const registration of input.registrations) {
    const descriptor = registration.descriptor
    const owner = workspaceSearchOwner(descriptor.presentation?.owner)
    const resourceKey = paneResourceKey(descriptor.kind)
    const stableKey = workspaceSearchStableKey('pane', owner, descriptor.kind, resourceKey)
    if (candidates.some(candidate => candidate.stableKey === stableKey)) continue
    candidates.push({
      kind: 'pane',
      stableKey,
      title: descriptor.label,
      ...(descriptor.presentation?.description === undefined ? {} : { description: descriptor.presentation.description }),
      semanticIcon: semanticIconForViewKind(descriptor.kind, registration.presentation?.icon),
      ownerRef: owner,
      ...(input.projectRef === undefined ? {} : { projectRef: input.projectRef }),
      openTarget: { type: 'pane', owner, viewKind: descriptor.kind, resourceKey },
      availability: 'available',
      aliases: unique([descriptor.kind, descriptor.label, ...(descriptor.presentation?.keywords ?? [])]),
      keywords: unique(descriptor.presentation?.keywords ?? []),
      opened: Object.values(input.state.views).some(view => view.kind === descriptor.kind),
      recent: recentRefs.has(stableKey) || recentKinds.has(descriptor.kind),
      frequent: frequentKinds.has(descriptor.kind),
      compatibility: registration.showInPicker === false,
      sideEffect: false,
      openOnly: false,
      mergedCommandIds: [],
    })
  }

  for (const registration of input.commands ?? []) {
    const descriptor = registration.descriptor
    const owner = workspaceSearchOwner(descriptor.presentation?.owner)
    const hint = commandOpenHint(registration)
    const commandKey = workspaceSearchStableKey('command', owner, descriptor.id)
    const targetKind = hint.viewKind ?? (hint.openOnly ? descriptor.presentation?.group : undefined)
    const resourceKey = targetKind === undefined ? undefined : paneResourceKey(targetKind)
    candidates.push({
      kind: 'command',
      stableKey: commandKey,
      title: descriptor.label,
      ...(descriptor.presentation?.description === undefined ? {} : { description: descriptor.presentation.description }),
      semanticIcon: semanticIconForViewKind(descriptor.id, descriptor.presentation?.icon),
      ownerRef: owner,
      ...(input.projectRef === undefined ? {} : { projectRef: input.projectRef }),
      openTarget: hint.openOnly && targetKind !== undefined
        ? { type: 'pane', owner, viewKind: targetKind, ...(resourceKey === undefined ? {} : { resourceKey }), commandId: descriptor.id }
        : { type: 'command', owner, commandId: descriptor.id },
      availability: 'available',
      aliases: unique([descriptor.id, descriptor.slash?.name, ...(descriptor.slash?.aliases ?? []), ...(descriptor.presentation?.keywords ?? [])]),
      keywords: unique([descriptor.id, descriptor.slash?.name, ...(descriptor.slash?.aliases ?? []), ...(descriptor.presentation?.keywords ?? [])]),
      commandId: descriptor.id,
      opened: false,
      recent: recentRefs.has(commandKey),
      frequent: false,
      compatibility: hint.compatibility,
      sideEffect: hint.sideEffect,
      openOnly: hint.openOnly,
      mergedCommandIds: [],
    })
  }

  const conversationOwner = workspaceSearchOwner(input.conversationOwner, 'dsh.session')
  for (const item of input.conversationItems ?? []) {
    const stableKey = workspaceSearchStableKey('session', conversationOwner, item.sessionRef)
    candidates.push({
      kind: 'session',
      stableKey,
      title: item.title,
      description: item.snippet,
      semanticIcon: 'message',
      ownerRef: conversationOwner,
      ...(input.projectRef === undefined ? {} : { projectRef: input.projectRef }),
      openTarget: {
        type: 'session',
        owner: conversationOwner,
        sessionRef: item.sessionRef,
        messageRef: item.messageRef,
      },
      availability: 'available',
      aliases: unique([item.sessionRef, item.messageRef]),
      keywords: unique([item.snippet]),
      opened: Object.values(input.state.views).some(view => view.resourceKey === item.sessionRef || view.id === item.sessionRef),
      recent: recentRefs.has(stableKey),
      frequent: false,
      compatibility: false,
      sideEffect: false,
      openOnly: false,
      mergedCommandIds: [],
      snippet: item.snippet,
      messageRef: item.messageRef,
      ...(item.updatedAt === undefined ? {} : { updatedAt: item.updatedAt }),
    })
  }

  const workspaceOwner = workspaceSearchOwner(input.workspaceOwner, 'dsh.workspace')
  for (const item of input.workspaceItems ?? []) {
    const kind: WorkspaceSearchKindV1 = item.source === 'history' ? 'session' : 'pane'
    const identity = kind === 'session' ? item.ref : item.kind
    const resourceKey = kind === 'pane' ? item.ref : undefined
    const stableKey = workspaceSearchStableKey(kind, item.owner ?? workspaceOwner, identity, resourceKey)
    candidates.push({
      kind,
      stableKey,
      title: item.title,
      ...(item.description === undefined ? {} : { description: item.description }),
      semanticIcon: semanticIconForViewKind(item.kind),
      ownerRef: item.owner ?? workspaceOwner,
      projectRef: item.workspaceRef,
      openTarget: kind === 'session'
        ? { type: 'session', owner: item.owner ?? workspaceOwner, sessionRef: item.ref }
        : { type: 'pane', owner: item.owner ?? workspaceOwner, viewKind: item.kind, resourceKey: item.ref },
      availability: 'available',
      aliases: unique([item.kind, item.ref]),
      keywords: unique([item.kind, item.ref, item.groupId]),
      opened: item.source === 'tab',
      recent: recentRefs.has(stableKey),
      frequent: false,
      compatibility: false,
      sideEffect: false,
      openOnly: false,
      mergedCommandIds: [],
      ...(item.statusTokens?.[0] === undefined ? {} : { status: item.statusTokens[0] }),
    })
  }

  return mergeOpenOnlyCommands(candidates)
}

function sameOpenTarget(left: WorkspaceSearchOpenTargetV1, right: WorkspaceSearchOpenTargetV1): boolean {
  return left.type === right.type
    && left.owner === right.owner
    && (left.viewKind ?? '') === (right.viewKind ?? '')
    && (left.resourceKey ?? '') === (right.resourceKey ?? '')
    && (left.sessionRef ?? '') === (right.sessionRef ?? '')
}

export function mergeOpenOnlyCommands(candidates: readonly WorkspaceSearchCandidateV1[]): readonly WorkspaceSearchCandidateV1[] {
  const panes = candidates.filter(candidate => candidate.kind === 'pane')
  const commands = candidates.filter(candidate => candidate.kind === 'command')
  const others = candidates.filter(candidate => candidate.kind !== 'pane' && candidate.kind !== 'command')
  const merged = new Map<string, WorkspaceSearchCandidateV1>(panes.map(pane => [pane.stableKey, pane]))
  const retainedCommands: WorkspaceSearchCandidateV1[] = []

  for (const command of commands) {
    const pane = command.openOnly && !command.sideEffect
      ? panes.find(candidate => sameOpenTarget(candidate.openTarget, command.openTarget))
      : undefined
    if (pane === undefined) {
      retainedCommands.push(command)
      continue
    }
    const current = merged.get(pane.stableKey) ?? pane
    merged.set(pane.stableKey, {
      ...current,
      aliases: unique([...current.aliases, ...command.aliases, command.commandId, command.title]),
      keywords: unique([...current.keywords, ...command.keywords, command.commandId ?? '']),
      mergedCommandIds: unique([...current.mergedCommandIds, command.commandId ?? command.stableKey]),
    })
  }

  return [...merged.values(), ...retainedCommands, ...others]
}

export function openedViewIdentity(view: PaneViewInstanceV1, owner: string): string {
  return workspaceSearchStableKey('pane', owner, view.kind, paneResourceKey(view.kind, view.resourceKey))
}

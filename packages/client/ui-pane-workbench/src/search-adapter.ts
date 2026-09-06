import type { PaneConversationSearchHostV1, PaneWorkspaceContextProviderV1 } from './management.js'
import { boundedPaneDescription } from './management.js'
import {
  probeWorkspaceSearchHistoryAdapter,
  type WorkspaceSearchHistoryAdapterV1,
  type WorkspaceSearchHistoryPageV1,
} from './search-query.js'
import { workspaceSearchOwner, workspaceSearchStableKey, type WorkspaceSearchCandidateV1 } from './search-identity.js'

const FANOUT_LIMIT = 3

export function createWorkspaceSearchHistoryAdapter(input: {
  readonly conversationSearch?: PaneConversationSearchHostV1
  readonly workspaceContext?: PaneWorkspaceContextProviderV1
  readonly workspaceRef?: string
  readonly sessionRef?: string
}): WorkspaceSearchHistoryAdapterV1 {
  const workspaceSearch = input.workspaceContext?.search
  const conversationSearch = input.conversationSearch?.search
  const workspaceProbe = probeWorkspaceSearchHistoryAdapter({
    search: workspaceSearch,
    capability: workspaceSearch === undefined ? undefined : 'pane.workspace-search.v1',
  })
  const conversationProbe = probeWorkspaceSearchHistoryAdapter({
    search: conversationSearch,
    capability: input.conversationSearch?.capability,
  })
  if (workspaceProbe.capability !== 'available' && conversationProbe.capability !== 'available') {
    return {
      capability: conversationProbe.capability === 'contract_mismatch' || workspaceProbe.capability === 'contract_mismatch'
        ? 'contract_mismatch'
        : 'unavailable',
      reason: conversationProbe.reason ?? workspaceProbe.reason ?? 'history_owner_missing',
      search: async () => ({ items: [], status: 'contract_mismatch', reason: 'history_owner_missing' }),
    }
  }
  return {
    capability: 'available',
    search: async (request, signal) => {
      if (request.allAccessibleProjects) {
        if (workspaceSearch === undefined || input.workspaceContext?.listWorkspaces === undefined) {
          return { items: [], status: 'contract_mismatch', reason: 'global_search_unavailable' }
        }
        const refs = input.workspaceContext.listWorkspaces().map(target => target.workspaceRef).slice(0, FANOUT_LIMIT)
        if (refs.length === 0) return { items: [], status: 'ready' }
        const page = await workspaceSearch({
          workspaceRefs: refs,
          query: request.query,
          limit: request.limit,
          ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
        }, signal)
        return mapWorkspacePage(page, signal)
      }
      if (conversationSearch === undefined || input.conversationSearch === undefined) {
        return { items: [], status: 'contract_mismatch', reason: 'conversation_search_unavailable' }
      }
      const workspaceRef = request.projectRef ?? input.workspaceRef
      if (workspaceRef === undefined) return { items: [], status: 'contract_mismatch', reason: 'workspace_ref_required' }
      const page = await input.conversationSearch.search({
        workspaceRef,
        query: request.query,
        limit: request.limit,
        ...(input.sessionRef === undefined ? {} : { sessionRef: input.sessionRef }),
        ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
      }, signal)
      if (page.status !== 'ready' && page.status !== 'partial') {
        return { items: [], status: page.status, ...(page.reason === undefined ? {} : { reason: page.reason }) }
      }
      const owner = workspaceSearchOwner(undefined, 'dsh.session')
      const items: WorkspaceSearchCandidateV1[] = page.items.map(item => ({
        kind: 'session',
        stableKey: workspaceSearchStableKey('session', owner, item.sessionRef),
        title: item.title,
        description: boundedPaneDescription(item.snippet),
        semanticIcon: 'message',
        ownerRef: owner,
        projectRef: workspaceRef,
        openTarget: { type: 'session', owner, sessionRef: item.sessionRef, messageRef: item.messageRef },
        availability: 'available',
        aliases: [item.sessionRef],
        keywords: [item.snippet],
        opened: false,
        recent: false,
        frequent: false,
        compatibility: false,
        sideEffect: false,
        openOnly: false,
        mergedCommandIds: [],
        snippet: item.snippet,
        messageRef: item.messageRef,
        ...(item.updatedAt === undefined ? {} : { updatedAt: item.updatedAt }),
      }))
      return {
        items,
        status: page.status,
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
        ...(page.reason === undefined ? {} : { reason: page.reason }),
      }
    },
  }
}

function mapWorkspacePage(page: {
  readonly items: readonly {
    readonly workspaceRef: string
    readonly ref: string
    readonly source: 'tab' | 'history'
    readonly title: string
    readonly kind: string
    readonly owner?: string
    readonly description?: string
    readonly statusTokens?: readonly string[]
  }[]
  readonly nextCursor?: string
  readonly status: WorkspaceSearchHistoryPageV1['status']
  readonly reason?: string
}, signal: AbortSignal): WorkspaceSearchHistoryPageV1 {
  if (signal.aborted) return { items: [], status: 'offline', reason: 'aborted' }
  if (page.status !== 'ready' && page.status !== 'partial') {
    return { items: [], status: page.status, ...(page.reason === undefined ? {} : { reason: page.reason }) }
  }
  return {
    items: page.items.map(item => {
      const owner = workspaceSearchOwner(item.owner, 'dsh.workspace')
      const session = item.source === 'history'
      return {
        kind: session ? 'session' : 'pane',
        stableKey: workspaceSearchStableKey(session ? 'session' : 'pane', owner, session ? item.ref : item.kind, session ? undefined : item.ref),
        title: item.title,
        ...(item.description === undefined ? {} : { description: boundedPaneDescription(item.description) }),
        semanticIcon: session ? 'message' : 'window',
        ownerRef: owner,
        projectRef: item.workspaceRef,
        openTarget: session
          ? { type: 'session', owner, sessionRef: item.ref }
          : { type: 'pane', owner, viewKind: item.kind, resourceKey: item.ref },
        availability: 'available',
        aliases: [item.kind, item.ref],
        keywords: [item.kind],
        opened: item.source === 'tab',
        recent: false,
        frequent: false,
        compatibility: false,
        sideEffect: false,
        openOnly: false,
        mergedCommandIds: [],
        ...(item.statusTokens?.[0] === undefined ? {} : { status: item.statusTokens[0] }),
      } satisfies WorkspaceSearchCandidateV1
    }),
    status: page.status,
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    ...(page.reason === undefined ? {} : { reason: page.reason }),
  }
}

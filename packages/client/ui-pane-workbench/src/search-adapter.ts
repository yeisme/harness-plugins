import { CURRENT_PROFILE_WORKSPACE_REF, getSessionListSearchSeam, isSessionListConversationSearchHost } from './conversation-search-host.js'
import type { PaneConversationSearchHostV1, PaneWorkspaceContextProviderV1 } from './management.js'
import { boundedPaneDescription } from './management.js'
import {
  probeWorkspaceSearchHistoryAdapter,
  type WorkspaceSearchHistoryAdapterV1,
  type WorkspaceSearchHistoryPageV1,
} from './search-query.js'
import { workspaceSearchOwner, workspaceSearchStableKey, type WorkspaceSearchCandidateV1 } from './search-identity.js'
import { DEFAULT_SEARCH_CENTER_CONTROLS, hasSearchCenterConstraints } from './search-controls.js'
import { searchSessionMetadata } from './session-metadata-search.js'
import { bindWorkspaceSearchOrigin } from './search-target-origin.js'

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
  const sessionList = workspaceSearch === undefined && input.conversationSearch !== undefined
    ? getSessionListSearchSeam(input.conversationSearch)?.list : undefined
  return {
    capability: 'available',
    negotiatesControls: true,
    ...(typeof sessionList?.subscribe !== 'function' ? {} : {
      subscribe: (listener: () => void) => sessionList.subscribe!(listener),
    }),
    search: async (request, signal) => {
      const metadataOnly = isSessionListConversationSearchHost(input.conversationSearch)
      const effectiveWorkspaceRef = request.projectRef ?? input.workspaceRef
      const aggregate = workspaceSearch !== undefined && (request.allAccessibleProjects || effectiveWorkspaceRef !== undefined)
      if (hasSearchCenterConstraints(request.controls) && (!metadataOnly || aggregate)) {
        return { items: [], status: 'contract_mismatch', reason: 'source_controls_unsupported' }
      }
      if (aggregate && workspaceSearch !== undefined) {
        if (request.allAccessibleProjects && input.workspaceContext?.listWorkspaces === undefined) {
          return { items: [], status: 'contract_mismatch', reason: 'global_search_unavailable' }
        }
        // This is one aggregate owner request, not one concurrent request per ref.
        const allowed = new Set(input.workspaceContext?.listWorkspaces?.().map(target => target.workspaceRef) ?? [])
        const current = input.workspaceContext?.getSnapshot().workspaceRef
        if (current !== undefined) allowed.add(current)
        if (!request.allAccessibleProjects && (effectiveWorkspaceRef === undefined || !allowed.has(effectiveWorkspaceRef))) {
          return { items: [], status: 'permission_denied', reason: 'project_unavailable' }
        }
        const refs = request.allAccessibleProjects ? [...new Set(input.workspaceContext!.listWorkspaces!().map(target => target.workspaceRef))] : [effectiveWorkspaceRef!]
        if (refs.length === 0) return { items: [], status: 'ready' }
        const page = await workspaceSearch.call(input.workspaceContext, {
          workspaceRefs: refs,
          query: request.query,
          limit: request.limit,
          ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
        }, signal)
        if ((page.status === 'ready' || page.status === 'partial') && page.items.some(item => !refs.includes(item.workspaceRef))) {
          return { items: [], status: 'contract_mismatch', reason: 'source_scope_mismatch' }
        }
        return mapWorkspacePage(page, signal, input.workspaceContext)
      }
      if (request.allAccessibleProjects && !isSessionListConversationSearchHost(input.conversationSearch)) {
        return { items: [], status: 'contract_mismatch', reason: 'global_search_unavailable' }
      }
      if (conversationSearch === undefined || input.conversationSearch === undefined) {
        return { items: [], status: 'contract_mismatch', reason: 'conversation_search_unavailable' }
      }
      const workspaceRef = request.allAccessibleProjects ? CURRENT_PROFILE_WORKSPACE_REF : request.projectRef ?? input.workspaceRef ?? CURRENT_PROFILE_WORKSPACE_REF
      const conversationRequest = {
        workspaceRef,
        query: request.query,
        limit: request.limit,
        ...(metadataOnly && request.controls?.sessionRef !== undefined ? { sessionRef: request.controls.sessionRef } : input.sessionRef === undefined || request.allAccessibleProjects ? {} : { sessionRef: input.sessionRef }),
        ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
      }
      const page = metadataOnly
        ? await searchSessionMetadata(input.conversationSearch, conversationRequest, request.controls ?? DEFAULT_SEARCH_CENTER_CONTROLS, request.locale, signal)
        : await input.conversationSearch.search(conversationRequest, signal)
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
        ...(workspaceRef === CURRENT_PROFILE_WORKSPACE_REF ? {} : { projectRef: workspaceRef }),
        openTarget: { type: 'session', owner, sessionRef: item.sessionRef, ...(isSessionListConversationSearchHost(input.conversationSearch) ? {} : { messageRef: item.messageRef }) },
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
        ...(isSessionListConversationSearchHost(input.conversationSearch) ? {} : { messageRef: item.messageRef }),
        ...(item.updatedAt === undefined ? {} : { updatedAt: item.updatedAt }),
        ...(metadataOnly && request.controls?.status !== undefined ? { status: request.controls.status } : {}),
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
}, signal: AbortSignal, workspaceOwner?: PaneWorkspaceContextProviderV1): WorkspaceSearchHistoryPageV1 {
  if (signal.aborted) return { items: [], status: 'offline', reason: 'aborted' }
  if (page.status !== 'ready' && page.status !== 'partial') {
    return { items: [], status: page.status, ...(page.reason === undefined ? {} : { reason: page.reason }) }
  }
  return {
    items: page.items.map(item => {
      const owner = workspaceSearchOwner(item.owner, 'dsh.workspace')
      const session = item.source === 'history'
      const candidate = {
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
        availability: typeof workspaceOwner?.open === 'function' ? 'available' : 'unavailable',
        ...(typeof workspaceOwner?.open === 'function' ? {} : { reason: 'workspace_open_unavailable' }),
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
      if (workspaceOwner !== undefined) bindWorkspaceSearchOrigin(candidate, workspaceOwner, item)
      return candidate
    }),
    status: page.status,
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    ...(page.reason === undefined ? {} : { reason: page.reason }),
  }
}

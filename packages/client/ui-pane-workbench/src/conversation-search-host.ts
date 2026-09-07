import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import {
  boundedPaneDescription,
  PANE_CONVERSATION_SEARCH_CONTEXT_KEY,
  type PaneConversationSearchHostV1,
  type PaneConversationSearchItemV1,
  type PaneConversationSearchPageV1,
  type PaneConversationSearchRequestV1,
} from './management.js'

export const PANE_CONVERSATION_SEARCH_CAPABILITY = 'pane.conversation-search.v1' as const
export const SESSION_LIST_SEARCH_UNAVAILABLE_REASON = 'sessions_list_unavailable' as const
export const CURRENT_PROFILE_WORKSPACE_REF = 'workspace:current-profile' as const

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const CURSOR_PREFIX = 's:'
const HTML_TAG = /<[^>]*>/g
const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/
const EXECUTABLE_URL = /^(?:https?|file|javascript|data):/i
const TOKENISH = /(?:bearer\s+[a-z0-9._~+/=-]+|(?:sk|pk|api)[_-][a-z0-9]{16,}|eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9._-]+)/i

export interface SessionListRowV1 {
  readonly displayTitle?: string
  readonly running?: boolean
  readonly updatedAt?: number | string
}

export interface SessionListSnapshotV1 {
  readonly ids?: readonly string[]
  readonly byId?: Readonly<Record<string, SessionListRowV1 | undefined>>
  readonly current?: string
}

export interface SessionListSearchSeamV1 {
  readonly list?: {
    getSnapshot(): SessionListSnapshotV1
    subscribe?(listener: () => void): () => void
  }
  open?(sessionId: string): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readNamed<T>(ctx: Pick<ClientContext, 'get'>, name: string): T | undefined {
  try {
    return ctx.get(name as never) as T | undefined
  } catch {
    return undefined
  }
}

function clampLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)))
}

function encodeCursor(offset: number): string {
  return `${CURSOR_PREFIX}${offset}`
}

function decodeCursor(cursor: string | undefined): number | undefined {
  if (cursor === undefined || cursor.length === 0) return 0
  if (!cursor.startsWith(CURSOR_PREFIX)) return undefined
  const offset = Number.parseInt(cursor.slice(CURSOR_PREFIX.length), 10)
  return Number.isInteger(offset) && offset >= 0 ? offset : undefined
}

function normalizeNeedle(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase()
}

function stripUnsafeText(value: string): string {
  return value.replace(HTML_TAG, '').replace(/\s+/g, ' ').trim()
}

function safeDisplayText(value: string, fallback: string): string {
  const cleaned = stripUnsafeText(value)
  if (cleaned.length === 0) return fallback
  if (ABSOLUTE_PATH.test(cleaned) || EXECUTABLE_URL.test(cleaned) || TOKENISH.test(cleaned)) return fallback
  return boundedPaneDescription(cleaned) ?? fallback
}

function isoTimestamp(value: number | string | undefined): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const iso = new Date(value).toISOString()
    return iso
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value
  return undefined
}

function readSessionIds(snapshot: SessionListSnapshotV1): readonly string[] {
  if (Array.isArray(snapshot.ids)) return snapshot.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
  return Object.keys(snapshot.byId ?? {})
}

function matchSession(id: string, title: string, query: string): boolean {
  const needle = normalizeNeedle(query)
  if (needle.length === 0) return true
  return normalizeNeedle(id).includes(needle) || normalizeNeedle(title).includes(needle)
}

export function probeSessionListSearchSeam(sessions: unknown): {
  readonly available: boolean
  readonly reason?: string
} {
  if (!isRecord(sessions) || !isRecord(sessions.list) || typeof sessions.list.getSnapshot !== 'function') {
    return { available: false, reason: SESSION_LIST_SEARCH_UNAVAILABLE_REASON }
  }
  return { available: true }
}

export function createSessionListConversationSearchHost(sessions: unknown): PaneConversationSearchHostV1 | undefined {
  const probe = probeSessionListSearchSeam(sessions)
  if (!probe.available) return undefined
  const seam = sessions as SessionListSearchSeamV1
  return {
    capability: PANE_CONVERSATION_SEARCH_CAPABILITY,
    search: async (request: PaneConversationSearchRequestV1, signal?: AbortSignal): Promise<PaneConversationSearchPageV1> => {
      if (signal?.aborted) return { items: [], status: 'offline', reason: 'aborted' }
      const offset = decodeCursor(request.cursor)
      if (offset === undefined) return { items: [], status: 'contract_mismatch', reason: 'invalid_cursor' }
      let snapshot: SessionListSnapshotV1
      try {
        snapshot = seam.list!.getSnapshot()
      } catch {
        return { items: [], status: 'offline', reason: 'sessions_list_failed' }
      }
      if (signal?.aborted) return { items: [], status: 'offline', reason: 'aborted' }
      const limit = clampLimit(request.limit)
      const matched: PaneConversationSearchItemV1[] = []
      for (const id of readSessionIds(snapshot)) {
        const row = snapshot.byId?.[id]
        const title = safeDisplayText(typeof row?.displayTitle === 'string' ? row.displayTitle : id, id)
        if (!matchSession(id, title, request.query)) continue
        const updatedAt = isoTimestamp(row?.updatedAt)
        matched.push({
          sessionRef: id,
          messageRef: id,
          title,
          snippet: title,
          ...(updatedAt === undefined ? {} : { updatedAt }),
        })
      }
      const page = matched.slice(offset, offset + limit)
      const nextOffset = offset + page.length
      if (signal?.aborted) return { items: [], status: 'offline', reason: 'aborted' }
      return {
        items: page,
        status: 'ready',
        ...(nextOffset < matched.length ? { nextCursor: encodeCursor(nextOffset) } : {}),
      }
    },
    open: (item: PaneConversationSearchItemV1): void => {
      if (typeof seam.open !== 'function') return
      seam.open(item.sessionRef)
    },
  }
}

/** Owner-provided host wins; otherwise wrap the official current-profile `sessions.list` snapshot. */
export function resolvePaneConversationSearchHost(ctx: Pick<ClientContext, 'get'>): PaneConversationSearchHostV1 | undefined {
  const provided = readNamed<PaneConversationSearchHostV1>(ctx, PANE_CONVERSATION_SEARCH_CONTEXT_KEY)
  if (provided !== undefined) return provided
  return createSessionListConversationSearchHost(readNamed(ctx, 'sessions'))
}

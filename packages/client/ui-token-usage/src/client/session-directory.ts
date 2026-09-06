/**
 * Official accessible-session directory seam for the statistics-target
 * switcher (design §1: the selector uses the official session directory with
 * pagination; the legacy ledger `bySession` top-20 is never a substitute).
 *
 * The seam is the `SessionManagerHostV1` service that the
 * `@yeisme/dsh-session-manager` host plugin provides on the Cordis context
 * under `dsh.sessionManagerHost` — the same service ui-desktop-workbench
 * consumes for its sidebar. This package probes it structurally (capability +
 * `listSessions`) instead of importing the host package, mirroring the
 * trajectory-locator probe: when the seam is absent the switcher stays
 * disabled with a readable reason, and the statistics target remains pinned
 * to the bound session.
 *
 * Only a safe projection crosses into the DOM: opaque sessionRef plus a
 * bounded display label. Rows with unsafe refs, credential-shaped text, raw
 * URLs, or absolute paths are dropped, never rendered.
 *
 * @module @yeisme/dsh-client-ui-token-usage/client/session-directory
 */

import type { Context } from '@deepseek-ai/cordis'
import { isSafeInsightsRef } from '../wire.ts'

/** Cordis context key of the official session-manager host service. */
export const SESSION_DIRECTORY_CONTEXT_KEY = 'dsh.sessionManagerHost' as const

/** Client-side page size for the directory listing (bounded pager). */
export const SESSION_DIRECTORY_PAGE_SIZE = 20 as const

const MAX_ENTRIES = 1000
const MAX_LABEL = 160
const FORBIDDEN_TEXT = /(api[_-]?key|bearer\s|authorization|sk-[a-z0-9]|https?:\/\/|\/home\/|\/var\/)/iu

export interface SessionDirectoryEntryV1 {
  /** Opaque session ref (safe-ref validated). */
  readonly sessionRef: string
  /** Bounded display label; falls back to the ref when no safe title exists. */
  readonly label: string
  readonly running: boolean
  readonly archived: boolean
  readonly updatedAt?: string
}

export interface SessionDirectorySource {
  listSessions(): Promise<readonly SessionDirectoryEntryV1[]>
}

export type SessionDirectoryProbe =
  | { readonly available: true; readonly source: SessionDirectorySource }
  | { readonly available: false; readonly reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalLookup(ctx: Context, key: string): Record<string, unknown> | undefined {
  const getter = (ctx as unknown as { get?: (name: never) => unknown }).get
  if (typeof getter === 'function') {
    try {
      const value = getter.call(ctx, key as never)
      return isRecord(value) ? value : undefined
    } catch {
      return undefined
    }
  }
  try {
    const prop = (ctx as unknown as Record<string, unknown>)[key]
    return isRecord(prop) ? prop : undefined
  } catch {
    return undefined
  }
}

function safeLabel(value: unknown): string | undefined {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_LABEL
    && !FORBIDDEN_TEXT.test(value)
    ? value
    : undefined
}

/**
 * Strict parse of `listSessions()` rows into the safe projection. Unsafe
 * rows are skipped; the result is bounded at {@link MAX_ENTRIES}.
 */
export function parseSessionDirectoryEntries(value: unknown): readonly SessionDirectoryEntryV1[] {
  if (!Array.isArray(value)) return []
  const entries: SessionDirectoryEntryV1[] = []
  for (const row of value) {
    if (entries.length >= MAX_ENTRIES) break
    if (!isRecord(row) || !isSafeInsightsRef(row.sessionId)) continue
    const label = safeLabel(row.title) ?? row.sessionId
    const updatedAt = safeLabel(row.updatedAt)
    entries.push({
      sessionRef: row.sessionId,
      label,
      running: row.running === true,
      archived: row.archived === true,
      ...(updatedAt === undefined ? {} : { updatedAt }),
    })
  }
  return entries
}

/**
 * Structural probe of the official session directory. Absent seam or shape
 * drift degrades to `available: false` with the caller-supplied readable
 * reason — the switcher is disabled, never pointed at the legacy ledger.
 */
export function probeSessionDirectory(ctx: Context, unavailableReason: string): SessionDirectoryProbe {
  const host = optionalLookup(ctx, SESSION_DIRECTORY_CONTEXT_KEY)
  if (host === undefined) return { available: false, reason: unavailableReason }
  const listSessions = host['listSessions']
  if (host['capability'] !== 'session-manager' || typeof listSessions !== 'function') {
    return { available: false, reason: unavailableReason }
  }
  return {
    available: true,
    source: {
      listSessions: async () => parseSessionDirectoryEntries(
        await (listSessions as () => Promise<unknown>).call(host),
      ),
    },
  }
}

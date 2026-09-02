/**
 * @yeisme/dsh-session-cookie-manager client entry.
 *
 * ModuleLoader requires a function or `{ apply }`. Missing Pane Workbench
 * stays fail-closed: the plugin loads, does not throw, and does not fake a
 * slot or cookie jar.
 *
 * @module @yeisme/dsh-session-cookie-manager/client
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  officialSessionsToSnapshot,
  registerLoginProfilesPaneViews,
  type ProfilesPaneSurface,
} from '@yeisme/dsh-client-ui-session-cookie-manager'

export * from '@yeisme/dsh-client-ui-session-cookie-manager'

export const clientName = 'dsh-session-cookie-manager/client'
export const clientInject: readonly string[] = []

function resolvePaneSurface(ctx: Context): ProfilesPaneSurface | undefined {
  try {
    const candidate = (ctx as { get?(name: string): unknown }).get?.('paneWorkbench')
    if (candidate !== null && typeof candidate === 'object' && typeof (candidate as ProfilesPaneSurface).registerView === 'function') {
      return candidate as ProfilesPaneSurface
    }
  } catch {
    // Official DSH and incomplete hosts stay fail-closed.
  }
  return undefined
}

function resolveOfficialSessions(ctx: Context): unknown {
  try {
    return (ctx as { get?(name: string): unknown }).get?.('sessions')
  } catch {
    return undefined
  }
}

function sessionSnapshotFrom(ctx: Context): ReturnType<typeof officialSessionsToSnapshot> {
  try {
    return officialSessionsToSnapshot(resolveOfficialSessions(ctx))
  } catch {
    return undefined
  }
}

/** Client lifecycle for ModuleLoader. Missing Pane Workbench is a no-op, not a throw. */
export function apply(ctx: Context): () => void {
  const pane = resolvePaneSurface(ctx)
  if (pane === undefined) return () => {}
  try {
    const sessionSnapshot = sessionSnapshotFrom(ctx)
    return registerLoginProfilesPaneViews(pane, {
      ...(sessionSnapshot === undefined ? {} : { sessionSnapshot }),
      sessions: resolveOfficialSessions(ctx),
    })
  } catch {
    return () => {}
  }
}

/** @deprecated Use `apply`. Kept so older tests that imported applyClient still typecheck. */
export function applyClient(ctx: Context): () => void {
  return apply(ctx)
}

const DshSessionCookieManagerClientPlugin = { apply }
export default DshSessionCookieManagerClientPlugin

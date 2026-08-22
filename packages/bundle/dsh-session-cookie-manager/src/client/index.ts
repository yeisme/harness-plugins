/**
 * @yeisme/dsh-session-cookie-manager client entry.
 *
 * Phase 1 is mount-free: no DSH public slot exists yet for account panels,
 * so the shell wires `registerLoginProfilesPaneViews` on the Pane Workbench
 * surface; nothing is registered implicitly and nothing is faked.
 *
 * @module @yeisme/dsh-session-cookie-manager/client
 */

import type { Context } from '@deepseek-ai/cordis'

export * from '@yeisme/dsh-client-ui-session-cookie-manager'

export const clientName = 'dsh-session-cookie-manager/client'
export const clientInject: readonly string[] = []

/** Client lifecycle: intentionally empty in Phase 1 (see module docs). */
export function applyClient(_ctx: Context): void {
  // client side intentionally mount-free until the shell wiring point
}

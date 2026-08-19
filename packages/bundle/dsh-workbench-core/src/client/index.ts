/**
 * DSH Workbench Core browser entry.
 *
 * The current slice exports the React shell and a no-op client apply. Feature
 * modules consume the shell/registry directly; a future slice may register a
 * Workbench shell into an official sidebar/Pane slot.
 *
 * @module @yeisme/dsh-workbench-core/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

export { WorkbenchShell } from './shell.tsx'
export type { WorkbenchShellProps } from './shell.tsx'

export const name = 'dsh-workbench-core'
export const inject = ['slots'] as const

/** Mount the client face and return an exact disposer. */
export async function apply(_ctx: ClientContext): Promise<() => void> {
  return () => {}
}

/**
 * @yeisme/dsh-3d-director browser entry.
 *
 * Re-exports the 3D Director client package's browser face (probe, controller,
 * view-model, viewport/timeline/surface components). This bundle adds no
 * logic of its own; embedding into the drama workbench panes is owned by
 * `@yeisme/dsh-client-ui-ai-drama-director`, so the client face here stays a
 * thin re-export. It exists only as an installable unit.
 *
 * @module @yeisme/dsh-3d-director/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

// @ts-ignore - client bundle is built separately with ModuleLoader
export * from '@yeisme/dsh-client-ui-3d-director'

export const name = 'dsh-3d-director'
export const inject = [] as const

/**
 * Mount the client face and return an exact disposer. The 3D Director surface
 * is embedded by `@yeisme/dsh-client-ui-ai-drama-director` (Inspector section +
 * docked viewport), so this face registers nothing itself; it exists because
 * the web loader applies every `dsh.client` entry as a cordis plugin and
 * requires an `apply` method (same no-op precedent as dsh-workbench-core).
 */
export async function apply(_ctx: ClientContext): Promise<() => void> {
  return () => {}
}

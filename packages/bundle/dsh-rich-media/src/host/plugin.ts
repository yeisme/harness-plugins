/**
 * DSH Rich Media Host face.
 *
 * This skeleton deliberately registers no production Host seam yet. The next
 * slice should mount a typed media resolver/transport that returns safe
 * `MediaRefV1` values and short-lived browser URLs. Until then, the plugin is
 * an installable bundle with a clean no-op lifecycle.
 *
 * @module @yeisme/dsh-rich-media/host
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-rich-media'
export const inject = [] as const

/** Mount the Host face and return an exact disposer. */
export async function apply(_ctx: Context): Promise<() => void> {
  const disposers: Array<() => void> = []
  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}

const RichMediaHostPlugin = { name, inject, apply }
export default RichMediaHostPlugin

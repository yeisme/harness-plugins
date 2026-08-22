/**
 * DSH Rich Media Host face.
 *
 * The Host plugin owns only lifecycle. Domain owners may expose the typed
 * `MediaHostV1` contract through the `dsh.mediaHost` context key; storage and
 * transport remain outside this bundle.
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

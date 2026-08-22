/**
 * @yeisme/dsh-client-ui-next-step-suggestions node/host-side entry.
 *
 * Browser logic lives in `./client`; the node side is intentionally a no-op
 * so pure host profiles can compose this package without client effects.
 *
 * @module @yeisme/dsh-client-ui-next-step-suggestions
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'client-ui-next-step-suggestions'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face
}

const ClientUiNextStepSuggestionsPlugin = { name, inject, apply }

export default ClientUiNextStepSuggestionsPlugin

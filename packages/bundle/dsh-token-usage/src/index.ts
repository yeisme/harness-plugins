/**
 * @yeisme/dsh-token-usage root entry (Host face).
 *
 * Composes `@yeisme/dsh-token-usage-host`: the process-scoped token ledger
 * over official `sessionProjections` deltas and the DeepSeek official-route
 * balance Remote. Session logs, credentials, and provider payloads stay
 * with DSH Host; browser UI lives in `./client`.
 *
 * @module @yeisme/dsh-token-usage
 */

import { apply as hostApply, inject as hostInject } from '@yeisme/dsh-token-usage-host'

export const name = 'dsh-token-usage'
export const inject = hostInject
export const apply = hostApply

const DshTokenUsagePlugin = { name, inject, apply }
export default DshTokenUsagePlugin

/**
 * DSH token usage client entry (ModuleLoader face).
 *
 * Workspace packages are inlined by tsdown so this file stays
 * self-contained: no external @yeisme require at runtime.
 *
 * @module @yeisme/dsh-token-usage/client
 */

import { apply } from '@yeisme/dsh-client-ui-token-usage/client'

export {
  apply,
  inject,
  name,
  tokenUsageRemoteContribution,
  deriveTokenUsageViewModel,
  formatTokens,
  TokenUsagePanel,
  en,
  NS,
  zh,
} from '@yeisme/dsh-client-ui-token-usage/client'

const DshTokenUsageClientPlugin = { apply }
export default DshTokenUsageClientPlugin

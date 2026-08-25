/**
 * @yeisme/dsh-ai-drama-director browser entry.
 *
 * Re-exports the client plugin package's browser face. This bundle adds
 * no logic of its own; it exists only as an installable unit.
 *
 * @module @yeisme/dsh-ai-drama-director/client
 */

// @ts-ignore - client bundle is built separately with ModuleLoader
export { apply, inject, name } from '@yeisme/dsh-client-ui-ai-drama-director/client'

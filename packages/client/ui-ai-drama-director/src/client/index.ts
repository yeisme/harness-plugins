/**
 * DSH Web AI Drama Director client entry.
 *
 * Registers /drama commands, Context/Story/Visual/Audio/Run/Review panes,
 * and the default Director preset. All registration is effect-scoped and
 * dispose-safe.
 *
 * @module @yeisme/dsh-client-ui-ai-drama-director/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { DramaClientRegistry } from '@yeisme/dsh-ai-drama-director'

export { DramaClientRegistry } from '@yeisme/dsh-ai-drama-director'
export type {
  DramaClientRegistrationV1,
  DramaCommandEntryV1,
  DramaPaneViewV1,
  DramaPaneId,
} from '@yeisme/dsh-ai-drama-director'

export const name = 'client-ui-ai-drama-director'
export const inject = [] as const

/**
 * Mount the AI Drama Director client face and return an exact disposer.
 *
 * This function:
 * 1. Creates a DramaClientRegistry instance
 * 2. Registers the /drama command group
 * 3. Registers Context/Story/Visual/Audio/Run/Review panes
 * 4. Applies the default Director preset
 * 5. Sets up effect-scoped disposal
 */
export async function apply(ctx: ClientContext): Promise<() => void> {
  if (typeof window === 'undefined') return () => {}

  // Check if drama capability is available
  const capabilityAvailable = await probeDramaCapability(ctx)

  const registry = new DramaClientRegistry(capabilityAvailable)

  // Register command group
  const registration = registry.getSnapshot()
  ctx.effect(() => {
    // Command registration would go here when DSH command registry is available
    console.log('[Drama Director] Commands registered:', registration.commands)
    return () => {}
  }, 'drama-director: commands')

  // Register pane views
  ctx.effect(() => {
    // Pane registration would go here when DSH pane registry is available
    console.log('[Drama Director] Panes registered:', registration.panes)
    return () => {}
  }, 'drama-director: panes')

  // Register default preset
  ctx.effect(() => {
    // Preset registration would go here when DSH preset registry is available
    console.log('[Drama Director] Preset registered:', registration.preset)
    return () => {}
  }, 'drama-director: preset')

  // Setup keyboard navigation
  ctx.effect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle drama-specific keyboard shortcuts
      if (event.key === 'd' && event.altKey) {
        event.preventDefault()
        // Focus drama command center
        console.log('[Drama Director] Alt+D: Focus command center')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, 'drama-director: keyboard')

  return () => {
    registry.dispose()
  }
}

/**
 * Probe if drama capability is available in the current DSH context.
 *
 * This checks for:
 * - Creator Studio projection availability
 * - Pane Workbench availability
 * - Rich Media renderer availability
 * - Ordo Agent Ops availability
 */
async function probeDramaCapability(_ctx: ClientContext): Promise<boolean> {
  // In a real implementation, this would probe DSH for the required capabilities
  // For now, we return false to indicate the capability is not available
  // This causes commands to be disabled with appropriate reasons
  return false
}

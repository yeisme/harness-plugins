/**
 * Workbench host slot registrar.
 *
 * This is the preparation seam for registering the composed workbench as an
 * official DSH host once a Workbench/Pane host slot is available. Until then
 * it remains an in-memory registrar with no DSH slot dependency.
 *
 * @module @yeisme/dsh-workbench-compose
 */

export interface WorkbenchHostSlotHandle {
  dispose(): void
}

export interface WorkbenchHostSlotRegistrar {
  readonly registered: boolean
  /** Claim the host slot. Throws if already claimed. */
  register(): WorkbenchHostSlotHandle
}

export interface WorkbenchHostSlotGate {
  isAvailable(): boolean
}

export function createWorkbenchHostSlotRegistrar(): WorkbenchHostSlotRegistrar {
  let claimed = false
  return {
    get registered() {
      return claimed
    },
    register() {
      if (claimed) throw new TypeError('Workbench host slot already registered')
      claimed = true
      return {
        dispose() {
          claimed = false
        },
      }
    },
  }
}

/**
 * Register the composed workbench only when an official host slot is
 * available. Returns null while the gate is closed.
 */
export function registerWhenHostSlotAvailable(
  gate: WorkbenchHostSlotGate,
  registrar: WorkbenchHostSlotRegistrar,
): WorkbenchHostSlotHandle | null {
  if (!gate.isAvailable()) return null
  return registrar.register()
}

/**
 * Convenience wrapper for registering the composed workbench host once the
 * official slot is available.
 */
export function registerComposedWorkbenchHost(
  gate: WorkbenchHostSlotGate,
): WorkbenchHostSlotHandle | null {
  return registerWhenHostSlotAvailable(gate, createWorkbenchHostSlotRegistrar())
}

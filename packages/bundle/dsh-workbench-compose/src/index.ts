/**
 * @yeisme/dsh-workbench-compose root entry.
 *
 * The package composes Workbench Core modules into a single shell. The root
 * entry exposes the composed registry; browser UI lives in `./client`.
 *
 * @module @yeisme/dsh-workbench-compose
 */

import type { Context } from '@deepseek-ai/cordis'

export { createComposedWorkbenchRegistry } from './composed-registry.ts'
export { createStaticHostProjection, emptyHostProjection } from './host-projection.ts'
export type { StaticHostProjectionInput, WorkbenchHostProjection } from './host-projection.ts'
export { createDshHostProjection } from './dsh-host-projection.ts'
export type { DshHostProjectionSeams } from './dsh-host-projection.ts'
export { createWorkbenchHostSlotRegistrar, registerComposedWorkbenchHost, registerWhenHostSlotAvailable } from './host-slot.ts'
export type { WorkbenchHostSlotGate, WorkbenchHostSlotHandle, WorkbenchHostSlotRegistrar } from './host-slot.ts'

export const name = 'dsh-workbench-compose'
export const inject: readonly string[] = []

/** No-op Host lifecycle. Browser UI lives in `./client`. */
export function apply(_ctx: Context): void {}

const DshWorkbenchComposePlugin = { name, inject, apply }
export default DshWorkbenchComposePlugin

/**
 * @yeisme/dsh-workbench-core root entry.
 *
 * The package provides the headless Workbench module/tab registry and the
 * React Workbench shell. Feature modules such as Rich Media register tabs and
 * commands into the Core; canonical state stays with DSH/domain owners.
 *
 * @module @yeisme/dsh-workbench-core
 */

export { WorkbenchRegistry } from './registry.ts'
export type { WorkbenchRegistrySnapshot } from './registry.ts'
export {
  isWorkbenchModule,
  validateWorkbenchModule,
  WORKBENCH_TAB_SCOPES,
} from './types.ts'
export type {
  WorkbenchCommandV1,
  WorkbenchModuleDefinitionV1,
  WorkbenchModuleValidation,
  WorkbenchTabV1,
  WorkbenchTabScope,
} from './types.ts'

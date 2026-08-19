/**
 * Workbench Core registry.
 *
 * The registry is a pure, headless module/tab store. It owns no React state,
 * no domain state, and no persistence. Feature bundles register modules; the
 * shell reads sorted tabs and commands.
 *
 * @module @yeisme/dsh-workbench-core
 */

import { isWorkbenchModule, validateWorkbenchModule } from './types.ts'
import type { WorkbenchCommandV1, WorkbenchModuleDefinitionV1, WorkbenchTabV1 } from './types.ts'

export interface WorkbenchRegistrySnapshot {
  readonly modules: readonly WorkbenchModuleDefinitionV1[]
  readonly tabs: readonly WorkbenchTabV1[]
  readonly commands: readonly WorkbenchCommandV1[]
}

export class WorkbenchRegistry {
  private readonly modules = new Map<string, WorkbenchModuleDefinitionV1>()

  /** Register one module and return an exact disposer. */
  register(module: WorkbenchModuleDefinitionV1): () => void {
    const validation = validateWorkbenchModule(module)
    if (!validation.ok) throw new TypeError(`Workbench module rejected: ${validation.error}`)
    const value = validation.value
    if (this.modules.has(value.id)) throw new TypeError(`Workbench module already registered: ${value.id}`)
    this.modules.set(value.id, value)
    return () => {
      if (this.modules.get(value.id) === value) this.modules.delete(value.id)
    }
  }

  /** Register an unknown value, throwing on invalid input. */
  registerUnknown(value: unknown): () => void {
    if (!isWorkbenchModule(value)) {
      const validation = validateWorkbenchModule(value)
      throw new TypeError(validation.ok ? 'Unexpected invalid module' : `Workbench module rejected: ${validation.error}`)
    }
    return this.register(value)
  }

  get(id: string): WorkbenchModuleDefinitionV1 | undefined {
    return this.modules.get(id)
  }

  snapshot(): WorkbenchRegistrySnapshot {
    const modules = [...this.modules.values()].sort((left, right) => left.id.localeCompare(right.id))
    const tabs = modules
      .flatMap(module => module.tabs)
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    const commands = modules
      .flatMap(module => module.commands)
      .sort((left, right) => left.id.localeCompare(right.id))
    return { modules, tabs, commands }
  }
}

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

export interface WorkbenchRegistryOptions {
  /** Capabilities available to the host before any module registration. */
  readonly capabilities?: readonly string[]
}

export interface WorkbenchRegistrySnapshot {
  readonly modules: readonly WorkbenchModuleDefinitionV1[]
  readonly tabs: readonly WorkbenchTabV1[]
  readonly commands: readonly WorkbenchCommandV1[]
}

export class WorkbenchRegistry {
  private readonly modules = new Map<string, WorkbenchModuleDefinitionV1>()
  private readonly capabilities = new Set<string>()

  constructor(options?: WorkbenchRegistryOptions) {
    for (const capability of options?.capabilities ?? []) this.declareCapability(capability)
  }

  private declareCapability(capability: string): void {
    if (typeof capability !== 'string' || capability.length === 0 || capability.length > 80) {
      throw new TypeError(`Workbench capability invalid: ${String(capability)}`)
    }
    this.capabilities.add(capability)
  }

  /**
   * Declare host/domain capabilities that modules may require.
   *
   * Returns an exact disposer; disposing a capability does not remove modules
   * that were already accepted (registration-time fail closed).
   */
  declareCapabilities(capabilities: readonly string[]): () => void {
    const added: string[] = []
    for (const capability of capabilities) {
      if (typeof capability !== 'string' || capability.length === 0 || capability.length > 80) {
        throw new TypeError(`Workbench capability invalid: ${String(capability)}`)
      }
      if (!this.capabilities.has(capability)) {
        this.capabilities.add(capability)
        added.push(capability)
      }
    }
    return () => {
      for (const capability of added) this.capabilities.delete(capability)
    }
  }

  hasCapability(capability: string): boolean {
    return this.capabilities.has(capability)
  }

  private checkRequiredCapabilities(module: WorkbenchModuleDefinitionV1): void {
    const missing = module.requiredCapabilities.filter(capability => !this.capabilities.has(capability))
    if (missing.length > 0) {
      throw new TypeError(`Workbench module ${module.id} requires missing capabilities: ${missing.join(', ')}`)
    }
  }

  /** Register one module and return an exact disposer. */
  register(module: WorkbenchModuleDefinitionV1): () => void {
    const validation = validateWorkbenchModule(module)
    if (!validation.ok) throw new TypeError(`Workbench module rejected: ${validation.error}`)
    const value = validation.value
    if (this.modules.has(value.id)) throw new TypeError(`Workbench module already registered: ${value.id}`)

    const existingTabs = new Set(this.snapshot().tabs.map(tab => tab.id))
    const existingCommands = new Set(this.snapshot().commands.map(command => command.id))
    const moduleTabs = new Set<string>()
    for (const tab of value.tabs) {
      if (moduleTabs.has(tab.id)) throw new TypeError(`Workbench module ${value.id} declares duplicate tab id: ${tab.id}`)
      if (existingTabs.has(tab.id)) throw new TypeError(`Workbench tab id already registered: ${tab.id}`)
      moduleTabs.add(tab.id)
    }
    const moduleCommands = new Set<string>()
    for (const command of value.commands) {
      if (moduleCommands.has(command.id)) throw new TypeError(`Workbench module ${value.id} declares duplicate command id: ${command.id}`)
      if (existingCommands.has(command.id)) throw new TypeError(`Workbench command id already registered: ${command.id}`)
      moduleCommands.add(command.id)
    }

    this.checkRequiredCapabilities(value)

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

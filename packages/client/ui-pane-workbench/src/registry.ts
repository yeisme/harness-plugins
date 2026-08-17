import {
  PanePluginDefinitionSchema,
  type PaneEventEnvelopeV1,
  type PanePluginDefinitionV1,
  type PaneProjectionStateV1,
} from '@yeisme/dsh-pane-protocol'
import { applyPaneEvent, createPaneProjectionState } from './event-runtime.js'

export type PaneViewFactory = () => unknown

export interface PaneRuntimePluginV1 {
  readonly definition: PanePluginDefinitionV1
  readonly viewFactories: Readonly<Record<string, PaneViewFactory>>
}

export interface PaneRegistryEnvironment {
  readonly generation: number
  readonly dshApiVersion: string
  readonly capabilities: ReadonlySet<string>
  readonly permissions: ReadonlySet<string>
  readonly isDshApiCompatible?: (range: string, version: string) => boolean
  /** Optional diagnostics sink; listener failures never escape registry mutations. */
  readonly onListenerError?: (error: unknown) => void
}

export interface PaneRegistrySnapshotEntry {
  readonly definition: PanePluginDefinitionV1
  readonly projection: PaneProjectionStateV1
}

export type PaneRegistryListener = (snapshot: readonly PaneRegistrySnapshotEntry[]) => void

export type PaneRegistrationErrorCode = 'contract_mismatch' | 'permission_denied' | 'duplicate_plugin'

export class PaneRegistrationError extends Error {
  constructor(readonly code: PaneRegistrationErrorCode, message: string) {
    super(message)
    this.name = 'PaneRegistrationError'
  }
}

interface Registration {
  readonly generation: number
  readonly plugin: PaneRuntimePluginV1
  projection: PaneProjectionStateV1
}

function defaultCompatibility(range: string, version: string): boolean {
  return range === '*' || range === version
}

function validateEnvironment(environment: PaneRegistryEnvironment, currentGeneration?: number): void {
  if (!Number.isSafeInteger(environment.generation) || environment.generation < 0) {
    throw new PaneRegistrationError('contract_mismatch', 'pane runtime generation must be a non-negative safe integer')
  }
  if (currentGeneration !== undefined && environment.generation <= currentGeneration) {
    throw new PaneRegistrationError('contract_mismatch', 'generation reset requires a newer generation')
  }
}

export class PanePluginRegistry {
  private environment: PaneRegistryEnvironment
  private readonly registrations = new Map<string, Registration>()
  private readonly listeners = new Set<PaneRegistryListener>()

  constructor(environment: PaneRegistryEnvironment) {
    validateEnvironment(environment)
    this.environment = environment
  }

  get generation(): number {
    return this.environment.generation
  }

  snapshot(): readonly PaneRegistrySnapshotEntry[] {
    return [...this.registrations.values()]
      .map(registration => ({ definition: registration.plugin.definition, projection: registration.projection }))
      .sort((left, right) => left.definition.id.localeCompare(right.definition.id))
  }

  subscribe(listener: PaneRegistryListener): () => void {
    this.listeners.add(listener)
    this.notify(listener, this.snapshot())
    return () => this.listeners.delete(listener)
  }

  register(input: PaneRuntimePluginV1): () => void {
    const definition = PanePluginDefinitionSchema.parse(input.definition)
    if (this.registrations.has(definition.id)) {
      throw new PaneRegistrationError('duplicate_plugin', `pane plugin ${definition.id} is already registered`)
    }

    const compatible = this.environment.isDshApiCompatible ?? defaultCompatibility
    if (!compatible(definition.compatibility.dshApiRange, this.environment.dshApiVersion)) {
      throw new PaneRegistrationError('contract_mismatch', `pane plugin ${definition.id} requires DSH ${definition.compatibility.dshApiRange}`)
    }

    const missingCapabilities = definition.capabilities.required.filter(capability => !this.environment.capabilities.has(capability))
    if (missingCapabilities.length > 0) {
      throw new PaneRegistrationError('contract_mismatch', `pane plugin ${definition.id} is missing capabilities: ${missingCapabilities.join(', ')}`)
    }

    const missingPermissions = definition.permissions.filter(permission => !this.environment.permissions.has(permission))
    if (missingPermissions.length > 0) {
      throw new PaneRegistrationError('permission_denied', `pane plugin ${definition.id} is missing permissions: ${missingPermissions.join(', ')}`)
    }

    for (const view of definition.views) {
      if (typeof input.viewFactories[view.componentKey] !== 'function') {
        throw new PaneRegistrationError('contract_mismatch', `pane plugin ${definition.id} has no local factory for ${view.componentKey}`)
      }
    }

    const registration: Registration = {
      generation: this.environment.generation,
      plugin: { definition, viewFactories: input.viewFactories },
      projection: createPaneProjectionState(this.environment.generation),
    }
    this.registrations.set(definition.id, registration)
    this.emit()

    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      if (this.registrations.get(definition.id) === registration) {
        this.registrations.delete(definition.id)
        this.emit()
      }
    }
  }

  applyEvent(pluginId: string, generation: number, event: PaneEventEnvelopeV1 | unknown): PaneProjectionStateV1 | undefined {
    const registration = this.registrations.get(pluginId)
    if (registration === undefined) return undefined
    if (generation !== this.environment.generation || registration.generation !== generation) return registration.projection
    const next = applyPaneEvent(registration.projection, event)
    if (next !== registration.projection) {
      registration.projection = next
      this.emit()
    }
    return registration.projection
  }

  resetGeneration(environment: PaneRegistryEnvironment): void {
    validateEnvironment(environment, this.environment.generation)
    this.registrations.clear()
    this.environment = environment
    this.emit()
  }

  private emit(): void {
    const snapshot = this.snapshot()
    for (const listener of this.listeners) this.notify(listener, snapshot)
  }

  private notify(listener: PaneRegistryListener, snapshot: readonly PaneRegistrySnapshotEntry[]): void {
    try {
      listener(snapshot)
    } catch (error) {
      try { this.environment.onListenerError?.(error) } catch { /* diagnostics are best-effort */ }
    }
  }
}

/**
 * Tool-hub sidecar: prefs CAS plus catalog projection. No second scheduler.
 *
 * @module @yeisme/dsh-tool-hub-host/service
 */

import { TOOL_HUB_PREFS_KEY, TOOL_HUB_SPEC_VERSION } from './constants.ts'
import { isToolHubItemId, type ToolHubItemId } from './ids.ts'
import { findCatalogItem, projectCatalog, type CatalogSource } from './catalog.ts'
import type { ToolHubPrefsRowV1 } from './domain.ts'
import type {
  ToolHubCatalogAnswerV1,
  ToolHubSetEnabledAnswerV1,
  ToolHubSetEnabledInputV1,
} from './wire.ts'

export interface ToolHubTablePort {
  get(key: string): ToolHubPrefsRowV1 | undefined
  put(key: string, row: ToolHubPrefsRowV1): Promise<void>
}

export interface ToolHubCatalogPort {
  collect(): Promise<Omit<CatalogSource, 'disabledIds'>>
}

export interface ToolHubSidecarDeps {
  readonly table?: ToolHubTablePort
  readonly catalog: ToolHubCatalogPort
  readonly newVersion?: () => string
}

export class ToolHubSidecar {
  private readonly table: ToolHubTablePort | undefined
  private readonly catalog: ToolHubCatalogPort
  private readonly newVersion: () => string
  private generation = 1
  private memoryDisabled = new Set<string>()

  constructor(deps: ToolHubSidecarDeps) {
    this.table = deps.table
    this.catalog = deps.catalog
    this.newVersion = deps.newVersion ?? (() => `rv${Date.now().toString(36)}`)
  }

  currentGeneration(): number {
    return this.generation
  }

  disabledIds(): ReadonlySet<string> {
    const row = this.table?.get(TOOL_HUB_PREFS_KEY)
    if (row !== undefined) return new Set(row.disabled)
    return this.memoryDisabled
  }

  isDisabled(id: string): boolean {
    return this.disabledIds().has(id)
  }

  async list(): Promise<ToolHubCatalogAnswerV1> {
    try {
      const source = await this.catalog.collect()
      const projected = projectCatalog({ ...source, disabledIds: this.disabledIds() })
      return {
        ok: true,
        specVersion: TOOL_HUB_SPEC_VERSION,
        complete: projected.complete,
        generation: this.generation,
        skillsAvailable: projected.skillsAvailable,
        toolsAvailable: projected.toolsAvailable,
        mcpInventoryAvailable: projected.mcpInventoryAvailable,
        observedAt: Date.now(),
        healthAvailable: projected.healthAvailable,
        items: projected.items,
      }
    } catch (error) {
      return { ok: false, code: 'catalog-unavailable', message: error instanceof Error ? error.message : 'catalog unavailable' }
    }
  }

  async setEnabled(input: ToolHubSetEnabledInputV1): Promise<ToolHubSetEnabledAnswerV1> {
    if (input.ifGeneration !== this.generation) {
      return { ok: false, code: 'generation-conflict', message: 'catalog generation moved', generation: this.generation }
    }
    if (!isToolHubItemId(input.id)) {
      return { ok: false, code: 'item-unknown', message: 'unknown tool-hub item' }
    }
    const catalog = await this.list()
    if (!catalog.ok) return catalog
    const item = findCatalogItem(catalog.items, input.id)
    if (item === undefined) return { ok: false, code: 'item-unknown', message: 'unknown tool-hub item' }
    if (!item.canToggle) return { ok: false, code: 'toggle-unsupported', message: item.disabledReason ?? 'toggle unsupported' }
    try {
      await this.persist(input.id, input.enabled)
      this.generation += 1
      return { ok: true, id: input.id, enabled: input.enabled, generation: this.generation }
    } catch (error) {
      return { ok: false, code: 'storage-unavailable', message: error instanceof Error ? error.message : 'storage unavailable' }
    }
  }

  private async persist(id: ToolHubItemId, enabled: boolean): Promise<void> {
    const current = new Set(this.disabledIds())
    if (enabled) current.delete(id)
    else current.add(id)
    const row: ToolHubPrefsRowV1 = {
      disabled: [...current].sort(),
      version: this.newVersion(),
      updatedAt: Date.now(),
    }
    if (this.table !== undefined) {
      await this.table.put(TOOL_HUB_PREFS_KEY, row)
    } else {
      this.memoryDisabled = current
    }
  }
}

export function createToolHubSidecar(deps: ToolHubSidecarDeps): ToolHubSidecar {
  return new ToolHubSidecar(deps)
}

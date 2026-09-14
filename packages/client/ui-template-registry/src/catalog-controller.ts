/**
 * Catalog pane controller (task 3.1): the state machine behind the 模板目录
 * pane. All states are honest folds of the host seam's outcomes — loading /
 * ready (mcp | degraded catalog) / error — plus pane-side filters, selection,
 * and the inspect-driven detail panel with fail-closed preview rights.
 *
 * No second copy of state: every template row and inspection is a safe
 * projection answered by the host service; this controller only sequences
 * calls and derives facets/filters. Nothing retries on its own — retry is
 * always the explicit user action (probe/refresh buttons).
 *
 * @module @yeisme/dsh-client-ui-template-registry/catalog-controller
 */

import type {
  Template,
  TemplateInspection,
  TemplatePreview,
  TemplateRegistryHealth,
} from '@yeisme/dsh-template-registry'
import type { TemplateRegistryHostFace } from './seam.js'

export interface TemplateCatalogFilters {
  readonly query: string
  readonly tag: string | null
  readonly capability: string | null
}

export type TemplateCatalogPhase = 'loading' | 'ready' | 'error'

/** Stable reason codes for the error fold (never raw error text). */
export type TemplateCatalogErrorReason = 'offline' | 'registry_error' | 'contract_mismatch'

export interface TemplateCatalogDetailState {
  readonly ref: string
  readonly phase: 'loading' | 'ready' | 'error'
  readonly reason?: TemplateCatalogErrorReason | 'degraded' | 'not_found'
  readonly inspection?: TemplateInspection
  readonly preview?: TemplatePreview
}

export interface TemplateCatalogState {
  readonly phase: TemplateCatalogPhase
  readonly templates: readonly Template[]
  /** Where the current list came from: the MCP seam or the degraded catalog. */
  readonly origin: 'mcp' | 'catalog' | 'none'
  readonly health?: TemplateRegistryHealth
  readonly errorReason?: TemplateCatalogErrorReason
  readonly errorCode?: string
  readonly filters: TemplateCatalogFilters
  readonly selection?: string
  readonly detail?: TemplateCatalogDetailState
  /** Generation counter for in-flight-read cancellation. */
  readonly generation: number
}

export type TemplateCatalogListener = (state: TemplateCatalogState) => void

export const EMPTY_TEMPLATE_CATALOG_FILTERS: TemplateCatalogFilters = { query: '', tag: null, capability: null }

export function createTemplateCatalogState(): TemplateCatalogState {
  return { phase: 'loading', templates: [], origin: 'none', filters: EMPTY_TEMPLATE_CATALOG_FILTERS, generation: 0 }
}

/** Facets derived from the loaded projection (nav column content). */
export function templateCatalogFacets(templates: readonly Template[]): { tags: string[]; capabilities: string[] } {
  const tags = new Set<string>()
  const capabilities = new Set<string>()
  for (const template of templates) {
    for (const tag of template.tags) tags.add(tag)
    for (const capability of template.capabilities) capabilities.add(capability)
  }
  return { tags: [...tags].sort(), capabilities: [...capabilities].sort() }
}

/** Pane-side filter fold (instant empty states; the host browse repeats them server-side). */
export function filterTemplates(templates: readonly Template[], filters: TemplateCatalogFilters): Template[] {
  const query = filters.query.trim().toLowerCase()
  return templates.filter(template => {
    if (filters.tag !== null && !template.tags.includes(filters.tag)) return false
    if (filters.capability !== null && !template.capabilities.includes(filters.capability)) return false
    if (query !== '' && !`${template.title} ${template.summary} ${template.tags.join(' ')}`.toLowerCase().includes(query)) return false
    return true
  })
}

/** Roving-selection helper for the results listbox (Arrow/Home/End keys). */
export function moveCatalogSelection(key: string, index: number, size: number): number {
  if (size <= 0) return -1
  const clamp = (value: number): number => Math.min(size - 1, Math.max(0, value))
  switch (key) {
    case 'ArrowUp': return clamp(index - 1)
    case 'ArrowDown': return clamp(index + 1)
    case 'Home': return 0
    case 'End': return size - 1
    default: return index
  }
}

export function isTemplateCatalogFilterActive(filters: TemplateCatalogFilters): boolean {
  return filters.query.trim() !== '' || filters.tag !== null || filters.capability !== null
}

export interface TemplateCatalogController {
  snapshot(): TemplateCatalogState
  subscribe(listener: TemplateCatalogListener): () => void
  /** Last known host health (no I/O — the service contract guarantees a sync read). */
  health(): TemplateRegistryHealth
  refresh(): Promise<void>
  /** Explicit recovery path: re-run the host capability probe, then refresh. */
  retry(): Promise<void>
  setFilters(filters: Partial<TemplateCatalogFilters>): void
  clearFilters(): void
  select(ref: string): Promise<void>
  loadPreview(ref: string): Promise<void>
  dispose(): void
}

export function createTemplateCatalogController(host: TemplateRegistryHostFace): TemplateCatalogController {
  let state: TemplateCatalogState = createTemplateCatalogState()
  const listeners = new Set<TemplateCatalogListener>()
  let disposed = false

  const emit = (): void => {
    for (const listener of [...listeners]) listener(state)
  }

  const update = (patch: Partial<TemplateCatalogState>): void => {
    const next = { ...state, ...patch }
    if (Object.is(next, state)) return
    state = next
    emit()
  }

  const browseFailureReason = (failure: { kind?: unknown }): { reason: TemplateCatalogErrorReason; code?: string | undefined } => {
    if (failure.kind === 'offline') return { reason: 'offline' }
    if (failure.kind === 'registry_error') return { reason: 'registry_error', code: (failure as { code?: string | undefined }).code }
    return { reason: 'contract_mismatch' }
  }

  const runBrowse = async (): Promise<void> => {
    const generation = state.generation + 1
    update({ phase: 'loading', generation })
    const { filters } = state
    const outcome = await host.browse({
      ...(filters.query.trim() === '' ? {} : { query: filters.query.trim() }),
      ...(filters.tag === null ? {} : { tag: filters.tag }),
      ...(filters.capability === null ? {} : { capability: filters.capability }),
    })
    if (disposed || state.generation !== generation) return
    if (outcome.ok) {
      update({ phase: 'ready', templates: [...outcome.templates], origin: outcome.origin })
      return
    }
    const folded = browseFailureReason(outcome.failure)
    update({
      phase: 'error',
      templates: [],
      origin: 'none',
      health: outcome.health,
      errorReason: folded.reason,
      ...(folded.code === undefined ? {} : { errorCode: folded.code }),
    })
  }

  const select = async (ref: string): Promise<void> => {
    update({ selection: ref, detail: { ref, phase: 'loading' } })
    const outcome = await host.inspect(ref)
    if (disposed || state.detail?.ref !== ref) return
    if (outcome.ok) {
      update({ detail: { ref, phase: 'ready', inspection: outcome.inspection } })
      return
    }
    const reason = outcome.failure.kind === 'not_found'
      ? 'not_found'
      : outcome.failure.kind === 'degraded'
        ? 'degraded'
        : outcome.failure.kind === 'registry_error'
          ? 'registry_error'
          : 'contract_mismatch'
    update({ detail: { ref, phase: 'error', reason } })
  }

  const controller: TemplateCatalogController = {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    health: () => host.health(),
    refresh: runBrowse,
    async retry() {
      await host.probe()
      await runBrowse()
    },
    setFilters(filters) {
      update({ filters: { ...state.filters, ...filters } })
      void runBrowse()
    },
    clearFilters() {
      update({ filters: EMPTY_TEMPLATE_CATALOG_FILTERS })
      void runBrowse()
    },
    select,
    async loadPreview(ref) {
      const preview = await host.preview(ref)
      if (disposed || state.detail?.ref !== ref) return
      update({ detail: { ...(state.detail ?? { ref, phase: 'loading' }), preview } })
    },
    dispose() {
      if (disposed) return
      disposed = true
      listeners.clear()
    },
  }
  return controller
}

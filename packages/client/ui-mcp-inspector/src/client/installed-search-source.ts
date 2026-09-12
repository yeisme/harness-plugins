import type { ToolHubCatalogAnswerV1, ToolHubCatalogV1, ToolHubItemV1 } from './wire.ts'
import { ToolHubClientError } from './remote.ts'

/** Structural optional Pane API ingress; no runtime dependency on Pane Workbench. */
interface SearchRequest {
  readonly query: string
  readonly scope: { readonly kind: string; readonly ref?: string }
  readonly kinds: readonly string[]
  readonly filters: Readonly<Record<string, string>>
  readonly sort: string
  readonly cursor?: string
  readonly limit?: number
}
interface SearchResource {
  readonly owner: string
  readonly ref: string
  readonly revision?: string
  readonly kind: string
  readonly title: string
  readonly description?: string
  readonly sessionRef?: string
}

const OWNER = 'dsh.tools'
const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase()
const unsafe = /(?:https?:\/\/|file:\/\/|(?:^|\s)\/(?:home|Users|workspaces|tmp)\/|(?:authorization|password|secret|token)\s*[:=])/i
const publicItem = (item: ToolHubItemV1) => ({ id: item.id, source: item.source, name: item.name, label: item.label, description: item.description,
  family: item.family, availability: item.availability })
const catalogKey = (catalog: ToolHubCatalogV1) => JSON.stringify([catalog.generation, catalog.complete, catalog.skillsAvailable, catalog.toolsAvailable, catalog.items.map(publicItem)])
const noResults = (status: 'disabled' | 'offline' | 'error' | 'denied') => ({ status, resources: [] })

/** Reads the existing owner catalog. It has no enable/install/execute surface. */
export function createInstalledToolsSearchSource(input: {
  readonly read: () => Promise<ToolHubCatalogAnswerV1>
  readonly open: (item: ToolHubItemV1) => Promise<boolean>
  readonly sessionRef?: string
}) {
  const kinds = input.sessionRef === undefined ? ['skill', 'native-tool'] as const : ['skill', 'native-tool', 'mcp-tool'] as const
  const kindOf = (item: ToolHubItemV1) => item.family === 'skill' ? 'skill' as const : item.family === 'native' ? 'native-tool' as const : input.sessionRef !== undefined && item.family === 'mcp' ? 'mcp-tool' as const : undefined
  const acceptsScope = (scope: SearchRequest['scope']) => input.sessionRef === undefined ? scope.kind === 'profile' : scope.kind === 'session' && scope.ref === input.sessionRef
  const revisionFor = async (catalog: ToolHubCatalogV1) => {
    if (input.sessionRef === undefined) return `catalog:${catalog.generation}`
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(catalogKey(catalog)))
    return `catalog-sha256:${[...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('')}`
  }
  const listeners = new Set<() => void>()
  const cursors = new Map<string, { key: string; offset: number }>()
  let epoch = 0
  let lastCatalogKey: string | undefined
  let disposed = false
  let pending: Promise<{ answer: ToolHubCatalogAnswerV1; epoch: number }> | undefined
  const notify = () => { epoch += 1; cursors.clear(); lastCatalogKey = undefined; for (const listener of listeners) listener() }
  const read = async (signal?: AbortSignal) => {
    const expectedEpoch = epoch
    while (!disposed && !signal?.aborted && expectedEpoch === epoch) {
      if (!pending) {
        const readingEpoch = epoch
        const reading = Promise.resolve().then(() => input.read()).then(answer => ({ answer, epoch: readingEpoch }))
        pending = reading
        void reading.finally(() => { if (pending === reading) pending = undefined }).catch(() => {})
      }
      const result = await pending.catch(error => { lastCatalogKey = undefined; cursors.clear(); throw error })
      if (disposed || signal?.aborted || expectedEpoch !== epoch) return undefined
      if (result.epoch !== expectedEpoch) continue
      if (!result.answer.ok) { lastCatalogKey = undefined; cursors.clear(); return undefined }
      lastCatalogKey = catalogKey(result.answer)
      return result.answer
    }
    return undefined
  }
  const source = {
    descriptor: { id: input.sessionRef === undefined ? 'dsh.tools.installed' : 'dsh.tools.session', owner: OWNER, resourceKinds: kinds, coverage: 'catalog' as const,
      scopes: input.sessionRef === undefined ? ['profile'] as const : ['session'] as const, filters: ['status'], sorts: ['relevance', 'name'] as const, pagination: true, preview: false, open: true },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    async search(request: SearchRequest, signal: AbortSignal) {
      const searchingEpoch = epoch
      if (disposed || signal.aborted || !acceptsScope(request.scope) || Object.keys(request.filters).some(key => key !== 'status')
        || !['relevance', 'name'].includes(request.sort) || request.kinds.some(kind => !(kinds as readonly string[]).includes(kind))
        || (request.filters.status !== undefined && !['available', 'disabled', 'unavailable'].includes(request.filters.status))) return noResults('disabled')
      let catalog: ToolHubCatalogV1 | undefined
      try { catalog = await read(signal) } catch (error) { return noResults(error instanceof ToolHubClientError ? error.accessDenied ? 'denied' : error.code === 'contract_mismatch' ? 'disabled' : 'offline' : 'offline') }
      if (!catalog || signal.aborted) return noResults('offline')
      const availableKinds = request.kinds.filter(kind => kind === 'skill' ? catalog.skillsAvailable : catalog.toolsAvailable)
      if (availableKinds.length === 0) return noResults('disabled')
      // An incomplete owner catalog cannot promise corpus-wide status filtering or name order.
      if (!catalog.complete && (request.sort !== 'relevance' || request.filters.status !== undefined)) return noResults('disabled')
      const counts = new Map<string, number>()
      for (const item of catalog.items) counts.set(item.id, (counts.get(item.id) ?? 0) + 1)
      const safe = catalog.items.filter(item => !unsafe.test(item.source) && !unsafe.test(item.label)).map(item => ({ ...item, description: unsafe.test(item.description) ? '' : item.description }))
      const needle = normalize(request.query)
      const matched = safe.filter(item => {
        const kind = kindOf(item)
        return kind !== undefined && availableKinds.includes(kind)
          && (request.filters.status === undefined || item.availability === request.filters.status)
          && [item.id, item.name, item.label, item.description, item.source].some(value => normalize(value).includes(needle))
      })
      if (request.sort === 'name') matched.sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
      const limit = request.limit ?? 20
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) return noResults('disabled')
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([catalogKey(catalog), needle, request.kinds, request.filters, request.sort, limit])))
      const key = [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('')
      const previous = request.cursor === undefined ? undefined : cursors.get(request.cursor)
      if (request.cursor !== undefined && previous?.key !== key) return noResults('error')
      const offset = previous?.offset ?? 0
      const revision = await revisionFor(catalog)
      const resources = matched.slice(offset, offset + limit).map(item => ({ owner: OWNER, ref: JSON.stringify(input.sessionRef === undefined ? [item.id, item.source] : [input.sessionRef, item.id, item.source]),
        ...(input.sessionRef === undefined ? {} : { sessionRef: input.sessionRef }),
        revision, kind: kindOf(item)!, title: item.label, sourceLabel: item.source,
        description: unsafe.test(item.description) ? '' : item.description,
        status: item.availability, availability: counts.get(item.id) === 1 ? 'available' as const : 'unavailable' as const,
      }))
      let nextCursor: string | undefined
      if (offset + resources.length < matched.length) {
        nextCursor = `tools:${crypto.randomUUID()}`
        cursors.set(nextCursor, { key, offset: offset + resources.length })
        while (cursors.size > 32) cursors.delete(cursors.keys().next().value!)
      }
      if (signal.aborted || disposed || searchingEpoch !== epoch) return noResults('disabled')
      const complete = catalog.complete && availableKinds.length === request.kinds.length && safe.length === catalog.items.length && matched.every(item => counts.get(item.id) === 1)
      return { status: complete ? 'ready' as const : 'partial' as const, resources, ...(nextCursor === undefined ? {} : { nextCursor }), ...(complete ? { total: matched.length } : {}) }
    },
    async open(resource: SearchResource, scope: SearchRequest['scope']): Promise<{ status: 'opened' | 'unavailable' | 'denied' }> {
      if (disposed || !acceptsScope(scope) || resource.owner !== OWNER || (input.sessionRef !== undefined && resource.sessionRef !== input.sessionRef)) return { status: 'unavailable' }
      const openingEpoch = epoch
      let identity: unknown
      try { identity = JSON.parse(resource.ref) } catch { return { status: 'unavailable' } }
      if (!Array.isArray(identity) || identity.length !== (input.sessionRef === undefined ? 2 : 3) || identity.some(value => typeof value !== 'string')) return { status: 'unavailable' }
      if (input.sessionRef !== undefined) { if (identity[0] !== input.sessionRef) return { status: 'unavailable' }; identity = identity.slice(1) }
      let catalog: ToolHubCatalogV1 | undefined
      try { catalog = await read() } catch (error) {
        if (error instanceof ToolHubClientError && error.accessDenied) { notify(); return { status: 'denied' } }
        if (!disposed && openingEpoch === epoch) notify()
        return { status: 'unavailable' }
      }
      const revision = catalog === undefined ? undefined : await revisionFor(catalog)
      if (disposed || openingEpoch !== epoch) return { status: 'unavailable' }
      if (!catalog || resource.revision !== revision) { notify(); return { status: 'unavailable' } }
      const [id, source] = identity as string[]
      const matches = catalog.items.filter(item => item.id === id)
      const item = matches[0]
      if (matches.length !== 1 || !item || item.source !== source || item.label !== resource.title || kindOf(item) !== resource.kind) { notify(); return { status: 'unavailable' } }
      return { status: await input.open(item) ? 'opened' : 'unavailable' }
    },
  }
  return { source, notify,
    observe(catalog: ToolHubCatalogV1) { const next = catalogKey(catalog); if ((lastCatalogKey !== undefined || pending !== undefined) && next !== lastCatalogKey) notify(); lastCatalogKey = next },
    dispose() { disposed = true; notify(); listeners.clear() },
  }
}

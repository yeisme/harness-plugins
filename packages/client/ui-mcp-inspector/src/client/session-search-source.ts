import { createInstalledToolsSearchSource } from './installed-search-source.ts'
import type { ToolHubCatalogAnswerV1, ToolHubCatalogV1, ToolHubItemV1 } from './wire.ts'

type Binding = ReturnType<typeof createInstalledToolsSearchSource>
type Request = Parameters<Binding['source']['search']>[0]
type Resource = Parameters<Binding['source']['open']>[0]

/** One source namespace, isolated owner catalog state for each explicit Session. */
export function createSessionToolsSearchSource(input: {
  readonly listSessionIds: () => readonly string[]
  /** Must consume sessionCatalogRemote with requireResolvedScope:true in production. */
  readonly read: (sessionRef: string) => Promise<ToolHubCatalogAnswerV1>
  readonly open: (sessionRef: string, item: ToolHubItemV1) => Promise<boolean>
}) {
  const bindings = new Map<string, Binding>()
  const listeners = new Set<() => void>()
  let disposed = false
  const allowed = (ref: string) => !disposed && ref.length > 0 && ref.length <= 512 && input.listSessionIds().includes(ref)
  const emit = () => { for (const listener of listeners) listener() }
  const bindingFor = (ref: string) => {
    if (!allowed(ref)) return undefined
    let binding = bindings.get(ref)
    if (binding) bindings.delete(ref)
    else {
      binding = createInstalledToolsSearchSource({ sessionRef: ref, read: () => input.read(ref),
        open: item => allowed(ref) ? input.open(ref, item) : Promise.resolve(false) })
      binding.source.subscribe(emit)
    }
    bindings.set(ref, binding)
    while (bindings.size > 32) {
      const oldest = bindings.keys().next().value!
      const removed = bindings.get(oldest)!
      bindings.delete(oldest)
      removed.dispose()
    }
    return binding
  }
  return {
    source: {
      descriptor: { id: 'dsh.tools.session', owner: 'dsh.tools', resourceKinds: ['skill', 'mcp-tool', 'native-tool'] as const,
        coverage: 'catalog' as const, scopes: ['session'] as const, filters: ['status'], sorts: ['relevance', 'name'] as const,
        pagination: true, preview: false, open: true },
      subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
      async search(request: Request, signal: AbortSignal) {
        if (request.scope.kind !== 'session' || !request.scope.ref) return { status: 'disabled' as const, resources: [] }
        const ref = request.scope.ref, binding = bindingFor(ref)
        if (!binding) return { status: 'denied' as const, resources: [] }
        const page = await binding.source.search(request, signal)
        return allowed(ref) ? page : { status: 'denied' as const, resources: [] }
      },
      async open(resource: Resource, scope: Request['scope']): Promise<{ status: 'opened' | 'denied' | 'unavailable' }> {
        if (scope.kind !== 'session' || !scope.ref || resource.sessionRef !== scope.ref) return { status: 'unavailable' }
        const ref = scope.ref, binding = bindingFor(ref)
        if (!binding) return { status: 'denied' }
        const receipt = await binding.source.open(resource, scope)
        return allowed(ref) ? receipt : { status: 'denied' }
      },
    },
    // Owner observations may invalidate issued results, but never become query data.
    observe(sessionRef: string, catalog: ToolHubCatalogV1) {
      if (allowed(sessionRef)) bindings.get(sessionRef)?.observe(catalog)
    },
    notify(sessionRef?: string) {
      if (disposed) return
      for (const [ref, binding] of bindings) {
        if (!allowed(ref)) { bindings.delete(ref); binding.dispose() }
        else if (sessionRef === undefined || ref === sessionRef) binding.notify()
      }
      emit()
    },
    dispose() { disposed = true; listeners.clear(); for (const binding of bindings.values()) binding.dispose(); bindings.clear() },
  }
}

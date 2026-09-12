import type { SearchCenterOwnerSource, SearchCenterResource } from '../../ui-pane-workbench/src/client.ts'

const kindMap: Record<string, SearchCenterResource['kind'] | undefined> = { image: 'image', video: 'video', audio: 'audio', subtitle: 'subtitle', 'text-artifact': 'text-artifact', 'delivery-package': 'delivery-package' }
const safe = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\\]/.test(value)

/** Read-only Creator Studio asset projection; body and media playback stay with the owner. */
export function createCreatorAssetsSearchSource(input: { readonly service: { snapshot(): Promise<unknown>; assets(query: unknown): Promise<unknown> }; open(request: unknown): void }) {
  let generation = 0
  const listeners = new Set<() => void>()
  const source: SearchCenterOwnerSource = { descriptor: { id: 'dsh.creator-assets', owner: 'dsh.creator-studio', resourceKinds: ['image', 'video', 'audio', 'subtitle', 'text-artifact', 'delivery-package'], coverage: 'metadata', scopes: ['workspace'], filters: [], sorts: ['relevance'], pagination: true, preview: false, open: true },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    async search(request, signal) {
      if (request.scope.kind !== 'workspace' || Object.keys(request.filters).length || request.sort !== 'relevance') return { status: 'disabled', resources: [] }
      const epoch = ++generation
      try {
        const snap = await input.service.snapshot() as { context?: { workspaceRef?: unknown; projectRef?: unknown } }
        const workspaceRef = snap.context?.workspaceRef
        if (!safe(workspaceRef) || workspaceRef !== request.scope.ref) return { status: 'denied', resources: [] }
        const answer = await input.service.assets({ scope: 'current_project', text: request.query, limit: request.limit ?? 20, ...(request.cursor === undefined ? {} : { cursor: request.cursor }) }) as { status?: string; items?: readonly Record<string, unknown>[]; nextCursor?: string; unavailableOwners?: readonly string[] }
        if (signal.aborted || epoch !== generation) return { status: 'offline', resources: [] }
        if (answer.status === 'permission_denied') return { status: 'denied', resources: [] }
        if (answer.status !== 'ready' && answer.status !== 'partial') return { status: 'disabled', resources: [] }
        const resources = (answer.items ?? []).flatMap(item => { const kind = typeof item.kind === 'string' ? kindMap[item.kind] : undefined; if (!kind || !safe(item.ref) || !safe(item.version) || !safe(item.title)) return []; return [{ owner: 'dsh.creator-studio', ref: item.ref as string, revision: item.version as string, kind, title: item.title as string, description: safe(item.summary) ? item.summary as string : undefined, projectRef: workspaceRef as string, sourceLabel: typeof item.owner === 'string' ? item.owner : 'Creator Studio', availability: 'available' as const }] })
        return { status: answer.status, resources, ...(answer.nextCursor ? { nextCursor: answer.nextCursor } : {}) }
      } catch { return { status: 'offline', resources: [] } }
    },
    async open(resource, scope) { if (scope.kind !== 'workspace' || resource.projectRef !== scope.ref) return { status: 'unavailable' }; input.open({ kind: 'creator.canvas', resourceKey: `creator-asset:${resource.ref}`, title: resource.title, metadata: { ref: resource.ref, revision: resource.revision, kind: resource.kind } }); return { status: 'opened' } },
  }
  return { source, notify() { generation++; for (const listener of listeners) listener() }, dispose() { generation++; listeners.clear() } }
}

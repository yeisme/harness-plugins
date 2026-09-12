import type { ProjectCanvasDocument, ProjectCanvasNode } from '@yeisme/dsh-pane-protocol'
import type { SearchCenterOwnerSource, SearchCenterResource } from '../../ui-pane-workbench/src/client.ts'

const label = (node: ProjectCanvasNode) => {
  const value = (node as Record<string, unknown>).title ?? (node as Record<string, unknown>).text ?? (node as Record<string, unknown>).kind ?? node.id
  return typeof value === 'string' ? value : node.id
}
const safe = (value: string) => value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\\]/.test(value)

/** Read-only metadata projection of the existing Creator Studio canvas owner. */
export function createProjectCanvasSearchSource(input: { service: { snapshot(): Promise<unknown>; canvasRead(request: unknown): Promise<unknown> }; open(request: unknown): void }) {
  let generation = 0
  const listeners = new Set<() => void>()
  const source: SearchCenterOwnerSource = {
    descriptor: { id: 'dsh.project-canvas', owner: 'dsh.creator-studio', resourceKinds: ['project', 'canvas-node'], coverage: 'metadata', scopes: ['workspace'], filters: [], sorts: ['relevance', 'name'], pagination: false, preview: false, open: true },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    async search(request, signal) {
      if (request.scope.kind !== 'workspace' || Object.keys(request.filters).length > 0 || request.cursor !== undefined) return { status: 'disabled', resources: [] }
      const epoch = ++generation
      try {
        const raw = await input.service.snapshot() as { context?: { workspaceRef?: unknown; projectRef?: unknown } }
        const workspaceRef = typeof raw.context?.workspaceRef === 'string' ? raw.context.workspaceRef : undefined
        const projectRef = typeof raw.context?.projectRef === 'string' ? raw.context.projectRef : undefined
        if (!workspaceRef || !projectRef || workspaceRef !== request.scope.ref) return { status: 'denied', resources: [] }
        const answer = await input.service.canvasRead({ scope: { workspaceRef, projectRef }, documentId: 'main' }) as { document?: ProjectCanvasDocument; revision?: number }
        if (signal.aborted || epoch !== generation || !answer.document) return { status: 'offline', resources: [] }
        const needle = request.query.trim().toLocaleLowerCase()
        const resources: SearchCenterResource[] = []
        for (const node of answer.document.nodes) {
          const title = label(node)
          if (!safe(node.id) || !safe(title) || (needle && !`${title} ${node.id}`.toLocaleLowerCase().includes(needle))) continue
          resources.push({ owner: 'dsh.creator-studio', ref: `${projectRef}:${node.id}`, revision: `canvas:${answer.revision ?? answer.document.revision}`, kind: 'canvas-node', title, projectRef: workspaceRef, sourceLabel: 'Project canvas', availability: 'available' })
        }
        return { status: 'ready', resources }
      } catch { return { status: 'offline', resources: [] } }
    },
    async open(resource, scope) {
      if (scope.kind !== 'workspace' || resource.kind !== 'canvas-node') return { status: 'unavailable' }
      const [projectRef, nodeId] = resource.ref.split(':node:')
      if (!projectRef || !nodeId) return { status: 'unavailable' }
      input.open({ kind: 'creator.canvas', resourceKey: `canvas:${projectRef}`, title: 'Project canvas', metadata: { projectRef, nodeId } })
      return { status: 'opened' }
    },
  }
  return { source, notify() { generation++; for (const listener of listeners) listener() }, dispose() { generation++; listeners.clear() } }
}

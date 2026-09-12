import type { FileHostV1, FileTreeNodeV2, FileInspectProofV1 } from '@yeisme/dsh-file-host'
import type { SearchCenterOwnerSource, SearchCenterResource } from '@yeisme/dsh-client-ui-pane-workbench/client'

const OWNER = 'dsh.local'
const safeRef = (value: string) => value.length > 0 && value.length <= 512 && !/^(?:\/|[A-Za-z]:[\\/]|https?:\/\/|file:\/\/)|[\u0000-\u001f\\]/.test(value)
const safeNode = (node: FileTreeNodeV2) => safeRef(node.ref) && safeRef(node.version) && node.name.length > 0 && node.name.length <= 512
  && !/[\u0000-\u001f\\/]/.test(node.name) && !node.sensitive && !node.hidden && !node.ignored
  && node.kind !== 'symlink' && node.freshness === 'fresh' && (node.kind === 'directory' || node.availability.inspect.state === 'available')
const identity = (resource: SearchCenterResource) => JSON.stringify([resource.ref, resource.revision, resource.projectRef, resource.kind, resource.title])

/** Consume the paginated owner projection, never the Explorer's flattened cache. */
export function createFileSearchSource(input: {
  host: Pick<FileHostV1, 'treeV2' | 'inspect'>
  context: () => string
  canOpen?: boolean
  openFolder?: (node: FileTreeNodeV2, signal?: AbortSignal) => Promise<boolean>
  open: (node: FileTreeNodeV2, proof: FileInspectProofV1) => Promise<boolean>
}) {
  type Fence = { workspace: string; generation: string; revision: string }
  const cursors = new Map<string, { query: string; cursor: string; fence: Fence; context: string }>()
  const issued = new Map<string, { node: FileTreeNodeV2; fence: Fence; context: string }>()
  const listeners = new Set<() => void>()
  let epoch = 0, disposed = false
  let lastContext = input.context()
  const notify = () => { epoch++; cursors.clear(); issued.clear(); for (const listener of listeners) listener() }
  const syncContext = () => { const context = input.context(); if (lastContext !== context) { lastContext = context; notify() }; return context }
  const current = (expected: number, context: string, signal?: AbortSignal) => !disposed && expected === epoch && context === input.context() && !signal?.aborted
  const failure = (error: unknown): 'denied' | 'disabled' | 'offline' | 'error' => {
    const value = error as { code?: unknown; status?: unknown; name?: unknown }
    if (value?.status === 403 || value?.status === 401 || ['EACCES', 'EPERM', 'permission_denied', 'forbidden'].includes(String(value?.code))) return 'denied'
    if (['secure-fd-unsupported', 'METHOD_NOT_FOUND', 'not-found'].includes(String(value?.code))) return 'disabled'
    if (['bad-request', 'internal', 'method-error'].includes(String(value?.code)) || value?.status === 409 || value?.name === 'SyntaxError') return 'error'
    return 'offline'
  }
  const source: SearchCenterOwnerSource = {
    cancellableOpen: true,
    descriptor: { id: 'dsh.files', owner: OWNER, resourceKinds: ['file', 'folder'], coverage: 'metadata', scopes: ['profile', 'workspace'],
      filters: [], sorts: ['relevance'], pagination: true, preview: false, open: true },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    async search(request, signal) {
      if (!input.host.treeV2 || !['profile', 'workspace'].includes(request.scope.kind) || request.sort !== 'relevance'
        || Object.keys(request.filters).length || request.kinds.some(kind => kind !== 'file' && kind !== 'folder')) return { status: 'disabled', resources: [] }
      const context = syncContext(), expected = epoch
      const limit = Math.min(100, Math.max(1, request.limit ?? 20))
      const query = JSON.stringify([request.query, request.scope, request.kinds, limit])
      const saved = request.cursor === undefined ? undefined : cursors.get(request.cursor)
      if (request.cursor !== undefined && (!saved || saved.query !== query || saved.context !== context)) return { status: 'error', resources: [] }
      try {
        const pageRequest = { limit, ...(saved ? { cursor: saved.cursor } : {}) }
        const page = request.query.trim() ? await input.host.treeV2.search({ query: request.query, ...pageRequest }) : await input.host.treeV2.roots(pageRequest)
        if (!current(expected, context, signal)) return { status: 'offline', resources: [] }
        if (!safeRef(page.workspaceRef) || !safeRef(page.generation) || !safeRef(page.revision) || page.nodes.length > limit
          || page.workspaceRef === 'workspace:legacy' || page.generation === 'legacy') return { status: 'disabled', resources: [] }
        if (request.scope.kind === 'workspace' && page.workspaceRef !== request.scope.ref) return { status: 'denied', resources: [] }
        const fence = { workspace: page.workspaceRef, generation: page.generation, revision: page.revision }
        if (saved && JSON.stringify(saved.fence) !== JSON.stringify(fence)) { notify(); return { status: 'error', resources: [] } }
        const resources: SearchCenterResource[] = []
        for (const node of page.nodes) {
          const kind = node.kind === 'directory' ? 'folder' : 'file'
          if (!safeNode(node) || !request.kinds.includes(kind)) continue
          // Owner generation/revision and file version all participate in identity.
          const revision = JSON.stringify([page.generation, page.revision, node.version])
          if (revision.length > 256) continue
          const resource: SearchCenterResource = { owner: OWNER, ref: node.ref, revision, kind, title: node.name, projectRef: page.workspaceRef,
            sourceLabel: 'File owner', availability: (kind === 'folder' ? input.openFolder !== undefined : node.availability.preview.state === 'available' && input.host.inspect && input.canOpen !== false) ? 'available' : 'unavailable' }
          resources.push(resource)
          issued.set(identity(resource), { node: { ...node }, fence, context })
        }
        while (issued.size > 256) issued.delete(issued.keys().next().value!)
        let nextCursor: string | undefined
        if (page.nextCursor && page.nextCursor !== saved?.cursor) {
          nextCursor = crypto.randomUUID()
          cursors.set(nextCursor, { query, cursor: page.nextCursor, fence, context })
          while (cursors.size > 64) cursors.delete(cursors.keys().next().value!)
        }
        // A profile query covers this bound owner, not every accessible project.
        return { status: request.scope.kind === 'profile' || !request.query.trim() || page.truncated || page.nextCursor ? 'partial' : 'ready', resources,
          ...(nextCursor ? { nextCursor } : {}) }
      } catch (error) {
        if (!current(expected, context, signal)) return { status: 'offline', resources: [] }
        if (issued.size || cursors.size) notify()
        return { status: failure(error), resources: [] }
      }
    },
    async open(resource, scope, signal) {
      syncContext()
      const saved = issued.get(identity(resource))
      if (!saved || resource.owner !== OWNER || !input.host.treeV2 || (resource.kind === 'file' ? input.canOpen === false || !input.host.inspect : resource.kind !== 'folder' || !input.openFolder)
        || (scope.kind !== 'profile' && (scope.kind !== 'workspace' || scope.ref !== saved.fence.workspace))) return { status: 'unavailable' }
      const expected = epoch, context = saved.context
      if (!current(expected, context, signal)) return { status: 'unavailable' }
      try {
        const revealed = await input.host.treeV2.reveal(resource.ref)
        if (!current(expected, context, signal)) return { status: 'unavailable' }
        const node = revealed.target
        if (revealed.workspaceRef !== saved.fence.workspace || revealed.generation !== saved.fence.generation
          || !node || !safeNode(node) || node.ref !== saved.node.ref || node.version !== saved.node.version || node.name !== saved.node.name) {
          notify(); return { status: 'unavailable' }
        }
        if (resource.kind === 'folder') {
          if (node.kind !== 'directory' || !input.openFolder) return { status: 'unavailable' }
          const opened = await input.openFolder(node, signal)
          return { status: current(expected, context, signal) && opened ? 'opened' : 'unavailable' }
        }
        if (node.kind !== 'file' || !input.host.inspect) return { status: 'unavailable' }
        const proof = await input.host.inspect.inspect(node.ref)
        if (!current(expected, context, signal)) return { status: 'unavailable' }
        if (!proof.usable || proof.sensitive || !['ready', 'partial'].includes(proof.state) || proof.owner !== OWNER || proof.ref !== node.ref) {
          notify(); return { status: 'unavailable' }
        }
        // Tree revisions are stat metadata; inspect versions are content digests.
        // Do not compare those different owner domains. Recheck the tree after admission.
        const after = await input.host.treeV2.reveal(node.ref)
        if (!current(expected, context, signal) || after.workspaceRef !== saved.fence.workspace || after.generation !== saved.fence.generation
          || !after.target || !safeNode(after.target) || after.target.ref !== node.ref || after.target.version !== node.version || after.target.name !== node.name) {
          notify(); return { status: 'unavailable' }
        }
        const opened = await input.open(node, proof)
        return { status: current(expected, context, signal) && opened ? 'opened' : 'unavailable' }
      } catch (error) {
        notify(); return { status: failure(error) === 'denied' ? 'denied' : 'unavailable' }
      }
    },
  }
  return { source, notify, dispose() { disposed = true; notify(); listeners.clear() } }
}

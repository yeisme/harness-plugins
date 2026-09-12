import { type SearchCenterOwnerSource } from '../../ui-pane-workbench/src/search-source-registry.js'

import type { SearchCenterOwnerPage } from '../../ui-pane-workbench/src/search-source-registry.js'
import type { SearchCenterSourceRequest, SearchCenterResource } from '../../ui-pane-workbench/src/search-source.js'
import type { OrdoAgentOpsSnapshotLike } from './ordo.js'

export function createOrdoSearchSource(input: { readonly snapshot: () => OrdoAgentOpsSnapshotLike; readonly open?: (item: SearchCenterResource) => void }): SearchCenterOwnerSource {
  return { descriptor: { id: 'dsh.ordo', owner: 'ordo', coverage: 'metadata', pagination: false, preview: false, open: input.open !== undefined, resourceKinds: ['task','run','approval','verification','evidence'], scopes: ['workspace'], sorts: ['relevance','name','updated'], filters: ['state'], },
    search(request: SearchCenterSourceRequest): Promise<SearchCenterOwnerPage> {
      const snapshot = input.snapshot(); const run = snapshot.run; const items = snapshot.tasks?.length ? snapshot.tasks : run ? [{ ref: run.runRef, title: run.safeTitle, state: run.state, kind: 'run', summary: `${run.completedTaskCount}/${run.taskCount} tasks` }] : []
      const query = request.query.trim().toLocaleLowerCase(); if (snapshot.state === 'permission_denied') return Promise.resolve({ status: 'denied', resources: [] }); const resources = items.filter(item => !query || [item.ref,item.title,item.state,item.kind,item.summary].filter(Boolean).some(value => String(value).toLocaleLowerCase().includes(query))).map(item => ({ owner: 'ordo', kind: (item.kind ?? 'task') as never, ref: item.ref, title: item.title, summary: item.summary, status: (snapshot.state === 'permission_denied' ? 'denied' : 'ready'), scope: 'workspace', projectRef: 'ref' in request.scope ? request.scope.ref : undefined, availability: (snapshot.state === 'ready' ? 'available' : 'unavailable'), revision: snapshot.freshness, sourceLabel: 'Ordo Agent Ops' }))
      return Promise.resolve({ status: snapshot.state === 'permission_denied' ? 'denied' : snapshot.state === 'offline' ? 'offline' : 'ready', resources, total: resources.length } as unknown as SearchCenterOwnerPage)
    }, ...(input.open === undefined ? {} : { open: async (resource: SearchCenterResource) => { input.open?.(resource); return { status: 'opened' } } }), }
}

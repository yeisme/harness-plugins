import { describe, expect, it } from 'vitest'
import {
  createSessionFunctionsProvider,
  createSessionOrganizationController,
} from '../src/client/index.ts'
import type { SessionOrganizationRemoteFace, SessionOrganizationSnapshotV1 } from '../src/client/organization-wire.ts'

function snapshot(): SessionOrganizationSnapshotV1 {
  return {
    ok: true,
    specVersion: '1.0',
    functionTypes: [
      { id: 'research', name: '调研', color: 'chart-1', scope: { kind: 'global' }, order: 1, active: true, version: 'b', updatedAt: 0 },
      { id: 'writing', name: '写作', color: 'chart-2', scope: { kind: 'global' }, order: 2, active: true, version: 'b', updatedAt: 0 },
    ],
    assignments: [
      { sessionId: 's1', workspaceRef: 'w1', functionTypeId: 'research', functionSource: 'automatic', functionLocked: false, tagsLocked: false, classificationStatus: 'classified', confidence: 0.9, version: 'a1', updatedAt: 1 },
    ],
    tagCatalog: [],
    rules: [],
    recentBatches: [],
  }
}

function remote(answer: SessionOrganizationSnapshotV1): SessionOrganizationRemoteFace {
  return {
    async snapshot() { return answer },
    async setAssignment() { throw new Error('unused') },
    async putFunctionType() { throw new Error('unused') },
    async putTagCatalog() { throw new Error('unused') },
    async putRule() { throw new Error('unused') },
    async classify() { throw new Error('unused') },
    async planBatch() { throw new Error('unused') },
    async executeBatch() { throw new Error('unused') },
    async undoBatch() { throw new Error('unused') },
    async unlockAdmin() { throw new Error('unused') },
  }
}

describe('session function hierarchy provider', () => {
  it('projects workspace parents, function children, and unclassified rows', async () => {
    const controller = createSessionOrganizationController(remote(snapshot()))
    await controller.refresh()
    const provider = createSessionFunctionsProvider({
      controller,
      sessions: () => [
        { sessionId: 's1', workspaceRef: 'w1', workspaceName: 'Alpha' },
        { sessionId: 's2', workspaceRef: 'w1', workspaceName: 'Alpha' },
        { sessionId: 's3', workspaceRef: 'w2', workspaceName: 'Beta' },
      ],
      onManage: () => {},
      labels: { unclassified: '未分类' },
    })
    const groups = provider.getSnapshot().groups
    expect(groups.find(group => group.id === 'workspace:w1')).toMatchObject({ label: 'Alpha', sessionIds: [] })
    expect(groups.find(group => group.id.endsWith('function:research'))).toMatchObject({ parentId: 'workspace:w1', label: '调研', color: 'chart-1', sessionIds: ['s1'] })
    expect(groups.find(group => group.id === 'workspace:w1:function:unclassified')?.sessionIds).toEqual(['s2'])
    expect(groups.find(group => group.id === 'workspace:w2:function:unclassified')?.sessionIds).toEqual(['s3'])
  })

  it('returns no groups while the organization Remote is unavailable', async () => {
    const broken = remote(snapshot())
    broken.snapshot = async () => { throw new Error('offline') }
    const controller = createSessionOrganizationController(broken)
    await controller.refresh()
    const provider = createSessionFunctionsProvider({ controller, sessions: () => [], onManage: () => {} })
    expect(provider.getSnapshot().groups).toEqual([])
  })
})

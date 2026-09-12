import { expect, it, vi } from 'vitest'
import { withLocalScaenaTable } from '../src/local-scaena-table.ts'
import { scaenaTableViewSchema } from '../src/scaena-table-contract.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'local:user', principalRef: 'local:user', workspaceRef: 'workspace:one', projectRef: 'project:one', revision: '1', membershipRevision: '1', installationRef: 'installation:one', pluginDigest: 'digest:one', policyRevision: '1', runtimeGeneration: '1' }
const digest = `sha256:${'a'.repeat(64)}`
const view = { schema_version: 'scaena.storyboard_table_view.v1alpha1', project_ref: 'project:one', breakdown_ref: 'breakdown:one', candidate_ref: 'candidate:one', candidate_digest: digest, expected_version: 1,
  columns: [{ field: 'description', label: 'Description' }], shots: ['shot:one', 'shot:two'].map((shot_ref, order) => ({ scene_ref: 'scene:one', shot_ref, order, planned_duration_micros: 1000000, cells: { description: 'A scene' } })) }
function fixture() {
  const invoke = vi.fn(async (args: readonly string[]) => args[2] === 'show' ? { data: { view } } : { data: { candidate_ref: 'candidate:two', version: 2, digest, state: 'draft' } })
  const base = { owner: 'scaena', transport: 'local', configured: true, snapshot: vi.fn(), dispatch: vi.fn() } as unknown as CreatorOwnerAdapterV1
  return { invoke, adapter: withLocalScaenaTable(base, invoke, '/local/project') }
}
it('keeps reads side-effect free, rejects stale edits and incomplete reorder, and reconciles the original operation', async () => {
  const { invoke, adapter } = fixture()
  expect((await adapter.readScaenaTable!({ breakdownRef: view.breakdown_ref, shotRef: 'shot:one' }, context)).status).toBe('ready')
  const snapshot = await adapter.snapshot(context)
  expect(snapshot.actions.map(action => action.actionId)).toEqual(['scaena.table.set', 'scaena.table.set_duration', 'scaena.table.reorder'])
  expect(invoke.mock.calls.every(call => call[0][2] === 'show')).toBe(true)
  const action = snapshot.actions[2]!
  const request = { schema: 'pane.action-request.v1alpha1' as const, owner: 'scaena', actionId: action.actionId, descriptorRef: action.descriptorRef,
    expectedTargetRef: action.targetRef, expectedTargetVersion: action.targetVersion, context, idempotencyKey: 'original-order', values: { shots: 'shot:two\nshot:one' } }
  expect((await adapter.dispatch({ ...request, values: { shots: 'shot:two' } }, context)).status).toBe('unknown')
  expect((await adapter.dispatch({ ...request, expectedTargetVersion: 'stale' }, context)).status).toBe('reconcile_required')
  expect(invoke.mock.calls.filter(call => call[0][2] === 'edit')).toHaveLength(0)
  expect((await adapter.dispatch(request, context)).status).toBe('completed')
  const edit = invoke.mock.calls.find(call => call[0][2] === 'edit')![0]
  expect(edit).toContain('--scene')
  expect(edit).toContain('shot:two,shot:one')
  expect((await adapter.reconcile!({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'scaena', actionId: request.actionId, expectedTargetRef: request.expectedTargetRef, context, idempotencyKey: request.idempotencyKey }, context)).status).toBe('completed')
  expect(invoke.mock.calls.filter(call => call[0][2] === 'edit')).toHaveLength(1)
  expect(invoke.mock.calls.filter(call => call[0][2] === 'reconcile')).toHaveLength(1)
  expect(JSON.stringify(snapshot)).not.toContain('/local/project')
})
it('accepts an empty historical table without exposing edit actions', async () => {
  const { expected_version: _, ...historical } = view
  expect(scaenaTableViewSchema.parse({ ...historical, historical: true, shots: null })).toMatchObject({ expected_version: 0, shots: [] })
})

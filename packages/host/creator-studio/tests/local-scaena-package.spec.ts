import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { withLocalScaenaPackage } from '../src/local-scaena-package.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'local:user', principalRef: 'local:user', workspaceRef: 'workspace:one', projectRef: 'project:one', revision: '1', membershipRevision: '1', installationRef: 'installation:one', pluginDigest: 'digest:one', policyRevision: '1', runtimeGeneration: '1' }
const value = { schema_version: 'scaena.storyboard.review_package_projection.v1', package_ref: 'review-package:one', project_ref: 'project:one', episode_ref: 'episode:one', package_version: 3, graph_version: 2, state: 'reviewing', scene_has_more: false,
  scene_cards: [{ scene_ref: 'scene:one', order: 0, shot_refs: ['shot:one'], structural_accepted: true, visual_accepted: false, stale: false }], export: { formal_allowed: false, draft_allowed: true }, allowed_actions: [] }

it('opens canonical scenes, gates formal export, and observes an original export without repeating it', async () => {
  const invoke = vi.fn(async (args: readonly string[]) => {
    if (args[2] === 'show') return { data: value }
    const key = args[args.indexOf('--idempotency-key') + 1]!
    return { data: { schema_version: 'scaena.storyboard.package_export_manifest.v1', package_ref: value.package_ref, package_version: 3,
      idempotency_key_digest: `sha256:${createHash('sha256').update(key).digest('hex')}`, request_digest: `sha256:${'a'.repeat(64)}`, export_mode: 'draft', production_ready: false,
      files: [{ path: 'shots.json', digest: `sha256:${'b'.repeat(64)}`, size_bytes: 10 }] } }
  })
  const base = { owner: 'scaena', transport: 'local', configured: true, snapshot: vi.fn(), dispatch: vi.fn() } as unknown as CreatorOwnerAdapterV1
  const adapter = withLocalScaenaPackage(base, invoke, '/local/project')
  expect((await adapter.selectScaenaPackage!({ packageRef: value.package_ref }, context)).status).toBe('ready')
  const snapshot = await adapter.snapshot(context)
  expect(snapshot.resources.map(resource => resource.kind)).toEqual(['production-package', 'scene', 'shot'])
  expect(snapshot.actions.map(action => action.actionId)).toEqual(['scaena.package.export.draft'])
  expect(invoke.mock.calls.every(call => call[0][2] === 'show')).toBe(true)
  const descriptor = snapshot.actions[0]!
  const request = { schema: 'pane.action-request.v1alpha1' as const, owner: 'scaena', actionId: descriptor.actionId, descriptorRef: descriptor.descriptorRef,
    expectedTargetRef: descriptor.targetRef, expectedTargetVersion: descriptor.targetVersion, context, idempotencyKey: 'export-original', values: {} }
  expect((await adapter.dispatch(request, context)).status).toBe('completed')
  expect((await adapter.reconcile!({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'scaena', actionId: request.actionId, expectedTargetRef: request.expectedTargetRef, context, idempotencyKey: request.idempotencyKey }, context)).status).toBe('completed')
  expect(invoke.mock.calls.filter(call => call[0][2] === 'export')).toHaveLength(1)
  expect(invoke.mock.calls.filter(call => call[0][2] === 'export-status')).toHaveLength(1)
  expect(JSON.stringify(snapshot)).not.toContain('/local/project')
  expect((await adapter.dispatch({ ...request, expectedTargetVersion: '2' }, context)).status).toBe('reconcile_required')
  expect(invoke.mock.calls.filter(call => call[0][2] === 'export')).toHaveLength(1)
})

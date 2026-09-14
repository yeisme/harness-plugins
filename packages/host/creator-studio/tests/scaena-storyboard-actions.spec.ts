import { expect, it, vi } from 'vitest'
import { withLocalScaenaStoryboardActions, scaenaStoryboardBaseDescriptors, scaenaStoryboardBaseDispatch, scaenaStoryboardReceipt, scaenaUnconfirmedReceipt } from '../src/scaena-storyboard-actions.ts'
import type { ScaenaPackageProjection } from '../src/scaena-package-contract.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 't1', workspaceRef: 'w1', projectRef: 'p1', principalRef: 'u1',
  membershipRevision: 'm1', installationRef: 'i1', pluginDigest: 'd1', policyRevision: 'pol1', runtimeGeneration: '1', revision: 'r1' }
const digest = `sha256:${'a'.repeat(64)}`

function projection(overrides: Partial<ScaenaPackageProjection> = {}): ScaenaPackageProjection {
  return {
    schema_version: 'scaena.storyboard.review_package_projection.v1', package_ref: 'review-package:one', project_ref: 'project:one',
    episode_ref: 'episode:one', scenario: 'short_drama', state: 'reviewing', episode_graph_ref: 'graph:one',
    graph_version: 2, package_version: 3, episode_completed: false, input_source_kind: 'local_attestation', input_digest: digest,
    scene_cards: [
      { scene_ref: 'scene:one', order: 0, shot_refs: ['shot:one', 'shot:two'], structural_accepted: true, visual_accepted: false, stale: false },
      { scene_ref: 'scene:two', order: 1, shot_refs: ['shot:three'], structural_accepted: true, visual_accepted: false, stale: true },
    ],
    blockers: [], allowed_actions: ['recommend', 'confirm_recommendation', 'accept_scene', 'confirm_creative_contract', 'complete_episode'],
    export: { formal_allowed: false, draft_allowed: true }, ...overrides,
  } as ScaenaPackageProjection
}

function envelopeForShow(value: ScaenaPackageProjection) { return { data: value } }

function buildStudio(handler: (args: readonly string[]) => unknown) {
  const invoke = vi.fn(async (args: readonly string[]) => handler(args))
  const base = { owner: 'scaena', transport: 'local', configured: true,
    snapshot: vi.fn(async (): Promise<never> => ({ schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'scaena', transport: 'local', snapshotRef: 'scaena:base', snapshotVersion: 1, cursor: 'c', sequence: 1, generatedAt: '2026-09-14T00:00:00Z', context, status: 'ready', freshness: 'fresh', summary: 'base', resources: [], actions: [] }) as never),
    dispatch: vi.fn(async () => ({ status: 'rejected' as const, owner: 'scaena', receiptRef: 'scaena:base:unsupported', summary: 'unsupported' })),
    selectScaenaPackage: vi.fn(async () => ({ status: 'ready' as const, packageRef: 'review-package:one' })),
  } as unknown as CreatorOwnerAdapterV1
  return { invoke, studio: withLocalScaenaStoryboardActions(base, invoke as never, '/local/project') }
}

function request(descriptor: { actionId: string; descriptorRef: string; targetRef: string; targetVersion: string }, values: Record<string, unknown>, key = 'original-key-1') {
  return { schema: 'pane.action-request.v1alpha1' as const, owner: 'scaena', actionId: descriptor.actionId, descriptorRef: descriptor.descriptorRef,
    expectedTargetRef: descriptor.targetRef, expectedTargetVersion: descriptor.targetVersion, context, idempotencyKey: key, values }
}

it('discovers only owner-allowed actions and binds expected versions per owner scope', () => {
  const descriptors = scaenaStoryboardBaseDescriptors(projection(), context)
  const ids = descriptors.map(item => item.actionId)
  expect(ids).toEqual(['scaena.package.recommend', 'scaena.package.confirm_recommendation', 'scaena.package.scene_accept', 'scaena.package.scene_revalidate', 'scaena.package.creative_confirm', 'scaena.package.complete'])
  const byId = new Map(descriptors.map(item => [item.actionId, item]))
  expect(byId.get('scaena.package.complete')?.targetVersion).toBe('3')
  expect(byId.get('scaena.package.scene_accept')?.targetVersion).toBe('2')
  expect(byId.get('scaena.package.scene_revalidate')?.fields[0]).toMatchObject({ key: 'scene', options: [{ value: 'scene:two' }] })
  // 无 stale 场景时不发布 revalidate 恢复面。
  const noStale = scaenaStoryboardBaseDescriptors(projection({ scene_cards: [{ scene_ref: 'scene:one', order: 0, shot_refs: ['shot:one'], structural_accepted: true, visual_accepted: false, stale: false }] }), context)
  expect(noStale.map(item => item.actionId)).not.toContain('scaena.package.scene_revalidate')
})

it('appends discovered actions to the snapshot only after a package selection in the same scope', async () => {
  const value = projection()
  const { invoke, studio } = buildStudio(args => (args[2] === 'show' ? envelopeForShow(value) : { status: 'ok' }))
  expect((await studio.snapshot(context)).actions).toHaveLength(0)
  expect((await studio.selectScaenaPackage!({ packageRef: 'review-package:one' }, context)).status).toBe('ready')
  const snapshot = await studio.snapshot(context)
  expect(snapshot.actions.map(item => item.actionId)).toContain('scaena.package.recommend')
  // scope 漂移（换会话/项目）后不发布动作：迟到响应不得覆盖新 scope。
  const other: CreatorStudioContextV1 = { ...context, projectRef: 'p2', sessionRef: 's2' }
  expect((await studio.snapshot(other)).actions).toHaveLength(0)
  expect(invoke).toBeTruthy()
})

it('dispatches scene acceptance with expected graph version, idempotency key and confirm', async () => {
  const value = projection()
  const mutations: unknown[] = []
  const { invoke, studio } = buildStudio(args => {
    if (args[2] === 'show') return envelopeForShow(value)
    if (args[2] === 'scene-accept') { mutations.push(args); return { status: 'accepted', facts: { package_ref: 'review-package:one', scene_ref: 'scene:one', acceptance_receipt_ref: 'acceptance:9', composition_receipt_ref: 'composition:9', graph_version: 3, package_version: 4 }, evidence: ['acceptance:9', 'composition:9'] } }
    return { status: 'ok' }
  })
  await studio.selectScaenaPackage!({ packageRef: 'review-package:one' }, context)
  const descriptor = (await studio.snapshot(context)).actions.find(item => item.actionId === 'scaena.package.scene_accept')!
  const receipt = await studio.dispatch(request(descriptor, { scene: 'scene:one', shots: 'shot:one shot:two', candidate_ref: 'candidate:7',
    candidate_digest: digest, duration_digest: digest, dialogue_digest: digest }), context)
  expect(receipt).toMatchObject({ status: 'completed', receiptRef: 'acceptance:9', actionId: 'scaena.package.scene_accept' })
  expect(mutations).toHaveLength(1)
  expect(mutations[0]).toEqual(['storyboard', 'package', 'scene-accept', 'review-package:one', '--project', '/local/project',
    '--scene', 'scene:one', '--shots', 'shot:one,shot:two', '--candidate-ref', 'candidate:7', '--candidate-digest', digest,
    '--duration-digest', digest, '--dialogue-digest', digest, '--expected-version', '2', '--idempotency-key', 'original-key-1', '--actor', 'user:operator', '--confirm'])
})

it('maps owner stale rejection to reconcile_required without resubmitting or overwriting', async () => {
  const value = projection()
  const mutations: unknown[] = []
  const { invoke, studio } = buildStudio(args => {
    if (args[2] === 'show') return envelopeForShow(value)
    if (args[2] === 'creative-confirm') { mutations.push(args); return { status: 'failed', error: { code: 'SCN_GRAPH_VERSION_CONFLICT', message: 'stale' } } }
    return { status: 'ok' }
  })
  await studio.selectScaenaPackage!({ packageRef: 'review-package:one' }, context)
  const descriptor = (await studio.snapshot(context)).actions.find(item => item.actionId === 'scaena.package.creative_confirm')!
  const values = { story_spine_digest: digest, shot_beats_digest: digest, dialogue_backbone_digest: digest, visual_tone_digest: digest, duration_contract_digest: digest }
  const receipt = await studio.dispatch(request(descriptor, values), context)
  expect(receipt).toMatchObject({ status: 'reconcile_required', reconcileReason: 'SCN_GRAPH_VERSION_CONFLICT' })
  expect(mutations).toHaveLength(1)
  // owner 已推进版本（descriptor 消失）也不重发：只回 reconcile_required，
  // 刷新后由用户重取 descriptor，草稿不被覆盖。
  value.package_version = 4
  const drifted = await studio.dispatch(request(descriptor, values, 'another-key-2'), context)
  expect(drifted.status).toBe('reconcile_required')
  expect(mutations).toHaveLength(1)
})

it('reconciles through idempotent replay of the remembered exact command, and stays unknown after restart', async () => {
  const value = projection()
  const commands: unknown[] = []
  const { invoke, studio } = buildStudio(args => {
    if (args[2] === 'show') return envelopeForShow(value)
    if (args[2] === 'complete') { commands.push(args); return { status: 'completed', facts: { package_ref: 'review-package:one', episode_completed: true, graph_version: 5, package_version: 6 } } }
    return { status: 'ok' }
  })
  await studio.selectScaenaPackage!({ packageRef: 'review-package:one' }, context)
  const descriptor = (await studio.snapshot(context)).actions.find(item => item.actionId === 'scaena.package.complete')!
  const first = await studio.dispatch(request(descriptor, {}, 'complete-key-3'), context)
  expect(first).toMatchObject({ status: 'completed', receiptRef: 'review-package:one' })
  const reconciled = await studio.reconcile!({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'scaena', actionId: 'scaena.package.complete',
    expectedTargetRef: 'review-package:one', context, idempotencyKey: 'complete-key-3' }, context)
  expect(reconciled).toMatchObject({ status: 'completed' })
  expect(commands).toHaveLength(2)
  // 同 key 幂等回放逐字节一致。
  expect(commands[0]).toEqual(commands[1])
  // 未记住的 key（如重启后）→ unknown，不猜输入、不重发。
  const forgotten = await studio.reconcile!({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'scaena', actionId: 'scaena.package.complete',
    expectedTargetRef: 'review-package:one', context, idempotencyKey: 'never-issued' }, context)
  expect(forgotten).toMatchObject({ status: 'unknown' })
  expect(commands).toHaveLength(2)
})

it('builds fixed verb arguments only for valid field values; invalid input never reaches the owner', () => {
  const value = projection()
  const base = { schema: 'pane.action-request.v1alpha1' as const, owner: 'scaena', descriptorRef: 'x', context, idempotencyKey: 'validate-key-9' }
  expect(scaenaStoryboardBaseDispatch(value, { ...base, actionId: 'scaena.package.scene_accept', expectedTargetRef: 'review-package:one', expectedTargetVersion: '2',
    values: { scene: 'scene:none', shots: 'shot:one', candidate_ref: 'candidate:1', candidate_digest: digest, duration_digest: digest, dialogue_digest: digest } }, '/local/project')).toBeUndefined()
  expect(scaenaStoryboardBaseDispatch(value, { ...base, actionId: 'scaena.package.creative_confirm', expectedTargetRef: 'review-package:one', expectedTargetVersion: '3',
    values: { story_spine_digest: 'not-a-digest', shot_beats_digest: digest, dialogue_backbone_digest: digest, visual_tone_digest: digest, duration_contract_digest: digest } }, '/local/project')).toBeUndefined()
  const confirm = scaenaStoryboardBaseDispatch(value, { ...base, actionId: 'scaena.package.confirm_recommendation', expectedTargetRef: 'review-package:one', expectedTargetVersion: '3', values: { depth: 'cinematic' } }, '/local/project')
  expect(confirm).toEqual(['storyboard', 'package', 'confirm', 'review-package:one', '--project', '/local/project', '--expected-version', '3', '--idempotency-key', 'validate-key-9', '--actor', 'user:operator', '--confirm', '--depth', 'cinematic'])
})

it('keeps receipts owner-echoed and unconfirmed receipts honest', () => {
  const recommend = scaenaStoryboardReceipt('scaena.package.recommend', { status: 'recommended', facts: { recommendation_ref: 'recommendation:4', recommendation_digest: digest, recommended_depth: 'balanced' }, evidence: ['recommendation:4'] })
  expect(recommend).toMatchObject({ status: 'completed', receiptRef: 'recommendation:4' })
  expect(scaenaStoryboardReceipt('scaena.package.recommend', { status: 'recommended', facts: {} }).status).toBe('unknown')
  const stale = scaenaUnconfirmedReceipt('scaena.package.scene_accept', 'some-key-12', 'SCN_SCENE_BOUNDARY_STALE')
  expect(stale).toMatchObject({ status: 'reconcile_required', reconcileReason: 'SCN_SCENE_BOUNDARY_STALE' })
  expect(scaenaUnconfirmedReceipt('scaena.package.complete', 'some-key-12', 'DISK_FULL').status).toBe('unknown')
})

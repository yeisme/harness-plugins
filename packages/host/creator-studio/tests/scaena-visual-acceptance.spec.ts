import { expect, it } from 'vitest'
import { visualAcceptanceDescriptors, visualAcceptanceDispatch } from '../src/scaena-visual-acceptance.ts'
import type { ScaenaPackageProjection } from '../src/scaena-package-contract.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 't1', workspaceRef: 'w1', projectRef: 'p1', principalRef: 'u1',
  membershipRevision: 'm1', installationRef: 'i1', pluginDigest: 'd1', policyRevision: 'pol1', runtimeGeneration: '1', revision: 'r1' }
const digest = `sha256:${'b'.repeat(64)}`

function projection(overrides: Partial<ScaenaPackageProjection> = {}): ScaenaPackageProjection {
  return {
    schema_version: 'scaena.storyboard.review_package_projection.v1', package_ref: 'review-package:one', project_ref: 'project:one',
    episode_ref: 'episode:one', scenario: 'short_drama', state: 'reviewing', episode_graph_ref: 'graph:one',
    graph_version: 5, package_version: 3, episode_completed: false, input_source_kind: 'local_attestation', input_digest: digest,
    scene_cards: [{ scene_ref: 'scene:one', order: 0, shot_refs: ['shot:one', 'shot:two'], structural_accepted: true, visual_accepted: false, stale: false }],
    wave_cards: [
      { wave_ref: 'wave:1', wave_kind: 'key_shots', execution_state: 'succeeded', approved: true, paid: true, job_count: 2, estimate_status: 'bounded', has_hard_budget: false, plan_digest: 'plan-digest-1', expected_package_version: 3 },
      { wave_ref: 'wave:2', wave_kind: 'remaining_shots', execution_state: 'draft', approved: false, paid: false, job_count: 1, estimate_status: 'unknown', has_hard_budget: false, plan_digest: 'plan-digest-2', expected_package_version: 3 },
    ],
    blockers: [], allowed_actions: ['visual_accept'],
    export: { formal_allowed: false, draft_allowed: true }, ...overrides,
  } as ScaenaPackageProjection
}

function request(actionId: string, values: Record<string, unknown>, targetVersion = '5') {
  return { schema: 'pane.action-request.v1alpha1' as const, owner: 'scaena', actionId, descriptorRef: 'unused', expectedTargetRef: 'review-package:one',
    expectedTargetVersion: targetVersion, context, idempotencyKey: 'visual-key-01', values }
}

it('publishes visual review only for reviewable waves and adoption only for owner-allowed scenes', () => {
  const descriptors = visualAcceptanceDescriptors(projection(), context)
  const reviewWaves = descriptors.filter(item => item.actionId === 'scaena.package.visual_review').map(item => item.descriptorRef)
  expect(reviewWaves).toHaveLength(1)
  const accepts = descriptors.filter(item => item.actionId === 'scaena.package.visual_accept')
  expect(accepts.map(item => item.label)).toEqual(['采纳场景视觉候选 · scene:one'])
  expect(accepts[0]?.targetVersion).toBe('5')
  // owner 未允许 visual_accept → 只剩审阅面，不发明采纳动作。
  const gated = visualAcceptanceDescriptors(projection({ allowed_actions: [] }), context)
  expect(gated.filter(item => item.actionId === 'scaena.package.visual_accept')).toHaveLength(0)
  expect(gated.some(item => item.actionId === 'scaena.package.visual_review')).toBe(true)
})

it('builds adoption selections in the owner wire format with scene scope validation', () => {
  const args = visualAcceptanceDispatch(projection(), request('scaena.package.visual_accept', {
    scene_ref: 'scene:one', selections: `shot:one|${digest}|0|job:one shot:two|${digest}|1|job:two`,
  }), '/local/project')
  expect(args).toEqual(['storyboard', 'package', 'visual-accept', 'review-package:one', '--project', '/local/project', '--scene', 'scene:one',
    '--expected-version', '5', '--idempotency-key', 'visual-key-01', '--actor', 'user:operator', '--confirm',
    '--selections', `shot:one|${digest}|0|job:one`, '--selections', `shot:two|${digest}|1|job:two`])
  // 非法 selection 线格式 / 场景外镜头 / 缺 job 前三段 → 不发 owner 调用。
  expect(visualAcceptanceDispatch(projection(), request('scaena.package.visual_accept', { scene_ref: 'scene:one', selections: `shot:one|not-a-digest|0` }), '/local/project')).toBeUndefined()
  expect(visualAcceptanceDispatch(projection(), request('scaena.package.visual_accept', { scene_ref: 'scene:one', selections: `shot:nine|${digest}|0|job:one` }), '/local/project')).toBeUndefined()
  expect(visualAcceptanceDispatch(projection(), request('scaena.package.visual_accept', { scene_ref: 'scene:none', selections: `shot:one|${digest}|0` }), '/local/project')).toBeUndefined()
})

it('validates visual review decisions and candidate index bounds against the owner vocabulary', () => {
  const args = visualAcceptanceDispatch(projection(), request('scaena.package.visual_review', {
    wave_ref: 'wave:1', job_ref: 'job:one', scene_ref: 'scene:one', shot_ref: 'shot:one', decision: 'request_change', selected_index: 2, selected_digest: digest,
  }), '/local/project')
  expect(args).toEqual(['storyboard', 'package', 'visual-review', 'review-package:one', '--project', '/local/project',
    '--wave', 'wave:1', '--job', 'job:one', '--scene', 'scene:one', '--shot', 'shot:one', '--decision', 'request_change',
    '--idempotency-key', 'visual-key-01', '--actor', 'user:operator', '--confirm', '--selected-index', '2', '--selected-digest', digest])
  expect(visualAcceptanceDispatch(projection(), request('scaena.package.visual_review', {
    wave_ref: 'wave:2', job_ref: 'job:one', scene_ref: 'scene:one', shot_ref: 'shot:one', decision: 'accept',
  }), '/local/project')).toBeUndefined()
  expect(visualAcceptanceDispatch(projection(), request('scaena.package.visual_review', {
    wave_ref: 'wave:1', job_ref: 'job:one', scene_ref: 'scene:one', shot_ref: 'shot:one', decision: 'regenerate',
  }), '/local/project')).toBeUndefined()
})

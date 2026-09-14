import { expect, it } from 'vitest'
import { deriveScaenaWavePreview, waveDescriptors, waveDispatch, parseScaenaPlannedWave } from '../src/scaena-wave-preview.ts'
import type { ScaenaGenerationWave, ScaenaPackageProjection } from '../src/scaena-package-contract.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 't1', workspaceRef: 'w1', projectRef: 'p1', principalRef: 'u1',
  membershipRevision: 'm1', installationRef: 'i1', pluginDigest: 'd1', policyRevision: 'pol1', runtimeGeneration: '1', revision: 'r1' }
const digest = `sha256:${'c'.repeat(64)}`

function projection(overrides: Partial<ScaenaPackageProjection> = {}): ScaenaPackageProjection {
  return {
    schema_version: 'scaena.storyboard.review_package_projection.v1', package_ref: 'review-package:one', project_ref: 'project:one',
    episode_ref: 'episode:one', scenario: 'short_drama', state: 'reviewing', episode_graph_ref: 'graph:one',
    graph_version: 2, package_version: 3, episode_completed: false, input_source_kind: 'local_attestation', input_digest: digest,
    scene_cards: [
      { scene_ref: 'scene:one', order: 0, shot_refs: ['shot:one'], structural_accepted: true, visual_accepted: true, stale: false },
      { scene_ref: 'scene:two', order: 1, shot_refs: ['shot:two'], structural_accepted: true, visual_accepted: false, stale: false },
      { scene_ref: 'scene:three', order: 2, shot_refs: ['shot:three'], structural_accepted: false, visual_accepted: false, stale: true },
    ],
    wave_cards: [], blockers: [], allowed_actions: ['plan_wave', 'approve_wave'],
    export: { formal_allowed: false, draft_allowed: true }, ...overrides,
  } as ScaenaPackageProjection
}

const plannedWave: ScaenaGenerationWave = {
  schema_version: 'scaena.storyboard.generation_wave.v1', wave_ref: 'wave:9', package_ref: 'review-package:one',
  wave_kind: 'key_shots', asset_node_keys: ['node:hero'], candidates_per_shot: 2, estimate_status: 'unknown',
  job_plan: [{ job_key: 'job-key-1', asset_node_keys: ['node:hero'], shot_ref: 'shot:one', model_ref: 'openai/gpt-5.4-image-2', candidate_count: 2, prompt_digest: digest }],
  plan_digest: 'plan-digest-9', expected_package_version: 3, execution_state: 'awaiting_approval', paid: false,
}

it('previews the frozen execution list and lists out-of-scope blocked inputs explicitly', () => {
  const preview = deriveScaenaWavePreview(projection(), plannedWave)
  expect(preview.schemaVersion).toBe('scaena.wave_preview.v1')
  expect(preview.scopeFrozen).toBe(true)
  expect(preview.executing).toEqual([{ shotRef: 'shot:one', jobKey: 'job-key-1', candidateCount: 2, modelRef: 'openai/gpt-5.4-image-2' }])
  // 范围外输入：scene:two 缺视觉采纳、scene:three stale —— 逐项列出，不静默扩scope。
  expect(preview.outOfScopeBlocked).toEqual([{ sceneRef: 'scene:two', reason: 'SCN_VISUAL_ACCEPTANCE_REQUIRED' }, { sceneRef: 'scene:three', reason: 'SCN_SCENE_BOUNDARY_STALE' }])
  expect(preview.estimateStatus).toBe('unknown')
})

it('parses the owner planned wave wire and rejects unknown critical wave versions', () => {
  expect(parseScaenaPlannedWave(plannedWave)?.wave_ref).toBe('wave:9')
  expect(parseScaenaPlannedWave({ ...plannedWave, schema_version: 'scaena.storyboard.generation_wave.v2' })).toBeUndefined()
  expect(parseScaenaPlannedWave({ ...plannedWave, job_plan: [...plannedWave.job_plan, { job_key: 'k', asset_node_keys: ['n'], shot_ref: 's', model_ref: 'm', candidate_count: 9, prompt_digest: 'd' }] })).toBeUndefined()
})

it('requires explicit unknown-estimate confirmation and binds approval to the exact plan digest', () => {
  const value = projection({ wave_cards: [
    { wave_ref: 'wave:9', wave_kind: 'key_shots', execution_state: 'awaiting_approval', approved: false, paid: false, job_count: 1, estimate_status: 'unknown', has_hard_budget: false, plan_digest: 'plan-digest-9', expected_package_version: 3 },
  ] })
  const descriptors = waveDescriptors(value, context)
  const approve = descriptors.find(item => item.actionId === 'scaena.package.wave_approve')
  expect(approve?.risk).toBe('high')
  expect(approve?.targetVersion).toBe('3')
  expect(approve?.fields.map(field => field.key)).toContain('confirm_unknown_estimate')
  // 未勾选显式确认 → 不构造 owner 命令。
  expect(waveDispatch(value, { schema: 'pane.action-request.v1alpha1', owner: 'scaena', actionId: 'scaena.package.wave_approve', descriptorRef: approve!.descriptorRef,
    expectedTargetRef: 'review-package:one', expectedTargetVersion: '3', context, idempotencyKey: 'approve-key-77', values: { wave_ref: 'wave:9' } }, '/local/project')).toBeUndefined()
  const args = waveDispatch(value, { schema: 'pane.action-request.v1alpha1', owner: 'scaena', actionId: 'scaena.package.wave_approve', descriptorRef: approve!.descriptorRef,
    expectedTargetRef: 'review-package:one', expectedTargetVersion: '3', context, idempotencyKey: 'approve-key-77', values: { wave_ref: 'wave:9', confirm_unknown_estimate: true } }, '/local/project')
  expect(args).toEqual(['storyboard', 'package', 'wave-approve', 'review-package:one', '--project', '/local/project', '--wave', 'wave:9',
    '--expected-version', '3', '--idempotency-key', 'approve-key-77', '--actor', 'user:operator', '--confirm', '--confirm-unknown-estimate'])
  // plan digest 漂移（owner 重排计划）→ 原 descriptor 消失。
  const drifted = projection({ wave_cards: [{ ...value.wave_cards![0]!, plan_digest: 'plan-digest-10' }] })
  expect(waveDescriptors(drifted, context).some(item => item.descriptorRef === approve!.descriptorRef)).toBe(false)
})

it('executes only approved exact waves and offers reconcile for unknown outcomes', () => {
  const value = projection({ wave_cards: [
    { wave_ref: 'wave:approved', wave_kind: 'key_shots', execution_state: 'approved', approved: true, paid: true, job_count: 1, estimate_status: 'bounded', has_hard_budget: false, plan_digest: 'plan-a', expected_package_version: 3 },
    { wave_ref: 'wave:unapproved', wave_kind: 'key_shots', execution_state: 'awaiting_approval', approved: false, paid: false, job_count: 1, estimate_status: 'bounded', has_hard_budget: false, plan_digest: 'plan-b', expected_package_version: 3 },
    { wave_ref: 'wave:partial', wave_kind: 'key_shots', execution_state: 'partially_succeeded', approved: true, paid: true, job_count: 2, estimate_status: 'bounded', has_hard_budget: false, plan_digest: 'plan-c', expected_package_version: 3 },
  ] })
  const descriptors = waveDescriptors(value, context)
  expect(descriptors.filter(item => item.actionId === 'scaena.package.wave_execute').map(item => item.fields[0]?.options[0]?.value)).toEqual(['wave:approved'])
  expect(descriptors.filter(item => item.actionId === 'scaena.package.wave_reconcile').map(item => item.fields[0]?.options[0]?.value)).toEqual(['wave:partial'])
  const base = { schema: 'pane.action-request.v1alpha1' as const, owner: 'scaena', expectedTargetRef: 'review-package:one', context, idempotencyKey: 'execute-key-77' }
  expect(waveDispatch(value, { ...base, actionId: 'scaena.package.wave_execute', descriptorRef: 'x', expectedTargetVersion: 'plan-b', values: { wave_ref: 'wave:unapproved' } }, '/local/project')).toBeUndefined()
  expect(waveDispatch(value, { ...base, actionId: 'scaena.package.wave_execute', descriptorRef: 'x', expectedTargetVersion: 'plan-a', values: { wave_ref: 'wave:approved' } }, '/local/project'))
    .toEqual(['storyboard', 'package', 'execute', 'review-package:one', '--project', '/local/project', '--wave', 'wave:approved'])
  expect(waveDispatch(value, { ...base, actionId: 'scaena.package.wave_reconcile', descriptorRef: 'x', expectedTargetVersion: 'plan-c', values: { wave_ref: 'wave:partial' } }, '/local/project'))
    .toEqual(['storyboard', 'package', 'wave-reconcile', 'review-package:one', '--project', '/local/project', '--wave', 'wave:partial'])
})

it('plans waves with fixed verbs and bounded candidate counts', () => {
  const value = projection()
  const plan = waveDescriptors(value, context).find(item => item.actionId === 'scaena.package.wave_plan')
  expect(plan?.targetVersion).toBe('3')
  const base = { schema: 'pane.action-request.v1alpha1' as const, owner: 'scaena', descriptorRef: plan!.descriptorRef, expectedTargetRef: 'review-package:one', expectedTargetVersion: '3', context, idempotencyKey: 'plan-wave-key' }
  expect(waveDispatch(value, { ...base, actionId: 'scaena.package.wave_plan', values: { wave_kind: 'key_shots', candidates: 4 } }, '/local/project'))
    .toEqual(['storyboard', 'package', 'wave-plan', 'review-package:one', '--project', '/local/project', '--wave-kind', 'key_shots', '--expected-version', '3', '--idempotency-key', 'plan-wave-key', '--candidates', '4'])
  expect(waveDispatch(value, { ...base, actionId: 'scaena.package.wave_plan', values: { wave_kind: 'invalid_kind' } }, '/local/project')).toBeUndefined()
  expect(waveDispatch(value, { ...base, actionId: 'scaena.package.wave_plan', values: { wave_kind: 'key_shots', candidates: 9 } }, '/local/project')).toBeUndefined()
})

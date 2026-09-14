/**
 * Scaena 生成 wave 编排预览（dsh-scaena-production-studio-v1 §2.4）。
 *
 * 预览消费 owner 计划面，范围固定：将执行项 = wave 的 job plan（逐镜头
 * job_key/候选数/模型），范围外输入 = 不在本 wave plan 内且缺少当前视觉
 * 采纳/存在 owner blocker 的场景切片——逐项列出，绝不静默扩scope。
 * 批准绑定 exact wave（wave ref + plan digest + expected package version）；
 * plan digest 或版本漂移使 approval stale → descriptor 消失 →
 * reconcile_required，不重发。无界 estimate（estimate_status=unknown）必须
 * 显式确认才允许 approve（--confirm-unknown-estimate 仅作用于该 exact wave）。
 * execute 只执行已批准的 exact wave。跨领域编排不经此模块——按 change
 * 设计走 dsh-creative-workflow-v1 的 Ordo 通道，此处不重复实现。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import { PaneActionDescriptorSchema, PANE_ACTION_DESCRIPTOR_SCHEMA, decodePaneActionValues, type PaneActionDescriptorV1, type PaneActionRequestV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioContextV1 } from './types.ts'
import { scaenaDigestRef as digestRef, scaenaGenerationWaveSchema, type ScaenaGenerationWave, type ScaenaPackageProjection } from './scaena-package-contract.ts'

export const scaenaWaveActionIds = ['scaena.package.wave_plan', 'scaena.package.wave_approve', 'scaena.package.wave_reconcile', 'scaena.package.wave_execute'] as const
export type ScaenaWaveActionId = (typeof scaenaWaveActionIds)[number]

export const SCAENA_WAVE_KINDS = ['storyboard_model', 'foundation', 'key_shots', 'remaining_shots', 'repair'] as const

/** 编排预览：固定范围（将执行项）+ 范围外输入阻塞清单。浏览器安全形状。 */
export interface ScaenaWavePreview {
  readonly schemaVersion: 'scaena.wave_preview.v1'
  readonly waveRef: string
  readonly planDigest: string
  readonly expectedPackageVersion: number
  readonly estimateStatus: 'unknown' | 'bounded'
  readonly executing: readonly { readonly shotRef: string; readonly jobKey: string; readonly candidateCount: number; readonly modelRef: string }[]
  /** 范围外且被阻塞的输入：scene ref + owner blocker 码（不扩scope、不执行）。 */
  readonly outOfScopeBlocked: readonly { readonly sceneRef: string; readonly reason: string }[]
  readonly scopeFrozen: true
}

const previewReason = (card: { structural_accepted: boolean; visual_accepted: boolean; stale: boolean; blockers?: string[] | undefined }): string => {
  if (card.stale) return 'SCN_SCENE_BOUNDARY_STALE'
  if (!card.structural_accepted) return 'SCN_RECOMMENDATION_CONFIRMATION_REQUIRED'
  if (!card.visual_accepted) return 'SCN_VISUAL_ACCEPTANCE_REQUIRED'
  return card.blockers?.[0] ?? 'owner_blocked'
}

/**
 * 从计划 wave（wave-plan 返回的 data，完整 job plan）+ 当前包投影推导预览。
 * 范围外输入=投影中未被本 wave 覆盖的场景切片；只有带 blocker 的才列入
 * 阻塞清单（无 blocker 的范围外场景只是尚未计划，不构成阻塞）。
 */
export function deriveScaenaWavePreview(projection: ScaenaPackageProjection, wave: ScaenaGenerationWave): ScaenaWavePreview {
  const coveredShots = new Set(wave.job_plan.map(job => job.shot_ref))
  const outOfScopeBlocked = (projection.scene_cards ?? [])
    .filter(card => !card.shot_refs.some(shot => coveredShots.has(shot)))
    .filter(card => card.stale || !card.structural_accepted || !card.visual_accepted || (card.blockers ?? []).length > 0)
    .map(card => ({ sceneRef: card.scene_ref, reason: previewReason(card) }))
  return {
    schemaVersion: 'scaena.wave_preview.v1', waveRef: wave.wave_ref, planDigest: wave.plan_digest,
    expectedPackageVersion: wave.expected_package_version, estimateStatus: wave.estimate_status,
    executing: wave.job_plan.map(job => ({ shotRef: job.shot_ref, jobKey: job.job_key, candidateCount: job.candidate_count, modelRef: job.model_ref })),
    outOfScopeBlocked, scopeFrozen: true,
  }
}

/** 从 wave 卡片（无 job plan 细节）推导有界预览：执行项只保留计数事实。 */
export function deriveScaenaWaveCardPreview(projection: ScaenaPackageProjection, card: ScaenaPackageProjection['wave_cards'] extends (infer T)[] | undefined ? T : never): ScaenaWavePreview {
  const covered = new Set((projection.scene_cards ?? []).filter(scene => scene.visual_accepted).map(scene => scene.scene_ref))
  return {
    schemaVersion: 'scaena.wave_preview.v1', waveRef: card.wave_ref, planDigest: card.plan_digest,
    expectedPackageVersion: card.expected_package_version, estimateStatus: card.estimate_status === 'bounded' ? 'bounded' : 'unknown',
    executing: [], outOfScopeBlocked: (projection.scene_cards ?? [])
      .filter(scene => !covered.has(scene.scene_ref) && (scene.blockers ?? []).length > 0)
      .map(scene => ({ sceneRef: scene.scene_ref, reason: previewReason(scene) })),
    scopeFrozen: true,
  }
}

export function waveDescriptors(projection: ScaenaPackageProjection, context: CreatorStudioContextV1): PaneActionDescriptorV1[] {
  const allowed = new Set(projection.allowed_actions)
  const target = projection.package_ref
  const packageVersion = String(projection.package_version)
  const descriptors: PaneActionDescriptorV1[] = []

  if (allowed.has('plan_wave')) descriptors.push(PaneActionDescriptorSchema.parse({
    schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'scaena', actionId: 'scaena.package.wave_plan',
    descriptorRef: digestRef(['scaena.package.wave_plan', target, projection.package_version]),
    targetRef: target, targetVersion: packageVersion, context, label: '规划生成 wave（固定范围预览）',
    risk: 'medium', confirmation: 'confirm', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    preview: { summary: `Plan one advisory generation wave at package version ${projection.package_version}. The plan digest freezes the exact job list; approval is a separate action and the scope is never widened silently. Technical candidate partitioning is not a quota.` },
    fields: [
      { key: 'wave_kind', label: 'Wave 类型', kind: 'select', required: true, options: SCAENA_WAVE_KINDS.map(kind => ({ value: kind, label: kind })) },
      { key: 'candidates', label: '每镜头候选数（1–8）', kind: 'number', required: false, min: 1, max: 8 },
    ],
  }))

  for (const card of (projection.wave_cards ?? []).slice(0, 16)) {
    const cardPreview = deriveScaenaWaveCardPreview(projection, card)
    const blockedSummary = cardPreview.outOfScopeBlocked.slice(0, 4).map(item => `${item.sceneRef}:${item.reason}`).join(', ')
    // approve：批准 exact plan digest + wave expected package version。
    if (allowed.has('approve_wave') && !card.approved && ['draft', 'planned', 'awaiting_approval'].includes(card.execution_state)) {
      descriptors.push(PaneActionDescriptorSchema.parse({
        schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'scaena', actionId: 'scaena.package.wave_approve',
        descriptorRef: digestRef(['scaena.package.wave_approve', target, card.wave_ref, card.plan_digest, card.expected_package_version, card.estimate_status]),
        targetRef: target, targetVersion: String(card.expected_package_version), context, label: `批准 exact wave · ${card.wave_ref}`,
        risk: 'high', confirmation: 'confirm', expiresAt: new Date(Date.now() + 60_000).toISOString(),
        preview: { summary: `Approve exactly wave ${card.wave_ref} (plan ${card.plan_digest.slice(0, 16)}…, ${card.job_count} jobs, estimate ${card.estimate_status}).${card.estimate_status === 'unknown' ? ' The estimate is unbounded: confirming unknown_estimate is required and applies only to this exact wave.' : ''}${blockedSummary === '' ? '' : ` Out-of-scope blocked inputs stay outside: ${blockedSummary}.`}` },
        fields: [
          { key: 'wave_ref', label: 'Wave', kind: 'select', required: true, options: [{ value: card.wave_ref, label: card.wave_ref }] },
          ...(card.estimate_status === 'unknown' ? [{ key: 'confirm_unknown_estimate', label: '显式接受本 wave 的无界 estimate', kind: 'boolean' as const, required: true }] : []),
        ],
      }))
    }
    // reconcile：owner 恢复面（unknown job outcome），无幂等键、不盲重发。
    if (['reconcile_required', 'partially_succeeded'].includes(card.execution_state)) {
      descriptors.push(PaneActionDescriptorSchema.parse({
        schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'scaena', actionId: 'scaena.package.wave_reconcile',
        descriptorRef: digestRef(['scaena.package.wave_reconcile', target, card.wave_ref, card.execution_state]),
        targetRef: target, targetVersion: card.plan_digest, context, label: `对账 wave 未决结果 · ${card.wave_ref}`,
        risk: 'medium', confirmation: 'confirm', expiresAt: new Date(Date.now() + 60_000).toISOString(),
        preview: { summary: `Reconcile unknown visual job outcomes for wave ${card.wave_ref} from persisted job refs/keys, without creating replacement jobs or blind resubmission.` },
        fields: [{ key: 'wave_ref', label: 'Wave', kind: 'select', required: true, options: [{ value: card.wave_ref, label: card.wave_ref }] }],
      }))
    }
    // execute：只执行已批准的 exact wave。
    if (card.approved && card.execution_state === 'approved') {
      descriptors.push(PaneActionDescriptorSchema.parse({
        schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'scaena', actionId: 'scaena.package.wave_execute',
        descriptorRef: digestRef(['scaena.package.wave_execute', target, card.wave_ref, card.plan_digest]),
        targetRef: target, targetVersion: card.plan_digest, context, label: `执行已批准 wave · ${card.wave_ref}`,
        risk: 'high', confirmation: 'confirm', expiresAt: new Date(Date.now() + 60_000).toISOString(),
        preview: { summary: `Execute only the approved exact wave ${card.wave_ref} (${card.job_count} jobs, paid=${String(card.paid)}). Partial success keeps completed artifacts and receipts; closing the pane never cancels a dispatched wave.` },
        fields: [{ key: 'wave_ref', label: 'Wave', kind: 'select', required: true, options: [{ value: card.wave_ref, label: card.wave_ref }] }],
      }))
    }
  }
  return descriptors
}

export function waveDispatch(projection: ScaenaPackageProjection, request: PaneActionRequestV1, cwd: string): readonly string[] | undefined {
  const values = decodePaneActionValues(request)
  const ref = request.expectedTargetRef
  const key = request.idempotencyKey
  const waveCards = projection.wave_cards ?? []
  const cardOf = (waveRef: unknown) => typeof waveRef === 'string' ? waveCards.find(card => card.wave_ref === waveRef) : undefined

  switch (request.actionId) {
    case 'scaena.package.wave_plan': {
      const kind = values.wave_kind, candidates = values.candidates
      if (typeof kind !== 'string' || !(SCAENA_WAVE_KINDS as readonly string[]).includes(kind)) return undefined
      if (candidates !== undefined && (typeof candidates !== 'number' || !Number.isSafeInteger(candidates) || candidates < 1 || candidates > 8)) return undefined
      const args = ['storyboard', 'package', 'wave-plan', ref, '--project', cwd, '--wave-kind', kind,
        '--expected-version', request.expectedTargetVersion, '--idempotency-key', key]
      if (typeof candidates === 'number') args.push('--candidates', String(candidates))
      return args
    }
    case 'scaena.package.wave_approve': {
      const card = cardOf(values.wave_ref)
      if (card === undefined || card.approved) return undefined
      // 无界 estimate 必须显式确认；descriptor 侧已要求 boolean 字段。
      if (card.estimate_status === 'unknown' && values.confirm_unknown_estimate !== true) return undefined
      return ['storyboard', 'package', 'wave-approve', ref, '--project', cwd, '--wave', card.wave_ref,
        '--expected-version', request.expectedTargetVersion, '--idempotency-key', key, '--actor', 'user:operator', '--confirm',
        ...(card.estimate_status === 'unknown' ? ['--confirm-unknown-estimate'] : [])]
    }
    case 'scaena.package.wave_reconcile': {
      const card = cardOf(values.wave_ref)
      if (card === undefined || Object.keys(values).length !== 1) return undefined
      return ['storyboard', 'package', 'wave-reconcile', ref, '--project', cwd, '--wave', card.wave_ref]
    }
    case 'scaena.package.wave_execute': {
      const card = cardOf(values.wave_ref)
      // 未批准的 wave 绝不执行（owner 也会拒绝，这里先验）。
      if (card === undefined || !card.approved || Object.keys(values).length !== 1) return undefined
      return ['storyboard', 'package', 'execute', ref, '--project', cwd, '--wave', card.wave_ref]
    }
    default:
      return undefined
  }
}

/** wave-plan 成功响应的 data 是完整 GenerationWave；解析失败按无预览处理。 */
export function parseScaenaPlannedWave(value: unknown): ScaenaGenerationWave | undefined {
  const parsed = scaenaGenerationWaveSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export const scaenaWaveKindSchema = z.enum(SCAENA_WAVE_KINDS)

/**
 * Scaena 视觉候选审阅与采纳（dsh-scaena-production-studio-v1 §2.3）。
 *
 * 复用既有候选通道：候选比较在既有候选/媒体面完成（镜头表 pane 的选择
 * handoff、candidate 页），本模块只负责把「比较之后的采纳」翻成 owner
 * 动作——`visual-reviews`（人审决定：accept/reject/request_change）与
 * `visual-acceptances`（按 digest 采纳选定候选，`shot|digest|index|job`）。
 *
 * 三件事分别取得且交叉校验：owner receipt（receipt_ref）、版本
 * （graph_version，dispatch 用 expected graph version）、目标 scope
 * （scene_ref + selections 的 shot refs）。回显不一致 → unknown，不回填。
 * 候选 digest 是采纳的 CAS 输入：digest 与当前候选不符时 owner 拒绝，
 * 本地刷新保留草稿，绝不静默换成新版本候选。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import { PaneActionDescriptorSchema, PANE_ACTION_DESCRIPTOR_SCHEMA, decodePaneActionValues, type PaneActionDescriptorV1, type PaneActionRequestV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioContextV1 } from './types.ts'
import { scaenaDigestRef as digestRef, type ScaenaPackageProjection } from './scaena-package-contract.ts'

export const scaenaVisualAcceptanceActionIds = ['scaena.package.visual_review', 'scaena.package.visual_accept'] as const
export type ScaenaVisualAcceptanceActionId = (typeof scaenaVisualAcceptanceActionIds)[number]

const sha256Text = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const refText = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,200}$/u)

/** owner selection 线格式：shot_ref|digest|candidate_index[|job_ref]。 */
const selectionPattern = /^([A-Za-z0-9][A-Za-z0-9._:/-]{0,200})\|(sha256:[a-f0-9]{64})\|(\d{1,3})(?:\|([A-Za-z0-9][A-Za-z0-9._:/-]{0,200}))?$/u

/** 已进入执行态（含部分成功/待对账）的 wave 卡片才存在可审阅候选。 */
function reviewableWaves(projection: ScaenaPackageProjection) {
  return (projection.wave_cards ?? []).filter(card => ['succeeded', 'partially_succeeded', 'reconcile_required', 'running', 'dispatching'].includes(card.execution_state))
}

/** scenes 待视觉采纳：结构性已接受、视觉未接受且不 stale（owner 词表内状态）。 */
function visualPendingScenes(projection: ScaenaPackageProjection) {
  return (projection.scene_cards ?? []).filter(card => card.structural_accepted && !card.visual_accepted && !card.stale)
}

export function visualAcceptanceDescriptors(projection: ScaenaPackageProjection, context: CreatorStudioContextV1): PaneActionDescriptorV1[] {
  const allowed = new Set(projection.allowed_actions)
  const target = projection.package_ref
  const graphVersion = String(projection.graph_version)
  const descriptors: PaneActionDescriptorV1[] = []
  const waves = reviewableWaves(projection)

  for (const wave of waves.slice(0, 8)) {
    descriptors.push(PaneActionDescriptorSchema.parse({
      schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'scaena', actionId: 'scaena.package.visual_review',
      descriptorRef: digestRef(['scaena.package.visual_review', target, wave.plan_digest, wave.execution_state]),
      targetRef: target, targetVersion: graphVersion, context, label: `记录视觉审阅决定 · ${wave.wave_ref}`,
      risk: 'low', confirmation: 'confirm', expiresAt: new Date(Date.now() + 60_000).toISOString(),
      preview: { summary: `Record one human A/B or request-change decision for a candidate produced by wave ${wave.wave_ref}. request_change records the decision only; it never approves regeneration or widens the wave.` },
      fields: [
        { key: 'wave_ref', label: 'Wave', kind: 'select', required: true, options: [{ value: wave.wave_ref, label: wave.wave_ref }] },
        { key: 'job_ref', label: '视觉 job ref（来自 execute 回执/owner 投影）', kind: 'text', required: true, maxLength: 200 },
        { key: 'scene_ref', label: '场景 ref', kind: 'text', required: true, maxLength: 200 },
        { key: 'shot_ref', label: '镜头 ref', kind: 'text', required: true, maxLength: 200 },
        { key: 'decision', label: '决定', kind: 'select', required: true, options: [{ value: 'accept', label: 'accept' }, { value: 'reject', label: 'reject' }, { value: 'request_change', label: 'request_change' }] },
        { key: 'selected_index', label: '选定候选序号（0 起）', kind: 'number', required: false, min: 0, max: 7 },
        { key: 'selected_digest', label: '选定候选 digest', kind: 'text', required: false, placeholder: 'sha256:<64 hex>', maxLength: 71 },
      ],
    }))
  }

  if (allowed.has('visual_accept')) {
    for (const scene of visualPendingScenes(projection).slice(0, 16)) {
      descriptors.push(PaneActionDescriptorSchema.parse({
        schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'scaena', actionId: 'scaena.package.visual_accept',
        descriptorRef: digestRef(['scaena.package.visual_accept', target, projection.graph_version, scene.scene_ref]),
        targetRef: target, targetVersion: graphVersion, context, label: `采纳场景视觉候选 · ${scene.scene_ref}`,
        risk: 'medium', confirmation: 'confirm', expiresAt: new Date(Date.now() + 60_000).toISOString(),
        preview: { summary: `Adopt the reviewed candidates for scene ${scene.scene_ref} at graph version ${projection.graph_version}. Each selection pins shot ref + candidate digest + candidate index + job ref; the previous accepted visuals remain inspectable as history.` },
        fields: [
          { key: 'scene_ref', label: '场景', kind: 'select', required: true, options: [{ value: scene.scene_ref, label: `${scene.order + 1} · ${scene.scene_ref}` }] },
          { key: 'selections', label: '采纳行（每行 shot|digest|候选序号|job，空白分隔多镜头）', kind: 'textarea', required: true, maxLength: 8000 },
        ],
      }))
    }
  }
  return descriptors
}

export function visualAcceptanceDispatch(projection: ScaenaPackageProjection, request: PaneActionRequestV1, cwd: string): readonly string[] | undefined {
  const values = decodePaneActionValues(request)
  const ref = request.expectedTargetRef
  const key = request.idempotencyKey
  switch (request.actionId) {
    case 'scaena.package.visual_review': {
      const waveRef = values.wave_ref, jobRef = values.job_ref, scene = values.scene_ref, shot = values.shot_ref, decision = values.decision
      const selectedIndex = values.selected_index, selectedDigest = values.selected_digest
      // 只有进入执行态的 wave 存在可审阅候选；draft wave 的审阅不构造命令。
      if (typeof waveRef !== 'string' || !reviewableWaves(projection).some(card => card.wave_ref === waveRef)) return undefined
      if (typeof jobRef !== 'string' || !refText.safeParse(jobRef).success) return undefined
      if (typeof scene !== 'string' || !(projection.scene_cards ?? []).some(card => card.scene_ref === scene)) return undefined
      if (typeof shot !== 'string' || shot.length === 0) return undefined
      if (decision !== 'accept' && decision !== 'reject' && decision !== 'request_change') return undefined
      if (selectedIndex !== undefined && (typeof selectedIndex !== 'number' || !Number.isSafeInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 7)) return undefined
      if (selectedDigest !== undefined && !sha256Text.safeParse(selectedDigest).success) return undefined
      const args = ['storyboard', 'package', 'visual-review', ref, '--project', cwd, '--wave', waveRef, '--job', jobRef,
        '--scene', scene, '--shot', shot, '--decision', decision, '--idempotency-key', key, '--actor', 'user:operator', '--confirm']
      if (typeof selectedIndex === 'number') args.push('--selected-index', String(selectedIndex))
      if (typeof selectedDigest === 'string') args.push('--selected-digest', selectedDigest)
      return args
    }
    case 'scaena.package.visual_accept': {
      const scene = values.scene_ref, selections = values.selections
      if (typeof scene !== 'string' || !(projection.scene_cards ?? []).some(card => card.scene_ref === scene)) return undefined
      if (typeof selections !== 'string') return undefined
      const lines = selections.split(/\s+/u).filter(Boolean)
      if (lines.length === 0 || lines.length > 64) return undefined
      const parsed = lines.map(line => selectionPattern.exec(line))
      if (parsed.some(match => match === null)) return undefined
      const sceneShots = projection.scene_cards?.find(card => card.scene_ref === scene)?.shot_refs ?? []
      if (parsed.some(match => !sceneShots.includes(match![1]!))) return undefined
      const args = ['storyboard', 'package', 'visual-accept', ref, '--project', cwd, '--scene', scene,
        '--expected-version', request.expectedTargetVersion, '--idempotency-key', key, '--actor', 'user:operator', '--confirm']
      for (const match of parsed) args.push('--selections', `${match![1]!}|${match![2]!}|${match![3]!}${match![4] === undefined ? '' : `|${match![4]!}`}`)
      return args
    }
    default:
      return undefined
  }
}

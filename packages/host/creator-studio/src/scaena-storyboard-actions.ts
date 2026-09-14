/**
 * Scaena storyboard-package 动作族（dsh-scaena-production-studio-v1 §2.2）：
 * 动作发现/预览/确认的 host 侧消费面。
 *
 * 动作门由 owner 投影的 `allowed_actions` 唯一决定（owner
 * reviewpackage.allowedActions）；DSH 只把 owner 允许的动作翻成
 * PaneActionDescriptor，不发明动作、不把 disabled 动作画成可用。所有
 * mutation 携带 expected version（package/graph 按 owner 合同区分）与
 * `--idempotency-key`；dispatch 前重读投影复核 descriptor（CAS），
 * owner 返回 SCN_GRAPH_VERSION_CONFLICT 等 stale 码时映射为
 * reconcile_required——刷新由 owner 投影承担，本地不覆盖、不重试。
 *
 * 对账（reconcile）：owner durable replay 合同保证同 key 同请求返回原
 * 回执、不产生第二次副作用；本层维护有界内存飞行表（≤32）保存逐字节
 * 原命令，仅显式 reconcile 路径回放；重启后无法重建 → 诚实 unknown。
 * 无 CLI 幂等键的动词同样安全回放：recommend 按包状态确定性重推导（本地
 * 图分析、non-binding）；execute/wave-reconcile 由 owner durable job
 * key/已持久化 job link 保证重放不重复 submit、不创建替代 job。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PaneActionDescriptorSchema, PANE_ACTION_DESCRIPTOR_SCHEMA, decodePaneActionValues, type PaneActionDescriptorV1, type PaneActionReceiptV1, type PaneActionRequestV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from './types.ts'
import { scaenaPackageProjectionSchema, scaenaDigestRef as digestRef, type ScaenaPackageProjection, type ScaenaInvoke } from './scaena-package-contract.ts'
import { scaenaCliEnvelopeSchema, SCAENA_STALE_ERROR_CODES, type ScaenaCliEnvelope } from './scaena-production-contract.ts'
import { scaenaVisualAcceptanceActionIds, visualAcceptanceDescriptors, visualAcceptanceDispatch } from './scaena-visual-acceptance.ts'
import { scaenaWaveActionIds, waveDescriptors, waveDispatch } from './scaena-wave-preview.ts'

const sha256Text = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const refText = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,200}$/u)
/** safeParse 不做输入收窄，用显式 type guard 让 CLI 参数拿到 string。 */
const isDigest = (value: unknown): value is string => typeof value === 'string' && sha256Text.safeParse(value).success
const isRefText = (value: unknown): value is string => typeof value === 'string' && refText.safeParse(value).success

/** §2.2 基础动作族（visual/wave 动作在各自模块声明）。 */
export const scaenaStoryboardBaseActionIds = [
  'scaena.package.recommend', 'scaena.package.confirm_recommendation',
  'scaena.package.scene_accept', 'scaena.package.scene_revalidate',
  'scaena.package.creative_confirm', 'scaena.package.complete',
] as const
export const scaenaStoryboardActionIds = [...scaenaStoryboardBaseActionIds, ...scaenaVisualAcceptanceActionIds, ...scaenaWaveActionIds] as const
export type ScaenaStoryboardActionId = (typeof scaenaStoryboardActionIds)[number]

/** 读 owner canonical review-package 投影；身份不符 → undefined（不猜 wire）。 */
export async function readScaenaPackageProjection(invoke: ScaenaInvoke, cwd: string, packageRef: string): Promise<ScaenaPackageProjection | undefined> {
  const raw = z.object({ data: scaenaPackageProjectionSchema }).safeParse(await invoke(['storyboard', 'package', 'show', packageRef, '--project', cwd, '--view', 'detail']))
  if (!raw.success || raw.data.data.package_ref !== packageRef) return undefined
  return raw.data.data
}

export type ScaenaMutationOutcome =
  | { readonly kind: 'ok'; readonly envelope: ScaenaCliEnvelope }
  | { readonly kind: 'rejected'; readonly envelope: ScaenaCliEnvelope }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'contract_mismatch' }

/** mutation envelope 分类：error 码在 → owner 拒绝；解析失败 → 合同不匹配。 */
export async function invokeScaenaMutation(invoke: ScaenaInvoke, args: readonly string[], timeout = 120_000): Promise<ScaenaMutationOutcome> {
  let raw: unknown
  try { raw = await invoke(args, timeout) } catch { return { kind: 'unavailable' } }
  const parsed = scaenaCliEnvelopeSchema.safeParse(raw)
  if (!parsed.success) return { kind: 'contract_mismatch' }
  return parsed.data.error !== undefined && parsed.data.error.code.length > 0 ? { kind: 'rejected', envelope: parsed.data } : { kind: 'ok', envelope: parsed.data }
}

/** owner stale/CAS 冲突码 → reconcile_required（刷新不覆盖，绝不重试）。 */
export function scaenaUnconfirmedReceipt(actionId: string, idempotencyKey: string, reason: string): PaneActionReceiptV1 {
  const stale = SCAENA_STALE_ERROR_CODES.has(reason)
  const identity = createHash('sha256').update(JSON.stringify([actionId, idempotencyKey])).digest('hex').slice(0, 40)
  return {
    owner: 'scaena', actionId,
    // stale 冲突可由 owner 投影解释（刷新后重取 descriptor）；其余 unknown 保持对账。
    status: stale ? 'reconcile_required' : 'unknown',
    receiptRef: `scaena:action:unconfirmed:${identity}`,
    summary: stale
      ? `Scaena rejected the action as stale (${reason}). The pane refreshes the owner projection and keeps the draft; it never overwrites the newer version.`
      : 'The original Scaena operation is unconfirmed. Reconcile it through the owner before another edit.',
    ...(stale ? { reconcileReason: reason } : {}),
  }
}

/** 有界飞行表：记录每次提交的逐字节命令，供显式 reconcile 幂等回放。 */
export class ScaenaFlightMemory {
  private readonly flights = new Map<string, readonly string[]>()
  private readonly order: string[] = []
  remember(key: string, args: readonly string[]): void {
    if (this.flights.size >= 32 && this.order.length > 0) this.flights.delete(this.order.shift()!)
    this.order.push(key)
    this.flights.set(key, args)
  }
  recall(key: string): readonly string[] | undefined { return this.flights.get(key) }
}

const factString = (envelope: ScaenaCliEnvelope, key: string): string | undefined => {
  const value = envelope.facts?.[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
const factVersion = (envelope: ScaenaCliEnvelope, key: string): number | undefined => {
  const value = envelope.facts?.[key]
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
}

/** 成功回执按 owner facts 组装；receipt/evidence/版本只取 owner 回显，不本地合成状态。 */
function baseActionReceipt(actionId: string, envelope: ScaenaCliEnvelope, receiptRef: string, summary: string): PaneActionReceiptV1 {
  return { owner: 'scaena', actionId, status: 'completed', receiptRef, summary, evidenceRefs: [...(envelope.evidence ?? [])] }
}

export function scaenaStoryboardReceipt(actionId: ScaenaStoryboardActionId | string, envelope: ScaenaCliEnvelope): PaneActionReceiptV1 {
  const packageRef = factString(envelope, 'package_ref') ?? factString(envelope, 'wave_ref') ?? 'scaena:package:unknown'
  switch (actionId) {
    case 'scaena.package.recommend': {
      const ref = factString(envelope, 'recommendation_ref')
      return ref === undefined
        ? { owner: 'scaena', actionId, status: 'unknown', receiptRef: `scaena:recommend:${packageRef}`, summary: 'Scaena did not echo a recommendation ref; treat the recommendation as unconfirmed.' }
        : baseActionReceipt(actionId, envelope, ref, `Non-binding recommendation recorded (${factString(envelope, 'recommended_depth') ?? 'depth unset'}). Confirmation stays a separate owner action.`)
    }
    case 'scaena.package.confirm_recommendation': {
      const ref = factString(envelope, 'confirmation_ref')
      return ref === undefined
        ? { owner: 'scaena', actionId, status: 'unknown', receiptRef: `scaena:confirm:${packageRef}`, summary: 'Scaena did not echo a confirmation ref.' }
        : baseActionReceipt(actionId, envelope, ref, `Recommendation confirmed at depth ${factString(envelope, 'chosen_depth') ?? 'unknown'}; the recommendation remains advisory, not a quota.`)
    }
    case 'scaena.package.scene_accept':
    case 'scaena.package.scene_revalidate': {
      const ref = factString(envelope, 'acceptance_receipt_ref')
      const graphVersion = factVersion(envelope, 'graph_version')
      return ref === undefined || graphVersion === undefined
        ? { owner: 'scaena', actionId, status: 'unknown', receiptRef: `scaena:scene:${packageRef}`, summary: 'Scaena did not echo the acceptance receipt and graph version.' }
        : baseActionReceipt(actionId, envelope, ref, `Scene acceptance composed into graph version ${graphVersion}${factString(envelope, 'composition_receipt_ref') === undefined ? '' : ` (composition ${factString(envelope, 'composition_receipt_ref')})`}. The previous candidate remains inspectable.`)
    }
    case 'scaena.package.creative_confirm': {
      const ref = envelope.evidence?.[0]
      return ref === undefined
        ? { owner: 'scaena', actionId, status: 'unknown', receiptRef: `scaena:creative:${packageRef}`, summary: 'Scaena did not echo the creative contract confirmation ref.' }
        : baseActionReceipt(actionId, envelope, ref, 'Five-field creative contract confirmed for future paid waves; paid dispatch stays unauthorized until a wave is approved.')
    }
    case 'scaena.package.complete': {
      const graphVersion = factVersion(envelope, 'graph_version')
      const packageVersion = factVersion(envelope, 'package_version')
      return packageVersion === undefined
        ? { owner: 'scaena', actionId, status: 'unknown', receiptRef: `scaena:complete:${packageRef}`, summary: 'Scaena did not echo the completed package version.' }
        : baseActionReceipt(actionId, envelope, packageRef, `Episode completion recorded at package version ${packageVersion}${graphVersion === undefined ? '' : `, graph ${graphVersion}`}. Run success, production acceptance and delivery remain separate owner states.`)
    }
    default:
      return { owner: 'scaena', actionId, status: 'unknown', receiptRef: `scaena:action:${packageRef}`, summary: 'Unsupported storyboard action receipt.' }
  }
}

function descriptor(input: {
  actionId: ScaenaStoryboardActionId, label: string, context: CreatorStudioContextV1, targetRef: string, targetVersion: string, descriptorParts: readonly unknown[],
  preview: string, fields: PaneActionDescriptorV1['fields'], risk?: 'low' | 'medium' | 'high', presentation?: PaneActionDescriptorV1['presentation'],
}): PaneActionDescriptorV1 {
  return PaneActionDescriptorSchema.parse({
    schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'scaena', actionId: input.actionId,
    descriptorRef: digestRef([input.actionId, input.targetRef, input.targetVersion, ...input.descriptorParts]),
    targetRef: input.targetRef, targetVersion: input.targetVersion, context: input.context, label: input.label,
    risk: input.risk ?? 'medium', confirmation: 'confirm', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    preview: { summary: input.preview }, fields: input.fields, ...(input.presentation === undefined ? {} : { presentation: input.presentation }),
  })
}

const sha256Field = (key: string, label: string) => ({ key, label, kind: 'text' as const, required: true, placeholder: 'sha256:<64 hex>', maxLength: 71 })

/** §2.2 描述符族：allowed_actions 门控 + scene 卡片选择面。 */
export function scaenaStoryboardBaseDescriptors(projection: ScaenaPackageProjection, context: CreatorStudioContextV1): PaneActionDescriptorV1[] {
  const allowed = new Set(projection.allowed_actions)
  const target = projection.package_ref
  const packageVersion = String(projection.package_version)
  const graphVersion = String(projection.graph_version)
  const sceneOptions = (projection.scene_cards ?? []).map(card => ({ value: card.scene_ref, label: `${card.order + 1} · ${card.scene_ref}` }))
  const staleScenes = (projection.scene_cards ?? []).filter(card => card.stale)
  const descriptors: PaneActionDescriptorV1[] = []
  const include = (value: PaneActionDescriptorV1) => { descriptors.push(value) }

  if (allowed.has('recommend')) include(descriptor({
    actionId: 'scaena.package.recommend', label: '生成制作深度建议（非约束）', context, targetRef: target, targetVersion: packageVersion,
    descriptorParts: [projection.state], risk: 'low', fields: [],
    preview: 'Derive the owner non-binding production-depth recommendation. Recommendation and confirmation stay separate receipts; no quota is created.',
  }))
  if (allowed.has('confirm_recommendation')) include(descriptor({
    actionId: 'scaena.package.confirm_recommendation', label: '确认制作深度建议', context, targetRef: target, targetVersion: packageVersion,
    descriptorParts: [projection.recommendation_ref ?? 'none', projection.package_version],
    fields: [
      { key: 'depth', label: '深度', kind: 'select', required: false, options: [{ value: 'lean', label: 'lean' }, { value: 'balanced', label: 'balanced' }, { value: 'cinematic', label: 'cinematic' }], placeholder: '留空沿用 owner 建议' },
      { key: 'scenes', label: '核心场景 refs（留空沿用 owner 建议；空白分隔）', kind: 'textarea', required: false, maxLength: 4000 },
    ],
    preview: 'Confirm or override the current recommendation with expected package version. Overrides are recorded on the confirmation receipt, not on the recommendation.',
  }))
  if (allowed.has('accept_scene') && sceneOptions.length > 0) {
    for (const revalidate of [false, true]) {
      // revalidate 是 stale 场景的 owner 恢复面：只在存在 stale scene 时发布。
      if (revalidate && staleScenes.length === 0) continue
      include(descriptor({
        actionId: revalidate ? 'scaena.package.scene_revalidate' : 'scaena.package.scene_accept',
        label: revalidate ? '重验并替换 stale 场景切片' : '接受并合成场景切片', context, targetRef: target, targetVersion: graphVersion,
        descriptorParts: [projection.graph_version, revalidate],
        fields: [
          { key: 'scene', label: '场景', kind: 'select', required: true, options: revalidate ? staleScenes.map(card => ({ value: card.scene_ref, label: `${card.order + 1} · ${card.scene_ref}` })) : sceneOptions },
          { key: 'shots', label: '接受的镜头 refs（空白分隔，须属于该场景）', kind: 'textarea', required: true, maxLength: 4000 },
          { key: 'candidate_ref', label: '候选修订 ref', kind: 'text', required: true, maxLength: 200 },
          sha256Field('candidate_digest', '候选内容 digest'),
          sha256Field('duration_digest', '时长合同 digest'),
          sha256Field('dialogue_digest', '对白锚点 digest'),
        ],
        preview: `Accept one scene slice with candidate/duration/dialogue digests at graph version ${projection.graph_version}. The accepted candidate is composed into the episode graph; prior candidates remain inspectable in the owner.`,
      }))
    }
  }
  if (allowed.has('confirm_creative_contract')) include(descriptor({
    actionId: 'scaena.package.creative_confirm', label: '确认五项付费创作基础合同', context, targetRef: target, targetVersion: packageVersion,
    descriptorParts: [projection.package_version],
    fields: [sha256Field('story_spine_digest', '故事脊柱 digest'), sha256Field('shot_beats_digest', '逐镜头节拍 digest'),
      sha256Field('dialogue_backbone_digest', '对白主干 digest'), sha256Field('visual_tone_digest', '视觉基调 digest'), sha256Field('duration_contract_digest', '时长合同 digest')],
    preview: 'Record the five human-confirmed creative foundation digests. This authorizes wave planning only; every paid wave is still approved separately.',
  }))
  if (allowed.has('complete_episode')) include(descriptor({
    actionId: 'scaena.package.complete', label: '显式完成整集', context, targetRef: target, targetVersion: packageVersion,
    descriptorParts: [projection.package_version, projection.state],
    fields: [],
    preview: 'Mark the accepted episode graph complete at the expected package version. Completion does not export, deliver, or change production acceptance.',
  }))
  return descriptors
}

const sceneCardShots = (projection: ScaenaPackageProjection, sceneRef: string): readonly string[] =>
  projection.scene_cards?.find(card => card.scene_ref === sceneRef)?.shot_refs ?? []

/** §2.2 dispatch 值校验 + 固定 CLI 参数（动词白名单，绝不拼接用户命令文本）。 */
export function scaenaStoryboardBaseDispatch(projection: ScaenaPackageProjection, request: PaneActionRequestV1, cwd: string): readonly string[] | undefined {
  const values = decodePaneActionValues(request)
  const ref = request.expectedTargetRef
  const key = request.idempotencyKey
  const actor = ['--actor', 'user:operator']
  switch (request.actionId) {
    case 'scaena.package.recommend':
      if (Object.keys(values).length !== 0) return undefined
      return ['storyboard', 'package', 'recommend', ref, '--project', cwd]
    case 'scaena.package.confirm_recommendation': {
      const depth = values.depth, scenes = values.scenes
      if (depth !== undefined && (typeof depth !== 'string' || !['lean', 'balanced', 'cinematic'].includes(depth))) return undefined
      if (scenes !== undefined && typeof scenes !== 'string') return undefined
      const args = ['storyboard', 'package', 'confirm', ref, '--project', cwd, '--expected-version', request.expectedTargetVersion, '--idempotency-key', key, ...actor, '--confirm']
      if (typeof depth === 'string') args.push('--depth', depth)
      if (typeof scenes === 'string' && scenes.trim().length > 0) {
        const refs = scenes.split(/\s+/u).filter(Boolean)
        if (refs.some(item => !refText.safeParse(item).success)) return undefined
        args.push('--scenes', refs.join(','))
      }
      return args
    }
    case 'scaena.package.scene_accept':
    case 'scaena.package.scene_revalidate': {
      const scene = values.scene, shots = values.shots, candidateRef = values.candidate_ref
      const candidateDigest = values.candidate_digest, durationDigest = values.duration_digest, dialogueDigest = values.dialogue_digest
      if (typeof scene !== 'string' || sceneCardShots(projection, scene).length === 0) return undefined
      if (typeof shots !== 'string') return undefined
      const shotRefs = shots.split(/\s+/u).filter(Boolean)
      const expected = sceneCardShots(projection, scene)
      if (shotRefs.length === 0 || shotRefs.some(item => !expected.includes(item))) return undefined
      if (!isRefText(candidateRef)) return undefined
      if (!isDigest(candidateDigest) || !isDigest(durationDigest) || !isDigest(dialogueDigest)) return undefined
      return ['storyboard', 'package', request.actionId === 'scaena.package.scene_accept' ? 'scene-accept' : 'scene-revalidate', ref, '--project', cwd,
        '--scene', scene, '--shots', shotRefs.join(','), '--candidate-ref', candidateRef, '--candidate-digest', candidateDigest,
        '--duration-digest', durationDigest, '--dialogue-digest', dialogueDigest,
        '--expected-version', request.expectedTargetVersion, '--idempotency-key', key, ...actor, '--confirm']
    }
    case 'scaena.package.creative_confirm': {
      const digests = [values.story_spine_digest, values.shot_beats_digest, values.dialogue_backbone_digest, values.visual_tone_digest, values.duration_contract_digest]
      if (digests.some(value => !sha256Text.safeParse(value).success)) return undefined
      return ['storyboard', 'package', 'creative-confirm', ref, '--project', cwd,
        '--story-spine-digest', String(digests[0]), '--shot-beats-digest', String(digests[1]), '--dialogue-backbone-digest', String(digests[2]),
        '--visual-tone-digest', String(digests[3]), '--duration-contract-digest', String(digests[4]),
        '--expected-version', request.expectedTargetVersion, '--idempotency-key', key, ...actor, '--confirm']
    }
    case 'scaena.package.complete':
      if (Object.keys(values).length !== 0) return undefined
      return ['storyboard', 'package', 'complete', ref, '--project', cwd, '--expected-version', request.expectedTargetVersion, '--idempotency-key', key, ...actor, '--confirm']
    default:
      return undefined
  }
}

/** 全动作族描述符（含 §2.3/§2.4 模块），一次投影读取派生。 */
export function scaenaStoryboardDescriptors(projection: ScaenaPackageProjection, context: CreatorStudioContextV1): PaneActionDescriptorV1[] {
  return [...scaenaStoryboardBaseDescriptors(projection, context), ...visualAcceptanceDescriptors(projection, context), ...waveDescriptors(projection, context)]
}

/** 全动作族 dispatch 参数构造；未知动作返回 undefined 交回 base 链。 */
export function scaenaStoryboardDispatchArgs(projection: ScaenaPackageProjection, request: PaneActionRequestV1, cwd: string): readonly string[] | undefined {
  return scaenaStoryboardBaseDispatch(projection, request, cwd)
    ?? visualAcceptanceDispatch(projection, request, cwd)
    ?? waveDispatch(projection, request, cwd)
}

/**
 * §2.2–§2.4 组合 wrapper：挂在 withLocalScaenaPackage 之上、withLocalScaenaTable
 * 之下——包选择由下层验证并选中，本层镜像记录以驱动快照动作发现与
 * dispatch/reconcile 的 scope fence。快照只追加 owner 允许的动作描述符；
 * 导出动作仍由 withLocalScaenaPackage 拥有，此处不重复实现。
 */
export function withLocalScaenaStoryboardActions(base: CreatorOwnerAdapterV1, invoke: ScaenaInvoke, cwd: string): CreatorOwnerAdapterV1 {
  let selected: { ref: string; scope: string } | undefined
  let selectionEpoch = 0
  const flights = new ScaenaFlightMemory()
  const scoped = (context: CreatorStudioContextV1) => JSON.stringify(context)
  const actionOwned = (actionId: string): actionId is ScaenaStoryboardActionId => (scaenaStoryboardActionIds as readonly string[]).includes(actionId)

  return {
    ...base,
    async selectScaenaPackage(input, context) {
      // base（withLocalScaenaPackage）负责验证并选中包；这里只镜像记录选择，
      // 供快照动作发现与 dispatch/reconcile 的 scope fence 使用。
      const result = await base.selectScaenaPackage?.(input, context)
      const epoch = ++selectionEpoch
      if (result?.status === 'ready') selected = { ref: input.packageRef, scope: scoped(context) }
      else if (epoch === selectionEpoch) selected = undefined
      return result ?? { status: 'unavailable' }
    },
    async snapshot(context) {
      const snapshot = await base.snapshot(context)
      const selection = selected
      // 未选中包或 scope 漂移：保持 base 快照（诚实降级，不伪造动作）。
      if (selection === undefined || selection.scope !== scoped(context)) return snapshot
      try {
        const projection = await readScaenaPackageProjection(invoke, cwd, selection.ref)
        if (selected !== selection || projection === undefined) return snapshot
        const discovered = scaenaStoryboardDescriptors(projection, context)
        // 附加在 base 动作之后：导出/镜头表动作优先级不变。
        return { ...snapshot, actions: [...snapshot.actions, ...discovered] }
      } catch {
        // 一次动作发现失败不拖垮整个快照；动作入口缺席即诚实禁用。
        return snapshot
      }
    },
    async dispatch(request, context) {
      if (!actionOwned(request.actionId)) return base.dispatch(request, context)
      const selection = selected
      if (selection === undefined || selection.ref !== request.expectedTargetRef || selection.scope !== scoped(context)) return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'selection_mismatch')
      try {
        // CAS：重读投影，descriptor 必须仍由 owner 当前状态派生且版本一致。
        const projection = await readScaenaPackageProjection(invoke, cwd, selection.ref)
        if (projection === undefined || selected !== selection) return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'owner_projection_unavailable')
        const fresh = scaenaStoryboardDescriptors(projection, context).find(item => item.descriptorRef === request.descriptorRef && item.targetVersion === request.expectedTargetVersion && item.targetRef === request.expectedTargetRef)
        if (fresh === undefined) return { ...scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'descriptor_stale'), status: 'reconcile_required' }
        const args = scaenaStoryboardDispatchArgs(projection, request, cwd)
        if (args === undefined) return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'invalid_input')
        flights.remember(request.idempotencyKey, args)
        const outcome = await invokeScaenaMutation(invoke, args)
        if (outcome.kind === 'unavailable') return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'cli_unavailable')
        if (outcome.kind === 'contract_mismatch') return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'contract_mismatch')
        if (outcome.kind === 'rejected') {
          const code = outcome.envelope.error?.code ?? 'UNKNOWN'
          return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, code)
        }
        if (scaenaVisualAcceptanceActionIds.includes(request.actionId as never) || scaenaWaveActionIds.includes(request.actionId as never)) {
          return waveOrVisualReceipt(request.actionId, outcome.envelope)
        }
        return scaenaStoryboardReceipt(request.actionId, outcome.envelope)
      } catch {
        return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'dispatch_failed')
      }
    },
    async reconcile(request, context) {
      if (!actionOwned(request.actionId)) return base.reconcile?.(request, context) ?? scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'reconcile_unavailable')
      if (request.expectedTargetRef !== selected?.ref || selected.scope !== scoped(context)) return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'selection_mismatch')
      // 幂等回放需要逐字节原命令：内存飞行表缺席（如重启）→ unknown，不猜输入。
      const remembered = flights.recall(request.idempotencyKey)
      if (remembered === undefined) return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'original_request_not_remembered')
      const outcome = await invokeScaenaMutation(invoke, remembered)
      if (outcome.kind === 'unavailable' || outcome.kind === 'contract_mismatch') return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, 'reconcile_unavailable')
      if (outcome.kind === 'rejected') return scaenaUnconfirmedReceipt(request.actionId, request.idempotencyKey, outcome.envelope.error?.code ?? 'UNKNOWN')
      if (scaenaVisualAcceptanceActionIds.includes(request.actionId as never) || scaenaWaveActionIds.includes(request.actionId as never)) return waveOrVisualReceipt(request.actionId, outcome.envelope)
      return scaenaStoryboardReceipt(request.actionId, outcome.envelope)
    },
  }
}

/** §2.3/§2.4 回执（execute/visual 的 partial/pending 语义在各自模块定义）。 */
function waveOrVisualReceipt(actionId: string, envelope: ScaenaCliEnvelope): PaneActionReceiptV1 {
  if (actionId === 'scaena.package.visual_review') return scaenaVisualReviewReceipt(envelope)
  if (actionId === 'scaena.package.visual_accept') return scaenaVisualAcceptReceipt(envelope)
  return scaenaWaveReceipt(actionId, envelope)
}

/** visual-review 成功回执：回执 ref 由 owner 事实（wave/job/shot/decision）组成。 */
function scaenaVisualReviewReceipt(envelope: ScaenaCliEnvelope): PaneActionReceiptV1 {
  const waveRef = factString(envelope, 'wave_ref'), jobRef = factString(envelope, 'job_ref'), shotRef = factString(envelope, 'shot_ref'), decision = factString(envelope, 'decision')
  if (waveRef === undefined || jobRef === undefined || shotRef === undefined || decision === undefined) {
    return { owner: 'scaena', actionId: 'scaena.package.visual_review', status: 'unknown', receiptRef: 'scaena:visual-review:unconfirmed', summary: 'Scaena did not echo the visual review identity.' }
  }
  return { owner: 'scaena', actionId: 'scaena.package.visual_review', status: 'completed',
    receiptRef: `scaena:visual-review:${waveRef}:${jobRef}:${shotRef}:${decision}`,
    summary: `Visual review decision ${decision} recorded for ${shotRef}. request_change records the decision only; regenerating requires a new approved wave.`,
    evidenceRefs: [...(envelope.evidence ?? [])] }
}

/** visual-accept 成功回执：receipt=owner receipt ref；版本=graph 版本；scope=scene。 */
function scaenaVisualAcceptReceipt(envelope: ScaenaCliEnvelope): PaneActionReceiptV1 {
  const receiptRef = factString(envelope, 'receipt_ref'), sceneRef = factString(envelope, 'scene_ref'), graphVersion = factVersion(envelope, 'graph_version')
  if (receiptRef === undefined || sceneRef === undefined || graphVersion === undefined) {
    return { owner: 'scaena', actionId: 'scaena.package.visual_accept', status: 'unknown', receiptRef: 'scaena:visual-accept:unconfirmed', summary: 'Scaena did not echo the visual acceptance receipt, scene scope and graph version.' }
  }
  return { owner: 'scaena', actionId: 'scaena.package.visual_accept', status: 'completed', receiptRef,
    summary: `Scene visuals accepted for ${sceneRef} at graph version ${graphVersion}. Eikona review stays separate from Scaena visual acceptance.`,
    evidenceRefs: [...(envelope.evidence ?? [])] }
}

/** wave 族回执：execution_state 映射 owner 终态；partial 保留已完成成果。 */
function scaenaWaveReceipt(actionId: string, envelope: ScaenaCliEnvelope): PaneActionReceiptV1 {
  const waveRef = factString(envelope, 'wave_ref')
  if (waveRef === undefined) return { owner: 'scaena', actionId, status: 'unknown', receiptRef: 'scaena:wave:unconfirmed', summary: 'Scaena did not echo the wave ref.' }
  const state = factString(envelope, 'execution_state') ?? ''
  const status: PaneActionReceiptV1['status'] = actionId === 'scaena.package.wave_execute'
    ? state === 'succeeded' ? 'completed'
      : state === 'partially_succeeded' ? 'partial'
        : state === 'failed' ? 'failed'
          : state === 'reconcile_required' ? 'reconcile_required'
            : state === 'terminal_manual_decision' ? 'approval_required'
              : state === 'dispatching' || state === 'running' ? 'pending' : 'unknown'
    : 'completed'
  const jobCount = typeof envelope.facts?.job_count === 'number' ? envelope.facts.job_count : undefined
  const summary = actionId === 'scaena.package.wave_execute'
    ? `Wave execution state ${state}${jobCount === undefined ? '' : ` (${jobCount} jobs)`}. ${state === 'partially_succeeded' ? 'Completed artifacts and receipts stay visible; only explicitly repairable parts are offered for retry.' : 'Execution consumes only the approved exact wave; scope is never widened.'}`
    : actionId === 'scaena.package.wave_approve'
      ? `Exact wave plan approved (${factString(envelope, 'plan_digest') === undefined ? 'plan digest not echoed' : `plan ${factString(envelope, 'plan_digest')}`}); only this wave may execute.`
      : `Unknown visual job outcomes reconciled without blind resubmission (state ${state}).`
  return { owner: 'scaena', actionId, status, receiptRef: waveRef, summary, evidenceRefs: [...(envelope.evidence ?? [])],
    ...(status === 'reconcile_required' ? { reconcileReason: 'SCN_VISUAL_JOB_RECONCILE_REQUIRED' } : {}) }
}

export { factString as scaenaEnvelopeFactString }

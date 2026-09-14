import { createHash } from 'node:crypto'
import { PANE_ACTION_DESCRIPTOR_SCHEMA, PANE_ARTIFACT_SCHEMA, PaneActionRequestSchema, PaneActionReconcileRequestSchema,
  type PaneActionDescriptorV1, type PaneActionReceiptV1, type PaneContextV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorOwnerAdapterV1, CreatorOwnerSnapshotV1, CreatorStudioContextV1 } from './types.ts'
import { SonoraSubtitleExportClient, type SonoraSubtitleExportResult, type SonoraSubtitleTrackPreview } from './sonora-subtitle-export.ts'
import { SonoraWorksTableClient } from './sonora-works-table.ts'
import { SonoraWorkspaceClient, type SonoraWorkspaceActionDescriptor, type SonoraWorkspaceActionReceipt, type SonoraWorkspaceBoard, type SonoraWorkspaceResult } from './sonora-workspace.ts'
import { SonoraCapabilityMatrixClient } from './sonora-capability-matrix.ts'
import { SonoraAuditionClient, sonoraAudioMediaType, type SonoraAudioAsset } from './sonora-audition.ts'
import { SonoraSubtitleHandoffClient, type SonoraSubtitleHandoffResult } from './sonora-subtitle-handoff.ts'

const actionId = 'subtitle.export'
const handoffActionId = 'subtitle.handoff'
const handoffConsumer = 'scaena'
const contextKeys = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const
function sameContext(a: PaneContextV1, b: CreatorStudioContextV1): boolean { return contextKeys.every(key => a[key] === b[key]) }
function descriptorRef(track: SonoraSubtitleTrackPreview): string { return `sonora:subtitle.export:${track.track_digest}:${track.review_digest}` }
function handoffDescriptorRef(track: SonoraSubtitleTrackPreview): string { return `sonora:subtitle.handoff:${track.track_digest}:${track.review_digest}` }
function exportable(track: SonoraSubtitleTrackPreview): boolean { return track.readability_status === 'ok' && track.decision_code === 'approved' && track.cue_count > 0 }

/** §2.3–§2.5 optional faces; each absent face degrades honestly (no fake actions). */
export interface SonoraAudioStudioExtras {
  /** workspace board/action client（§2.3 动作发现/确认）。 */
  readonly workspace?: SonoraWorkspaceClient
  /** provider 能力矩阵 client（§2.2）。 */
  readonly matrix?: SonoraCapabilityMatrixClient
  /** 试听/授权 rendition client（§2.4）。 */
  readonly audition?: SonoraAuditionClient
  /** 字幕交接 client（§2.5）。 */
  readonly handoff?: SonoraSubtitleHandoffClient
  /** Host 项目引用：当前选中的 audio job id（board/action/artifact 来源）。 */
  readonly selectedJob?: (context: CreatorStudioContextV1) => Promise<string | undefined>
}

/** Owner workspace action descriptor → Pane descriptor（权限/费用状态原样呈现）。 */
function workspaceActionDescriptor(board: SonoraWorkspaceBoard, action: SonoraWorkspaceActionDescriptor, context: CreatorStudioContextV1): PaneActionDescriptorV1 | undefined {
  // owner availability!=enabled（blocked/read_only）或 freshness 非 fresh 时
  // 不发布可执行 descriptor；blockers 经资源卡呈现，禁用入口保留原因。
  if (action.availability !== 'enabled' || board.freshness.state !== 'fresh') return undefined
  const expiresAt = Date.parse(board.freshness.expires_at)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + 1_000) return undefined
  const label = action.action_type === 'cancel_job' ? 'Request job cancellation (owner confirmed)'
    : action.action_type === 'request_review' ? 'Request owner review' : `Owner action ${action.action_type}`
  const scopes = (action.permission.required_scopes ?? []).join(', ') || 'undeclared'
  return { schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'sonora', actionId: action.action_id,
    descriptorRef: `sonora:workspace-action:${action.action_id}:${action.target_ref}:${action.expected_revision}`,
    targetRef: action.target_ref, targetVersion: action.expected_revision, context: { ...context }, label,
    risk: action.action_type === 'cancel_job' ? 'medium' : 'low',
    confirmation: action.confirmation.required ? 'confirm' : 'none',
    expiresAt: new Date(expiresAt).toISOString(),
    // owner descriptor 不携带费用：不合成零价，预览明确“无报价”。
    preview: { summary: `Sonora workspace action ${action.action_type}. Permission ${action.permission.state}; scopes ${scopes}. The owner descriptor quotes no cost; no price is assumed.${action.confirmation.reason_code === undefined ? '' : ` Confirmation reason: ${action.confirmation.reason_code}.`}` },
    fields: [] }
}

function workspaceReceipt(actionIdFromOwner: string, result: SonoraWorkspaceResult<SonoraWorkspaceActionReceipt>, idempotencyKey: string): PaneActionReceiptV1 {
  if (result.status === 'ready') {
    const receipt = result.resource
    const findings = (receipt.findings ?? []).join(', ')
    // 取消/执行结果以 owner outcome 为准：accepted=完成，rejected=拒绝，
    // pending=owner 已受理未终态；绝不在本地标记 cancelled。
    const status = receipt.outcome === 'accepted' ? 'completed' : receipt.outcome === 'rejected' ? 'rejected' : 'pending'
    return { owner: 'sonora', actionId: actionIdFromOwner, status, receiptRef: receipt.receipt_ref,
      summary: `Sonora confirmed the workspace action as ${receipt.outcome}${findings === '' ? '' : `; findings: ${findings}`}. Retry classification ${receipt.retry_classification}.`,
      outputArtifacts: [] }
  }
  const identity = createHash('sha256').update(JSON.stringify([actionIdFromOwner, idempotencyKey])).digest('hex')
  // 409 幂等冲突 = 原 key 已存在但输入不同：不能证明原操作失败，保持 unknown。
  const unconfirmed = result.status === 'unknown' || result.reason === 'conflict'
  return { owner: 'sonora', actionId: actionIdFromOwner,
    status: unconfirmed ? 'unknown' : 'rejected',
    receiptRef: `receipt:sonora:workspace-action:${identity}`,
    summary: unconfirmed ? 'The original workspace action must be reconciled with Sonora.' : 'The workspace action request was rejected by Sonora.',
    ...(unconfirmed ? { reconcileReason: result.reason } : {}) }
}

function handoffReceipt(result: SonoraSubtitleHandoffResult, idempotencyKey: string): PaneActionReceiptV1 {
  if (result.status === 'ready') {
    const handoff = result.resource
    // 交接回执：receipt=handoff ref；版本=track_digest；目标 scope=consumer
    // （三者分别来自 owner 回执本体，不互相推断）。handoff_ready=false 与
    // production_acceptance=pending 原样保留，不升级为 delivered。
    const blockers = (handoff.blockers ?? []).join(', ')
    return { owner: 'sonora', actionId: handoffActionId, status: handoff.handoff_ready ? 'completed' : 'partial',
      receiptRef: handoff.ref,
      summary: `Sonora handoff for consumer ${handoff.consumer}: handoff_ready=${String(handoff.handoff_ready)}, production_acceptance=${handoff.production_acceptance}${blockers === '' ? '' : `; blockers: ${blockers}`}${handoff.replay === true ? '; idempotent replay of the original handoff' : ''}.`,
      outputArtifacts: [{ schema: PANE_ARTIFACT_SCHEMA, owner: 'sonora', kind: 'subtitle-handoff', ref: handoff.ref, version: handoff.track_digest,
        mediaType: 'application/json', title: `Subtitle handoff (${handoff.consumer})`, evidenceRefs: [handoff.review_packet_ref], capabilities: [] }] }
  }
  const identity = createHash('sha256').update(JSON.stringify([handoffActionId, idempotencyKey])).digest('hex')
  // 409 幂等冲突 = 原 key 已绑定不同请求：不能证明原 handoff 未创建，保持 unknown。
  const unconfirmed = result.status === 'unknown' || result.reason === 'conflict'
  return { owner: 'sonora', actionId: handoffActionId, status: unconfirmed ? 'unknown' : 'rejected',
    receiptRef: `receipt:sonora:subtitle-handoff:${identity}`,
    summary: unconfirmed ? 'The original subtitle handoff must be reconciled.' : 'The subtitle handoff request was rejected by Sonora.',
    ...(unconfirmed ? { reconcileReason: result.reason } : {}) }
}

function assetArtifact(asset: SonoraAudioAsset): { schema: 'pane.artifact.v1alpha1'; owner: 'sonora'; kind: 'audio'; ref: string; version: string; mediaType: string; title: string; evidenceRefs: never[]; capabilities: never[] } {
  return { schema: PANE_ARTIFACT_SCHEMA, owner: 'sonora', kind: 'audio', ref: asset.asset_ref, version: asset.digest,
    mediaType: sonoraAudioMediaType(asset.media_format), title: `Audio ${asset.role}`, evidenceRefs: [], capabilities: [] }
}

/** A selected-track + selected-job slice of the audio studio, using the normal Creator adapter seam.
 * Selection is a Host project reference; all review, capability, action and version facts come from Sonora.
 */
export function createSonoraSubtitleExportAdapter(
  client: SonoraSubtitleExportClient,
  selectedTrack: (context: CreatorStudioContextV1) => Promise<string | undefined>,
  works?: SonoraWorksTableClient,
  extras: SonoraAudioStudioExtras = {},
): CreatorOwnerAdapterV1 {
  let sequence = 0
  /** In-memory flight bodies for workspace actions（幂等回放需精确原输入；有界 ≤32）。 */
  const flights = new Map<string, { action_id: string; target_ref: string; expected_revision: string }>()
  const flightOrder: string[] = []
  function rememberFlight(key: string, body: { action_id: string; target_ref: string; expected_revision: string }): void {
    if (flights.size >= 32 && flightOrder.length > 0) flights.delete(flightOrder.shift()!)
    flightOrder.push(key)
    flights.set(key, body)
  }
  async function read(context: CreatorStudioContextV1) {
    const ref = await selectedTrack({ ...context })
    return ref === undefined ? undefined : client.readTrack(context, ref)
  }
  function receipt(context: CreatorStudioContextV1, key: string, result: SonoraSubtitleExportResult): PaneActionReceiptV1 {
    if (result.status === 'ready') {
      const resource = result.resource
      return { owner: 'sonora', actionId, status: 'completed', receiptRef: resource.ref,
        summary: 'Sonora saved the reviewed subtitle export.', outputArtifacts: [{ schema: PANE_ARTIFACT_SCHEMA,
          owner: 'sonora', kind: 'subtitle', ref: resource.ref, version: resource.content_digest,
          mediaType: resource.media_type, title: `Subtitle export (${resource.format.toUpperCase()})`, evidenceRefs: [], capabilities: [],
        }] }
    }
    const identity = createHash('sha256').update(JSON.stringify([context.projectRef, context.principalRef, key])).digest('hex')
    return { owner: 'sonora', actionId, status: result.status, receiptRef: `receipt:sonora:subtitle-export:${identity}`,
      summary: result.status === 'unknown' ? 'The original subtitle export must be reconciled.' : 'The subtitle export request was rejected.',
      ...(result.status === 'unknown' ? { reconcileReason: result.reason } : {}),
    }
  }
  /** §2.3：读取选中 job 的 board 投影；失败/缺 face 返回 undefined（诚实降级）。 */
  async function readBoard(context: CreatorStudioContextV1): Promise<{ jobId: string; board: SonoraWorkspaceBoard } | undefined> {
    if (extras.workspace === undefined || extras.selectedJob === undefined) return undefined
    const jobId = await extras.selectedJob({ ...context })
    if (jobId === undefined) return undefined
    const board = await extras.workspace.readBoard({ ...context }, jobId)
    return board.status === 'ready' ? { jobId, board: board.resource } : undefined
  }
  async function dispatchWorkspace(raw: { values: Record<string, unknown> }, context: CreatorStudioContextV1, input: { actionId: string; descriptorRef: string; expectedTargetRef: string; expectedTargetVersion: string; idempotencyKey: string }): Promise<PaneActionReceiptV1 | undefined> {
    if (extras.workspace === undefined) return undefined
    // dispatch 前重新读取当前 board：descriptor 必须仍由 owner 签发且 revision 一致。
    const jobId = await extras.selectedJob?.({ ...context })
    const read = jobId === undefined ? undefined : await extras.workspace.readBoard({ ...context }, jobId)
    if (read?.status !== 'ready') return workspaceReceipt(input.actionId, { status: 'rejected', reason: 'unavailable' }, input.idempotencyKey)
    const board = read.resource
    const action = board.actions.find(item => item.action_id === input.actionId && item.target_ref === input.expectedTargetRef)
    if (action === undefined || workspaceActionDescriptor(board, action, context) === undefined
      || action.expected_revision !== input.expectedTargetVersion
      || `sonora:workspace-action:${action.action_id}:${action.target_ref}:${action.expected_revision}` !== input.descriptorRef) {
      return workspaceReceipt(input.actionId, { status: 'rejected', reason: 'invalid_input' }, input.idempotencyKey)
    }
    if (Object.keys(raw.values).length !== 0) return workspaceReceipt(input.actionId, { status: 'rejected', reason: 'invalid_input' }, input.idempotencyKey)
    const body = { action_id: action.action_id, target_ref: action.target_ref, expected_revision: action.expected_revision }
    // 记住本次提交的精确 body：owner 的幂等 digest 覆盖 expected_revision，
    // 对账回放必须逐字节一致；内存飞行表之外（重启后）保持 unknown 而非猜输入。
    rememberFlight(input.idempotencyKey, body)
    return workspaceReceipt(input.actionId, await extras.workspace.submitAction({ ...context }, body, input.idempotencyKey), input.idempotencyKey)
  }
  return {
    owner: 'sonora', transport: 'service',
    async readTranscriptionCatalog(context) {
      const result = await client.readTranscriptionCatalog({ ...context })
      return result.status === 'ready' ? result.resource : undefined
    },
    async readCapabilityMatrix(context) {
      if (extras.matrix === undefined) return undefined
      const scope = { ...context }
      // 转写目录读取失败时整体降级为 unavailable：把“读取失败”显示成
      // “能力缺失”会误导矩阵状态。
      const transcription = await client.readTranscriptionCatalog(scope)
      if (transcription.status !== 'ready') return undefined
      const result = await extras.matrix.read(scope, transcription.resource)
      return result.status === 'ready' ? result.resource : undefined
    },
    async readWorksTable(context, cursor) {
      return works === undefined ? { status: 'rejected', reason: 'unavailable' } : works.read({ ...context }, cursor)
    },
    async snapshot(context): Promise<CreatorOwnerSnapshotV1> {
      context = { ...context }
      const result = await read(context)
      const track = result?.status === 'ready' ? result.resource : undefined
      const ready = track !== undefined && exportable(track)
      const board = await readBoard(context)
      const workspaceActions = board === undefined ? [] : board.board.actions
        .map(action => workspaceActionDescriptor(board.board, action, context))
        .filter((action): action is PaneActionDescriptorV1 => action !== undefined)
      // §2.4：试听候选来自 job 输出 asset（固定 digest 版本，经授权 rendition 播放）。
      const assets = board === undefined || extras.audition === undefined ? [] : await readJobAssets(context, board.jobId)
      const current = ++sequence
      const jobResource = board === undefined ? [] : (() => {
        // 资源 status 必须是稳定 key（safeRef/safeKey 字符集）：用 owner lane id
        // （render/review/blocked）+ freshness；卡片 summary 走 metrics/badges。
        const lane = board.board.data.lanes.find(item => item.cards.some(card => card.resource_ref === board.board.source.resource_ref))
        const card = lane?.cards.find(card => card.resource_ref === board.board.source.resource_ref)
        return [{ ref: board.board.source.resource_ref, version: board.board.source.revision, kind: 'audio-job', title: 'Selected audio job',
          status: lane === undefined ? board.board.freshness.state : `${lane.lane_id}:${board.board.freshness.state}`,
          metrics: [...(card?.summary === undefined ? [] : [{ label: 'Summary', value: card.summary }]), ...(card?.blockers ?? []).map(blocker => ({ label: 'Blocker', value: blocker }))], evidenceRefs: [] as string[] }]
      })()
      return { schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'sonora', transport: 'service',
        snapshotRef: `sonora:subtitle-studio:${current}`, snapshotVersion: current, cursor: `sonora:subtitle-studio:${current}`, sequence: current,
        generatedAt: new Date().toISOString(), context: { ...context },
        status: ready ? 'ready' : track !== undefined || result === undefined ? 'attention_required' : result.status !== 'ready' && result.reason === 'permission_denied' ? 'permission_denied' : 'unknown',
        freshness: track === undefined ? 'unknown' : 'fresh',
        summary: ready ? 'The selected subtitle track is ready to export and hand off.' : track !== undefined ? 'Review the selected subtitle track in Sonora before exporting.' : 'Select an accessible Sonora subtitle track.',
        resources: [...(track === undefined ? [] : [{ ref: track.ref, version: track.track_digest, kind: 'subtitle-track', title: 'Selected subtitle track',
          status: track.readability_status, metrics: [{ label: 'Cues', value: String(track.cue_count) }], evidenceRefs: [] }]), ...jobResource],
        ...(assets.length === 0 ? {} : { artifactWorkspace: { status: 'ready' as const, safeMessage: 'Owner-auditioned audio outputs at fixed versions.', artifacts: assets.map(asset => ({
          artifact: assetArtifact(asset), acceptedVersion: asset.digest,
          ...(asset.duration_ms === undefined ? {} : { media: { durationMs: asset.duration_ms } }), candidates: [] })) } }),
        actions: !ready || track === undefined ? workspaceActions : [{ schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'sonora', actionId,
          descriptorRef: descriptorRef(track), targetRef: track.ref, targetVersion: track.track_digest, context: { ...context },
          label: 'Export reviewed subtitles', risk: 'low', confirmation: 'confirm', expiresAt: new Date(Date.now() + 60_000).toISOString(),
          preview: { summary: 'Save a fixed-version subtitle export in Sonora. This does not adopt a new track or deliver a shot.', cost: { currency: 'USD', amount: 0, estimate: false } },
          fields: [{ key: 'format', kind: 'select', label: 'Subtitle format', required: true, options: [{ value: 'srt', label: 'SRT' }, { value: 'vtt', label: 'WebVTT' }] }],
        }, { schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'sonora', actionId: handoffActionId,
          descriptorRef: handoffDescriptorRef(track), targetRef: track.ref, targetVersion: track.track_digest, context: { ...context },
          label: 'Hand off reviewed subtitles', risk: 'low', confirmation: 'confirm', expiresAt: new Date(Date.now() + 60_000).toISOString(),
          preview: { summary: `Create a Sonora subtitle handoff for consumer ${handoffConsumer}. handoff_ready reflects the owner review; production acceptance stays pending with the owner.` },
          fields: [{ key: 'consumer', kind: 'select', label: 'Handoff consumer', required: true, options: [{ value: handoffConsumer, label: handoffConsumer }] }],
        }, ...workspaceActions],
      }
    },
    async dispatch(raw, context) {
      context = { ...context }
      const request = PaneActionRequestSchema.safeParse(raw)
      const reject = () => receipt(context, raw.idempotencyKey, { status: 'rejected', reason: 'invalid_input' })
      if (!request.success) return reject()
      const input = request.data
      if (input.owner !== 'sonora' || !sameContext(input.context, context)) return reject()
      const values = input.values as Record<string, unknown>
      // §2.3 owner workspace actions（cancel_job/request_review 等，opaque act_* id）。
      if (input.actionId.startsWith('act_')) {
        const settled = await dispatchWorkspace({ values }, context, input)
        // workspace face 缺席时也不能回退成 subtitle.export 的拒绝回执。
        return settled ?? workspaceReceipt(input.actionId, { status: 'rejected', reason: 'invalid_input' }, input.idempotencyKey)
      }
      if (input.actionId === handoffActionId) {
        if (extras.handoff === undefined || Object.keys(values).length !== 1 || values.consumer !== handoffConsumer) return reject()
        const scope = { ...context }
        const result = await read(scope)
        if (result?.status !== 'ready' || !exportable(result.resource)) return handoffReceipt({ status: 'rejected', reason: 'unavailable' }, input.idempotencyKey)
        const trackNow = result.resource
        if (input.expectedTargetRef !== trackNow.ref || input.expectedTargetVersion !== trackNow.track_digest || input.descriptorRef !== handoffDescriptorRef(trackNow)) return reject()
        const created = await extras.handoff.create(scope, { track_ref: trackNow.ref, consumer: handoffConsumer }, input.idempotencyKey)
        // 版本分别取得并交叉校验：handoff 回执的 track_digest 必须与本地独立
        // 读取的当前 track 版本一致，否则按未确认处理，不回填旧版本。
        if (created.status === 'ready' && created.resource.track_digest !== trackNow.track_digest) return handoffReceipt({ status: 'unknown', reason: 'unconfirmed' }, input.idempotencyKey)
        return handoffReceipt(created, input.idempotencyKey)
      }
      if (input.actionId !== actionId || Object.keys(values).length !== 1 || !['srt', 'vtt'].includes(String(values.format))) return reject()
      const scope = { ...context }
      const result = await read(scope)
      if (result?.status !== 'ready' || !exportable(result.resource)) return receipt(scope, input.idempotencyKey, { status: 'rejected', reason: 'unavailable' })
      const track = result.resource
      if (input.expectedTargetRef !== track.ref || input.expectedTargetVersion !== track.track_digest || input.descriptorRef !== descriptorRef(track)) return reject()
      return receipt(scope, input.idempotencyKey, await client.create(scope, { track_ref: track.ref, track_digest: track.track_digest,
        review_digest: track.review_digest, format: values.format as 'srt' | 'vtt' }, input.idempotencyKey))
    },
    async reconcile(raw, context) {
      context = { ...context }
      const request = PaneActionReconcileRequestSchema.safeParse(raw)
      if (!request.success) return receipt(context, raw.idempotencyKey, { status: 'unknown', reason: 'invalid_input' })
      const input = request.data
      if (input.owner !== 'sonora' || !sameContext(input.context, context)) return receipt(context, raw.idempotencyKey, { status: 'unknown', reason: 'invalid_input' })
      if (input.actionId === handoffActionId) {
        if (extras.handoff === undefined) return handoffReceipt({ status: 'unknown', reason: 'invalid_input' }, input.idempotencyKey)
        // owner 幂等合同：同 key 同请求重放返回原 handoff（无第二次副作用）；
        // 这里是显式对账，不是自动重试。stale review 只会得到 owner 拒绝。
        const scope = { ...context }
        const result = await read(scope)
        if (result?.status !== 'ready') return handoffReceipt({ status: 'unknown', reason: 'unconfirmed' }, input.idempotencyKey)
        return handoffReceipt(await extras.handoff.create(scope, { track_ref: result.resource.ref, consumer: handoffConsumer }, input.idempotencyKey), input.idempotencyKey)
      }
      if (input.actionId.startsWith('act_')) {
        if (extras.workspace === undefined) return workspaceReceipt(input.actionId, { status: 'unknown', reason: 'invalid_input' }, input.idempotencyKey)
        // workspace 动作对账：owner 唯一恢复面是同 key 幂等回放（same digest →
        // 原 receipt，不重复执行）；仅在用户显式 reconcile 时发生，且必须有
        // 内存中的精确原输入。重启后无法重建 digest → 保持 unknown，由 owner
        // board/events 观察，不在插件里猜输入。
        const remembered = flights.get(input.idempotencyKey)
        if (remembered === undefined || remembered.action_id !== input.actionId || remembered.target_ref !== input.expectedTargetRef) {
          return workspaceReceipt(input.actionId, { status: 'unknown', reason: 'unconfirmed' }, input.idempotencyKey)
        }
        const replay = await extras.workspace.submitAction({ ...context }, remembered, input.idempotencyKey)
        return workspaceReceipt(input.actionId, replay, input.idempotencyKey)
      }
      if (input.actionId !== actionId) return receipt(context, raw.idempotencyKey, { status: 'unknown', reason: 'invalid_input' })
      const result = await client.lookupOriginal({ ...context }, input.idempotencyKey)
      if (result.status === 'ready' && result.resource.track_ref !== input.expectedTargetRef) return receipt(context, input.idempotencyKey, { status: 'unknown', reason: 'unconfirmed' })
      return receipt(context, input.idempotencyKey, result)
    },
    async readArtifactContent(artifact, context) {
      if (artifact.owner !== 'sonora' || artifact.kind !== 'subtitle') return undefined
      const scope = { ...context }
      const claim = { ...artifact }
      const result = await client.read(scope, claim.ref)
      if (result.status !== 'ready' || result.resource.content_digest !== claim.version || result.resource.media_type !== claim.mediaType) return undefined
      const content = await client.readContent(scope, result.resource)
      // Respect the existing ephemeral editor contract without silently truncating.
      if (content === undefined || content.length > 256 * 1024) return undefined
      return { artifact: claim, contentRevision: result.resource.content_digest, content }
    },
    async resolveArtifact(artifact, context) {
      // §2.4 试听：只有 owner 授权 rendition（access grant）一条路；digest
      // 不匹配当前 artifact.version 即禁用播放，绝不回退 raw URL 或本地转码。
      if (artifact.owner !== 'sonora' || artifact.kind !== 'audio' || extras.audition === undefined) return undefined
      const match = /^sonora:\/\/audio-asset\/([A-Za-z0-9][A-Za-z0-9._-]*)$/u.exec(artifact.ref)
      if (match === null) return undefined
      const scope = { ...context }
      const grant = await extras.audition.issueGrant(scope, match[1]!)
      if (grant.status !== 'ready') return undefined
      const resource = grant.resource
      if (resource.artifact_ref !== artifact.ref || resource.artifact_digest !== artifact.version) return undefined
      const expiresAt = Date.parse(resource.expires_at)
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return undefined
      return { url: resource.authorized_url, expiresAt: new Date(expiresAt).toISOString() }
    },
  }

  /** §2.4 helper：从 job 读取输出 asset（有界 ≤4），逐项失败即少一项，不伪造。 */
  async function readJobAssets(context: CreatorStudioContextV1, jobId: string): Promise<SonoraAudioAsset[]> {
    if (extras.audition === undefined) return []
    const job = await extras.audition.readJob({ ...context }, jobId)
    if (job.status !== 'ready') return []
    const assets: SonoraAudioAsset[] = []
    for (const ref of (job.resource.output_asset_refs ?? []).slice(0, 4)) {
      const asset = await extras.audition.readAsset({ ...context }, ref.slice('sonora://audio-asset/'.length))
      if (asset.status === 'ready') assets.push(asset.resource)
    }
    return assets
  }
}

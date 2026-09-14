import { Context } from '@deepseek-ai/cordis'
import { afterEach, expect, it, vi } from 'vitest'
import { PANE_ACTION_REQUEST_SCHEMA } from '@yeisme/dsh-pane-protocol'
import { CreatorStudioOwnerDirectory } from '../src/directory.ts'
import { CreatorStudioGateway, CREATOR_STUDIO_EXPECTED_CONTEXT, CREATOR_STUDIO_OWNER_DIRECTORY } from '../src/gateway.ts'
import { SonoraSubtitleExportClient } from '../src/sonora-subtitle-export.ts'
import { SonoraWorkspaceClient } from '../src/sonora-workspace.ts'
import { SonoraCapabilityMatrixClient } from '../src/sonora-capability-matrix.ts'
import { SonoraAuditionClient } from '../src/sonora-audition.ts'
import { SonoraSubtitleHandoffClient } from '../src/sonora-subtitle-handoff.ts'
import { createSonoraSubtitleExportAdapter } from '../src/sonora-subtitle-adapter.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test',
  principalRef: 'principal:test', membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const track = { ref: 'sonora://subtitle-track/test', track_digest: 'track-digest', review_digest: 'review-digest', readability_status: 'ok', decision_code: 'approved', cue_count: 1, updated_at: '2026-09-08T00:00:00Z', cues: [{ text: 'private-cue-sentinel' }] }
const boardAction = { action_id: 'act_cancel0123456789abcd', action_type: 'cancel_job', target_ref: 'sonora://audio-job/job-1',
  permission: { required_scopes: ['sonora.write'], state: 'granted' }, expected_revision: 'rev9',
  input_schema_ref: 'sonora://schema/workspace-action.cancel.v1', idempotency: { required: true, key_scope: 'action-target' },
  confirmation: { required: true, reason_code: 'provider_cancellation_may_not_be_guaranteed' }, availability: 'enabled' }
const board = { spec_version: 'sonora.audio_workspace_projection.v1', projection_kind: 'board', projection_ref: 'sonora://workspace-projection/b1',
  source: { resource_ref: 'sonora://audio-job/job-1', resource_type: 'audio-job', revision: 'rev9', digest: 'dg9' },
  generated_at: '2026-09-14T12:00:00.000Z', freshness: { state: 'fresh', observed_at: '2026-09-14T12:00:00.000Z', expires_at: '2099-01-01T00:00:00.000Z' },
  actions: [boardAction], fallback: { mode: 'read_only', reason_code: 'none', safe_summary: 'Audio job board summary.' },
  data: { lanes: [{ lane_id: 'running', title: 'running', cards: [{ card_ref: 'sonora://workspace-card/job-1', resource_ref: 'sonora://audio-job/job-1', revision: 'rev9', title: 'Audio job', summary: 'State: running', blockers: [] }] }] } }
const workspaceReceipt = { spec_version: 'sonora.audio_workspace_action_receipt.v1', receipt_ref: 'sonora://action-receipt/rc1',
  action_id: boardAction.action_id, action_type: 'cancel_job', target_ref: 'sonora://audio-job/job-1', outcome: 'accepted',
  target_revision: 'rev10', findings: [], retry_classification: 'terminal' }
const job = { job_id: 'job-1', state: 'succeeded', voice_plan_ref: 'sonora://voice-plan/p1', provider_id: 'fixture',
  output_asset_refs: ['sonora://audio-asset/a1'], updated_at: '2026-09-14T12:00:00.000Z' }
const asset = { asset_ref: 'sonora://audio-asset/a1', role: 'dialogue', media_format: 'wav', digest: 'sha256:audio-1', duration_ms: 2400, permission: 'licensed', review_status: 'pending' }
const grant = { grant_ref: 'sonora://artifact-access/g1', artifact_ref: 'sonora://audio-asset/a1', artifact_digest: 'sha256:audio-1',
  content_policy: 'quarantine', authorized_url: 'http://127.0.0.1:8740/api/v1/artifact-access/g1?t=capability-secret',
  issued_at: '2026-09-14T12:00:00.000Z', expires_at: '2099-01-01T00:00:00.000Z' }
const handoff = { ref: 'sonora://subtitle-handoff/h1', track_ref: track.ref, source_transcription_ref: 'sonora://transcription/x1',
  review_packet_ref: 'sonora://review-packet/r1', request_digest: 'rd1', track_digest: track.track_digest, review_digest: track.review_digest,
  locale: 'zh-CN', cue_count: 1, consumer: 'scaena', handoff_ready: true, production_acceptance: 'pending',
  created_at: '2026-09-14T12:00:00.000Z', updated_at: '2026-09-14T12:00:00.000Z' }
const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0)) await ctx.fiber.dispose() })

interface Harness {
  gateway: CreatorStudioGateway
  fetcher: ReturnType<typeof vi.fn<typeof fetch>>
  providedContext: CreatorStudioContextV1
  adapter: ReturnType<typeof createSonoraSubtitleExportAdapter>
  holdProvidersRead: () => void
  waitForProvidersRead: () => Promise<void>
  releaseProvidersRead: () => void
  mutate: (patch: { boardAction?: unknown; workspaceReceipt?: unknown; handoff?: unknown; grant?: unknown; job?: unknown; loseWorkspacePost?: boolean }) => void
}

async function setup(): Promise<Harness> {
  let currentBoardAction: unknown = boardAction
  let currentWorkspaceReceipt: unknown = workspaceReceipt
  let currentHandoff: unknown = handoff
  let currentGrant: unknown = grant
  let currentJob: unknown = job
  let loseWorkspacePost = false
  let holdProviders = false
  let releaseProviders: (() => void) | undefined
  const fetcher = vi.fn<typeof fetch>(async (input: URL | RequestInfo, options?: RequestInit) => {
    const path = new URL(String(input)).pathname
    if (path === '/api/v1/subtitle-tracks/test') return Response.json(track)
    if (path === '/api/v1/workspace-projections/board/job-1') return Response.json({ ...board, actions: [currentBoardAction].filter(Boolean) })
    if (path === '/api/v1/audio-jobs/job-1') return Response.json(currentJob)
    if (path === '/api/v1/assets/a1') return Response.json(asset)
    if (path === '/api/v1/artifacts/a1/access-grants') return Response.json(currentGrant, { status: 201 })
    if (path === '/api/v1/workspace-actions') {
      if (loseWorkspacePost) throw new Error('fixture workspace response lost')
      return Response.json(currentWorkspaceReceipt, { status: 201 })
    }
    if (path === '/api/v1/subtitle-handoffs' && options?.method === 'POST') return Response.json(currentHandoff, { status: 201 })
    if (path === '/api/v1/transcription-providers') return Response.json({ validation_level: 'capability_probe', diagnostics_available: true, profiles: [] })
    if (path === '/api/v1/providers') {
      if (holdProviders) await new Promise<void>(done => { releaseProviders = done })
      return Response.json({ providers: [{ provider_id: 'elevenlabs', provider_kind: 'tts', requires_network: true, requires_credentials: true, configured: true, status: 'configured', supports_voice_clone: true, cost_model: 'external_runtime' }] })
    }
    if (path === '/api/v1/music/providers') return Response.json({ providers: [{ provider_id: 'elevenlabs', provider_kind: 'remote_official_api', readiness: 'preview', requires_network: true, requires_credentials: true, cost_model: 'unknown_preview' }] })
    return new Response('', { status: 404 })
  })
  const connection = async (scope: CreatorStudioContextV1) => ({ context: scope, baseURL: 'http://127.0.0.1:8740', headers: {} })
  const adapter = createSonoraSubtitleExportAdapter(new SonoraSubtitleExportClient(connection, fetcher), async () => track.ref, undefined, {
    workspace: new SonoraWorkspaceClient(connection, fetcher),
    matrix: new SonoraCapabilityMatrixClient(connection, fetcher),
    audition: new SonoraAuditionClient(connection, fetcher),
    handoff: new SonoraSubtitleHandoffClient(connection, fetcher),
    selectedJob: async () => 'job-1',
  })
  const ctx = new Context()
  contexts.push(ctx)
  const directory = new CreatorStudioOwnerDirectory()
  directory.register(adapter)
  const providedContext = { ...context }
  ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, providedContext)
  ctx.provide(CREATOR_STUDIO_OWNER_DIRECTORY, directory)
  await ctx.plugin(CreatorStudioGateway)
  const gateway = ctx.get('creatorStudio') as CreatorStudioGateway
  return { gateway, fetcher, providedContext, adapter,
    holdProvidersRead: () => { holdProviders = true },
    waitForProvidersRead: async () => {
      await vi.waitFor(() => { if (releaseProviders === undefined) throw new Error('providers read not started') })
    },
    releaseProvidersRead: () => { releaseProviders?.(); releaseProviders = undefined; holdProviders = false },
    mutate: patch => {
      if (patch.boardAction !== undefined) currentBoardAction = patch.boardAction
      if (patch.workspaceReceipt !== undefined) currentWorkspaceReceipt = patch.workspaceReceipt
      if (patch.handoff !== undefined) currentHandoff = patch.handoff
      if (patch.grant !== undefined) currentGrant = patch.grant
      if (patch.job !== undefined) currentJob = patch.job
      if (patch.loseWorkspacePost !== undefined) loseWorkspacePost = patch.loseWorkspacePost
    } }
}

it('§2.3 publishes owner workspace action descriptors with permission and no invented cost', async () => {
  const h = await setup()
  const snapshot = await h.adapter.snapshot(context)
  const cancel = snapshot.actions.find(action => action.actionId === boardAction.action_id)
  expect(cancel).toMatchObject({ confirmation: 'confirm', risk: 'medium', targetRef: 'sonora://audio-job/job-1', targetVersion: 'rev9' })
  expect(cancel?.preview.cost).toBeUndefined()
  expect(cancel?.preview.summary).toContain('quotes no cost')
  expect(cancel?.preview.summary).toContain('provider_cancellation_may_not_be_guaranteed')
  // 受阻 descriptor 不发布为可执行动作，但资源卡保留 owner 状态。
  h.mutate({ boardAction: { ...boardAction, availability: 'blocked', blockers: ['permission_revoked'] } })
  const blocked = await h.adapter.snapshot(context)
  expect(blocked.actions.some(action => action.actionId === boardAction.action_id)).toBe(false)
  expect(JSON.stringify(blocked.resources)).toContain('sonora://audio-job/job-1')
})

it('§2.3 settles cancellation from the owner receipt only and reconciles a lost POST by idempotent replay', async () => {
  const h = await setup()
  const snapshot = await h.adapter.snapshot(context)
  const cancel = snapshot.actions.find(action => action.actionId === boardAction.action_id)!
  const request = { schema: PANE_ACTION_REQUEST_SCHEMA, owner: 'sonora', actionId: cancel.actionId, descriptorRef: cancel.descriptorRef,
    expectedTargetRef: cancel.targetRef, expectedTargetVersion: cancel.targetVersion, context, idempotencyKey: 'ws-original-key', values: {} }
  expect(await h.gateway.dispatch(request)).toMatchObject({ status: 'completed', receiptRef: 'sonora://action-receipt/rc1' })
  // owner 拒绝（provider 取消失败）→ rejected；绝不在本地标记 cancelled。
  h.mutate({ workspaceReceipt: { ...workspaceReceipt, outcome: 'rejected', findings: ['provider_cancel_unsupported'], retry_classification: 'retryable' } })
  const second = await h.adapter.dispatch({ ...request, idempotencyKey: 'ws-rejected-key' }, context)
  expect(second).toMatchObject({ status: 'rejected' })
  expect(second.summary).toContain('provider_cancel_unsupported')
  // 丢失响应 → unknown；显式 reconcile 用记忆的原 body 幂等回放拿回原 receipt。
  h.mutate({ loseWorkspacePost: true })
  const lost = await h.adapter.dispatch({ ...request, idempotencyKey: 'ws-lost-key' }, context)
  expect(lost).toMatchObject({ status: 'unknown' })
  h.mutate({ loseWorkspacePost: false, workspaceReceipt })
  const reconciled = await h.gateway.reconcile({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'sonora', actionId: cancel.actionId,
    expectedTargetRef: cancel.targetRef, context, idempotencyKey: 'ws-lost-key' })
  expect(reconciled).toMatchObject({ status: 'completed', receiptRef: 'sonora://action-receipt/rc1' })
  const posts = h.fetcher.mock.calls.filter(([url, options]) => String(url).endsWith('/workspace-actions') && options?.method === 'POST')
  // 4 次 POST 调用：original、rejected、lost（无响应）、replay；lost 与 replay 的
  // body 逐字节一致（同 key 同 digest 的 owner 幂等回放，不构造新输入）。
  expect(posts).toHaveLength(4)
  const lostBody = JSON.parse(posts[2]![1]!.body as string)
  expect(lostBody.idempotency_key).toBe('ws-lost-key')
  expect(JSON.parse(posts[3]![1]!.body as string)).toEqual(lostBody)
  // 重启后（无内存飞行表）对账保持 unknown，不猜输入。
  const fresh = await setup()
  expect(await fresh.gateway.reconcile({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'sonora', actionId: boardAction.action_id,
    expectedTargetRef: 'sonora://audio-job/job-1', context, idempotencyKey: 'ws-lost-key' })).toMatchObject({ status: 'unknown' })
})

it('§2.4 auditions only through owner-authorized renditions at the pinned version', async () => {
  const h = await setup()
  const snapshot = await h.adapter.snapshot(context)
  const workspace = snapshot.artifactWorkspace
  const artifact = workspace?.artifacts[0]?.artifact
  expect(artifact).toMatchObject({ owner: 'sonora', kind: 'audio', ref: 'sonora://audio-asset/a1', version: 'sha256:audio-1', mediaType: 'audio/wav' })
  expect(workspace?.artifacts[0]?.media).toEqual({ durationMs: 2400 })
  expect(await h.gateway.resolveArtifact(artifact!)).toMatchObject({ url: grant.authorized_url })
  // 版本漂移：grant digest 不再匹配 artifact.version → 播放禁用（undefined），
  // 绝不回退 raw URL 或播放别的版本。
  h.mutate({ grant: { ...grant, artifact_digest: 'sha256:different' } })
  expect(await h.gateway.resolveArtifact(artifact!)).toBeNull()
  h.mutate({ grant: { ...grant, artifact_ref: 'sonora://audio-asset/other' } })
  expect(await h.gateway.resolveArtifact(artifact!)).toBeNull()
  // capability token 不进入任何 snapshot 投影。
  expect(JSON.stringify(await h.adapter.snapshot(context))).not.toContain('capability-secret')
})

it('§2.5 hands off with separately verified receipt, version and target scope', async () => {
  const h = await setup()
  const snapshot = await h.adapter.snapshot(context)
  const handoffAction = snapshot.actions.find(action => action.actionId === 'subtitle.handoff')!
  expect(handoffAction.fields[0]?.options).toEqual([{ value: 'scaena', label: 'scaena' }])
  const request = { schema: PANE_ACTION_REQUEST_SCHEMA, owner: 'sonora', actionId: 'subtitle.handoff', descriptorRef: handoffAction.descriptorRef,
    expectedTargetRef: track.ref, expectedTargetVersion: track.track_digest, context, idempotencyKey: 'handoff-key-1', values: { consumer: 'scaena' } }
  const receipt = await h.gateway.dispatch(request)
  expect(receipt).toMatchObject({ status: 'completed', receiptRef: 'sonora://subtitle-handoff/h1',
    outputArtifacts: [{ kind: 'subtitle-handoff', ref: 'sonora://subtitle-handoff/h1', version: track.track_digest, evidenceRefs: ['sonora://review-packet/r1'] }] })
  expect(receipt.summary).toContain('consumer scaena')
  expect(receipt.summary).toContain('production_acceptance=pending')
  // handoff_ready=false → partial（保留 blockers，不升级为 delivered）。
  h.mutate({ handoff: { ...handoff, handoff_ready: false, blockers: ['readability_blocked'] } })
  const blocked = await h.adapter.dispatch({ ...request, idempotencyKey: 'handoff-key-2' }, context)
  expect(blocked).toMatchObject({ status: 'partial' })
  expect(blocked.summary).toContain('readability_blocked')
  // 版本交叉校验：回执 track_digest 与本地独立读取不一致 → unknown，不回填。
  h.mutate({ handoff: { ...handoff, track_digest: 'drifted-digest' } })
  expect(await h.adapter.dispatch({ ...request, idempotencyKey: 'handoff-key-3' }, context)).toMatchObject({ status: 'unknown' })
})

it('§2.2 exposes the capability matrix Remote with the owner description as source', async () => {
  const h = await setup()
  const matrix = await h.gateway.readCapabilityMatrix()
  expect(matrix).not.toBeNull()
  const byFamily = Object.fromEntries(matrix!.entries.map(entry => [entry.family, entry]))
  expect(byFamily.speech).toMatchObject({ state: 'supported' })
  expect(byFamily.music).toMatchObject({ state: 'unverified' })
  expect(byFamily.sfx).toMatchObject({ state: 'missing', reasonCode: 'owner_http_provider_description_absent' })
  expect(byFamily.word_alignment).toMatchObject({ state: 'missing', reasonCode: 'segment_to_cue_only' })
  expect(JSON.stringify(matrix)).not.toContain('external_runtime')
  // 等待期间 membership 变化：迟到结果不跨上下文返回。
  h.holdProvidersRead()
  const pending = h.gateway.readCapabilityMatrix()
  await h.waitForProvidersRead()
  h.providedContext.membershipRevision = '2'
  h.releaseProvidersRead()
  expect(await pending).toBeNull()
})

import { describe, expect, it } from 'vitest'
import { ArtifactRefSchema, PaneEventEnvelopeSchema, parsePaneActionDescriptor } from '@yeisme/dsh-pane-protocol'
import {
  ANATOMIA_ACTION_IDS,
  ANATOMIA_ENTITY_KINDS,
  ANATOMIA_NEGATIVE_KINDS,
  ANATOMIA_STREAM,
  anatomiaEvidenceArtifact,
  anatomiaNegativeRead,
  anatomiaPaneUnsafe,
  anatomiaSnapshotRead,
  createAnatomiaActionChannel,
  type AnatomiaAnalysisLike,
} from '../src/anatomia.ts'

const context = { workspaceRef: 'workspace:anatomia-demo', sessionRef: 'session:one', principalRef: 'principal:local', revision: '1' }

function analysis(overrides: Partial<AnatomiaAnalysisLike> = {}): AnatomiaAnalysisLike {
  return {
    analysisRef: 'analysis:video-1',
    state: 'running',
    stateVersion: 3,
    revisionRef: 'rev-2',
    facets: [
      { ref: 'source:clip-1', kind: 'source', title: 'Source clip 1' },
      { ref: 'job:video-1', kind: 'job', title: 'Analysis job' },
      { ref: 'timeline:video-1', kind: 'timeline', title: 'Frame timeline' },
      { ref: 'shot:12', kind: 'shot', title: 'Shot 12', status: 'labeled' },
      { ref: 'scene:3', kind: 'scene', title: 'Scene 3' },
      { ref: 'transcript:video-1', kind: 'transcript', title: 'Transcript', partial: false },
      { ref: 'ocr:frame-88', kind: 'ocr', title: 'OCR frame 88' },
      { ref: 'observation:objects-1', kind: 'observation', title: 'Object observation' },
      { ref: 'evidence:shot-12', kind: 'evidence', title: 'Shot 12 evidence' },
    ],
    evidenceRefs: ['evidence:shot-12', 'evidence:scene-3'],
    updatedAt: '2026-08-23T01:02:03Z',
    ...overrides,
  }
}

describe('anatomiaSnapshotRead', () => {
  it('builds a contract-shaped envelope projecting every owner facet kind', () => {
    const read = anatomiaSnapshotRead(analysis(), context)
    const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
    expect(parsed.stream).toBe(ANATOMIA_STREAM)
    expect(parsed.op).toBe('snapshot')
    expect(parsed.sequence).toBe(-1)
    expect(parsed.occurredAt).toBe('2026-08-23T01:02:03Z')
    if (parsed.op === 'snapshot') {
      const kinds = parsed.payload.entities.map(entity => entity.value.kind)
      // job 面（owner 分析实体）+ 九类 facet（含 evidence）+ owner evidenceRefs 摊平的 evidence 实体
      expect(kinds).toEqual(['job', ...ANATOMIA_ENTITY_KINDS, 'evidence', 'evidence'])
    }
  })

  it('marks running jobs partial without ever presenting complete', () => {
    const parsed = PaneEventEnvelopeSchema.parse(anatomiaSnapshotRead(analysis(), context).snapshot)
    expect(parsed.status).toBe('running')
    if (parsed.op !== 'snapshot') throw new Error('unreachable')
    for (const entity of parsed.payload.entities) {
      const value = entity.value as Record<string, unknown>
      // owner 声明完成的 transcript 面保持 false；其余继承 job 级 partial
      expect(value.partial).toBe(value.kind === 'transcript' ? false : true)
    }
    expect(JSON.stringify(parsed).toLowerCase()).not.toContain('complete')
  })

  it('derives pane status from the owner job state machine only', () => {
    const expectations: Record<string, string> = {
      queued: 'ready',
      running: 'running',
      cancel_requested: 'running',
      succeeded: 'ready',
      failed: 'attention_required',
      cancelled: 'offline',
      mystery: 'unknown',
    }
    for (const [state, status] of Object.entries(expectations)) {
      const parsed = PaneEventEnvelopeSchema.parse(anatomiaSnapshotRead(analysis({ state }), context).snapshot)
      expect(parsed.status, state).toBe(status)
    }
    // succeeded 之后 complete 才出现：partial 标记全部消失
    const done = PaneEventEnvelopeSchema.parse(anatomiaSnapshotRead(analysis({ state: 'succeeded' }), context).snapshot)
    if (done.op !== 'snapshot') throw new Error('unreachable')
    for (const entity of done.payload.entities) {
      expect((entity.value as Record<string, unknown>).partial).toBe(false)
    }
  })

  it('publishes only the owner gated analyze/inspect actions', () => {
    expect(anatomiaSnapshotRead(analysis(), context).actions).toEqual([
      { id: 'analyze.start', gated: true },
      { id: 'evidence.inspect', gated: true },
    ])
  })

  it('skips unsafe refs exactly like the owner contract', () => {
    const read = anatomiaSnapshotRead(analysis({
      facets: [
        { ref: '/tmp/secret.mp4', kind: 'source', title: 'path' },
        { ref: 'evidence:token-1', kind: 'evidence', title: 'credential shaped' },
        { ref: 'shot://remote/1', kind: 'shot', title: 'protocol url' },
        { ref: '  ', kind: 'observation', title: 'blank' },
        { ref: 'shot:clean-1', kind: 'shot', title: 'Clean shot' },
      ],
      evidenceRefs: ['/var/media/a.mp4', 'evidence:scene-3'],
    }), context)
    const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities.map(entity => entity.ref)).toEqual(['analysis:video-1', 'shot:clean-1', 'evidence:scene-3'])
    }
    expect(JSON.stringify(read)).not.toContain('/tmp/secret')
    expect(JSON.stringify(read)).not.toContain('token-1')
    expect(anatomiaPaneUnsafe('https://evidence/1')).toBe(true)
    expect(anatomiaPaneUnsafe('C:\\media\\a.mp4')).toBe(true)
    expect(anatomiaPaneUnsafe('analysis:video-1')).toBe(false)
  })
})

describe('anatomiaNegativeRead', () => {
  it('maps every negative kind to its honest status without actions', () => {
    const expectations: Record<string, { status: string; partial: boolean | undefined }> = {
      partial: { status: 'running', partial: true },
      gap: { status: 'reconcile_required', partial: false },
      expired_cursor: { status: 'reconcile_required', partial: false },
      offline: { status: 'offline', partial: false },
      permission_denied: { status: 'permission_denied', partial: false },
    }
    for (const kind of ANATOMIA_NEGATIVE_KINDS) {
      const read = anatomiaNegativeRead(kind, context)
      const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
      expect(parsed.status, kind).toBe(expectations[kind]?.status)
      expect(parsed.freshness, kind).toBe('unknown')
      expect(read.actions, kind).toEqual([])
      if (parsed.op !== 'snapshot') throw new Error('unreachable')
      const entity = parsed.payload.entities[0]?.value as Record<string, unknown>
      expect(entity.partial, kind).toBe(expectations[kind]?.partial)
    }
    expect(JSON.stringify(anatomiaNegativeRead('partial', context)).toLowerCase()).not.toContain('complete')
  })
})

describe('anatomiaEvidenceArtifact', () => {
  it('keeps partial evidence distinct from complete evidence', () => {
    const partial = anatomiaEvidenceArtifact('evidence:shot-12', '3', true)
    const complete = anatomiaEvidenceArtifact('evidence:shot-12', '3', false)
    expect(partial?.kind).toBe('evidence-partial')
    expect(complete?.kind).toBe('evidence')
    expect(ArtifactRefSchema.parse(partial)).toMatchObject({ owner: 'anatomia', version: '3', evidenceRefs: ['evidence:shot-12'] })
    expect(complete?.capabilities).toEqual(['open', 'handoff', 'attach_context'])
    expect(anatomiaEvidenceArtifact('evidence:shot-12', '', false)?.version).toBe('1')
  })

  it('rejects unsafe evidence refs like the owner contract', () => {
    expect(anatomiaEvidenceArtifact('/tmp/secret.mp4', '1', false)).toBeUndefined()
    expect(anatomiaEvidenceArtifact('evidence:authorization-1', '1', false)).toBeUndefined()
  })
})

describe('createAnatomiaActionChannel', () => {
  it('previews server-authored descriptors carrying the owner revision contract', async () => {
    const channel = createAnatomiaActionChannel({
      authorize: () => 'granted',
      submitAnalysis: async () => ({ status: 'accepted', receiptRef: 'receipt:analyze-1', actionId: 'analyze.start', summary: 'Queued by owner.' }),
    }, 'rev-2')
    const raw = await channel.preview({ actionId: 'analyze.start', targetRef: 'analysis:video-1' })
    const descriptor = parsePaneActionDescriptor(raw)
    expect(descriptor.actionId).toBe('analyze.start')
    expect(descriptor.targetVersion).toBe('rev-2')
    expect(descriptor.confirmation).toBe('approval')
    expect(descriptor.preview.summary).toContain('idempotency')
  })

  it('returns not_available for actions outside the owner contract', async () => {
    const channel = createAnatomiaActionChannel({ authorize: () => 'granted', submitAnalysis: async () => { throw new Error('must not be called') } })
    await expect(channel.preview({ actionId: 'evidence.download', targetRef: 'evidence:shot-12' })).resolves.toEqual({
      negative: 'not_available',
      reason: 'owner did not publish this action',
    })
  })

  it('refuses preview when the owner denies analyze permission', async () => {
    const channel = createAnatomiaActionChannel({
      authorize: () => 'permission_denied',
      submitAnalysis: async () => { throw new Error('must not be called') },
    })
    await expect(channel.preview({ actionId: 'analyze.start', targetRef: 'analysis:video-1' })).resolves.toEqual({
      negative: 'not_available',
      reason: 'permission_denied',
    })
  })

  it('forwards the owner decision request unchanged and returns the raw receipt', async () => {
    const seen: unknown[] = []
    const channel = createAnatomiaActionChannel({
      authorize: () => 'granted',
      submitAnalysis: async request => { seen.push(request); return { status: 'pending', receiptRef: 'receipt:inspect-1', actionId: 'evidence.inspect' } },
    }, 'rev-2')
    const raw = await channel.submit({
      schema: 'pane.action-request.v1alpha1',
      descriptorRef: 'descriptor:1',
      owner: 'anatomia',
      actionId: 'evidence.inspect',
      expectedTargetRef: 'evidence:shot-12',
      expectedTargetVersion: 'rev-2',
      context,
      idempotencyKey: 'idem-0001',
      values: {},
    })
    expect(raw).toMatchObject({ status: 'pending', actionId: 'evidence.inspect' })
    expect(seen[0]).toMatchObject({ actionId: 'evidence.inspect', idempotencyKey: 'idem-0001' })
    expect(ANATOMIA_ACTION_IDS).toEqual(['analyze.start', 'evidence.inspect'])
  })
})

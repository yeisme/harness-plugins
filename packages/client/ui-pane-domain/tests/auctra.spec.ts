import { describe, expect, it } from 'vitest'
import { PaneEventEnvelopeSchema, parsePaneActionDescriptor } from '@yeisme/dsh-pane-protocol'
import {
  AUCTRA_NEGATIVE_KINDS,
  AUCTRA_STREAM,
  AUCTRA_TIMEOUT_INTERPRETATION,
  auctraNegativeRead,
  auctraPaneUnsafe,
  auctraSnapshotRead,
  auctraUnitArtifact,
  createAuctraActionChannel,
  type AuctraWorkspaceLike,
} from '../src/auctra.ts'

const context = { workspaceRef: 'workspace:auctra-demo', sessionRef: 'session:one', principalRef: 'principal:local', revision: '3' }

function workspace(overrides: Partial<AuctraWorkspaceLike> = {}): AuctraWorkspaceLike {
  return {
    reviews: [
      { ref: 'review:1', unitRef: 'unit:scene:1', title: 'Scene 1 candidate', status: 'pending' },
    ],
    structure: [
      { ref: 'unit:scene:1', kind: 'scene', title: 'Scene 1', state: 'review_pending', revision: '3', version: 3 },
      { ref: 'unit:chapter:2', kind: 'chapter', title: 'Chapter 2', state: 'accepted', revision: '1', version: 1 },
    ],
    pulse: { blocked: 0, reviewPending: 1, drafting: 0, staleVariants: 0, exportReady: 0 },
    ...overrides,
  }
}

describe('auctraSnapshotRead', () => {
  it('builds a contract-shaped snapshot envelope the protocol accepts', () => {
    const read = auctraSnapshotRead(workspace(), context)
    const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
    expect(parsed.op).toBe('snapshot')
    expect(parsed.stream).toBe(AUCTRA_STREAM)
    expect(parsed.sequence).toBe(-1)
    // pending review 优先投影：Pane 打开即看到审阅队列，而不是整本 canonical。
    expect(parsed.status).toBe('approval_required')
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities.map(entity => entity.value)).toEqual([
        { title: 'Scene 1 candidate', kind: 'review', status: 'pending' },
      ])
    }
  })

  it('falls back to structure units exactly when no safe review entity exists', () => {
    const read = auctraSnapshotRead(workspace({
      reviews: [],
      pulse: { blocked: 0, reviewPending: 0, drafting: 2, staleVariants: 1, exportReady: 0 },
    }), context)
    const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
    expect(parsed.status).toBe('running')
    expect(parsed.freshness).toBe('stale')
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities.map(entity => entity.ref)).toEqual(['unit:scene:1', 'unit:chapter:2'])
      expect(parsed.payload.entities.map(entity => entity.value)).toEqual([
        { title: 'Scene 1', kind: 'scene', status: 'review_pending' },
        { title: 'Chapter 2', kind: 'chapter', status: 'accepted' },
      ])
    }
  })

  it('maps the owner pulse exactly: blocked > review_pending > drafting > ready', () => {
    const statusOf = (pulse: AuctraWorkspaceLike['pulse']) =>
      PaneEventEnvelopeSchema.parse(auctraSnapshotRead(workspace({ pulse }), context).snapshot).status
    expect(statusOf({ blocked: 1, reviewPending: 2, drafting: 3, staleVariants: 0, exportReady: 0 })).toBe('attention_required')
    expect(statusOf({ blocked: 0, reviewPending: 2, drafting: 3, staleVariants: 0, exportReady: 0 })).toBe('approval_required')
    expect(statusOf({ blocked: 0, reviewPending: 0, drafting: 3, staleVariants: 0, exportReady: 0 })).toBe('running')
    expect(statusOf({ blocked: 0, reviewPending: 0, drafting: 0, staleVariants: 0, exportReady: 0 })).toBe('ready')
  })

  it('skips unsafe refs exactly like the owner contract', () => {
    const unsafe = auctraSnapshotRead(workspace({
      reviews: [
        { ref: '/var/auctra/review.md', title: 'path', status: 'pending' },
        { ref: 'review:rawprompt-echo', title: 'raw prompt shaped', status: 'pending' },
        { ref: '  ', title: 'blank', status: 'pending' },
        { ref: 'review:clean', title: 'Clean review', status: 'pending' },
      ],
      pulse: { blocked: 0, reviewPending: 4, drafting: 0, staleVariants: 0, exportReady: 0 },
    }), context)
    const parsed = PaneEventEnvelopeSchema.parse(unsafe.snapshot)
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities).toHaveLength(1)
      expect(parsed.payload.entities[0]?.ref).toBe('review:clean')
    }
    expect(JSON.stringify(unsafe)).not.toContain('/var/auctra')
    expect(JSON.stringify(unsafe)).not.toContain('rawprompt-echo')
  })

  it('publishes only owner gated actions, adding export.unit only when the pulse is export-ready', () => {
    expect(auctraSnapshotRead(workspace(), context).actions?.map(action => action.id)).toEqual([
      'candidate.create', 'review.accept', 'review.partial',
    ])
    const exportReady = auctraSnapshotRead(workspace({
      pulse: { blocked: 0, reviewPending: 1, drafting: 0, staleVariants: 0, exportReady: 2 },
    }), context)
    expect(exportReady.actions?.map(action => action.id)).toEqual([
      'candidate.create', 'review.accept', 'review.partial', 'export.unit',
    ])
  })
})

describe('auctraNegativeRead', () => {
  it('maps every owner negative kind to its honest status; timeout never becomes accept', () => {
    const expectations: Record<string, { status: string; freshness: string }> = {
      stale_revision: { status: 'stale', freshness: 'stale' },
      permission_denied: { status: 'permission_denied', freshness: 'unknown' },
      offline: { status: 'offline', freshness: 'unknown' },
      timeout: { status: 'unknown', freshness: 'unknown' },
    }
    for (const kind of AUCTRA_NEGATIVE_KINDS) {
      const read = auctraNegativeRead(kind, context)
      const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
      expect(parsed.status, kind).toBe(expectations[kind]?.status)
      expect(parsed.freshness, kind).toBe(expectations[kind]?.freshness)
      expect(read.actions, kind).toEqual([])
      expect(JSON.stringify(read).toLowerCase(), kind).not.toContain('accepted')
    }
    expect(AUCTRA_TIMEOUT_INTERPRETATION).toBe('unknown')
  })
})

describe('auctraPaneUnsafe', () => {
  it('rejects blank, credential-shaped and absolute-path refs only', () => {
    expect(auctraPaneUnsafe('unit:scene:1')).toBe(false)
    expect(auctraPaneUnsafe('review:2')).toBe(false)
    expect(auctraPaneUnsafe('   ')).toBe(true)
    expect(auctraPaneUnsafe('/tmp/secret.md')).toBe(true)
    expect(auctraPaneUnsafe('C:\\secret.md')).toBe(true)
    expect(auctraPaneUnsafe('unit:token-1')).toBe(true)
    expect(auctraPaneUnsafe('unit:authorization')).toBe(true)
  })
})

describe('auctraUnitArtifact', () => {
  it('maps a unit to ArtifactRefV1 carrying owner/ref/version only', () => {
    const artifact = auctraUnitArtifact({ ref: 'unit:scene:12', kind: 'scene', title: 'Scene 12', state: 'accepted', revision: '5', version: 5 })
    expect(artifact).toMatchObject({
      owner: 'auctra', kind: 'scene', ref: 'unit:scene:12', version: '5', mediaType: 'text/plain',
    })
    expect(artifact.capabilities).toEqual(['open', 'handoff', 'compare'])
    expect(JSON.stringify(artifact)).not.toContain('canonical')
  })

  it('rejects unsafe refs like the owner contract', () => {
    expect(() => auctraUnitArtifact({ ref: '/tmp/secret.md', title: 'bad', state: 'accepted' })).toThrow(TypeError)
  })
})

describe('createAuctraActionChannel', () => {
  const preview = { summary: 'Candidate vs canonical diff: +42 -8 lines (summary only).', expectedRevision: '5' }

  it('previews a server-authored descriptor with the owner version gate and no body field', async () => {
    const channel = createAuctraActionChannel({
      previewTarget: () => preview,
      submit: async () => ({ status: 'accepted', receiptRef: 'receipt:accept-1', actionId: 'review.accept', summary: 'Owner accepted.' }),
    })
    const raw = await channel.preview({ actionId: 'candidate.create', targetRef: 'unit:scene:12' })
    const descriptor = parsePaneActionDescriptor(raw)
    expect(descriptor.actionId).toBe('candidate.create')
    expect(descriptor.targetVersion).toBe('5')
    expect(descriptor.confirmation).toBe('approval')
    // candidate 正文永不经 Pane：descriptor 只声明 unit_ref，owner 侧组装 candidate。
    expect(descriptor.fields.map(field => field.key)).toEqual(['unit_ref'])
    expect(descriptor.fields.find(field => field.key === 'unit_ref')?.required).toBe(true)
  })

  it('returns not_available for actions and targets the owner did not publish', async () => {
    const channel = createAuctraActionChannel({ previewTarget: () => undefined, submit: async () => { throw new Error('must not be called') } })
    await expect(channel.preview({ actionId: 'review.accept', targetRef: 'review:1' })).resolves.toEqual({
      negative: 'not_available', reason: 'owner did not publish this action for target',
    })
    await expect(channel.preview({ actionId: 'canonical.overwrite', targetRef: 'unit:scene:12' })).resolves.toEqual({
      negative: 'not_available', reason: 'owner did not publish this action',
    })
  })

  it('forwards the owner decision request unchanged and returns the raw receipt', async () => {
    const submit = async (request: unknown) => request
    const channel = createAuctraActionChannel({ previewTarget: () => preview, submit })
    const raw = await channel.submit({
      schema: 'pane.action-request.v1alpha1', descriptorRef: 'descriptor:1', owner: 'auctra', actionId: 'review.accept',
      expectedTargetRef: 'review:1', expectedTargetVersion: '5', context, idempotencyKey: 'idem-0001', values: {},
    })
    expect(raw).toMatchObject({ actionId: 'review.accept', idempotencyKey: 'idem-0001' })
  })
})

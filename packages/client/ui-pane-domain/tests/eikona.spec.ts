import { describe, expect, it } from 'vitest'
import { PaneEventEnvelopeSchema, parsePaneActionDescriptor } from '@yeisme/dsh-pane-protocol'
import {
  EIKONA_NEGATIVE_KINDS,
  EIKONA_PANE_DEFAULT_MODEL,
  EIKONA_STREAM,
  createEikonaActionChannel,
  eikonaCardArtifact,
  eikonaNegativeRead,
  eikonaSnapshotRead,
  normalizeEikonaModelRef,
  type EikonaBoardLike,
} from '../src/eikona.ts'

const context = { workspaceRef: 'workspace:eikona-demo', sessionRef: 'session:one', principalRef: 'principal:local', revision: '7' }

function board(overrides: Partial<EikonaBoardLike> = {}): EikonaBoardLike {
  return {
    freshness: 'current',
    observedAt: '2026-08-21T00:00:00Z',
    cards: [
      { ref: 'artifact:eikona:hero-a', title: 'Hero pose A', category: 'character', lifecycleState: 'accepted', revision: '4' },
      { ref: 'artifact:eikona:hero-b', title: 'Hero pose B', category: 'character', lifecycleState: 'review', revision: '2' },
    ],
    ...overrides,
  }
}

describe('eikonaSnapshotRead', () => {
  it('builds a contract-shaped gallery envelope with the canonical default model', () => {
    const read = eikonaSnapshotRead(board(), context)
    const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
    expect(parsed.op).toBe('snapshot')
    expect(parsed.stream).toBe(EIKONA_STREAM)
    expect(parsed.status).toBe('ready')
    expect(parsed.freshness).toBe('fresh')
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities.map(entity => entity.value)).toEqual([
        { title: 'Hero pose A', kind: 'character', status: 'accepted', model_ref: EIKONA_PANE_DEFAULT_MODEL },
        { title: 'Hero pose B', kind: 'character', status: 'review', model_ref: EIKONA_PANE_DEFAULT_MODEL },
      ])
    }
  })

  it('maps freshness and repair honestly: stale, offline, reconcile_required', () => {
    const statusOf = (overrides: Partial<EikonaBoardLike>) =>
      PaneEventEnvelopeSchema.parse(eikonaSnapshotRead(board(overrides), context).snapshot).status
    expect(statusOf({ freshness: 'stale' })).toBe('stale')
    expect(statusOf({ freshness: 'expired' })).toBe('offline')
    expect(statusOf({ freshness: 'unknown' })).toBe('offline')
    expect(statusOf({ repairReason: 'cursor gap; snapshot re-read required' })).toBe('reconcile_required')
    expect(statusOf({ freshness: 'stale', repairReason: 'board rebuilt' })).toBe('reconcile_required')
  })

  it('skips unsafe refs exactly like the owner contract', () => {
    const unsafe = eikonaSnapshotRead(board({
      cards: [
        { ref: '/tmp/secret.png', title: 'path', lifecycleState: 'accepted' },
        { ref: 'https://cdn.example.com/img.png', title: 'url', lifecycleState: 'accepted' },
        { ref: 'artifact:token-img', title: 'credential shaped', lifecycleState: 'accepted' },
        { ref: '  ', title: 'blank', lifecycleState: 'accepted' },
        { ref: 'artifact:eikona:clean', title: 'Clean image', lifecycleState: 'accepted' },
      ],
    }), context)
    const parsed = PaneEventEnvelopeSchema.parse(unsafe.snapshot)
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities).toHaveLength(1)
      expect(parsed.payload.entities[0]?.ref).toBe('artifact:eikona:clean')
    }
    expect(JSON.stringify(unsafe)).not.toContain('/tmp/secret.png')
    expect(JSON.stringify(unsafe)).not.toContain('cdn.example.com')
  })

  it('publishes exactly the owner gated actions: generate preview, accept, reject', () => {
    expect(eikonaSnapshotRead(board(), context).actions?.map(action => action.id)).toEqual([
      'generate.preview', 'review.accept', 'review.reject',
    ])
    expect(eikonaNegativeRead('offline', context).actions).toEqual([])
  })
})

describe('eikonaNegativeRead', () => {
  it('maps every owner negative kind to its honest status without actions', () => {
    const expectations: Record<string, { status: string; freshness: string }> = {
      gap: { status: 'reconcile_required', freshness: 'stale' },
      expired_cursor: { status: 'reconcile_required', freshness: 'stale' },
      permission_denied: { status: 'permission_denied', freshness: 'unknown' },
      contract_mismatch: { status: 'contract_mismatch', freshness: 'unknown' },
      offline: { status: 'offline', freshness: 'unknown' },
    }
    for (const kind of EIKONA_NEGATIVE_KINDS) {
      const read = eikonaNegativeRead(kind, context)
      const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
      expect(parsed.status, kind).toBe(expectations[kind]?.status)
      expect(parsed.freshness, kind).toBe(expectations[kind]?.freshness)
      expect(read.actions, kind).toEqual([])
    }
  })
})

describe('normalizeEikonaModelRef', () => {
  it('normalizes legacy aliases at ingress only; other values pass through untouched', () => {
    expect(normalizeEikonaModelRef('gpt-5.4-image-2')).toBe('openai/gpt-5.4-image-2')
    expect(normalizeEikonaModelRef('gpt-image-2')).toBe('openai/gpt-5.4-image-2')
    expect(normalizeEikonaModelRef('openai/gpt-5.4-image-2')).toBe('openai/gpt-5.4-image-2')
    expect(normalizeEikonaModelRef('GPT-Image-2')).toBe('openai/gpt-5.4-image-2')
    // 非 legacy 别名原样交给 owner 校验：DSH 侧不做第二套 schema。
    expect(normalizeEikonaModelRef('custom/model-x')).toBe('custom/model-x')
  })
})

describe('eikonaCardArtifact', () => {
  it('maps a card to ArtifactRefV1 with image capabilities', () => {
    const artifact = eikonaCardArtifact({ ref: 'artifact:eikona:hero-a', title: 'Hero pose A', category: 'character', lifecycleState: 'accepted', revision: '4' })
    expect(artifact).toMatchObject({
      owner: 'eikona', kind: 'image', ref: 'artifact:eikona:hero-a', version: '4', mediaType: 'image/png',
    })
    expect(artifact.capabilities).toEqual(['open', 'compare', 'handoff', 'attach_context'])
  })

  it('rejects unsafe refs like the owner contract', () => {
    expect(() => eikonaCardArtifact({ ref: '/tmp/secret.png', title: 'bad', lifecycleState: 'accepted' })).toThrow(TypeError)
  })
})

describe('createEikonaActionChannel', () => {
  const preview = { summary: 'Generate one variant from the owner-held prompt.', expectedRevision: '4', modelRef: 'gpt-image-2' }

  it('previews a server-authored generate descriptor with the canonical model and a prompt ref, never a raw prompt', async () => {
    const channel = createEikonaActionChannel({
      previewArtifact: () => preview,
      submit: async () => ({ status: 'accepted', receiptRef: 'receipt:gen-1', actionId: 'generate.preview', summary: 'Preview generated.' }),
    })
    const raw = await channel.preview({ actionId: 'generate.preview', targetRef: 'artifact:eikona:hero-a' })
    const descriptor = parsePaneActionDescriptor(raw)
    expect(descriptor.actionId).toBe('generate.preview')
    expect(descriptor.targetVersion).toBe('4')
    expect(descriptor.fields.map(field => field.key)).toEqual(['prompt_ref', 'model_ref'])
    expect(descriptor.fields.find(field => field.key === 'prompt_ref')?.required).toBe(true)
    // 入射点归一化：owner 给的 legacy 别名在 descriptor 中只出现 canonical 形态。
    expect(JSON.stringify(descriptor)).not.toContain('gpt-image-2')
    expect(JSON.stringify(descriptor)).toContain('openai/gpt-5.4-image-2')
    expect(JSON.stringify(descriptor).toLowerCase()).not.toContain('rawprompt')
  })

  it('returns not_available for actions and targets the owner did not publish', async () => {
    const channel = createEikonaActionChannel({ previewArtifact: () => undefined, submit: async () => { throw new Error('must not be called') } })
    await expect(channel.preview({ actionId: 'review.accept', targetRef: 'artifact:eikona:hero-b' })).resolves.toEqual({
      negative: 'not_available', reason: 'owner did not publish this action for target',
    })
    await expect(channel.preview({ actionId: 'gallery.wipe', targetRef: 'artifact:eikona:hero-b' })).resolves.toEqual({
      negative: 'not_available', reason: 'owner did not publish this action',
    })
  })

  it('forwards the owner decision request unchanged and returns the raw receipt', async () => {
    const submit = async (request: unknown) => request
    const channel = createEikonaActionChannel({ previewArtifact: () => preview, submit })
    const raw = await channel.submit({
      schema: 'pane.action-request.v1alpha1', descriptorRef: 'descriptor:1', owner: 'eikona', actionId: 'review.accept',
      expectedTargetRef: 'artifact:eikona:hero-b', expectedTargetVersion: '4', context, idempotencyKey: 'idem-0002', values: {},
    })
    expect(raw).toMatchObject({ actionId: 'review.accept', idempotencyKey: 'idem-0002' })
  })
})

import { describe, expect, it } from 'vitest'
import { PaneEventEnvelopeSchema, parsePaneActionDescriptor } from '@yeisme/dsh-pane-protocol'
import {
  SONORA_NEGATIVE_KINDS,
  SONORA_STREAM,
  createSonoraActionChannel,
  sonoraNegativeRead,
  sonoraSnapshotRead,
  type SonoraBoardLike,
} from '../src/sonora.ts'

const context = { workspaceRef: 'workspace:sonora-demo', sessionRef: 'session:one', principalRef: 'principal:local', revision: '1' }

function board(overrides: Partial<SonoraBoardLike> = {}): SonoraBoardLike {
  return {
    takes: [
      { resourceRef: 'take:voice-a', title: 'Voice take A', lane: 'ready', revision: '3' },
      { resourceRef: 'take:voice-b', title: 'Voice take B', lane: 'review', revision: '1' },
    ],
    freshness: 'fresh',
    rightsPreview: true,
    costPreview: true,
    ...overrides,
  }
}

describe('sonoraSnapshotRead', () => {
  it('builds a contract-shaped snapshot envelope the protocol accepts', () => {
    const read = sonoraSnapshotRead(board(), context)
    const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
    expect(parsed.op).toBe('snapshot')
    expect(parsed.stream).toBe(SONORA_STREAM)
    expect(parsed.sequence).toBe(-1)
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities.map(entity => entity.value)).toEqual([
        { title: 'Voice take A', kind: 'take', status: 'ready' },
        { title: 'Voice take B', kind: 'take', status: 'review' },
      ])
    }
  })

  it('publishes render/accept only when both rights and cost previews exist', () => {
    expect(sonoraSnapshotRead(board(), context).actions?.map(action => action.id)).toEqual(['render.take', 'review.accept'])
    expect(sonoraSnapshotRead(board({ rightsPreview: false }), context).actions).toEqual([])
    expect(sonoraSnapshotRead(board({ costPreview: false }), context).actions).toEqual([])
  })

  it('skips unsafe refs exactly like the owner contract', () => {
    const unsafe = sonoraSnapshotRead(board({
      takes: [
        { resourceRef: '/var/audio/take.wav', title: 'path', lane: 'ready' },
        { resourceRef: 'take:sse-token', title: 'credential shaped', lane: 'ready' },
        { resourceRef: '  ', title: 'blank', lane: 'ready' },
        { resourceRef: 'take:clean', title: 'Clean take', lane: 'ready' },
      ],
    }), context)
    const parsed = PaneEventEnvelopeSchema.parse(unsafe.snapshot)
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities).toHaveLength(1)
      expect(parsed.payload.entities[0]?.ref).toBe('take:clean')
    }
    expect(JSON.stringify(unsafe)).not.toContain('/var/audio')
    expect(JSON.stringify(unsafe)).not.toContain('sse-token')
  })
})

describe('sonoraNegativeRead', () => {
  it('maps every owner negative kind to its honest status without actions', () => {
    const expectations: Record<string, { status: string; freshness: string }> = {
      duplicate: { status: 'ready', freshness: 'fresh' },
      gap: { status: 'reconcile_required', freshness: 'stale' },
      expired_cursor: { status: 'reconcile_required', freshness: 'stale' },
      offline: { status: 'offline', freshness: 'unknown' },
      approval_required: { status: 'approval_required', freshness: 'fresh' },
    }
    for (const kind of SONORA_NEGATIVE_KINDS) {
      const read = sonoraNegativeRead(kind, context)
      const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
      expect(parsed.status, kind).toBe(expectations[kind]?.status)
      expect(parsed.freshness, kind).toBe(expectations[kind]?.freshness)
      expect(read.actions, kind).toEqual([])
    }
  })
})

describe('createSonoraActionChannel', () => {
  const cost = { currency: 'USD', amount: 0.12, estimate: true }
  const rights = { status: 'clear', summary: 'Workspace voice rights cover this take.' }

  it('previews a server-authored descriptor with cost and rights', async () => {
    const channel = createSonoraActionChannel({
      previewTake: () => ({ cost, rights }),
      submitTake: async () => ({ status: 'accepted', receiptRef: 'receipt:render-1', actionId: 'render.take', summary: 'Rendered' }),
    })
    const raw = await channel.preview({ actionId: 'render.take', targetRef: 'take:voice-a' })
    const descriptor = parsePaneActionDescriptor(raw)
    expect(descriptor.actionId).toBe('render.take')
    expect(descriptor.targetRef).toBe('take:voice-a')
    expect(descriptor.preview.cost).toEqual(cost)
    expect(descriptor.preview.rights?.status).toBe('clear')
    expect(descriptor.confirmation).toBe('approval')
  })

  it('returns approval_required when the owner has no rights or cost preview', async () => {
    const channel = createSonoraActionChannel({ previewTake: () => undefined, submitTake: async () => { throw new Error('must not be called') } })
    await expect(channel.preview({ actionId: 'render.take', targetRef: 'take:voice-a' })).resolves.toEqual({
      negative: 'approval_required',
      reason: 'rights_or_cost_preview_missing',
    })
  })

  it('forwards the owner decision request unchanged and returns the raw receipt', async () => {
    const submitTake = async (request: unknown) => request
    const channel = createSonoraActionChannel({ previewTake: () => ({ cost, rights }), submitTake })
    const raw = await channel.submit({ schema: 'pane.action-request.v1alpha1', descriptorRef: 'descriptor:1', owner: 'sonora', actionId: 'render.take', expectedTargetRef: 'take:voice-a', expectedTargetVersion: '3', context, idempotencyKey: 'idem-0001', values: {} })
    expect(raw).toMatchObject({ actionId: 'render.take', idempotencyKey: 'idem-0001' })
  })
})

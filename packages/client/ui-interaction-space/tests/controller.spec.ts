import { describe, expect, it, vi } from 'vitest'
import { InteractionSpaceController, type OwnerDispatchFace, type SpaceSessionsFace } from '../src/controller.ts'
import { SPACE_PROTOCOL_LIMITS } from '../src/contracts.ts'
import type { SelectionAnchorV1, TableRangeAnchorV1 } from '@yeisme/dsh-selection-host'

const AT = '2026-08-29T10:00:00Z'
const DIGEST = 'a'.repeat(64)

function tableAnchor(anchorId: string, marker?: number): TableRangeAnchorV1 {
  return {
    kind: 'table-range',
    anchorId,
    artifactRef: 'file:data.csv',
    artifactVersion: 'v1',
    sheetId: 'sheet-1',
    rowFrom: 3,
    rowTo: 7,
    colFrom: 2,
    colTo: 4,
    quotePreview: 'A1:B4',
    quoteDigest: DIGEST,
    createdAt: AT,
    freshness: 'fresh',
    ...(marker === undefined ? {} : { marker }),
  }
}

function proposeDirective(directiveId: string, proposalId: string, anchorIds: string[] = ['anc-1']): Record<string, unknown> {
  return {
    directiveId,
    kind: 'propose',
    createdAt: AT,
    proposal: {
      proposalId,
      anchorIds,
      baseVersion: 'v1',
      safeSummary: `提案 ${proposalId}`,
      payload: { format: 'table-cells', sheetId: 'sheet-1', cells: [{ row: 3, col: 2, before: '旧', after: '新' }] },
    },
  }
}

describe('InteractionSpaceController', () => {
  it('ingests valid directives into the timeline and proposals', () => {
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'file:data.csv', version: 'v1', title: 'data.csv', mediaType: 'text/csv' },
      now: () => AT,
    })
    controller.addAnchor(tableAnchor('anc-1', 1))
    expect(controller.ingestDirective(proposeDirective('dir-1', 'prop-1'))).toBeUndefined()
    const snapshot = controller.getSnapshot()
    expect(snapshot.proposals).toHaveLength(1)
    expect(snapshot.proposals[0]?.lifecycle).toBe('review')
    expect(snapshot.timeline.some(entry => entry.kind === 'propose')).toBe(true)
  })

  it('records typed rejections in the timeline instead of rendering them', () => {
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/plain' },
      now: () => AT,
    })
    const rejection = controller.ingestDirective({ directiveId: 'd', kind: 'highlight', anchorIds: ['ghost'], createdAt: AT })
    expect(rejection?.code).toBe('unknown_anchor')
    expect(controller.getSnapshot().timeline.some(entry => entry.kind === 'rejected')).toBe(true)
  })

  it('merges highlight bursts inside the throttle window', () => {
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/plain' },
      now: () => AT,
    })
    controller.addAnchor(tableAnchor('anc-1'))
    controller.ingestDirective({ directiveId: 'h1', kind: 'highlight', anchorIds: ['anc-1'], createdAt: '2026-08-29T10:00:00.000Z' })
    controller.ingestDirective({ directiveId: 'h2', kind: 'highlight', anchorIds: ['anc-1'], createdAt: '2026-08-29T10:00:00.500Z' })
    controller.ingestDirective({ directiveId: 'h3', kind: 'highlight', anchorIds: ['anc-1'], createdAt: '2026-08-29T10:00:02.000Z' })
    const highlights = controller.getSnapshot().timeline.filter(entry => entry.kind === 'highlight')
    expect(highlights).toHaveLength(2)
  })

  it('rolls the timeline at 200 entries', () => {
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/plain' },
      now: () => AT,
    })
    for (let index = 0; index < SPACE_PROTOCOL_LIMITS.timelineEntries + 20; index += 1) {
      controller.ingestDirective({ directiveId: `p-${index}`, kind: 'progress', runRef: `ordo:run-${index}`, stage: 'step', createdAt: AT })
    }
    expect(controller.getSnapshot().timeline).toHaveLength(SPACE_PROTOCOL_LIMITS.timelineEntries)
  })

  it('caps anchors at the budget', () => {
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/plain' },
      now: () => AT,
    })
    for (let index = 0; index < SPACE_PROTOCOL_LIMITS.anchorsPerSpace; index += 1) {
      expect(controller.addAnchor(tableAnchor(`anc-${index}`))).toBe(true)
    }
    expect(controller.addAnchor(tableAnchor('anc-overflow'))).toBe(false)
    expect(controller.getSnapshot().anchors).toHaveLength(SPACE_PROTOCOL_LIMITS.anchorsPerSpace)
  })

  it('marks anchors stale and proposals reconcile_required on version bump', () => {
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/csv' },
      now: () => AT,
    })
    controller.addAnchor(tableAnchor('anc-1'))
    controller.ingestDirective(proposeDirective('dir-1', 'prop-1'))
    controller.bumpVersion('v2')
    const snapshot = controller.getSnapshot()
    expect(snapshot.drifted).toBe(true)
    expect(snapshot.anchors[0]?.freshness).toBe('stale')
    expect(snapshot.proposals[0]?.lifecycle).toBe('reconcile_required')
  })

  it('applies proposals through preview-before-mutate and writes the receipt', async () => {
    const dispatch: OwnerDispatchFace = {
      dispatch: vi.fn(async () => ({ kind: 'applied' as const, receiptRef: 'rcpt-1', nextVersion: 'v2' })),
    }
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/csv' },
      dispatch,
      now: () => AT,
    })
    controller.addAnchor(tableAnchor('anc-1'))
    controller.ingestDirective(proposeDirective('dir-1', 'prop-1'))
    controller.decideHunk('prop-1', 'cell-0', 'approved')
    await controller.applyProposal('prop-1')
    const snapshot = controller.getSnapshot()
    expect(snapshot.proposals[0]?.lifecycle).toBe('applied')
    expect(snapshot.proposals[0]?.receiptRef).toBe('rcpt-1')
    expect(snapshot.version).toBe('v2')
    expect(snapshot.timeline.some(entry => entry.kind === 'receipt')).toBe(true)
    expect(dispatch.dispatch).toHaveBeenCalledOnce()
  })

  it('never retries unknown settlement and degrades without an owner adapter', async () => {
    const dispatch: OwnerDispatchFace = { dispatch: vi.fn(async () => ({ kind: 'unknown' as const })) }
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/csv' },
      dispatch,
      now: () => AT,
    })
    controller.addAnchor(tableAnchor('anc-1'))
    controller.ingestDirective(proposeDirective('dir-1', 'prop-1'))
    await controller.applyProposal('prop-1')
    expect(controller.getSnapshot().proposals[0]?.lifecycle).toBe('reconcile_required')
    expect(dispatch.dispatch).toHaveBeenCalledOnce()

    const bare = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/csv' },
      now: () => AT,
    })
    bare.addAnchor(tableAnchor('anc-1'))
    bare.ingestDirective(proposeDirective('dir-1', 'prop-2'))
    await bare.applyProposal('prop-2')
    expect(bare.getSnapshot().proposals[0]?.error).toBe('owner-adapter-unavailable')
  })
})

describe('main selection invariant', () => {
  function sessionsFace(openCount: { calls: number }): SpaceSessionsFace {
    const binding = {
      sessionId: 's-1',
      prompt: vi.fn(async () => ({ ok: true })),
      cancel: vi.fn(async () => ({ ok: true })),
      subscribe: (_listener: () => void) => () => {},
      getSnapshot: () => ({ running: false, removed: false }),
    }
    const face: SpaceSessionsFace & { open?: () => void; openSubagent?: () => void; clear?: () => void } = {
      binding: () => binding,
      fork: vi.fn(async () => 's-2'),
    }
    // 主选择 API 只存在于 spy 对象上，控制器必须永不触碰。
    face.open = () => { openCount.calls += 1 }
    face.openSubagent = () => { openCount.calls += 1 }
    face.clear = () => { openCount.calls += 1 }
    return face
  }

  it('attaches/forks/prompts without ever calling open/openSubagent/clear', async () => {
    const openCount = { calls: 0 }
    const sessions = sessionsFace(openCount)
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/plain' },
      sessions,
      now: () => AT,
    })
    controller.attachSession('s-1')
    expect(controller.getSnapshot().sessionPhase).toBe('attached')
    await controller.promptSession('帮我处理这批锚点')
    await controller.forkSession()
    controller.detachSession()
    expect(openCount.calls).toBe(0)
  })

  it('degrades to needs_contract without the sessions face', () => {
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/plain' },
      now: () => AT,
    })
    controller.attachSession('s-1')
    const snapshot = controller.getSnapshot()
    expect(snapshot.sessionPhase).toBe('unresolvable')
    expect(snapshot.sessionError).toBe('needs_contract')
  })

  it('sends anchors through the composer adapter as structured ids', async () => {
    const send = vi.fn(async () => ({ ok: true }))
    const controller = new InteractionSpaceController({
      resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/csv' },
      composer: { send },
      now: () => AT,
    })
    controller.addAnchor(tableAnchor('anc-1'))
    const result = await controller.sendToAgent({ intent: 'ask', text: '这批单元格怎么处理？', anchorIds: ['anc-1'] })
    expect(result.ok).toBe(true)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ intent: 'ask', anchorIds: ['anc-1'], approvalPolicy: 'preview-first' }))
  })
})

import { describe, expect, it } from 'vitest'
import { createInMemoryVersionedFileStore, createSelectionAnnotationService } from '../src/node.ts'
import { computeQuoteDigest } from '../src/index.ts'

async function setup() {
  const { store } = createInMemoryVersionedFileStore({ 'file:shot.png': '' })
  const service = createSelectionAnnotationService({ fileStore: store })
  const digest = await computeQuoteDigest('选中文字')
  const anchors = [
    service.publishAnchor({
      kind: 'image-region',
      artifactRef: 'file:shot.png',
      artifactVersion: 'img-v1',
      quotePreview: '编辑模式布局需要调整',
      quoteDigest: digest,
      x: 0.2,
      y: 0.3,
      width: 0.4,
      height: 0.2,
    }),
    service.publishAnchor({
      kind: 'image-point',
      artifactRef: 'file:shot.png',
      artifactVersion: 'img-v1',
      quotePreview: '按钮图标不清晰',
      quoteDigest: digest,
      x: 0.1,
      y: 0.05,
    }),
  ]
  return { service, anchors }
}

describe('annotation batches', () => {
  it('walks draft -> submitted -> resolved and assigns stable markers', async () => {
    const { service, anchors } = await setup()
    const batch = service.createBatch({ title: '截图批注', anchorIds: anchors.map(a => a.anchorId) })
    expect(batch.status).toBe('draft')

    const submitted = service.submitBatch(batch.batchId)
    expect(submitted.status).toBe('submitted')
    expect(submitted.anchors[0].marker).toBe(1)
    expect(submitted.anchors[1].marker).toBe(2)

    const resolved = service.resolveBatch(batch.batchId)
    expect(resolved.status).toBe('resolved')

    expect(() => service.submitBatch(batch.batchId)).toThrow(/already resolved/)
  })

  it('supports at least 20 independent markers on one screenshot', async () => {
    const { store: s2 } = createInMemoryVersionedFileStore({ 'file:big.png': '' })
    const service = createSelectionAnnotationService({ fileStore: s2 })
    const digest = await computeQuoteDigest('m')
    const ids = Array.from({ length: 20 }, (_, index) =>
      service.publishAnchor({
        kind: 'image-point',
        artifactRef: 'file:big.png',
        artifactVersion: 'img-v1',
        quotePreview: `标记 ${index + 1}`,
        quoteDigest: digest,
        x: (index % 5) / 5,
        y: Math.floor(index / 5) / 5,
      }).anchorId)
    const batch = service.submitBatch(service.createBatch({ title: '多点', anchorIds: ids }).batchId)
    expect(batch.anchors).toHaveLength(20)
    expect(batch.anchors[19].marker).toBe(20)
  })

  it('builds an untrusted agent request whose replies must reference markers', async () => {
    const { service, anchors } = await setup()
    const batch = service.submitBatch(service.createBatch({ title: '截图批注', anchorIds: anchors.map(a => a.anchorId) }).batchId)
    const request = service.buildAgentRequest(batch.batchId)
    expect(request.untrustedContext).toBe(true)
    expect(request.replyContract).toBe('reply-must-reference-markers')
    expect(request.markers.map(m => m.label)).toEqual(['#1', '#2'])
    expect(JSON.stringify(request)).not.toContain('cookie')
    expect(JSON.stringify(request)).not.toContain('authorization')
  })

  it('refuses batch operations on unknown or empty anchors', async () => {
    const { service } = await setup()
    expect(() => service.createBatch({ title: '空', anchorIds: [] })).toThrow(/at least one anchor/)
    expect(() => service.submitBatch('batch-missing')).toThrow(/unknown batch/)
  })
})

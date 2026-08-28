import { describe, expect, it } from 'vitest'
import { createInMemoryVersionedFileStore, createSelectionAnnotationService } from '../src/node.ts'
import { computeQuoteDigest, redactUnsafeFields } from '../src/index.ts'

const FILE_A = 'file:src/page.tsx'
const FILE_B = 'file:README.md'

const FILE_A_CONTENT = ['line-1', 'line-2', 'line-3', 'line-4', 'line-5'].join('\n')
const FILE_B_CONTENT = ['# title', '', 'body one', 'body two'].join('\n')

function setup() {
  const { store, mutateExternally } = createInMemoryVersionedFileStore({
    [FILE_A]: FILE_A_CONTENT,
    [FILE_B]: FILE_B_CONTENT,
  })
  const service = createSelectionAnnotationService({ fileStore: store })
  return { service, store, mutateExternally }
}

async function anchorOn(service: ReturnType<typeof createSelectionAnnotationService>, artifactRef: string, preview: string) {
  return service.publishAnchor({
    kind: 'file-range',
    artifactRef,
    artifactVersion: 'v0',
    quotePreview: preview,
    quoteDigest: await computeQuoteDigest(preview),
    startLine: 2,
    endLine: 2,
    startColumn: 0,
    endColumn: preview.length,
  })
}

describe('in-memory annotation service closed loop', () => {
  it('runs selection -> batch -> proposal -> partial approval -> fenced apply', async () => {
    const { service, store } = setup()
    const anchorA = await anchorOn(service, FILE_A, 'line-2')
    const anchorB = await anchorOn(service, FILE_A, 'line-4')
    const anchorC = await anchorOn(service, FILE_B, 'body one')

    const batch = service.submitBatch(service.createBatch({ title: '三处修改', anchorIds: [anchorA.anchorId, anchorB.anchorId, anchorC.anchorId] }).batchId)
    expect(batch.anchors.map(a => a.marker)).toEqual([1, 2, 3])

    const versionA = store.currentVersion(FILE_A)
    const versionB = store.currentVersion(FILE_B)
    expect(versionA).toBeDefined()
    expect(versionB).toBeDefined()

    const patchA = service.registerPatch({ artifactRef: FILE_A, baseVersion: versionA!, ranges: [{ startLine: 2, endLine: 2, replacement: ['line-2 (patched)'] }] })
    const patchB = service.registerPatch({ artifactRef: FILE_A, baseVersion: versionA!, ranges: [{ startLine: 4, endLine: 4, replacement: ['line-4 (patched)'] }] })
    const patchC = service.registerPatch({ artifactRef: FILE_B, baseVersion: versionB!, ranges: [{ startLine: 3, endLine: 4, replacement: ['body one (patched)'] }] })

    const proposal = service.createProposal({
      title: '修改提案 · 3 个位置',
      batchId: batch.batchId,
      hunks: [
        { anchorId: anchorA.anchorId, owner: 'file-host', baseVersion: versionA!, safeSummary: '#1 Footer icon', patchRef: patchA },
        { anchorId: anchorB.anchorId, owner: 'file-host', baseVersion: versionA!, safeSummary: '#2 Markdown editor', patchRef: patchB },
        { anchorId: anchorC.anchorId, owner: 'file-host', baseVersion: versionB!, safeSummary: '#3 Status message', patchRef: patchC },
      ],
    })

    // Approve #1/#3, reject #2: only approved patches may land.
    service.decide(proposal.proposalId, proposal.hunks[0].hunkId, 'approved')
    service.decide(proposal.proposalId, proposal.hunks[2].hunkId, 'approved')
    service.decide(proposal.proposalId, proposal.hunks[1].hunkId, 'rejected')

    const receipts = service.applyApproved(proposal.proposalId)
    expect(receipts.filter(r => r.action === 'apply' && r.status === 'ok').map(r => r.anchorId).sort())
      .toEqual([anchorA.anchorId, anchorC.anchorId].sort())
    expect(store.readLines(FILE_A)).toEqual(['line-1', 'line-2 (patched)', 'line-3', 'line-4', 'line-5'])
    expect(store.readLines(FILE_B)).toEqual(['# title', '', 'body one (patched)'])

    const after = service.getProposal(proposal.proposalId)
    expect(after?.hunks.map(h => h.decision)).toEqual(['applied', 'rejected', 'applied'])
    // Every approve/reject/apply produced an owner receipt.
    expect(service.receipts(proposal.proposalId).length).toBeGreaterThanOrEqual(5)
  })

  it('blocks a dependent hunk when its dependency is rejected, but independent hunks still land', async () => {
    const { service, store } = setup()
    const anchorA = await anchorOn(service, FILE_A, 'line-2')
    const anchorB = await anchorOn(service, FILE_A, 'line-3')
    const anchorC = await anchorOn(service, FILE_B, 'body one')
    const versionA = store.currentVersion(FILE_A)!
    const versionB = store.currentVersion(FILE_B)!
    const patchA = service.registerPatch({ artifactRef: FILE_A, baseVersion: versionA, ranges: [{ startLine: 2, endLine: 2, replacement: ['A'] }] })
    const patchB = service.registerPatch({ artifactRef: FILE_A, baseVersion: versionA, ranges: [{ startLine: 3, endLine: 3, replacement: ['B'] }] })
    const patchC = service.registerPatch({ artifactRef: FILE_B, baseVersion: versionB, ranges: [{ startLine: 3, endLine: 3, replacement: ['C'] }] })
    const proposal = service.createProposal({
      title: '依赖组',
      hunks: [
        { key: 'a', anchorId: anchorA.anchorId, owner: 'file-host', baseVersion: versionA, safeSummary: 'depends on b', patchRef: patchA, dependencies: ['b'] },
        { key: 'b', anchorId: anchorB.anchorId, owner: 'file-host', baseVersion: versionA, safeSummary: 'b', patchRef: patchB },
        { key: 'c', anchorId: anchorC.anchorId, owner: 'file-host', baseVersion: versionB, safeSummary: 'independent', patchRef: patchC },
      ],
    })
    const [hunkA, hunkB, hunkC] = proposal.hunks
    expect(hunkA.dependencies).toEqual([hunkB.hunkId])

    service.decide(proposal.proposalId, hunkA.hunkId, 'approved')
    service.decide(proposal.proposalId, hunkB.hunkId, 'rejected')
    service.decide(proposal.proposalId, hunkC.hunkId, 'approved')

    const receipts = service.applyApproved(proposal.proposalId)
    const blocked = receipts.find(r => r.status === 'blocked')
    expect(blocked).toBeDefined()
    expect(blocked?.reason).toContain(hunkB.hunkId)
    expect(store.readLines(FILE_A)).toEqual(['line-1', 'line-2', 'line-3', 'line-4', 'line-5'])
    expect(store.readLines(FILE_B)).toEqual(['# title', '', 'C', 'body two'])
    expect(service.getProposal(proposal.proposalId)?.hunks.map(h => h.decision)).toEqual(['approved', 'rejected', 'applied'])
  })

  it('enters reconcile_required on external drift and never overwrites', async () => {
    const { service, store, mutateExternally } = setup()
    const anchor = await anchorOn(service, FILE_A, 'line-2')
    const version = store.currentVersion(FILE_A)!
    const patch = service.registerPatch({ artifactRef: FILE_A, baseVersion: version, ranges: [{ startLine: 2, endLine: 2, replacement: ['外部会看到我吗'] }] })
    const proposal = service.createProposal({
      title: '漂移',
      hunks: [{ anchorId: anchor.anchorId, owner: 'file-host', baseVersion: version, safeSummary: 'patch line 2', patchRef: patch }],
    })
    service.decide(proposal.proposalId, proposal.hunks[0].hunkId, 'approved')
    mutateExternally(FILE_A, ['line-1', 'external rewrite', 'line-3', 'line-4', 'line-5'])

    const receipts = service.applyApproved(proposal.proposalId)
    expect(receipts[0].status).toBe('conflict')
    expect(receipts[0].action).toBe('reconcile')
    expect(store.readLines(FILE_A)).toEqual(['line-1', 'external rewrite', 'line-3', 'line-4', 'line-5'])
    expect(service.getProposal(proposal.proposalId)?.hunks[0].decision).toBe('reconcile_required')
  })

  it('marks drifted hunks stale via refreshStaleness and blocks pending decisions after terminal states', async () => {
    const { service, store, mutateExternally } = setup()
    const anchor = await anchorOn(service, FILE_A, 'line-2')
    const version = store.currentVersion(FILE_A)!
    const patch = service.registerPatch({ artifactRef: FILE_A, baseVersion: version, ranges: [{ startLine: 2, endLine: 2, replacement: ['x'] }] })
    const proposal = service.createProposal({
      title: 'stale',
      hunks: [{ anchorId: anchor.anchorId, owner: 'file-host', baseVersion: version, safeSummary: 'x', patchRef: patch }],
    })
    mutateExternally(FILE_A, ['changed'])
    const staleReceipts = service.refreshStaleness(proposal.proposalId)
    expect(staleReceipts).toHaveLength(1)
    expect(staleReceipts[0].action).toBe('stale')
    expect(service.getProposal(proposal.proposalId)?.hunks[0].decision).toBe('stale')
  })

  it('never accepts browser patch strings: proposals only take owner patchRefs', async () => {
    const { service } = setup()
    const anchor = await anchorOn(service, FILE_A, 'line-2')
    expect(() => service.createProposal({
      title: '注入',
      hunks: [{ anchorId: anchor.anchorId, owner: 'file-host', baseVersion: 'v1', safeSummary: 'raw patch', patchRef: 'patch-not-registered' }],
    })).toThrow(/registered host-side/)
  })

  it('keeps receipts free of unsafe fields', async () => {
    const { service, store } = setup()
    const anchor = await anchorOn(service, FILE_A, 'line-2')
    const version = store.currentVersion(FILE_A)!
    const patch = service.registerPatch({ artifactRef: FILE_A, baseVersion: version, ranges: [{ startLine: 2, endLine: 2, replacement: ['x'] }] })
    const proposal = service.createProposal({
      title: '脱敏',
      hunks: [{ anchorId: anchor.anchorId, owner: 'file-host', baseVersion: version, safeSummary: 'x', patchRef: patch }],
    })
    service.decide(proposal.proposalId, proposal.hunks[0].hunkId, 'approved')
    service.applyApproved(proposal.proposalId)
    const serialized = JSON.stringify(redactUnsafeFields(service.receipts(proposal.proposalId)))
    expect(serialized).not.toMatch(/"(cookie|authorization|token|secret|rawprompt)"/i)
  })
})

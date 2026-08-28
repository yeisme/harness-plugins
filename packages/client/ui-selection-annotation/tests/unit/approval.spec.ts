import { describe, expect, it, vi } from 'vitest'
import { ApprovalPanelController, type ApprovalServiceAdapter } from '../../src/client/approval.ts'
import type { ApplyReceiptV1, ProposalHunkV1, ProposalV1 } from '@yeisme/dsh-selection-host'

function hunk(hunkId: string, decision: ProposalHunkV1['decision'], dependencies: string[] = [], patchRef = `patch-${hunkId}`): ProposalHunkV1 {
  return {
    hunkId,
    anchorId: `anc-${hunkId}`,
    owner: 'file-host',
    baseVersion: 'v1',
    safeSummary: `summary ${hunkId}`,
    patchRef,
    dependencies,
    decision,
  }
}

function receipt(action: ApplyReceiptV1['action'], status: ApplyReceiptV1['status'] = 'ok'): ApplyReceiptV1 {
  return {
    receiptId: `rcpt-${Math.random().toString(36).slice(2, 8)}`,
    proposalId: 'prop-1',
    hunkId: 'hunk-current',
    anchorId: 'anc-x',
    action,
    status,
    decidedAt: '2026-08-28T10:00:00Z',
  }
}

function adapterFor(proposal: ProposalV1, versions: Map<string, string>) {
  const current = { ...proposal, hunks: proposal.hunks.map(h => ({ ...h })) }
  return {
    getProposal: vi.fn(async () => current),
    decide: vi.fn(async (_proposalId: string, hunkId: string, decision: ProposalHunkV1['decision']) => {
      const target = current.hunks.find(h => h.hunkId === hunkId)
      if (target !== undefined) target.decision = decision
      return receipt(decision === 'approved' ? 'approve' : 'reject')
    }),
    applyApproved: vi.fn(async () => [receipt('apply')]),
    currentVersion: vi.fn((artifactRef: string) => versions.get(artifactRef)),
    artifactRefFor: (hunk: ProposalHunkV1) => `file:${hunk.patchRef}`,
  } satisfies ApprovalServiceAdapter & Record<string, unknown>
}

describe('approval panel controller', () => {
  it('refreshes rows with per-position markers, blockers and conflicts', async () => {
    const proposal: ProposalV1 = {
      proposalId: 'prop-1',
      title: '修改提案 · 3 个位置',
      hunks: [hunk('a', 'approved', ['b']), hunk('b', 'rejected'), hunk('c', 'pending')],
      createdAt: '2026-08-28T10:00:00Z',
    }
    const adapter = adapterFor(proposal, new Map([['file:patch-a', 'v1'], ['file:patch-c', 'v2']]))
    const panel = new ApprovalPanelController({ proposalId: 'prop-1', adapter })
    const state = await panel.refresh()
    expect(state.title).toBe('修改提案 · 3 个位置')
    expect(state.rows.map(row => row.marker)).toEqual([1, 2, 3])
    expect(state.rows[0].blockedReason).toBe('dependency-rejected')
    expect(state.rows[2].versionConflict).toEqual({ expected: 'v1', actual: 'v2' })
    expect(state.plan?.appliable).toEqual([])
  })

  it('applies per-position decisions and skips terminal rows', async () => {
    const proposal: ProposalV1 = {
      proposalId: 'prop-1',
      title: '提案',
      hunks: [hunk('a', 'pending'), hunk('b', 'rejected')],
      createdAt: '2026-08-28T10:00:00Z',
    }
    const adapter = adapterFor(proposal, new Map([['file:patch-a', 'v1'], ['file:patch-b', 'v1']]))
    const panel = new ApprovalPanelController({ proposalId: 'prop-1', adapter })
    await panel.refresh()
    await panel.decide('a', 'approved')
    expect(adapter.decide).toHaveBeenCalledWith('prop-1', 'a', 'approved')
    await expect(panel.decide('b', 'approved')).rejects.toThrow(/not allowed/)
  })

  it('supports selection, approve-selected and keyboard focus walking', async () => {
    const proposal: ProposalV1 = {
      proposalId: 'prop-1',
      title: '提案',
      hunks: [hunk('a', 'pending'), hunk('b', 'pending'), hunk('c', 'pending')],
      createdAt: '2026-08-28T10:00:00Z',
    }
    const adapter = adapterFor(proposal, new Map([['file:patch-a', 'v1'], ['file:patch-b', 'v1'], ['file:patch-c', 'v1']]))
    const panel = new ApprovalPanelController({ proposalId: 'prop-1', adapter })
    await panel.refresh()
    panel.toggleSelected('a')
    panel.toggleSelected('c')
    expect(panel.getState().selected).toEqual(['a', 'c'])
    await panel.approveSelected()
    expect(adapter.decide).toHaveBeenCalledTimes(2)

    expect(panel.moveFocus(1)).toBe(0)
    expect(panel.moveFocus(1)).toBe(1)
    expect(panel.moveFocus(1)).toBe(2)
    expect(panel.moveFocus(1)).toBe(0)
    expect(panel.moveFocus(-1)).toBe(2)
  })

  it('forwards view actions through events', async () => {
    const proposal: ProposalV1 = {
      proposalId: 'prop-1',
      title: '提案',
      hunks: [hunk('a', 'pending')],
      createdAt: '2026-08-28T10:00:00Z',
    }
    const adapter = adapterFor(proposal, new Map())
    const onViewSource = vi.fn()
    const onViewDiff = vi.fn()
    const onOpenWorkbench = vi.fn()
    const panel = new ApprovalPanelController({ proposalId: 'prop-1', adapter, events: { onViewSource, onViewDiff, onOpenWorkbench } })
    await panel.refresh()
    panel.viewSource('a')
    panel.viewDiff('a')
    panel.openWorkbench('a')
    expect(onViewSource).toHaveBeenCalledWith(expect.objectContaining({ hunkId: 'a' }))
    expect(onViewDiff).toHaveBeenCalledWith(expect.objectContaining({ hunkId: 'a' }))
    expect(onOpenWorkbench).toHaveBeenCalledWith(expect.objectContaining({ hunkId: 'a' }))
  })

  it('surfaces apply receipts after applying approved hunks', async () => {
    const proposal: ProposalV1 = {
      proposalId: 'prop-1',
      title: '提案',
      hunks: [hunk('a', 'approved')],
      createdAt: '2026-08-28T10:00:00Z',
    }
    const adapter = adapterFor(proposal, new Map([['file:patch-a', 'v1']]))
    const panel = new ApprovalPanelController({ proposalId: 'prop-1', adapter })
    await panel.refresh()
    const receipts = await panel.apply()
    expect(receipts).toHaveLength(1)
    expect(panel.getState().lastReceipts).toEqual(receipts)
  })
})

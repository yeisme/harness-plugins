import { describe, expect, it } from 'vitest'
import {
  canTransitionHunk,
  assertHunkTransition,
  groupHunksByArtifact,
  planPartialApply,
  type ProposalHunkV1,
  type ProposalV1,
} from '../src/index.ts'

function hunk(hunkId: string, decision: ProposalHunkV1['decision'], dependencies: string[] = []): ProposalHunkV1 {
  return {
    hunkId,
    anchorId: `anc-${hunkId}`,
    owner: 'file-host',
    baseVersion: 'v1',
    safeSummary: `summary ${hunkId}`,
    patchRef: `patch-${hunkId}`,
    dependencies,
    decision,
  }
}

function proposal(hunks: ProposalHunkV1[]): ProposalV1 {
  return { proposalId: 'prop-1', title: '修改提案', hunks, createdAt: '2026-08-28T10:00:00Z' }
}

const artifactOf = (hunk: ProposalHunkV1): string => `file:${hunk.patchRef}`

describe('hunk state machine', () => {
  it('follows the spec transition table', () => {
    expect(canTransitionHunk('pending', 'approved')).toBe(true)
    expect(canTransitionHunk('pending', 'stale')).toBe(true)
    expect(canTransitionHunk('approved', 'applying')).toBe(true)
    expect(canTransitionHunk('applying', 'applied')).toBe(true)
    expect(canTransitionHunk('applying', 'failed')).toBe(true)
    expect(canTransitionHunk('applying', 'reconcile_required')).toBe(true)
    expect(canTransitionHunk('applied', 'pending')).toBe(false)
    expect(canTransitionHunk('rejected', 'approved')).toBe(false)
    expect(() => assertHunkTransition('applied', 'pending')).toThrow(/invalid hunk transition/)
  })
})

describe('planPartialApply', () => {
  it('applies only approved independent hunks and reports rejected ones', () => {
    const plan = planPartialApply(proposal([hunk('A', 'approved'), hunk('B', 'rejected'), hunk('C', 'approved')]), new Map([['file:patch-A', 'v1'], ['file:patch-C', 'v1']]), artifactOf)
    expect(plan.appliable).toEqual(['A', 'C'])
    expect(plan.rejected).toEqual(['B'])
    expect(plan.blocked).toEqual([])
    expect(plan.conflicts).toEqual([])
  })

  it('blocks dependents instead of partially applying a dependency group', () => {
    const plan = planPartialApply(proposal([hunk('A', 'approved', ['B']), hunk('B', 'rejected')]), new Map([['file:patch-A', 'v1']]), artifactOf)
    expect(plan.appliable).toEqual([])
    expect(plan.blocked).toEqual([{ hunkId: 'A', dependsOn: 'B', reason: 'dependency-rejected' }])
  })

  it('blocks dependents while their dependency is still pending', () => {
    const plan = planPartialApply(proposal([hunk('A', 'approved', ['B']), hunk('B', 'pending')]), new Map(), artifactOf)
    expect(plan.appliable).toEqual([])
    expect(plan.blocked[0].reason).toBe('dependency-awaiting-decision')
  })

  it('resolves transitive dependency closures', () => {
    const plan = planPartialApply(proposal([hunk('A', 'approved', ['B']), hunk('B', 'approved', ['C']), hunk('C', 'approved')]), new Map([['file:patch-A', 'v1'], ['file:patch-B', 'v1'], ['file:patch-C', 'v1']]), artifactOf)
    expect(plan.appliable.sort()).toEqual(['A', 'B', 'C'])
  })

  it('surfaces version drift as conflicts, never as silent overwrite', () => {
    const plan = planPartialApply(proposal([hunk('A', 'approved')]), new Map([['file:patch-A', 'v2']]), artifactOf)
    expect(plan.appliable).toEqual([])
    expect(plan.conflicts).toEqual([{ hunkId: 'A', artifactRef: 'file:patch-A', expected: 'v1', actual: 'v2' }])
  })
})

describe('groupHunksByArtifact', () => {
  it('groups same-artifact hunks into one fenced write and flags inconsistent bases', () => {
    const a1 = { ...hunk('A', 'approved'), patchRef: 'patch-X' }
    const a2 = { ...hunk('B', 'approved'), patchRef: 'patch-X' }
    const other = { ...hunk('C', 'approved'), patchRef: 'patch-Y', baseVersion: 'v9' }
    const { groups, conflicts } = groupHunksByArtifact(proposal([a1, a2, other]), ['A', 'B', 'C'], artifactOf)
    expect(groups.get('file:patch-X')).toHaveLength(2)
    expect(groups.get('file:patch-Y')).toHaveLength(1)
    expect(conflicts).toEqual([])

    const drifted = { ...hunk('D', 'approved'), patchRef: 'patch-X', baseVersion: 'v2' }
    const result = groupHunksByArtifact(proposal([a1, drifted]), ['A', 'D'], artifactOf)
    expect(result.groups.get('file:patch-X')).toHaveLength(1)
    expect(result.conflicts[0].hunkId).toBe('D')
  })
})

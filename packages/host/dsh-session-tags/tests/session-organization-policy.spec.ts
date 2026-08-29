import { describe, expect, it } from 'vitest'
import {
  TemporaryAdminGate,
  applyClassificationPolicy,
  defaultFunctionTypes,
  evaluateOrganizationRules,
} from '../src/organization.ts'
import type { OrganizationRuleV1, SessionOrganizationAssignmentV1 } from '../src/organization-wire.ts'

function assignment(overrides: Partial<SessionOrganizationAssignmentV1> = {}): SessionOrganizationAssignmentV1 {
  return {
    sessionId: 's1',
    workspaceRef: 'w1',
    functionTypeId: null,
    functionSource: null,
    functionLocked: false,
    tagsLocked: false,
    classificationStatus: 'unclassified',
    confidence: null,
    version: 'v1',
    updatedAt: 1,
    ...overrides,
  }
}

describe('session organization policy', () => {
  it('exposes the stable eight-type starter taxonomy', () => {
    expect(defaultFunctionTypes().map(item => item.id)).toEqual([
      'planning', 'research', 'implementation', 'debugging',
      'review', 'writing', 'operations', 'other',
    ])
  })

  it('auto-applies high confidence while limiting new tags to three', () => {
    const result = applyClassificationPolicy({
      sessionId: 's1',
      assignment: undefined,
      workspaceRef: 'w1',
      candidate: {
        functionTypeId: 'research',
        tags: ['existing', 'new-1', 'new-2', 'new-3', 'new-4'],
        confidence: 0.9,
      },
      knownFunctionTypeIds: new Set(defaultFunctionTypes().map(item => item.id)),
      knownTags: new Set(['existing']),
      now: 10,
      newVersion: () => 'v2',
    })
    expect(result).toMatchObject({ ok: true, createdTags: ['new-1', 'new-2', 'new-3'] })
    if (!result.ok) return
    expect(result.assignment).toMatchObject({ functionTypeId: 'research', classificationStatus: 'classified' })
    expect(result.acceptedTags).toEqual(['existing', 'new-1', 'new-2', 'new-3'])
  })

  it('keeps low-confidence output as a suggestion', () => {
    const result = applyClassificationPolicy({
      sessionId: 's1',
      assignment: assignment(),
      workspaceRef: 'w1',
      candidate: { functionTypeId: 'debugging', tags: ['bug'], confidence: 0.79 },
      knownFunctionTypeIds: new Set(defaultFunctionTypes().map(item => item.id)),
      knownTags: new Set(),
      now: 10,
      newVersion: () => 'v2',
    })
    expect(result).toMatchObject({
      ok: true,
      assignment: {
        functionTypeId: null,
        classificationStatus: 'needs_review',
        suggestedFunctionTypeId: 'debugging',
      },
    })
  })

  it('never overwrites a manually locked function', () => {
    const result = applyClassificationPolicy({
      sessionId: 's1',
      assignment: assignment({ functionTypeId: 'writing', functionSource: 'manual', functionLocked: true }),
      workspaceRef: 'w1',
      candidate: { functionTypeId: 'implementation', tags: [], confidence: 1 },
      knownFunctionTypeIds: new Set(defaultFunctionTypes().map(item => item.id)),
      knownTags: new Set(),
      newVersion: () => 'v2',
    })
    expect(result).toMatchObject({ ok: true, assignment: { functionTypeId: 'writing', functionSource: 'manual' } })
  })

  it('applies ordered rules with first function writer winning', () => {
    const rules: OrganizationRuleV1[] = [
      {
        id: 'later', name: 'later', order: 20, enabled: true,
        condition: { workspaceRefs: ['w1'] },
        action: { setFunctionTypeId: 'writing', addTags: ['later'] },
        version: '1', updatedAt: 1,
      },
      {
        id: 'first', name: 'first', order: 10, enabled: true,
        condition: { query: 'bug' },
        action: { setFunctionTypeId: 'debugging', addTags: ['bug'], proposeArchive: true },
        version: '1', updatedAt: 1,
      },
    ]
    expect(evaluateOrganizationRules(rules, {
      workspaceRef: 'w1', functionTypeId: null, tags: [], title: 'Bug report',
    })).toEqual({
      functionTypeId: 'debugging',
      tags: ['bug', 'later'],
      archiveProposed: true,
      matchedRuleIds: ['first', 'later'],
    })
  })

  it('expires temporary administrator grants', () => {
    const gate = new TemporaryAdminGate()
    const grant = gate.unlock(100)
    expect(gate.verify(grant.token, 101)).toBe(true)
    expect(gate.verify(grant.token, grant.expiresAt)).toBe(false)
  })
})

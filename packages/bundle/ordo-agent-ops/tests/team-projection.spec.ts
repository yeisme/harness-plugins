import { describe, expect, it } from 'vitest'
import {
  ORDO_TEAM_SNAPSHOT_SCHEMA,
  gateOrdoTeamEvent,
  resolveOrdoTeamCapabilityMatrix,
  validateOrdoTeamEvent,
  validateOrdoTeamSnapshot,
  type OrdoTeamEventV1,
  type OrdoTeamSnapshotV1,
} from '../src/host/team-projection.ts'

function snapshot(overrides: Partial<OrdoTeamSnapshotV1> = {}): Record<string, unknown> {
  return {
    schemaVersion: ORDO_TEAM_SNAPSHOT_SCHEMA,
    teamRef: 'team:1',
    contextRevision: 3,
    generation: 2,
    cursor: 41,
    freshness: 'fresh',
    safeMessage: 'all good',
    tasks: [{ taskRef: 'task:1', title: 'Draft outline', state: 'running', criticality: 'critical', deliveryRef: 'delivery:1', blockerCount: 1, assigneeRef: 'agent:a' }],
    assignments: [{ assignmentRef: 'asg:1', agentRef: 'agent:a', taskRef: 'task:1', role: 'writer', holder: true }],
    actions: [{ actionId: 'handoff-1', label: 'Hand off writing', kind: 'handoff', requiresConfirmation: 'approval', disabledReason: undefined }],
    ...overrides,
  }
}

function event(overrides: Partial<OrdoTeamEventV1> = {}): OrdoTeamEventV1 {
  return {
    schemaVersion: 'ordo.team.event.v1alpha1',
    teamRef: 'team:1',
    generation: 2,
    sequence: 42,
    kind: 'task_updated',
    payload: { taskRef: 'task:1' },
    ...overrides,
  } as OrdoTeamEventV1
}

describe('Team V1 snapshot validation (§1.1 fail-closed)', () => {
  it('accepts a valid safe projection and rejects unknown fields', () => {
    const valid = validateOrdoTeamSnapshot(snapshot())
    expect(valid?.teamRef).toBe('team:1')
    expect(valid?.tasks[0]?.title).toBe('Draft outline')
    const extra = snapshot({ unexpected: true })
    expect(validateOrdoTeamSnapshot(extra)).toBeUndefined()
  })

  it('drops credential/path/URL-carrying text and unsafe refs', () => {
    expect(validateOrdoTeamSnapshot(snapshot({ safeMessage: 'see https://evil.example' }))).toBeUndefined()
    expect(validateOrdoTeamSnapshot(snapshot({ safeMessage: 'Bearer abc123' }))).toBeUndefined()
    expect(validateOrdoTeamSnapshot(snapshot({ teamRef: '../etc/passwd' }))).toBeUndefined()
    expect(validateOrdoTeamSnapshot(snapshot({ teamRef: 'team:1/x' }))).toBeUndefined()
  })

  it('bounds collection sizes and counts', () => {
    const flood = Array.from({ length: 2_001 }, (_, i) => ({ taskRef: `task:${i}`, title: `t${i}`, state: 'pending', criticality: 'normal', deliveryRef: 'delivery:1', blockerCount: 0, assigneeRef: undefined }))
    expect(validateOrdoTeamSnapshot(snapshot({ tasks: flood }))).toBeUndefined()
  })
})

describe('Team event gate (§1.2 cursor/seq/generation)', () => {
  it('applies in-order events and ignores duplicates', () => {
    const prev = { generation: 2, cursor: 41, teamRef: 'team:1' }
    expect(gateOrdoTeamEvent(prev, event())).toMatchObject({ action: 'apply' })
    expect(gateOrdoTeamEvent(prev, event({ sequence: 41 }))).toMatchObject({ action: 'ignore', reason: 'duplicate' })
    expect(gateOrdoTeamEvent(prev, event({ sequence: 40 }))).toMatchObject({ action: 'ignore', reason: 'duplicate' })
  })

  it('reloads on gaps, generation drift, and context switches', () => {
    const prev = { generation: 2, cursor: 41, teamRef: 'team:1' }
    expect(gateOrdoTeamEvent(prev, event({ sequence: 45 }))).toMatchObject({ action: 'reload', reason: 'gap' })
    expect(gateOrdoTeamEvent(prev, event({ generation: 3 }))).toMatchObject({ action: 'reload', reason: 'generation_drift' })
    expect(gateOrdoTeamEvent(prev, event({ teamRef: 'team:2' }))).toMatchObject({ action: 'reload', reason: 'context_switch' })
  })

  it('event validation is fail-closed on schema drift and unsafe payloads', () => {
    expect(validateOrdoTeamEvent(event())).toBeDefined()
    expect(validateOrdoTeamEvent({ ...event(), schemaVersion: 'ordo.team.event.v9' })).toBeUndefined()
    expect(validateOrdoTeamEvent({ ...event(), payload: { taskRef: 'file:///etc/passwd' } })).toBeUndefined()
  })
})

describe('capability matrix (§2.3 honest fallback)', () => {
  it('defaults to unavailable with honest reasons and legacy fallback', () => {
    const matrix = resolveOrdoTeamCapabilityMatrix(undefined, true)
    expect(matrix).toMatchObject({ team: 'unavailable', sessionAgents: 'available', legacyOrdoPane: 'available', mutationEnabled: false, fallback: 'hub-session-agents' })
    expect(resolveOrdoTeamCapabilityMatrix(undefined, false).fallback).toBe('legacy-pane')
    expect(resolveOrdoTeamCapabilityMatrix({ capability: 'ordo.team.v1', maturity: 'live' }, true).mutationEnabled).toBe(true)
    expect(resolveOrdoTeamCapabilityMatrix({ capability: 'ordo.team.v1', maturity: 'fixtures' }, true).mutationEnabled).toBe(false)
  })
})

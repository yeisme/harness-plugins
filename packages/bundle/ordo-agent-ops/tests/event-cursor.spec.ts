import { describe, expect, it } from 'vitest'
import {
  OrdoAgentOpsEventCursor,
  validateOrdoAgentOpsEvent,
  type OrdoAgentOpsEvent,
  type OrdoAgentOpsEventCursorAnchor,
  type OrdoAgentOpsExpectedContext,
} from '../src/index.ts'

const context: OrdoAgentOpsExpectedContext = {
  tenantRef: 'tenant-1' as never,
  workspaceRef: 'workspace-1' as never,
  principalRef: 'principal-1' as never,
  contextRevision: 1,
  installationRef: 'installation-1' as never,
}

const anchor: OrdoAgentOpsEventCursorAnchor = {
  streamRef: 'stream-1' as never,
  sequence: 41,
  cursor: 'cursor-41' as never,
  eventRef: 'event-41' as never,
  context,
  membershipRevision: 7,
  pluginReleaseDigest: 'a'.repeat(64),
  ordoContractDigest: 'b'.repeat(64),
  runtimeGeneration: 'generation-1' as never,
}

function event(overrides: Partial<OrdoAgentOpsEvent> = {}): OrdoAgentOpsEvent {
  return {
    schemaVersion: 'ordo.agent_ops.event.v1alpha1',
    eventRef: 'event-42' as never,
    streamRef: 'stream-1' as never,
    sequence: 42,
    cursor: 'cursor-42' as never,
    occurredAt: '2026-08-18T00:00:00.000Z',
    observedAt: '2026-08-18T00:00:01.000Z',
    entityRef: 'run-1' as never,
    entityVersion: 2,
    eventType: 'run.updated',
    safeDeltaOrSummary: 'Run status changed.',
    evidenceRefs: [],
    context,
    membershipRevision: 7,
    pluginReleaseDigest: 'a'.repeat(64),
    ordoContractDigest: 'b'.repeat(64),
    runtimeGeneration: 'generation-1' as never,
    ...overrides,
  }
}

describe('Ordo Agent Ops event contract and cursor', () => {
  it('accepts the bounded safe event contract and rejects unsafe or unknown payloads', () => {
    expect(validateOrdoAgentOpsEvent(event())).toMatchObject({
      schemaVersion: 'ordo.agent_ops.event.v1alpha1',
      sequence: 42,
      entityVersion: 2,
    })
    expect(validateOrdoAgentOpsEvent({ ...event(), safeDeltaOrSummary: 'Bearer secret' })).toBeUndefined()
    expect(validateOrdoAgentOpsEvent({ ...event(), extra: 'not allowed' })).toBeUndefined()
    expect(validateOrdoAgentOpsEvent({ ...event(), pluginReleaseDigest: 'unsafe' })).toBeUndefined()
  })

  it('requires an authoritative anchor before applying a delta and ignores duplicates', () => {
    const cursor = new OrdoAgentOpsEventCursor()
    expect(cursor.apply(event())).toBe('not_established')
    cursor.seed(anchor)
    expect(cursor.apply(event())).toBe('advance')
    expect(cursor.apply(event())).toBe('duplicate')
    expect(cursor.getState()).toMatchObject({ sequence: 42, cursor: 'cursor-42', lastEventRef: 'event-42' })
  })

  it('clears the cursor on a sequence gap and requires snapshot reconcile', () => {
    const cursor = new OrdoAgentOpsEventCursor()
    cursor.seed(anchor)
    expect(cursor.apply(event({ eventRef: 'event-43' as never, sequence: 43, cursor: 'cursor-43' as never }))).toBe('reconcile_required')
    expect(cursor.getState()).toBeUndefined()
    expect(cursor.apply(event({ eventRef: 'event-44' as never, sequence: 44, cursor: 'cursor-44' as never }))).toBe('not_established')
  })

  it('clears the cursor on stream, context, digest, membership, or runtime drift', () => {
    for (const change of [
      { streamRef: 'stream-2' as never },
      { context: { ...context, contextRevision: 2 } },
      { pluginReleaseDigest: 'c'.repeat(64) },
      { ordoContractDigest: 'd'.repeat(64) },
      { membershipRevision: 8 },
      { runtimeGeneration: 'generation-2' as never },
    ]) {
      const cursor = new OrdoAgentOpsEventCursor()
      cursor.seed(anchor)
      expect(cursor.apply(event(change))).toBe('drift')
      expect(cursor.getState()).toBeUndefined()
    }
  })

  it('rejects entity-version regression as reconcile-required instead of applying stale facts', () => {
    const cursor = new OrdoAgentOpsEventCursor()
    cursor.seed(anchor)
    expect(cursor.apply(event())).toBe('advance')
    expect(cursor.apply(event({ eventRef: 'event-43' as never, sequence: 43, cursor: 'cursor-43' as never, entityVersion: 2 }))).toBe('reconcile_required')
    expect(cursor.getState()).toBeUndefined()
  })

  it('bounds remembered event and entity history', () => {
    const cursor = new OrdoAgentOpsEventCursor(2)
    cursor.seed(anchor)
    expect(cursor.apply(event({ entityRef: 'run-1' as never }))).toBe('advance')
    expect(cursor.apply(event({ eventRef: 'event-43' as never, sequence: 43, cursor: 'cursor-43' as never, entityRef: 'run-2' as never, entityVersion: 1 }))).toBe('advance')
    expect(cursor.apply(event({ eventRef: 'event-44' as never, sequence: 44, cursor: 'cursor-44' as never, entityRef: 'run-3' as never, entityVersion: 1 }))).toBe('advance')
    expect(cursor.apply(event({ eventRef: 'event-42' as never, sequence: 42, cursor: 'cursor-42' as never, entityRef: 'run-1' as never, entityVersion: 2 }))).toBe('reconcile_required')
  })
})

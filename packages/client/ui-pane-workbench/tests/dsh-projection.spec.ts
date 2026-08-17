import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { PANE_EVENT_SCHEMA } from '@yeisme/dsh-pane-protocol'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { applyPaneEvent, createPaneProjectionState } from '../src/index.js'
import { context } from './fixtures.js'

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    'test/pane-canary': { events: number }
  }
}

const canaryUnit = (): ProjectionDefinition<'test/pane-canary', number> => ({
  key: 'test/pane-canary',
  schema: z.object({ events: z.number().int().nonnegative() }),
  init: () => 0,
  apply: state => state + 1,
  view: state => ({ events: state }),
  stateVersion: 1,
})

function snapshotEvent(sequence: number, value: { events: number }) {
  return {
    schema: PANE_EVENT_SCHEMA,
    stream: 'dsh.session.projection.test-pane-canary',
    cursor: String(sequence),
    sequence,
    context,
    occurredAt: new Date(sequence + 1).toISOString(),
    observedAt: new Date(sequence + 1).toISOString(),
    freshness: 'fresh',
    status: 'ready',
    op: 'snapshot',
    payload: {
      entities: [{ ref: 'projection:test-pane-canary', version: Math.max(sequence + 1, 0), value }],
    },
  }
}

function updateEvent(sequence: number, value: { events: number }) {
  return {
    schema: PANE_EVENT_SCHEMA,
    stream: 'dsh.session.projection.test-pane-canary',
    cursor: String(sequence),
    sequence,
    context,
    occurredAt: new Date(sequence + 1).toISOString(),
    observedAt: new Date(sequence + 1).toISOString(),
    freshness: 'fresh',
    op: 'upsert',
    entityRef: 'projection:test-pane-canary',
    entityVersion: sequence + 1,
    payload: { value },
  }
}

describe('real DSH session projection canary', () => {
  it('maps whole-value snapshot and change feed into the pane runtime without polling', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    ctx.sessionProjections.register(canaryUnit())
    const session = ctx.sessions.create()

    let state = createPaneProjectionState(1)
    const initial = ctx.sessionProjections.snapshot(session)
    state = applyPaneEvent(state, snapshotEvent(initial.asOfSeq, initial.values['test/pane-canary']!))
    expect(state.entities['projection:test-pane-canary']?.value).toEqual({ events: 0 })

    const changes: Array<{ value: { events: number }; seq: number }> = []
    ctx.sessionProjections.onChanged((_session, key, value, seq) => {
      if (key === 'test/pane-canary') changes.push({ value: value as { events: number }, seq })
    })
    const appended: SessionEvent = session.append('turn/start', { turn: 1 })
    expect(changes).toEqual([{ value: { events: 1 }, seq: appended.seq }])

    state = applyPaneEvent(state, updateEvent(changes[0]!.seq, changes[0]!.value))
    expect(state.sequence).toBe(appended.seq)
    expect(state.entities['projection:test-pane-canary']?.value).toEqual({ events: 1 })
  })
})

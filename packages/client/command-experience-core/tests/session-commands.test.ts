import { describe, expect, it } from 'vitest'
import {
  applySessionReceipt,
  distinguishNewAndFork,
  filterSessionProjection,
  planSessionCommand,
  selectSessionRef,
} from '../src/session-commands'

const sessions = [
  { ref: 'session:alpha', title: 'Alpha draft' },
  { ref: 'session:beta', title: 'Beta review' },
]

describe('session command adapters', () => {
  it('filters owner projections locally without building an index', () => {
    const filtered = filterSessionProjection(sessions, { query: 'review' })
    expect(filtered.map((session) => session.ref)).toEqual(['session:beta'])
    expect(selectSessionRef(sessions, 'session:missing').ok).toBe(false)
    expect(selectSessionRef(sessions, 'session:alpha')).toEqual({
      ok: true,
      sessionRef: 'session:alpha',
    })
  })

  it('keeps /new and /fork as distinct receipt-gated intents', () => {
    expect(distinguishNewAndFork('new')).toBe('create-empty')
    expect(distinguishNewAndFork('fork')).toBe('copy-current')
    expect(planSessionCommand({ command: 'new' }).actionType).toBe('new-chat')
    expect(planSessionCommand({ command: 'fork' })).toMatchObject({
      actionType: 'fork-chat',
      requiresConfirmation: true,
    })
    expect(planSessionCommand({
      command: 'rename',
      selectedRef: 'session:alpha',
      title: 'Renamed',
    }).parameters).toEqual({ newTitle: 'Renamed' })
  })

  it('reloads transcript only after a successful receipt', () => {
    expect(applySessionReceipt('success')).toEqual({
      reloadTranscript: true,
      keepDraft: false,
      keepCurrentSession: false,
    })
    for (const status of ['rejected', 'failed', 'stale', 'cancelled'] as const) {
      expect(applySessionReceipt(status)).toEqual({
        reloadTranscript: false,
        keepDraft: true,
        keepCurrentSession: true,
      })
    }
  })
})

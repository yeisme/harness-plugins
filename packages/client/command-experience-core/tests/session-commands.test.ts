import { describe, expect, it } from 'vitest'
import {
  applySessionReceipt,
  distinguishNewAndFork,
  filterSessionProjection,
  parseSessionSubcommand,
  planSessionCommand,
  planSessionItemAction,
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

  it('plans /session as an open-session intent like /resume', () => {
    expect(planSessionCommand({ command: 'session' })).toMatchObject({
      command: 'session',
      actionType: 'open-session',
      targetRef: null,
      requiresConfirmation: false,
    })
    expect(planSessionCommand({
      command: 'session',
      selectedRef: 'session:alpha',
    }).targetRef).toBe('session:alpha')
  })

  it('routes /session subcommands through the hub intents', () => {
    expect(planSessionCommand({ command: 'session', rest: 'archive' })).toMatchObject({
      command: 'session',
      actionType: 'archive-session',
      targetRef: null,
      requiresConfirmation: true,
    })
    expect(planSessionCommand({
      command: 'session',
      rest: 'rename New title',
      selectedRef: 'session:alpha',
    })).toMatchObject({
      actionType: 'rename-session',
      targetRef: 'session:alpha',
      parameters: { newTitle: 'New title' },
    })
    expect(planSessionCommand({
      command: 'session',
      rest: 'restore',
      selectedRef: 'session:beta',
    })).toMatchObject({
      actionType: 'restore-session',
      targetRef: 'session:beta',
      requiresConfirmation: false,
    })
    // The hub never exposes delete; an unknown token stays a switch.
    expect(planSessionCommand({ command: 'session', rest: 'delete' })).toMatchObject({
      actionType: 'open-session',
      requiresConfirmation: false,
    })
  })

  it('parses /session subcommands with a forgiving switch fallback', () => {
    expect(parseSessionSubcommand('')).toEqual({ kind: 'switch' })
    expect(parseSessionSubcommand('  unknown-token  ')).toEqual({ kind: 'switch' })
    expect(parseSessionSubcommand('switch')).toEqual({ kind: 'switch' })
    expect(parseSessionSubcommand('RENAME')).toEqual({ kind: 'rename' })
    expect(parseSessionSubcommand('rename Alpha v2')).toEqual({
      kind: 'rename',
      title: 'Alpha v2',
    })
    expect(parseSessionSubcommand('archive')).toEqual({ kind: 'archive' })
    expect(parseSessionSubcommand('restore')).toEqual({ kind: 'restore' })
  })

  it('plans hub actions with archive receipt-gated and no delete', () => {
    expect(planSessionItemAction({
      action: 'switch',
      selectedRef: 'session:alpha',
    })).toMatchObject({
      actionType: 'open-session',
      targetRef: 'session:alpha',
      requiresConfirmation: false,
    })
    expect(planSessionItemAction({
      action: 'rename',
      selectedRef: 'session:alpha',
      title: 'Renamed',
    }).parameters).toEqual({ newTitle: 'Renamed' })
    expect(planSessionItemAction({
      action: 'archive',
      selectedRef: 'session:beta',
    })).toMatchObject({
      actionType: 'archive-session',
      targetRef: 'session:beta',
      requiresConfirmation: true,
    })
    expect(planSessionItemAction({
      action: 'restore',
      selectedRef: 'session:beta',
    })).toMatchObject({
      actionType: 'restore-session',
      targetRef: 'session:beta',
      requiresConfirmation: false,
    })
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  SESSION_DIRECTORY_CONTEXT_KEY,
  SESSION_DIRECTORY_PAGE_SIZE,
  parseSessionDirectoryEntries,
  probeSessionDirectory,
} from '../src/client/session-directory.ts'

function row(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'sess_1',
    title: 'Session one',
    archived: false,
    running: false,
    unread: false,
    labels: [],
    ...overrides,
  }
}

describe('parseSessionDirectoryEntries', () => {
  it('keeps safe rows with bounded labels and drops unsafe rows', () => {
    const entries = parseSessionDirectoryEntries([
      row(),
      row({ sessionId: 'sess/../escape' }), // unsafe ref: dropped
      row({ sessionId: 'sess_2', title: 'see https://example.com/x' }), // raw URL title: ref label
      row({ sessionId: 'sess_3', title: 'x'.repeat(400) }), // over-long title: ref label
      row({ sessionId: 'sess_4', title: undefined, running: true }),
      'not-a-record',
    ])
    expect(entries.map(entry => entry.sessionRef)).toEqual(['sess_1', 'sess_2', 'sess_3', 'sess_4'])
    expect(entries[0]?.label).toBe('Session one')
    expect(entries[1]?.label).toBe('sess_2')
    expect(entries[2]?.label).toBe('sess_3')
    expect(entries[3]?.label).toBe('sess_4')
    expect(entries[3]?.running).toBe(true)
    for (const entry of entries) {
      expect(entry.label).not.toMatch(/https?:\/\/|\/home\/|sk-[a-z0-9]/iu)
    }
  })

  it('returns an empty list for non-arrays and bounds the total', () => {
    expect(parseSessionDirectoryEntries(undefined)).toEqual([])
    expect(parseSessionDirectoryEntries({ bySession: [] })).toEqual([])
    const many = Array.from({ length: 1200 }, (_, i) => row({ sessionId: `sess_${i}` }))
    expect(parseSessionDirectoryEntries(many)).toHaveLength(1000)
  })

  it('uses a bounded page size for client-side paging', () => {
    expect(SESSION_DIRECTORY_PAGE_SIZE).toBe(20)
  })
})

describe('probeSessionDirectory', () => {
  const reason = 'directory unavailable'

  it('reports unavailable when the context key is absent', () => {
    const probe = probeSessionDirectory({} as never, reason)
    expect(probe).toEqual({ available: false, reason })
  })

  it('reports unavailable on shape drift (wrong capability or no listSessions)', () => {
    expect(probeSessionDirectory({ [SESSION_DIRECTORY_CONTEXT_KEY]: { capability: 'other', listSessions: () => [] } } as never, reason))
      .toEqual({ available: false, reason })
    expect(probeSessionDirectory({ [SESSION_DIRECTORY_CONTEXT_KEY]: { capability: 'session-manager' } } as never, reason))
      .toEqual({ available: false, reason })
  })

  it('never substitutes the legacy ledger bySession top-20 for the official directory', () => {
    // A legacy tokenUsage remote with bySession rows is present, but the
    // official session-manager seam is not: the probe must stay unavailable.
    const legacyRemote = {
      remote: {
        tokenUsage: {
          snapshot: vi.fn(async () => ({
            ok: true,
            specVersion: '1.0',
            usage: { bySession: Array.from({ length: 20 }, (_, i) => ({ sessionRef: `sess_${i}` })) },
          })),
        },
      },
    }
    const probe = probeSessionDirectory(legacyRemote as never, reason)
    expect(probe.available).toBe(false)
  })

  it('probes the official session-manager host and normalizes listSessions rows', async () => {
    const listSessions = vi.fn(async () => [
      row({ sessionId: 'sess_a', title: 'Alpha' }),
      row({ sessionId: 'sess_b', running: true }),
    ])
    const host = { version: '0.1.0-rc.1', capability: 'session-manager', listSessions }
    const probe = probeSessionDirectory({ [SESSION_DIRECTORY_CONTEXT_KEY]: host } as never, reason)
    expect(probe.available).toBe(true)
    if (probe.available) {
      const entries = await probe.source.listSessions()
      expect(listSessions).toHaveBeenCalledTimes(1)
      expect(entries).toEqual([
        { sessionRef: 'sess_a', label: 'Alpha', running: false, archived: false },
        { sessionRef: 'sess_b', label: 'Session one', running: true, archived: false },
      ])
    }
  })

  it('works on guarded Cordis contexts where unknown keys throw', () => {
    const guarded = {
      get: (key: string) => {
        if (key === SESSION_DIRECTORY_CONTEXT_KEY) throw new Error('not injected')
        return undefined
      },
    }
    const probe = probeSessionDirectory(guarded as never, reason)
    expect(probe).toEqual({ available: false, reason })
  })
})

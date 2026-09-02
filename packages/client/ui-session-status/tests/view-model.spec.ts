import { describe, expect, it } from 'vitest'
import { deriveSessionStatusViewModel, sessionStatusSurfaces, statusSurfaceFallback } from '../src/view-model.ts'
import { SESSION_STATUS_SCHEMA_VERSION, type SessionStatusSnapshotV1 } from '../src/wire.ts'
import { applySessionStatusClient } from '../src/client/index.ts'

function snapshot(overrides: Partial<SessionStatusSnapshotV1> = {}): SessionStatusSnapshotV1 {
  return {
    schemaVersion: SESSION_STATUS_SCHEMA_VERSION,
    revision: 1,
    generatedAt: '2026-09-01T00:00:00.000Z',
    freshness: 'fresh',
    status: 'ready',
    session: { sessionRef: 'sess_1', label: 'Main', lifecycle: 'idle' },
    context: {
      status: 'ready',
      usedTokens: 1200,
      limitTokens: 10000,
      remainingRatio: 0.88,
      source: 'token-meter',
      safeMessage: 'Context remaining from owner token meter',
    },
    limits: [],
    ...overrides,
  }
}

describe('session status view model', () => {
  it('shows context remaining on the capsule for an ordinary session', () => {
    const view = deriveSessionStatusViewModel(snapshot())
    expect(view.capsuleLabel).toBe('Context 88%')
    expect(view.contextLine).toContain('1200/10000')
    expect(view.tokensDeepLink).toBe('token-usage-open')
    expect(view.activityDeepLink).toBe('workspace.command-activity')
  })

  it('prioritizes waiting-approval over context copy', () => {
    const view = deriveSessionStatusViewModel(snapshot({
      session: { sessionRef: 'sess_1', label: 'Main', lifecycle: 'waiting_approval' },
    }))
    expect(view.lifecyclePriority).toBe(true)
    expect(view.capsuleLabel).toContain('waiting')
    expect(view.contextLine).toContain('88%')
  })

  it('does not invent remaining when context is unavailable', () => {
    const view = deriveSessionStatusViewModel(snapshot({
      status: 'partial',
      context: {
        status: 'unavailable',
        source: 'none',
        safeMessage: 'Context remaining is unavailable; process token usage is not a substitute',
      },
    }))
    expect(view.capsuleLabel).toContain('unavailable')
    expect(view.contextTone).toBe('neutral')
    expect(view.compactSuggested).toBe(false)
  })

  it('degrades /status Popover → Pane → safe text', () => {
    expect(statusSurfaceFallback({ headerAvailable: true, paneAvailable: true })).toBe('popover')
    expect(statusSurfaceFallback({ headerAvailable: false, paneAvailable: true })).toBe('pane')
    expect(statusSurfaceFallback({ headerAvailable: false, paneAvailable: false })).toBe('safe-text')
  })

  it('shares one view model across capsule, popover, and pane with Tokens/Activity deep links', () => {
    const view = deriveSessionStatusViewModel(snapshot())
    const surfaces = sessionStatusSurfaces(view)
    expect(surfaces.capsule.label).toBe(view.capsuleLabel)
    expect(surfaces.popover.tokensDeepLink).toBe('token-usage-open')
    expect(surfaces.pane.activityDeepLink).toBe('workspace.command-activity')
    expect(surfaces.popover.sessionLabel).toBe(surfaces.pane.sessionLabel)
  })
})

describe('session status client probe', () => {
  it('fails closed when the remote is missing', async () => {
    const client = applySessionStatusClient({})
    expect(client.probe.available).toBe(false)
    const snap = await client.read('sess_1')
    expect(snap.status).toBe('unavailable')
    expect(JSON.stringify(snap)).not.toMatch(/apiKey|sk-|\/home\//)
  })

  it('mirrors a host snapshot through the remote face', async () => {
    const host = {
      sessionStatus: {
        snapshot: async () => ({ ok: true as const, specVersion: '1.0' as const, snapshot: snapshot() }),
      },
    }
    const client = applySessionStatusClient(host)
    expect(client.probe.available).toBe(true)
    const snap = await client.read('sess_1')
    expect(snap.context.remainingRatio).toBe(0.88)
    const view = deriveSessionStatusViewModel(snap)
    expect(view.revision).toBe(1)
  })
})

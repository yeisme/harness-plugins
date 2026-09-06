import { describe, expect, it } from 'vitest'
import {
  createSlashRuntime,
  type SlashOpenViewRequest,
  type SlashPaneViewRecord,
  type SlashRuntimeHost,
} from '@yeisme/dsh-client-ui-command-experience-core'
import {
  activityContainsForbidden,
  commandResultEntersTranscript,
  restoreActivityFromEvents,
  runStatusCommand,
} from '../src/index'

function view(kind: string, extra: Partial<SlashPaneViewRecord> = {}): SlashPaneViewRecord {
  return { kind, label: kind, showInPicker: true, role: 'navigator', preferredRegion: 'right', retention: 'keep-alive', singleton: true, ...extra }
}

function hostWith(input: {
  readonly views?: readonly SlashPaneViewRecord[]
  readonly opened?: Array<SlashOpenViewRequest>
  readonly sessionStatus?: SlashRuntimeHost['sessionStatus']
}): SlashRuntimeHost {
  const views = input.views ?? []
  return {
    paneWorkbench: {
      views: { snapshot: () => views as SlashPaneViewRecord[], subscribe: () => () => {} },
      commands: { snapshot: () => [], subscribe: () => () => {}, execute: () => undefined },
      openView: (request) => {
        input.opened?.push(request)
      },
    },
    ...(input.sessionStatus === undefined ? {} : { sessionStatus: input.sessionStatus }),
  }
}

describe('/status command journey', () => {
  it('stays bound to session A after focus switches to B, with no model send', () => {
    const popoverCalls: string[] = []
    const runtime = createSlashRuntime(hostWith({
      views: [view('workspace.session-status')],
      sessionStatus: {
        header: () => ({ available: true, sessionRef: 'sess_a' }),
        openPopover: (sessionRef) => {
          popoverCalls.push(sessionRef)
          return true
        },
      },
    }))
    const result = runStatusCommand({ runtime, sessionRef: 'sess_a', correlationId: 'c-status-a' })
    // Focus moving to session B while the command runs must not retarget it.
    expect(result.plan).toEqual({ kind: 'open-status-popover', sessionRef: 'sess_a' })
    expect(result.sessionRef).toBe('sess_a')
    expect(popoverCalls).toEqual(['sess_a'])
    expect(result.message).not.toMatch(/no inspect resolver/)
    expect(result.events.map(event => event.sessionRef)).toEqual(['sess_a', 'sess_a'])
    expect(result.events.map(event => event.correlationId)).toEqual(['c-status-a', 'c-status-a'])
    expect(restoreActivityFromEvents(result.events, 'sess_b')).toEqual([])
    expect(restoreActivityFromEvents(result.events, 'sess_a')).toHaveLength(1)
    expect(result.entersTranscript).toBe(false)
    expect(commandResultEntersTranscript()).toBe(false)
    runtime.dispose()
  })

  it('answers with the choose-session hint and creates no run when sessionRef is missing', () => {
    const runtime = createSlashRuntime(hostWith({ views: [view('workspace.session-status')] }))
    const result = runStatusCommand({ runtime })
    expect(result.plan).toEqual({ kind: 'unavailable', reason: '请先选择会话 / Select a session first' })
    expect(result.message).toContain('请先选择会话')
    expect(result.runCreated).toBe(false)
    expect(result.events).toEqual([])
    expect(result.sessionRef).toBeNull()
    runtime.dispose()
  })

  it('explains supported syntax for unknown subcommands and opens nothing', () => {
    const opened: SlashOpenViewRequest[] = []
    const runtime = createSlashRuntime(hostWith({ views: [view('workspace.session-status')], opened }))
    const result = runStatusCommand({ runtime, sessionRef: 'sess_a', arg: 'everything', correlationId: 'c-bad' })
    expect(result.plan.kind).toBe('unavailable')
    expect(result.message).toContain('Unsupported /status subcommand "everything"')
    expect(result.message).toContain('/status, /status tokens')
    expect(opened).toEqual([])
    expect(result.events[1]).toMatchObject({ type: 'command/done', status: 'failed', sessionRef: 'sess_a' })
    expect(result.entersTranscript).toBe(false)
    runtime.dispose()
  })

  it('opens the originating session pane when only another session header is available', () => {
    const opened: SlashOpenViewRequest[] = []
    const popoverCalls: string[] = []
    const runtime = createSlashRuntime(hostWith({
      views: [view('workspace.session-status')],
      opened,
      sessionStatus: {
        header: () => ({ available: true, sessionRef: 'sess_b' }),
        openPopover: (sessionRef) => {
          popoverCalls.push(sessionRef)
          return true
        },
      },
    }))
    const result = runStatusCommand({ runtime, sessionRef: 'sess_a', correlationId: 'c-pane-a' })
    expect(result.plan).toMatchObject({
      kind: 'open-pane',
      viewKind: 'workspace.session-status',
      sessionRef: 'sess_a',
    })
    // Never borrow session B's popover.
    expect(popoverCalls).toEqual([])
    expect(opened).toHaveLength(1)
    expect(opened[0]).toMatchObject({ kind: 'workspace.session-status', metadata: { sessionRef: 'sess_a' } })
    expect(result.events[0]).toMatchObject({ type: 'command/run', sessionRef: 'sess_a', correlationId: 'c-pane-a' })
    runtime.dispose()
  })

  it('returns bounded safe text with a reason when no visual seam exists', () => {
    const runtime = createSlashRuntime({})
    const result = runStatusCommand({ runtime, sessionRef: 'sess_a', correlationId: 'c-text' })
    expect(result.plan.kind).toBe('unavailable')
    expect(result.message).toMatch(/no session status surface/i)
    // Never claims a surface opened.
    expect(result.message).not.toMatch(/opened/i)
    expect(result.events[1]).toMatchObject({ type: 'command/done', status: 'failed', reasonCode: 'unavailable' })
    expect(activityContainsForbidden(result.message)).toBe(false)
    runtime.dispose()
  })

  it('focuses the existing /status tokens instance via the singleton session key', () => {
    const opened: SlashOpenViewRequest[] = []
    const runtime = createSlashRuntime(hostWith({ views: [view('workspace.token-usage')], opened }))
    const first = runStatusCommand({ runtime, sessionRef: 'sess_a', arg: 'tokens', correlationId: 'c-t1' })
    const second = runStatusCommand({ runtime, sessionRef: 'sess_a', arg: 'tokens', correlationId: 'c-t2' })
    for (const result of [first, second]) {
      expect(result.plan).toEqual({
        kind: 'open-pane',
        viewKind: 'workspace.token-usage',
        sessionRef: 'sess_a',
        resourceKey: 'token-usage:session:sess_a',
        metadata: { sessionRef: 'sess_a' },
      })
    }
    expect(opened).toHaveLength(2)
    for (const request of opened) {
      // Singleton resourceKey: the host focuses the existing instance instead
      // of duplicating the statistics pane.
      expect(request).toMatchObject({
        kind: 'workspace.token-usage',
        resourceKey: 'token-usage:session:sess_a',
        singleton: true,
        metadata: { sessionRef: 'sess_a' },
      })
    }
    expect(first.correlationId).not.toBe(second.correlationId)
    runtime.dispose()
  })

  it('fires lifecycle events with the frozen sessionRef and keeps results out of model history', () => {
    const runtime = createSlashRuntime(hostWith({ views: [view('workspace.token-usage')] }))
    const result = runStatusCommand({ runtime, sessionRef: 'sess_a', arg: 'tokens', correlationId: 'c-life' })
    expect(result.events).toEqual([
      { type: 'command/run', sessionRef: 'sess_a', canonicalName: 'status', correlationId: 'c-life' },
      {
        type: 'command/done',
        sessionRef: 'sess_a',
        canonicalName: 'status',
        correlationId: 'c-life',
        status: 'success',
        summary: result.message,
      },
    ])
    const rows = restoreActivityFromEvents(result.events, 'sess_a')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ canonicalName: 'status', status: 'success' })
    expect(result.entersTranscript).toBe(false)
    // Surface-opened feedback is distinct from data availability.
    expect(result.message).toContain('data availability')
    runtime.dispose()
  })
})

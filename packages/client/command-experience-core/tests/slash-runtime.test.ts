import { describe, expect, it } from 'vitest'
import { createSlashRuntime, syncInspectRegistrations } from '../src/slash-runtime'
import type { SlashPaneViewRecord, SlashRuntimeHost } from '../src/slash-runtime'

function view(kind: string, extra: Partial<SlashPaneViewRecord> = {}): SlashPaneViewRecord {
  return { kind, label: kind, showInPicker: true, role: 'navigator', preferredRegion: 'right', retention: 'keep-alive', singleton: true, ...extra }
}

function hostWithPane(views: SlashPaneViewRecord[], commands: SlashRuntimeHost['paneWorkbench'] extends infer T ? T extends { commands: infer C } ? C extends { snapshot(): infer S } ? S : never : never : never, openView: (request: unknown) => void = () => {}): SlashRuntimeHost {
  const viewListeners = new Set<() => void>()
  const commandListeners = new Set<() => void>()
  return {
    paneWorkbench: {
      views: {
        snapshot: () => views,
        subscribe: (listener) => {
          viewListeners.add(listener)
          return () => viewListeners.delete(listener)
        },
      },
      commands: {
        snapshot: () => commands as never,
        subscribe: (listener) => {
          commandListeners.add(listener)
          return () => commandListeners.delete(listener)
        },
        execute: (id) => id,
      },
      openView: openView as SlashRuntimeHost['paneWorkbench'] extends { openView: infer O } ? O : never,
    },
  }
}

describe('slash runtime', () => {
  it('enables /pane /explorer when the workbench snapshot has picker views', () => {
    const runtime = createSlashRuntime(hostWithPane([
      view('dsh.explorer'),
      view('dsh.source-control'),
    ], []))
    const catalog = runtime.snapshot().commands
    expect(catalog.find((item) => item.canonicalName === 'pane')?.availability.state).toBe('available')
    expect(catalog.find((item) => item.canonicalName === 'explorer')?.availability.state).toBe('available')
    expect(catalog.find((item) => item.canonicalName === 'git')?.availability.state).toBe('available')
    runtime.dispose()
  })

  it('hot-plugs a launcher short name and removes it on unplug', () => {
    let commandRows = [
      { descriptor: { id: 'creator.open', label: 'Open Creator', presentation: { launcher: true }, slash: { name: 'creator' } } },
    ]
    const listeners = new Set<() => void>()
    const runtime = createSlashRuntime({
      paneWorkbench: {
        views: { snapshot: () => [view('creator.home')], subscribe: () => () => {} },
        commands: {
          snapshot: () => commandRows,
          subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
          },
          execute: (id) => id,
        },
        openView: () => {},
      },
    })
    expect(runtime.snapshot().commands.some((item) => item.canonicalName === 'creator')).toBe(true)
    commandRows = []
    for (const listener of listeners) listener()
    expect(runtime.snapshot().commands.some((item) => item.canonicalName === 'creator')).toBe(false)
    runtime.dispose()
  })

  it('registers converged plugin commands from the plugin inventory and drops them on unload', () => {
    const runtime = createSlashRuntime({
      plugins: () => [{ id: 'dsh-token-usage' }, { id: 'dsh-devtools' }],
    })
    const names = runtime.snapshot().commands.map(item => item.canonicalName)
    expect(names).toContain('token-usage')
    expect(names).toContain('devtools')
    const token = runtime.snapshot().commands.find(item => item.canonicalName === 'token-usage')
    expect(token?.owner).toBe('host')
    expect(token?.danger).toBe('safe')
    expect(token?.availability.state).toBe('available')
    runtime.dispose()
  })

  it('opens explorer through /pane explorer and lists plugins without RPC', () => {
    const opened: unknown[] = []
    const runtime = createSlashRuntime({
      ...hostWithPane([view('dsh.explorer')], [], (request) => opened.push(request)),
      plugins: () => [{ id: 'dsh-command-experience', status: 'loaded' }],
    })
    const pane = runtime.snapshot().commands.find((item) => item.canonicalName === 'pane')!
    const result = runtime.execute(pane, '/pane explorer')
    expect(result.plan).toEqual({ kind: 'open-pane', viewKind: 'dsh.explorer' })
    expect(opened).toHaveLength(1)
    const plugins = runtime.snapshot().commands.find((item) => item.canonicalName === 'plugins')!
    expect(runtime.execute(plugins).message).toContain('dsh-command-experience')
    runtime.dispose()
  })

  it('keeps /mcp disabled until the tools pane is present', () => {
    const runtime = createSlashRuntime({})
    const mcp = runtime.snapshot().commands.find((item) => item.canonicalName === 'mcp')!
    expect(runtime.execute(mcp).plan.kind).toBe('unavailable')
    runtime.dispose()
  })

  it('opens /mcp through the pane registry without a conversation tab', () => {
    const opened: unknown[] = []
    const runtime = createSlashRuntime(hostWithPane([view('mcp-inspector')], [], request => opened.push(request)))
    const mcp = runtime.snapshot().commands.find(item => item.canonicalName === 'mcp')!
    expect(runtime.surfaces().mcpInspector).toBe(true)
    expect(runtime.execute(mcp).plan).toEqual({ kind: 'open-pane', viewKind: 'mcp-inspector', tab: 'mcp' })
    expect(opened[0]).toMatchObject({ kind: 'mcp-inspector', singleton: true, metadata: { tab: 'mcp' } })
    runtime.dispose()
  })

  it('does not advertise the removed conversation tools tab as a pane', () => {
    const runtime = createSlashRuntime({ conversationViews: { has: () => true, activate: () => true } })
    expect(runtime.surfaces().mcpInspector).toBe(false)
    const mcp = runtime.snapshot().commands.find(item => item.canonicalName === 'mcp')!
    expect(runtime.execute(mcp).plan.kind).toBe('unavailable')
    runtime.dispose()
  })

  it('syncs inspect registrations when a pane command is hot-plugged', () => {
    let commandRows = [] as Array<{ descriptor: { id: string; label: string; presentation?: { launcher?: boolean }; slash?: { name: string } } }>
    const listeners = new Set<() => void>()
    const runtime = createSlashRuntime({
      paneWorkbench: {
        views: { snapshot: () => [view('dsh.explorer')], subscribe: () => () => {} },
        commands: {
          snapshot: () => commandRows,
          subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
          },
          execute: (id) => id,
        },
        openView: () => {},
      },
    })
    const registered = new Set<string>()
    const disposeSync = syncInspectRegistrations(runtime, (definition) => {
      registered.add(definition.name)
      return () => {
        registered.delete(definition.name)
      }
    })
    expect(registered.has('pane')).toBe(true)
    expect(registered.has('creator')).toBe(false)
    commandRows = [{ descriptor: { id: 'creator.open', label: 'Open Creator', presentation: { launcher: true }, slash: { name: 'creator' } } }]
    for (const listener of listeners) listener()
    expect(registered.has('creator')).toBe(true)
    commandRows = []
    for (const listener of listeners) listener()
    expect(registered.has('creator')).toBe(false)
    disposeSync()
    runtime.dispose()
  })

  describe('/status execution', () => {
    function statusCommand(runtime: ReturnType<typeof createSlashRuntime>) {
      const entry = runtime.snapshot().commands.find(item => item.canonicalName === 'status')
      if (entry === undefined) throw new Error('missing status')
      return { ...entry, availability: { state: 'available' as const } }
    }

    it('opens the originating session popover and keeps the frozen session after focus moves', () => {
      const popoverCalls: string[] = []
      const runtime = createSlashRuntime({
        ...hostWithPane([view('workspace.session-status')], []),
        sessionStatus: {
          header: () => ({ available: true, sessionRef: 'sess_a' }),
          openPopover: (sessionRef) => {
            popoverCalls.push(sessionRef)
            return true
          },
        },
      })
      const result = runtime.execute(statusCommand(runtime), '/status', { sessionRef: 'sess_a' })
      // Focus switching to session B after dispatch must not retarget the plan.
      expect(result.plan).toEqual({ kind: 'open-status-popover', sessionRef: 'sess_a' })
      expect(popoverCalls).toEqual(['sess_a'])
      expect(result.message).toContain('data availability')
      expect(result.message).not.toMatch(/no inspect resolver/)
      runtime.dispose()
    })

    it('opens the originating session pane when only another session header exists', () => {
      const opened: Array<{ resourceKey?: string; metadata?: Record<string, string> }> = []
      const popoverCalls: string[] = []
      const runtime = createSlashRuntime({
        ...hostWithPane([view('workspace.session-status')], [], request => opened.push(request as never)),
        sessionStatus: {
          header: () => ({ available: true, sessionRef: 'sess_b' }),
          openPopover: (sessionRef) => {
            popoverCalls.push(sessionRef)
            return true
          },
        },
      })
      const result = runtime.execute(statusCommand(runtime), '/status', { sessionRef: 'sess_a' })
      expect(result.plan).toMatchObject({ kind: 'open-pane', viewKind: 'workspace.session-status', sessionRef: 'sess_a' })
      expect(popoverCalls).toEqual([])
      expect(opened).toHaveLength(1)
      expect(opened[0]).toMatchObject({ kind: 'workspace.session-status', metadata: { sessionRef: 'sess_a' } })
      runtime.dispose()
    })

    it('degrades a declined popover to the pane, then to bounded safe text', () => {
      const opened: unknown[] = []
      const withPane = createSlashRuntime({
        ...hostWithPane([view('workspace.session-status')], [], request => opened.push(request)),
        sessionStatus: {
          header: () => ({ available: true, sessionRef: 'sess_a' }),
          openPopover: () => false,
        },
      })
      const paneResult = withPane.execute(statusCommand(withPane), '/status', { sessionRef: 'sess_a' })
      expect(paneResult.plan).toMatchObject({ kind: 'open-pane', viewKind: 'workspace.session-status', sessionRef: 'sess_a' })
      expect(paneResult.message).toMatch(/popover was unavailable/i)
      expect(opened).toHaveLength(1)
      withPane.dispose()

      const bare = createSlashRuntime({
        sessionStatus: {
          header: () => ({ available: true, sessionRef: 'sess_a' }),
          openPopover: () => false,
        },
      })
      const textResult = bare.execute(statusCommand(bare), '/status', { sessionRef: 'sess_a' })
      expect(textResult.plan.kind).toBe('unavailable')
      expect(textResult.message).toMatch(/no status pane is available/i)
      bare.dispose()
    })

    it('returns the choose-session hint when no session is bound', () => {
      const runtime = createSlashRuntime(hostWithPane([view('workspace.session-status')], []))
      const result = runtime.execute(statusCommand(runtime), '/status')
      expect(result.plan).toEqual({ kind: 'unavailable', reason: '请先选择会话 / Select a session first' })
      expect(result.message).toBe('请先选择会话 / Select a session first')
      runtime.dispose()
    })

    it('opens /status tokens with the session singleton key and never duplicates the instance', () => {
      const opened: Array<{ resourceKey?: string; singleton?: boolean; metadata?: Record<string, string> }> = []
      const runtime = createSlashRuntime(
        hostWithPane([view('workspace.token-usage')], [], request => opened.push(request as never)),
      )
      const command = statusCommand(runtime)
      const first = runtime.execute(command, '/status tokens', { sessionRef: 'sess_a' })
      const second = runtime.execute(command, '/status tokens', { sessionRef: 'sess_a' })
      for (const result of [first, second]) {
        expect(result.plan).toEqual({
          kind: 'open-pane',
          viewKind: 'workspace.token-usage',
          sessionRef: 'sess_a',
          resourceKey: 'token-usage:session:sess_a',
          metadata: { sessionRef: 'sess_a' },
        })
        expect(result.message).toContain('data availability')
      }
      // Same singleton resourceKey: the host focuses the existing instance.
      expect(opened).toHaveLength(2)
      for (const request of opened) {
        expect(request).toMatchObject({
          resourceKey: 'token-usage:session:sess_a',
          singleton: true,
          metadata: { sessionRef: 'sess_a' },
        })
      }
      runtime.dispose()
    })

    it('surfaces status surfaces and falls back to the host session provider', () => {
      const runtime = createSlashRuntime({
        ...hostWithPane([view('workspace.session-status'), view('workspace.token-usage')], []),
        currentSessionRef: () => 'sess_host',
      })
      expect(runtime.surfaces().sessionStatus).toBe(true)
      expect(runtime.surfaces().tokenUsage).toBe(true)
      const result = runtime.execute(statusCommand(runtime), '/status tokens')
      expect(result.plan).toMatchObject({ sessionRef: 'sess_host', resourceKey: 'token-usage:session:sess_host' })
      runtime.dispose()
    })

    it('reports unsupported subcommands without opening anything', () => {
      const opened: unknown[] = []
      const runtime = createSlashRuntime(
        hostWithPane([view('workspace.session-status')], [], request => opened.push(request)),
      )
      const result = runtime.execute(statusCommand(runtime), '/status everything', { sessionRef: 'sess_a' })
      expect(result.plan.kind).toBe('unavailable')
      expect(result.message).toContain('/status, /status tokens')
      expect(opened).toHaveLength(0)
      runtime.dispose()
    })
  })
})

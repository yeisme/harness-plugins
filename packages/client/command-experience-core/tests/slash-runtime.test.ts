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

  it('keeps /mcp disabled until the conversation view is present', () => {
    const runtime = createSlashRuntime({})
    const mcp = runtime.snapshot().commands.find((item) => item.canonicalName === 'mcp')!
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
})

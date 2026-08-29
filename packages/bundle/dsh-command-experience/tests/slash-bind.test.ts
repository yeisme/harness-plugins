import { describe, expect, it } from 'vitest'
import { bindSlashRuntime } from '../src/slash-bind.ts'

describe('bindSlashRuntime', () => {
  it('registers inspect commands and hot-plugs a pane slash name', () => {
    const registered = new Map<string, () => void>()
    const commandListeners = new Set<() => void>()
    let paneCommands: Array<{ descriptor: { id: string; label: string; presentation?: { launcher?: boolean }; slash?: { name: string } } }> = []
    const ctx = {
      values: new Map<string, unknown>([
        ['commands', {
          register: (definition: { name: string }) => {
            registered.set(definition.name, () => registered.delete(definition.name))
            return registered.get(definition.name)!
          },
          list: () => [],
        }],
        ['paneWorkbench', {
          views: {
            snapshot: () => [{ kind: 'dsh.explorer', label: 'Files', showInPicker: true, role: 'navigator', preferredRegion: 'right', retention: 'keep-alive', singleton: true }],
            subscribe: () => () => {},
          },
          commands: {
            snapshot: () => paneCommands,
            subscribe: (listener: () => void) => {
              commandListeners.add(listener)
              return () => commandListeners.delete(listener)
            },
            execute: (id: string) => id,
          },
          openView: () => {},
        }],
      ]),
      get(name: string) {
        return this.values.get(name)
      },
      provide(name: string, value: unknown) {
        this.values.set(name, value)
      },
      registry: { keys: () => ['dsh-command-experience', 'dsh-mcp-inspector'] },
    }

    const binding = bindSlashRuntime(ctx)
    expect(registered.has('mcp')).toBe(true)
    expect(registered.has('pane')).toBe(true)
    expect(registered.has('plugins')).toBe(true)
    expect(ctx.get('slashDirectory')).toBe(binding.runtime)

    paneCommands = [{ descriptor: { id: 'creator.open', label: 'Open Creator', presentation: { launcher: true }, slash: { name: 'creator' } } }]
    for (const listener of commandListeners) listener()
    expect(registered.has('creator')).toBe(true)

    paneCommands = []
    for (const listener of commandListeners) listener()
    expect(registered.has('creator')).toBe(false)
    binding.dispose()
  })

  it('fails closed when pane and commands seams are missing', () => {
    const ctx = {
      get() {
        return undefined
      },
    }
    const binding = bindSlashRuntime(ctx)
    const mcp = binding.runtime.snapshot().commands.find((item) => item.canonicalName === 'mcp')
    expect(mcp?.availability.state).toBe('disabled')
    expect(binding.runtime.execute(mcp!, '/mcp').plan.kind).toBe('unavailable')
    binding.dispose()
  })

  it('ignores non-string plugin registry keys', () => {
    const ctx = {
      get() {
        return undefined
      },
      registry: { keys: () => [{ id: 'legacy-plugin' }, 'dsh-mcp-inspector'] },
    }
    const binding = bindSlashRuntime(ctx)
    const mcp = binding.runtime.snapshot().commands.find((item) => item.canonicalName === 'mcp')
    expect(mcp?.availability.state).toBe('available')
    binding.dispose()
  })

  it('never registers official-owned inspect names (goal, plan)', () => {
    const registered = new Map<string, () => void>()
    const ctx = {
      values: new Map<string, unknown>([
        ['commands', {
          register: (definition: { name: string }) => {
            registered.set(definition.name, () => registered.delete(definition.name))
            return registered.get(definition.name)!
          },
          list: () => [],
        }],
      ]),
      get(name: string) {
        return this.values.get(name)
      },
      provide(name: string, value: unknown) {
        this.values.set(name, value)
      },
    }
    const binding = bindSlashRuntime(ctx)
    expect(registered.has('goal')).toBe(false)
    expect(registered.has('plan')).toBe(false)
    expect(registered.has('plugins')).toBe(true)
    binding.dispose()
  })

  it('yields inspect registration to names the official registry already serves', () => {
    const registered = new Map<string, () => void>()
    const ctx = {
      values: new Map<string, unknown>([
        ['commands', {
          register: (definition: { name: string }) => {
            registered.set(definition.name, () => registered.delete(definition.name))
            return registered.get(definition.name)!
          },
          find: (_agent: unknown, name: string) => (name === 'plugins' ? { name } : undefined),
          list: () => [],
        }],
      ]),
      get(name: string) {
        return this.values.get(name)
      },
      provide(name: string, value: unknown) {
        this.values.set(name, value)
      },
    }
    const binding = bindSlashRuntime(ctx)
    expect(registered.has('plugins')).toBe(false)
    expect(registered.has('mcp')).toBe(true)
    binding.dispose()
  })

  it('projects plugin inventory from the cordis loader entry table', () => {
    const ctx = {
      get() {
        return undefined
      },
      loader: {
        entries: () => [
          { id: 'dsh-mcp-inspector', name: '@yeisme/dsh-mcp-inspector', phase: 'active' },
          { id: 'dsh-command-experience' },
        ],
      },
    }
    const binding = bindSlashRuntime(ctx)
    const mcp = binding.runtime.snapshot().commands.find((item) => item.canonicalName === 'mcp')
    expect(mcp?.availability.state).toBe('available')
    const plugins = binding.runtime.execute(
      binding.runtime.snapshot().commands.find((item) => item.canonicalName === 'plugins')!,
      '/plugins',
    )
    expect(plugins.message).toContain('dsh-mcp-inspector')
    binding.dispose()
  })
})

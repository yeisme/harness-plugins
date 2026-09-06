import { describe, expect, it } from 'vitest'
import { planInspectCommand } from '../src/inspect-resolve'
import { createSlashRuntime } from '../src/slash-runtime'
import type { CommandExperienceEntryV1 } from '../src/types'
import type { SlashPaneViewRecord, SlashRuntimeHost } from '../src/slash-runtime'

const commandsEntry: CommandExperienceEntryV1 = {
  canonicalName: 'commands',
  aliases: [],
  description: 'List available commands',
  category: 'discovery',
  input: {},
  surfaces: ['web'],
  actionKind: 'inspect',
  owner: 'client',
  danger: 'safe',
  availability: { state: 'available' },
  coverage: 'equivalent',
}

function view(kind: string): SlashPaneViewRecord {
  return { kind, label: kind, showInPicker: true, role: 'navigator', preferredRegion: 'right', retention: 'keep-alive', singleton: true }
}

function hostWithExplorer(): SlashRuntimeHost {
  return {
    paneWorkbench: {
      views: { snapshot: () => [view('dsh.explorer')], subscribe: () => () => {} },
      commands: { snapshot: () => [], subscribe: () => () => {}, execute: (id) => id },
      openView: () => {},
    },
  }
}

describe('/commands', () => {
  it('plans a command-list instead of falling to unavailable', () => {
    expect(planInspectCommand({ command: commandsEntry })).toEqual({ kind: 'command-list' })
  })

  it('lists available directory commands when executed', () => {
    const runtime = createSlashRuntime(hostWithExplorer())
    const result = runtime.execute(commandsEntry)
    expect(result.plan.kind).toBe('command-list')
    expect(result.message).toContain('/commands — List available commands')
    expect(result.message).toContain('/explorer')
    runtime.dispose()
  })
})

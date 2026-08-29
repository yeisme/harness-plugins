import { describe, expect, it } from 'vitest'
import {
  matchPaneKind,
  planInspectCommand,
  projectHostCommands,
  splitSlashRest,
} from '../src/inspect-resolve'
import { buildP0Catalog } from '../src/p0-catalog'
import { reservedSlashNames } from '../src/live-directory'

function command(name: string) {
  const catalog = buildP0Catalog({
    availableActions: new Set(),
    surfaces: new Set(['mcpInspector', 'agentContext', 'paneWorkbench', 'explorer', 'sourceControl']),
  })
  const found = catalog.find((item) => item.canonicalName === name)
  if (found === undefined) throw new Error(`missing ${name}`)
  return found
}

describe('inspect resolve', () => {
  it('plans /mcp /skills /plugins against live surfaces', () => {
    expect(planInspectCommand({
      command: command('mcp'),
      surfaces: {
        mcpInspector: true,
        agentContext: false,
        paneWorkbench: false,
        explorer: false,
        sourceControl: false,
        conversationViewSwitcher: true,
      },
    })).toEqual({ kind: 'open-conversation-view', viewId: 'mcp-inspector' })

    expect(planInspectCommand({
      command: command('skills'),
      surfaces: {
        mcpInspector: false,
        agentContext: true,
        paneWorkbench: true,
        explorer: false,
        sourceControl: false,
        conversationViewSwitcher: false,
      },
    })).toEqual({ kind: 'open-pane', viewKind: 'workspace.agent-context', tab: 'skills' })

    expect(planInspectCommand({ command: command('plugins') })).toEqual({ kind: 'plugin-list' })
  })

  it('disables inspect plans when the target plugin is missing', () => {
    expect(planInspectCommand({ command: command('mcp') })).toMatchObject({
      kind: 'unavailable',
      reason: 'MCP inspector plugin not installed',
    })
    expect(planInspectCommand({ command: command('skills') }).kind).toBe('unavailable')
    expect(planInspectCommand({ command: command('explorer') }).kind).toBe('unavailable')
  })

  it('matches unique pane kinds from /pane rest tokens', () => {
    const views = [
      { kind: 'dsh.explorer', label: 'Files', showInPicker: true },
      { kind: 'dsh.source-control', label: 'Source Control', showInPicker: true },
      { kind: 'dsh.tool-details', label: 'Tool Details', showInPicker: false },
    ]
    expect(matchPaneKind(views, 'explorer')?.kind).toBe('dsh.explorer')
    expect(matchPaneKind(views, 'git')).toBeNull()
    expect(matchPaneKind(views, 'source')?.kind).toBe('dsh.source-control')
    expect(splitSlashRest('/pane explorer').rest).toBe('explorer')
    expect(planInspectCommand({
      command: command('pane'),
      query: '/pane explorer',
      views,
      surfaces: {
        mcpInspector: false,
        agentContext: false,
        paneWorkbench: true,
        explorer: true,
        sourceControl: true,
        conversationViewSwitcher: false,
      },
    })).toEqual({ kind: 'open-pane', viewKind: 'dsh.explorer' })
  })

  it('projects host commands and skips reserved names', () => {
    const reserved = reservedSlashNames(buildP0Catalog())
    const projected = projectHostCommands([
      { name: 'yeisme-foo', description: 'One-line owner projection.' },
      { name: 'mcp', description: 'should not steal' },
    ], reserved)
    expect(projected.find((item) => item.canonicalName === 'yeisme-foo')?.input.schemaKey).toBe('host-command:yeisme-foo')
    expect(projected.some((item) => item.canonicalName === 'mcp')).toBe(false)
  })
})

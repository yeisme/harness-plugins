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
        paneWorkbench: true,
        explorer: false,
        sourceControl: false,
        conversationViewSwitcher: false,
      },
    })).toEqual({ kind: 'open-pane', viewKind: 'mcp-inspector', tab: 'mcp' })

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
      reason: 'Pane Workbench is not installed',
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

  describe('/status resolver', () => {
    const statusSurfaces = {
      mcpInspector: false,
      agentContext: false,
      paneWorkbench: true,
      explorer: false,
      sourceControl: false,
      conversationViewSwitcher: false,
      sessionStatus: true,
      tokenUsage: true,
    }

    it('plans the originating session popover when its header is available', () => {
      expect(planInspectCommand({
        command: command('status'),
        query: '/status',
        sessionRef: 'sess_a',
        surfaces: { ...statusSurfaces, sessionStatusHeader: { available: true, sessionRef: 'sess_a' } },
      })).toEqual({ kind: 'open-status-popover', sessionRef: 'sess_a' })
    })

    it('opens the originating session pane when only another session header is available', () => {
      expect(planInspectCommand({
        command: command('status'),
        query: '/status',
        sessionRef: 'sess_a',
        surfaces: { ...statusSurfaces, sessionStatusHeader: { available: true, sessionRef: 'sess_b' } },
      })).toEqual({
        kind: 'open-pane',
        viewKind: 'workspace.session-status',
        sessionRef: 'sess_a',
        metadata: { sessionRef: 'sess_a' },
      })
    })

    it('falls back to bounded safe text when no visual seam exists', () => {
      const plan = planInspectCommand({
        command: command('status'),
        sessionRef: 'sess_a',
        surfaces: { ...statusSurfaces, sessionStatus: false },
      })
      expect(plan.kind).toBe('unavailable')
      expect(plan.kind === 'unavailable' && plan.reason).toMatch(/no session status surface/i)
      expect(plan.kind === 'unavailable' && plan.reason).not.toMatch(/no inspect resolver/)
    })

    it('asks for a session instead of borrowing a last-activity one', () => {
      const plan = planInspectCommand({
        command: command('status'),
        query: '/status',
        surfaces: statusSurfaces,
      })
      expect(plan).toEqual({ kind: 'unavailable', reason: '请先选择会话 / Select a session first' })
    })

    it('plans /status tokens with a session-bound singleton resource key', () => {
      expect(planInspectCommand({
        command: command('status'),
        query: '/status tokens',
        sessionRef: 'sess_a',
        surfaces: statusSurfaces,
      })).toEqual({
        kind: 'open-pane',
        viewKind: 'workspace.token-usage',
        sessionRef: 'sess_a',
        resourceKey: 'token-usage:session:sess_a',
        metadata: { sessionRef: 'sess_a' },
      })
    })

    it('keeps /status tokens session-bound when the bare argument form is passed', () => {
      expect(planInspectCommand({
        command: command('status'),
        query: 'tokens',
        sessionRef: 'sess_a',
        surfaces: statusSurfaces,
      })).toMatchObject({ kind: 'open-pane', viewKind: 'workspace.token-usage', sessionRef: 'sess_a' })
    })

    it('degrades /status tokens when the pane is not installed', () => {
      const plan = planInspectCommand({
        command: command('status'),
        query: '/status tokens',
        sessionRef: 'sess_a',
        surfaces: { ...statusSurfaces, tokenUsage: false },
      })
      expect(plan).toEqual({ kind: 'unavailable', reason: 'Token usage pane is not installed' })
    })

    it('explains supported syntax for unknown subcommands without a model send', () => {
      const plan = planInspectCommand({
        command: command('status'),
        query: '/status everything',
        sessionRef: 'sess_a',
        surfaces: statusSurfaces,
      })
      expect(plan.kind).toBe('unavailable')
      expect(plan.kind === 'unavailable' && plan.reason).toContain('Unsupported /status subcommand "everything"')
      expect(plan.kind === 'unavailable' && plan.reason).toContain('/status, /status tokens')
    })
  })
})

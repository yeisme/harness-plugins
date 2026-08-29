import { describe, expect, it } from 'vitest'
import {
  paneCommandSlashName,
  pickerVisiblePaneViews,
  projectPaneHub,
  projectPaneLauncherCommands,
  projectPaneSlashSource,
} from '../src/pane-projection'
import { reservedSlashNames } from '../src/live-directory'
import { buildP0Catalog } from '../src/p0-catalog'

describe('pane slash projection', () => {
  it('derives a hyphenated slash name from a pane command id', () => {
    expect(paneCommandSlashName('creator.open')).toBe('creator-open')
    expect(paneCommandSlashName('creator.open.visual')).toBe('creator-open-visual')
  })

  it('hides picker-invisible views', () => {
    const visible = pickerVisiblePaneViews([
      { kind: 'dsh.explorer', label: 'Files', showInPicker: true },
      { kind: 'dsh.tool-details', label: 'Tool Details', showInPicker: false },
    ])
    expect(visible.map((view) => view.kind)).toEqual(['dsh.explorer'])
  })

  it('projects launcher commands and optional short names without replacing reserved names', () => {
    const reserved = reservedSlashNames(buildP0Catalog())
    const commands = projectPaneLauncherCommands([
      { id: 'creator.open', label: 'Open Creator Studio', launcher: true, slash: { name: 'creator' } },
      { id: 'creator.open.visual', label: 'Open visual', launcher: true },
      { id: 'internal.sync', label: 'Internal', launcher: false },
      { id: 'mcp.takeover', label: 'Take MCP', launcher: true, slash: { name: 'mcp' } },
    ], reserved)

    expect(commands.find((item) => item.canonicalName === 'creator')?.availability.state).toBe('available')
    expect(commands.find((item) => item.canonicalName === 'creator-open-visual')?.input.schemaKey).toBe('pane-command:creator.open.visual')
    expect(commands.some((item) => item.canonicalName === 'internal-sync')).toBe(false)
    expect(commands.find((item) => item.canonicalName === 'mcp')?.availability.reason).toContain('reserved')
  })

  it('does not emit a second /pane hub from pane plugins', () => {
    const reserved = reservedSlashNames(buildP0Catalog())
    const source = projectPaneSlashSource({
      views: [{ kind: 'dsh.explorer', label: 'Files', showInPicker: true }],
      commands: [{ id: 'creator.open', label: 'Open Creator', launcher: true, slash: { name: 'creator' } }],
      reserved,
    })
    expect(source.some((item) => item.canonicalName === 'pane')).toBe(false)
    expect(source.some((item) => item.canonicalName === 'creator')).toBe(true)
  })

  it('never projects a conflicting /pane hub while the P0 seed owns it', () => {
    const reserved = reservedSlashNames(buildP0Catalog())
    expect(projectPaneHub([], reserved)).toBeNull()
    expect(projectPaneHub([{ kind: 'dsh.explorer', label: 'Files', showInPicker: true }], reserved)).toBeNull()
  })

  it('projects the /pane hub on catalogs that predate the seed', () => {
    const current = reservedSlashNames(buildP0Catalog())
    const legacyCatalog = new Set([...current].filter((name) => name !== 'pane'))
    const disabledHub = projectPaneHub([], legacyCatalog)
    expect(disabledHub?.canonicalName).toBe('pane')
    expect(disabledHub?.availability.state).toBe('disabled')
    const availableHub = projectPaneHub([{ kind: 'dsh.explorer', label: 'Files', showInPicker: true }], legacyCatalog)
    expect(availableHub?.availability.state).toBe('available')
  })
})

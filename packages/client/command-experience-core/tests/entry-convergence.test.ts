import { describe, expect, it } from 'vitest'
import {
  bundleEntryLedger,
  createConvergenceDirectory,
  ledgerIsClosed,
  paletteExecuteRecord,
  probeOldPathFallback,
  projectConvergedCommands,
  registerConvergedSource,
  seedToEntry,
  unloadConvergedSource,
} from '../src/index'

const BUNDLE_IDS = [
  'anchored-standard',
  'dsh-ai-drama-director',
  'dsh-browser-pane',
  'dsh-command-experience',
  'dsh-conversation-rewrite',
  'dsh-creator-studio',
  'dsh-desktop-workbench',
  'dsh-devtools',
  'dsh-file-document',
  'dsh-interaction-space',
  'dsh-mcp-inspector',
  'dsh-mermaid-render',
  'dsh-next-step-suggestions',
  'dsh-personal-radar',
  'dsh-plugin-example',
  'dsh-rich-media',
  'dsh-selection-annotation',
  'dsh-semantic-file-editor',
  'dsh-session-cookie-manager',
  'dsh-session-tags',
  'dsh-side-chat',
  'dsh-terminal',
  'dsh-token-usage',
  'dsh-workbench-compose',
  'dsh-workbench-core',
  'dsh-yeisme-commands',
  'ordo-agent-ops',
  'pane-agent-context',
  'pane-domain',
  'pane-subagent',
  'pane-workbench',
] as const

describe('entry convergence ledger', () => {
  it('closes the 31-bundle inventory with converged, no-command-semantics, or exempt', () => {
    const ledger = bundleEntryLedger()
    expect(ledger).toHaveLength(31)
    expect(ledgerIsClosed()).toBe(true)
    expect(ledger.map(row => row.bundleId).sort()).toEqual([...BUNDLE_IDS].sort())
    for (const row of ledger) {
      expect(['converged', 'no-command-semantics', 'exempt']).toContain(row.disposition)
      expect(row.reason.length).toBeGreaterThan(0)
      if (row.disposition === 'converged') {
        expect(row.commands.length).toBeGreaterThan(0)
        expect(row.oldPath).toBeTruthy()
      }
    }
  })

  it('maps registration fields to the command-first directory contract', () => {
    const token = seedToEntry({
      canonicalName: 'Token-Usage',
      aliases: ['tokens'],
      description: 'Open the token usage ledger',
      category: 'work',
      danger: 'safe',
      owner: 'host',
      actionKind: 'navigation',
      schemaKey: 'inspect:token-usage',
    })
    expect(token.canonicalName).toBe('token-usage')
    expect(token.aliases).toEqual(['tokens'])
    expect(token.danger).toBe('safe')
    expect(token.owner).toBe('host')
    expect(token.availability.state).toBe('available')
    expect(token.input.schemaKey).toBe('inspect:token-usage')
  })

  it('additively registers converged ids into the frozen directory', () => {
    const directory = createConvergenceDirectory()
    const before = directory.snapshot().commands.map(command => command.canonicalName)
    expect(before).toContain('help')
    registerConvergedSource(directory, BUNDLE_IDS)
    const after = directory.snapshot()
    const names = after.commands.map(command => command.canonicalName)
    expect(names).toContain('help')
    expect(names).toContain('token-usage')
    expect(names).toContain('devtools')
    expect(names).toContain('browser')
    expect(names).toContain('terminal')
    expect(names).toContain('ordo')
    const token = paletteExecuteRecord(directory, 'token-usage')
    expect(token.found).toBe(true)
    expect(token.executed).toBe(true)
    expect(token.receiptStatus).toBe('success')
    expect(token.activityCanonicalName).toBe('token-usage')
    expect(token.owner).toBe('host')
    expect(token.danger).toBe('safe')
    expect(token.oldPath).toBe('token-usage-open')
  })

  it('keeps old paths usable when the directory seam is missing', () => {
    const missing = probeOldPathFallback({ directorySeam: false, oldPathAvailable: true })
    expect(missing.oldPathUsable).toBe(true)
    expect(missing.deadPath).toBe(false)
    const bothMissing = probeOldPathFallback({ directorySeam: false, oldPathAvailable: false })
    expect(bothMissing.deadPath).toBe(true)
  })

  it('drops stale rows after hot unload and does not error the fallback', () => {
    const directory = createConvergenceDirectory()
    registerConvergedSource(directory, ['dsh-token-usage', 'dsh-devtools'])
    expect(directory.snapshot().commands.some(command => command.canonicalName === 'token-usage')).toBe(true)
    unloadConvergedSource(directory)
    expect(directory.snapshot().commands.some(command => command.canonicalName === 'token-usage')).toBe(false)
    expect(directory.snapshot().commands.some(command => command.canonicalName === 'help')).toBe(true)
    expect(probeOldPathFallback({ directorySeam: false, oldPathAvailable: true }).oldPathUsable).toBe(true)
  })

  it('does not project uninstalled bundles', () => {
    const commands = projectConvergedCommands(['dsh-token-usage'])
    expect(commands.map(command => command.canonicalName)).toEqual(['token-usage'])
  })
})

import { describe, expect, it } from 'vitest'
import {
  auditCoverageLedger,
  buildP0Catalog,
  inspectCommandsMutateState,
  sharedActionIdentity,
} from '../src/p0-catalog'

describe('P0 catalog adapters', () => {
  it('projects discovery commands as inspect/local without mutation', () => {
    const catalog = buildP0Catalog()
    for (const name of ['help', 'commands', 'status', 'plugins', 'mcp', 'skills']) {
      expect(inspectCommandsMutateState(name)).toBe(false)
      const entry = catalog.find((item) => item.canonicalName === name)
      expect(entry).toBeDefined()
      expect(entry?.description.length).toBeGreaterThan(0)
      expect(entry?.availability.state === 'available' || entry?.availability.reason).toBeTruthy()
    }
  })

  it('disables model/work owner actions when the capability is missing', () => {
    const catalog = buildP0Catalog({ availableActions: new Set(['open-thread']) })
    const model = catalog.find((item) => item.canonicalName === 'model')
    expect(model?.availability).toEqual({
      state: 'disabled',
      reason: 'missing owner action set-model',
    })
    const mention = catalog.find((item) => item.canonicalName === 'mention')
    expect(mention?.availability.state).toBe('disabled')
    const agent = catalog.find((item) => item.canonicalName === 'agent')
    expect(agent?.availability.state).toBe('available')
  })

  it('keeps lifecycle aliases on one action identity', () => {
    const catalog = buildP0Catalog()
    expect(sharedActionIdentity('quit', 'exit', catalog)).toBe(true)
    expect(sharedActionIdentity('agent', 'subagents', catalog)).toBe(true)
    expect(sharedActionIdentity('agent', 'agents', catalog)).toBe(true)
    expect(sharedActionIdentity('new', 'fork', catalog)).toBe(false)
    const logout = catalog.find((item) => item.canonicalName === 'logout')
    expect(logout?.danger).toBe('confirm')
  })

  it('seeds the session hub and staged archive/delete commands', () => {
    const catalog = buildP0Catalog()
    const session = catalog.find((item) => item.canonicalName === 'session')
    expect(session).toMatchObject({
      category: 'session',
      actionKind: 'owner-action',
      danger: 'safe',
      coverage: 'adapted',
    })
    expect(session?.aliases).toContain('sessions')
    expect(session?.input.selectorKey).toBe('sessionId')
    expect(sharedActionIdentity('session', 'sessions', catalog)).toBe(true)

    const archive = catalog.find((item) => item.canonicalName === 'archive')
    expect(archive).toMatchObject({
      danger: 'confirm',
      coverage: 'staged',
    })
    expect(archive?.availability).toEqual({
      state: 'disabled',
      reason: 'missing owner action archive-session',
    })

    const del = catalog.find((item) => item.canonicalName === 'delete')
    expect(del).toMatchObject({
      danger: 'destructive',
      coverage: 'staged',
    })
    expect(del?.availability.state).toBe('disabled')
  })

  it('disables inspect navigation until the owning surface is present', () => {
    const catalog = buildP0Catalog()
    expect(catalog.find((item) => item.canonicalName === 'mcp')?.availability).toEqual({
      state: 'disabled',
      reason: 'MCP inspector plugin not installed',
    })
    expect(catalog.find((item) => item.canonicalName === 'pane')?.availability.state).toBe('disabled')
    const ready = buildP0Catalog({
      availableActions: new Set(),
      surfaces: new Set(['mcpInspector', 'agentContext', 'paneWorkbench', 'explorer', 'sourceControl']),
    })
    expect(ready.find((item) => item.canonicalName === 'mcp')?.availability.state).toBe('available')
    expect(ready.find((item) => item.canonicalName === 'explorer')?.aliases).toContain('files')
    expect(ready.find((item) => item.canonicalName === 'git')?.availability.state).toBe('available')
  })

  it('derives /session availability from open-session like /resume', () => {
    const catalog = buildP0Catalog({
      availableActions: new Set(['open-session']),
    })
    const session = catalog.find((item) => item.canonicalName === 'session')
    const resume = catalog.find((item) => item.canonicalName === 'resume')
    expect(session?.availability.state).toBe('available')
    expect(resume?.availability.state).toBe('available')
    expect(inspectCommandsMutateState('session')).toBe(true)
  })

  it('enables /ordo run launch only for the typed preview-CAS capability', () => {
    const withoutLaunch = buildP0Catalog({ availableActions: new Set(['run-start']) })
    expect(withoutLaunch.find((item) => item.canonicalName === 'ordo run launch')).toMatchObject({
      owner: 'host',
      danger: 'confirm',
      coverage: 'conditional',
      availability: { state: 'disabled', reason: 'missing owner action ordo.run.launch.preview-cas' },
    })
    const ready = buildP0Catalog({ availableActions: new Set(['ordo.run.launch.preview-cas']) })
    expect(ready.find((item) => item.canonicalName === 'ordo run launch')?.availability.state).toBe('available')
  })

  it('projects every live P0 canonical with owner, danger, coverage, and availability reason', () => {
    const catalog = buildP0Catalog()
    const expected = [
      'help', 'commands', 'status', 'plugins', 'mcp', 'skills', 'pane', 'explorer', 'git',
      'agent', 'resume', 'session', 'archive', 'delete', 'new', 'fork', 'rename',
      'preset', 'model', 'reasoning', 'permissions',
      'compact', 'plan', 'goal', 'diff', 'review', 'ordo run launch', 'mention',
      'copy', 'feedback', 'init', 'logout', 'quit',
    ]
    expect(catalog.map((item) => item.canonicalName).sort()).toEqual([...expected].sort())
    for (const name of expected) {
      const row = catalog.find((item) => item.canonicalName === name)
      expect(row, name).toBeDefined()
      expect(row!.owner).toMatch(/client|dsh|host/)
      expect(row!.danger).toMatch(/safe|confirm|destructive/)
      expect(row!.coverage).toMatch(/equivalent|adapted|staged|conditional|not-applicable/)
      expect(row!.availability.state === 'available' || Boolean(row!.availability.reason)).toBe(true)
    }
    expect(catalog.find((item) => item.canonicalName === 'init')?.availability.reason).toMatch(/not applicable/i)
    expect(catalog.find((item) => item.canonicalName === 'explorer')?.aliases).toContain('files')
    expect(catalog.find((item) => item.canonicalName === 'quit')?.aliases).toContain('exit')
    expect(catalog.some((item) => item.canonicalName === 'usage')).toBe(false)
    expect(catalog.some((item) => item.canonicalName === 'theme')).toBe(false)
  })

  it('rejects ledger rows that have no owner or verify command', () => {
    const issues = auditCoverageLedger([
      { command: '/help', coverage: 'adapted', owner: 'client', seam: 'local', verifyCommand: 'vitest' },
      { command: '/help', coverage: 'adapted', owner: 'client', seam: 'local', verifyCommand: 'vitest' },
      { command: '/later', coverage: 'staged', owner: '', seam: '', verifyCommand: '' },
    ])
    expect(issues).toEqual([
      'duplicate /help',
      '/later missing owner',
      '/later missing seam',
      '/later missing verify command',
    ])
  })
})

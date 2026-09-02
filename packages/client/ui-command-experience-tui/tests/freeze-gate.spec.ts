import { describe, expect, it } from 'vitest'
import { buildP0Catalog, buildSessionHubActions, parseSessionSubcommand } from '@yeisme/dsh-client-ui-command-experience-core'
import {
  COLON_MIGRATION_HINT,
  TUI_P0_NAMES,
  appendSidecar,
  createInitialTuiState,
  debugRecord,
  helpOrCommandsOpenCenter,
  p1HiddenFromTui,
  render,
  renderStatusline,
  resolveTuiAssistQuery,
  runTuiJourney,
  tuiPluginLifecycleContract,
  update,
  validateRendererContribution,
} from '../src/index'

describe('tui freeze-gate shipped path', () => {
  const commands = buildP0Catalog({
    availableActions: new Set([
      'status', 'open-session', 'new-chat', 'fork-chat', 'rename-session',
      'compact-context', 'set-model', 'set-permissions', 'delete-session',
    ]),
    surfaces: new Set(['mcpInspector', 'agentContext', 'paneWorkbench', 'explorer', 'sourceControl']),
  })

  it('treats : as a migration hint and keeps the full P0 catalog', () => {
    const colon = resolveTuiAssistQuery(commands, ':session')
    expect(colon.rpcIssued).toBe(false)
    expect(colon.selected?.canonicalName).toBe('session')
    expect(colon.migrationHint).toBe(COLON_MIGRATION_HINT)
    for (const name of TUI_P0_NAMES) {
      expect(commands.find(item => item.canonicalName === name), name).toBeDefined()
    }
    expect(p1HiddenFromTui(commands, 'usage')).toBe(true)
  })

  it('opens /help and /commands on the same Command Center projection', () => {
    expect(helpOrCommandsOpenCenter('help')).toBe('help')
    expect(helpOrCommandsOpenCenter('commands')).toBe('commands')
    expect(helpOrCommandsOpenCenter('status')).toBe('status')
    let state = createInitialTuiState({ width: 80, height: 24 })
    ;({ state } = update(state, { type: 'input', text: '/commands' }, commands))
    state = { ...state, cursorKey: 'commands' }
    ;({ state } = update(state, { type: 'key', key: 'Enter' }, commands))
    expect(state.mode).toBe('command-center')
    expect(state.overlay).toBe('commands')
  })

  it('builds the /session hub from the same selector as /resume and /agent', () => {
    expect(parseSessionSubcommand('archive')).toEqual({ kind: 'archive' })
    const actions = buildSessionHubActions({ availableActions: new Set(['open-session', 'rename-session']) })
    expect(actions.map(row => row.action)).toEqual(['switch', 'rename', 'archive'])
    expect(actions.find(row => row.action === 'archive')?.disabled).toBe(true)
    expect(resolveTuiAssistQuery(commands, '/r').selected?.canonicalName).toBe('resume')
    expect(resolveTuiAssistQuery(commands, '/agents').selected?.canonicalName).toBe('agent')
  })

  it('defaults confirm to Cancel and requires the owner phrase for destructive', () => {
    let compact = createInitialTuiState({ width: 80, height: 24 })
    ;({ state: compact } = update(compact, { type: 'input', text: '/compact' }, commands))
    compact = { ...compact, cursorKey: 'compact' }
    ;({ state: compact } = update(compact, { type: 'key', key: 'Enter' }, commands))
    expect(compact.mode).toBe('confirm')
    expect(compact.confirmation?.focus).toBe('cancel')
    expect(update(compact, { type: 'key', key: 'Enter' }, commands).state.mode).not.toBe('dispatching')
  })

  it('renders representative sizes and keeps draft across resize', () => {
    let state = createInitialTuiState({ width: 120, height: 36 })
    ;({ state } = update(state, { type: 'input', text: '/session' }, commands))
    state = { ...state, cursorKey: 'session', scrollAnchor: 4, receiptRef: 'c1' }
    for (const size of [{ width: 120, height: 36 }, { width: 80, height: 24 }, { width: 60, height: 20 }, { width: 50, height: 12 }]) {
      const frame = render(state, size.width, size.height, { commands })
      expect(frame.lines).toHaveLength(size.height)
      expect(frame.lines.join('\n')).not.toMatch(/raw prompt|provider payload|private args|sk-|\/home\//)
    }
    const resized = update(state, { type: 'resize', width: 50, height: 12 }, commands).state
    expect(resized.cursorKey).toBe('session')
    expect(resized.scrollAnchor).toBe(4)
    expect(resized.receiptRef).toBe('c1')
  })

  it('shows status unavailable without ledger math and writes debug to a sidecar', () => {
    expect(renderStatusline(null, 40)).toBe('status unavailable')
    expect(tuiPluginLifecycleContract()).toEqual({
      readsStdin: false,
      rawMode: false,
      alternateScreen: false,
      capturesSignals: false,
    })
    expect(validateRendererContribution({ viewKind: 'https://evil', render: () => 'ok' })).toBeNull()
    const lines: string[] = []
    appendSidecar({ write: line => lines.push(line) }, debugRecord(createInitialTuiState()))
    expect(lines[0]).not.toMatch(/sk-|\/home\/|raw prompt/)
  })

  it('covers first-support TUI journeys on the shipped update path', () => {
    for (const name of ['help', 'commands', 'status', 'session', 'new', 'fork', 'rename', 'compact', 'model', 'permissions']) {
      const next = runTuiJourney(commands, name)
      expect(next.mode, name).not.toBe('conversation')
    }
  })
})

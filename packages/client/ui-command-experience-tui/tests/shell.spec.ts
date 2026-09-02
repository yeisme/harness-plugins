import { describe, expect, it } from 'vitest'
import { buildP0Catalog } from '@yeisme/dsh-client-ui-command-experience-core'
import {
  COLON_MIGRATION_HINT,
  TUI_P0_NAMES,
  appendSidecar,
  createInitialTuiState,
  debugRecord,
  p1HiddenFromTui,
  render,
  renderStatusline,
  resolveTuiAssistQuery,
  runTuiJourney,
  tuiPluginLifecycleContract,
  update,
  validateRendererContribution,
} from '../src/index'

const SIZES = [
  { width: 120, height: 36 },
  { width: 80, height: 24 },
  { width: 60, height: 20 },
  { width: 50, height: 12 },
] as const

describe('TUI command-first shell', () => {
  const commands = buildP0Catalog({
    availableActions: new Set([
      'status', 'open-session', 'new-chat', 'fork-chat', 'rename-session',
      'compact-context', 'set-model', 'set-permissions', 'delete-session',
    ]),
    surfaces: new Set(['mcpInspector', 'agentContext', 'paneWorkbench', 'explorer', 'sourceControl']),
  })

  it('shares canonical identity with `/` and treats `:` as a migration hint', () => {
    const slash = resolveTuiAssistQuery(commands, '/session')
    const colon = resolveTuiAssistQuery(commands, ':session')
    expect(slash.rpcIssued).toBe(false)
    expect(colon.rpcIssued).toBe(false)
    expect(slash.selected?.canonicalName).toBe('session')
    expect(colon.selected?.canonicalName).toBe('session')
    expect(colon.migrationHint).toBe(COLON_MIGRATION_HINT)
  })

  it('keeps the full P0 catalog discoverable with aliases and disabled reasons', () => {
    for (const name of TUI_P0_NAMES) {
      const row = commands.find(item => item.canonicalName === name)
      expect(row, name).toBeDefined()
      expect(row!.availability.state === 'available' || Boolean(row!.availability.reason)).toBe(true)
    }
    expect(resolveTuiAssistQuery(commands, '/files').selected?.canonicalName).toBe('explorer')
    expect(resolveTuiAssistQuery(commands, '/exit').selected?.canonicalName).toBe('quit')
    expect(p1HiddenFromTui(commands, 'usage')).toBe(true)
    expect(p1HiddenFromTui(commands, 'theme')).toBe(true)
  })

  it('covers conversation, assist, center, argument, selector, confirm, destructive, dispatch, receipt, inspector, reset', () => {
    let { state } = { state: createInitialTuiState({ width: 80, height: 24 }) }
    expect(state.mode).toBe('conversation')

    ;({ state } = update(state, { type: 'input', text: '/sta' }, commands))
    expect(state.mode).toBe('slash-assist')
    expect(state.candidates.length).toBeGreaterThan(0)

    ;({ state } = update(state, { type: 'key', key: 'k', ctrl: true }, commands))
    expect(state.mode).toBe('command-center')
    expect(state.overlay).toBe('commands')
    ;({ state } = update(state, { type: 'key', key: 'ArrowRight' }, commands))
    expect(state.overlay).toBe('recent')
    ;({ state } = update(state, { type: 'key', key: 'ArrowRight' }, commands))
    expect(state.overlay).toBe('status')

    ;({ state } = update(state, { type: 'key', key: 'Escape' }, commands))
    expect(state.mode).toBe('conversation')

    ;({ state } = update(state, { type: 'input', text: '/rename' }, commands))
    state = {
      ...state,
      cursorKey: 'rename',
      commandDraft: { ...state.commandDraft, canonicalName: 'rename' },
    }
    ;({ state } = update(state, { type: 'key', key: 'Enter' }, commands))
    expect(['argument', 'slash-assist', 'confirm']).toContain(state.mode)

    let compact = createInitialTuiState({ width: 80, height: 24 })
    ;({ state: compact } = update(compact, { type: 'input', text: '/compact' }, commands))
    compact = { ...compact, cursorKey: 'compact' }
    ;({ state: compact } = update(compact, { type: 'key', key: 'Enter' }, commands))
    expect(compact.mode).toBe('confirm')
    expect(compact.confirmation?.focus).toBe('cancel')
    const afterBareEnter = update(compact, { type: 'key', key: 'Enter' }, commands).state
    expect(afterBareEnter.mode).not.toBe('dispatching')

    const sessions = [
      { ref: 'sess_alpha', label: 'Alpha' },
      { ref: 'sess_beta', label: 'Beta' },
    ]
    const deleteProjections = { selectorItems: sessions, destructivePhrase: 'DELETE 9F3A' }
    let del = createInitialTuiState({ width: 80, height: 24 })
    ;({ state: del } = update(del, { type: 'input', text: '/delete' }, commands, deleteProjections))
    expect(del.candidates).toContain('delete')
    while (del.cursorKey !== 'delete' && del.mode === 'slash-assist') {
      const previous = del.cursorKey
      ;({ state: del } = update(del, { type: 'key', key: 'ArrowDown' }, commands, deleteProjections))
      if (del.cursorKey === previous) break
    }
    expect(del.cursorKey).toBe('delete')
    ;({ state: del } = update(del, { type: 'key', key: 'Enter' }, commands, deleteProjections))
    expect(del.mode).toBe('selector')
    expect(del.selector?.items.map(item => item.ref)).toEqual(['sess_alpha', 'sess_beta'])
    expect(del.selector?.selectedRef).toBeNull()

    const emptySelector = update(del, { type: 'key', key: 'ArrowDown' }, commands, { selectorItems: [] }).state
    expect(emptySelector.selector?.selectedRef).not.toBe('sess_1')
    expect(emptySelector.selector?.items.map(item => item.ref)).toEqual(['sess_alpha', 'sess_beta'])

    ;({ state: del } = update(del, { type: 'key', key: 'ArrowDown' }, commands, deleteProjections))
    expect(del.selector?.selectedRef).toBe('sess_alpha')
    ;({ state: del } = update(del, { type: 'key', key: 'ArrowDown' }, commands, deleteProjections))
    expect(del.selector?.selectedRef).toBe('sess_beta')
    ;({ state: del } = update(del, { type: 'key', key: 'Enter' }, commands, deleteProjections))
    expect(del.mode).toBe('destructive-confirm')
    expect(del.confirmation?.focus).toBe('cancel')
    expect(del.commandDraft.selectedRef).toBe('sess_beta')
    expect(update(del, { type: 'key', key: 'Enter' }, commands, deleteProjections).state.mode).toBe('slash-assist')

    del = update(del, { type: 'input', text: 'nope' }, commands, deleteProjections).state
    del = update(del, { type: 'key', key: 'ArrowRight' }, commands, deleteProjections).state
    expect(update(del, { type: 'key', key: 'Enter' }, commands, deleteProjections).state.mode).toBe('destructive-confirm')

    del = update(del, { type: 'input', text: 'DELETE 9F3A' }, commands, deleteProjections).state
    const dispatched = update(del, { type: 'key', key: 'Enter' }, commands, deleteProjections)
    expect(dispatched.state.mode).toBe('dispatching')

    const receipt = update(dispatched.state, { type: 'receipt', correlationId: dispatched.state.commandDraft.correlationId ?? 'tui-1', status: 'success' }, commands)
    expect(receipt.state.mode).toBe('receipt')

    const inspector = { ...receipt.state, mode: 'inspector' as const }
    expect(render(inspector, 80, 24, { inspector: 'safe text' }).mode).toBe('inspector')

    const reset = update(inspector, { type: 'reset-session' }, commands)
    expect(reset.state.mode).toBe('conversation')
    expect(reset.state.inputDraft).toBe('')
  })

  it('drives /delete through update() selector → owner-phrase confirm → dispatch without inventing refs', () => {
    const sessions = [
      { ref: '/abs/path', label: 'Path' },
      { ref: 'sess_ok', label: 'Safe session' },
    ]
    const projections = { selectorItems: sessions, destructivePhrase: 'DELETE 9F3A' }
    let state = createInitialTuiState({ width: 80, height: 24 })
    ;({ state } = update(state, { type: 'input', text: '/delete' }, commands, projections))
    while (state.cursorKey !== 'delete' && state.mode === 'slash-assist') {
      const previous = state.cursorKey
      ;({ state } = update(state, { type: 'key', key: 'ArrowDown' }, commands, projections))
      if (state.cursorKey === previous) break
    }
    ;({ state } = update(state, { type: 'key', key: 'Enter' }, commands, projections))
    expect(state.mode).toBe('selector')
    expect(state.selector?.items.map(item => item.ref)).toEqual(['sess_ok'])
    expect(JSON.stringify(state.selector)).not.toContain('sess_1')
    expect(JSON.stringify(state.selector)).not.toContain('/abs/path')

    ;({ state } = update(state, { type: 'key', key: 'ArrowDown' }, commands, projections))
    expect(state.selector?.selectedRef).toBe('sess_ok')
    ;({ state } = update(state, { type: 'key', key: 'Enter' }, commands, projections))
    expect(state.mode).toBe('destructive-confirm')
    expect(state.confirmation?.phrase).toBe('DELETE 9F3A')
    expect(state.commandDraft.selectedRef).toBe('sess_ok')

    expect(update(state, { type: 'key', key: 'Enter' }, commands, projections).state.mode).not.toBe('dispatching')
    ;({ state } = update(state, { type: 'input', text: 'DELETE 9F3A' }, commands, projections))
    ;({ state } = update(state, { type: 'key', key: 'ArrowRight' }, commands, projections))
    const dispatched = update(state, { type: 'key', key: 'Enter' }, commands, projections)
    expect(dispatched.state.mode).toBe('dispatching')
    expect(dispatched.commands.some(command => command.kind === 'dispatch')).toBe(true)
  })

  it('renders golden frames for representative sizes without crashing unicode/ascii/color paths', () => {
    let state = createInitialTuiState({ width: 80, height: 24 })
    ;({ state } = update(state, { type: 'input', text: '/会话' }, commands))
    for (const size of SIZES) {
      const color = render(state, size.width, size.height, { commands })
      expect(color.lines).toHaveLength(size.height)
      expect(color.lines.every(line => line.length <= size.width * 2)).toBe(true)
      const ascii = render(
        { ...state, unicode: false, color: false, viewport: size },
        size.width,
        size.height,
        { commands, statusLine: 'status unavailable' },
      )
      expect(ascii.lines).toHaveLength(size.height)
      expect(ascii.lines.join('\n')).not.toMatch(/raw prompt|provider payload|private args|sk-|\/home\//)
    }
  })

  it('keeps draft, selection, receipt, and scroll anchor across resize', () => {
    let state = createInitialTuiState({ width: 120, height: 36 })
    ;({ state } = update(state, { type: 'input', text: '/session' }, commands))
    state = { ...state, cursorKey: 'session', scrollAnchor: 12, receiptRef: 'c1' }
    const resized = update(state, { type: 'resize', width: 50, height: 12 }, commands).state
    expect(resized.commandDraft.query).toBe(state.commandDraft.query)
    expect(resized.cursorKey).toBe('session')
    expect(resized.receiptRef).toBe('c1')
    expect(resized.scrollAnchor).toBe(12)
    expect(resized.viewport).toEqual({ width: 50, height: 12 })
    const back = update(resized, { type: 'resize', width: 120, height: 36 }, commands).state
    expect(back.cursorKey).toBe('session')
    expect(back.scrollAnchor).toBe(12)
  })

  it('does not read stdin, enter raw/alternate screen, or capture signals', () => {
    expect(tuiPluginLifecycleContract()).toEqual({
      readsStdin: false,
      rawMode: false,
      alternateScreen: false,
      capturesSignals: false,
    })
  })

  it('rejects unknown/credential/path renderer contributions and writes debug to a sidecar', () => {
    expect(validateRendererContribution({ viewKind: 'x', render: () => 'ok' })).not.toBeNull()
    expect(validateRendererContribution({ viewKind: 'https://evil', render: () => 'ok' })).toBeNull()
    expect(validateRendererContribution({ viewKind: 'pane', apiKey: 'sk-secret', render: () => 'ok' })).toBeNull()
    const lines: string[] = []
    appendSidecar({ write: line => lines.push(line) }, debugRecord(createInitialTuiState()))
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toMatch(/sk-|\/home\/|raw prompt/)
  })

  it('covers first-support TUI journeys without inventing status from a ledger', () => {
    for (const name of ['help', 'commands', 'status', 'session', 'new', 'fork', 'rename', 'compact', 'model', 'permissions']) {
      const next = runTuiJourney(commands, name)
      expect(next.mode).not.toBe('conversation')
    }
    expect(renderStatusline(null, 40)).toBe('status unavailable')
  })

  it('covers inspect and lifecycle P0 identity plus danger gates', () => {
    for (const name of ['plugins', 'mcp', 'skills', 'pane', 'explorer', 'git', 'plan', 'goal', 'diff', 'review']) {
      const row = commands.find(item => item.canonicalName === name)
      expect(row, name).toBeDefined()
      expect(row!.availability.state === 'available' || Boolean(row!.availability.reason)).toBe(true)
    }
    for (const name of ['agent', 'resume', 'archive', 'delete', 'preset', 'reasoning', 'mention', 'copy', 'feedback', 'init', 'logout', 'quit']) {
      const row = commands.find(item => item.canonicalName === name)
      expect(row, name).toBeDefined()
      if (name === 'delete') expect(row!.danger).toBe('destructive')
      if (name === 'quit' || name === 'logout' || name === 'archive') expect(row!.danger).toBe('confirm')
    }
    expect(resolveTuiAssistQuery(commands, '/agents').selected?.canonicalName).toBe('agent')
    expect(resolveTuiAssistQuery(commands, '/r').selected?.canonicalName).toBe('resume')
  })

  it('renders statusline unavailable honestly when the sibling snapshot is missing', () => {
    expect(renderStatusline(null, 40)).toBe('status unavailable')
    expect(renderStatusline({ available: false }, 40, { ascii: true })).toBe('status unavailable')
    expect(renderStatusline({ available: true, capsuleLabel: 'Context 88%' }, 40)).toBe('Context 88%')
  })
})

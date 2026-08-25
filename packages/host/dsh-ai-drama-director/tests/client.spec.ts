import { describe, expect, it } from 'vitest'
import {
  announceDramaFocus,
  applyDramaKey,
  canSubmitDramaCommand,
  createDirectorPreset,
  createDramaCommandGroup,
  createDramaInteractionState,
  createDramaPaneViews,
  dramaHelpCopy,
  handleDramaCommand,
  mapDramaCommandError,
  resolveDramaBreakpoint,
  selectedDramaCommand,
  shouldExpandToShowControlRoom,
  visibleDramaPanesForBreakpoint,
  DramaClientRegistry,
  type DramaContextV1,
} from '../src/index.js'

const freshContext = (): DramaContextV1 => ({
  schema: 'drama.context.v1',
  workspaceRef: 'ws:alpha',
  projectRef: 'proj:show',
  showRef: 'show:1',
  contextRevision: 'rev-3',
  freshness: 'fresh',
  ownerVersions: { auctra: 'v1' },
})

describe('Director command group and panes', () => {
  it('keeps help enabled and disables owner commands without capability', () => {
    const disabled = createDramaCommandGroup(false)
    expect(selectedDramaCommand(disabled, '/drama help')?.disabled).toBe(false)
    expect(canSubmitDramaCommand(selectedDramaCommand(disabled, '/drama review'))).toBe(false)
    expect(selectedDramaCommand(disabled, '/drama review')?.reason).toBe('missing drama owner projection')
    expect(dramaHelpCopy().commands).toContain('/drama handoff')
    expect(mapDramaCommandError({
      kind: 'unknown',
      reason: 'owner settlement is unknown; do not retry with a new idempotency key',
      retried: false,
    }).message).toContain('Do not retry')
  })

  it('registers Context/Review/Run first and opens Story/Visual/Audio as secondary', () => {
    const registry = new DramaClientRegistry(true)
    const first = registry.getSnapshot()
    expect(first.preset).toEqual(createDirectorPreset())
    expect(first.panes.filter((pane) => pane.visible).map((pane) => pane.id)).toEqual(['Context', 'Review', 'Run'])
    expect(shouldExpandToShowControlRoom()).toBe(false)
    registry.openSecondary('Story')
    expect(registry.getSnapshot().panes.find((pane) => pane.id === 'Story')?.visible).toBe(true)
    expect(createDramaPaneViews(['Visual', 'Audio']).filter((pane) => pane.visible).map((pane) => pane.id))
      .toEqual(['Context', 'Review', 'Run', 'Visual', 'Audio'])
  })

  it('disposes commands, panes, and listeners without leftover registration', () => {
    const registry = new DramaClientRegistry(true)
    let ticks = 0
    const unsubscribe = registry.subscribe(() => {
      ticks += 1
    })
    registry.openSecondary('Audio')
    expect(ticks).toBe(1)
    unsubscribe()
    registry.dispose()
    expect(registry.getSnapshot()).toMatchObject({ disposed: true, commands: [], panes: [] })
    registry.openSecondary('Story')
    expect(registry.getSnapshot().panes).toEqual([])
  })
})

describe('keyboard, focus, and responsive model', () => {
  it('cycles command, pane, and Open in Workbench focus from the keyboard', () => {
    const commands = createDramaCommandGroup(true)
    const panes = createDramaPaneViews()
    let state = createDramaInteractionState('regular')
    state = applyDramaKey(state, { key: 'ArrowDown' }, commands, panes)
    expect(state.focusedCommandIndex).toBe(1)
    state = applyDramaKey(state, { key: 'Tab' }, commands, panes)
    expect(state.focusZone).toBe('pane')
    state = applyDramaKey(state, { key: 'ArrowRight' }, commands, panes)
    expect(state.focusedPaneId).toBe('Review')
    state = applyDramaKey(state, { key: 'Tab' }, commands, panes)
    expect(state.focusZone).toBe('handoff')
    expect(announceDramaFocus(state, commands)).toBe('Open in Workbench')
    state = applyDramaKey(state, { key: 'Escape' }, commands, panes)
    expect(state.focusZone).toBe('command')
  })

  it('hides secondary panes on a narrow breakpoint and announces disabled commands', () => {
    expect(resolveDramaBreakpoint(640)).toBe('narrow')
    const panes = createDramaPaneViews(['Story'])
    expect(visibleDramaPanesForBreakpoint(panes, 'narrow').map((pane) => pane.id)).toEqual(['Context', 'Review', 'Run'])
    const commands = createDramaCommandGroup(false)
    const state = { ...createDramaInteractionState(), focusedCommandIndex: 3 }
    expect(announceDramaFocus(state, commands)).toContain('unavailable')
  })
})

describe('missing capability, unknown, partial, and reconcile', () => {
  it('does not submit mutations when capability or settlement is incomplete', async () => {
    const missing = await handleDramaCommand({
      schema: 'drama.command-request.v1',
      command: 'review',
      selector: 'next-review',
      contextRevision: 'rev-3',
    })
    expect(missing.kind).toBe('needs_contract')
    expect(mapDramaCommandError(missing).title).toBe('Contract Required')

    const unknown = await handleDramaCommand({
      schema: 'drama.command-request.v1',
      command: 'repair',
      selector: 'episode:ep-2',
      contextRevision: 'rev-3',
    }, {
      owner: { snapshot: async () => freshContext() },
      now: () => 1,
      readDescriptor: async () => ({
        descriptorRef: 'desc:repair-1',
        command: 'repair',
        targetRef: 'episode:ep-2',
        contextRevision: 'rev-3',
        expiresAt: 2,
        idempotencyKey: 'idem-repair',
      }),
      dispatch: async () => 'unknown',
    })
    expect(unknown).toMatchObject({ kind: 'unknown', retried: false })

    const reconcile = await handleDramaCommand({
      schema: 'drama.command-request.v1',
      command: 'handoff',
      selector: 'episode:ep-2',
      contextRevision: 'rev-3',
    }, {
      owner: { snapshot: async () => freshContext() },
      now: () => 1,
      readDescriptor: async () => ({
        descriptorRef: 'desc:handoff-1',
        command: 'handoff',
        targetRef: 'episode:ep-2',
        contextRevision: 'rev-3',
        expiresAt: 2,
        idempotencyKey: 'idem-handoff',
      }),
      dispatch: async () => 'reconcile_required',
    })
    expect(reconcile.kind).toBe('reconcile_required')
    expect(mapDramaCommandError(reconcile).message).toContain('refresh')
  })
})

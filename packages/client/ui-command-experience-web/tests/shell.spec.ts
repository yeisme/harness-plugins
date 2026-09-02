import { describe, expect, it } from 'vitest'
import { buildP0Catalog, commandDraftReducer, draftAllowsBareEnter } from '@yeisme/dsh-client-ui-command-experience-core'
import {
  ACTIVITY_VIEW_ID,
  RECEIPT_SUCCESS_COLLAPSE_MS,
  SLASH_ASSIST_ROW_CAP,
  TOKEN_USAGE_OPEN_ID,
  TOKEN_USAGE_VIEW_ID,
  activityContainsForbidden,
  applySuggestionChip,
  commandResultEntersTranscript,
  compactComposerControls,
  dropStaleDirectoryRows,
  firstSupportCommands,
  helpDetailFor,
  openCommandResultView,
  p1AbsentFromExecutable,
  probeFirstCommandMenuFallback,
  projectWebDirectory,
  receiptLaneFromDraft,
  restoreActivityFromEvents,
  restoreComposerDraft,
  sameCanonicalAcrossEntries,
  selectWebCommand,
  startWebDraft,
  turnEndSuggestionChips,
  webResponsiveMode,
  coarsePointerMinPx,
  commandShellTokens,
  commandTone,
} from '../src/index'

describe('web dual-entry shell', () => {
  const commands = buildP0Catalog({
    availableActions: new Set([
      'status',
      'open-session',
      'new-chat',
      'fork-chat',
      'rename-session',
      'compact-context',
      'set-model',
      'set-permissions',
    ]),
  })
  const directory = { revision: 4, commands }

  it('shares one live revisioned directory between Slash Assist and Palette', () => {
    const slash = projectWebDirectory(directory, 'slash-assist', '/')
    const palette = projectWebDirectory(directory, 'palette', '/')
    expect(slash.revision).toBe(palette.revision)
    expect(slash.rpcIssued).toBe(false)
    expect(palette.rpcIssued).toBe(false)
    expect(slash.rows.length).toBeLessThanOrEqual(SLASH_ASSIST_ROW_CAP)
    expect(palette.rows.length).toBeGreaterThan(slash.rows.length)
    const identity = sameCanonicalAcrossEntries(directory, 'sessions')
    expect(identity.slash).toBe('session')
    expect(identity.palette).toBe('session')
  })

  it('keeps disabled rows with a reason and does not dispatch them', () => {
    const mcp = projectWebDirectory(directory, 'palette', '/mcp').rows
      .find(row => row.command.canonicalName === 'mcp')
    expect(mcp?.command.availability.state).toBe('disabled')
    expect(mcp?.command.availability.reason).toBeTruthy()
    const draft = selectWebCommand(startWebDraft('/mcp', ''), mcp!.command)
    expect(draft.step).toBe('assist')
  })

  it('restores the original composer draft on layered Escape', () => {
    const session = commands.find(item => item.canonicalName === 'session')!
    let draft = startWebDraft('/session', 'keep writing')
    draft = selectWebCommand(draft, session)
    expect(draft.step).toBe('selector')
    draft = restoreComposerDraft(draft)
    expect(draft.step).toBe('idle')
    expect(draft.visibleDraft).toBe('keep writing')
  })

  it('does not confirm non-safe commands on bare Enter', () => {
    const compact = commands.find(item => item.canonicalName === 'compact')!
    const draft = selectWebCommand(startWebDraft('/compact', ''), compact)
    expect(draftAllowsBareEnter(draft)).toBe(false)
    expect(commandDraftReducer(draft, { type: 'ENTER' }).step).not.toBe('dispatching')
  })

  it('collapses success receipts after 4s and keeps errors visible', () => {
    const status = commands.find(item => item.canonicalName === 'status')!
    let draft = selectWebCommand(startWebDraft('/status', ''), { ...status, availability: { state: 'available' } })
    draft = commandDraftReducer(draft, { type: 'DISPATCH', correlationId: 'c1' })
    const pending = receiptLaneFromDraft(draft)
    expect(pending.duplicateBlocked).toBe(true)
    draft = commandDraftReducer(draft, { type: 'RECEIPT', status: 'success', correlationId: 'c1' })
    expect(receiptLaneFromDraft(draft, 1000, 0).collapsed).toBe(false)
    expect(receiptLaneFromDraft(draft, RECEIPT_SUCCESS_COLLAPSE_MS, 0).collapsed).toBe(true)
    draft = commandDraftReducer(draft, { type: 'RECEIPT', status: 'failed', correlationId: 'c1', message: 'owner error' })
    expect(receiptLaneFromDraft(draft).collapsed).toBe(false)
  })

  it('restores Activity from official command/run|done without a second client log', () => {
    const rows = restoreActivityFromEvents([
      { type: 'command/run', sessionRef: 'sess_1', canonicalName: 'status', correlationId: 'c1' },
      { type: 'command/done', sessionRef: 'sess_1', canonicalName: 'status', correlationId: 'c1', status: 'success', summary: '/status ready' },
      { type: 'command/done', sessionRef: 'sess_other', canonicalName: 'new', correlationId: 'c2', status: 'success' },
    ], 'sess_1')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.canonicalName).toBe('status')
    expect(commandResultEntersTranscript()).toBe(false)
    expect(activityContainsForbidden({ summary: 'raw prompt leaked' })).toBe(true)
  })

  it('opens Pane preview or falls back when Pane is missing', () => {
    let opened: string[] = []
    const pane = {
      openView(request: { viewKind: string; resourceKey?: string }) {
        const reused = opened.includes(request.viewKind)
        opened = [...opened, request.viewKind]
        return { viewId: request.viewKind, reused }
      },
    }
    const first = openCommandResultView(pane, { viewKind: 'inspect.status', retention: 'preview', singleton: true })
    const second = openCommandResultView(pane, { viewKind: 'inspect.status', retention: 'preview', singleton: true })
    expect(first.opened).toBe(true)
    expect(second.reused).toBe(true)
    expect(openCommandResultView(null, { viewKind: 'inspect.status', retention: 'preview' }).fallback).toBe('bounded-dialog')
  })

  it('keeps Tokens surfaces unchanged and shares first-support commands', () => {
    expect(TOKEN_USAGE_OPEN_ID).toBe('token-usage-open')
    expect(TOKEN_USAGE_VIEW_ID).toBe('workspace.token-usage')
    expect(ACTIVITY_VIEW_ID).toBe('workspace.command-activity')
    expect(firstSupportCommands(directory)).toEqual([
      'status', 'session', 'new', 'fork', 'rename', 'compact', 'model', 'permissions',
    ])
    expect(p1AbsentFromExecutable(directory, 'usage')).toBe(true)
    expect(helpDetailFor(directory, 'files')?.canonicalName).toBe('explorer')
  })

  it('uses probe-first Command Menu fallback when the new shell seam is missing', () => {
    const fallback = probeFirstCommandMenuFallback({
      composerSeam: false,
      paletteSeam: false,
      legacyMenuSeam: true,
    })
    expect(fallback.useLegacyMenu).toBe(true)
    expect(fallback.reason).toContain('fallback')
    expect(probeFirstCommandMenuFallback({
      composerSeam: true,
      paletteSeam: true,
      legacyMenuSeam: true,
    }).useLegacyMenu).toBe(false)
  })

  it('drops stale rows after a directory unload and keeps responsive hit targets', () => {
    const next = { revision: 5, commands: commands.filter(item => item.canonicalName !== 'git') }
    expect(dropStaleDirectoryRows(directory, next)).toEqual(['git'])
    expect(webResponsiveMode(1440)).toBe('anchored')
    expect(webResponsiveMode(800)).toBe('sheet')
    expect(webResponsiveMode(390)).toBe('full')
    expect(coarsePointerMinPx('coarse')).toBe(44)
    expect(compactComposerControls({
      modelLabel: 'm',
      presetLabel: 'p',
      reasoningLabel: 'r',
      permissionLabel: 'perm',
    }, 800)).toEqual(['modelLabel', 'permissionLabel'])
    const chips = turnEndSuggestionChips([
      { id: '1', label: 'Verify', draftText: 'run verification' },
      { id: '2', label: 'Two', draftText: 'two' },
      { id: '3', label: 'Three', draftText: 'three' },
      { id: '4', label: 'Four', draftText: 'four' },
    ], true)
    expect(chips).toHaveLength(3)
    expect(applySuggestionChip('', chips[0]!)).toBe('run verification')
    expect(turnEndSuggestionChips(chips, false)).toEqual([])
    const tokens = commandShellTokens()
    expect(tokens.radius.overlay).toBe('10px')
    expect(commandTone('warning')).toBe('warn')
    expect(commandTone('critical')).toBe('critical')
  })
})

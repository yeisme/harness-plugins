import { describe, expect, it } from 'vitest'
import {
  buildP0Catalog,
  commandDraftReducer,
  draftAllowsBareEnter,
  projectCommandDetail,
  projectPaletteGroups,
  projectSlashAssistRows,
  resolveCanonicalIdentity,
} from '@yeisme/dsh-client-ui-command-experience-core'
import {
  activityContainsForbidden,
  coarsePointerMinPx,
  commandResultEntersTranscript,
  commandShellTokens,
  commandTone,
  compactComposerControls,
  firstSupportCommands,
  helpDetailFor,
  openCommandResultView,
  p1AbsentFromExecutable,
  probeFirstCommandMenuFallback,
  projectWebDirectory,
  receiptLaneFromDraft,
  restoreActivityFromEvents,
  restoreComposerDraft,
  runFirstSupportMatrix,
  sameCanonicalAcrossEntries,
  selectWebCommand,
  startWebDraft,
  turnEndSuggestionChips,
  webResponsiveMode,
} from '../src/index'
import { DEFAULT_COMMAND_KEYMAP } from '@yeisme/dsh-client-ui-command-experience-core'

describe('web freeze-gate shipped path', () => {
  const commands = buildP0Catalog({
    availableActions: new Set([
      'status', 'open-session', 'new-chat', 'fork-chat', 'rename-session',
      'compact-context', 'set-model', 'set-permissions',
    ]),
  })
  const directory = { revision: 7, commands }

  it('shares one directory between Slash Assist (cap 8) and Palette groups', () => {
    const slash = projectSlashAssistRows(commands, { query: '/', surface: 'web', limit: 8 })
    const palette = projectPaletteGroups(commands, { query: '/', surface: 'web' })
    expect(slash.length).toBeLessThanOrEqual(8)
    expect([...palette.values()].flat().length).toBeGreaterThan(slash.length)
    const identity = sameCanonicalAcrossEntries(directory, 'sessions')
    expect(identity.slash).toBe('session')
    expect(identity.palette).toBe('session')
    expect(projectWebDirectory(directory, 'slash-assist', '/').rpcIssued).toBe(false)
  })

  it('derives command detail without a handler and restores the original draft', () => {
    const detail = helpDetailFor(directory, 'files')
    expect(detail?.canonicalName).toBe('explorer')
    expect(JSON.stringify(detail)).not.toMatch(/handler|import\(/)
    const session = resolveCanonicalIdentity(commands, 'session')!
    let draft = startWebDraft('/session', 'keep writing')
    draft = selectWebCommand(draft, session)
    expect(draft.step).toBe('selector')
    draft = restoreComposerDraft(draft)
    expect(draft.visibleDraft).toBe('keep writing')
  })

  it('does not confirm non-safe commands on bare Enter and uses Ctrl/Cmd+Enter bindings', () => {
    const compact = resolveCanonicalIdentity(commands, 'compact')!
    const draft = selectWebCommand(startWebDraft('/compact', ''), compact)
    expect(draftAllowsBareEnter(draft)).toBe(false)
    expect(commandDraftReducer(draft, { type: 'ENTER' }).step).not.toBe('dispatching')
    expect(DEFAULT_COMMAND_KEYMAP.confirmExecute).toEqual(['ctrl+enter', 'meta+enter'])
  })

  it('restores Activity from command/run|done and never injects results into transcript', () => {
    const rows = restoreActivityFromEvents([
      { type: 'command/run', sessionRef: 'sess_1', canonicalName: 'status', correlationId: 'c1' },
      { type: 'command/done', sessionRef: 'sess_1', canonicalName: 'status', correlationId: 'c1', status: 'success', summary: '/status ready' },
    ], 'sess_1')
    expect(rows[0]?.canonicalName).toBe('status')
    expect(commandResultEntersTranscript()).toBe(false)
    expect(activityContainsForbidden({ summary: 'raw prompt leaked' })).toBe(true)
    let draft = selectWebCommand(startWebDraft('/status', ''), {
      ...resolveCanonicalIdentity(commands, 'status')!,
      availability: { state: 'available' },
    })
    draft = commandDraftReducer(draft, { type: 'DISPATCH', correlationId: 'c1' })
    expect(receiptLaneFromDraft(draft).duplicateBlocked).toBe(true)
  })

  it('opens Pane preview or bounded fallback and keeps Tokens ids unchanged', () => {
    const pane = {
      openView(request: { viewKind: string }) {
        return { viewId: request.viewKind, reused: false }
      },
    }
    expect(openCommandResultView(pane, { viewKind: 'inspect.status', retention: 'preview' }).opened).toBe(true)
    expect(openCommandResultView(null, { viewKind: 'inspect.status', retention: 'preview' }).fallback).toBe('bounded-dialog')
    expect(firstSupportCommands(directory)).toEqual([
      'status', 'session', 'new', 'fork', 'rename', 'compact', 'model', 'permissions',
    ])
    expect(p1AbsentFromExecutable(directory, 'usage')).toBe(true)
    expect(probeFirstCommandMenuFallback({
      composerSeam: false,
      paletteSeam: false,
      legacyMenuSeam: true,
    }).useLegacyMenu).toBe(true)
  })

  it('keeps Composer chips, visual tokens, and responsive hit targets on the shipped helpers', () => {
    const chips = turnEndSuggestionChips([
      { id: '1', label: 'Verify', draftText: 'run verification' },
      { id: '2', label: 'Two', draftText: 'two' },
      { id: '3', label: 'Three', draftText: 'three' },
      { id: '4', label: 'Four', draftText: 'four' },
    ], true)
    expect(chips).toHaveLength(3)
    expect(webResponsiveMode(1440)).toBe('anchored')
    expect(webResponsiveMode(800)).toBe('sheet')
    expect(webResponsiveMode(390)).toBe('full')
    expect(coarsePointerMinPx('coarse')).toBe(44)
    expect(commandTone('warning')).toBe('warn')
    expect(commandShellTokens().radius.overlay).toBe('10px')
    expect(compactComposerControls({
      modelLabel: 'm',
      presetLabel: 'p',
      reasoningLabel: 'r',
      permissionLabel: 'perm',
    }, 800)).toEqual(['modelLabel', 'permissionLabel'])
    expect(projectCommandDetail(resolveCanonicalIdentity(commands, 'init')!).availability.reason).toMatch(/not applicable/i)
  })

  it('covers first-support success/disabled/stale/permission/owner-error on the shipped matrix', () => {
    const matrix = runFirstSupportMatrix(commands)
    expect(matrix).toHaveLength(40)
    expect(new Set(matrix.map(row => row.outcome))).toEqual(new Set([
      'success', 'disabled', 'stale', 'permission', 'owner-error',
    ]))
  })
})

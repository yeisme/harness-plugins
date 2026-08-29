import { describe, expect, it, beforeEach } from 'vitest'
import { DramaClientRegistry } from '@yeisme/dsh-ai-drama-director'

describe('AI Drama Director client', () => {
  describe('client registry and disposal', () => {
    it('creates a registry with disabled commands when capability is missing', () => {
      const registry = new DramaClientRegistry(false)
      const snapshot = registry.getSnapshot()

      expect(snapshot.commandGroup).toBe('drama')
      expect(snapshot.commands).toHaveLength(10)
      expect(snapshot.commands.some(cmd => cmd.disabled)).toBe(true)
      expect(snapshot.disposed).toBe(false)
    })

    it('creates a registry with enabled commands when capability is available', () => {
      const registry = new DramaClientRegistry(true)
      const snapshot = registry.getSnapshot()

      expect(snapshot.commands.filter(cmd => !cmd.disabled)).toHaveLength(6)
      expect(snapshot.disposed).toBe(false)
    })

    it('opens secondary panes without expanding to a control room', () => {
      const registry = new DramaClientRegistry(false)
      expect(registry.getSnapshot().panes.find(p => p.id === 'Story')?.visible).toBe(false)

      registry.openSecondary('Story')
      expect(registry.getSnapshot().panes.find(p => p.id === 'Story')?.visible).toBe(true)
      expect(registry.getSnapshot().panes.filter(p => p.visible).length).toBe(4) // Context, Review, Run, Story
    })

    it('clears all registrations on dispose', () => {
      const registry = new DramaClientRegistry(true)
      expect(registry.getSnapshot().disposed).toBe(false)

      registry.dispose()
      const disposed = registry.getSnapshot()
      expect(disposed.disposed).toBe(true)
      expect(disposed.commands).toHaveLength(0)
      expect(disposed.panes).toHaveLength(0)
    })

    it('notifies subscribers on registration changes', () => {
      const registry = new DramaClientRegistry(false)
      let notified = false
      const unsubscribe = registry.subscribe(() => {
        notified = true
      })

      registry.openSecondary('Visual')
      expect(notified).toBe(true)

      notified = false
      registry.dispose()
      expect(notified).toBe(true)

      // Verify unsubscribed listener is not called
      notified = false
      registry.openSecondary('Story')
      expect(notified).toBe(false)
    })
  })

  describe('disabled entries and missing capability', () => {
    it('shows disabled reason when capability is missing', () => {
      const registry = new DramaClientRegistry(false)
      const commands = registry.getSnapshot().commands

      const reviewCommand = commands.find(cmd => cmd.id === '/drama review')
      expect(reviewCommand?.disabled).toBe(true)
      expect(reviewCommand?.reason).toBe('missing drama owner projection')
    })

    it('keeps help command always enabled', () => {
      const registry = new DramaClientRegistry(false)
      const commands = registry.getSnapshot().commands

      const helpCommand = commands.find(cmd => cmd.id === '/drama help')
      expect(helpCommand?.disabled).toBe(false)
    })
  })

  describe('keyboard and focus', () => {
    it('cycles through focus zones on Tab', () => {
      const { applyDramaKey, createDramaInteractionState } = require('@yeisme/dsh-ai-drama-director')
      const state = createDramaInteractionState()
      const commands = []
      const panes = []

      const next = applyDramaKey(state, { key: 'Tab' }, commands, panes)
      expect(next.focusZone).toBe('pane')

      const back = applyDramaKey(next, { key: 'Tab', shiftKey: true }, commands, panes)
      expect(back.focusZone).toBe('command')
    })

    it('announces focused command for screen readers', () => {
      const { announceDramaFocus, createDramaInteractionState } = require('@yeisme/dsh-ai-drama-director')
      const state = createDramaInteractionState()
      const commands = [
        { id: '/drama', label: 'Drama', disabled: false },
        { id: '/drama review', label: 'Review', disabled: true, reason: 'missing projection' },
      ]

      const announced = announceDramaFocus(state, commands)
      expect(announced).toBe('Drama')
    })
  })

  describe('responsive behavior', () => {
    it('hides secondary panes on narrow breakpoint', () => {
      const { visibleDramaPanesForBreakpoint, createDramaPaneViews } = require('@yeisme/dsh-ai-drama-director')
      const panes = createDramaPaneViews(['Story', 'Visual'])

      const narrow = visibleDramaPanesForBreakpoint(panes, 'narrow')
      expect(narrow.filter(p => p.kind === 'secondary').length).toBe(0)
      expect(narrow.filter(p => p.kind === 'first-support').every(p => p.visible)).toBe(true)
    })

    it('shows all visible panes on regular breakpoint', () => {
      const { visibleDramaPanesForBreakpoint, createDramaPaneViews } = require('@yeisme/dsh-ai-drama-director')
      const panes = createDramaPaneViews(['Story'])

      const regular = visibleDramaPanesForBreakpoint(panes, 'regular')
      expect(regular.filter(p => p.visible).length).toBe(4) // Context, Review, Run, Story
    })
  })

  describe('default preset behavior', () => {
    it('creates Director preset with first-support panes only', () => {
      const { createDirectorPreset } = require('@yeisme/dsh-ai-drama-director')
      const preset = createDirectorPreset()

      expect(preset.id).toBe('director')
      expect(preset.visible).toEqual(['Context', 'Review', 'Run'])
      expect(preset.secondary).toEqual(['Story', 'Visual', 'Audio'])
      expect(preset.openInWorkbench).toBe(true)
    })

    it('never expands to show full control room', () => {
      const { shouldExpandToShowControlRoom } = require('@yeisme/dsh-ai-drama-director')
      expect(shouldExpandToShowControlRoom()).toBe(false)
    })
  })

  describe('unknown result handling', () => {
    it('shows non-retryable message for unknown command results', () => {
      const { mapDramaCommandError } = require('@yeisme/dsh-ai-drama-director')

      const error = mapDramaCommandError({
        kind: 'unknown',
        reason: 'owner settlement is unknown; do not retry with a new idempotency key',
        retried: false,
      })

      expect(error).toMatchObject({
        kind: 'error',
        title: 'Command Unknown',
        message: 'The command could not be completed. Do not retry automatically.',
        retryable: false,
      })
    })

    it('prevents auto-retry for unknown results', () => {
      const { canRetryDramaResult } = require('@yeisme/dsh-ai-drama-director')

      expect(canRetryDramaResult({ kind: 'unknown', reason: 'test', retried: false })).toBe(false)
      expect(canRetryDramaResult({ kind: 'submitted', reason: 'test', retried: false })).toBe(false)
      expect(canRetryDramaResult({ kind: 'opened', reason: 'test', retried: false })).toBe(false)
    })
  })

  describe('reconcile_required handling', () => {
    it('shows reconcile message with context refresh suggestion', () => {
      const { mapDramaCommandError } = require('@yeisme/dsh-ai-drama-director')

      const error = mapDramaCommandError({
        kind: 'reconcile_required',
        reason: 'context revision drifted; resync before mutation',
        retried: false,
      })

      expect(error).toMatchObject({
        kind: 'warning',
        title: 'Context Updated',
        message: expect.stringContaining('refresh'),
        retryable: true,
      })
    })

    it('shows reconcile for descriptor expiry', () => {
      const { mapDramaCommandError } = require('@yeisme/dsh-ai-drama-director')

      const error = mapDramaCommandError({
        kind: 'reconcile_required',
        reason: 'descriptor expired; request a fresh preview',
        retried: false,
      })

      expect(error.kind).toBe('warning')
      expect(error.retryable).toBe(true)
    })
  })

  describe('partial and needs_contract handling', () => {
    it('shows disabled state for missing contract', () => {
      const { mapDramaCommandError } = require('@yeisme/dsh-ai-drama-director')

      const error = mapDramaCommandError({
        kind: 'needs_contract',
        reason: 'server-authored descriptor is missing',
        retried: false,
      })

      expect(error).toMatchObject({
        kind: 'disabled',
        title: 'Contract Required',
        message: expect.stringContaining('descriptor'),
        retryable: false,
      })
    })

    it('shows offline state for offline owner', () => {
      const { mapDramaCommandError } = require('@yeisme/dsh-ai-drama-director')

      const error = mapDramaCommandError({
        kind: 'needs_contract',
        reason: 'drama owner is offline',
        retried: false,
      })

      expect(error.kind).toBe('disabled')
      expect(error.retryable).toBe(false)
    })
  })

  describe('command error mapping', () => {
    it('maps all result kinds to appropriate UI states', () => {
      const { mapDramaCommandError } = require('@yeisme/dsh-ai-drama-director')

      const kinds = [
        { kind: 'opened', expectKind: 'success' },
        { kind: 'submitted', expectKind: 'success' },
        { kind: 'proposal_created', expectKind: 'success' },
        { kind: 'unknown', expectKind: 'error' },
        { kind: 'reconcile_required', expectKind: 'warning' },
        { kind: 'needs_contract', expectKind: 'disabled' },
      ] as const

      for (const { kind, expectKind } of kinds) {
        const error = mapDramaCommandError({
          kind,
          reason: `test ${kind}`,
          retried: false,
        })
        expect(error.kind).toBe(expectKind)
      }
    })
  })

  describe('dispose cleanup', () => {
    it('removes all command registrations on dispose', () => {
      const registry = new DramaClientRegistry(true)
      expect(registry.getSnapshot().commands.length).toBeGreaterThan(0)

      registry.dispose()
      expect(registry.getSnapshot().commands).toHaveLength(0)
    })

    it('removes all pane registrations on dispose', () => {
      const registry = new DramaClientRegistry(true)
      expect(registry.getSnapshot().panes.length).toBeGreaterThan(0)

      registry.dispose()
      expect(registry.getSnapshot().panes).toHaveLength(0)
    })

    it('clears preset on dispose', () => {
      const registry = new DramaClientRegistry(true)
      expect(registry.getSnapshot().preset).toBeDefined()

      registry.dispose()
      expect(registry.getSnapshot().preset).toBeUndefined()
    })

    it('prevents further operations after dispose', () => {
      const registry = new DramaClientRegistry(true)
      registry.dispose()

      expect(() => registry.openSecondary('Story')).not.toThrow()
      expect(registry.getSnapshot().disposed).toBe(true)
      expect(registry.getSnapshot().panes).toHaveLength(0)
    })
  })
})

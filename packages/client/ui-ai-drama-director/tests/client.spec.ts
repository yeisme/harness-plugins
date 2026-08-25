import { describe, expect, it, beforeEach } from 'vitest'
import { DramaClientRegistry } from '@yeisme/dsh-ai-drama-director'

describe('AI Drama Director client', () => {
  describe('client registry and disposal', () => {
    it('creates a registry with disabled commands when capability is missing', () => {
      const registry = new DramaClientRegistry(false)
      const snapshot = registry.getSnapshot()

      expect(snapshot.commandGroup).toBe('drama')
      expect(snapshot.commands).toHaveLength(6)
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
})

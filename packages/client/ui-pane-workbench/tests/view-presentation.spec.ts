import { describe, expect, it } from 'vitest'
import { PaneViewRegistry, PaneViewRegistrationError, PRESENTATION_SIZE_MAX, PRESENTATION_SIZE_MIN, type PaneViewRegistrationV1 } from '../src/view-registry.ts'
import { WORKBENCH_ICON_NAMES, isWorkbenchIconName } from '../src/icon.ts'
import { pluginDefinition } from './fixtures.js'

function registry(): PaneViewRegistry {
  return new PaneViewRegistry({ capabilities: new Set<string>() })
}

const EXAMPLE_DESCRIPTOR = pluginDefinition('example.kind').views[0]
const EXAMPLE_KIND = EXAMPLE_DESCRIPTOR.kind

function baseRegistration(presentation?: unknown): Record<string, unknown> {
  return {
    descriptor: EXAMPLE_DESCRIPTOR,
    component: () => null,
    ...(presentation === undefined ? {} : { presentation }),
  }
}

describe('frozen WorkbenchIconName set (V3 1.1)', () => {
  it('exposes the frozen semantic set and a runtime guard', () => {
    expect(WORKBENCH_ICON_NAMES).toContain('terminal')
    expect(WORKBENCH_ICON_NAMES).toContain('media')
    expect(isWorkbenchIconName('terminal')).toBe(true)
    expect(isWorkbenchIconName('Terminal')).toBe(false)
    expect(isWorkbenchIconName('svg:inject')).toBe(false)
  })
})

describe('PaneViewPresentationV1 registration contract (V3 1.1)', () => {
  it('accepts a bounded presentation and stores it verbatim', () => {
    const reg = registry()
    reg.registerView(baseRegistration({
      icon: 'document', accentColor: '#4F8CFF', defaultEdge: 'right', defaultSize: 420, minWidth: 220, minHeight: 200,
    }))
    const stored = reg.get(EXAMPLE_KIND) as PaneViewRegistrationV1
    expect(stored.presentation).toEqual({
      icon: 'document', accentColor: '#4f8cff', defaultEdge: 'right', defaultSize: 420, minWidth: 220, minHeight: 200,
    })
  })

  it('keeps registerView() compatible when presentation is absent (old providers)', () => {
    const reg = registry()
    reg.registerView(baseRegistration())
    expect((reg.get(EXAMPLE_KIND) as PaneViewRegistrationV1).presentation).toBeUndefined()
  })

  it('rejects non-semantic icons, CSS-carrying colors, and unknown edges', () => {
    const reg = registry()
    expect(() => reg.registerView(baseRegistration({ icon: 'var(--x)' }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ icon: '<script>' }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ accentColor: 'var(--dsw-accent)' }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ accentColor: 'rgb(1,2,3)' }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ accentColor: '#12' }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ defaultEdge: 'top' }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ defaultEdge: 'javascript:alert(1)' }))).toThrow(PaneViewRegistrationError)
  })

  it('rejects out-of-bounds and non-finite sizes', () => {
    const reg = registry()
    expect(() => reg.registerView(baseRegistration({ defaultSize: PRESENTATION_SIZE_MIN - 1 }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ minWidth: PRESENTATION_SIZE_MAX + 1 }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ minHeight: Number.POSITIVE_INFINITY }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ minHeight: '240px' }))).toThrow(PaneViewRegistrationError)
  })

  it('fails closed on unknown fields and executable values', () => {
    const reg = registry()
    expect(() => reg.registerView(baseRegistration({ icon: 'file', css: 'body{display:none}' }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ icon: () => 'file' }))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration(() => ({ icon: 'file' })))).toThrow(PaneViewRegistrationError)
    expect(() => reg.registerView(baseRegistration({ url: 'https://evil.example' }))).toThrow(PaneViewRegistrationError)
  })

  it('rounds fractional sizes to whole pixels', () => {
    const reg = registry()
    reg.registerView(baseRegistration({ defaultSize: 420.6 }))
    expect((reg.get(EXAMPLE_KIND) as PaneViewRegistrationV1).presentation?.defaultSize).toBe(421)
  })
})

import { describe, expect, it } from 'vitest'
import { WorkbenchRegistry } from '../src/registry.ts'
import type { WorkbenchModuleDefinitionV1 } from '../src/types.ts'

function moduleV(version: string): WorkbenchModuleDefinitionV1 {
  return {
    id: 'dsh-conformance',
    version,
    title: 'Conformance',
    requiredCapabilities: [],
    tabs: [
      { id: 'one', moduleId: 'dsh-conformance', title: 'One', order: 0, closable: true, scope: 'session-maybe' },
    ],
    commands: [
      { id: 'conformance.run', moduleId: 'dsh-conformance', title: 'Run' },
    ],
  }
}

describe('Workbench Core conformance', () => {
  it('installs a module and removes every contribution on dispose', () => {
    const registry = new WorkbenchRegistry()
    const dispose = registry.register(moduleV('0.1.0-rc.1'))
    expect(registry.snapshot()).toMatchObject({
      modules: [{ id: 'dsh-conformance' }],
      tabs: [{ id: 'one' }],
      commands: [{ id: 'conformance.run' }],
    })
    dispose()
    expect(registry.snapshot()).toEqual({ modules: [], tabs: [], commands: [] })
  })

  it('supports HMR-style replacement: dispose old generation before registering new', () => {
    const registry = new WorkbenchRegistry()
    const oldDispose = registry.register(moduleV('0.1.0-rc.1'))
    oldDispose()
    const newDispose = registry.register(moduleV('0.1.0-rc.2'))
    const snapshot = registry.snapshot()
    expect(snapshot.modules).toHaveLength(1)
    expect(snapshot.modules[0]?.version).toBe('0.1.0-rc.2')
    expect(snapshot.tabs).toHaveLength(1)
    newDispose()
    expect(registry.snapshot().modules).toHaveLength(0)
  })

  it('rejects duplicate modules even with different versions', () => {
    const registry = new WorkbenchRegistry()
    registry.register(moduleV('0.1.0-rc.1'))
    expect(() => registry.register(moduleV('0.1.0-rc.2'))).toThrow(/already registered/)
  })

  it('keeps two independent registries isolated', () => {
    const left = new WorkbenchRegistry()
    const right = new WorkbenchRegistry()
    left.register(moduleV('0.1.0-rc.1'))
    expect(right.snapshot().modules).toHaveLength(0)
  })
})

import { describe, expect, it } from 'vitest'
import { WorkbenchRegistry } from '../src/registry.ts'
import { isWorkbenchModule, validateWorkbenchModule } from '../src/types.ts'
import type { WorkbenchModuleDefinitionV1 } from '../src/types.ts'

const mediaModule: WorkbenchModuleDefinitionV1 = {
  id: 'dsh-rich-media',
  version: '0.1.0-rc.1',
  title: 'Rich Media',
  requiredCapabilities: [],
  tabs: [
    { id: 'media', moduleId: 'dsh-rich-media', title: '媒体库', order: 0, closable: false, scope: 'session-maybe' },
  ],
  commands: [
    { id: 'media.open', moduleId: 'dsh-rich-media', title: '打开媒体' },
  ],
}

describe('WorkbenchRegistry', () => {
  it('registers and sorts modules/tabs/commands', () => {
    const registry = new WorkbenchRegistry()
    registry.register(mediaModule)
    const snapshot = registry.snapshot()
    expect(snapshot.modules.map(module => module.id)).toEqual(['dsh-rich-media'])
    expect(snapshot.tabs.map(tab => tab.id)).toEqual(['media'])
    expect(snapshot.commands.map(command => command.id)).toEqual(['media.open'])
  })

  it('rejects duplicate modules', () => {
    const registry = new WorkbenchRegistry()
    registry.register(mediaModule)
    expect(() => registry.register(mediaModule)).toThrow(/already registered/)
  })

  it('dispose removes a module', () => {
    const registry = new WorkbenchRegistry()
    const dispose = registry.register(mediaModule)
    dispose()
    expect(registry.snapshot().modules).toHaveLength(0)
  })

  it('validates module descriptors', () => {
    expect(validateWorkbenchModule(mediaModule).ok).toBe(true)
    expect(validateWorkbenchModule({ ...mediaModule, tabs: [{ ...mediaModule.tabs[0]!, title: '' }] }).ok).toBe(false)
    expect(isWorkbenchModule(mediaModule)).toBe(true)
  })
})

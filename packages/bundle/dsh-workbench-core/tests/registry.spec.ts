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

  it('rejects duplicate tab ids across modules', () => {
    const registry = new WorkbenchRegistry()
    registry.register(mediaModule)
    const other: WorkbenchModuleDefinitionV1 = {
      id: 'dsh-other',
      version: '0.1.0-rc.1',
      title: 'Other',
      requiredCapabilities: [],
      tabs: [
        { id: 'media', moduleId: 'dsh-other', title: 'Media again', order: 0, closable: true, scope: 'session-maybe' },
      ],
      commands: [],
    }
    expect(() => registry.register(other)).toThrow(/tab id already registered/)
  })

  it('rejects duplicate command ids across modules', () => {
    const registry = new WorkbenchRegistry()
    registry.register(mediaModule)
    const other: WorkbenchModuleDefinitionV1 = {
      id: 'dsh-other',
      version: '0.1.0-rc.1',
      title: 'Other',
      requiredCapabilities: [],
      tabs: [
        { id: 'other', moduleId: 'dsh-other', title: 'Other', order: 0, closable: true, scope: 'session-maybe' },
      ],
      commands: [
        { id: 'media.open', moduleId: 'dsh-other', title: 'Open media again' },
      ],
    }
    expect(() => registry.register(other)).toThrow(/command id already registered/)
  })

  it('rejects a module whose required capabilities are missing', () => {
    const registry = new WorkbenchRegistry()
    const fsModule: WorkbenchModuleDefinitionV1 = {
      id: 'dsh-file-document',
      version: '0.1.0-rc.1',
      title: 'File Document',
      requiredCapabilities: ['fs.read'],
      tabs: [
        { id: 'files', moduleId: 'dsh-file-document', title: 'Files', order: 0, closable: true, scope: 'session-maybe' },
      ],
      commands: [],
    }
    expect(() => registry.register(fsModule)).toThrow(/requires missing capabilities: fs\.read/)
  })

  it('accepts a module once required capabilities are declared', () => {
    const registry = new WorkbenchRegistry()
    const disposeCapabilities = registry.declareCapabilities(['fs.read'])
    const fsModule: WorkbenchModuleDefinitionV1 = {
      id: 'dsh-file-document',
      version: '0.1.0-rc.1',
      title: 'File Document',
      requiredCapabilities: ['fs.read'],
      tabs: [
        { id: 'files', moduleId: 'dsh-file-document', title: 'Files', order: 0, closable: true, scope: 'session-maybe' },
      ],
      commands: [],
    }
    expect(registry.hasCapability('fs.read')).toBe(true)
    registry.register(fsModule)
    expect(registry.snapshot().modules).toHaveLength(1)
    disposeCapabilities()
    expect(registry.hasCapability('fs.read')).toBe(false)
  })

  it('accepts constructor-provided capabilities for fail-open registration', () => {
    const registry = new WorkbenchRegistry({ capabilities: ['fs.read', 'media.read'] })
    const module: WorkbenchModuleDefinitionV1 = {
      id: 'dsh-demo',
      version: '0.1.0-rc.1',
      title: 'Demo',
      requiredCapabilities: ['media.read'],
      tabs: [
        { id: 'demo', moduleId: 'dsh-demo', title: 'Demo', order: 0, closable: true, scope: 'session-maybe' },
      ],
      commands: [],
    }
    registry.register(module)
    expect(registry.hasCapability('media.read')).toBe(true)
  })
})

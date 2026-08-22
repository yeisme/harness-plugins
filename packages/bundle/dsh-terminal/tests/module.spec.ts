import { describe, expect, it } from 'vitest'
import { WorkbenchRegistry } from '@yeisme/dsh-workbench-core'
import { terminalModule } from '../src/module.ts'

describe('terminalModule', () => {
  it('registers into Workbench Core', () => {
    const registry = new WorkbenchRegistry()
    registry.register(terminalModule)
    const snapshot = registry.snapshot()
    expect(snapshot.modules.map(module => module.id)).toEqual(['dsh-terminal'])
    expect(snapshot.tabs.map(tab => tab.id)).toEqual(['terminal'])
  })
})

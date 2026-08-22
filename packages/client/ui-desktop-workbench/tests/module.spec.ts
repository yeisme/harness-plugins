import { describe, expect, it } from 'vitest'
import { WorkbenchRegistry } from '@yeisme/dsh-workbench-core'
import { desktopWorkbenchModule } from '../src/module.ts'

describe('desktopWorkbenchModule', () => {
  it('registers into Workbench Core', () => {
    const registry = new WorkbenchRegistry()
    registry.register(desktopWorkbenchModule)
    const snapshot = registry.snapshot()
    expect(snapshot.modules.map(item => item.id)).toContain('dsh-desktop-workbench')
    expect(snapshot.tabs.map(item => item.id)).toContain('desktop-sessions')
  })
})

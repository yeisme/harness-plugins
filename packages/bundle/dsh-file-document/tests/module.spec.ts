import { describe, expect, it } from 'vitest'
import { WorkbenchRegistry } from '@yeisme/dsh-workbench-core'
import { fileDocumentModule } from '../src/module.ts'

describe('fileDocumentModule', () => {
  it('registers into Workbench Core', () => {
    const registry = new WorkbenchRegistry()
    registry.register(fileDocumentModule)
    const snapshot = registry.snapshot()
    expect(snapshot.modules.map(module => module.id)).toEqual(['dsh-file-document'])
    expect(snapshot.tabs.map(tab => tab.id)).toEqual(['files', 'documents'])
    expect(snapshot.commands.map(command => command.id)).toEqual(['document.extract', 'file.open'])
  })
})

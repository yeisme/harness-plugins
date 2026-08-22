import { describe, expect, it } from 'vitest'
import { createComposedWorkbenchRegistry } from '../src/composed-registry.ts'

describe('composed workbench registry', () => {
  it('registers Rich Media, File/Document, and Terminal modules', () => {
    const registry = createComposedWorkbenchRegistry()
    const snapshot = registry.snapshot()
    expect(snapshot.modules.map(module => module.id).sort()).toEqual(['dsh-file-document', 'dsh-rich-media', 'dsh-terminal'])
    expect(snapshot.tabs.map(tab => tab.id).sort()).toEqual(['documents', 'files', 'media', 'terminal'])
    expect(snapshot.commands.length).toBeGreaterThan(0)
  })
})

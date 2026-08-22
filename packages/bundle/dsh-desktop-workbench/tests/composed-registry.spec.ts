import { describe, expect, it } from 'vitest'
import { createDesktopWorkbenchRegistry } from '../src/composed-registry.ts'

describe('createDesktopWorkbenchRegistry', () => {
  it('registers desktop, file, terminal, and rich media modules without tab conflicts', () => {
    const registry = createDesktopWorkbenchRegistry()
    const snapshot = registry.snapshot()
    const moduleIds = snapshot.modules.map(module => module.id)
    expect(moduleIds).toEqual(expect.arrayContaining([
      'dsh-desktop-workbench',
      'dsh-file-document',
      'dsh-terminal',
      'dsh-rich-media',
    ]))
    const tabIds = snapshot.tabs.map(tab => tab.id)
    expect(new Set(tabIds).size).toBe(tabIds.length)
    expect(tabIds).toEqual(expect.arrayContaining(['desktop-sessions', 'desktop-notifications', 'desktop-search', 'files', 'documents', 'terminal', 'media']))
  })
})

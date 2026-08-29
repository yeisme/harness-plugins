import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { desktopWorkbenchStyles } from '../src/client/desktop-workbench-styles.ts'

describe('desktop workbench visual adoption', () => {
  it('uses canonical DSH text/accent tokens instead of label synonyms', () => {
    expect(desktopWorkbenchStyles).toContain('--vk-text-primary')
    expect(desktopWorkbenchStyles).toContain('--vk-accent')
    expect(desktopWorkbenchStyles).toContain('--vk-fill-hover')
    expect(desktopWorkbenchStyles).not.toContain('--dsw-alias-label-primary')
    expect(desktopWorkbenchStyles).not.toContain('--dsw-alias-state-business-primary')
    expect(desktopWorkbenchStyles).not.toContain('#f2f2f4')
    expect(desktopWorkbenchStyles).not.toContain('#151517')
  })

  it('terminal and file panes follow the same token names', () => {
    const terminal = readFileSync(fileURLToPath(new URL('../src/client/terminal-pane.tsx', import.meta.url)), 'utf8')
    const fileOpen = readFileSync(fileURLToPath(new URL('../src/client/file-open-pane.tsx', import.meta.url)), 'utf8')
    expect(terminal).toContain('--vk-text-primary')
    expect(terminal).not.toContain('--dsw-alias-label-primary')
    expect(fileOpen).toContain('--vk-text-primary')
    expect(fileOpen).not.toContain('--dsw-alias-label-primary')
  })
})

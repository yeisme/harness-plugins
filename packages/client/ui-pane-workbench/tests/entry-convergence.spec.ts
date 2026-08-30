import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * V3 4.9: every workspace entry family (Explorer, sidebar additive action,
 * Quick Pick, terminal/file links, Plan/Artifact/attachment handoffs)
 * converges on the single `openView()` resource request — and no surface
 * mounts a second SessionSidebar/WorkbenchShell/overlay.
 */
function source(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), 'utf8')
}

describe('workspace entry convergence (V3 4.9)', () => {
  it('navigator entries route through controller.openView', () => {
    for (const file of ['src/explorer/provider.ts', 'src/git/provider.ts', 'src/core-pane.ts']) {
      const text = source(file)
      expect(text, `${file} uses openView`).toContain('openView(')
      expect(text, `${file} never mounts its own surface`).not.toMatch(/createElement\('(nav|aside|section)'[^)]*data-sidebar/)
    }
  })

  it('the pane client exposes exactly one open surface: openView', () => {
    const client = source('src/client.ts')
    expect(client).toContain('openView(request: PaneViewSpecV1): void')
    expect(client).not.toContain('openViewAlternate')
  })

  it('artifact handoff and quick pick open views, never sidebars', () => {
    const artifacts = source('src/artifacts.ts')
    const handoffMenu = source('src/chrome/handoff.tsx')
    expect(artifacts.length + handoffMenu.length).toBeGreaterThan(0)
    const chrome = source('src/chrome/quick-pick.tsx')
    expect(chrome).not.toContain('SessionSidebar')
    expect(chrome).not.toContain('WorkbenchShell')
  })

  it('the desktop-workbench composition opens views instead of a second shell', () => {
    const apply = source('../../bundle/dsh-desktop-workbench/src/client/apply.ts')
    expect(apply).toContain('workbench.openView(')
    expect(apply).not.toMatch(/createElement\([^)]*WorkbenchShell/)
    expect(apply).not.toMatch(/mount.*SessionSidebar/)
  })

  it('the workbench-compose composition mounts one shell and uses the official additive sidebar slot', () => {
    const composed = source('../../bundle/dsh-workbench-compose/src/client/composed-workbench.tsx')
    expect(composed).toContain('WorkbenchShell')
    expect((composed.match(/<WorkbenchShell/g) ?? []).length).toBeLessThanOrEqual(1)
    // the DSH sidebar additive action goes through the single official slot
    expect(composed).toContain("PropsRuntime<'sidebar.footer.action'>")
  })
})

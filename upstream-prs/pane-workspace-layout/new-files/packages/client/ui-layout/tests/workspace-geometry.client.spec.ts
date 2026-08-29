import { describe, expect, it } from 'vitest'
import { computeWorkspaceGeometry } from '@deepseek-ai/dsh-client-ui-layout/src/client/workspace-geometry.ts'
import type { WorkspaceLayoutSnapshot } from '@deepseek-ai/dsh-client-ui-layout/src/client/workspace-layout.ts'

function workspace(overrides: Partial<WorkspaceLayoutSnapshot> = {}): WorkspaceLayoutSnapshot {
  return {
    attached: true,
    ownerId: 'pane',
    rightVisible: false,
    bottomVisible: false,
    rightWidth: 480,
    bottomRatio: 0.34,
    activeRegion: 'right',
    maximizedRegion: undefined,
    ...overrides,
  }
}

describe('computeWorkspaceGeometry', () => {
  it.each([
    [1440, 280, 'dock', 480, 680],
    [1243, 280, 'dock', 480, 483],
    [1024, 0, 'dock', 480, 488],
    [768, 0, 'sheet', 0, 712],
    [390, 0, 'sheet', 0, 334],
  ] as const)('solves width %i without crossing resolved sidebar', (width, sidebar, mode, rightWidth, conversationWidth) => {
    const result = computeWorkspaceGeometry({
      width,
      height: 900,
      sidebar,
      workspace: workspace({ rightVisible: true }),
    })
    expect(result.rightMode).toBe(mode)
    expect(result.rightWidth).toBe(rightWidth)
    expect(result.conversationWidth).toBe(conversationWidth)
    expect(result.sidebar + result.conversationWidth).toBeLessThanOrEqual(width)
    if (mode === 'sheet') expect(result.coverRegion).toBe('right')
  })

  it('reserves only a 44px rail when attached and closed', () => {
    const result = computeWorkspaceGeometry({ width: 1440, height: 900, sidebar: 280, workspace: workspace() })
    expect(result).toMatchObject({ rightMode: 'rail', rightWidth: 44, conversationWidth: 1116 })
  })

  it('has no independent Details geometry', () => {
    const result = computeWorkspaceGeometry({
      width: 1440,
      height: 900,
      sidebar: 280,
      workspace: workspace({ rightVisible: true }),
    })
    expect(result).toMatchObject({ rightMode: 'dock', rightWidth: 480, conversationWidth: 680 })
    expect(result).not.toHaveProperty('detailsWidth')
  })

  it('docks Bottom when the conversation height floor fits and sheets it otherwise', () => {
    const docked = computeWorkspaceGeometry({
      width: 1440,
      height: 900,
      sidebar: 280,
      workspace: workspace({ bottomVisible: true, activeRegion: 'bottom' }),
    })
    expect(docked).toMatchObject({ bottomMode: 'dock', bottomHeight: 306, conversationHeight: 594 })

    const sheet = computeWorkspaceGeometry({
      width: 768,
      height: 400,
      sidebar: 0,
      workspace: workspace({ bottomVisible: true, activeRegion: 'bottom' }),
    })
    expect(sheet).toMatchObject({ bottomMode: 'sheet', coverRegion: 'bottom', sidebar: 56 })
  })

  it('maximizes only to the right of the sidebar', () => {
    const result = computeWorkspaceGeometry({
      width: 1440,
      height: 900,
      sidebar: 280,
      workspace: workspace({ rightVisible: true, maximizedRegion: 'right' }),
    })
    expect(result).toMatchObject({
      sidebar: 280,
      conversationWidth: 1160,
      rightMode: 'maximized',
      coverRegion: 'right',
    })
  })
})

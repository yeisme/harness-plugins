import { describe, expect, it, vi } from 'vitest'
import {
  WORKSPACE_CORE_PANE_VERSION,
  WorkspaceLayoutController,
} from '@deepseek-ai/dsh-client-ui-layout/src/client/workspace-layout.ts'

describe('WorkspaceLayoutController', () => {
  const host = () => ({ open: vi.fn(), close: vi.fn() })

  it('attaches one owner, normalizes defaults, updates and disposes symmetrically', () => {
    const controller = new WorkspaceLayoutController()
    expect(controller.corePaneVersion).toBe(WORKSPACE_CORE_PANE_VERSION)
    const listener = vi.fn()
    controller.subscribe(listener)
    const handle = controller.attach('pane-workbench', { rightVisible: false, bottomVisible: false }, host())
    expect(handle.getSnapshot()).toMatchObject({
      attached: true,
      ownerId: 'pane-workbench',
      rightVisible: false,
      bottomVisible: false,
      rightWidth: 480,
      bottomRatio: 0.34,
    })
    handle.update({ rightVisible: true, activeRegion: 'right' })
    expect(controller.getSnapshot()).toMatchObject({ rightVisible: true, activeRegion: 'right' })
    handle.dispose()
    handle.dispose()
    expect(controller.getSnapshot().attached).toBe(false)
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('fails a duplicate live attach without replacing the original owner', () => {
    const controller = new WorkspaceLayoutController()
    const first = controller.attach('first', {}, host())
    expect(() => controller.attach('second', {}, host())).toThrow(/owner already attached/)
    first.update({ bottomVisible: true })
    expect(controller.getSnapshot()).toMatchObject({ ownerId: 'first', bottomVisible: true })
  })

  it('clears transient maximize', () => {
    const controller = new WorkspaceLayoutController()
    const handle = controller.attach('pane', { rightVisible: true, maximizedRegion: 'right' }, host())
    handle.update({ activeRegion: 'bottom', bottomVisible: true })
    expect(controller.getSnapshot()).toMatchObject({ maximizedRegion: 'right' })
    controller.restoreMaximized()
    expect(controller.getSnapshot().maximizedRegion).toBeUndefined()
  })

  it('routes the closed Core Pane id through the attached host and clears it on dispose', () => {
    const controller = new WorkspaceLayoutController()
    const host = { open: vi.fn(), close: vi.fn() }
    const handle = controller.attach('pane', {}, host)
    controller.openCorePane('dsh.tool-details')
    controller.closeCorePane('dsh.tool-details')
    expect(host.open).toHaveBeenCalledWith('dsh.tool-details')
    expect(host.close).toHaveBeenCalledWith('dsh.tool-details')

    handle.dispose()
    expect(() => { controller.openCorePane('dsh.tool-details') }).toThrow(/Core Pane owner is required/)
    expect(() => { controller.closeCorePane('dsh.tool-details') }).toThrow(/Core Pane owner is required/)
  })

  it('ignores stale handle writes after disposal and allows a fresh generation', () => {
    const controller = new WorkspaceLayoutController()
    const stale = controller.attach('pane', {}, host())
    stale.dispose()
    const live = controller.attach('pane', {}, host())
    stale.update({ rightVisible: true })
    expect(controller.getSnapshot().rightVisible).toBe(false)
    live.update({ rightVisible: true })
    expect(controller.getSnapshot().rightVisible).toBe(true)
  })
})

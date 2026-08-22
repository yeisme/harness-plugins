import { describe, expect, it } from 'vitest'
import { desktopWorkbenchBundleV1 } from '../src/index.ts'

describe('@yeisme/dsh-desktop-workbench', () => {
  it('exposes a versioned bundle descriptor', () => {
    expect(desktopWorkbenchBundleV1.id).toBe('dsh-desktop-workbench')
    expect(desktopWorkbenchBundleV1.version).toBe('0.1.0-rc.1')
    expect(desktopWorkbenchBundleV1.module.id).toBe('dsh-desktop-workbench')
  })

  it('exposes placeholder host adapters', () => {
    expect(desktopWorkbenchBundleV1.hosts.session.capability).toBe('session-manager')
    expect(desktopWorkbenchBundleV1.hosts.file.capability).toBe('file-host')
    expect(desktopWorkbenchBundleV1.hosts.terminal.capability).toBe('terminal-host')
  })
})

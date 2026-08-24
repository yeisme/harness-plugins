import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { desktopWorkbenchBundleV1 } from '../src/index.ts'

/** 从 peer range 提取 `>=x.y.z` 下界；无下界视为未锚定。 */
function layoutPeerMinimum(packagePath: string): string | undefined {
  const peers = JSON.parse(readFileSync(fileURLToPath(new URL(packagePath, import.meta.url)), 'utf-8')).peerDependencies as Record<string, string>
  const range = peers['@deepseek-ai/dsh-client-ui-layout']
  return range?.match(/>=\s*([^\s<]+)/)?.[1]
}

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

  // 本 bundle 在 apply 时经 pane workbench client 硬性要求 core-pane seam，
  // 三处声明（client 包 / pane-workbench bundle / 本 bundle）不得漂移：
  // 漂移会让旧版 DSH 通过 peer 检查后只能在启动期 fail loud。
  it('pins the core-pane layout peer anchor consistently with the pane family', () => {
    const clientMinimum = layoutPeerMinimum('../../../client/ui-pane-workbench/package.json')
    const paneBundleMinimum = layoutPeerMinimum('../../pane-workbench/package.json')
    const ownMinimum = layoutPeerMinimum('../package.json')
    expect(clientMinimum).toBeDefined()
    expect(ownMinimum).toBe(clientMinimum)
    expect(paneBundleMinimum).toBe(clientMinimum)
  })
})

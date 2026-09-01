import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { desktopWorkbenchBundleV1 } from '../src/index.ts'
import { apply as bundleApply } from '../src/index.ts'
import { bindSessionManagerHost } from '@yeisme/dsh-session-manager'
import type { SessionManagerHostV1, SessionManagerHostPluginContext } from '@yeisme/dsh-session-manager'

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

  it('resolves the session host through the plugin-provided real service before the placeholder', async () => {
    await expect(desktopWorkbenchBundleV1.hosts.session.listSessions()).resolves.toEqual([])
    const rows = [{ sessionId: 'session-1', title: '后端设计', archived: false, running: true, unread: false, labels: [] }]
    const real: SessionManagerHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'session-manager',
      async listSessions() {
        return rows
      },
      async archiveSession(sessionId) { return { status: 'ok', sessionId } },
      async restoreSession(sessionId) { return { status: 'ok', sessionId } },
      async trashSession(sessionId) { return { status: 'ok', sessionId } },
      async purgeSession(sessionId) { return { status: 'ok', sessionId } },
      async setLabels(sessionId) { return { status: 'ok', sessionId } },
      async pauseSession(sessionId) { return { status: 'ok', sessionId } },
      async resumeSession(sessionId) { return { status: 'ok', sessionId } },
      async forkSession(sessionId) { return { status: 'ok', sessionId } },
    }
    const unbind = bindSessionManagerHost(real)
    try {
      expect(desktopWorkbenchBundleV1.hosts.session).toBe(real)
      await expect(desktopWorkbenchBundleV1.hosts.session.listSessions()).resolves.toEqual(rows)
    } finally {
      unbind()
    }
    await expect(desktopWorkbenchBundleV1.hosts.session.listSessions()).resolves.toEqual([])
  })

  it('wires the official session seams through the node apply', async () => {
    let activate: ((child: SessionManagerHostPluginContext) => void | (() => void)) | undefined
    let activationTeardown: (() => void) | undefined
    const provided = new Map<string, unknown>()
    const ctx = {
      inject: (names: readonly string[], callback: (child: SessionManagerHostPluginContext) => void | (() => void)) => {
        expect(names).toEqual(['sessionPersistence', 'workspaceRegistry', 'agents'])
        activate = callback
        return () => {
          activationTeardown?.()
          activationTeardown = undefined
          activate = undefined
        }
      },
      provide: (key: string, service: unknown) => {
        provided.set(key, service)
        return () => { provided.delete(key) }
      },
      effect: (setup: () => () => void) => {
        const teardown = setup()
        return () => { teardown() }
      },
      sessionPersistence: { async list() { return [{ id: 'session-9', createdAt: 9 }] } },
      workspaceRegistry: { list: () => [], archivedSessionIds: [], async archiveSession() {} },
      agents: { get: () => undefined },
    }
    const dispose = bundleApply(ctx)
    try {
      expect(activate).toBeTypeOf('function')
      const teardown = activate?.(ctx)
      if (typeof teardown === 'function') activationTeardown = teardown
      await expect(desktopWorkbenchBundleV1.hosts.session.listSessions()).resolves.toEqual([
        { sessionId: 'session-9', archived: false, running: false, unread: false, labels: [] },
      ])
      expect([...provided.keys()]).toContain('dsh.sessionManagerHost')
    } finally {
      dispose()
    }
    await expect(desktopWorkbenchBundleV1.hosts.session.listSessions()).resolves.toEqual([])
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

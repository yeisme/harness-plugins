import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { apply, clientInject, clientName } from '../src/client/index.ts'
import DshSessionCookieManagerClientPlugin from '../src/client/index.ts'

describe('bundle smoke', () => {
  it('ships a cordis patch and a dsh bundle descriptor', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')).toContain('@yeisme/dsh-session-cookie-manager')
  })
  it('client entry exposes ModuleLoader apply without requiring Pane Workbench', () => {
    expect(clientName).toBe('dsh-session-cookie-manager/client')
    expect(clientInject).toEqual([])
    expect(typeof apply).toBe('function')
    expect(typeof DshSessionCookieManagerClientPlugin.apply).toBe('function')
    const disposer = apply({ get: () => undefined } as never)
    expect(typeof disposer).toBe('function')
    disposer()
  })
  it('registers login profiles only when paneWorkbench is present', () => {
    const registerView = vi.fn(() => vi.fn())
    const dispose = apply({ get: (name: string) => name === 'paneWorkbench' ? { registerView } : undefined } as never)
    expect(registerView).toHaveBeenCalledTimes(1)
    expect(registerView.mock.calls[0]?.[0]?.descriptor?.kind).toBe('workspace.login-profiles')
    dispose()
  })

  it('passes official sessions.list as the login-account snapshot when present', () => {
    const registerView = vi.fn(() => vi.fn())
    const sessions = {
      list: {
        getSnapshot: () => ({
          ids: ['sess-1'],
          byId: { 'sess-1': { displayTitle: 'Work chat', running: true } },
        }),
      },
    }
    apply({
      get: (name: string) => name === 'paneWorkbench' ? { registerView } : name === 'sessions' ? sessions : undefined,
    } as never)
    const input = registerView.mock.calls[0]?.[0] as { component: () => unknown }
    const html = renderToStaticMarkup(createElement(input.component as never))
    expect(html).toContain('Work chat')
    expect(html).not.toContain('demo')
  })
})

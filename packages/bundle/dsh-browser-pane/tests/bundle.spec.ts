import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DSH_BROWSER_PANE_HOST_CONTEXT_KEY } from '../src/registration.js'

/** browser-pane 3.5 — definition schema, probe/factory selection, parity, and forbidden deps. */
function source(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), 'utf8')
}

describe('bundle definition & dependencies (browser-pane 3.5)', () => {
  it('package identity and version match the spec', () => {
    const pkg = JSON.parse(source('package.json')) as { name: string; version: string; dependencies: Record<string, string> }
    expect(pkg.name).toBe('@yeisme/dsh-browser-pane')
    expect(pkg.version).toBe('0.1.0-rc.1')
    expect(Object.keys(pkg.dependencies)).toEqual(['@yeisme/dsh-browser-host', '@yeisme/dsh-client-ui-browser-pane'])
  })

  it('forbids iframes, arbitrary fetch, concrete providers, and private DSH APIs in source', () => {
    for (const file of ['src/index.ts', 'src/client/index.ts', 'src/registration.ts']) {
      const text = source(file)
      expect(text, `${file} iframe`).not.toMatch(/<iframe|createElement\('iframe'/i)
      expect(text, `${file} fetch`).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket/)
      expect(text, `${file} concrete provider`).not.toMatch(/playwright|puppeteer|selenium/i)
      expect(text, `${file} dsh private`).not.toMatch(/from '@deepseek-ai\/dsh-(?!client-runtime)/)
    }
  })

  it('exposes the Typert host context key and re-exports the local factory face', async () => {
    expect(DSH_BROWSER_PANE_HOST_CONTEXT_KEY).toBe('dsh.browserPaneHost')
    const client = await import('../src/client/index.js')
    for (const factory of ['BROWSER_PANE_CLIENT_VIEW_KIND', 'deriveBrowserPaneView', 'gateBrowserPaneSurfaces', 'reduceBrowserPane']) {
      expect(client, factory).toHaveProperty(factory)
    }
  })

  it('registration disposes HMR-safely (idempotent)', async () => {
    const { applyBrowserPaneRegistration } = await import('../src/registration.js')
    const { createFakeBrowserAutomationProvider } = await import('@yeisme/dsh-browser-host')
    const disposeView = { dispose: () => {} }
    const disposers: number[] = []
    const pane = {
      registerView: () => { disposers.push(1); return () => { disposers.pop() } },
      registerCommand: () => () => {},
    }
    const result = await applyBrowserPaneRegistration({ pane, provider: createFakeBrowserAutomationProvider(), viewportTransportAvailable: false })
    expect(result.registered).toBe(true)
    result.dispose()
    result.dispose()
    expect(disposers).toHaveLength(0)
    void disposeView
  })
})

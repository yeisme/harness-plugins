import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * browser-pane 1.7 — host wire parity and source independence.
 * The package must not import a concrete browser service, DSH private API,
 * or any workspace UI package; the public face must stay additive-only.
 */
function source(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), 'utf8')
}

describe('source independence (browser-pane 1.7)', () => {
  it('imports no concrete browser service, playwright/puppeteer, or DSH private API', () => {
    for (const file of ['src/index.ts', 'src/contracts.ts', 'src/validation.ts', 'src/remote.ts', 'src/fake-provider.ts']) {
      const text = source(file)
      expect(text, `${file} playwright`).not.toMatch(/playwright|puppeteer|selenium|cdp-puppeteer/i)
      expect(text, `${file} dsh private`).not.toMatch(/from '@deepseek-ai\/dsh-(?!client-runtime)/)
      expect(text, `${file} workspace ui`).not.toMatch(/@yeisme\/dsh-client-ui/)
      expect(text, `${file} node builtin net`).not.toMatch(/node:(?:net|http|https|child_process)/)
    }
  })

  it('stays dependency-minimal: only zod as a runtime dep', () => {
    const pkg = JSON.parse(source('package.json')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([])
    for (const forbidden of Object.keys(pkg.devDependencies ?? {})) {
      expect(['playwright', 'puppeteer', '@deepseek-ai/cordis']).not.toContain(forbidden)
    }
  })
})

describe('wire parity (browser-pane 1.7)', () => {
  it('schema constants freeze the four v0.1 wires', async () => {
    const contracts = await import('../src/contracts.js')
    expect(contracts.BROWSER_AUTOMATION_PROJECTION_SCHEMA).toBe('browser.automation.projection.v0.1')
    expect(contracts.BROWSER_AUTOMATION_EVENT_SCHEMA).toBe('browser.automation.event.v0.1')
    expect(contracts.BROWSER_AUTOMATION_ACTION_SCHEMA).toBe('browser.automation.action.v0.1')
    expect(contracts.BROWSER_VIEWPORT_ATTACHMENT_SCHEMA).toBe('browser.viewport.attachment.v0.1')
  })

  it('the host face keeps exactly five methods plus capability markers', async () => {
    const { createBrowserPaneHost } = await import('../src/remote.js')
    const { createFakeBrowserAutomationProvider } = await import('../src/fake-provider.js')
    const provider = createFakeBrowserAutomationProvider()
    const host = createBrowserPaneHost({
      probe: async () => ({ available: true }),
      listSessions: provider.discoverSessions,
      snapshot: async () => { throw new Error('unused') },
      dispatch: async () => { throw new Error('unused') },
      reconcile: async () => { throw new Error('unused') },
    })
    for (const method of ['probe', 'listSessions', 'snapshot', 'dispatch', 'reconcile'] as const) {
      expect(typeof host[method], method).toBe('function')
    }
    expect(host.capability).toBe('browser.pane.host')
    expect(typeof host.probe).toBe('function')
    expect(typeof host.dispatch).toBe('function')
  })
})
